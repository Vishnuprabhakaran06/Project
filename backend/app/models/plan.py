from sqlalchemy import String, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    request_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    overage_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    monthly_price: Mapped[float] = mapped_column(Numeric(10, 2),nullable=False)