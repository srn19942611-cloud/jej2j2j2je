"""Standalone scheduler process entrypoint (docker-compose `scheduler` service):
python -m app.scheduler.runner

Deliberately NOT Celery/Redis - a single-process APScheduler is enough for this
foundation build's polling + agent cadence, and every job is written idempotently
(agents only process new/unprocessed rows) so a container restart never double-processes.
"""

import logging
import time

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.scheduler import jobs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(jobs.poll_all_connectors, "interval", seconds=300, id="poll_connectors", max_instances=1)
    scheduler.add_job(jobs.refresh_weather, "interval", minutes=30, id="refresh_weather", max_instances=1)
    scheduler.add_job(jobs.run_baseline_agent, "interval", minutes=15, id="baseline_agent", max_instances=1)
    scheduler.add_job(jobs.run_performance_agent, "interval", minutes=20, id="performance_agent", max_instances=1)
    scheduler.add_job(jobs.run_fault_diagnosis_agent, "interval", minutes=20, id="fault_diagnosis_agent", max_instances=1)
    scheduler.add_job(jobs.run_feed_health_agent, "interval", minutes=5, id="feed_health_agent", max_instances=1)
    scheduler.add_job(jobs.run_weekly_report, CronTrigger(day_of_week="mon", hour=6, minute=0), id="weekly_report")
    scheduler.add_job(jobs.run_monthly_report, CronTrigger(day=1, hour=6, minute=5), id="monthly_report")
    return scheduler


def main() -> None:
    scheduler = build_scheduler()
    scheduler.start()
    log.info("Scheduler started with jobs: %s", [j.id for j in scheduler.get_jobs()])
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    main()
