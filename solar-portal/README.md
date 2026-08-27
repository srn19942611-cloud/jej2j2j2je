# Solar Fleet Monitoring & Operations Portal

A monitoring and operations portal for a portfolio of solar PV installations across
FusionSolar (Huawei), SolPlanet, and SolaX Cloud. Continuously compares each site's actual
output against a physics-based expected baseline, and raises Danish-language alerts when a
site underperforms - the goal is to catch soiling, string faults, clipping, shading,
degradation, and downtime early instead of finding out on a bill months later.

The UI is entirely in Danish (see "Language" below); code, comments, and this README are
in English.

## Status: foundation build, mock-mode by default

This build implements every layer of the pipeline end to end - ingestion, weather, physics
baseline, four analysis agents, API, and dashboard - but runs against **simulated data by
default**, because no real site inventory or platform credentials were available while
building it. See "Scope and honest limitations" below before pointing this at a real fleet.

## Architecture

```
backend/    FastAPI + SQLAlchemy + APScheduler (Python)
  app/
    connectors/     One module per platform (fusion_solar, solplanet, solax) + a shared
                     mock/ simulator. All implement the same BaseConnector interface and
                     normalize into one common schema (app/connectors/common_schema.py).
    physics/         Physics-based expected-output model (pvlib PVWatts family).
    weather/         Open-Meteo client + a local synthetic fallback generator.
    agents/          The 4 analysis agents (+ a simple Reporting agent), each reading/
                     writing shared tables only - never calling each other directly.
    api/routes/      Fleet overview, site detail, alerts, feed-health, CSV export, reports.
    scheduler/       APScheduler jobs: poll connectors, refresh weather, run agents.
    db/models/       SQLAlchemy models (one table per concept, see below).
  scripts/
    init_db.py           Creates tables (+ TimescaleDB hypertables where available).
    seed_demo_data.py     Seeds ~13 months of demo data across 8 sites with 5 injected
                          fault scenarios, then runs all agents once.
  tests/                 pytest suite: physics sanity, connector normalization, agent logic.

frontend/   React + TypeScript + Vite
  src/
    i18n/da.json + strings.ts   The Danish string dictionary and its typed accessor.
    api/                        Fetch client, TS types mirroring the backend schemas,
                                 TanStack Query hooks.
    pages/                      Fleet Overview (landing), Site Detail, Alerts, Feed Health.
    components/                 Charts (Recharts), status badges, alert feed, CSV export.
```

## Data model

Time-series tables (production_readings, string_readings, weather_readings, raw_payloads,
expected_production) are TimescaleDB hypertables when running against the docker-compose
`timescaledb` service; against a plain Postgres (e.g. local dev without Docker) they fall
back to ordinary tables automatically - the app works either way, just without Timescale's
chunking/compression benefits in the fallback case.

Everything runs at **hourly resolution** (a deliberate simplification - see below), so
weather, production, and expected-production timestamps always line up exactly.

## The four analysis agents

Each agent is a plain Python module under `app/agents/`, invoked only by the scheduler.
They never import or call each other - all coordination happens by one agent writing to a
shared table that another later reads:

- **Baseline Agent** (`baseline_agent.py`) - physics model → `expected_production`, backfills `pr`.
- **Performance Analysis Agent** (`performance_agent.py`) - daily/weekly/monthly PR rollups
  (`pr_aggregates`), degradation slope (Theil-Sen, robust to a short-term fault skewing an
  OLS fit), and writes `performance_flags` for sustained deviations, zero production, and
  clipping.
- **Fault Diagnosis Agent** (`fault_diagnosis_agent.py`) - consumes `performance_flags`,
  narrows down a cause (inverter/comms fault, a specific underperforming string, clipping,
  degradation), and writes the Danish-language `alerts` the dashboard shows.
- **Feed-Health Agent** (`feed_health_agent.py`) - runs independently, sweeping
  `feed_health` to catch a stale monitoring feed before it's mistaken for a real production drop.

A simple **Reporting Agent** (`reporting_agent.py`) generates weekly/monthly Danish
summaries. The six higher-value agents from the brief's section 6.6 (Forecast, Economic
Impact, Fleet Correlation, Maintenance/Soiling, Degradation/Warranty, Alert Triage) are
explicitly out of scope for this pass - see `app/agents/extension_points.py` for documented
stubs naming exactly which tables each would read/write.

## Running it

### With Docker (recommended for a real deployment)

