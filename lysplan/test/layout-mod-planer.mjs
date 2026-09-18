/* Skinnelayoutet holdt op mod de rigtige SJOC-planer.
   Målt i 365 Discount Kalundborg (1:100) og Kvickly Hvidovre:
     - skinnen ligger i gangen mellem to møbelrækker, ikke oven på møblet
     - armaturerne sidder 3,0-3,5 m fra hinanden på skinnen
     - Kalundborg: 812 m² salgsareal, 268 m skinne, 79 Bricks  →  0,33 m/m², 10,3 m²/Bricks
*/
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fejl = []; page.on('pageerror', e => fejl.push(e.message));
await page.goto(process.env.LYSPLAN_URL || 'http://127.0.0.1:8123/index.html');
await page.setInputFiles('#fil-tegning', './test/butik.dxf');
await page.waitForFunction(() => state.inventar.length > 0, null, { timeout: 30000 });
await page.evaluate(() => {
  const m = state.pxPerMeter;
  state.zoner = [{ id: nyId(), type:'salg', navn:'Salgsareal', maalLux: 700,
    pts: [[0,0],[40*m,0],[40*m,20*m],[0,20*m]] }];
  opdater(); generer();
});

const r = await page.evaluate(() => {
  const b = beregn();
  const m = state.pxPerMeter;
  const areal = 800;
  const skinner = state.skinner.filter(s => s.auto);
  const bricks = state.armaturer.filter(a => a.auto && a.type === state.indst.primaer);

  // 1. ligger skinnerne i gangen? mål fra skinnemidten til nærmeste møbel
  const tilMøbel = [];
  for (const s of skinner) {
    const midt = [(s.pts[0][0]+s.pts[1][0])/2, (s.pts[0][1]+s.pts[1][1])/2];
    let bedst = Infinity;
    for (const i of state.inventar) {
      const pr = Geom.projectOnPolyline(midt, [
        [i.centrum[0]-Math.cos(i.vinkel)*i.laengde*m/2, i.centrum[1]-Math.sin(i.vinkel)*i.laengde*m/2],
        [i.centrum[0]+Math.cos(i.vinkel)*i.laengde*m/2, i.centrum[1]+Math.sin(i.vinkel)*i.laengde*m/2]]);
      if (pr) bedst = Math.min(bedst, pr.afstand/m - i.dybde/2);
    }
    if (isFinite(bedst)) tilMøbel.push(+bedst.toFixed(2));
  }
  tilMøbel.sort((a,b)=>a-b);

  // 2. afstand mellem Bricks på samme skinne
  const pr = {};
  for (const a of bricks) (pr[a.skinneId] = pr[a.skinneId] || []).push(a);
  const afst = [];
  for (const s of skinner) {
    const liste = (pr[s.id]||[]).map(a => Geom.dist(s.pts[0],[a.x,a.y])).sort((x,y)=>x-y);
    for (let i=0;i<liste.length-1;i++) afst.push(+( (liste[i+1]-liste[i])/m ).toFixed(2));
  }
  afst.sort((a,b)=>a-b);

  const skinneM = skinner.reduce((a,s)=>a+Geom.polylineLength(s.pts)/m, 0);
  return {
    lux: Math.round(b.zoner[0].lux), grund: Math.round(b.zoner[0].luxGrund), krav: b.zoner[0].krav,
    spots: state.armaturer.filter(a=>a.auto && a.type!==state.indst.primaer).length,
    skinner: skinner.length, iGang: skinner.filter(s=>s.iGang).length,
    skinneM: Math.round(skinneM), bricks: bricks.length,
    mPrM2: +(skinneM/areal).toFixed(3), m2PrBricks: +(areal/bricks.length).toFixed(1),
    afstandMedian: afst.length ? afst[afst.length>>1] : null,
    afstandP10: afst.length ? afst[Math.floor(afst.length*0.1)] : null,
    afstandP90: afst.length ? afst[Math.floor(afst.length*0.9)] : null,
    iGangMedian: tilMøbel.length ? tilMøbel[tilMøbel.length>>1] : null,
    ovenPåMøbel: tilMøbel.filter(d => d < 0.15).length
  };
});
console.log(r);

const tjek = [];
const ok = (b, t) => tjek.push((b ? 'OK   ' : 'FEJL ') + t);
ok(r.ovenPåMøbel === 0, `ingen skinne oven på et møbel (fandt ${r.ovenPåMøbel})`);
ok(r.iGangMedian >= 0.4, `skinnen står frit i gangen: median ${r.iGangMedian} m til nærmeste møbelkant`);
ok(r.afstandMedian >= 2.7 && r.afstandMedian <= 3.7, `armaturafstand ${r.afstandMedian} m (planerne: 3,0-3,5)`);
ok(r.afstandP10 >= 2.2, `tætteste armaturer ${r.afstandP10} m (mindst 2,2)`);
ok(r.afstandP90 <= 4.4, `spredteste armaturer ${r.afstandP90} m (højst 4,4)`);
ok(r.mPrM2 >= 0.22 && r.mPrM2 <= 0.45, `${r.mPrM2} m skinne pr. m² (Kalundborg: 0,33)`);
ok(r.m2PrBricks >= 7 && r.m2PrBricks <= 14, `${r.m2PrBricks} m² pr. Bricks (Kalundborg: 10,3)`);
ok(r.grund >= r.krav*0.98 && r.grund <= r.krav*1.10, `grundbelysning ${r.grund} lux mod krav ${r.krav}`);
ok(r.lux <= r.krav*1.30, `med accentspots ${r.lux} lux (højst 30 % over kravet)`);
console.log(tjek.join('\n'));
console.log(tjek.some(t=>t.startsWith('FEJL')) ? '>> LAYOUT AFVIGER FRA PLANERNE' : '>> layoutet følger planerne');
console.log('fejl:', fejl);
await browser.close();
