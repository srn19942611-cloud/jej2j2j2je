import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models.report import Report
from app.schemas.report import ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=list[ReportOut])
def list_reports(
    site_id: uuid.UUID | None = Query(default=None),
    period: str | None = Query(default=None, pattern="^(weekly|monthly)$"),
    db: Session = Depends(get_db),
):
    stmt = select(Report)
    if site_id is not None:
        stmt = stmt.where(Report.site_id == site_id)
    if period:
        stmt = stmt.where(Report.period_type == period)
    stmt = stmt.order_by(Report.period_start.desc())
    return db.execute(stmt).scalars().all()


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: uuid.UUID, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Rapport ikke fundet")
    return report
