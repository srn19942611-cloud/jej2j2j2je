import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ConnectorConfig(Base):
    """Non-secret routing metadata binding a site to one monitoring-platform connector.

    Actual credentials live only in environment variables (see app/config.py), never here -
    `mode` here is the DB-stored default, but a platform-level env var (e.g. FUSIONSOLAR_MODE)
    overrides it, which is how a connector flips from mock to live without a code or schema change.
    """

    __tablename__ = "connector_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), index=True)
    platform: Mapped[str] = mapped_column(String(32))  # fusion_solar | solplanet | solax
    mode: Mapped[str] = mapped_column(String(16), default="mock")  # mock | live
    external_plant_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    poll_interval_seconds: Mapped[int] = mapped_column(Integer, default=300)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
