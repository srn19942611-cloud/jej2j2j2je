"""SolPlanet connector - live mode.

*** UNVERIFIED ***
SolPlanet's branding has shifted (formerly Growatt-affiliated, now reported as a Sofar
Solar OpenAPI rebrand) and the exact current API shape was not confirmed with the vendor
before this build. This connector is written to the Sofar Solar OpenAPI's documented
app-id/app-secret + HMAC-style signed-request pattern as the best available reference, but
DO NOT trust it in production until validated against a real SolPlanet account - the
endpoint paths, field names, and even the auth scheme may differ from what's implemented
here. Treat this as a structural placeholder that satisfies the connector interface, not a
confirmed integration.
"""

import hashlib
import logging
import time

import httpx

from app.config import get_settings
from app.connectors.base import BaseConnector
from app.connectors.common_schema import NormalizedReading, RawFetchResult
from app.connectors.rate_limit import with_backoff
from app.connectors.solplanet.mapper import map_realtime_record

log = logging.getLogger(__name__)

log.warning(
    "SolPlanet connector is UNVERIFIED - built against the Sofar Solar OpenAPI rebrand "
    "spec pending vendor confirmation. Do not trust live-mode output without validating "
    "against a real account first."
)


class SolPlanetConnector(BaseConnector):
    platform = "solplanet"
    rate_limit_seconds = 300

    def __init__(self, connector_config, site):
        super().__init__(connector_config, site)
        settings = get_settings()
        self._base_url = settings.solplanet_base_url.rstrip("/")
        self._app_id = settings.solplanet_app_id
        self._app_secret = settings.solplanet_app_secret
        self._client = httpx.Client(base_url=self._base_url, timeout=30)

    def authenticate(self) -> None:
        # Best-guess signed-request scheme (appId + timestamp + secret, hashed) - confirm
        # against the real vendor spec. No persistent session/token to refresh here.
        return None

    def _signed_headers(self) -> dict:
        ts = str(int(time.time() * 1000))
        signature = hashlib.sha256(f"{self._app_id}{ts}{self._app_secret}".encode()).hexdigest()
        return {"appId": self._app_id, "timestamp": ts, "sign": signature}

    def fetch_raw(self) -> RawFetchResult:
        endpoint = "/openapi/plant/realtime"

        def _fetch():
            return self._client.get(
                endpoint,
                headers=self._signed_headers(),
                params={"plantId": self.connector_config.external_plant_id},
            )

        try:
            resp = with_backoff(_fetch, max_retries=3, retryable_exceptions=(httpx.HTTPError,))
            resp.raise_for_status()
            return RawFetchResult(endpoint=endpoint, http_status=resp.status_code, payload=resp.json())
        except httpx.HTTPError as exc:
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error=str(exc))

    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        records = raw.payload.get("data", {}).get("inverters", [])
        return [map_realtime_record(r, site_external_id=self.connector_config.external_plant_id or "") for r in records]
