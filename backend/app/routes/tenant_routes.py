from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.dependencies import get_current_admin

router = APIRouter(
    prefix="/tenants",
    tags=["Tenants"]
)


@router.post("/")
def create_tenant(
    name: str,
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tenant = Tenant(name=name)

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return tenant


@router.get("/")
def get_tenants( current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)):
    return db.query(Tenant).all()