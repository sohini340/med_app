from datetime import datetime, timedelta
from sqlalchemy import func

from app import models


# ============================================================
# DATE HELPERS
# ============================================================

def get_period(period: str):
    now = datetime.utcnow()

    if period == "today":
        start = datetime(now.year, now.month, now.day)

    elif period == "week":
        start = now - timedelta(days=now.weekday())
        start = datetime(start.year, start.month, start.day)

    elif period == "month":
        start = datetime(now.year, now.month, 1)

    else:
        start = datetime(2000, 1, 1)

    return start, now


# ============================================================
# INVENTORY ANALYTICS
# ============================================================

def get_inventory(db):

    medicines = db.query(models.Medicine).all()

    return [
        {
            "medicine_id": medicine.medicine_id,
            "name": medicine.name,
            "composition": medicine.composition,
            "brand": medicine.brand,
            "stock_quantity": medicine.stock_quantity,
            "expiry_date": (
                medicine.expiry_date.isoformat()
                if medicine.expiry_date
                else None
            ),
        }
        for medicine in medicines
    ]


def get_low_stock(db, threshold=10):

    medicines = (
        db.query(models.Medicine)
        .filter(models.Medicine.stock_quantity <= threshold)
        .order_by(models.Medicine.stock_quantity.asc())
        .all()
    )

    return [
        {
            "name": medicine.name,
            "brand": medicine.brand,
            "stock_quantity": medicine.stock_quantity,
        }
        for medicine in medicines
    ]


def get_out_of_stock(db):

    medicines = (
        db.query(models.Medicine)
        .filter(models.Medicine.stock_quantity <= 0)
        .all()
    )

    return [
        {
            "name": medicine.name,
            "brand": medicine.brand,
        }
        for medicine in medicines
    ]


# ============================================================
# SALES ANALYTICS
# ============================================================

def get_sales_summary(db, period="all"):

    start, end = get_period(period)

    query = db.query(models.Order).filter(
        models.Order.payment_status == "paid"
    )

    if period != "all":
        query = query.filter(
            models.Order.order_date >= start,
            models.Order.order_date <= end
        )

    orders = query.all()

    revenue = sum(
        order.total_price or 0
        for order in orders
    )

    order_count = len(orders)

    average_order_value = (
        revenue / order_count
        if order_count
        else 0
    )

    return {
        "period": period,
        "revenue": round(revenue, 2),
        "orders": order_count,
        "average_order_value": round(
            average_order_value,
            2
        ),
    }


# ============================================================
# TOP SELLING MEDICINES
# ============================================================

def get_top_selling_medicines(
    db,
    period="all",
    limit=10
):

    start, end = get_period(period)

    query = (
        db.query(
            models.Medicine.name,
            models.Medicine.brand,
            func.sum(
                models.OrderItem.quantity
            ).label("quantity_sold"),
            func.sum(
                models.OrderItem.quantity *
                models.OrderItem.price
            ).label("sales_value")
        )
        .join(
            models.OrderItem,
            models.Medicine.medicine_id ==
            models.OrderItem.medicine_id
        )
        .join(
            models.Order,
            models.Order.order_id ==
            models.OrderItem.order_id
        )
        .filter(
            models.Order.payment_status == "paid"
        )
    )

    if period != "all":
        query = query.filter(
            models.Order.order_date >= start,
            models.Order.order_date <= end
        )

    results = (
        query
        .group_by(
            models.Medicine.medicine_id
        )
        .order_by(
            func.sum(
                models.OrderItem.quantity
            ).desc()
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "name": name,
            "brand": brand,
            "quantity_sold": int(quantity_sold or 0),
            "sales_value": round(
                float(sales_value or 0),
                2
            ),
        }
        for name, brand, quantity_sold, sales_value
        in results
    ]


# ============================================================
# SLOWEST SELLING MEDICINES
# ============================================================

