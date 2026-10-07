from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.models.usage_record import UsageRecord

router = APIRouter(
    prefix="/api",
    tags=["API"]
)


@router.post("/request")
def process_request(
    tenant_id: int,
    db: Session = Depends(get_db)
):
    # Check whether tenant exists
    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == tenant_id)
        .first()
    )

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

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