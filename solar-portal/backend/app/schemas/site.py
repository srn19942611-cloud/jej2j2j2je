import uuid
from datetime import date

from pydantic import BaseModel


class SiteOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    lat: float
    lon: float
    timezone: str
    nameplate_kwp: float
    tilt_deg: float
    azimuth_deg: float
    inverter_ac_rating_kw: float
    string_count: int
    installed_at: date | None

    model_config = {"from_attributes": True}


class ProductionPoint(BaseModel):
    ts: str
    ac_power_w: float | None
    dc_power_w: float | None
    expected_ac_power_w: float | None
    pr: float | None


class PrAggregatePoint(BaseModel):
    period_start: date
    actual_kwh: float | None
    expected_kwh: float | None
    pr: float | None
    degradation_flag: bool


class WeatherPoint(BaseModel):
    ts: str
    ghi_w_m2: float | None
    temp_air_c: float | None
    cloud_cover_pct: float | None


class StringPoint(BaseModel):
    ts: str
    string_id: str
    dc_power_w: float | None
