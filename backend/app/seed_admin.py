from app.database import SessionLocal
from app.models.user import User
from app.security import hash_password
from app.models.tenant import Tenant


db = SessionLocal()

admin_email = "admin@saasbilling.com"

existing_admin = (
    db.query(User)
    .filter(User.email == admin_email)
    .first()
)

if existing_admin:
    print("Admin user already exists.")
else:
    admin = User(
        email=admin_email,
        password_hash=hash_password("Admin@123"),
        role="ADMIN",
        tenant_id=None,
        is_verified=True
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    print("Admin user created successfully.")
    print(f"Admin ID: {admin.id}")
    print(f"Email: {admin.email}")
    print(f"Role: {admin.role}")

db.close()