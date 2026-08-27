from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import alerts, export, feed_health, fleet, health, reports, sites
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="Solar Fleet Monitoring & Operations Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.api_cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(fleet.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(feed_health.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
