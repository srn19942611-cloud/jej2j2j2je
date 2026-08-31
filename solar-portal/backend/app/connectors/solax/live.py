"""SolaX connector - live mode. Supports TWO distinct SolaX auth schemes, auto-selected by
which credentials are configured:

1. Legacy SolaX Cloud "User Monitoring API" - a static tokenId sent as a query param on
   `getRealtimeInfo.do`. This scheme IS publicly documented (SolaX Cloud User Monitoring
   API, multiple versions up to v6.1) and the field names in mapper.py's
   `map_realtime_info_legacy` are taken from confirmed third-party integrations, not
   guessed.

2. Newer SolaX "Developer Portal" (developer.solaxcloud.com) - Client ID/Secret issued
   per-application, shown in the portal's Authorization tab alongside a rate-limited
   "package" (e.g. 100 hits/min, 1,000,000 hits/day) and separate "Service API" /
   "Data Subscription" tabs. This is a newer, less publicly documented product.

   *** UNVERIFIED ***: while building this, developer.solaxcloud.com (and every
   solaxcloud.com subdomain, plus SolaX's Zendesk help center, the openHAB community
   forum, and web.archive.org) were unreachable from this build environment due to
   network egress policy - confirmed via the environment's own proxy diagnostics, not a
   guess. No public documentation of this specific Client-ID/Secret flow's exact token
   endpoint or data endpoint could be found either. What's implemented below is the
   standard, near-universal shape for this kind of developer portal (OAuth2
   client_credentials grant -> Bearer token -> REST calls), NOT a confirmed integration:
     - token endpoint path: `solax_oauth_token_url` (config/env: SOLAX_OAUTH_TOKEN_URL)
     - data endpoint base: `solax_oauth_data_base_url` (config/env: SOLAX_OAUTH_DATA_BASE_URL)
   Both are overridable via env var with no code change - correct them the moment they're
   confirmed (e.g. by testing from a machine with real network access, or against the
   portal's own "Service API" tab reference).
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings
from app.connectors.base import BaseConnector
from app.connectors.common_schema import NormalizedReading, RawFetchResult
from app.connectors.rate_limit import with_backoff
from app.connectors.solax.mapper import map_realtime_info_legacy, map_realtime_info_oauth

log = logging.getLogger(__name__)


class SolaxConnector(BaseConnector):
    platform = "solax"
    rate_limit_seconds = 60  # the Developer Portal package shown was 100 hits/min

    def __init__(self, connector_config, site):
        super().__init__(connector_config, site)
        settings = get_settings()
        self._use_oauth = bool(settings.solax_client_id and settings.solax_client_secret)

        if self._use_oauth:
            log.warning(
                "SolaX connector for site %s is using the Developer Portal OAuth flow, "
                "which is UNVERIFIED (see module docstring) - confirm the token/data "
                "endpoint paths against a real account before trusting this in production.",
                self.connector_config.site_id,
            )
            self._client_id = settings.solax_client_id
            self._client_secret = settings.solax_client_secret
            self._token_url = settings.solax_oauth_token_url
            self._data_base_url = settings.solax_oauth_data_base_url.rstrip("/")
            self._client = httpx.Client(timeout=30)
            self._access_token: str | None = None
            self._token_expiry: datetime | None = None
        else:
            self._base_url = settings.solax_base_url.rstrip("/")
            self._token_key = settings.solax_token_key
            self._client = httpx.Client(base_url=self._base_url, timeout=30)

    def authenticate(self) -> None:
        if not self._use_oauth:
            return  # legacy scheme: static tokenId, nothing to refresh

        if self._access_token and self._token_expiry and datetime.now(timezone.utc) < self._token_expiry:
            return

        def _get_token():
            return self._client.post(
                self._token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )

        resp = with_backoff(_get_token, max_retries=2, retryable_exceptions=(httpx.HTTPError,))
        resp.raise_for_status()
        body = resp.json()
        self._access_token = body.get("access_token")
        if not self._access_token:
            raise RuntimeError(f"SolaX OAuth token response had no access_token: {body}")
        expires_in = int(body.get("expires_in", 3600))
        self._token_expiry = datetime.now(timezone.utc) + timedelta(seconds=max(expires_in - 60, 60))

    def fetch_raw(self) -> RawFetchResult:
        if self._use_oauth:
            return self._fetch_oauth()
        return self._fetch_legacy()

    def _fetch_legacy(self) -> RawFetchResult:
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

    def _fetch_oauth(self) -> RawFetchResult:
        endpoint = f"{self._data_base_url}/realtime"  # UNVERIFIED path - see module docstring

        def _fetch():
            return self._client.get(
                endpoint,
                headers={"Authorization": f"Bearer {self._access_token}"},
                params={"sn": self.connector_config.external_plant_id},
            )

        try:
            resp = with_backoff(_fetch, max_retries=3, retryable_exceptions=(httpx.HTTPError,))
            resp.raise_for_status()
            return RawFetchResult(endpoint=endpoint, http_status=resp.status_code, payload=resp.json())
        except httpx.HTTPError as exc:
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error=str(exc))

    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        site_external_id = self.connector_config.external_plant_id or ""
        if self._use_oauth:
            result = raw.payload.get("result", raw.payload)
            if not result:
                return []
            return [map_realtime_info_oauth(result, site_external_id=site_external_id)]

        result = raw.payload.get("result")
        if not result:
            return []
        return [map_realtime_info_legacy(result, site_external_id=site_external_id)]
