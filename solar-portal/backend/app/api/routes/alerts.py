import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models.alert import Alert
from app.db.models.site import Site
from app.schemas.alert import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    site_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(Alert, Site.name).join(Site, Alert.site_id == Site.id)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if status:
        stmt = stmt.where(Alert.status == status)
    if site_id:
        stmt = stmt.where(Alert.site_id == site_id)
    stmt = stmt.order_by(Alert.created_at.desc())

    rows = db.execute(stmt).all()
    return [
        AlertOut(
            id=alert.id,
            site_id=alert.site_id,
            site_name=site_name,
            string_id=alert.string_id,
            created_at=alert.created_at,
            severity=alert.severity,
            category=alert.category,
            message_da=alert.message_da,
            suggested_cause_da=alert.suggested_cause_da,
            confidence=float(alert.confidence) if alert.confidence is not None else None,
            status=alert.status,
            source_agent=alert.source_agent,
        )
        for alert, site_name in rows
    ]


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: uuid.UUID, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alarm ikke fundet")
    alert.status = "acknowledged"
    db.commit()
    site = db.get(Site, alert.site_id)
    return AlertOut(
        id=alert.id,
        site_id=alert.site_id,
        site_name=site.name if site else "",
        string_id=alert.string_id,
        created_at=alert.created_at,
        severity=alert.severity,
        category=alert.category,
        message_da=alert.message_da,
        suggested_cause_da=alert.suggested_cause_da,
        confidence=float(alert.confidence) if alert.confidence is not None else None,
        status=alert.status,
        source_agent=alert.source_agent,
    )


@router.post("/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(alert_id: uuid.UUID, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alarm ikke fundet")
    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    site = db.get(Site, alert.site_id)
    return AlertOut(
        id=alert.id,
        site_id=alert.site_id,
        site_name=site.name if site else "",
        string_id=alert.string_id,
        created_at=alert.created_at,
        severity=alert.severity,
        category=alert.category,
        message_da=alert.message_da,
        suggested_cause_da=alert.suggested_cause_da,
        confidence=float(alert.confidence) if alert.confidence is not None else None,
        status=alert.status,
        source_agent=alert.source_agent,
    )
