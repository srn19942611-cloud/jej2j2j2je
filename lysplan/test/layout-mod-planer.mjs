/* Skinnelayoutet holdt op mod SJOC's rigtige lysplaner og byggeprogrammets
   eget eksempel. Se test/README.md for hele tabellen.

   Det der HOLDER på tværs af alle planer er meter skinne pr. armatur:
   2,56 - 3,39 m, median ca. 3,0. Det er kravet her.

   Det der IKKE holder er tætheden. Skinne pr. m² går fra 0,33 (365 Discount
   Kalundborg) til 0,545 (Brugsen Mønsted), og m² pr. Bricks fra 10,3 til 4,9
   - en faktor 2. Tætheden er en følge af butikkens form: en lille butik har
   forholdsvis meget vægring og mange smalle gange. En tidligere udgave af
   denne test låste tætheden til Kalundborgs tal alene og ville have afvist
   tre af de fem skinnebutikker. Den kontrolleres nu kun mod hele det
   observerede spænd, og står ellers som oplysning. */
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

  /* 3. ligger skinnen MIDT i gangen? Der måles på tværs af skinnen ni steder
        langs hver skinne. Gangen er som i Bilag 1 en facende møbelrække inden
        for 3 m; er der kun møbler til én side, er der ingen midte at måle, og
        den afstand føres i stedet som ensidet. skaev = |v-h|/(v+h), 0 = midt. */
  const VINDUE = 3.0;
  const skaevAlle = [], ensidetAlle = []; let påMøbel = 0;
  for (const s of skinner) {
    const a = s.pts[0], b2 = s.pts[s.pts.length-1];
    const v = Math.atan2(b2[1]-a[1], b2[0]-a[0]);
    const nx = -Math.sin(v), ny = Math.cos(v);
    const skæv = []; let fast = 0;
    for (let j=1;j<=9;j++) {
      const t=j/10, p=[a[0]+(b2[0]-a[0])*t, a[1]+(b2[1]-a[1])*t];
      let dv=Infinity, dh=Infinity, inde=false;
      for (const i of state.inventar) {
        if (i.laengde < 0.5) continue;
        const c=Math.cos(i.vinkel), sn=Math.sin(i.vinkel);
        const hl=i.laengde*m/2, hd=i.dybde*m/2;
        const dx=p[0]-i.centrum[0], dy=p[1]-i.centrum[1];
        const u=dx*c+dy*sn, w=-dx*sn+dy*c;
        if (Math.abs(u)>hl+m*0.2) continue;
        if (Math.abs(w)<=hd) { inde=true; continue; }
        const afst=(Math.abs(w)-hd)/m;
        if (afst > VINDUE) continue;
        if ((i.centrum[0]-p[0])*nx + (i.centrum[1]-p[1])*ny >= 0) dh=Math.min(dh,afst);
        else dv=Math.min(dv,afst);
      }
      if (inde) { fast++; continue; }
      if (isFinite(dv) && isFinite(dh)) skæv.push(Math.abs(dv-dh)/(dv+dh));
      else if (isFinite(dv) !== isFinite(dh)) ensidetAlle.push(isFinite(dv)?dv:dh);
    }
    if (fast >= 5) påMøbel++;
    if (skæv.length >= 3) { skæv.sort((x,y)=>x-y); skaevAlle.push(skæv[skæv.length>>1]); }
  }
  skaevAlle.sort((a,b)=>a-b); ensidetAlle.sort((a,b)=>a-b);

  const skinneM = skinner.reduce((a,s)=>a+Geom.polylineLength(s.pts)/m, 0);
  return {
    iGangMaalt: skaevAlle.length, fastPaaMoebel: påMøbel,
    skaevMedian: skaevAlle.length ? +skaevAlle[skaevAlle.length>>1].toFixed(3) : null,
    skaevP90: skaevAlle.length ? +skaevAlle[Math.floor(skaevAlle.length*0.9)].toFixed(3) : null,
    ensidetMedian: ensidetAlle.length ? +ensidetAlle[ensidetAlle.length>>1].toFixed(2) : null,
    ensidetMin: ensidetAlle.length ? +ensidetAlle[0].toFixed(2) : null,
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
// skinnen skal ligge MIDT imellem reoler og kølere - ikke bare et sted i gangen
ok(r.fastPaaMoebel === 0, `ingen skinne skærer gennem en møbelrække (fandt ${r.fastPaaMoebel})`);
ok(r.skaevMedian !== null && r.skaevMedian <= 0.15,
   `skinnen ligger midt i gangen: skævhed median ${r.skaevMedian} (0 = præcis midt, målt på ${r.iGangMaalt} skinner)`);
ok(r.skaevP90 === null || r.skaevP90 <= 0.35, `også de skæveste holder sig: P90 ${r.skaevP90}`);
ok(r.ensidetMin === null || r.ensidetMin >= 0.8,
   `står kun én række ud for skinnen, holdes gangafstanden: mindst ${r.ensidetMin} m, median ${r.ensidetMedian} m`);
ok(r.afstandMedian >= 2.5 && r.afstandMedian <= 3.5, `armaturafstand ${r.afstandMedian} m (planerne: 2,56-3,39)`);
ok(r.afstandP10 >= 2.2, `tætteste armaturer ${r.afstandP10} m (mindst 2,2)`);
ok(r.afstandP90 <= 3.8, `spredteste armaturer ${r.afstandP90} m (intet i planerne over 3,4)`);
// den bærende regel: meter skinne pr. armatur
const mPrBricks = +(r.skinneM / r.bricks).toFixed(2);
ok(mPrBricks >= 2.4 && mPrBricks <= 3.6,
   `${mPrBricks} m skinne pr. Bricks (planerne: 2,56-3,39, median 3,0)`);
// tætheden er en følge, ikke et mål - kun hele spændet kontrolleres
ok(r.mPrM2 >= 0.28 && r.mPrM2 <= 0.60,
   `${r.mPrM2} m skinne pr. m² (observeret spænd 0,33-0,545 – følger butikkens form)`);
ok(r.m2PrBricks >= 4.0 && r.m2PrBricks <= 12.0,
   `${r.m2PrBricks} m² pr. Bricks (observeret spænd 4,9-10,3 – følger butikkens form)`);
ok(r.grund >= r.krav*0.98 && r.grund <= r.krav*1.12, `grundbelysning ${r.grund} lux mod krav ${r.krav} – spots tæller ikke med`);
ok(r.lux <= r.krav*1.30, `med accentspots ${r.lux} lux (højst 30 % over kravet)`);
console.log(tjek.join('\n'));
console.log(tjek.some(t=>t.startsWith('FEJL')) ? '>> LAYOUT AFVIGER FRA PLANERNE' : '>> layoutet følger planerne');
console.log('fejl:', fejl);
await browser.close();
