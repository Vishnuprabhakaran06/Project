from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.plan import Plan

router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"]
)


@router.post("/")
def create_or_update_subscription(
    tenant_id: int,
    plan_id: int,
    db: Session = Depends(get_db)
):
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
        subscription.plan_id = plan_id
        db.commit()
        db.refresh(subscription)

        return subscription

    subscription = Subscription(
        tenant_id=tenant_id,
        plan_id=plan_id
    )

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    return subscription


@router.get("/")
def get_subscriptions(db: Session = Depends(get_db)):
    return db.query(Subscription).all()