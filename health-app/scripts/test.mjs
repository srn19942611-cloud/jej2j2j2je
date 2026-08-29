/**
 * Test af den rene logik (datoer, formatering, statistik) og af SQL-skemaet.
 * Ingen testramme og ingen ekstra afhængigheder: TypeScript oversættes til en
 * midlertidig mappe, og skemaet køres mod Node's indbyggede SQLite.
 *
 *   npm test
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const out = mkdtempSync(join(tmpdir(), 'sundhed-test-'));
try {
  execFileSync(
    'npx',
    [
      'tsc',
      '--ignoreConfig',
      'src/lib/date.ts',
      'src/lib/stats.ts',
      'src/lib/format.ts',
      'src/db/schema.ts',
      '--outDir',
      out,
      '--module',
      'commonjs',
      '--target',
      'es2020',
      '--skipLibCheck',
    ],
    { stdio: 'inherit' },
  );

  const require = createRequire(import.meta.url);
  const date = require(join(out, 'lib/date.js'));
  const stats = require(join(out, 'lib/stats.js'));
  const format = require(join(out, 'lib/format.js'));
  const schema = require(join(out, 'db/schema.js'));

  const tests = [];
  const test = (name, fn) => tests.push([name, fn]);

  test('datoer regnes i lokal tid, ikke UTC', () => {
    assert.equal(date.addDays('2026-02-28', 1), '2026-03-01');
    assert.equal(date.addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(date.daysBetween('2026-01-01', '2026-01-31'), 30);
    assert.equal(date.toISODate(new Date(2026, 7, 14)), '2026-08-14');
    assert.equal(date.formatDayMonth('2026-08-14'), '14. aug');
    assert.equal(date.startOfWeek('2026-08-29'), '2026-08-24');
    assert.equal(date.startOfWeek('2026-08-24'), '2026-08-24');
  });

  test('dansk tal-format ind og ud', () => {
    assert.equal(format.parseDecimal('82,4'), 82.4);
    assert.equal(format.parseDecimal('82.4'), 82.4);
    assert.equal(format.parseDecimal('  '), null);
    assert.equal(format.parseDecimal('abc'), null);
    assert.equal(format.fmt(82.36), '82,4');
    assert.equal(format.fmt(null), '–');
    assert.equal(format.fmtSigned(-0.62), '−0,6');
    assert.equal(format.fmtSigned(0.62), '+0,6');
  });

  test('trend: 1 kg over 14 dage er 0,5 kg om ugen', () => {
    const points = [];
    for (let i = 0; i < 15; i++) {
      points.push({ date: date.addDays('2026-08-01', i), value: 90 - i / 14 });
    }
    assert.ok(Math.abs(stats.weeklyTrendKg(points) + 0.5) < 1e-9);
    assert.equal(stats.weeklyTrendKg([]), null);
    assert.equal(stats.weeklyTrendKg([{ date: '2026-08-01', value: 90 }]), null);
  });

  test('glidende gennemsnit udjævner enkeltdage', () => {
    const ma = stats.movingAverage(
      [
        { date: '2026-08-01', value: 10 },
        { date: '2026-08-02', value: 20 },
        { date: '2026-08-03', value: 30 },
      ],
      3,
    );
    assert.equal(ma[1].value, 20);
    assert.equal(ma[0].value, 15);
  });

  test('plan: stram frist markeres som urealistisk', () => {
    const ok = stats.planFromGoal({
      startDate: '2026-08-01',
      startWeightKg: 100,
      targetWeightKg: 90,
      targetDate: '2026-10-10',
    });
    assert.ok(Math.abs(ok.neededWeeklyKg - 1) < 0.01);
    assert.equal(ok.safeMaxWeeklyKg, 1);
    assert.equal(ok.realistic, true);

    const tight = stats.planFromGoal({
      startDate: '2026-08-01',
      startWeightKg: 100,
      targetWeightKg: 90,
      targetDate: '2026-09-01',
    });
    assert.equal(tight.realistic, false);
    assert.ok(tight.suggestedWeeks >= 13);
  });

  test('opsummering: fremskridt og dom', () => {
    const points = [];
    for (let i = 0; i < 15; i++) {
      points.push({ date: date.addDays('2026-08-01', i), value: 90 - i / 14 });
    }
    const goal = {
      startDate: '2026-08-01',
      startWeightKg: 90,
      targetWeightKg: 85,
      targetDate: null,
    };
    const s = stats.summarize(points, goal);
    assert.ok(Math.abs(s.changedKg + 1) < 1e-9);
    assert.ok(Math.abs(s.remainingKg - 4) < 1e-9);
    assert.ok(Math.abs(s.progress - 0.2) < 1e-9);

    assert.equal(stats.summarize([], null).verdict, 'ingen-data');

    const flat = [
      { date: date.addDays(date.todayISO(), -14), value: 90 },
      { date: date.todayISO(), value: 90 },
    ];
    assert.equal(stats.summarize(flat, goal).verdict, 'stagneret');

    const fast = [
      { date: date.addDays(date.todayISO(), -14), value: 90 },
      { date: date.todayISO(), value: 85 },
    ];
    assert.equal(stats.summarize(fast, goal).verdict, 'for-hurtigt');

    const up = [
      { date: date.addDays(date.todayISO(), -14), value: 88 },
      { date: date.todayISO(), value: 90 },
    ];
    assert.equal(stats.summarize(up, goal).verdict, 'forkert-vej');
  });

  test('skema: migrationer kan køres to gange', () => {
    const db = new DatabaseSync(':memory:');
    const run = () => {
      let version = db.prepare('PRAGMA user_version').get().user_version;
      while (version < schema.MIGRATIONS.length) {
        for (const sql of schema.MIGRATIONS[version]) db.exec(sql);
        version += 1;
        db.exec(`PRAGMA user_version = ${version}`);
      }
      return version;
    };
    assert.equal(run(), schema.MIGRATIONS.length);
    assert.equal(run(), schema.MIGRATIONS.length);
    db.close();
  });

  test('skema: én vægt pr. dag, gemmer man igen bliver den overskrevet', () => {
    const db = new DatabaseSync(':memory:');
    for (const sql of schema.MIGRATIONS[0]) db.exec(sql);
    const stmt = db.prepare(schema.UPSERT_WEIGHT_SQL);
    stmt.run('2026-08-14', 90.1, null, null, 'manual', null, 't1', 't1');
    stmt.run('2026-08-14', 89.4, 21.5, 'efter løbetur', 'manual', null, 't1', 't2');
    stmt.run('2026-08-15', 89.2, null, null, 'health_connect', 'hc-1', 't1', 't1');

    const rows = db.prepare('SELECT * FROM weight_entries ORDER BY date').all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].weight_kg, 89.4);
    assert.equal(rows[0].body_fat_pct, 21.5);
    assert.equal(rows[0].note, 'efter løbetur');
    assert.equal(rows[0].updated_at, 't2');
    assert.equal(rows[1].source, 'health_connect');
    assert.equal(rows[1].hc_record_id, 'hc-1');
    db.close();
  });

  test('skema: indstillinger er nøgle/værdi og overskrives', () => {
    const db = new DatabaseSync(':memory:');
    for (const sql of schema.MIGRATIONS[0]) db.exec(sql);
    const stmt = db.prepare(schema.UPSERT_SETTING_SQL);
    stmt.run('weight_goal', '{"a":1}');
    stmt.run('weight_goal', '{"a":2}');
    const rows = db.prepare('SELECT * FROM settings').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value, '{"a":2}');
    db.close();
  });

  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`FAIL  ${name}`);
      console.log(String(err.message).split('\n').map((l) => `      ${l}`).join('\n'));
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} tests bestået`);
  process.exit(failed === 0 ? 0 : 1);
} finally {
  rmSync(out, { recursive: true, force: true });
}
