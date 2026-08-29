from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models
from app.services.ai import ask_mochi
from app.services.analytics import (
    get_inventory,
    get_low_stock,
    get_out_of_stock,
    get_expired_medicines,
    get_expiring_medicines,
    get_inventory_summary,
    get_top_selling_medicines,
)
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/mochi",
    tags=["Mochi"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Message(BaseModel):
    role: str
    content: str


class MochiRequest(BaseModel):
    systemPrompt: str
    messages: list[Message]


@router.post("/chat")
async def chat(
    request: MochiRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    role = current_user["role"].lower()

    # =========================================================
    # INVENTORY CONTEXT
    # Employee + Owner
    # =========================================================

    context = ""

    if role in ["employee", "owner"]:

        inventory = get_inventory(db)
        low_stock = get_low_stock(db)
        out_of_stock = get_out_of_stock(db)
        expired = get_expired_medicines(db)
        expiring = get_expiring_medicines(db, days=30)
        summary = get_inventory_summary(db)

        context += f"""
PHARMACY INVENTORY DATA

Inventory summary:
{summary}

All medicines:
{inventory}

Low-stock medicines:
{low_stock}

Out-of-stock medicines:
{out_of_stock}

Expired medicines:
{expired}

Medicines expiring within 30 days:
{expiring}
"""

    # =========================================================
    # OWNER-ONLY DATA
    # =========================================================

    if role == "owner":

        top_selling = get_top_selling_medicines(
            db,
            period="all",
            limit=10
        )

        orders = db.query(models.Order).filter(
            models.Order.payment_status == "paid"
        ).all()

        total_revenue = sum(
            order.total_price or 0
            for order in orders
        )

        context += f"""

OWNER BUSINESS DATA

Total paid revenue:
₹{total_revenue:.2f}

Top-selling medicines:
{top_selling}
"""

    # =========================================================
    # ROLE PERMISSIONS
    # =========================================================

    enhanced_system_prompt = f"""
{request.systemPrompt}

You are Mochi, an AI pharmacy operations assistant.

CURRENT USER ROLE:
{role}

PERMISSIONS:

CUSTOMER:
- General health/pharmacy information only.
- No access to pharmacy inventory.
- No access to sales.
- No access to revenue.
- No access to internal business data.

EMPLOYEE:
- Can access medicine inventory.
- Can access medicine names.
- Can access composition.
- Can access brand.
- Can access supplier.
- Can access stock quantities.
- Can access medicine prices.
- Can access expiry information.
- Can access low-stock medicines.
- Can access out-of-stock medicines.
- Can access operational information.
- CANNOT access revenue.
- CANNOT access profit.
- CANNOT access financial analytics.

OWNER:
- Can access everything available to employees.
- Can access revenue.
- Can access sales.
- Can access top-selling medicines.
- Can access financial analytics.

IMPORTANT:
- Never reveal information outside the user's permissions.
- Never invent database values.
- Use the provided database context for factual answers.
- If the requested information is not present, say that it is unavailable.
- Do calculations using the provided data carefully.
- Do not claim that a medicine is available unless the inventory data supports it.

DATABASE CONTEXT:

{context}
"""

    messages = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in request.messages
    ]

    response = await ask_mochi(
        enhanced_system_prompt,
        messages
    )

    return {
        "response": response
    }