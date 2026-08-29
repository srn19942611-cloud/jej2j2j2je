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
