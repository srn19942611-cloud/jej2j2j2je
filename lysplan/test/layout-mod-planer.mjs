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
  // kun gangskinner har en gangmidte at ligge i; tværskinnerne krydser gangene
  for (const s of skinner.filter(x => !x.tvaers)) {
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

  /* 4. hænger skinnerne sammen i firkanter, og står to rækker side om side?

        Skinnerne er knuder, og to skinner har en kant imellem sig, når enden
        af den ene rører den anden. Antallet af uafhængige lukkede sløjfer i
        den graf er E - V + C (Eulers formel) - altså hvor mange firkanter
        layoutet faktisk danner. En stige af n gangskinner med en tværskinne i
        hver ende giver n-1 firkanter. */
  const TOL = m * 0.35;
  const rør = (a, b) => Geom.segmentsCross(a.pts[0], a.pts[a.pts.length-1], b.pts[0], b.pts[b.pts.length-1])
    || [a.pts[0], a.pts[a.pts.length-1]].some(p => {
      const pr = Geom.projectOnPolyline(p, b.pts);
      return pr && pr.afstand <= TOL;
    });
  const kanter = [];
  for (let i2 = 0; i2 < skinner.length; i2++)
    for (let j = i2+1; j < skinner.length; j++)
      if (rør(skinner[i2], skinner[j]) || rør(skinner[j], skinner[i2])) kanter.push([i2, j]);
  const far = skinner.map((_, k) => k);
  const find = k => far[k] === k ? k : (far[k] = find(far[k]));
  for (const [a, b] of kanter) far[find(a)] = find(b);
  const komponenter = new Set(skinner.map((_, k) => find(k))).size;
  const sløjfer = kanter.length - skinner.length + komponenter;
  const frie = skinner.filter(s2 => !skinner.some(o => o !== s2 && (rør(s2, o) || rør(o, s2)))).length;

  // mindste afstand mellem to rækker, der står ud for hinanden
  let naermesteRaekker = Infinity;
  for (let i2 = 0; i2 < skinner.length; i2++)
    for (let j = i2+1; j < skinner.length; j++) {
      const a = skinner[i2].pts, b = skinner[j].pts;
      const v1 = Math.atan2(a[a.length-1][1]-a[0][1], a[a.length-1][0]-a[0][0]);
      const v2 = Math.atan2(b[b.length-1][1]-b[0][1], b[b.length-1][0]-b[0][0]);
      let dv = Math.abs(((v1-v2) % Math.PI + Math.PI) % Math.PI);
      if (dv > Math.PI/2) dv = Math.PI - dv;
      if (dv > 0.25) continue;
      const c2 = Math.cos(v1), s2 = Math.sin(v1);
      const uu = p => p[0]*c2 + p[1]*s2, tt = p => -p[0]*s2 + p[1]*c2;
      const a0=Math.min(uu(a[0]),uu(a[a.length-1])), a1=Math.max(uu(a[0]),uu(a[a.length-1]));
      const b0=Math.min(uu(b[0]),uu(b[b.length-1])), b1=Math.max(uu(b[0]),uu(b[b.length-1]));
      if (Math.min(a1,b1) - Math.max(a0,b0) <= 0) continue;
      const d = Math.abs((tt(a[0])+tt(a[a.length-1]))/2 - (tt(b[0])+tt(b[b.length-1]))/2) / m;
      if (d < naermesteRaekker) naermesteRaekker = d;
    }

  const skinneM = skinner.reduce((a,s)=>a+Geom.polylineLength(s.pts)/m, 0);
  return {
    firkanter: sløjfer, komponenter, frieSkinner: frie,
    naermesteRaekker: isFinite(naermesteRaekker) ? +naermesteRaekker.toFixed(2) : null,
    gangskinner: skinner.filter(x=>!x.tvaers).length,
    tvaerskinner: skinner.filter(x=>x.tvaers).length,
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
// skinnerne skal som udgangspunkt hænge sammen i firkanter
ok(r.firkanter >= 1, `skinnerne danner ${r.firkanter} lukkede firkanter`);
ok(r.frieSkinner === 0, `ingen skinne hænger frit for sig selv (fandt ${r.frieSkinner})`);
ok(r.komponenter <= 2, `skinnerne hænger sammen i ${r.komponenter} net`);
// og to rækker må ikke stå side om side
ok(r.naermesteRaekker === null || r.naermesteRaekker >= 1.8,
   `nærmeste to rækker står ${r.naermesteRaekker} m fra hinanden (mindst 1,8)`);
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
