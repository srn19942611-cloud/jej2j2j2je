import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RawPayload(Base):
    """Verbatim connector response, kept so a mapper bug or a vendor API change can be
    reprocessed without re-polling. Hypertable on fetched_at (see scripts/init_db.py)."""

    __tablename__ = "raw_payloads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connector_config_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("connector_configs.id"))
    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    endpoint: Mapped[str] = mapped_column(String(255))
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(String(2000), nullable=True)
