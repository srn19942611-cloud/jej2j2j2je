import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PerformanceFlag(Base):
    """Sustained-deviation candidates written by the Performance Analysis Agent (6.2),
    consumed by the Fault Diagnosis Agent (6.3). This table IS the decoupling point between
    the two agents - neither imports or calls the other directly."""

    __tablename__ = "performance_flags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), index=True)
    string_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    flag_type: Mapped[str] = mapped_column(String(32))  # sustained_deviation|zero_production|clipping_suspect|degradation
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    magnitude_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    consumed_by_fault_agent: Mapped[bool] = mapped_column(Boolean, default=False)