```bash
cp .env.example .env
docker compose up -d timescaledb
docker compose run --rm backend python -m scripts.init_db
docker compose run --rm backend python -m scripts.seed_demo_data
docker compose up -d backend scheduler frontend
```

Frontend: http://localhost:5173 · API: http://localhost:8000/docs

### Without Docker (local Postgres)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://<user>:<pass>@localhost:5432/solarportal
python -m scripts.init_db
python -m scripts.seed_demo_data   # takes a few minutes - 13 months x 8 sites, hourly
uvicorn app.main:app --reload      # in one terminal
python -m app.scheduler.runner     # in another, optional for a static demo

cd ../frontend
npm install
npm run dev
```

Tests: `cd backend && pytest` (needs a `solarportal_test` Postgres database on the same
connection details - see `tests/conftest.py`).

## Going live with real credentials

Every connector defaults to `mode=mock`. To point one platform at a real account, set its
mode + credential env vars (see `.env.example`) - `FUSIONSOLAR_MODE=live` plus
`FUSIONSOLAR_USERNAME`/`FUSIONSOLAR_PASSWORD`, etc. No code changes needed; the registry
(`app/connectors/registry.py`) picks the live implementation automatically. You'll also
need to create real `Site` rows (nameplate capacity, tilt, azimuth, lat/lon) and
`ConnectorConfig` rows pointing at each site's real external plant ID.

**The SolPlanet connector is unverified** - SolPlanet's branding has shifted (reportedly a
Sofar Solar OpenAPI rebrand) and the exact current API shape wasn't confirmed with the
vendor before this build. It's structurally complete but should not be trusted in live mode
without validating against a real account first (see the module docstring in
`app/connectors/solplanet/live.py`).

## Scope and honest limitations

This was built without real site inventory, without real platform credentials, and - in the
sandboxed environment it was authored in - **without egress to Open-Meteo** (confirmed via
the sandbox's own network-policy diagnostics, not a bug in the client). Rather than leaving
those gaps unaddressed:

- **Weather**: `app/weather/ingestion.py` tries the real Open-Meteo API first and falls
  back to a local, solar-geometry-correct synthetic generator
  (`app/weather/synthetic_fallback.py`) only if that fails. A normal deployment with open
  or allow-listed egress always gets real historical/forecast weather; the fallback exists
  purely so the demo pipeline still produces physically plausible, weather-correlated data
  in a network-restricted environment.
- **Resolution**: the whole pipeline runs hourly rather than mixing a 5-15 min live-poll
  cadence with hourly weather. This keeps every table trivially joinable and is still dense
  enough for meaningful PR trend, degradation-slope, and alerting behaviour. A live
  connector's actual poll interval (`ConnectorConfig.poll_interval_seconds`) is independent
  of this and can be finer in a real deployment.
- **No Alembic**: `scripts/init_db.py` uses `SQLAlchemy.metadata.create_all` + a few raw
  `create_hypertable` calls instead of versioned migrations - reasonable for a foundation
  build, worth replacing with Alembic once the schema needs incremental, production
  migrations.
- **No Celery/Redis**: a single-process APScheduler runs all polling/agent jobs. Every job
  is idempotent (only processes new/unprocessed rows), so a container restart never
  double-processes.
- **Alert delivery**: alerts live in the in-app feed only. Email/webhook/Slack delivery
  (brief section 8, step 6) was explicitly deferred for this pass.
- **Section 9's open items** (exact site count/specs, SolPlanet's confirmed API, hosting
  environment, alert channel) are still open - this build answers them with reasonable
  demo defaults, not real answers.

## Demo fleet

`scripts/seed_demo_data.py` seeds 8 sites across Denmark (residential to commercial scale,
split across all three platforms) with ~13 months of hourly weather-correlated production,
and deliberately injects five fault signatures so the agents have something real to find:

| Site | Injected scenario |
|---|---|
| DK-ODE-01 (Odense) | One string at 50% output for the last 10 days |
| DK-KOL-01 (Kolding) | Feed stopped updating ~10 hours ago (stale, not a production fault) |
| DK-RAN-01 (Randers) | A full day of zero production during daylight |
| DK-VEJ-01 (Vejle) | Oversized DC array (1.3x inverter rating) → natural clipping on sunny days |
| DK-AAL-01 (Aalborg) | Accelerated degradation (~3%/yr vs. the normal ~0.4%/yr) |

Re-run with `python -m scripts.seed_demo_data --reset` to wipe and reseed (this truncates
every table - it's demo data, not something worth a selective per-site delete).
