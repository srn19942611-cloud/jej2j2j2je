import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StringReading(Base):
    """Per-string / per-MPPT DC reading, used to isolate faults to a specific string.
    Hypertable on ts; indexed (site_id, string_id, ts)."""

    __tablename__ = "string_readings"

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), primary_key=True)
    string_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)

    mppt_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dc_voltage_v: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    dc_current_a: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    dc_power_w: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    source: Mapped[str] = mapped_column(String(8), default="mock")
