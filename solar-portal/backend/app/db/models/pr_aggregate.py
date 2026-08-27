import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrAggregate(Base):
    """Weekly/monthly PR rollups + degradation annotation, written by the Performance
    Analysis Agent (6.2) on top of the daily continuous aggregate."""

    __tablename__ = "pr_aggregates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), index=True)
    period_type: Mapped[str] = mapped_column(String(16))  # daily | weekly | monthly
    period_start: Mapped[date] = mapped_column(Date)

    actual_kwh: Mapped[float | None] = mapped_column(Numeric(14, 3), nullable=True)
    expected_kwh: Mapped[float | None] = mapped_column(Numeric(14, 3), nullable=True)
    pr: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    degradation_flag: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
