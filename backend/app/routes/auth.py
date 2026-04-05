from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
import bcrypt

from app.utils.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


# ------------------ DB ------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------ REGISTER ------------------
@router.post("/register")
def register_user(data: dict, db: Session = Depends(get_db)):
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    role = data.get("role", "customer")

    if not all([name, email, password]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    # 🔍 Check if already exists in USERS
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 🔍 Check if already requested as employee
    if role == "employee":
        existing_request = db.query(models.EmployeeSignupRequest).filter(
            models.EmployeeSignupRequest.email == email
        ).first()

        if existing_request:
            raise HTTPException(status_code=400, detail="Request already submitted")

    hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    # ================= CUSTOMER =================
    if role == "customer":
        new_user = models.User(
            name=name,
            email=email,
            phone=phone,
            password=hashed_password,
            role="customer",
            status="active",
            is_approved=True
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "message": "Customer registered successfully",
            "user": {
                "user_id": new_user.user_id,
                "name": new_user.name,
                "email": new_user.email,
                "role": new_user.role
            }
        }

    # ================= EMPLOYEE =================
    elif role == "employee":
        new_request = models.EmployeeSignupRequest(
            name=name,
            email=email,
            phone=phone,
            password_hash=hashed_password,
            status="pending"
        )

        db.add(new_request)
        db.commit()
        db.refresh(new_request)

        return {
            "message": "Employee registration request submitted. Wait for admin approval."
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid role")


# ------------------ LOGIN ------------------
@router.post("/login")
def login_user(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not bcrypt.checkpw(password.encode(), user.password.encode()):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if user.status == "blocked":
        raise HTTPException(status_code=403, detail="User blocked")

    # 🔥 BLOCK UNAPPROVED EMPLOYEES
    if user.role == "employee" and not user.is_approved:
        raise HTTPException(status_code=403, detail="Employee not approved yet")

    # 🔥 CREATE TOKEN
    access_token = create_access_token({
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role
    })

    return {
        "access_token": access_token,
        "user": {
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "phone": user.phone,
            "status": user.status
        }
    }