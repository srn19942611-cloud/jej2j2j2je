/* Målestok læst af PDF'en selv.
   test/maalestok.pdf er en prøvetegning i 1:100 med et rektangel på
   12,0 x 7,0 m og en målkæde 4000 + 5000 + 3000 mm under den. Begge veje
   til målestokken skal give det samme:
     - "Målestok 1:100" i tegningshovedet
     - måltallene, hvor hvert tal står midt i sit eget stykke
*/
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
const fejl = []; page.on('pageerror', e => fejl.push(e.message));
await page.goto(process.env.LYSPLAN_URL || 'http://127.0.0.1:8123/index.html');
await page.evaluate(() => { window._toasts = []; const g = window.toast; window.toast = (t, s) => { window._toasts.push(t); return g(t, s); }; });
await page.setInputFiles('#fil-tegning', './test/maalestok.pdf');
await page.waitForFunction(() => state.lag.length > 0, null, { timeout: 60000 });
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const lag = state.lag[0];
  const skala = lag.img.width / 595;          // siden er 595 pt bred
  return {
    pxPerMeter: state.pxPerMeter ? +state.pxPerMeter.toFixed(2) : null,
    rasterSkala: +skala.toFixed(3),
    sidebredde_m: state.pxPerMeter ? +(lag.img.width / state.pxPerMeter).toFixed(2) : null,
    toasts: window._toasts.slice(-2)
  };
});
console.log(r);

// ved 1:100 fylder siden på 595 pt = 210 mm papir → 21,0 m
const tjek = [];
const ok = (b, t) => tjek.push((b ? 'OK   ' : 'FEJL ') + t);
ok(r.pxPerMeter !== null, 'målestokken blev fundet i PDF’en');
ok(r.sidebredde_m !== null && Math.abs(r.sidebredde_m - 21.0) < 0.3,
   `siden er ${r.sidebredde_m} m bred ved den fundne målestok (skal være 21,0)`);
ok(r.toasts.some(t => /1:100/.test(t)), 'målestok 1:100 blev læst af tegningshovedet');
ok(r.toasts.some(t => /måltal/.test(t)), 'måltallene på tegningen bekræftede den');
console.log(tjek.join('\n'));
console.log(tjek.some(t => t.startsWith('FEJL')) ? '>> MÅLESTOKKEN BLEV IKKE LÆST RIGTIGT' : '>> målestokken kom fra tegningen selv');
console.log('fejl:', fejl);
await browser.close();
