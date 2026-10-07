from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.plan import Plan

router = APIRouter(
    prefix="/plans",
    tags=["Plans"]
)


@router.get("/")
def get_plans(db: Session = Depends(get_db)):
    return db.query(Plan).all()