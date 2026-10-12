from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime,timedelta
import calendar
from app.database import get_db
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.plan import Plan
from app.dependencies import get_current_customer, get_current_admin    

router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"]
)

def add_one_month(date_value):
    year = date_value.year
    month = date_value.month + 1

    if month > 12:
        month = 1
        year += 1

    last_day = calendar.monthrange(year, month)[1]
    day = min(date_value.day, last_day)

    return date_value.replace(
        year=year,
        month=month,
        day=day
    )


@router.post("/")
def create_or_update_subscription(
    plan_id: int,
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id
    ).first()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    plan = db.query(Plan).filter(
        Plan.id == plan_id
    ).first()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Plan not found"
        )

    now = datetime.utcnow()

    # Find the current active subscription
    current_subscription = (
        db.query(Subscription)
        .filter(
            Subscription.tenant_id == tenant_id,
            Subscription.start_date <= now,
            (Subscription.end_date.is_(None)) |
            (Subscription.end_date > now)
        )
        .order_by(Subscription.start_date.desc())
        .first()
    )

    # Close the current subscription
    if current_subscription:
        current_subscription.end_date = now

    # Create a new subscription
    start_date = now
    end_date = add_one_month(start_date)

    new_subscription = Subscription(
        tenant_id=tenant_id,
        plan_id=plan_id,
        start_date=start_date,
        end_date=end_date
    )

    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    return new_subscription



@router.get("/")
def get_subscriptions(
    current_user: dict = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    tenant_id = current_user.get("tenant_id")

    return (
        db.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id)
        .all()
    )


@router.get("/admin")
def get_all_subscriptions(
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()

    subscriptions = (
        db.query(Subscription)
        .order_by(Subscription.start_date.desc())
        .all()
    )

    result = []

    for subscription in subscriptions:
        tenant = (
            db.query(Tenant)
            .filter(Tenant.id == subscription.tenant_id)
            .first()
        )

        plan = (
            db.query(Plan)
            .filter(Plan.id == subscription.plan_id)
            .first()
        )

        if not tenant or not plan:
            continue

        if subscription.start_date and subscription.start_date > now:
            status = "UPCOMING"
        elif subscription.end_date and subscription.end_date <= now:
            status = "EXPIRED"
        else:
            status = "ACTIVE"

        result.append({
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "plan": plan.name,
            "monthly_price": float(plan.monthly_price),
            "request_limit": plan.request_limit,
            "overage_price": float(plan.overage_price),
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
            "status": status
        })

    return result
