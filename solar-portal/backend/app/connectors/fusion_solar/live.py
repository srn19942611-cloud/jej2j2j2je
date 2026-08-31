"""FusionSolar (Huawei) Northbound OpenAPI connector - live mode.

Requires a whitelisted "Northbound" app account (username + "system code" - a password
issued for this API, NOT the consumer FusionSolar app login) provisioned by Huawei/your
installer. Auth is XSRF-token based and expires ~30 min; the documented rate limit is
roughly 1 call / 5 min per endpoint, enforced here via MinIntervalGate so this connector
can never exceed it even if polled more often.

Login endpoint, request body shape ({"userName", "systemCode"}), and the XSRF-token
mechanism below are confirmed against public open-source Northbound API clients
(tijsverkoyen/HomeAssistant-FusionSolar, pjugowiec/fusion-solar-unofficial-client) - not
guessed. What's NOT independently confirmed (Huawei only shares the full field-level
Northbound Interface Reference with account holders directly) is the exact getDevRealKpi
response field names in mapper.py - those follow the commonly-referenced convention
(active_power, day_cap, total_cap, run_state, mppt_N_power) but validate them against
your account's actual payload (check raw_payloads in the DB after a live poll) before
fully trusting the normalized values.

`ConnectorConfig.external_plant_id` is tried directly as a device ID first (devIds). If
that returns no data, this falls back to calling `getDevList` with the same value as a
STATION code to discover the station's actual device IDs (a real device ID is opaque and
usually only obtainable this way per the open-source clients above, not something an
operator can read off the FusionSolar UI) and retries getDevRealKpi with those - so this
connector works whether external_plant_id was configured as a device ID or a station code.
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

    def _get_dev_real_kpi(self, dev_ids: str) -> httpx.Response:
        return self._client.post(
            "/thirdData/getDevRealKpi",
            headers={"xsrf-token": self._xsrf_token or ""},
            json={"devIds": dev_ids, "devTypeId": 1},
        )

    def _discover_dev_ids_from_station(self, station_code: str) -> str | None:
        """Falls back to getDevList when external_plant_id turns out to be a station code
        rather than a device ID - see module docstring."""

        def _fetch():
            return self._client.post(
                "/thirdData/getDevList",
                headers={"xsrf-token": self._xsrf_token or ""},
                json={"stationCodes": station_code},
            )

        try:
            resp = with_backoff(_fetch, max_retries=2, retryable_exceptions=(httpx.HTTPError,))
            resp.raise_for_status()
        except httpx.HTTPError:
            log.warning("FusionSolar getDevList lookup failed for station %s", station_code)
            return None

        devices = resp.json().get("data", [])
        dev_ids = [str(d["id"]) for d in devices if d.get("devTypeId") == 1 and "id" in d]
        return ",".join(dev_ids) if dev_ids else None

    def fetch_raw(self) -> RawFetchResult:
        endpoint = "/thirdData/getDevRealKpi"
        gate_key = f"{self.connector_config.site_id}:{endpoint}"
        if not _gate.ready(gate_key):
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error="rate_limited_locally")

        dev_ids = self.connector_config.external_plant_id or ""

        try:
            resp = with_backoff(
                lambda: self._get_dev_real_kpi(dev_ids), max_retries=3, retryable_exceptions=(httpx.HTTPError,)
            )
            _gate.mark(gate_key)
            resp.raise_for_status()
            payload = resp.json()

            if not payload.get("data"):
                # external_plant_id likely holds a station code, not a device ID - discover
                # the real device IDs once and retry (see module docstring).
                discovered = self._discover_dev_ids_from_station(dev_ids)
                if discovered:
                    resp = with_backoff(
                        lambda: self._get_dev_real_kpi(discovered), max_retries=3, retryable_exceptions=(httpx.HTTPError,)
                    )
                    resp.raise_for_status()
                    payload = resp.json()

            return RawFetchResult(endpoint=endpoint, http_status=resp.status_code, payload=payload)
        except httpx.HTTPError as exc:
            return RawFetchResult(endpoint=endpoint, http_status=None, payload={}, error=str(exc))

    def normalize(self, raw: RawFetchResult) -> list[NormalizedReading]:
        records = raw.payload.get("data", [])
        return [map_device_real_kpi(r, site_external_id=self.connector_config.external_plant_id or "") for r in records]
