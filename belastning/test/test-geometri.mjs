/* Test af geometrisk aflæsning af en indretningstegning.
   Kør: node --experimental-strip-types belastning/test/test-geometri.mjs

   Siden herunder efterligner plantegningen fra Rask Mølle: samme rum og arealer,
   samme møbelkoder (EGM 600x1200, LDF 0,9 1020x845, CLS3760) og samme måltal
   (2.149, 1.400, 800). Skalaen er 1:100, dvs. 1 tegningsenhed = 35,28 mm. */

import { byggKalkule, findSkala, findRum, findLoeb, laesModulkode, maaltalTilMm, kalkuleTilForbrugere } from '../engine/geometri.ts';
import { fletMedSkabelon } from '../engine/tegning.ts';
import { beregn } from '../engine/beregning.ts';
import { KATALOG } from '../engine/data.ts';

let fejl = 0;
const tjek = (navn, faktisk, forventet, tol = 0) => {
  const ok = typeof forventet === 'number' ? Math.abs(faktisk - forventet) <= tol : faktisk === forventet;
  if (!ok) fejl++;
  console.log(`${ok ? '  ok' : 'FEJL'}  ${navn}: ${typeof faktisk === 'number' ? faktisk.toFixed(2) : faktisk}${ok ? '' : `  (forventet ${forventet} ±${tol})`}`);
};

const MM_PR_ENHED = 25.4 / 72 * 100;          // 1:100 → 35,28 mm pr. punkt
const enh = (mm) => mm / MM_PR_ENHED;         // mm i virkeligheden → tegningsenheder

const tekst = (t, x, y, b = 30, h = 6) => ({ tekst: t, x, y, bredde: b, hoejde: h });
const rumEtiket = (navn, m2, x, y) => [tekst(navn, x, y + 10), tekst(`${m2} M2`, x, y)];
const maalkaede = (mm, x, y) => ({
  tekster: [tekst(String(mm >= 1000 ? `${Math.floor(mm / 1000)}.${String(mm % 1000).padStart(3, '0')}` : mm), x + enh(mm) / 2 - 8, y + 4, 16, 5)],
  streger: [{ x1: x, y1: y, x2: x + enh(mm), y2: y }],
});

const maal = [maalkaede(2149, 100, 40), maalkaede(1400, 300, 40), maalkaede(2000, 100, 80), maalkaede(800, 400, 80), maalkaede(600, 500, 80)];

const egmRaekke1 = Array.from({ length: 6 }, (_, i) => tekst('EGM 600x1200 sort', 200 + i * enh(600), 300));
const egmRaekke2 = Array.from({ length: 4 }, (_, i) => tekst('EGM 600x1200 sort', 200 + i * enh(600), 400));
const ldf = Array.from({ length: 6 }, (_, i) => tekst('LDF 0,9 1020x845', 500 + i * enh(1020), 250));
const impuls = Array.from({ length: 5 }, (_, i) => tekst('Impulskøler', 120 + i * enh(600), 180));
const cls = Array.from({ length: 4 }, (_, i) => tekst('CLS3760', 700, 200 + i * enh(1200)));

const side = {
  nr: 1, bredde: 1200, hoejde: 800,
  tekster: [
    tekst('DAGLI’BRUGSEN RASK MØLLE — INDRETNINGSPLAN 1:100', 40, 760, 260),
    ...maal.flatMap((m) => m.tekster),
    ...rumEtiket('SALGSLOKALE', 688, 300, 500),
    ...rumEtiket('LAGER', 97, 800, 200),
    ...rumEtiket('DELI', 45, 600, 120),
    ...rumEtiket('FROST', 16, 850, 120),
    ...rumEtiket('KØL', 16, 900, 120),
    ...rumEtiket('MEJERIKØL', 13, 950, 300),
    ...rumEtiket('PERSONALERUM', 15, 1000, 400),
    ...rumEtiket('KONTOR', 13, 1050, 300),
    ...rumEtiket('TEKNIK', 19, 1100, 600),
    ...rumEtiket('FLASKERUM', 43, 150, 120),
    ...rumEtiket('VINDFANG', 13, 100, 700),
    ...egmRaekke1, ...egmRaekke2, ...ldf, ...impuls, ...cls,
    tekst('6', 200 + enh(600) * 3, 315, 6),      // modulantal skrevet på løbet
    tekst('4', 200 + enh(600) * 2, 415, 6),
    tekst('Kasselinje', 250, 150), tekst('Kasse', 300, 150), tekst('SCO', 350, 150),
    tekst('Hurtigport', 780, 160), tekst('Flaskeautomat', 160, 100),
  ],
  streger: [...maal.flatMap((m) => m.streger), { x1: 60, y1: 60, x2: 1150, y2: 60 }, { x1: 60, y1: 60, x2: 60, y2: 740 }],
};

/* ---------- 1. Skala ---------- */
console.log('— Skala —');
tjek('måltal 2.149 → mm', maaltalTilMm('2.149'), 2149);
tjek('måltal 800 → mm', maaltalTilMm('800'), 800);
tjek('rumareal er ikke et måltal', maaltalTilMm('688'), 688);
const skala = findSkala(side, { navn: 'SALGSLOKALE', m2: 688 });
console.log(`      ${skala.forklaring}`);
skala.kontrol.forEach((k) => console.log(`      kontrol: ${k.metode} → ${k.mmPrEnhed.toFixed(2)} mm/enhed (${k.afvigelsePct.toFixed(1)} %)`));
tjek('skala fundet ved målkæde', skala.metode, 'målkæde');
tjek('mm pr. enhed', skala.mmPrEnhed, MM_PR_ENHED, 0.5);
tjek('målestok bekræfter målkæden', skala.kontrol.some((k) => k.metode.startsWith('målestok') && Math.abs(k.afvigelsePct) < 5), true);
tjek('tillid over 0,8', skala.tillid > 0.8, true);

