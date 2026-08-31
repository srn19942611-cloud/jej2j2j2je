import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models.alert import Alert
from app.db.models.expected_production import ExpectedProduction
from app.db.models.production import ProductionReading
from app.db.models.site import Site

router = APIRouter(prefix="/export", tags=["export"])


def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/production.csv")
def export_production_csv(
    site_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    end = end or datetime.now(timezone.utc)
    start = start or (end - timedelta(days=30))

    stmt = select(ProductionReading, Site.code, ExpectedProduction.expected_ac_power_w, ExpectedProduction.pr).join(
        Site, ProductionReading.site_id == Site.id
    ).outerjoin(
        ExpectedProduction,
        (ExpectedProduction.site_id == ProductionReading.site_id) & (ExpectedProduction.ts == ProductionReading.ts),
    ).where(ProductionReading.ts >= start, ProductionReading.ts <= end)
    if site_id is not None:
        stmt = stmt.where(ProductionReading.site_id == site_id)
    stmt = stmt.order_by(Site.code, ProductionReading.ts)

    rows = [
        [
            site_code,
            p.ts.isoformat(),
            p.ac_power_w,
            p.dc_power_w,
            expected_ac_power_w,
            pr,
            p.inverter_status,
        ]
        for p, site_code, expected_ac_power_w, pr in db.execute(stmt).all()
    ]
    header = ["site_code", "ts", "ac_power_w", "dc_power_w", "expected_ac_power_w", "pr", "inverter_status"]
    return _csv_response(rows, header, "produktion.csv")


@router.get("/alerts.csv")
def export_alerts_csv(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
):
    end = end or datetime.now(timezone.utc)
    start = start or (end - timedelta(days=90))

    stmt = (
        select(Alert, Site.code)
        .join(Site, Alert.site_id == Site.id)
        .where(Alert.created_at >= start, Alert.created_at <= end)
        .order_by(Alert.created_at.desc())
    )
    rows = [
        [
            site_code,
            a.created_at.isoformat(),
            a.severity,
            a.category,
            a.string_id or "",
            a.message_da,
            a.suggested_cause_da,
            a.status,
        ]
        for a, site_code in db.execute(stmt).all()
    ]
    header = ["site_code", "created_at", "severity", "category", "string_id", "message_da", "suggested_cause_da", "status"]
    return _csv_response(rows, header, "alarmer.csv")
