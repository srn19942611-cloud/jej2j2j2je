from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models.connector_config import ConnectorConfig
from app.db.models.feed_health import FeedHealth
from app.db.models.site import Site
from app.schemas.feed_health import FeedHealthOut

router = APIRouter(prefix="/feed-health", tags=["feed-health"])


@router.get("", response_model=list[FeedHealthOut])
def list_feed_health(db: Session = Depends(get_db)):
    rows = db.execute(
        select(FeedHealth, ConnectorConfig, Site)
        .join(ConnectorConfig, FeedHealth.connector_config_id == ConnectorConfig.id)
        .join(Site, FeedHealth.site_id == Site.id)
        .order_by(Site.name)
    ).all()
    return [
        FeedHealthOut(
            connector_config_id=fh.connector_config_id,
            site_id=fh.site_id,
            site_name=site.name,
            platform=cc.platform,
            status=fh.status,
            last_attempt_at=fh.last_attempt_at,
            last_success_at=fh.last_success_at,
            consecutive_failures=fh.consecutive_failures,
            last_error=fh.last_error,
        )
        for fh, cc, site in rows
    ]
