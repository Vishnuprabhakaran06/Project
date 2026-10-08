from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth_schema import SignupRequest, LoginRequest
from app.security import hash_password, verify_password, create_access_token

from app.email_service import send_verification_email


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/signup")
def signup(
    data: SignupRequest,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    tenant = Tenant(
        name=data.company_name
    )

    db.add(tenant)
    db.flush()

    verification_token = secrets.token_urlsafe(32)

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="CUSTOMER",
        tenant_id=tenant.id,
        is_verified=False,
        verification_token=verification_token,
        verification_expires_at=(
            datetime.now(timezone.utc) + timedelta(hours=24)
        )
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    send_verification_email(
    user.email,
    verification_token
)

    return {
        "message": "Signup successful. Please verify your email.",
        "user_id": user.id,
        "tenant_id": tenant.id,
        "email": user.email
    }

@router.get("/verify-email")
def verify_email(
    token: str,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.verification_token == token)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification token"
        )

    if not user.verification_expires_at:
        raise HTTPException(
            status_code=400,
            detail="Verification token is invalid"
        )

    expires_at = user.verification_expires_at

    # Handle naive DB datetime as UTC
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=400,
            detail="Verification token has expired"
        )

    user.is_verified = True
    user.verification_token = None
    user.verification_expires_at = None

    db.commit()

    return {
        "message": "Email verified successfully. You can now login."
    }

@router.post("/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.email == data.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in"
        )

    token_data = {
        "user_id": user.id,
        "tenant_id": user.tenant_id,
        "role": user.role
    }

    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "tenant_id": user.tenant_id
        }
    }