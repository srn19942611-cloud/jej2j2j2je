import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Site(Base):
    """A single PV plant/installation ("anlæg")."""

    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    lat: Mapped[float] = mapped_column(Numeric(9, 6))
    lon: Mapped[float] = mapped_column(Numeric(9, 6))
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Copenhagen")

    nameplate_kwp: Mapped[float] = mapped_column(Numeric(10, 3))
    tilt_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    azimuth_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    inverter_ac_rating_kw: Mapped[float] = mapped_column(Numeric(10, 3))
    string_count: Mapped[int] = mapped_column(default=3)

    installed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
