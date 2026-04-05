from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, SessionLocal
from app import models
from app.routes import auth
from app.routes import customer
from app.routes import owner
from app.routes import employee
import bcrypt

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()


# 🔥 CREATE DEFAULT ADMIN
def create_admin():
    db = SessionLocal()

    existing = db.query(models.User).filter(
        models.User.email == "sohinighosh524@gmail.com"
    ).first()

    if not existing:
        hashed_password = bcrypt.hashpw(
            "admin123".encode(), bcrypt.gensalt()
        ).decode()

        admin = models.User(
            name="Sohini Ghosh",
            email="sohinighosh524@gmail.com",
            phone="6289126390",
            password=hashed_password,
            role="owner",
            status="active"
        )

        db.add(admin)
        db.commit()
        print("✅ Admin user created")

    else:
        print("⚡ Admin already exists")

    db.close()


# 🚀 RUN ON STARTUP
@app.on_event("startup")
def startup():
    create_admin()


# 🌐 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔗 Routes
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(owner.router)
app.include_router(employee.router)
@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}