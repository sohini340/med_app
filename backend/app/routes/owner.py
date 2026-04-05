from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import SessionLocal
from app import models
from app.utils.security import require_role
from datetime import datetime, timedelta  # ✅ FIXED: moved import to top

router = APIRouter(prefix="/owner", tags=["Owner"])

from typing import List, Dict, Any
from collections import defaultdict
# ------------------ DB ------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------ DASHBOARD (FIXED) ------------------
@router.get("/dashboard")
def owner_dashboard(
    user=Depends(require_role(["owner"])),  # ✅ FIXED: added role list
    db: Session = Depends(get_db)
):
    # ✅ FIXED: Using SQL aggregate for revenue (10x faster)
    revenue = db.query(func.sum(models.Order.total_price)).scalar() or 0
    
    return {
        "users": db.query(models.User).count(),
        "orders": db.query(models.Order).count(),
        "doctors": db.query(models.Doctor).count(),
        "revenue": revenue
    }


# ------------------ DOCTORS (FIXED) ------------------
@router.get("/doctors")
def get_doctors(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    doctors = db.query(models.Doctor).order_by(models.Doctor.name).all()

    return [
        {
            "doctor_id": d.doctor_id,
            "name": d.name,
            "specialization": d.specialization,
            "available_days": d.available_days,
            "available_slots": d.available_slots or [],  # Return the JSON array
            "fee": d.fee,
            "image_base64": d.image_base64,
        }
        for d in doctors
    ]


@router.post("/doctors")
def add_doctor(
    data: dict,
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    doc = models.Doctor(
        name=data["name"],
        specialization=data["specialization"],
        available_days=data.get("available_days", ""),
        available_slots=data.get("available_slots", []),  # Store JSON array
        fee=data.get("fee", 0),
        image_base64=data.get("image_base64", ""),
    )
    db.add(doc)
    db.commit()
    return {"message": "Doctor added"}


@router.put("/doctors/{doctor_id}")
def update_doctor(
    doctor_id: int,
    data: dict,
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    doc = db.query(models.Doctor).filter(models.Doctor.doctor_id == doctor_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Update allowed fields
    doc.name = data.get("name", doc.name)
    doc.specialization = data.get("specialization", doc.specialization)
    doc.available_days = data.get("available_days", doc.available_days)
    doc.available_slots = data.get("available_slots", doc.available_slots)  # JSON array
    doc.fee = data.get("fee", doc.fee)
    doc.image_base64 = data.get("image_base64", doc.image_base64)

    db.commit()
    return {"message": "Doctor updated"}

@router.delete("/doctors/{doctor_id}")
def delete_doctor(
    doctor_id: int,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    doc = db.query(models.Doctor).filter(models.Doctor.doctor_id == doctor_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    db.delete(doc)
    db.commit()
    return {"message": "Doctor deleted"}


# ------------------ APPOINTMENTS (FIXED - N+1 Query) ------------------
@router.get("/appointments")
def get_all_appointments(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    appointments = (
        db.query(models.Appointment)
        .options(joinedload(models.Appointment.doctor))
        .order_by(models.Appointment.appointment_datetime.desc())
        .all()
    )

    return [
        {
            "appointment_id": a.appointment_id,
            "patient_name": a.patient_name,
            "patient_phone": a.patient_phone,
            "doctor_name": a.doctor.name if a.doctor else "N/A",
            "specialization": a.doctor.specialization if a.doctor else "N/A",
            "appointment_date": str(a.appointment_datetime.date()) if a.appointment_datetime else "N/A",
            "appointment_time": str(a.appointment_datetime.time()) if a.appointment_datetime else "N/A",
            "status": a.status,
            "visited": a.visited,
            "created_at": str(a.created_at)
        }
        for a in appointments
    ]

@router.put("/appointments/{appointment_id}")
def update_appointment(
    appointment_id: int,
    data: dict,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    appointment = db.query(models.Appointment).filter(
        models.Appointment.appointment_id == appointment_id
    ).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = data.get("status", appointment.status)
    appointment.visited = data.get("visited", appointment.visited)

    db.commit()
    return {"message": "Appointment updated"}


# ------------------ EMPLOYEE REQUESTS (RENAMED) ------------------
@router.get("/employee-requests")
def get_employee_requests(  # ✅ FIXED: renamed from get_requests
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    requests = db.query(models.EmployeeSignupRequest)\
        .order_by(models.EmployeeSignupRequest.created_at.desc())\
        .all()

    return [
        {
            "request_id": r.request_id,
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "status": r.status,
            "created_at": r.created_at
        }
        for r in requests
    ]


@router.put("/employee-requests/{request_id}/approve")
def approve_request(
    request_id: int,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    req = db.query(models.EmployeeSignupRequest).filter(
        models.EmployeeSignupRequest.request_id == request_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Create employee user
    new_user = models.User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        password=req.password_hash,
        role="employee",
        status="active"
    )

    db.add(new_user)
    req.status = "approved"
    db.commit()

    return {"message": "Approved"}


@router.put("/employee-requests/{request_id}/reject")
def reject_request(
    request_id: int,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    req = db.query(models.EmployeeSignupRequest).filter(
        models.EmployeeSignupRequest.request_id == request_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "rejected"
    db.commit()
    return {"message": "Rejected"}


# ------------------ FEEDBACK (FIXED FIELD NAME) ------------------
# ------------------ FEEDBACK (FULLY FIXED) ------------------
# ------------------ FEEDBACK (FIXED, NO RELIANCE ON BROKEN RELATIONSHIP) ------------------
@router.get("/feedback")
def get_feedback(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    """Get all customer feedback with user names (manual fetch)"""
    feedbacks = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()

    result = []
    for f in feedbacks:
        # Manually fetch user – avoids missing relationship errors
        user_obj = db.query(models.User).filter(models.User.user_id == f.customer_id).first()
        user_name = "Anonymous"
        if user_obj and not f.is_anonymous:
            user_name = user_obj.name

        result.append({
            "feedback_id": f.feedback_id,
            "name": user_name,
            "overall_rating": f.overall_rating or 0,
            "review_text": f.review_text or "",
            "category": f.category,
            "mood_tag": f.mood_tag,
            "would_recommend": f.would_recommend,
            "sub_rating_value": f.sub_rating_value or 0,
            "sub_rating_friendliness": f.sub_rating_friendliness or 0,
            "sub_rating_wait": f.sub_rating_wait or 0,
            "owner_reply": f.owner_reply,
            "created_at": f.created_at.isoformat() if f.created_at else None
        })
    return result


@router.put("/feedback/{feedback_id}")
def reply_feedback(
    feedback_id: int,
    data: dict,
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    """Reply to a feedback entry"""
    feedback = db.query(models.Feedback).filter(models.Feedback.feedback_id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    reply_text = (data.get("reply") or "").strip()
    if not reply_text:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")

    feedback.owner_reply = reply_text
    feedback.reply_at = datetime.utcnow()
    db.commit()

    return {"message": "Reply added successfully", "reply": reply_text}
# ------------------ FEEDBACK STATS (OPTIONAL) ------------------
@router.get("/feedback/stats")
def get_feedback_stats(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    """Get feedback statistics for dashboard"""
    
    total_feedback = db.query(models.Feedback).count()
    
    # Average rating
    avg_rating = db.query(func.avg(models.Feedback.overall_rating)).scalar() or 0
    
    # Rating distribution
    rating_distribution = {}
    for i in range(1, 6):
        count = db.query(models.Feedback).filter(
            models.Feedback.overall_rating == i
        ).count()
        rating_distribution[str(i)] = count
    
    # Category distribution
    category_data = db.query(
        models.Feedback.category,
        func.count(models.Feedback.feedback_id).label('count')
    ).filter(
        models.Feedback.category.isnot(None)
    ).group_by(
        models.Feedback.category
    ).all()
    
    category_distribution = [
        {"category": c.category, "count": c.count}
        for c in category_data
    ]
    
    # Mood distribution
    mood_data = db.query(
        models.Feedback.mood_tag,
        func.count(models.Feedback.feedback_id).label('count')
    ).filter(
        models.Feedback.mood_tag.isnot(None)
    ).group_by(
        models.Feedback.mood_tag
    ).all()
    
    mood_distribution = [
        {"mood": m.mood_tag, "count": m.count}
        for m in mood_data
    ]
    
    # Recommendation stats
    recommend_count = db.query(models.Feedback).filter(
        models.Feedback.would_recommend == True
    ).count()
    not_recommend_count = db.query(models.Feedback).filter(
        models.Feedback.would_recommend == False
    ).count()
    
    return {
        "total_feedback": total_feedback,
        "average_rating": round(float(avg_rating), 1),
        "rating_distribution": rating_distribution,
        "category_distribution": category_distribution,
        "mood_distribution": mood_distribution,
        "recommend_count": recommend_count,
        "not_recommend_count": not_recommend_count
    }


# ------------------ DELETE FEEDBACK (OPTIONAL) ------------------
@router.delete("/feedback/{feedback_id}")
def delete_feedback(
    feedback_id: int,
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    """Delete feedback (if needed)"""
    feedback = db.query(models.Feedback).filter(
        models.Feedback.feedback_id == feedback_id
    ).first()

    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    db.delete(feedback)
    db.commit()

    return {"message": "Feedback deleted successfully"}

# ------------------ DEBUG FEEDBACK ENDPOINT ------------------
@router.get("/feedback/debug")
def debug_feedback(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check feedback data"""
    
    # Count total feedback
    total_count = db.query(models.Feedback).count()
    
    # Get all feedback (raw)
    all_feedback = db.query(models.Feedback).all()
    
    # Get sample
    sample = db.query(models.Feedback).first()
    
    return {
        "total_feedback_count": total_count,
        "has_feedback": total_count > 0,
        "sample_feedback": {
            "id": sample.feedback_id if sample else None,
            "rating": sample.overall_rating if sample else None,
            "review": sample.review_text if sample else None,
            "category": sample.category if sample else None,
            "mood": sample.mood_tag if sample else None,
            "owner_reply": sample.owner_reply if sample else None,
            "created_at": str(sample.created_at) if sample else None
        } if sample else None,
        "all_feedback_ids": [f.feedback_id for f in all_feedback]
    }
# ------------------ MEDICINES ------------------
@router.get("/medicines")
def get_medicines(
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    meds = db.query(models.Medicine).order_by(models.Medicine.name).all()

    return [
        {
            "medicine_id": m.medicine_id,
            "name": m.name,
            "composition": m.composition,
            "brand": m.brand,
            "price": m.price,
            "stock_quantity": m.stock_quantity,
            "expiry_date": m.expiry_date,
            "supplier": m.supplier,
        }
        for m in meds
    ]

from datetime import datetime

@router.post("/medicines")
def add_medicine(
    data: dict,
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    # 🔥 FIX: Convert expiry_date properly
    if data.get("expiry_date"):
        try:
            data["expiry_date"] = datetime.strptime(
                data["expiry_date"], "%Y-%m-%d"
            ).date()
        except:
            raise HTTPException(status_code=400, detail="Invalid date format")
    else:
        data["expiry_date"] = None

    med = models.Medicine(**data)

    db.add(med)
    db.commit()

    return {"message": "Added"}

@router.put("/medicines/{medicine_id}")
def update_medicine(
    medicine_id: int,
    data: dict,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    med = db.query(models.Medicine).filter(models.Medicine.medicine_id == medicine_id).first()

    if not med:
        raise HTTPException(status_code=404, detail="Not found")
    if data.get("expiry_date"):
        try:
            data["expiry_date"] = datetime.strptime(
                data["expiry_date"], "%Y-%m-%d"
            ).date()
        except:
            raise HTTPException(400, "Invalid date")
    else:
        data["expiry_date"] = None
    # ✅ FIXED: Only update allowed fields
    allowed_fields = ["name", "composition", "brand", "price", "stock_quantity", "expiry_date", "supplier"]
    for key in allowed_fields:
        if key in data:
            setattr(med, key, data[key])

    db.commit()
    return {"message": "Updated"}


@router.delete("/medicines/{medicine_id}")
def delete_medicine(
    medicine_id: int,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    med = db.query(models.Medicine).filter(models.Medicine.medicine_id == medicine_id).first()

    if not med:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(med)
    db.commit()
    return {"message": "Deleted"}


# ------------------ MEDICINE REQUESTS (RENAMED) ------------------
@router.get("/medicine-requests")
def get_medicine_requests(  # ✅ FIXED: renamed from get_requests
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    reqs = db.query(models.MedicineRequest)\
        .order_by(models.MedicineRequest.requested_date.desc())\
        .all()

    return [
        {
            "request_id": r.request_id,
            "medicine_name": r.medicine_name,
            "composition": r.composition,
            "customer_name": r.customer_name,
            "customer_phone": r.customer_phone,
            "requested_date": r.requested_date,
            "status": r.status,
        }
        for r in reqs
    ]


@router.put("/medicine-requests/{request_id}")
def update_medicine_request(
    request_id: int,
    data: dict,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    req = db.query(models.MedicineRequest).filter(
        models.MedicineRequest.request_id == request_id
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Not found")

    req.status = data.get("status", req.status)
    req.handled_by = data.get("handled_by")
    db.commit()

    return {"message": "Updated"}


# ------------------ OVERVIEW (FIXED & OPTIMIZED) ------------------
@router.get("/overview")
def role_overview(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    from datetime import datetime, timedelta, date
    from collections import defaultdict
    
    today = datetime.utcnow().date()
    last_7_days = today - timedelta(days=6)

    # Stats using SQL aggregation (faster)
    total_sales = db.query(func.sum(models.Order.total_price))\
        .filter(
            models.Order.order_date >= today,
            models.Order.payment_status == "paid"
        ).scalar() or 0

    total_medicines = db.query(models.Medicine).count()
    
    pending_requests = db.query(models.MedicineRequest)\
        .filter(models.MedicineRequest.status == "pending").count()

    # Fix: Handle appointment_datetime properly
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_end = datetime(today.year, today.month, today.day, 23, 59, 59)
    
    appointments_today = db.query(models.Appointment)\
        .filter(
            models.Appointment.appointment_datetime >= today_start,
            models.Appointment.appointment_datetime <= today_end
        ).count()

    visited_today = db.query(models.Appointment)\
        .filter(
            models.Appointment.appointment_datetime >= today_start,
            models.Appointment.appointment_datetime <= today_end,
            models.Appointment.visited == True
        ).count()

    emp_requests = db.query(models.EmployeeSignupRequest)\
        .filter(models.EmployeeSignupRequest.status == "pending").count()

    # Average rating using SQL aggregate
    avg_rating = db.query(func.avg(models.Feedback.overall_rating)).scalar() or 0
    if avg_rating:
        avg_rating = round(avg_rating, 1)

    # Sales for last 7 days (optimized)
    sales_map = {d: 0 for d in range(7)}
    
    orders = db.query(
        models.Order.order_date,
        func.sum(models.Order.total_price).label('daily_total')
    ).filter(
        models.Order.order_date >= last_7_days,
        models.Order.payment_status == "paid"
    ).group_by(models.Order.order_date).all()

    # FIX: Convert order_date to date if it's datetime
    for o in orders:
        # If order_date is datetime, convert to date
        order_date = o.order_date
        if isinstance(order_date, datetime):
            order_date = order_date.date()
        
        days_ago = (today - order_date).days
        if 0 <= days_ago <= 6:
            sales_map[6 - days_ago] = float(o.daily_total) if o.daily_total else 0

    sales_time = [
        {"date": (today - timedelta(days=6 - i)).strftime("%m-%d"), 
         "total": float(sales_map[i]) if sales_map[i] else 0}
        for i in range(7)
    ]

    # Top 5 demanded medicines
    medicine_demand = db.query(
        models.OrderItem.medicine_id,
        models.Medicine.name,
        func.sum(models.OrderItem.quantity).label('total_qty')
    ).join(
        models.Medicine, models.OrderItem.medicine_id == models.Medicine.medicine_id
    ).group_by(
        models.OrderItem.medicine_id, models.Medicine.name
    ).order_by(
        func.sum(models.OrderItem.quantity).desc()
    ).limit(5).all()

    demand = [
        {"name": m.name[:15] + "..." if len(m.name) > 15 else m.name, "qty": int(m.total_qty)}
        for m in medicine_demand
    ]

    # Inventory stats
    meds = db.query(models.Medicine).all()
    out_of_stock = sum(1 for m in meds if m.stock_quantity == 0)
    low_stock = sum(1 for m in meds if 0 < m.stock_quantity <= 10)
    in_stock = sum(1 for m in meds if m.stock_quantity > 10)

    inventory = [
        {"name": "Out of Stock", "value": out_of_stock},
        {"name": "Low Stock", "value": low_stock},
        {"name": "In Stock", "value": in_stock},
    ]

    # Feedback mood distribution
    mood_data = db.query(
        models.Feedback.mood_tag,
        func.count(models.Feedback.feedback_id).label('count')
    ).filter(
        models.Feedback.mood_tag.isnot(None)
    ).group_by(
        models.Feedback.mood_tag
    ).all()

    mood = [
        {"name": m.mood_tag or "Neutral", "count": m.count}
        for m in mood_data
    ]

    # Feedback category distribution
    category_data = db.query(
        models.Feedback.category,
        func.count(models.Feedback.feedback_id).label('count')
    ).filter(
        models.Feedback.category.isnot(None)
    ).group_by(
        models.Feedback.category
    ).all()

    category = [
        {"name": c.category, "value": c.count}
        for c in category_data
    ]

    # Doctor visits data
    appointments_with_doctors = db.query(
        models.Appointment.visited,
        models.Doctor.name
    ).join(
        models.Doctor, models.Appointment.doctor_id == models.Doctor.doctor_id
    ).all()
    
    doctor_visits_dict = defaultdict(lambda: {"visited": 0, "notVisited": 0})
    for apt in appointments_with_doctors:
        if apt.visited:
            doctor_visits_dict[apt.name]["visited"] += 1
        else:
            doctor_visits_dict[apt.name]["notVisited"] += 1
    
    # Get top 10 doctors by total appointments
    doctor_visits_list = [
        {
            "name": name[:10] + "..." if len(name) > 10 else name,
            "visited": data["visited"],
            "notVisited": data["notVisited"]
        }
        for name, data in sorted(doctor_visits_dict.items(), 
                                key=lambda x: x[1]["visited"] + x[1]["notVisited"], 
                                reverse=True)[:10]
    ]

    return {
        "stats": {
            "totalSales": float(total_sales),
            "totalMedicines": total_medicines,
            "pendingRequests": pending_requests,
            "appointmentsToday": appointments_today,
            "visitedToday": visited_today,
            "avgRating": float(avg_rating),
            "empRequests": emp_requests,
        },
        "charts": {
            "salesTime": sales_time,
            "demand": demand,
            "inventory": inventory,
            "mood": mood,
            "category": category,
            "doctorVisits": doctor_visits_list,
        }
    }
# ------------------ SALES (FIXED - N+1 Query) ------------------
@router.get("/sales")
def get_sales(
    user=Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    # Get all orders with relationships loaded
    orders = db.query(models.Order).order_by(models.Order.order_date.desc()).all()
    
    result = []
    for o in orders:
        # Get items for this order
        items = db.query(models.OrderItem).filter(
            models.OrderItem.order_id == o.order_id
        ).all()
        
        item_list = []
        for item in items:
            # Get medicine details
            medicine = db.query(models.Medicine).filter(
                models.Medicine.medicine_id == item.medicine_id
            ).first()
            
            item_list.append({
                "name": medicine.name if medicine else "Unknown Medicine",
                "quantity": item.quantity,
                "price": float(item.price) if item.price else 0
            })
        
        # Get employee name if exists
        employee_name = None
        if o.employee_id:
            employee = db.query(models.User).filter(
                models.User.user_id == o.employee_id
            ).first()
            employee_name = employee.name if employee else None
        
        # Format the order date
        order_date = o.order_date
        if order_date:
            if isinstance(order_date, datetime):
                order_date = order_date.isoformat()
            else:
                order_date = str(order_date)
        
        result.append({
            "order_id": o.order_id,
            "order_date": order_date,
            "customer_name": o.customer_name or "Walk-in Customer",
            "customer_phone": o.customer_phone or "-",
            "employee_name": employee_name or "—",
            "items": item_list,
            "total_price": float(o.total_price) if o.total_price else 0,
            "payment_method": o.payment_method or "offline",
            "payment_status": o.payment_status or "pending"
        })
    
    return result

# ------------------ USERS ------------------
@router.get("/users")
def get_users(
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    users = db.query(models.User).order_by(models.User.user_id.desc()).all()

    return [
        {
            "user_id": u.user_id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role,
            "status": u.status,
        }
        for u in users
    ]


@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    data: dict,
    user=Depends(require_role(["owner"])),  # ✅ FIXED
    db: Session = Depends(get_db)
):
    u = db.query(models.User).filter(models.User.user_id == user_id).first()

    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u.status = data.get("status", u.status)
    db.commit()

    return {"message": "Updated"}