from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    Date, Time, Text, ForeignKey, DateTime, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


# ------------------ USERS ------------------
class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    phone = Column(String)

    role = Column(String, default="customer")
    status = Column(String, default="active")
    is_approved = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    orders = relationship("Order", back_populates="customer", foreign_keys="Order.customer_id")
    appointments = relationship("Appointment", back_populates="customer")

# ------------------ MEDICINES ------------------
class Medicine(Base):
    __tablename__ = "medicines"

    medicine_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    composition = Column(String)
    brand = Column(String)

    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=0)

    expiry_date = Column(Date)
    supplier = Column(String)


# ------------------ ORDERS ------------------
class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, ForeignKey("users.user_id"))
    employee_id = Column(Integer, ForeignKey("users.user_id"))

    customer_name = Column(String)
    customer_phone = Column(String)

    subtotal = Column(Float, nullable=False)

    discount_type = Column(String)  # percentage / fixed
    discount_value = Column(Float, default=0)
    discount_amount = Column(Float, default=0)

    total_price = Column(Float)

    payment_method = Column(String, default="offline")
    payment_status = Column(String, default="pending")

    order_date = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", foreign_keys=[customer_id])
    items = relationship("OrderItem", back_populates="order")


# ------------------ ORDER ITEMS ------------------
class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.order_id"))
    medicine_id = Column(Integer, ForeignKey("medicines.medicine_id"))

    quantity = Column(Integer)
    price = Column(Float)

    order = relationship("Order", back_populates="items")
    medicine = relationship("Medicine")


# ------------------ MEDICINE REQUESTS ------------------
class MedicineRequest(Base):
    __tablename__ = "medicine_requests"

    request_id = Column(Integer, primary_key=True, index=True)

    medicine_name = Column(String, nullable=False)
    composition = Column(String)

    customer_name = Column(String)
    customer_phone = Column(String)

    requested_by = Column(Integer, ForeignKey("users.user_id"))
    handled_by = Column(Integer, ForeignKey("users.user_id"))

    requested_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")


# ------------------ DOCTORS ------------------
class Doctor(Base):
    __tablename__ = "doctors"

    doctor_id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    specialization = Column(String)

    # Changed: Store availability as JSON or simple text format
    available_slots = Column(JSON, default=list)  # Store available time slots like ["09:00", "10:00", "11:00"]
    available_days = Column(String)  # Keep as is: "MON,TUE,WED"
    
    fee = Column(Float, default=0)
    image_base64 = Column(Text)


# ------------------ APPOINTMENTS (UPDATED) ------------------
class Appointment(Base):
    __tablename__ = "appointments"

    appointment_id = Column(Integer, primary_key=True, index=True)

    doctor_id = Column(Integer, ForeignKey("doctors.doctor_id"))
    customer_id = Column(Integer, ForeignKey("users.user_id"))

    patient_name = Column(String, nullable=False)
    patient_phone = Column(String, nullable=False)

    # Changed: Use single DateTime field instead of separate Date and Time
    appointment_datetime = Column(DateTime, nullable=False)

    status = Column(String, default="booked")
    visited = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("Doctor")
    customer = relationship("User", back_populates="appointments")
    
# ------------------ PRESCRIPTIONS ------------------
class Prescription(Base):
    __tablename__ = "prescriptions"

    prescription_id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, ForeignKey("users.user_id"))

    image_base64 = Column(Text)

    extracted_medicines = Column(JSON)  # works in SQLite via SQLAlchemy
    ai_summary = Column(Text)
    notes = Column(Text)

    status = Column(String, default="processing")
    scan_date = Column(DateTime, default=datetime.utcnow)


# ------------------ FEEDBACK ------------------
class Feedback(Base):
    __tablename__ = "feedback"

    feedback_id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(Integer, ForeignKey("users.user_id"))
    doctor_id = Column(Integer, ForeignKey("doctors.doctor_id"))
    medicine_id = Column(Integer, ForeignKey("medicines.medicine_id"))

    overall_rating = Column(Integer)

    category = Column(String)

    sub_rating_value = Column(Integer)
    sub_rating_friendliness = Column(Integer)
    sub_rating_wait = Column(Integer)

    review_text = Column(Text)

    mood_tag = Column(String)
    would_recommend = Column(Boolean)

    is_anonymous = Column(Boolean, default=False)

    owner_reply = Column(Text)
    reply_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)


# ------------------ EMPLOYEE SIGNUP REQUESTS ------------------
class EmployeeSignupRequest(Base):
    __tablename__ = "employee_signup_requests"

    request_id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String)

    password_hash = Column(String, nullable=False)

    status = Column(String, default="pending")

    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)