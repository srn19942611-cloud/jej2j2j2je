/* Genkendelsen holdt op mod tegningens egne tal.

   Prøvebutikken butik.dxf er syntetisk. Det, der tæller, er en rigtig
   inventarplan, og den bærer sit eget facit: styklisten i tegningshovedet
   ("Alm. fag: 152 ...") og møbelteksterne med længde ("SANTIAGO LF 95 7500 G",
   "250+ende - Frost"). Testen læser tegningen, finder inventar og salgsareal,
   og måler mod dét - pr. type.

   Tegningen er kundens og ligger ikke i repoet. Kør med
     LYSPLAN_TEGNING=sti/til/plan.dwg  (eller .dxf)
   Uden den springes testen over, og det siges højt. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const sti = process.env.LYSPLAN_TEGNING;
if (!sti || !fs.existsSync(sti)) {
  console.log('SPRUNGET OVER: sæt LYSPLAN_TEGNING til en inventarplan (DWG/DXF) med stykliste i tegningshovedet');
  process.exit(0);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const fejl = []; page.on('pageerror', e => fejl.push(e.message));
await page.goto(process.env.LYSPLAN_URL || 'http://127.0.0.1:8123/index.html');
await page.setInputFiles('#fil-tegning', sti);
await page.waitForFunction(() => state.lag.length > 0 && state.inventar.length > 0, null, { timeout: 600000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { state.zoner = []; findZonerITegning(true); });

const r = await page.evaluate(() => {
  const facit = tegningensFacit();
  const salg = state.zoner.filter(z => z.type === 'salg').sort((a, b) => Geom.polygonArea(b.pts) - Geom.polygonArea(a.pts))[0];
  const inde = i => salg && Geom.pointInPolygon(i.centrum, salg.pts);
  const iSalg = state.inventar.filter(inde);
  const st = Inventar.stykliste(iSalg, state.indst.fagbredde);
  const tekster = state.lag[0].tegning.tekster.map(t => t.t);
  // møbler, hvis tekst eller blok selv siger, at de er kolde - kølere og frost
  const kold = /lisbona|santiago|toronto|malm[öo]|frost|k[øo]l\b|k[øo]ler|koel/i;
  const navngivne = state.inventar.filter(i => kold.test((i.tekst || '') + ' ' + (i.blok || '')) && !/to-?heat|varm/i.test(i.tekst || ''));
  const kilder = {};
  for (const i of state.inventar) kilder[i.bestemtAf] = (kilder[i.bestemtAf] || 0) + 1;
  return {
    facit, fejlTekster: null,
    salg: salg ? { areal: +(Geom.polygonArea(salg.pts) / state.pxPerMeter ** 2).toFixed(0), fraVaegge: !!salg.fraVaegge, punkter: salg.pts.length } : null,
    fremmedeRum: (state.diagnose && state.diagnose.salgsarealVaegge && state.diagnose.salgsarealVaegge.fremmedeRum) || [],
    moebler: state.inventar.length, iSalg: iSalg.length,
    fag: st.fagIAlt, meterKoel: +st.meterKoel.toFixed(1), meterFrost: +st.meterFrost.toFixed(1), meterReol: +st.meterReol.toFixed(1),
    /* Fag tælles i to bunker: dem motoren er sikker på (blok, lag, tekst), og
       dem der er gæt på formen. Facit sammenlignes med de sikre - gættene
       vises gult i værktøjet og er brugerens at afgøre. */
    fagSikre: Inventar.stykliste(iSalg.filter(i => (i.sikkerhed || 0) >= 0.7), state.indst.fagbredde).fagIAlt,
    fagUsikre: Inventar.stykliste(iSalg.filter(i => (i.sikkerhed || 0) < 0.7), state.indst.fagbredde).fagIAlt,
    endegavle: iSalg.filter(i => i.type === 'endegavl').length,
    bakeOffFag: iSalg.filter(i => i.type === 'broed').reduce((a, i) => a + (i.fag || 0), 0),
    koelNavne: state.inventar.filter(i => i.type === 'koel' && (i.blok || i.tekst)).length,
    kolde: navngivne.filter(i => /koel|frost/.test(i.type)).length, navngivne: navngivne.length,
    ikkeKolde: navngivne.filter(i => !/koel|frost/.test(i.type)).map(i => `${i.type}/${i.bestemtAf} ${i.blok || ''} "${i.tekst || ''}"`),
    usikre: state.inventar.filter(i => i.kilde === 'cad' && (i.sikkerhed || 0) < 0.7).length,
    kilder
  };
});
console.log(r);

const tjek = [];
const ok = (b, t) => tjek.push((b ? 'OK   ' : 'FEJL ') + t);
ok(!!r.facit, `tegningens egen stykliste blev læst${r.facit ? ': ' + JSON.stringify(r.facit) : ''}`);
if (r.facit && r.facit.fag) ok(Math.abs(r.fagSikre - r.facit.fag) <= r.facit.fag * 0.1, `${r.fagSikre} sikre fag fundet i salgsarealet mod tegningens ${r.facit.fag} (±10 %) – dertil ${r.fagUsikre} fag, der er gæt på formen`);
if (r.facit && r.facit.endemoduler != null) ok(Math.abs(r.endegavle - r.facit.endemoduler) <= 2, `${r.endegavle} endegavle mod tegningens ${r.facit.endemoduler} (±2)`);
if (r.facit && r.facit.bakeOffFag != null) ok(Math.abs(r.bakeOffFag - r.facit.bakeOffFag) <= 1, `${r.bakeOffFag} bake-off-fag mod tegningens ${r.facit.bakeOffFag} (±1)`);
ok(r.navngivne > 0 && r.kolde === r.navngivne, `alle ${r.navngivne} møbler med et kølenavn i tekst eller blok er køl eller frost (${r.kolde}${r.ikkeKolde.length ? ' – ikke: ' + r.ikkeKolde.join('; ') : ''})`);
if (r.facit && r.facit.fag) ok(r.meterFrost > 0, `der er frost i salgsarealet (${r.meterFrost} m)`);
ok(r.salg && r.salg.fraVaegge, `salgsarealet er rummet, væggene danner (${r.salg ? r.salg.areal + ' m²' : 'ingen zone'})`);
ok(r.fremmedeRum.length === 0, `ingen lager-, kontor- eller personaletekst inde i salgsarealet (${r.fremmedeRum.join(', ') || 'ingen'})`);
ok(r.iSalg >= r.moebler * 0.6, `${r.iSalg} af ${r.moebler} møbler står i salgsarealet`);
ok(r.usikre <= r.moebler * 0.15, `${r.usikre} af ${r.moebler} møbler er gæt på formen (højst 15 %)`);
console.log(tjek.join('\n'));
console.log(tjek.some(t => t.startsWith('FEJL')) ? '>> GENKENDELSEN AFVIGER FRA TEGNINGEN' : '>> genkendelsen passer med tegningens egne tal');
console.log('fejl:', fejl);
await browser.close();
