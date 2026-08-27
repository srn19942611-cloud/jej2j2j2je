from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved relative to this file (backend/app/config.py -> backend -> solar-portal/.env)
# rather than the process CWD, so `solar-portal/.env` is found the same way whether the
# app is started as `uvicorn app.main:app` from backend/, as a docker-compose service, or
# via a script run from anywhere else in the tree.
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"

# Also push .env into the real process environment (not just pydantic-settings' own
# Settings object) - code that reads os.environ directly for a mode flag (e.g.
# connectors/registry.py, which must agree with a real deployed env var either way) then
# sees the same values regardless of whether they came from a real env var or this file.
# load_dotenv() never overrides a variable that's already set for real, so a real
# deployment env var still wins over the file, same precedence pydantic-settings itself uses.
load_dotenv(_ENV_FILE)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    database_url: str = "postgresql+psycopg2://solarportal:solarportal@localhost:5433/solarportal"

    open_meteo_forecast_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_archive_url: str = "https://archive-api.open-meteo.com/v1/archive"

    fusionsolar_mode: str = "mock"
    fusionsolar_base_url: str = "https://eu5.fusionsolar.huawei.com"
    fusionsolar_username: str = ""
    fusionsolar_password: str = ""

    solplanet_mode: str = "mock"
    solplanet_base_url: str = "https://api.solplanet.example"
    solplanet_app_id: str = ""
    solplanet_app_secret: str = ""

    solax_mode: str = "mock"
    # Legacy SolaX Cloud "User Monitoring API" (tokenId header, well-documented publicly).
    solax_base_url: str = "https://www.solaxcloud.com/proxyApp/proxy/api"
    solax_token_key: str = ""
    # Newer SolaX "Developer Portal" (developer.solaxcloud.com) - OAuth2 client-credentials
    # style auth (Client ID/Secret -> Bearer token). Used automatically instead of the
    # legacy tokenId scheme when client_id/client_secret are set. Endpoint paths below are
    # BEST-EFFORT DEFAULTS, not confirmed against the real API (see live.py docstring) -
    # override via env var the moment the real paths are confirmed, no code change needed.
    solax_client_id: str = ""
    solax_client_secret: str = ""
    solax_oauth_token_url: str = "https://developer.solaxcloud.com/oauth/token"
    solax_oauth_data_base_url: str = "https://developer.solaxcloud.com/api/v1"

    api_cors_origins: str = "http://localhost:5173"

    def connector_mode(self, platform: str) -> str:
        return {
            "fusion_solar": self.fusionsolar_mode,
            "solplanet": self.solplanet_mode,
            "solax": self.solax_mode,
        }[platform].lower()


@lru_cache
def get_settings() -> Settings:
    return Settings()
