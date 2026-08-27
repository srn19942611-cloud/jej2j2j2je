from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
    solax_base_url: str = "https://www.solaxcloud.com/proxyApp/proxy/api"
    solax_token_key: str = ""

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
