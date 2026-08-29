from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
import bcrypt
import random
from datetime import datetime, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests
from app.utils.security import create_access_token
import os

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

router = APIRouter(prefix="/auth", tags=["Auth"])


# ------------------ DB ------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# OTP HELPERS
# =========================================================

def generate_otp():
    return str(random.randint(100000, 999999))


# ------------------ SEND OTP ------------------
@router.post("/send-otp")
def send_otp(data: dict, db: Session = Depends(get_db)):

    email = data.get("email")
    phone = data.get("phone")
    verification_type = data.get("verification_type")

    if verification_type not in ["email", "phone"]:
        raise HTTPException(
            status_code=400,
            detail="verification_type must be 'email' or 'phone'"
        )

    # Email OTP
    if verification_type == "email":

        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email is required"
            )

        otp = generate_otp()

        # Remove previous email OTPs
        db.query(models.OTPVerification).filter(
            models.OTPVerification.email == email,
            models.OTPVerification.verification_type == "email"
        ).delete()

        verification = models.OTPVerification(
            email=email,
            phone=None,
            verification_type="email",
            otp=otp,
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            verified=False
        )

        db.add(verification)
        db.commit()

        # TEMPORARY: print OTP in terminal
        print("=" * 50)
        print(f"EMAIL OTP for {email}: {otp}")
        print("=" * 50)

        return {
            "message": "Email OTP sent successfully"
        }

    # Phone OTP
    if verification_type == "phone":

        if not phone:
            raise HTTPException(
                status_code=400,
                detail="Phone number is required"
            )

        otp = generate_otp()

        # Remove previous phone OTPs
        db.query(models.OTPVerification).filter(
            models.OTPVerification.phone == phone,
            models.OTPVerification.verification_type == "phone"
        ).delete()

        verification = models.OTPVerification(
            email=None,
            phone=phone,
            verification_type="phone",
            otp=otp,
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            verified=False
        )

        db.add(verification)
        db.commit()

        # TEMPORARY: print OTP in terminal
        print("=" * 50)
        print(f"PHONE OTP for {phone}: {otp}")
        print("=" * 50)

        return {
            "message": "Phone OTP sent successfully"
        }


# ------------------ VERIFY OTP ------------------
@router.post("/verify-otp")
def verify_otp(data: dict, db: Session = Depends(get_db)):

    verification_type = data.get("verification_type")
    otp = data.get("otp")

    if verification_type not in ["email", "phone"]:
        raise HTTPException(
            status_code=400,
            detail="verification_type must be 'email' or 'phone'"
        )

    if not otp:
        raise HTTPException(
            status_code=400,
            detail="OTP is required"
        )

    # ---------------- EMAIL ----------------
    if verification_type == "email":

        email = data.get("email")

        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email is required"
            )

        verification = db.query(
            models.OTPVerification
        ).filter(
            models.OTPVerification.email == email,
            models.OTPVerification.verification_type == "email",
            models.OTPVerification.otp == otp
        ).order_by(
            models.OTPVerification.created_at.desc()
        ).first()

    # ---------------- PHONE ----------------
    else:

        phone = data.get("phone")

        if not phone:
            raise HTTPException(
                status_code=400,
                detail="Phone number is required"
            )

        verification = db.query(
            models.OTPVerification
        ).filter(
            models.OTPVerification.phone == phone,
            models.OTPVerification.verification_type == "phone",
            models.OTPVerification.otp == otp
        ).order_by(
            models.OTPVerification.created_at.desc()
        ).first()

    if not verification:
        raise HTTPException(
            status_code=400,
            detail="Invalid OTP"
        )

    if verification.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="OTP expired"
        )

    verification.verified = True
    db.commit()

    return {
        "message": f"{verification_type.capitalize()} verified successfully",
        "verified": True
    }


# =========================================================
# REGISTER
# =========================================================

@router.post("/register")
def register_user(data: dict, db: Session = Depends(get_db)):

    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    role = data.get("role", "customer")

    if not all([name, email, phone, password]):
        raise HTTPException(
            status_code=400,
            detail="Name, email, phone and password are required"
        )

    # Check email verification
    email_verified = db.query(
        models.OTPVerification
    ).filter(
        models.OTPVerification.email == email,
        models.OTPVerification.verification_type == "email",
        models.OTPVerification.verified == True
    ).order_by(
        models.OTPVerification.created_at.desc()
    ).first()

    if not email_verified:
        raise HTTPException(
            status_code=400,
            detail="Email is not verified"
        )

    # Check phone verification
    phone_verified = db.query(
        models.OTPVerification
    ).filter(
        models.OTPVerification.phone == phone,
        models.OTPVerification.verification_type == "phone",
        models.OTPVerification.verified == True
    ).order_by(
        models.OTPVerification.created_at.desc()
    ).first()

    if not phone_verified:
        raise HTTPException(
            status_code=400,
            detail="Phone number is not verified"
        )

    # Check existing user
    existing_user = db.query(
        models.User
    ).filter(
        models.User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Check phone
    existing_phone = db.query(
        models.User
    ).filter(
        models.User.phone == phone
    ).first()

    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered"
        )

    # Employee request already exists
    if role == "employee":

        existing_request = db.query(
            models.EmployeeSignupRequest
        ).filter(
            models.EmployeeSignupRequest.email == email
        ).first()

        if existing_request:
            raise HTTPException(
                status_code=400,
                detail="Request already submitted"
            )

    hashed_password = bcrypt.hashpw(
        password.encode(),
        bcrypt.gensalt()
    ).decode()

    # =====================================================
    # CUSTOMER
    # =====================================================

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
                "phone": new_user.phone,
                "role": new_user.role
            }
        }

    # =====================================================
    # EMPLOYEE
    # =====================================================

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
        raise HTTPException(
            status_code=400,
            detail="Invalid role"
        )


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
def login_user(data: dict, db: Session = Depends(get_db)):

    email = data.get("email")
    password = data.get("password")

    user = db.query(
        models.User
    ).filter(
        models.User.email == email
    ).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid credentials"
        )

    if not bcrypt.checkpw(
        password.encode(),
        user.password.encode()
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid credentials"
        )

    if user.status == "blocked":
        raise HTTPException(
            status_code=403,
            detail="User blocked"
        )

    if user.role == "employee" and not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Employee not approved yet"
        )

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


# =========================================================
# GOOGLE LOGIN
# =========================================================

@router.post("/google")
def google_login(data: dict, db: Session = Depends(get_db)):

    credential = data.get("credential")

    if not credential:
        raise HTTPException(
            status_code=400,
            detail="Google credential missing"
        )

    try:

        google_user = id_token.verify_oauth2_token(
            credential,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

    except ValueError:

        raise HTTPException(
            status_code=401,
            detail="Invalid Google credential"
        )

    email = google_user.get("email")
    name = google_user.get("name") or email.split("@")[0]

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Google account email not available"
        )

    user = db.query(
        models.User
    ).filter(
        models.User.email == email
    ).first()

    if not user:

        user = models.User(
            name=name,
            email=email,
            password="GOOGLE_AUTH",
            phone=None,
            role="customer",
            status="active",
            is_approved=True
        )

        db.add(user)
        db.commit()
        db.refresh(user)

    if user.status == "blocked":

        raise HTTPException(
            status_code=403,
            detail="User blocked"
        )

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