import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExpectedProduction(Base):
    """Physics-baseline expected output per interval, written by the Baseline Agent (6.1).
    `pr` is filled in once the matching actual ProductionReading exists. Hypertable on ts."""

    __tablename__ = "expected_production"

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)

    poa_w_m2: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    expected_ac_power_w: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_energy_kwh_interval: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    pr: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)

    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
