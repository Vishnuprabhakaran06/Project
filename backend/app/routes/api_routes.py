from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.models.usage_record import UsageRecord

from app.dependencies import get_current_customer

router = APIRouter(
    prefix="/api",
    tags=["API"]
)


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