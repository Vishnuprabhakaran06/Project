from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant

router = APIRouter(
    prefix="/tenants",
    tags=["Tenants"]
)


@router.post("/")
def create_tenant(
    name: str,
    db: Session = Depends(get_db)
):
    tenant = Tenant(name=name)

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return tenant


@router.get("/")
def get_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).all()