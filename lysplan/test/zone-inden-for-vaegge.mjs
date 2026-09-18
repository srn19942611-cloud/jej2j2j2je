/* Salgsarealet må aldrig række ud over bygningen.
   test/butik.dxf har sin ydervæg som en lukket polylinje på laget VAEGGE:
   et rektangel på 40,0 x 20,0 m. Zonen, værktøjet selv finder, skal ligge
   inden for den – med højst et par decimeters slør, fordi omridset lægges
   ud på et net og forenkles bagefter. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BYGNING = { x0: 0, y0: 0, x1: 40, y1: 20 };
const SLOER = 0.35;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fejl = []; page.on('pageerror', e => fejl.push(e.message));
await page.goto(process.env.LYSPLAN_URL || 'http://127.0.0.1:8123/index.html');
await page.setInputFiles('#fil-tegning', './test/butik.dxf');
await page.waitForFunction(() => state.inventar.length > 0, null, { timeout: 30000 });
await page.waitForTimeout(400);

const r = await page.evaluate(() => {
  // zonerne findes forfra, uden rumnavne, så det er møbel- og vægsporet der prøves
  state.zoner = [];
  findZonerITegning(true);
  const m = state.pxPerMeter;
  const lag = state.lag[0];
  const zoner = state.zoner.map(z => ({
    navn: z.navn,
    m2: +(Geom.polygonArea(z.pts) / (m * m)).toFixed(1),
    pts: z.pts.map(p => [ (p[0] - lag.x) / lag.skala / m, (p[1] - lag.y) / lag.skala / m ])
  }));
  return { zoner, vaegLinjer: vaegLinjer(state.lag.filter(l => l.slags === 'cad' && l.synlig)).length };
});

const alle = r.zoner.flatMap(z => z.pts);
const udenfor = alle.filter(([x, y]) =>
  x < BYGNING.x0 - SLOER || x > BYGNING.x1 + SLOER || y < BYGNING.y0 - SLOER || y > BYGNING.y1 + SLOER);
const værst = udenfor.reduce((a, [x, y]) => Math.max(a,
  Math.max(BYGNING.x0 - x, x - BYGNING.x1, BYGNING.y0 - y, y - BYGNING.y1)), 0);

console.log({
  zoner: r.zoner.map(z => `${z.navn}: ${z.m2} m² (${z.pts.length} punkter)`),
  vaegLinjer: r.vaegLinjer,
  punkter: alle.length, udenforBygningen: udenfor.length,
  værsteOverskridelse_m: +værst.toFixed(2)
});

const tjek = [];
const ok = (b, t) => tjek.push((b ? 'OK   ' : 'FEJL ') + t);
ok(r.zoner.length > 0, 'der blev fundet en zone');
ok(r.vaegLinjer > 0, `væggene blev fundet i tegningen (${r.vaegLinjer} stregstykker)`);
ok(udenfor.length === 0,
  `alle ${alle.length} punkter på zonen ligger inden for bygningen` +
  (udenfor.length ? ` – ${udenfor.length} ligger udenfor, værst ${værst.toFixed(2)} m` : ''));
const areal = r.zoner.reduce((a, z) => a + z.m2, 0);
ok(areal > 0 && areal <= 40 * 20,
  `zonearealet er ${areal.toFixed(0)} m² og overstiger ikke bygningens 800 m²`);
console.log(tjek.join('\n'));
console.log(tjek.some(t => t.startsWith('FEJL')) ? '>> ZONEN GÅR UDEN FOR BYGNINGEN' : '>> zonen holder sig inden for væggene');
console.log('fejl:', fejl);
await browser.close();
