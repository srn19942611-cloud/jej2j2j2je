"""Performance Analysis Agent (brief 6.2). Reads production_readings + expected_production
(written by the Baseline Agent) and writes:
  - pr_aggregates: daily/weekly/monthly actual-vs-expected rollups + a degradation flag
  - performance_flags: candidates for the Fault Diagnosis Agent (6.3) to consume

Never imports or calls another agent - the only coupling is through these two tables and
the read-only production_readings/expected_production/string_readings tables.
"""

import logging
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
from scipy.stats import theilslopes
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.expected_production import ExpectedProduction
from app.db.models.performance_flag import PerformanceFlag
from app.db.models.pr_aggregate import PrAggregate
from app.db.models.production import ProductionReading
from app.db.models.site import Site
from app.db.models.string_reading import StringReading

log = logging.getLogger(__name__)

SUSTAINED_DEVIATION_THRESHOLD_PCT = 15.0
SUSTAINED_DEVIATION_MIN_DAYS = 2
MIN_DAILY_EXPECTED_KWH = 1.0  # ignore near-zero-generation winter days to avoid noisy %s
ZERO_PRODUCTION_EXPECTED_POWER_W = 200.0
ZERO_PRODUCTION_ACTUAL_THRESHOLD_W = 5.0
ZERO_PRODUCTION_MIN_CONSECUTIVE_HOURS = 2
CLIPPING_MARGIN = 1.02
DEGRADATION_WARNING_PCT_PER_YEAR = 1.2  # steeper than this vs. the ~0.3-0.5%/yr warranty norm


def _load_site_frame(db: Session, site_id) -> pd.DataFrame:
    prod = db.execute(select(ProductionReading).where(ProductionReading.site_id == site_id)).scalars().all()
    exp = db.execute(select(ExpectedProduction).where(ExpectedProduction.site_id == site_id)).scalars().all()
    if not prod or not exp:
        return pd.DataFrame()

    prod_df = pd.DataFrame(
        {
            "ts": [p.ts for p in prod],
            "ac_power_w": [float(p.ac_power_w) if p.ac_power_w is not None else np.nan for p in prod],
            "dc_power_w": [float(p.dc_power_w) if p.dc_power_w is not None else np.nan for p in prod],
        }
    ).set_index("ts")
    exp_df = pd.DataFrame(
        {
            "ts": [e.ts for e in exp],
            "expected_ac_power_w": [float(e.expected_ac_power_w) if e.expected_ac_power_w is not None else np.nan for e in exp],
            "expected_energy_kwh_interval": [
                float(e.expected_energy_kwh_interval) if e.expected_energy_kwh_interval is not None else np.nan for e in exp
            ],
        }
    ).set_index("ts")

    return prod_df.join(exp_df, how="inner").sort_index()


def _rollup_daily(df: pd.DataFrame) -> pd.DataFrame:
    daily = df.copy()
    daily["actual_kwh_interval"] = daily["ac_power_w"] / 1000.0  # 1-hour intervals -> Wh/1000 = kWh
    grouped = daily.groupby(daily.index.date).agg(
        actual_kwh=("actual_kwh_interval", "sum"),
        expected_kwh=("expected_energy_kwh_interval", "sum"),
    )
    grouped["pr"] = np.where(grouped["expected_kwh"] > 0, grouped["actual_kwh"] / grouped["expected_kwh"], np.nan)
    return grouped


def _upsert_pr_aggregate(db: Session, site_id, period_type: str, period_start: date, actual_kwh, expected_kwh, pr, degradation_flag=False):
    existing = (
        db.execute(
            select(PrAggregate).where(
                PrAggregate.site_id == site_id,
                PrAggregate.period_type == period_type,
                PrAggregate.period_start == period_start,
            )
        )
        .scalars()
        .first()
    )
    if existing is None:
        existing = PrAggregate(site_id=site_id, period_type=period_type, period_start=period_start)
        db.add(existing)
    existing.actual_kwh = float(actual_kwh) if pd.notna(actual_kwh) else None
    existing.expected_kwh = float(expected_kwh) if pd.notna(expected_kwh) else None
    existing.pr = float(pr) if pd.notna(pr) else None
    existing.degradation_flag = degradation_flag


