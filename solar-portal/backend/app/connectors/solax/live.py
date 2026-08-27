"""SolaX Cloud connector - live mode.

Auth is a static "token key" issued via SolaX Cloud's Model:Auth registration flow (no
login/refresh needed, just a header/query param on every call). Structurally complete but
untested against a real account (no credentials available while building this).
"""

import logging

import httpx

from app.config import get_settings
from app.connectors.base import BaseConnector
from app.connectors.common_schema import NormalizedReading, RawFetchResult
from app.connectors.rate_limit import with_backoff
from app.connectors.solax.mapper import map_realtime_info

log = logging.getLogger(__name__)


class SolaxConnector(BaseConnector):
    platform = "solax"
    rate_limit_seconds = 300

    def __init__(self, connector_config, site):
        super().__init__(connector_config, site)
        settings = get_settings()
        self._base_url = settings.solax_base_url.rstrip("/")
        self._token_key = settings.solax_token_key
        self._client = httpx.Client(base_url=self._base_url, timeout=30)

    def authenticate(self) -> None:
        return None  # static token key, nothing to refresh

    def fetch_raw(self) -> RawFetchResult:
        endpoint = "/getRealtimeInfo.do"

        def _fetch():
            return self._client.get(
                endpoint,
                params={"tokenId": self._token_key, "sn": self.connector_config.external_plant_id},
            )

        try:
            resp = with_backoff(_fetch, max_retries=3, retryable_exceptions=(httpx.HTTPError,))
            resp.raise_for_status()
            return RawFetchResult(endpoint=endpoint, http_status=resp.status_code, payload=resp.json())
        except httpx.HTTPError as exc:
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error=str(exc))

    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        result = raw.payload.get("result")
        if not result:
            return []
        return [map_realtime_info(result, site_external_id=self.connector_config.external_plant_id or "")]
