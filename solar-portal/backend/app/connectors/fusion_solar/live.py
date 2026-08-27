"""FusionSolar (Huawei) Northbound OpenAPI connector - live mode.

Requires a whitelisted "Northbound" app account (username/password, NOT the consumer app
login) provisioned by Huawei/your installer. Auth is session-cookie + xsrf-token based and
expires ~30 min; the documented rate limit is roughly 1 call / 5 min per endpoint, enforced
here via MinIntervalGate so this connector can never exceed it even if polled more often.

Structurally complete but UNTESTED against a real account (no credentials available while
building this) - validate the exact response field names in mapper.py against your
account's actual payload before relying on it.
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings
from app.connectors.base import BaseConnector
from app.connectors.common_schema import NormalizedReading, RawFetchResult
from app.connectors.fusion_solar.mapper import map_device_real_kpi
from app.connectors.rate_limit import MinIntervalGate, with_backoff

log = logging.getLogger(__name__)

_gate = MinIntervalGate(min_interval_seconds=300)


class FusionSolarConnector(BaseConnector):
    platform = "fusion_solar"
    rate_limit_seconds = 300

    def __init__(self, connector_config, site):
        super().__init__(connector_config, site)
        settings = get_settings()
        self._base_url = settings.fusionsolar_base_url.rstrip("/")
        self._username = settings.fusionsolar_username
        self._password = settings.fusionsolar_password
        self._client = httpx.Client(base_url=self._base_url, timeout=30)
        self._xsrf_token: str | None = None
        self._token_expiry: datetime | None = None

    def authenticate(self) -> None:
        if self._xsrf_token and self._token_expiry and datetime.now(timezone.utc) < self._token_expiry:
            return

        def _login():
            resp = self._client.post(
                "/thirdData/login",
                json={"userName": self._username, "systemCode": self._password},
            )
            resp.raise_for_status()
            return resp

        resp = with_backoff(_login, max_retries=2, retryable_exceptions=(httpx.HTTPError,))
        self._xsrf_token = resp.headers.get("xsrf-token")
        if not self._xsrf_token:
            raise RuntimeError("FusionSolar login did not return an xsrf-token")
        self._token_expiry = datetime.now(timezone.utc) + timedelta(minutes=25)

    def fetch_raw(self) -> RawFetchResult:
        endpoint = "/thirdData/getDevRealKpi"
        gate_key = f"{self.connector_config.site_id}:{endpoint}"
        if not _gate.ready(gate_key):
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error="rate_limited_locally")

        def _fetch():
            return self._client.post(
                endpoint,
                headers={"xsrf-token": self._xsrf_token or ""},
                json={"devIds": self.connector_config.external_plant_id, "devTypeId": 1},
            )

        try:
            resp = with_backoff(_fetch, max_retries=3, retryable_exceptions=(httpx.HTTPError,))
            _gate.mark(gate_key)
            resp.raise_for_status()
            return RawFetchResult(endpoint=endpoint, http_status=resp.status_code, payload=resp.json())
        except httpx.HTTPError as exc:
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error=str(exc))

    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        records = raw.payload.get("data", [])
        return [map_device_real_kpi(r, site_external_id=self.connector_config.external_plant_id or "") for r in records]
