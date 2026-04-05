from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app import models
from app.utils.security import get_current_user
from datetime import datetime, timedelta
from typing import List, Optional
import json

router = APIRouter(prefix="/customer", tags=["Customer"])


# DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 📌 DASHBOARD
@router.get("/dashboard")
def customer_dashboard(user=Depends(get_current_user), db: Session = Depends(get_db)):
    appointments = db.query(models.Appointment).filter(
        models.Appointment.customer_id == user["user_id"]
    ).count()

    orders = db.query(models.Order).filter(
        models.Order.customer_id == user["user_id"]
    ).count()

    doctors = db.query(models.Doctor).count()

    return {
        "appointments": appointments,
        "orders": orders,
        "doctors": doctors
    }


# 📌 GET APPOINTMENT HISTORY
@router.get("/appointments")
def get_appointments(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    appointments = (
        db.query(models.Appointment)
        .filter(models.Appointment.customer_id == user["user_id"])
        .order_by(models.Appointment.appointment_datetime.desc())
        .all()
    )

    result = []

    for a in appointments:
        doctor = db.query(models.Doctor).filter(models.Doctor.doctor_id == a.doctor_id).first()

        result.append({
            "id": a.appointment_id,
            "doctor_name": doctor.name if doctor else "Unknown",
            "specialization": doctor.specialization if doctor else "-",
            "datetime": a.appointment_datetime.strftime("%Y-%m-%d %H:%M") if a.appointment_datetime else None,
            "status": a.status,
            "visited": a.visited,
        })

    return result


# 📌 GET DOCTORS (UPDATED FOR JSON SLOTS)
@router.get("/doctors")
def get_doctors(db: Session = Depends(get_db)):
    doctors = db.query(models.Doctor).order_by(models.Doctor.name).all()

    return [
        {
            "id": d.doctor_id,
            "name": d.name,
            "specialization": d.specialization,
            "available_days": d.available_days,
            "available_slots": d.available_slots if d.available_slots else [],  # Return JSON array
            "fee": d.fee,
            "image_base64": d.image_base64,
        }
        for d in doctors
    ]


# 📌 GET AVAILABLE TIME SLOTS FOR A DOCTOR ON A SPECIFIC DATE
@router.get("/doctors/{doctor_id}/available-slots")
def get_available_slots(
    doctor_id: int,
    date: str,  # format: YYYY-MM-DD
    db: Session = Depends(get_db)
):
    """
    Returns available time slots for a doctor on a specific date based on JSON stored slots
    """
    try:
        appointment_date = datetime.strptime(date, "%Y-%m-%d").date()
        
        # Get doctor details
        doctor = db.query(models.Doctor).filter(
            models.Doctor.doctor_id == doctor_id
        ).first()
        
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        # Get day of week (MON, TUE, etc.)
        day_map = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        day_of_week = day_map[appointment_date.weekday()]
        
        # Check if doctor works on this day
        doctor_days = [day.strip() for day in doctor.available_days.split(",")] if doctor.available_days else []
        
        if day_of_week not in doctor_days:
            return {
                "date": date,
                "doctor_id": doctor_id,
                "available_slots": [],
                "is_available_day": False,
                "doctor_name": doctor.name,
                "fee": doctor.fee,
                "message": f"Doctor not available on {day_of_week}"
            }
        
        # Get time slots for this day from JSON array
        # Format in available_slots: ["MON|09:00-12:00", "MON|14:00-17:00", "TUE|09:00-12:00"]
        day_slots = []
        if doctor.available_slots:
            for slot in doctor.available_slots:
                if slot.startswith(f"{day_of_week}|"):
                    # Extract time part: "09:00-12:00"
                    time_part = slot.split("|")[1]
                    day_slots.append(time_part)
        
        if not day_slots:
            return {
                "date": date,
                "doctor_id": doctor_id,
                "available_slots": [],
                "is_available_day": True,
                "doctor_name": doctor.name,
                "fee": doctor.fee,
                "message": "No time slots configured for this day"
            }
        
        # Generate all 30-minute slots from the time ranges
        all_slots = []
        for time_range in day_slots:
            try:
                start_time_str, end_time_str = time_range.split("-")
                start_time = datetime.strptime(start_time_str.strip(), "%H:%M").time()
                end_time = datetime.strptime(end_time_str.strip(), "%H:%M").time()
                
                current = datetime.combine(appointment_date, start_time)
                end_datetime = datetime.combine(appointment_date, end_time)
                
                while current < end_datetime:
                    all_slots.append(current.strftime("%H:%M"))
                    current += timedelta(minutes=30)
            except Exception as e:
                print(f"Error parsing time range {time_range}: {e}")
                continue
        
        # Get already booked appointments for this date
        booked_appointments = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == doctor_id,
            func.date(models.Appointment.appointment_datetime) == appointment_date,
            models.Appointment.status != "cancelled"
        ).all()
        
        booked_slots = [apt.appointment_datetime.strftime("%H:%M") for apt in booked_appointments]
        
        # Filter available slots
        available_slots = [slot for slot in all_slots if slot not in booked_slots]
        
        return {
            "date": date,
            "doctor_id": doctor_id,
            "available_slots": available_slots,
            "is_available_day": True,
            "doctor_name": doctor.name,
            "fee": doctor.fee,
            "time_ranges": day_slots
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")


# 📌 GET ALL AVAILABLE DATES FOR A DOCTOR (NEXT 30 DAYS)
@router.get("/doctors/{doctor_id}/available-dates")
def get_available_dates(
    doctor_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns available dates for a doctor in the next 30 days based on JSON slots
    """
    doctor = db.query(models.Doctor).filter(
        models.Doctor.doctor_id == doctor_id
    ).first()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Parse doctor's available days
    doctor_days = [day.strip() for day in doctor.available_days.split(",")] if doctor.available_days else []
    
    # Get all slots from JSON
    day_slots_map = {}
    if doctor.available_slots:
        for slot in doctor.available_slots:
            if "|" in slot:
                day, time_range = slot.split("|")
                if day not in day_slots_map:
                    day_slots_map[day] = []
                day_slots_map[day].append(time_range)
    
    available_dates = []
    today = datetime.now().date()
    day_map = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    
    for i in range(30):
        check_date = today + timedelta(days=i)
        day_of_week = day_map[check_date.weekday()]
        
        # Check if doctor works on this day and has slots configured
        if day_of_week in doctor_days and day_of_week in day_slots_map and len(day_slots_map[day_of_week]) > 0:
            # Check if any slots are still available (simplified)
            available_dates.append(check_date.strftime("%Y-%m-%d"))
    
    return {
        "doctor_id": doctor_id,
        "available_dates": available_dates,
        "doctor_name": doctor.name
    }


# 📌 BOOK APPOINTMENT (UPDATED FOR DATETIME FIELD)
@router.post("/appointments")
def book_appointment(
    data: dict,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        doctor_id = data.get("doctor_id")
        patient_name = data.get("patient_name")
        patient_phone = data.get("patient_phone")
        date_str = data.get("date")  # YYYY-MM-DD
        time_str = data.get("time")  # HH:MM
        
        # Validate required fields
        if not all([doctor_id, patient_name, patient_phone, date_str, time_str]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Parse date and time
        appointment_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        appointment_time = datetime.strptime(time_str, "%H:%M").time()
        
        # Combine date and time into datetime
        appointment_datetime = datetime.combine(appointment_date, appointment_time)
        
        # Check if appointment is in the future
        if appointment_datetime < datetime.now():
            raise HTTPException(status_code=400, detail="Cannot book appointment in the past")
        
        # Check doctor exists
        doctor = db.query(models.Doctor).filter(
            models.Doctor.doctor_id == doctor_id
        ).first()
        
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        # Check if doctor is available on this day
        day_map = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        day_of_week = day_map[appointment_date.weekday()]
        doctor_days = [day.strip() for day in doctor.available_days.split(",")] if doctor.available_days else []
        
        if day_of_week not in doctor_days:
            raise HTTPException(status_code=400, detail=f"Doctor not available on {day_of_week}")
        
        # Check if time slot is within doctor's configured slots
        is_valid_slot = False
        if doctor.available_slots:
            for slot in doctor.available_slots:
                if slot.startswith(f"{day_of_week}|"):
                    time_range = slot.split("|")[1]
                    start_time_str, end_time_str = time_range.split("-")
                    start_time = datetime.strptime(start_time_str.strip(), "%H:%M").time()
                    end_time = datetime.strptime(end_time_str.strip(), "%H:%M").time()
                    
                    if start_time <= appointment_time < end_time:
                        is_valid_slot = True
                        break
        
        if not is_valid_slot:
            raise HTTPException(status_code=400, detail="Selected time slot is not within doctor's available hours")
        
        # Check double booking
        existing = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == doctor_id,
            models.Appointment.appointment_datetime == appointment_datetime,
            models.Appointment.status != "cancelled"
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Slot already booked")
        
        # Create appointment
        new_appointment = models.Appointment(
            doctor_id=doctor_id,
            customer_id=user["user_id"],
            patient_name=patient_name,
            patient_phone=patient_phone,
            appointment_datetime=appointment_datetime,
            status="booked",
            visited=False
        )
        
        db.add(new_appointment)
        db.commit()
        db.refresh(new_appointment)
        
        return {
            "message": "Appointment booked successfully",
            "appointment_id": new_appointment.appointment_id,
            "appointment_datetime": appointment_datetime.strftime("%Y-%m-%d %H:%M")
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date or time format: {str(e)}")


# 📌 GET FEEDBACK INIT DATA (FIXED)
@router.get("/feedback/init")
def get_feedback_init(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doctors = db.query(models.Doctor).all()
    medicines = db.query(models.Medicine).all()

    # Fix: Use correct column names from your model
    history = (
        db.query(models.Feedback)
        .filter(models.Feedback.customer_id == user["user_id"])
        .order_by(models.Feedback.created_at.desc())
        .all()
    )

    # Get doctor and medicine names for history
    history_with_names = []
    for f in history:
        doctor_name = None
        medicine_name = None
        
        if f.doctor_id:
            doctor = db.query(models.Doctor).filter(models.Doctor.doctor_id == f.doctor_id).first()
            doctor_name = doctor.name if doctor else None
            
        if f.medicine_id:
            medicine = db.query(models.Medicine).filter(models.Medicine.medicine_id == f.medicine_id).first()
            medicine_name = medicine.name if medicine else None
        
        history_with_names.append({
            "id": f.feedback_id,
            "rating": f.overall_rating,
            "review": f.review_text,
            "category": f.category,
            "mood": f.mood_tag,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "owner_reply": f.owner_reply,
            "doctor_name": doctor_name,
            "medicine_name": medicine_name,
            "sub_ratings": {
                "value": f.sub_rating_value,
                "friendliness": f.sub_rating_friendliness,
                "wait": f.sub_rating_wait
            },
            "would_recommend": f.would_recommend,
            "is_anonymous": f.is_anonymous
        })

    return {
        "doctors": [
            {"id": d.doctor_id, "name": d.name}
            for d in doctors
        ],
        "medicines": [
            {"id": m.medicine_id, "name": m.name}
            for m in medicines
        ],
        "history": history_with_names,
    }


# 📌 SUBMIT FEEDBACK (FIXED)
@router.post("/feedback")
def submit_feedback(
    data: dict,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get values from request
        overall_rating = data.get("rating")
        
        # Validate required fields
        if overall_rating is None or overall_rating < 1 or overall_rating > 5:
            raise HTTPException(status_code=400, detail="Valid rating (1-5) is required")
        
        # Validate would_recommend
        would_recommend = data.get("recommend")
        if would_recommend is None:
            raise HTTPException(status_code=400, detail="Please specify if you would recommend us")
        
        # Get sub-ratings with defaults
        sub_rating_value = data.get("sub_value", 3)
        sub_rating_friendliness = data.get("sub_friendliness", 3)
        sub_rating_wait = data.get("sub_wait", 3)
        
        # Create feedback with proper field mapping
        feedback = models.Feedback(
            customer_id=user["user_id"],
            overall_rating=overall_rating,
            category=data.get("category"),
            sub_rating_value=sub_rating_value,
            sub_rating_friendliness=sub_rating_friendliness,
            sub_rating_wait=sub_rating_wait,
            review_text=data.get("review"),
            doctor_id=data.get("doctor_id") if data.get("doctor_id") else None,
            medicine_id=data.get("medicine_id") if data.get("medicine_id") else None,
            mood_tag=data.get("mood"),
            would_recommend=would_recommend,
            is_anonymous=data.get("anonymous", False),
        )
        
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        
        return {
            "message": "Feedback submitted successfully",
            "feedback_id": feedback.feedback_id,
            "rating": feedback.overall_rating
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

# 📌 SCAN PRESCRIPTION
@router.post("/prescription/scan")
async def scan_prescription(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contents = await file.read()

    # TODO: Replace with your AI logic
    medicines = [
        {
            "name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "Twice a day",
            "stockStatus": "in-stock",
            "stockQuantity": 20,
            "price": 50,
            "medicineId": 1
        }
    ]

    summary = "Patient prescribed basic fever medication."

    prescription = models.Prescription(
        customer_id=user["user_id"],
        image_base64=contents,
        extracted_medicines=[m["name"] for m in medicines],
        ai_summary=summary,
        status="done"
    )

    db.add(prescription)
    db.commit()

    return {
        "medicines": medicines,
        "summary": summary
    }


# 📌 GET PRESCRIPTIONS
@router.get("/prescriptions")
def get_prescriptions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    data = db.query(models.Prescription)\
        .filter(models.Prescription.customer_id == user["user_id"])\
        .order_by(models.Prescription.scan_date.desc())\
        .all()

    return [
        {
            "id": p.prescription_id,
            "image": p.image_base64,
            "summary": p.ai_summary,
            "status": p.status,
            "date": p.scan_date,
            "medicines": p.extracted_medicines
        }
        for p in data
    ]


# 📌 CREATE MEDICINE REQUEST
@router.post("/medicine-request")
def create_medicine_request(data: dict, user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = models.MedicineRequest(
        medicine_name=data.get("name"),
        composition=data.get("composition"),
        customer_name=user["name"],
        customer_phone=user["phone"],
        requested_by=user["user_id"],
        status="pending"
    )

    db.add(req)
    db.commit()

    return {"message": "Request created"}


# 📌 GET MEDICINE REQUESTS
@router.get("/medicine-requests")
def get_medicine_requests(user=Depends(get_current_user), db: Session = Depends(get_db)):
    data = db.query(models.MedicineRequest)\
        .filter(models.MedicineRequest.requested_by == user["user_id"])\
        .order_by(models.MedicineRequest.requested_date.desc())\
        .all()
    return [
        {
            "id": r.request_id,
            "medicine_name": r.medicine_name,
            "composition": r.composition,
            "date": r.requested_date,
            "status": r.status,
        }
        for r in data
    ]


# 📌 GET ORDERS
from sqlalchemy.orm import joinedload

@router.get("/orders")
def get_orders(user=Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(models.Order).filter(
        (models.Order.customer_id == user["user_id"]) |
        (models.Order.customer_phone == user["phone"])
    ).order_by(models.Order.order_date.desc()).all()

    result = []
    for o in orders:
        # ✅ Eager load medicine to avoid None
        items = db.query(models.OrderItem)\
            .options(joinedload(models.OrderItem.medicine))\
            .filter(models.OrderItem.order_id == o.order_id)\
            .all()

        result.append({
            "id": o.order_id,
            "date": o.order_date.isoformat() if o.order_date else None,
            "total": float(o.total_price) if o.total_price else 0,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "items": [
                {
                    "id": i.id,
                    "name": i.medicine.name if i.medicine else "Unknown",
                    "brand": i.medicine.brand if i.medicine else "-",
                    "quantity": i.quantity,
                    "price": float(i.price) if i.price else 0,
                }
                for i in items
            ]
        })
    return result
# Separate AI Router
ai_router = APIRouter(prefix="/ai", tags=["AI"])


@ai_router.post("/chat")
def chat(data: dict, user=Depends(get_current_user)):
    system_prompt = data.get("systemPrompt")
    messages = data.get("messages")

    last_message = messages[-1]["content"] if messages else ""

    return {
        "text": f"🤖 AI says: {last_message}"
    }


@ai_router.post("/vision")
def vision(data: dict, user=Depends(get_current_user)):
    return {
        "text": "🧠 Prescription analyzed (mock result)"
    }

@router.post("/medicine-request")
def create_medicine_request(data: dict, user=Depends(get_current_user), db: Session = Depends(get_db)):
    req = models.MedicineRequest(
        medicine_name=data.get("name"),
        composition=data.get("composition"),
        customer_name=user["name"],
        customer_phone=user["phone"],
        requested_by=user["user_id"],
        status="pending"
    )
    db.add(req)
    db.commit()
    return {"message": "Request created"}
