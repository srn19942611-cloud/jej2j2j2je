"""Chooses mock vs live connector implementation per platform.

Precedence: the platform's env var (FUSIONSOLAR_MODE / SOLPLANET_MODE / SOLAX_MODE) always
wins when set; otherwise the connector_config row's stored `mode` is used; otherwise "mock".
This is the entire mechanism for "drop in real credentials later without touching code" -
flip the env var (and provide the credential env vars) and the same connector_config starts
hitting the real vendor API on the next poll.
"""

import os

import app.config  # noqa: F401 - importing pushes solar-portal/.env into os.environ
                    # (see config.py's load_dotenv call) before the os.environ.get() below,
                    # regardless of whether anything else has imported app.config yet.
from app.connectors.base import BaseConnector
from app.db.models.connector_config import ConnectorConfig
from app.db.models.site import Site

_ENV_VAR_BY_PLATFORM = {
    "fusion_solar": "FUSIONSOLAR_MODE",
    "solplanet": "SOLPLANET_MODE",
    "solax": "SOLAX_MODE",
}


def resolve_mode(connector_config: ConnectorConfig) -> str:
    env_var = _ENV_VAR_BY_PLATFORM.get(connector_config.platform)
    env_value = os.environ.get(env_var) if env_var else None
    if env_value:
        return env_value.strip().lower()
    return (connector_config.mode or "mock").strip().lower()


def get_connector(connector_config: ConnectorConfig, site: Site) -> BaseConnector:
    mode = resolve_mode(connector_config)

    if mode == "live":
        if connector_config.platform == "fusion_solar":
            from app.connectors.fusion_solar.live import FusionSolarConnector

            return FusionSolarConnector(connector_config, site)
        if connector_config.platform == "solplanet":
            from app.connectors.solplanet.live import SolPlanetConnector

            return SolPlanetConnector(connector_config, site)
        if connector_config.platform == "solax":
            from app.connectors.solax.live import SolaxConnector

            return SolaxConnector(connector_config, site)
        raise ValueError(f"Unknown platform: {connector_config.platform}")

    from app.connectors.mock.mock_connector import MockConnector

    return MockConnector(connector_config, site)
