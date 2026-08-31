import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ReportOut(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID | None
    period_type: str
    period_start: date
    period_end: date
    generated_at: datetime
    content_da: dict
    yoy_comparison_available: bool

    model_config = {"from_attributes": True}