def _flag_exists(db: Session, site_id, flag_type: str, window_start: datetime) -> bool:
    existing = db.execute(
        select(PerformanceFlag.id).where(
            PerformanceFlag.site_id == site_id,
            PerformanceFlag.flag_type == flag_type,
            PerformanceFlag.window_start == window_start,
        )
    ).first()
    return existing is not None


def _detect_sustained_deviation(db: Session, site: Site, daily: pd.DataFrame) -> None:
    eligible = daily[daily["expected_kwh"] >= MIN_DAILY_EXPECTED_KWH].copy()
    eligible["deficit_pct"] = (1 - eligible["actual_kwh"] / eligible["expected_kwh"]) * 100
    eligible["bad_day"] = eligible["deficit_pct"] >= SUSTAINED_DEVIATION_THRESHOLD_PCT

    run_start = None
    run_days = []
    for day, row in eligible.iterrows():
        if row["bad_day"]:
            if run_start is None:
                run_start = day
            run_days.append(row["deficit_pct"])
        else:
            if run_start is not None and len(run_days) >= SUSTAINED_DEVIATION_MIN_DAYS:
                _create_sustained_flag(db, site, run_start, day, run_days)
            run_start, run_days = None, []
    if run_start is not None and len(run_days) >= SUSTAINED_DEVIATION_MIN_DAYS:
        last_day = eligible.index[-1]
        _create_sustained_flag(db, site, run_start, last_day, run_days)


def _create_sustained_flag(db: Session, site: Site, start_day, end_day, deficits: list[float]) -> None:
    window_start = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)
    if _flag_exists(db, site.id, "sustained_deviation", window_start):
        return
    window_end = datetime.combine(end_day, datetime.min.time(), tzinfo=timezone.utc)
    db.add(
        PerformanceFlag(
            site_id=site.id,
            flag_type="sustained_deviation",
            window_start=window_start,
            window_end=window_end,
            magnitude_pct=float(np.mean(deficits)),
        )
    )


def _detect_zero_production(db: Session, site: Site, df: pd.DataFrame) -> None:
    daylight = df[df["expected_ac_power_w"] >= ZERO_PRODUCTION_EXPECTED_POWER_W].copy()
    if daylight.empty:
        return
    daylight["is_zero"] = daylight["ac_power_w"].fillna(0) <= ZERO_PRODUCTION_ACTUAL_THRESHOLD_W

    run_start = None
    run_len = 0
    last_ts = None
    for ts, row in daylight.iterrows():
        if row["is_zero"]:
            if run_start is None:
                run_start = ts
            run_len += 1
            last_ts = ts
        else:
            if run_start is not None and run_len >= ZERO_PRODUCTION_MIN_CONSECUTIVE_HOURS:
                _create_simple_flag(db, site, "zero_production", run_start, last_ts, 100.0)
            run_start, run_len = None, 0
    if run_start is not None and run_len >= ZERO_PRODUCTION_MIN_CONSECUTIVE_HOURS:
        _create_simple_flag(db, site, "zero_production", run_start, last_ts, 100.0)


def _detect_clipping(db: Session, site: Site, df: pd.DataFrame) -> None:
    ac_rating_w = float(site.inverter_ac_rating_kw) * 1000.0
    pinned = df[
        (df["ac_power_w"] >= ac_rating_w / CLIPPING_MARGIN)
        & (df["dc_power_w"] >= ac_rating_w * CLIPPING_MARGIN)
    ]
    if pinned.empty:
        return
    for day, group in pinned.groupby(pinned.index.date):
        window_start = group.index.min().to_pydatetime()
        window_end = group.index.max().to_pydatetime()
        if _flag_exists(db, site.id, "clipping_suspect", window_start):
            continue
        headroom_pct = float(((group["dc_power_w"] - ac_rating_w) / ac_rating_w * 100).mean())
        db.add(
            PerformanceFlag(
                site_id=site.id,
                flag_type="clipping_suspect",
                window_start=window_start,
                window_end=window_end,
                magnitude_pct=headroom_pct,
            )
        )


