/**
 * Ende-til-ende-tjek af de fire Claude-kald — uden at bruge en rigtig nøgle
 * og uden at sende noget ud på nettet.
 *
 * Web-versionen af appen køres i en browser, alle kald til api.anthropic.com
 * opsnappes og besvares med faste svar, og så kontrolleres det, at appen
 * sender det rigtige af sted og viser resultatet det rigtige sted.
 *
 *   npx expo export --platform web --output-dir dist-web
 *   node scripts/e2e-web.mjs            # kræver at playwright er installeret
 *
 * Chromium findes automatisk, hvis playwright selv har hentet den. Ellers kan
 * en anden browser peges ud med CHROMIUM_PATH=/sti/til/chrome.
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.env.WEB_BUILD ?? 'dist-web';
const PORT = 8123;
const BASE = `http://localhost:${PORT}`;

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(
    `Fandt ingen web-build i "${ROOT}".\n` +
      'Kør først:  npx expo export --platform web --output-dir dist-web',
  );
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright mangler. Kør:  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

/* --------------------------------------------------------------- server */
// expo-sqlite kører som WebAssembly og kræver cross-origin-isolation.
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};
const server = http.createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path === '/' || !extname(path)) path = '/index.html';
  try {
    const data = await readFile(join(ROOT, path));
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Content-Type', TYPES[extname(path)] ?? 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));

/* ----------------------------------------------------------- testbillede */
const dir = await mkdtemp(join(tmpdir(), 'sundhed-e2e-'));
const imagePath = join(dir, 'billede.png');
{
  const w = 640;
  const h = 480;
  const rows = Buffer.concat(
    Array.from({ length: h }, () =>
      Buffer.concat([
        Buffer.from([0]),
        Buffer.from(Array.from({ length: w * 3 }, (_, i) => (i * 255) / (w * 3))),
      ]),
    ),
  );
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  await writeFile(
    imagePath,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(rows)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

/* --------------------------------------------------------------- browser */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 412, height: 940 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[fejl i siden]', e.message.slice(0, 250)));

const calls = [];

const MEAL = {
  titel: 'Kylling med ris og broccoli',
  varer: [
    { navn: 'Kyllingebryst', portion: '150 g', kcal: 250 },
    { navn: 'Ris', portion: '180 g kogt', kcal: 240 },
    { navn: 'Broccoli', portion: '120 g', kcal: 40 },
  ],
  kcal: 530,
  protein_g: 48,
  fedt_g: 9,
  kulhydrat_g: 62,
  sikkerhed: 'middel',
  bemaerkning: 'Mængden af ris er svær at bedømme fra billedet.',
};
const CATALOG = {
  butik: '365discount',
  uge: 'Uge 36',
  gyldig_til: '2026-09-05',
  tilbud: [
    { navn: 'Hakket oksekød 8-12%', pris_dkk: 25, maengde: '500 g', enhed: 'pk.', kategori: 'kød' },
    { navn: 'Kyllingebryst', pris_dkk: 45, maengde: '900 g', enhed: 'pk.', kategori: 'kød' },
    { navn: 'Broccoli', pris_dkk: 8, maengde: '1 stk.', enhed: 'stk.', kategori: 'grønt' },
    { navn: 'Skyr naturel', pris_dkk: 12, maengde: '450 g', enhed: 'bæger', kategori: 'mejeri' },
  ],
};
const PLAN = {
  maaltider: [
    {
      dag: 'Mandag',
      ret: 'Kylling med ris og broccoli',
      hovedvarer: ['Kyllingebryst', 'Broccoli'],
      kcal_pr_portion: 640,
      protein_g_pr_portion: 50,
      baseret_paa_tilbud: ['Kyllingebryst', 'Broccoli'],
    },
  ],
  indkoebsliste: [
    { vare: 'Kyllingebryst', maengde: '900 g', butik: '365discount', pris_dkk: 45 },
  ],
  bemaerkning: 'Planen forudsætter én portion pr. måltid.',
};
const COACH_SVAR = 'Du ligger fint i dag. Du mangler stadig protein — tag et måltid med skyr.';

await ctx.route('**/v1/messages**', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}');
  calls.push(body);
  const props = body.output_config?.format?.schema?.properties ?? {};
  const text = props.varer
    ? JSON.stringify(MEAL)
    : props.tilbud
      ? JSON.stringify(CATALOG)
      : props.maaltider
        ? JSON.stringify(PLAN)
        : COACH_SVAR;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  });
});

const go = async (route) => {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
};
const inputs = () => page.locator('input');
const click = async (text) => {
  await page.getByText(text, { exact: true }).first().click();
  await page.waitForTimeout(200);
};
const text = async () => page.innerText('body');