def get_slowest_selling_medicines(
    db,
    period="month",
    limit=10
):

    start, end = get_period(period)

    results = (
        db.query(
            models.Medicine.name,
            models.Medicine.brand,
            func.coalesce(
                func.sum(models.OrderItem.quantity),
                0
            ).label("quantity_sold")
        )
        .outerjoin(
            models.OrderItem,
            models.Medicine.medicine_id ==
            models.OrderItem.medicine_id
        )
        .outerjoin(
            models.Order,
            models.Order.order_id ==
            models.OrderItem.order_id
        )
        .filter(
            (models.Order.order_id == None) |
            (
                (models.Order.payment_status == "paid") &
                (models.Order.order_date >= start) &
                (models.Order.order_date <= end)
            )
        )
        .group_by(
            models.Medicine.medicine_id
        )
        .order_by(
            func.coalesce(
                func.sum(models.OrderItem.quantity),
                0
            ).asc()
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "name": name,
            "brand": brand,
            "quantity_sold": int(quantity_sold or 0),
        }
        for name, brand, quantity_sold in results
    ]


# ============================================================
# PAYMENT ANALYTICS
# ============================================================

def get_payment_summary(db, period="all"):

    start, end = get_period(period)

    query = db.query(models.Order)

    if period != "all":
        query = query.filter(
            models.Order.order_date >= start,
            models.Order.order_date <= end
        )

    orders = query.all()

    paid = sum(
        order.total_price or 0
        for order in orders
        if order.payment_status == "paid"
    )

    pending = sum(
        order.total_price or 0
        for order in orders
        if order.payment_status != "paid"
    )

    return {
        "paid": round(paid, 2),
        "pending": round(pending, 2),
        "total_order_value": round(
            paid + pending,
            2
        ),
    }

# ============================================================
# EXPIRY ANALYTICS
# ============================================================

def get_expired_medicines(db):

    today = datetime.utcnow().date()

    medicines = (
        db.query(models.Medicine)
        .filter(
            models.Medicine.expiry_date != None,
            models.Medicine.expiry_date < today
        )
        .order_by(
            models.Medicine.expiry_date.asc()
        )
        .all()
    )

    return [
        {
            "name": medicine.name,
            "brand": medicine.brand,
            "composition": medicine.composition,
            "stock_quantity": medicine.stock_quantity,
            "expiry_date": medicine.expiry_date.isoformat(),
        }
        for medicine in medicines
    ]


def get_expiring_medicines(
    db,
    days=30
):

    today = datetime.utcnow().date()
    expiry_limit = today + timedelta(days=days)

    medicines = (
        db.query(models.Medicine)
        .filter(
            models.Medicine.expiry_date != None,
            models.Medicine.expiry_date >= today,
            models.Medicine.expiry_date <= expiry_limit
        )
        .order_by(
            models.Medicine.expiry_date.asc()
        )
        .all()
    )

    return [
        {
            "name": medicine.name,
            "brand": medicine.brand,
            "composition": medicine.composition,
            "stock_quantity": medicine.stock_quantity,
            "expiry_date": medicine.expiry_date.isoformat(),
            "days_remaining": (
                medicine.expiry_date - today
            ).days,
        }
        for medicine in medicines
    ]

# ============================================================
# EMPLOYEE INVENTORY SUMMARY
# ============================================================

def get_inventory_summary(db):

    medicines = db.query(models.Medicine).all()

    total_medicines = len(medicines)

    total_units = sum(
        medicine.stock_quantity or 0
        for medicine in medicines
    )

    out_of_stock = [
        medicine for medicine in medicines
        if (medicine.stock_quantity or 0) <= 0
    ]

    low_stock = [
        medicine for medicine in medicines
        if 0 < (medicine.stock_quantity or 0) <= 10
    ]

    expired = get_expired_medicines(db)

    expiring_soon = get_expiring_medicines(
        db,
        days=30
    )

    return {
        "total_medicine_types": total_medicines,
        "total_units": total_units,
        "out_of_stock_count": len(out_of_stock),
        "low_stock_count": len(low_stock),
        "expired_count": len(expired),
        "expiring_within_30_days": len(expiring_soon),
    }