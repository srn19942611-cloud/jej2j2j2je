import uuid
from datetime import datetime

from pydantic import BaseModel


class AlertOut(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    site_name: str
    string_id: str | None
    created_at: datetime
    severity: str
    category: str
    message_da: str
    suggested_cause_da: str
    confidence: float | None
    status: str
    source_agent: str

    model_config = {"from_attributes": True}
