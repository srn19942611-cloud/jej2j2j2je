import uuid
from datetime import datetime

from pydantic import BaseModel


class FeedHealthOut(BaseModel):
    connector_config_id: uuid.UUID
    site_id: uuid.UUID
    site_name: str
    platform: str
    status: str
    last_attempt_at: datetime | None
    last_success_at: datetime | None
    consecutive_failures: int
    last_error: str | None
