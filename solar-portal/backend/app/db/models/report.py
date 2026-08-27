import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Report(Base):
    """A generated Danish-language report, written by the Reporting Agent (6.5).
    site_id is null for a fleet-wide report."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=True)
    period_type: Mapped[str] = mapped_column(String(16))  # weekly | monthly
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    content_da: Mapped[dict] = mapped_column(JSONB)
    yoy_comparison_available: Mapped[bool] = mapped_column(Boolean, default=False)
