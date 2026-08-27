import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProductionReading(Base):
    """Normalized per-site production reading, one row per (site_id, ts). Hypertable on ts."""

    __tablename__ = "production_readings"

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)

    ac_power_w: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    dc_power_w: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    energy_today_kwh: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    energy_total_kwh: Mapped[float | None] = mapped_column(Numeric(14, 3), nullable=True)
    grid_voltage_v: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    grid_frequency_hz: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)

    inverter_status: Mapped[str] = mapped_column(String(16), default="normal")  # normal|fault|offline|unknown
    fault_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    source: Mapped[str] = mapped_column(String(8), default="mock")  # mock | live
    raw_payload_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
