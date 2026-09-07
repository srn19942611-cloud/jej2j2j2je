/* Regressionstest af motoren mod referencesagen Rask Mølle.
   Kør: node --experimental-strip-types belastning/test/test-beregning.mjs */
import { beregn, genererForbrugerliste } from '../engine/beregning.ts';
import { optaellingTilForbrugere, stamdataFraRum, fletMedSkabelon, daekningsgrad } from '../engine/tegning.ts';
import { KATALOG, BUTIKSTYPER, REFERENCESAGER } from '../engine/data.ts';

let fejl = 0;
const tjek = (navn, faktisk, forventet, tolerance = 0) => {
  const ok = typeof forventet === 'number' ? Math.abs(faktisk - forventet) <= tolerance : faktisk === forventet;
  if (!ok) fejl++;
  console.log(`${ok ? '  ok' : 'FEJL'}  ${navn}: ${typeof faktisk === 'number' ? faktisk.toFixed(1) : faktisk}${ok ? '' : `  (forventet ${forventet} ±${tolerance})`}`);
};

/* --- 1. Skabelon: Dagli'Brugsen på 688 m² som Rask Mølle --- */
const type = BUTIKSTYPER.find((b) => b.navn === 'Dagli’Brugsen');
const stam = {
  butiksType: type.navn, butiksNavn: 'Dagli’Brugsen Rask Mølle',
  salgsAreal: 688, lagerAreal: 97, ovrigtAreal: 60, kasser: 2, sco: 1,
  tilvalg: [...type.tilvalg, 'slagter'], ventilationKoelKw: 27, metode: 'A', ikHoved: 10,
};
const liste = genererForbrugerliste(stam, KATALOG);
const r = beregn(stam, liste);

console.log('\n— Skabelon, Dagli’Brugsen 688 m² med slagter —');
tjek('antal forbrugerrækker', liste.length, 75, 6);
tjek('installeret kW', r.instKw, 235, 25);
tjek('samtidig belastning kW', r.belKw, 139, 15);
tjek('maks. fasestrøm A', r.balance.maxA, 222, 25);
tjek('faseskævhed %', r.balance.skaevhedPct, 0, 3);
tjek('anbefalet hovedsikring A', r.anbefaletHovedsikring, 315, 65);
tjek('grupper i alt', r.antalGrupper, 70, 15);
tjek('nødforsyning A ≤ 125', r.noedA < 125, true);
tjek('komfortkøl behov kW', r.komfortkoel.anbefalet, 20, 6);
console.log(`      referenceinterval fra målinger: ${r.noegletal.referenceA[0].toFixed(0)}–${r.noegletal.referenceA[1].toFixed(0)} A`);
console.log(`      W/m² installeret ${r.noegletal.wPrM2Inst.toFixed(0)} · samlet DF ${r.noegletal.samletDf.toFixed(2)}`);

const refsag = REFERENCESAGER[0];
console.log(`      referencesag ${refsag.navn}: beregnet ${refsag.beregnetA} A, målt ${refsag.maaltPeakA}, valgt ${refsag.valgtHovedsikring} A`);
console.log('\n— Anbefalet ampererettighed —');
console.log(`      ${r.anbefaling.begrundelse}`);
tjek('foreslået rettighed tæt på Rask Mølles valg (200 A)', r.anbefaling.foreslaaetRettighed, 200, 50);
tjek('kabel/tavle dimensioneres efter beregning', r.anbefaling.dimensionerKabelOgTavleTil, r.anbefaletHovedsikring);

