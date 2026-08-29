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
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// Bygges inde i projektet, så de oversatte filer kan finde node_modules
// (zod og SDK'ets zod-hjælper bruges af testene).
const out = mkdtempSync(join(process.cwd(), '.test-build-'));
try {
  execFileSync(
    'npx',
    [
      'tsc',
      '--ignoreConfig',
      'src/lib/date.ts',
      'src/lib/stats.ts',
      'src/lib/format.ts',
      'src/lib/energy.ts',
      'src/lib/training.ts',
      'src/lib/workoutTypes.ts',
      'src/lib/coachContext.ts',
      'src/lib/claudeSchemas.ts',
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
  const energy = require(join(out, 'lib/energy.js'));
  const training = require(join(out, 'lib/training.js'));
  const coachContext = require(join(out, 'lib/coachContext.js'));
  const schemas = require(join(out, 'lib/claudeSchemas.js'));
  const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
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


  test('energi: Mifflin-St Jeor og aktivitetsfaktor', () => {
    // 10*80 + 6.25*180 - 5*38 + 5 = 1740
    assert.equal(Math.round(energy.bmrMifflin(80, 180, 38, 'mand')), 1740);
    assert.equal(Math.round(energy.bmrMifflin(80, 180, 38, 'kvinde')), 1574);
    assert.equal(energy.activityFactorFromSteps(null), 1.4);
    assert.equal(energy.activityFactorFromSteps(3000), 1.35);
    assert.equal(energy.activityFactorFromSteps(11000), 1.65);
    assert.equal(energy.activityFactorFromSteps(20000), 1.75);
  });

  test('energi: målt behov slår formlen, når der er nok logget', () => {
    // Spiser 2000 kcal og taber 0,5 kg/uge -> forbrænder ca. 2550 kcal.
    const m = energy.measuredTdee(2000, -0.5, 20);
    assert.equal(m.source, 'maalt');
    assert.equal(m.kcal, Math.round(2000 + (0.5 * 7700) / 7));
    // For få dage -> ingen måling.
    assert.equal(energy.measuredTdee(2000, -0.5, 10), null);
    // Urealistisk resultat afvises.
    assert.equal(energy.measuredTdee(500, 5, 30), null);
  });

  test('energi: kaloriemålet går aldrig under gulvet', () => {
    const profile = { heightCm: 180, birthYear: 1988, sex: 'mand' };
    const tdee = { kcal: 2600, source: 'formel', note: '' };
    const t = energy.dailyTargets(profile, 90, 80, 0.5, tdee);
    assert.equal(t.deficitKcal, Math.round((0.5 * 7700) / 7));
    assert.equal(t.targetKcal, 2600 - t.deficitKcal);
    assert.equal(t.floorApplied, false);
    assert.ok(t.proteinG > 0);

    // Et urimeligt stort tab må ikke skubbe målet under hvilestofskiftet.
    const hard = energy.dailyTargets(profile, 90, 80, 2.0, tdee);
    assert.equal(hard.floorApplied, true);
    assert.ok(hard.targetKcal >= hard.bmrKcal);
    assert.ok(hard.targetKcal >= 1500);
  });

  test('træning: uger bucketes fra mandag', () => {
    const workouts = [
      { date: '2026-08-24', type: 'styrke', duration_min: 60 },
      { date: '2026-08-26', type: 'loeb', duration_min: 30 },
      { date: '2026-08-17', type: 'styrke', duration_min: 45 },
    ];
    const buckets = training.weeklyBuckets(workouts, '2026-08-29', 3);
    assert.equal(buckets.length, 3);
    assert.equal(buckets[2].weekStart, '2026-08-24');
    assert.equal(buckets[2].minutes, 90);
    assert.equal(buckets[2].sessions, 2);
    assert.equal(buckets[2].strength, 1);
    assert.equal(buckets[1].minutes, 45);
    assert.equal(buckets[0].minutes, 0);
  });

  test('træning: volumen og tempo', () => {
    assert.equal(
      training.totalVolumeKg([
        { reps: 8, weight_kg: 60 },
        { reps: 8, weight_kg: 60 },
        { reps: null, weight_kg: 60 },
      ]),
      960,
    );
    assert.equal(training.formatPace(training.paceMinPerKm(10, 55)), '5:30 min/km');
    assert.equal(training.formatPace(training.paceMinPerKm(null, 55)), '–');
    assert.equal(training.formatPace(training.paceMinPerKm(0, 55)), '–');
  });

  test('coach-bilag: kun tal der findes, kommer med', () => {
    const summary = {
      goal: { startDate: '2026-08-01', startWeightKg: 90, targetWeightKg: 82, targetDate: null },
      profile: { heightCm: 180, birthYear: 1988, sex: 'mand' },
      progress: {
        latestKg: 86.4,
        latestDate: '2026-08-29',
        weeklyKg: -0.6,
        projectedDate: null,
        changedKg: -3.6,
        remainingKg: 4.4,
        progress: 0.45,
        verdict: 'på-sporet',
        safeMaxWeeklyKg: 0.864,
      },
      targets: {
        tdee: { kcal: 2600, source: 'maalt', note: 'Regnet på 20 dage.' },
        bmrKcal: 1800,
        plannedWeeklyLossKg: 0.6,
        deficitKcal: 660,
        targetKcal: 1940,
        proteinG: 156,
        floorApplied: false,
        floorKcal: 1800,
      },
      plannedWeeklyLossKg: 0.6,
      today: {
        date: '2026-08-29',
        weightKg: 86.4,
        kcal: 1200,
        protein_g: 90,
        fat_g: 40,
        carbs_g: 110,
        meals: 2,
        steps: null,
        activeKcal: null,
        sleepMin: null,
        workouts: [],
      },
      week: {
        from: '2026-08-24',
        to: '2026-08-29',
        workouts: 3,
        strengthSessions: 2,
        cardioMinutes: 40,
        totalMinutes: 145,
        avgSteps: null,
        loggedFoodDays: 5,
        avgKcal: 1980,
        avgProtein: 150,
      },
      history: { totals: [], metrics: [], weights: [] },
    };

    const text = coachContext.buildCoachContext(summary, [], [], '2026-08-29');
    assert.ok(text.includes('1940 kcal/dag'), 'kaloriemålet skal med');
    assert.ok(text.includes('156 g/dag'), 'proteinmålet skal med');
    assert.ok(text.includes('Skridt: ikke tilgængeligt'), 'manglende data skal siges højt');
    assert.ok(text.includes('Træning: intet logget'));
    assert.ok(!text.includes('undefined'));
    assert.ok(!text.includes('NaN'));

    const uden = coachContext.buildCoachContext(
      { ...summary, targets: null },
      [],
      [],
      '2026-08-29',
    );
    assert.ok(uden.includes('Kan ikke regnes endnu'));
  });

  test('skema: v2 tilføjer træning, mad, tilbud og coach', () => {
    const db = new DatabaseSync(':memory:');
    let version = 0;
    while (version < schema.MIGRATIONS.length) {
      for (const sql of schema.MIGRATIONS[version]) db.exec(sql);
      version += 1;
    }
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name);
    for (const t of [
      'weight_entries',
      'settings',
      'workouts',
      'workout_sets',
      'daily_metrics',
      'meals',
      'catalogs',
      'offers',
      'meal_plans',
      'coach_messages',
    ]) {
      assert.ok(tables.includes(t), `mangler tabel ${t}`);
    }
    db.close();
  });

  test('skema: et Health Connect-pas lander kun én gang', () => {
    const db = new DatabaseSync(':memory:');
    for (const migration of schema.MIGRATIONS) for (const sql of migration) db.exec(sql);
    const stmt = db.prepare(schema.UPSERT_HC_WORKOUT_SQL);
    const args = [
      '2026-08-29', '2026-08-29T16:00:00Z', '2026-08-29T16:45:00Z',
      'loeb', 45, 8.2, 152, 420, 'hc-1', 't1', 't1',
    ];
    stmt.run(...args);
    stmt.run(...args.slice(0, 4), 50, null, null, null, 'hc-1', 't1', 't2');

    const rows = db.prepare('SELECT * FROM workouts').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].duration_min, 50, 'varigheden opdateres');
    assert.equal(rows[0].distance_km, 8.2, 'kendte tal må ikke nulstilles');
    assert.equal(rows[0].avg_hr, 152);
    assert.equal(rows[0].source, 'health_connect');

    // To pas uden Health Connect-id må stadig ligge side om side.
    db.prepare(
      `INSERT INTO workouts (date, type, duration_min, source, created_at, updated_at)
       VALUES ('2026-08-29', 'styrke', 60, 'manual', 't', 't')`,
    ).run();
    db.prepare(
      `INSERT INTO workouts (date, type, duration_min, source, created_at, updated_at)
       VALUES ('2026-08-29', 'styrke', 30, 'manual', 't', 't')`,
    ).run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workouts').get().n, 3);
    db.close();
  });

  test('skema: sæt slettes sammen med passet', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    for (const migration of schema.MIGRATIONS) for (const sql of migration) db.exec(sql);
    db.prepare(
      `INSERT INTO workouts (id, date, type, duration_min, source, created_at, updated_at)
       VALUES (1, '2026-08-29', 'styrke', 60, 'manual', 't', 't')`,
    ).run();
    db.prepare(
      `INSERT INTO workout_sets (workout_id, position, exercise, set_number, reps, weight_kg)
       VALUES (1, 0, 'Bænkpres', 1, 8, 60)`,
    ).run();
    db.prepare('DELETE FROM workouts WHERE id = 1').run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workout_sets').get().n, 0);
    db.close();
  });

  test('skema: madplanen overskrives pr. uge', () => {
    const db = new DatabaseSync(':memory:');
    for (const migration of schema.MIGRATIONS) for (const sql of migration) db.exec(sql);
    const stmt = db.prepare(schema.UPSERT_MEAL_PLAN_SQL);
    stmt.run('2026-08-24', '[1]', '[2]', 't1');
    stmt.run('2026-08-24', '[3]', '[4]', 't2');
    const rows = db.prepare('SELECT * FROM meal_plans').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].plan_json, '[3]');
    db.close();
  });

  test('skema: dagsdata fra Health Connect skrives over pr. dag', () => {
    const db = new DatabaseSync(':memory:');
    for (const migration of schema.MIGRATIONS) for (const sql of migration) db.exec(sql);
    const stmt = db.prepare(schema.UPSERT_DAILY_METRICS_SQL);
    stmt.run('2026-08-29', 8000, 400, 2600, 52, 430, 6.1, 't1');
    stmt.run('2026-08-29', 11000, 520, 2700, 51, 430, 8.4, 't2');
    const rows = db.prepare('SELECT * FROM daily_metrics').all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].steps, 11000);
    assert.equal(rows[0].distance_km, 8.4);
    db.close();
  });


  test('Claude-svarformater kan oversættes til et gyldigt JSON-skema', () => {
    const cases = [
      ['mad', schemas.MealAnalysisSchema, ['titel', 'kcal', 'protein_g', 'fedt_g', 'kulhydrat_g', 'sikkerhed', 'varer']],
      ['tilbudsavis', schemas.CatalogReadSchema, ['butik', 'uge', 'gyldig_til', 'tilbud']],
      ['madplan', schemas.MealPlanSchema, ['maaltider', 'indkoebsliste', 'bemaerkning']],
    ];
    for (const [name, zodSchema, keys] of cases) {
      const format = zodOutputFormat(zodSchema);
      assert.equal(format.type, 'json_schema', `${name}: forkert format-type`);
      const json = format.schema;
      assert.equal(json.type, 'object', `${name}: roden skal være et objekt`);
      assert.equal(json.additionalProperties, false, `${name}: skal være lukket`);
      for (const k of keys) {
        assert.ok(json.properties[k], `${name}: mangler feltet ${k}`);
        assert.ok(json.required.includes(k), `${name}: ${k} skal være påkrævet`);
      }
    }
  });

  test('svarformaterne accepterer et realistisk svar og afviser sludder', () => {
    const ok = schemas.MealAnalysisSchema.safeParse({
      titel: 'Kylling med ris',
      varer: [{ navn: 'Kyllingebryst', portion: '150 g', kcal: 250 }],
      kcal: 640,
      protein_g: 52,
      fedt_g: 14,
      kulhydrat_g: 72,
      sikkerhed: 'middel',
      bemaerkning: 'Portionen er svær at bedømme.',
    });
    assert.ok(ok.success);

    // Ukendt sikkerheds-niveau må ikke slippe igennem.
    const bad = schemas.MealAnalysisSchema.safeParse({
      titel: 'x', varer: [], kcal: 1, protein_g: 1, fedt_g: 1, kulhydrat_g: 1,
      sikkerhed: 'meget-sikker', bemaerkning: '',
    });
    assert.equal(bad.success, false);

    // Pris må mangle, men skal være null — ikke udeladt.
    assert.ok(
      schemas.CatalogReadSchema.safeParse({
        butik: '365discount', uge: 'Uge 36', gyldig_til: null,
        tilbud: [{ navn: 'Hakket oksekød', pris_dkk: null, maengde: '500 g', enhed: null, kategori: 'kød' }],
      }).success,
    );
  });

  test('træning: cykling vises i km/t, løb i min/km', () => {
    assert.equal(training.formatSpeedOrPace('cykling', 24.8, 65), '22,9 km/t');
    assert.equal(training.formatSpeedOrPace('loeb', 10, 55), '5:30 min/km');
    assert.equal(training.formatSpeedOrPace('styrke', null, 60), null);
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
