"""Verifies the FusionSolar connector's getDevList fallback (see live.py module
docstring): when ConnectorConfig.external_plant_id turns out to be a station code rather
than a device ID, getDevRealKpi returns no data, and the connector should discover the
real device ID via getDevList and retry - entirely against a mocked HTTP transport, no
real network access."""

import uuid

import httpx
import pytest

from app.connectors.fusion_solar.live import FusionSolarConnector
from app.db.models.connector_config import ConnectorConfig
from app.db.models.site import Site


def _site_and_config(external_plant_id: str):
    site_id = uuid.uuid4()
    site = Site(
        id=site_id, code="TEST", name="Test", lat=55.0, lon=12.0,
        nameplate_kwp=100.0, tilt_deg=30.0, azimuth_deg=180.0,
        inverter_ac_rating_kw=90.0, string_count=2,
    )
    config = ConnectorConfig(
        id=uuid.uuid4(), site_id=site_id, platform="fusion_solar", mode="live",
        external_plant_id=external_plant_id, poll_interval_seconds=300,
    )
    return site, config


def test_falls_back_to_dev_list_when_external_plant_id_is_a_station_code():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path == "/thirdData/getDevRealKpi":
            body = request.read()
            if b'"STATION-1"' in body:
                # First attempt: external_plant_id used directly as a devId -> no match.
                return httpx.Response(200, json={"success": True, "data": []})
            # Retry with the discovered device id -> real data.
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [
                        {
                            "collectTime": 1719900000000,
                            "dataItemMap": {"active_power": 5000.0, "run_state": 1},
                        }
                    ],
                },
            )
        if request.url.path == "/thirdData/getDevList":
            return httpx.Response(
                200, json={"success": True, "data": [{"id": "DEV-42", "devTypeId": 1}]}
            )
        raise AssertionError(f"unexpected path {request.url.path}")

    site, config = _site_and_config("STATION-1")
    connector = FusionSolarConnector(config, site)
    connector._client = httpx.Client(base_url=connector._base_url, transport=httpx.MockTransport(handler))
    connector._xsrf_token = "fake-token"

    raw = connector.fetch_raw()

    assert raw.error is None
    assert raw.payload["data"][0]["dataItemMap"]["active_power"] == 5000.0
    assert "/thirdData/getDevList" in calls
    readings = connector.normalize(raw)
    assert len(readings) == 1
    assert readings[0].ac_power_w == 5000.0


def test_uses_dev_id_directly_when_it_already_has_data():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/thirdData/getDevRealKpi"
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": [{"collectTime": 1719900000000, "dataItemMap": {"active_power": 3000.0, "run_state": 1}}],
            },
        )

    site, config = _site_and_config("DEV-42")
    connector = FusionSolarConnector(config, site)
    connector._client = httpx.Client(base_url=connector._base_url, transport=httpx.MockTransport(handler))
    connector._xsrf_token = "fake-token"

    raw = connector.fetch_raw()
    assert raw.payload["data"][0]["dataItemMap"]["active_power"] == 3000.0