/* ---------- 2. Rum ---------- */
console.log('\n— Rum —');
const rum = findRum(side);
console.log(`      ${rum.length} rum fundet: ${rum.map((r) => `${r.navn} ${r.arealM2} m²`).join(' · ')}`);
tjek('salgslokale genkendt', rum.find((r) => r.rumtype === 'salgslokale')?.arealM2, 688);
tjek('frostrum genkendt', rum.find((r) => r.rumtype === 'frost')?.arealM2, 16);
tjek('mejerikøl skelnes fra køl', rum.find((r) => r.rumtype === 'mejerikøl')?.arealM2, 13);

/* ---------- 3. Møbelløb ---------- */
console.log('\n— Møbelløb —');
tjek('modulkode med mål', laesModulkode('EGM 600x1200 sort').breddeM, 0.6);
tjek('CLS med løbslængde', laesModulkode('CLS3760').loebLaengdeM, 3.76);
const loeb = findLoeb(side, skala, rum);
loeb.forEach((l) => console.log(`      ${l.familie}: ${l.antal} stk · ${l.laengdeM.toFixed(2)} m · tillid ${l.tillid.toFixed(2)} — ${l.forklaring}`));
tjek('EGM-række 1 talt til 6', loeb.filter((l) => l.familie === 'EGM').some((l) => l.antal === 6), true);
tjek('LDF-løb ca. 6,1 m', loeb.find((l) => l.familie === 'LDF')?.laengdeM, 6.12, 0.7);
tjek('rumetiket blev ikke til møbel', loeb.some((l) => l.kode.includes('M2')), false);

/* ---------- 4. Kalkuleret ark ---------- */
console.log('\n— Kalkuleret ark —');
const kalkule = byggKalkule(side, { navn: 'SALGSLOKALE', m2: 688 });
console.log(`      ${kalkule.linjer.length} linjer · ${kalkule.samletKw.toFixed(1)} kW (${kalkule.samletKwUdenFallback.toFixed(1)} kW uden grove afdelingstal) · vægtet tillid ${kalkule.gennemsnitligTillid}`);
console.log('      ' + 'Grundlag'.padEnd(15) + 'Beskrivelse'.padEnd(52) + 'Mål'.padEnd(26) + 'Nøgletal'.padEnd(12) + 'kW');
kalkule.linjer.slice().sort((a, b) => b.kw - a.kw).slice(0, 12).forEach((l) => {
  console.log('      ' + l.grundlag.padEnd(15) + l.beskrivelse.slice(0, 50).padEnd(52) + l.maal.padEnd(26) + l.noegletal.padEnd(12) + l.kw.toFixed(2));
});
kalkule.advarsler.forEach((a) => console.log(`      advarsel: ${a}`));
tjek('kalkule har linjer', kalkule.linjer.length > 12, true);
tjek('samlet effekt i rimeligt leje', kalkule.samletKw > 40 && kalkule.samletKw < 130, true);
tjek('stamdata: salgsareal', kalkule.stamdataForslag.salgsAreal, 688);
tjek('stamdata: tilvalg fundet', kalkule.stamdataForslag.tilvalg.includes('centralkoel'), true);
tjek('hver linje har forklaring', kalkule.linjer.every((l) => l.forklaring.length > 10), true);
tjek('CLS regnes ikke som både køl og frost', kalkule.linjer.filter((l) => l.beskrivelse.includes('CLS') && l.beskrivelse.includes('Centralanlæg')).length, 1);
tjek('fallback holdes ude af nettosummen', kalkule.samletKw > kalkule.samletKwUdenFallback, true);

/* ---------- 5. Videre til beregning ---------- */
console.log('\n— Fra tegning til hovedtavle —');
const stam = {
  butiksType: 'Dagli’Brugsen', kasser: 2, sco: 1, ventilationKoelKw: 27,
  salgsAreal: 688, lagerAreal: 140, ovrigtAreal: 60, tilvalg: ['deli', 'bakeoff', 'centralkoel', 'varmepumpe', 'flaskeautomat'],
  ...kalkule.stamdataForslag,
};
const fraTegning = kalkuleTilForbrugere(kalkule, KATALOG, stam);
const flettet = fletMedSkabelon(fraTegning, stam, KATALOG, { overtagKw: true });
const res = beregn(stam, flettet);
console.log(`      ${fraTegning.length} forbrugere fra tegningen · ${flettet.length} rækker i alt`);
console.log(`      installeret ${res.instKw.toFixed(1)} kW · belastet ${res.belKw.toFixed(1)} kW · maks. fase ${res.balance.maxA.toFixed(0)} A`);
console.log(`      ${res.anbefaling.begrundelse}`);
tjek('beregning kører på tegningsdata', res.balance.maxA > 50, true);
tjek('tegningsrækker er markeret med kilde', fraTegning.every((f) => f.kilde === 'Tegning'), true);

console.log(`\n${fejl === 0 ? 'Alle tjek passerede.' : `${fejl} tjek fejlede.`}`);
process.exit(fejl ? 1 : 0);
