from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.database import get_db
from app.models.usage_record import UsageRecord, UsageType
from app.models.tenant import Tenant
from app.models.subscription import Subscription
from app.models.plan import Plan
from app.dependencies import get_current_customer, get_current_admin

router = APIRouter(
    prefix="/usage",
    tags=["Usage"]
)


@router.post("/")
def record_usage(
    usage_type: UsageType,
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

    subscription = (
    db.query(Subscription)
    .filter(Subscription.tenant_id == tenant_id)
    .first()
)

    if not subscription:
     raise HTTPException(
        status_code=400,
        detail="No active subscription found"
    )

    if subscription.end_date:
     from datetime import datetime

    if datetime.utcnow() >= subscription.end_date:
        raise HTTPException(
            status_code=400,
            detail="Your subscription has expired. Please choose a plan."
        )

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

@router.get("/summary")
def get_usage_summary(
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

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

    # Subscription status
    subscription_status = "ACTIVE"

    if subscription.end_date:
        if datetime.utcnow() >= subscription.end_date:
            subscription_status = "EXPIRED"

    # Get plan
    plan = (
        db.query(Plan)
        .filter(Plan.id == subscription.plan_id)
        .first()
    )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Plan not found"
        )

    # Billing cycle
    today = datetime.utcnow().date()

    cycle_start = subscription.start_date.date()

    if subscription.end_date:
        cycle_end = subscription.end_date.date() - timedelta(days=1)
    else:
        cycle_end = cycle_start + timedelta(days=29)

    # Count usage only from the exact subscription start time
    cycle_start_datetime = subscription.start_date

    if subscription.end_date:
      cycle_end_datetime = subscription.end_date
    else:
     cycle_end_datetime = datetime.combine(
        cycle_end + timedelta(days=1),
        datetime.min.time()
    )

    total_usage = (
        db.query(UsageRecord)
        .filter(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.created_at >= cycle_start_datetime,
            UsageRecord.created_at < cycle_end_datetime
        )
        .count()
    )

    # Usage calculations
    plan_limit = plan.request_limit

    remaining_usage = max(
        plan_limit - total_usage,
        0
    )

    overage = max(
        total_usage - plan_limit,
        0
    )

    overage_cost = round(
        overage * float(plan.overage_price),
        2
    )

    days_remaining = max(
        (cycle_end - today).days,
        0
    )

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name if tenant else None,
        "plan": plan.name,
        "subscription_status": subscription_status,
        "total_usage": total_usage,
        "plan_limit": plan_limit,
        "remaining_usage": remaining_usage,
        "overage": overage,
        "overage_cost": overage_cost,
        "monthly_price": float(plan.monthly_price),

        "billing_cycle": {
            "start_date": cycle_start.isoformat(),
            "cycle_start_datetime": subscription.start_date.isoformat() if subscription.start_date else None,
            "end_date": cycle_end.isoformat(),
            "days_remaining": days_remaining
        }
    }


@router.get("/recent")
def get_recent_usage(
    current_user: dict = Depends(get_current_customer),
    limit: int = 100,
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")
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

    current_plan_name = None
    cycle_start = None
    if subscription:
        plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
        if plan:
            current_plan_name = plan.name
        cycle_start = subscription.start_date

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.tenant_id == tenant_id)
        .order_by(UsageRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    all_plans = db.query(Plan).all()
    other_plan = next((p.name for p in all_plans if p.name != current_plan_name), "Starter")

    return [
        {
            "id": r.id,
            "usage_type": r.usage_type,
            "created_at": r.created_at.isoformat(),
            "plan": (
                current_plan_name
                if (cycle_start and r.created_at >= cycle_start)
                else other_plan
            )
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


@router.get("/admin/summary")
def get_admin_usage_summary(
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    subscriptions = (
        db.query(Subscription)
        .all()
    )

    result = []

    for subscription in subscriptions:
        tenant_id = subscription.tenant_id

        plan = (
            db.query(Plan)
            .filter(Plan.id == subscription.plan_id)
            .first()
        )

        tenant = (
            db.query(Tenant)
            .filter(Tenant.id == tenant_id)
            .first()
        )

        if not plan or not tenant:
            continue

        cycle_start = subscription.start_date

        if subscription.end_date:
            cycle_end = subscription.end_date
        else:
            cycle_end = datetime.utcnow()

        total_usage = (
            db.query(UsageRecord)
            .filter(
                UsageRecord.tenant_id == tenant_id,
                UsageRecord.created_at >= cycle_start,
                UsageRecord.created_at < cycle_end
            )
            .count()
        )

        plan_limit = plan.request_limit

        remaining_usage = max(
            plan_limit - total_usage,
            0
        )

        overage = max(
            total_usage - plan_limit,
            0
        )

        overage_cost = round(
            overage * float(plan.overage_price),
            2
        )

        result.append({
            "tenant_id": tenant_id,
            "tenant_name": tenant.name,
            "plan": plan.name,
            "total_usage": total_usage,
            "plan_limit": plan_limit,
            "remaining_usage": remaining_usage,
            "overage": overage,
            "overage_cost": overage_cost
        })

    return result