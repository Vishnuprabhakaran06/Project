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
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found"
        )

    plan = db.query(Plan).filter(Plan.id == plan_id).first()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Plan not found"
        )

    subscription = (
        db.query(Subscription)
        .filter(Subscription.tenant_id == tenant_id)
        .first()
    )

    if subscription:
        start_date = datetime.utcnow()
        end_date = add_one_month(start_date)

        subscription.plan_id = plan_id
        subscription.start_date = start_date
        subscription.end_date = end_date

        db.commit()
        db.refresh(subscription)

        return subscription

    start_date = datetime.utcnow()
    end_date = add_one_month(start_date)

    subscription = Subscription(
    tenant_id=tenant_id,
    plan_id=plan_id,
    start_date=start_date,
    end_date=end_date
)

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    return subscription


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
    subscriptions = (
        db.query(Subscription)
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

        status = "ACTIVE"

        if subscription.end_date:
            if datetime.utcnow() >= subscription.end_date:
                status = "EXPIRED"

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