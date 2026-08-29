/**
 * Rent SQL uden afhængigheder — så skemaet kan køres og testes uden for appen
 * (se `npm test`), og ikke kun på en telefon.
 *
 * Migrationer køres i rækkefølge og styres af SQLite's egen `user_version`.
 * Tilføj altid en NY post nederst — ret aldrig i en migration der er kørt,
 * for så bliver telefonens database og koden uenige.
 */
export const MIGRATIONS: string[][] = [
  // v1 — fase 1: vægt-tracking + nøgle/værdi-indstillinger
  [
    `CREATE TABLE IF NOT EXISTS weight_entries (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       date          TEXT    NOT NULL UNIQUE,
       weight_kg     REAL    NOT NULL,
       body_fat_pct  REAL,
       note          TEXT,
       source        TEXT    NOT NULL DEFAULT 'manual',
       hc_record_id  TEXT,
       synced_to_hc  INTEGER NOT NULL DEFAULT 0,
       created_at    TEXT    NOT NULL,
       updated_at    TEXT    NOT NULL
     );`,
    `CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries (date);`,
    `CREATE TABLE IF NOT EXISTS settings (
       key   TEXT PRIMARY KEY,
       value TEXT NOT NULL
     );`,
  ],
// v2 — fase 3-6: træning, Health Connect-dagsdata, mad, tilbud og coach
  [
    `CREATE TABLE IF NOT EXISTS workouts (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       date          TEXT    NOT NULL,
       start_time    TEXT,
       end_time      TEXT,
       type          TEXT    NOT NULL,
       duration_min  REAL    NOT NULL,
       rpe           INTEGER,
       distance_km   REAL,
       avg_hr        INTEGER,
       calories_kcal REAL,
       notes         TEXT,
       source        TEXT    NOT NULL DEFAULT 'manual',
       hc_record_id  TEXT,
       synced_to_hc  INTEGER NOT NULL DEFAULT 0,
       created_at    TEXT    NOT NULL,
       updated_at    TEXT    NOT NULL
     );`,
    `CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts (date);`,
    // Et pas fra Health Connect må kun findes én gang, uanset hvor tit vi synker.
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_hc
       ON workouts (hc_record_id) WHERE hc_record_id IS NOT NULL;`,
    `CREATE TABLE IF NOT EXISTS workout_sets (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
       position    INTEGER NOT NULL,
       exercise    TEXT    NOT NULL,
       set_number  INTEGER NOT NULL,
       reps        INTEGER,
       weight_kg   REAL
     );`,
    `CREATE INDEX IF NOT EXISTS idx_workout_sets_workout ON workout_sets (workout_id);`,

    // Dagsdata læst fra Health Connect. Gemmes lokalt, så appen kan regne og
    // vise noget uden at spørge Health Connect ved hver eneste skærmskift.
    `CREATE TABLE IF NOT EXISTS daily_metrics (
       date          TEXT PRIMARY KEY,
       steps         INTEGER,
       active_kcal   REAL,
       total_kcal    REAL,
       resting_hr    INTEGER,
       sleep_min     REAL,
       distance_km   REAL,
       updated_at    TEXT NOT NULL
     );`,

    `CREATE TABLE IF NOT EXISTS meals (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       date        TEXT    NOT NULL,
       time        TEXT    NOT NULL,
       title       TEXT    NOT NULL,
       photo_uri   TEXT,
       kcal        REAL,
       protein_g   REAL,
       fat_g       REAL,
       carbs_g     REAL,
       confidence  TEXT,
       items_json  TEXT,
       notes       TEXT,
       source      TEXT    NOT NULL DEFAULT 'foto',
       created_at  TEXT    NOT NULL
     );`,
    `CREATE INDEX IF NOT EXISTS idx_meals_date ON meals (date);`,

    `CREATE TABLE IF NOT EXISTS catalogs (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       store       TEXT NOT NULL,
       week_label  TEXT,
       valid_to    TEXT,
       scanned_at  TEXT NOT NULL
     );`,
    `CREATE TABLE IF NOT EXISTS offers (
       id          INTEGER PRIMARY KEY AUTOINCREMENT,
       catalog_id  INTEGER NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
       name        TEXT    NOT NULL,
       price_dkk   REAL,
       unit        TEXT,
       quantity    TEXT,
       category    TEXT
     );`,
    `CREATE INDEX IF NOT EXISTS idx_offers_catalog ON offers (catalog_id);`,

    `CREATE TABLE IF NOT EXISTS meal_plans (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       week_start    TEXT NOT NULL UNIQUE,
       plan_json     TEXT NOT NULL,
       shopping_json TEXT NOT NULL,
       created_at    TEXT NOT NULL
     );`,

    `CREATE TABLE IF NOT EXISTS coach_messages (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       role       TEXT NOT NULL,
       content    TEXT NOT NULL,
       created_at TEXT NOT NULL
     );`,
  ],
];

/**
 * Én måling pr. dag: gemmer man igen på samme dato, overskrives dagens tal.
 * Det holder grafen og statistikken entydig uden at brugeren skal rydde op.
 */
export const UPSERT_WEIGHT_SQL = `
  INSERT INTO weight_entries
    (date, weight_kg, body_fat_pct, note, source, hc_record_id, synced_to_hc, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT(date) DO UPDATE SET
    weight_kg    = excluded.weight_kg,
    body_fat_pct = excluded.body_fat_pct,
    note         = excluded.note,
    source       = excluded.source,
    hc_record_id = excluded.hc_record_id,
    synced_to_hc = 0,
    updated_at   = excluded.updated_at`;

export const UPSERT_SETTING_SQL = `
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`;

/** Dagsdata fra Health Connect: skriv over, hvad vi havde for den dag. */
export const UPSERT_DAILY_METRICS_SQL = `
  INSERT INTO daily_metrics
    (date, steps, active_kcal, total_kcal, resting_hr, sleep_min, distance_km, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(date) DO UPDATE SET
    steps       = excluded.steps,
    active_kcal = excluded.active_kcal,
    total_kcal  = excluded.total_kcal,
    resting_hr  = excluded.resting_hr,
    sleep_min   = excluded.sleep_min,
    distance_km = excluded.distance_km,
    updated_at  = excluded.updated_at`;

/**
 * Træningspas fra Health Connect. `hc_record_id` er nøglen, så det samme pas
 * ikke lander to gange, når man synkroniserer igen. Manuelt tilføjede felter
 * (RPE, noter, sæt) må ikke overskrives af en synkronisering.
 */
export const UPSERT_HC_WORKOUT_SQL = `
  INSERT INTO workouts
    (date, start_time, end_time, type, duration_min, distance_km, avg_hr,
     calories_kcal, source, hc_record_id, synced_to_hc, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'health_connect', ?, 1, ?, ?)
  ON CONFLICT(hc_record_id) WHERE hc_record_id IS NOT NULL DO UPDATE SET
    date          = excluded.date,
    start_time    = excluded.start_time,
    end_time      = excluded.end_time,
    duration_min  = excluded.duration_min,
    distance_km   = COALESCE(excluded.distance_km, workouts.distance_km),
    avg_hr        = COALESCE(excluded.avg_hr, workouts.avg_hr),
    calories_kcal = COALESCE(excluded.calories_kcal, workouts.calories_kcal),
    updated_at    = excluded.updated_at`;

export const UPSERT_MEAL_PLAN_SQL = `
  INSERT INTO meal_plans (week_start, plan_json, shopping_json, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(week_start) DO UPDATE SET
    plan_json     = excluded.plan_json,
    shopping_json = excluded.shopping_json,
    created_at    = excluded.created_at`;