def _create_simple_flag(db: Session, site: Site, flag_type: str, start, end, magnitude_pct: float) -> None:
    window_start = start.to_pydatetime() if hasattr(start, "to_pydatetime") else start
    window_end = end.to_pydatetime() if hasattr(end, "to_pydatetime") else end
    if _flag_exists(db, site.id, flag_type, window_start):
        return
    db.add(
        PerformanceFlag(
            site_id=site.id,
            flag_type=flag_type,
            window_start=window_start,
            window_end=window_end,
            magnitude_pct=magnitude_pct,
        )
    )


def _detect_degradation(db: Session, site: Site, daily: pd.DataFrame) -> bool:
    trend = daily.dropna(subset=["pr"])
    if len(trend) < 60:  # need a few months before a slope is meaningful
        return False
    x = np.array([(d - trend.index[0]).days for d in trend.index], dtype=float)
    y = trend["pr"].to_numpy()
    # Theil-Sen (median-of-pairwise-slopes) rather than ordinary least squares - OLS gives
    # the series' endpoints outsized leverage, so a short recent fault (a string issue, an
    # outage) at the tail of the window can masquerade as a multi-month degradation trend.
    # Theil-Sen is robust to exactly that: a short run of outliers barely moves the median.
    slope_per_day, *_ = theilslopes(y, x)
    pct_per_year = -slope_per_day * 365.25 * 100
    if pct_per_year >= DEGRADATION_WARNING_PCT_PER_YEAR:
        window_start = datetime.combine(trend.index[0], datetime.min.time(), tzinfo=timezone.utc)
        if not _flag_exists(db, site.id, "degradation", window_start):
            db.add(
                PerformanceFlag(
                    site_id=site.id,
                    flag_type="degradation",
                    window_start=window_start,
                    window_end=datetime.combine(trend.index[-1], datetime.min.time(), tzinfo=timezone.utc),
                    magnitude_pct=float(pct_per_year),
                )
            )
        return True
    return False


def run_for_site(db: Session, site: Site) -> int:
    df = _load_site_frame(db, site.id)
    if df.empty:
        return 0

    daily = _rollup_daily(df)
    degradation_flagged = _detect_degradation(db, site, daily)

    for day, row in daily.iterrows():
        _upsert_pr_aggregate(db, site.id, "daily", day, row["actual_kwh"], row["expected_kwh"], row["pr"], degradation_flagged)

    weekly = daily.copy()
    weekly.index = pd.to_datetime(weekly.index)
    weekly_grouped = weekly.resample("W-MON", label="left", closed="left").sum(numeric_only=True)
    weekly_grouped["pr"] = np.where(weekly_grouped["expected_kwh"] > 0, weekly_grouped["actual_kwh"] / weekly_grouped["expected_kwh"], np.nan)
    for period_start, row in weekly_grouped.iterrows():
        if pd.isna(row["actual_kwh"]) and pd.isna(row["expected_kwh"]):
            continue
        _upsert_pr_aggregate(db, site.id, "weekly", period_start.date(), row["actual_kwh"], row["expected_kwh"], row["pr"])

    monthly_grouped = weekly.resample("MS").sum(numeric_only=True)
    monthly_grouped["pr"] = np.where(monthly_grouped["expected_kwh"] > 0, monthly_grouped["actual_kwh"] / monthly_grouped["expected_kwh"], np.nan)
    for period_start, row in monthly_grouped.iterrows():
        if pd.isna(row["actual_kwh"]) and pd.isna(row["expected_kwh"]):
            continue
        _upsert_pr_aggregate(db, site.id, "monthly", period_start.date(), row["actual_kwh"], row["expected_kwh"], row["pr"])

    _detect_sustained_deviation(db, site, daily)
    _detect_zero_production(db, site, df)
    _detect_clipping(db, site, df)

    db.flush()
    return len(daily)


def run(db: Session) -> dict:
    sites = db.execute(select(Site)).scalars().all()
    results = {}
    for site in sites:
        results[site.code] = run_for_site(db, site)
    db.commit()
    log.info("Performance agent processed sites: %s", results)
    return results
