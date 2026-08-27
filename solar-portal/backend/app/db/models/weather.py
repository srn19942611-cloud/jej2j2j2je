import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WeatherReading(Base):
    """Per-site weather at the same time resolution as production, from Open-Meteo.
    Hypertable on ts."""

    __tablename__ = "weather_readings"

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), primary_key=True, default="historical")  # forecast | historical

    ghi_w_m2: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    dni_w_m2: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    dhi_w_m2: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    temp_air_c: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    wind_speed_ms: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    cloud_cover_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
