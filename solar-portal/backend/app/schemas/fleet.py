import uuid
from datetime import datetime

from pydantic import BaseModel


class FleetSiteStatus(BaseModel):
    site_id: uuid.UUID
    code: str
    name: str
    lat: float
    lon: float
    status: str  # normal | underperforming | offline
    today_actual_kwh: float
    today_expected_kwh: float
    current_pr: float | None
    last_update: datetime | None
    open_alert_count: int


class FleetOverview(BaseModel):
    sites: list[FleetSiteStatus]
    generated_at: datetime