const results = [];
const step = (name) => {
  results.push(name);
  console.log(`  ok  ${name}`);
};

try {
  /* -------------------------------------------------------- grunddata */
  await go('/weight');
  await inputs().nth(0).fill('86,0');
  await click('Gem måling');
  await go('/goal');
  await inputs().nth(0).fill('86,0');
  await inputs().nth(1).fill('80,0');
  await click('Gem mål');
  await go('/settings');
  await inputs().nth(0).fill('182');
  await inputs().nth(1).fill('1988');
  await click('Gem profil');
  await page.waitForTimeout(400);
  await page.evaluate(() => localStorage.setItem('anthropic_api_key', 'sk-ant-test'));
  step('grunddata: vægt, mål og profil kan gemmes');

  /* ------------------------------------------------------------ coach */
  await go('/coach');
  await click('Dagens check-in');
  await page.waitForTimeout(2500);
  assert.ok((await text()).includes('Du ligger fint i dag'), 'coachens svar skal vises');

  const coach = calls.at(-1);
  assert.ok(Array.isArray(coach.system), 'systemprompten skal sendes som blokke');
  assert.ok(coach.system[0].text.includes('Find aldrig på tal'), 'grundreglen skal med');
  const bilag = coach.messages[0].content;
  for (const felt of ['Kaloriemål:', 'Proteinmål:', 'Hvilestofskifte:']) {
    assert.ok(bilag.includes(felt), `bilaget mangler ${felt}`);
  }
  assert.ok(!bilag.includes('NaN') && !bilag.includes('undefined'), 'bilaget må ikke have huller');
  step('coach: bilaget indeholder de beregnede mål, og svaret vises');

  /* -------------------------------------------------------- mad-foto */
  await go('/food');
  const mealChooser = page.waitForEvent('filechooser', { timeout: 8000 });
  await click('Fra galleri');
  await (await mealChooser).setFiles(imagePath);
  await page.waitForTimeout(5000);

  assert.ok((await text()).includes('Kyllingebryst (150 g)'), 'de genkendte varer skal vises');
  assert.equal(await inputs().nth(0).inputValue(), MEAL.titel);
  assert.equal(await inputs().nth(1).inputValue(), '530');

  const meal = calls.at(-1);
  assert.equal(meal.output_config.format.type, 'json_schema');
  assert.equal(meal.messages[0].content[0].type, 'image');
  assert.equal(meal.messages[0].content[0].source.media_type, 'image/jpeg');
  assert.ok(meal.messages[0].content[0].source.data.length > 500, 'billedet skal med som base64');

  await click('Gem i dagbogen');
  await page.waitForTimeout(1500);
  assert.ok((await text()).includes('530 kcal'), 'måltidet skal tælle med i dagen');
  step('mad: billedet analyseres, felterne udfyldes og måltidet gemmes');

  /* ------------------------------------------------------ tilbudsavis */
  await go('/catalog');
  await click('365discount');
  const catalogChooser = page.waitForEvent('filechooser', { timeout: 8000 });
  await click('Fra galleri');
  await (await catalogChooser).setFiles(imagePath);
  await page.waitForTimeout(1500);
  await click('Læs 1 side');
  await page.waitForTimeout(4000);

  let body = (await text()).toLowerCase();
  assert.ok(body.includes('4 tilbud fundet'), 'tilbuddene skal vises');
  assert.ok(body.includes('25,00 kr.'), 'prisen skal vises i kroner');

  await click('Gem tilbuddene');
  await page.waitForTimeout(1500);
  body = (await text()).toLowerCase();
  assert.ok(body.includes('uge 36'), 'avisen skal ligge på listen');
  step('tilbudsavis: siderne læses, og tilbuddene gemmes lokalt');

  /* ---------------------------------------------------------- madplan */
  await go('/mealplan');
  await click('Generér madplan');
  await page.waitForTimeout(4000);
  const plan = await text();
  assert.ok(plan.includes('Kylling med ris og broccoli'), 'planen skal vises');
  assert.ok(plan.includes('På tilbud: Kyllingebryst, Broccoli'), 'tilbud skal krediteres');
  assert.ok(plan.toLowerCase().includes('indkøbsliste'), 'indkøbslisten skal vises');

  const planCall = calls.at(-1);
  assert.ok(planCall.messages[0].content.includes('365discount'), 'tilbuddene skal med i kaldet');
  assert.ok(/\d{4} kcal/.test(planCall.messages[0].content), 'kaloriemålet skal med i kaldet');
  step('madplan: bygget på de gemte tilbud og på kaloriemålet');

  console.log(`\n${results.length}/${results.length} trin bestået — ${calls.length} kald opsnappet`);
} catch (err) {
  console.error('\nFEJL:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
