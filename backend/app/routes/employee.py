from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app import models
from app.utils.security import require_role
from datetime import datetime, timedelta
router = APIRouter(prefix="/employee", tags=["Employee"])


# ---------------- DB ----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- GET MEDICINES (SEARCH + TOP 20) ----------------
@router.get("/medicines")
def get_medicines(
    search: str = "",
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    query = db.query(models.Medicine)

    # 🔍 search by name
    if search:
        query = query.filter(models.Medicine.name.ilike(f"%{search}%"))

    meds = (
        query.order_by(models.Medicine.medicine_id.desc())  # latest first
        .limit(20)
        .all()
    )

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



# ---------------- ADD MEDICINE ----------------
from datetime import datetime

@router.post("/medicines")
def add_medicine(
    data: dict,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Name required")

    try:
        # 🔥 TYPE CASTING (THIS IS THE FIX)
        price = float(data.get("price", 0))
        stock_quantity = int(data.get("stock_quantity", 0))

        expiry_date = None
        if data.get("expiry_date"):
            expiry_date = datetime.strptime(data.get("expiry_date"), "%Y-%m-%d").date()

        med = models.Medicine(
            name=data.get("name"),
            composition=data.get("composition"),
            brand=data.get("brand"),
            price=price,
            stock_quantity=stock_quantity,
            expiry_date=expiry_date,
            supplier=data.get("supplier"),
        )

        db.add(med)
        db.commit()
        db.refresh(med)

        return {
            "message": "Medicine added successfully",
            "medicine_id": med.medicine_id
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
@router.put("/medicines/{medicine_id}")
def update_medicine(
    medicine_id: int,
    data: dict,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db),
):
    med = db.query(models.Medicine).filter(
        models.Medicine.medicine_id == medicine_id
    ).first()

    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    try:
        # 🔥 update only provided fields
        if "name" in data:
            med.name = data["name"]

        if "price" in data:
            med.price = float(data["price"])

        if "stock_quantity" in data:
            med.stock_quantity = int(data["stock_quantity"])

        if "composition" in data:
            med.composition = data["composition"]

        if "brand" in data:
            med.brand = data["brand"]

        if "supplier" in data:
            med.supplier = data["supplier"]

        if "expiry_date" in data and data["expiry_date"]:
            med.expiry_date = datetime.strptime(
                data["expiry_date"], "%Y-%m-%d"
            ).date()

        db.commit()

        return {"message": "Medicine updated"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------- DELETE MEDICINE ----------------
@router.delete("/medicines/{medicine_id}")
def delete_medicine(
    medicine_id: int,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db),
):
    med = db.query(models.Medicine).filter(
        models.Medicine.medicine_id == medicine_id
    ).first()

    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    try:
        db.delete(med)
        db.commit()
        return {"message": "Medicine deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
# ---------------- UPDATE MEDICINE STOCK ----------------
@router.put("/medicines/{medicine_id}/stock")
def update_stock(
    medicine_id: int,
    data: dict,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db),
):
    med = db.query(models.Medicine).filter(models.Medicine.medicine_id == medicine_id).first()
    
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    
    if "stock_quantity" in data:
        med.stock_quantity = data["stock_quantity"]
        db.commit()
    
    return {"message": "Stock updated", "stock_quantity": med.stock_quantity}


# ---------------- GET APPOINTMENTS ----------------
@router.get("/appointments")
def get_appointments(user=Depends(require_role(["employee"])), db: Session = Depends(get_db)):
    appts = (
        db.query(models.Appointment, models.Doctor)
        .join(models.Doctor, models.Appointment.doctor_id == models.Doctor.doctor_id)
        .order_by(models.Appointment.appointment_datetime.desc())
        .all()
    )

    return [
        {
            "appointment_id": a.Appointment.appointment_id,
            "patient_name": a.Appointment.patient_name,
            "patient_phone": a.Appointment.patient_phone,
            "doctor_name": a.Doctor.name,

            # 👇 split datetime properly
            "appointment_date": a.Appointment.appointment_datetime.date(),
            "appointment_time": a.Appointment.appointment_datetime.time().strftime("%H:%M"),

            "visited": a.Appointment.visited,
        }
        for a in appts
    ]

# ---------------- TOGGLE VISITED ----------------
@router.put("/appointments/{appointment_id}")
def update_visited(
    appointment_id: int,
    data: dict,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db),
):
    appt = db.query(models.Appointment).filter(
        models.Appointment.appointment_id == appointment_id
    ).first()

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.visited = data.get("visited", appt.visited)
    db.commit()

    return {"message": "Updated"}


# ---------------- CREATE ORDER ----------------
@router.post("/orders")
def create_order(data: dict, user=Depends(require_role(["employee"])), db: Session = Depends(get_db)):
    if not data.get("items"):
        raise HTTPException(status_code=400, detail="No items")

    # Check stock availability
    for item in data["items"]:
        medicine = db.query(models.Medicine).filter(
            models.Medicine.medicine_id == item["medicine_id"]
        ).first()
        if not medicine:
            raise HTTPException(status_code=404, detail=f"Medicine {item['medicine_id']} not found")
        if medicine.stock_quantity < item["quantity"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {medicine.name}. Available: {medicine.stock_quantity}"
            )

    order = models.Order(
        customer_name=data.get("customer_name"),
        customer_phone=data.get("customer_phone"),
        employee_id=user["user_id"],
        subtotal=data.get("subtotal"),
        discount_type=data.get("discount_type"),
        discount_value=data.get("discount_value"),
        discount_amount=data.get("discount_amount"),
        total_price=data.get("total_price"),
        payment_method=data.get("payment_method"),
        payment_status=data.get("payment_status", "pending"),
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    # add items and update stock
    for item in data["items"]:
        oi = models.OrderItem(
            order_id=order.order_id,
            medicine_id=item["medicine_id"],
            quantity=item["quantity"],
            price=item["price"],
        )
        db.add(oi)
        
        # Update stock
        medicine = db.query(models.Medicine).filter(
            models.Medicine.medicine_id == item["medicine_id"]
        ).first()
        medicine.stock_quantity -= item["quantity"]

    db.commit()

    return {"order_id": order.order_id}


# ---------------- GET ORDERS ----------------
@router.get("/orders")
def get_orders(user=Depends(require_role(["employee"])), db: Session = Depends(get_db)):
    orders = (
        db.query(models.Order)
        .filter(models.Order.employee_id == user["user_id"])
        .order_by(models.Order.order_date.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "order_id": o.order_id,
            "customer_name": o.customer_name,
            "customer_phone": o.customer_phone,
            "order_date": o.order_date,
            "total_price": o.total_price,
            "payment_status": o.payment_status,
        }
        for o in orders
    ]


# ---------------- GET ALL ORDERS (FOR ADMIN/SUPERVISOR) ----------------
@router.get("/orders/all")
def get_all_orders(user=Depends(require_role(["employee"])), db: Session = Depends(get_db)):
    # Only employees with admin/supervisor role should see all orders
    # You might want to add role checking here
    orders = (
        db.query(models.Order)
        .order_by(models.Order.order_date.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "order_id": o.order_id,
            "customer_name": o.customer_name,
            "customer_phone": o.customer_phone,
            "employee_id": o.employee_id,
            "order_date": o.order_date,
            "total_price": o.total_price,
            "payment_status": o.payment_status,
        }
        for o in orders
    ]


# ---------------- DASHBOARD ----------------
@router.get("/dashboard")
def employee_dashboard(
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db),
):
    medicines = db.query(models.Medicine).count()
    
    # Total appointments
    appointments = db.query(models.Appointment).count()
    
    # Today's appointments
    today_appointments = db.query(models.Appointment).filter(
        func.date(models.Appointment.appointment_date) == func.date(func.now())
    ).count()
    
    # Orders by this employee
    orders = db.query(models.Order).filter(
        models.Order.employee_id == user["user_id"]
    ).count()
    
    # Pending medicine requests
    pending_requests = db.query(models.MedicineRequest).filter(
        models.MedicineRequest.status == "pending"
    ).count()
    
    # Low stock medicines (less than 10 items)
    low_stock = db.query(models.Medicine).filter(
        models.Medicine.stock_quantity < 10
    ).count()

    return {
        "medicines": medicines,
        "appointments": appointments,
        "today_appointments": today_appointments,
        "orders": orders,
        "pending_requests": pending_requests,
        "low_stock": low_stock,
    }


# ---------------- MEDICINE REQUESTS ----------------
@router.get("/medicine-requests")
def get_requests(user=Depends(require_role(["employee"])), db: Session = Depends(get_db)):
    reqs = db.query(models.MedicineRequest).order_by(
        models.MedicineRequest.requested_date.desc()
    ).all()

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


# ---------------- CREATE MEDICINE REQUEST ----------------
@router.post("/medicine-requests")
def create_request(data: dict, user=Depends(require_role(["employee"])), db: Session = Depends(get_db)):
    if not data.get("medicine_name"):
        raise HTTPException(status_code=400, detail="Medicine name required")

    req = models.MedicineRequest(
        medicine_name=data.get("medicine_name"),
        composition=data.get("composition"),
        customer_name=data.get("customer_name"),
        customer_phone=data.get("customer_phone"),
        requested_by=user["user_id"],
        status="pending"
    )

    db.add(req)
    db.commit()
    db.refresh(req)

    return {"message": "Request created", "request_id": req.request_id}


# ---------------- UPDATE MEDICINE REQUEST STATUS ----------------
@router.put("/medicine-requests/{request_id}")
def update_request_status(
    request_id: int,
    data: dict,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db),
):
    req = db.query(models.MedicineRequest).filter(
        models.MedicineRequest.request_id == request_id
    ).first()
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if "status" in data:
        req.status = data["status"]
        req.handled_by = user["user_id"]
        db.commit()
    
    return {"message": "Request updated", "status": req.status}


