import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Alert(Base):
    """A single operator-facing alert, written by the Fault Diagnosis Agent (6.3) or the
    Feed-Health Agent (6.4). Message text is Danish - this is what a human reads."""

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), index=True)
    string_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    severity: Mapped[str] = mapped_column(String(16))  # info | warning | critical
    category: Mapped[str] = mapped_column(String(32))
    # string_underperformance | zero_production | clipping | stale_feed | degradation | other

    message_da: Mapped[str] = mapped_column(String(1000))
    suggested_cause_da: Mapped[str] = mapped_column(String(1000))
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    status: Mapped[str] = mapped_column(String(16), default="open")  # open | acknowledged | resolved
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_agent: Mapped[str] = mapped_column(String(64))
