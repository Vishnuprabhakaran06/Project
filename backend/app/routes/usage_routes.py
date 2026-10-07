from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database import get_db
from app.models.usage_record import UsageRecord, UsageType
from app.models.tenant import Tenant
from app.models.subscription import Subscription
from app.models.plan import Plan

router = APIRouter(
    prefix="/usage",
    tags=["Usage"]
)


@router.post("/")
def record_usage(
    tenant_id: int,
    usage_type: UsageType,
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    usage = UsageRecord(
        tenant_id=tenant_id,
        usage_type=usage_type
    )

    db.add(usage)
    db.commit()
    db.refresh(usage)

    return usage

@router.get("/summary/{tenant_id}")
def get_usage_summary(
    tenant_id: int,
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    subscription = (
        db.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id)
        .first()
    )

    if not subscription:
        raise HTTPException(
            status_code=404,
            detail="Subscription not found"
        )

    plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()

    total_usage = (
        db.query(UsageRecord)
        .filter(UsageRecord.tenant_id == tenant_id)
        .count()
    )

    plan_limit = plan.request_limit

    remaining_usage = max(plan_limit - total_usage, 0)

    overage = max(total_usage - plan_limit, 0)

    overage_cost = round(overage * float(plan.overage_price), 2)

    # Billing cycle based on subscription start date
    today = datetime.utcnow().date()

    subscription_start = subscription.start_date.date()

    cycle_start = subscription_start

# Calculate the end of the current 30-day billing cycle
    cycle_end = cycle_start + timedelta(days=29)

# If today's date is beyond the first cycle,
# calculate the current cycle
    while today > cycle_end:
      cycle_start = cycle_end + timedelta(days=1)
      cycle_end = cycle_start + timedelta(days=29)

    days_remaining = (cycle_end - today).days

    return {
    "tenant_id": tenant_id,
    "plan": plan.name,
    "total_usage": total_usage,
    "plan_limit": plan_limit,
    "remaining_usage": remaining_usage,
    "overage": overage,
    "overage_cost": overage_cost,

    "monthly_price": float(plan.monthly_price),

    "billing_cycle": {
        "start_date": cycle_start.isoformat(),
        "end_date": cycle_end.isoformat(),
        "days_remaining": days_remaining
    }
}


@router.get("/recent/{tenant_id}")
def get_recent_usage(
    tenant_id: int,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.tenant_id == tenant_id)
        .order_by(UsageRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "usage_type": r.usage_type,
            "created_at": r.created_at.isoformat()
        }
        for r in records
    ]


@router.get("/{tenant_id}")
def get_usage(
    tenant_id: int,
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    return (
        db.query(UsageRecord)
        .filter(UsageRecord.tenant_id == tenant_id)
        .all()
    )

