from app.database import SessionLocal
from app import models
import bcrypt

db = SessionLocal()

existing = db.query(models.User).filter(
    models.User.email == "sohinighosh524@gmail.com"
).first()

if not existing:
    admin = models.User(
        name="Sohini Ghosh",
        email="sohinighosh524@gmail.com",
        phone="6289126390",
        password=bcrypt.hashpw(
            "admin123".encode(),
            bcrypt.gensalt()
        ).decode(),
        role="owner",
        status="active"
    )

    db.add(admin)
    db.commit()
    print("Admin created")

else:
    print("Admin already exists")

db.close()