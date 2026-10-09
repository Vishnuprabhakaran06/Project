from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models.message import Message
from app.models.subscription import Subscription
from datetime import datetime
from app.database import get_db
from app.models.tenant import Tenant
from app.models.usage_record import UsageRecord

from app.dependencies import get_current_customer, get_current_admin

router = APIRouter(
    prefix="/api",
    tags=["API"]
)
class MessageRequest(BaseModel):
    message: str

@router.post("/request")
def process_request(
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

    # Record usage automatically
    usage = UsageRecord(
        tenant_id=tenant_id,
        usage_type="API_CALL"
    )

    db.add(usage)
    db.commit()
    db.refresh(usage)

    return {
        "message": "API request processed successfully",
        "tenant_id": tenant_id,
        "usage_id": usage.id,
        "usage_type": usage.usage_type
    }


@router.post("/messages")
def send_message(
    request: MessageRequest,
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

    # Check active subscription
    subscription = db.query(Subscription).filter(
        Subscription.tenant_id == tenant_id
    ).first()

    now = datetime.utcnow()

    if (
        not subscription
        or not subscription.start_date
        or not subscription.end_date
        or subscription.start_date > now
        or subscription.end_date <= now
    ):
        raise HTTPException(
            status_code=403,
            detail="Active subscription required. Please choose a plan."
        )

    message_text = request.message.strip()

    if not message_text:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    try:
        # Save message
        message = Message(
            tenant_id=tenant_id,
            message=message_text
        )
        db.add(message)
        db.flush()

        # Record usage only after message is saved successfully
        usage = UsageRecord(
            tenant_id=tenant_id,
            usage_type="API_CALL"
        )
        db.add(usage)

        # Save both records together
        db.commit()
        db.refresh(message)
        db.refresh(usage)

        return {
            "message": "Message sent successfully",
            "message_id": message.id,
            "usage_id": usage.id,
            "usage_type": usage.usage_type
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save message"
        )


@router.get("/messages")
def get_messages(
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

    messages = (
        db.query(Message)
        .filter(Message.tenant_id == tenant_id)
        .order_by(Message.created_at.desc())
        .all()
    )

    return [
        {
            "id": message.id,
            "message": message.message,
            "created_at": message.created_at.isoformat()
        }
        for message in messages
    ]


@router.get("/admin/messages")
def get_admin_messages(
    tenant_id: int | None = None,
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = (
        db.query(Message, Tenant.name.label("customer_name"))
        .outerjoin(Tenant, Message.tenant_id == Tenant.id)
    )
    if tenant_id is not None:
        query = query.filter(Message.tenant_id == tenant_id)

    records = query.order_by(Message.created_at.desc()).all()

    return [
        {
            "id": message.id,
            "tenant_id": message.tenant_id,
            "customer_name": customer_name or f"Customer #{message.tenant_id}",
            "message": message.message,
            "created_at": message.created_at.isoformat() if message.created_at else None
        }
        for message, customer_name in records
    ]