# ==================== DOCTOR ENDPOINTS FOR EMPLOYEE ====================

@router.get("/doctors")
def get_doctors_for_employee(
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    """Get all doctors for employee to book appointments"""
    doctors = db.query(models.Doctor).order_by(models.Doctor.name).all()
    return [
        {
            "doctor_id": d.doctor_id,
            "name": d.name,
            "specialization": d.specialization,
            "available_days": d.available_days,
            "available_slots": d.available_slots if d.available_slots else [],
            "fee": d.fee,
            "image_base64": d.image_base64,
        }
        for d in doctors
    ]


# ==================== AVAILABILITY ENDPOINTS ====================

@router.get("/doctors/{doctor_id}/available-dates")
def get_available_dates_for_doctor(
    doctor_id: int,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    """Get available dates for a doctor in the next 30 days"""
    doctor = db.query(models.Doctor).filter(models.Doctor.doctor_id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    doctor_days = [day.strip() for day in doctor.available_days.split(",")] if doctor.available_days else []
    
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
        if day_of_week in doctor_days and day_of_week in day_slots_map and len(day_slots_map[day_of_week]) > 0:
            available_dates.append(check_date.strftime("%Y-%m-%d"))
    
    return {"available_dates": available_dates, "doctor_name": doctor.name}


@router.get("/doctors/{doctor_id}/available-slots")
def get_available_slots_for_doctor(
    doctor_id: int,
    date: str,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    """Get available time slots for a doctor on a specific date"""
    try:
        appointment_date = datetime.strptime(date, "%Y-%m-%d").date()
        doctor = db.query(models.Doctor).filter(models.Doctor.doctor_id == doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        
        day_map = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        day_of_week = day_map[appointment_date.weekday()]
        doctor_days = [day.strip() for day in doctor.available_days.split(",")] if doctor.available_days else []
        
        if day_of_week not in doctor_days:
            return {"available_slots": [], "is_available_day": False, "doctor_name": doctor.name, "fee": doctor.fee}
        
        day_slots = []
        if doctor.available_slots:
            for slot in doctor.available_slots:
                if slot.startswith(f"{day_of_week}|"):
                    time_part = slot.split("|")[1]
                    day_slots.append(time_part)
        
        if not day_slots:
            return {"available_slots": [], "is_available_day": True, "doctor_name": doctor.name, "fee": doctor.fee}
        
        all_slots = []
        for time_range in day_slots:
            try:
                if "-" in time_range:
                    start_time_str, end_time_str = time_range.split("-")
                    start_time = datetime.strptime(start_time_str.strip(), "%H:%M").time()
                    end_time = datetime.strptime(end_time_str.strip(), "%H:%M").time()
                    current = datetime.combine(appointment_date, start_time)
                    end_datetime = datetime.combine(appointment_date, end_time)
                    while current < end_datetime:
                        all_slots.append(current.strftime("%H:%M"))
                        current += timedelta(minutes=30)
            except:
                continue
        
        all_slots = sorted(list(set(all_slots)))
        
        date_start = datetime.combine(appointment_date, datetime.min.time())
        date_end = datetime.combine(appointment_date, datetime.max.time())
        booked_appointments = db.query(models.Appointment).filter(
            models.Appointment.doctor_id == doctor_id,
            models.Appointment.appointment_datetime >= date_start,
            models.Appointment.appointment_datetime <= date_end,
            models.Appointment.status != "cancelled"
        ).all()
        
        booked_slots = [apt.appointment_datetime.strftime("%H:%M") for apt in booked_appointments]
        available_slots = [slot for slot in all_slots if slot not in booked_slots]
        
        return {"available_slots": available_slots, "is_available_day": True, "doctor_name": doctor.name, "fee": doctor.fee}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")


# ==================== CUSTOMER SEARCH ====================

@router.get("/customers/search")
def search_customers(
    q: str,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    """Search for customers by name or phone number"""
    if not q or len(q) < 2:
        return []
    customers = db.query(models.User).filter(
        models.User.role == "customer",
        models.User.status == "active",
        (models.User.name.ilike(f"%{q}%") | models.User.phone.ilike(f"%{q}%"))
    ).limit(10).all()
    return [
        {"user_id": c.user_id, "name": c.name, "phone": c.phone, "email": c.email}
        for c in customers
    ]


# ==================== CREATE APPOINTMENT FOR CUSTOMER ====================

@router.post("/appointments")
def create_appointment_for_customer(
    data: dict,
    user=Depends(require_role(["employee"])),
    db: Session = Depends(get_db)
):
    """Create an appointment for a customer (employee booking)"""
    required_fields = ["doctor_id", "patient_name", "patient_phone", "appointment_datetime"]
    for field in required_fields:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    doctor = db.query(models.Doctor).filter(models.Doctor.doctor_id == data["doctor_id"]).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Parse datetime
    appointment_datetime = None
    datetime_str = data["appointment_datetime"]
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ]
    for fmt in formats:
        try:
            appointment_datetime = datetime.strptime(datetime_str, fmt)
            break
        except ValueError:
            continue
    
    if appointment_datetime is None:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {datetime_str}")
    
    if appointment_datetime < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot book appointment in the past")
    
    # Check doctor availability
    day_map = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    day_of_week = day_map[appointment_datetime.weekday()]
    doctor_days = [day.strip() for day in doctor.available_days.split(",")] if doctor.available_days else []
    
    if day_of_week not in doctor_days:
        raise HTTPException(status_code=400, detail=f"Doctor not available on {day_of_week}")
    
    # Validate slot
    is_valid_slot = False
    if doctor.available_slots:
        for slot in doctor.available_slots:
            if slot.startswith(f"{day_of_week}|"):
                time_range = slot.split("|")[1]
                if "-" in time_range:
                    start_time_str, end_time_str = time_range.split("-")
                    start_time = datetime.strptime(start_time_str.strip(), "%H:%M").time()
                    end_time = datetime.strptime(end_time_str.strip(), "%H:%M").time()
                    appointment_time = appointment_datetime.time()
                    if start_time <= appointment_time < end_time:
                        is_valid_slot = True
                        break
    
    if not is_valid_slot:
        raise HTTPException(status_code=400, detail="Selected time slot is not within doctor's available hours")
    
    # Check for existing appointment
    existing = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == data["doctor_id"],
        models.Appointment.appointment_datetime == appointment_datetime,
        models.Appointment.status != "cancelled"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    
    # Create appointment
    appointment = models.Appointment(
        doctor_id=data["doctor_id"],
        patient_name=data["patient_name"],
        patient_phone=data["patient_phone"],
        appointment_datetime=appointment_datetime,
        status="booked",
        visited=False,
        customer_id=data.get("customer_id"),
    )
    
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    
    return {
        "message": "Appointment booked successfully",
        "appointment_id": appointment.appointment_id,
        "doctor_name": doctor.name,
        "patient_name": data["patient_name"],
        "appointment_datetime": appointment_datetime.strftime("%Y-%m-%d %H:%M"),
        "status": appointment.status
    }