/* --- 2. Plantegning: optælling fra tegning 2251110-7 (Rask Mølle) --- */
const optaelling = {
  tegning: { titel: 'Dagli’Brugsen Rask Mølle', tegningsnr: '2251110-7' },
  rum: [
    { navn: 'SALGSLOKALE', areal_m2: 688, tillid: 0.97 }, { navn: 'LAGER', areal_m2: 97, tillid: 0.95 },
    { navn: 'DELI', areal_m2: 45, tillid: 0.9 }, { navn: 'FROST', areal_m2: 16, tillid: 0.9 },
    { navn: 'KØL', areal_m2: 16, tillid: 0.9 }, { navn: 'KØL', areal_m2: 8, tillid: 0.85 },
    { navn: 'MEJERIKØL', areal_m2: 13, tillid: 0.9 }, { navn: 'TEKNIK', areal_m2: 19, tillid: 0.9 },
    { navn: 'PERSONALERUM', areal_m2: 15, tillid: 0.9 }, { navn: 'KONTOR', areal_m2: 13, tillid: 0.9 },
    { navn: 'FLASKERUM', areal_m2: 43, tillid: 0.9 }, { navn: 'DEPOT', areal_m2: 6, tillid: 0.8 },
    { navn: 'VINDFANG', areal_m2: 13, tillid: 0.9 },
  ],
  moebler: [
    { kode: 'EGM 600x1200', antal: 14, tillid: 0.7 }, { kode: 'EGM 800x880', antal: 2, tillid: 0.7 },
    { kode: 'LDF 0,9 1020x845', antal: 6, tillid: 0.75 }, { kode: 'CLS 3760', antal: 8, tillid: 0.6 },
    { kode: 'Impulskøler', antal: 5, tillid: 0.8 }, { kode: 'Tobaksskab', antal: 2, tillid: 0.7 },
    { kode: 'Hurtigport', antal: 1, tillid: 0.95 }, { kode: 'Flaskeautomat', antal: 1, tillid: 0.9 },
    { kode: 'Fletkurv', antal: 4, tillid: 0.9 },
  ],
  maskinnumre: [
    { nummer: 'SL8', antal: 1, tillid: 0.9 }, { nummer: 'SL11', antal: 2, tillid: 0.9 },
    { nummer: 'SL12', antal: 1, tillid: 0.9 }, { nummer: 'SL15', antal: 1, tillid: 0.85 },
    { nummer: 'SL17', antal: 6, tillid: 0.8 }, { nummer: 'SL21', antal: 1, tillid: 0.85 },
    { nummer: 'SL23a', antal: 1, tillid: 0.85 }, { nummer: 'SL25', antal: 2, tillid: 0.9 },
    { nummer: 'SL31', antal: 1, tillid: 0.85 },
  ],
  kasser: { kasseborde: 2, sco: 1, tillid: 0.6 },
};

console.log('\n— Tegningsudtræk —');
const { patch } = stamdataFraRum(optaelling.rum);
tjek('salgsareal fra tegning', patch.salgsAreal, 688);
tjek('lagerareal fra tegning', patch.lagerAreal, 97);
tjek('tilvalg fundet', patch.tilvalg.join(','), 'deli,flaskeautomat');

const stam2 = { ...stam, ...patch, tilvalg: [...new Set([...stam.tilvalg, ...patch.tilvalg])] };
const { forbrugere, uafklarede } = optaellingTilForbrugere(optaelling, KATALOG, stam2);
console.log(`      ${forbrugere.length} forbrugere direkte fra tegning, ${uafklarede.length} koder til bekræftelse:`);
uafklarede.forEach((u) => console.log(`        · ${u.kode} ×${u.antal} → ${u.grund}${u.forslag ? ` (forslag: ${u.forslag})` : ''}`));

const flettet = fletMedSkabelon(forbrugere, stam2, KATALOG);
const d = daekningsgrad(flettet);
const r2 = beregn(stam2, flettet);
console.log(`      flettet liste: ${flettet.length} rækker, ${d.tegning} fra tegning (${d.pct.toFixed(0)} %)`);
tjek('flettet: maks. fasestrøm A', r2.balance.maxA, r.balance.maxA, 40);
tjek('flettet: alle rækker har kilde', flettet.every((f) => !!f.kilde), true);

/* --- 3. Kvalitetstjek --- */
console.log('\n— Kvalitetstjek —');
r2.tjek.forEach((t) => console.log(`  ${t.ok ? 'OK ' : (t.niveau === 'advarsel' ? '~~ ' : '!! ')} ${t.krav} → ${t.faktisk}`));
tjek('ingen fejlede krav (advarsler tilladt)', r2.tjek.filter((x) => !x.ok && x.niveau === 'krav').length, 0);

console.log(`\n${fejl === 0 ? 'Alle tjek passerede.' : `${fejl} tjek fejlede.`}`);
process.exit(fejl ? 1 : 0);
