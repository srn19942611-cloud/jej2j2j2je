/* Test af filindlæsning og feedbackloop.
   Kør: node --experimental-strip-types belastning/test/test-indlaesning.mjs
   Rækkerne herunder er kopieret fra de rigtige ark (slagter-maskinliste, FDB,
   og Mariannes gruppeskema), inkl. deres skrivemåder: "3 x 400", "0,78", "1*". */

import { genkendFiltype, matchKolonner, laesRaekker, parseTal, parseSpaending, indlaes } from '../engine/indlaesning.ts';
import { registrerRettelser, aggregerRettelser, anvendForslag, skaleringsforslag, kalibrer, udtraeksstatistik, faldgruberTilPrompt, laeringsstatus } from '../engine/laering.ts';
import { genererForbrugerliste } from '../engine/beregning.ts';
import { KATALOG } from '../engine/data.ts';

let fejl = 0;
const tjek = (navn, faktisk, forventet, tol = 0) => {
  const ok = typeof forventet === 'number' ? Math.abs(faktisk - forventet) <= tol : faktisk === forventet;
  if (!ok) fejl++;
  console.log(`${ok ? '  ok' : 'FEJL'}  ${navn}: ${faktisk}${ok ? '' : `  (forventet ${forventet})`}`);
};

const stam = {
  butiksType: 'Dagli’Brugsen', salgsAreal: 688, lagerAreal: 97, ovrigtAreal: 60,
  kasser: 2, sco: 1, tilvalg: ['deli', 'bakeoff', 'slagter', 'centralkoel', 'varmepumpe', 'flaskeautomat'],
};

/* ---------- 1. Maskinliste ---------- */
console.log('— Maskinliste (FDB-format) —');
const maskinliste = [
  ['Version: Maj 2018', 'Maskineliste/inventarliste'],
  ['Butik:Brugsen', '', '', 'Kardex nr.:'],
  ['Nr.', 'Maskintype', 'Leverandør', 'Model', 'Stk.', 'Spænding', 'kW', 'Amp', 'Varmt vand', 'Koldt vand', 'Bemærkninger'],
  ['SL7a', 'Kogebord glaskeramisk', 'Electrolux', '4 zoner', 1, '3 x 400', 9, 20, '', '', 'Emhætte/elstik'],
  ['SL11', 'Konvektions ovn', 'Coba/Electrolux', 'Dobbeltovn i rack', 2, '3 x 400', '11,1', 20, 'X', 'X', 'Emhætte'],
  ['SL12', 'Opvaske maskine', 'Jeros', '9110', 1, '3 x 400', '8,5', 13, 'x', 'X', 'Direkte aftræk'],
  ['SL21', 'Pakke dispenser/Pakkebord', 'Sibola', 'Pakkebord model 83', 1, '230', '0,78', 10, '', '', 'Varmeplade'],
  ['SL23a', 'Prismærker boks2', 'Digi', 'DPS 5602 M', 1, '230', '0,14', 10, '', '', 'Egen el. gruppe'],
  ['SL31', 'Pålægsmaskine', 'Myhrwold', 'Bizerba GSP H', 1, '230/400', '0,4', 10, '', '', ''],
  ['SL8', 'Stålbord', '', 'm ristehylde', 1, '', '', '', '', '', 'mobilt stålbord'],
  ['', 'Stikvogne', 'Ingvald', '', 10, '', '', '', '', '', ''],
];
tjek('filtype genkendt', genkendFiltype('Slagter_maskinliste.xls', maskinliste[2]), 'maskinliste');
const map1 = matchKolonner(maskinliste);
tjek('overskriftsrække fundet', map1.overskriftsraekke, 2);
tjek('kolonne kW fundet', map1.felter.kw, 6);
tjek('VVS-kolonner ignoreret', map1.felter.varmt === undefined, true);
tjek('dansk decimalkomma', parseTal('11,1'), 11.1);
tjek('enhed i celle', parseTal('16,5 kW'), 16.5);
tjek('3 x 400 → 400 V 3-faset', parseSpaending('3 x 400').faser, 3);
tjek('230/400 markeres tvetydig', parseSpaending('230/400').tillid, 0.5);

const res1 = indlaes('Slagter_maskinliste.xls', maskinliste, KATALOG, stam, 'Maskinliste');
const bundne = res1.bindinger.filter((b) => b.katalogId);
console.log(`      ${bundne.length} rækker bundet til katalog, ${res1.ubundne.length} ubundne, ${res1.konflikter.length} konflikter`);
tjek('SL11 bundet på maskinnummer', res1.bindinger.find((b) => b.raa.gruppe === 'SL11')?.katalogId, 'SL11');
tjek('SL11 antal fra ark', res1.bindinger.find((b) => b.raa.gruppe === 'SL11')?.forbruger.antal, 2);
tjek('SL8 stålbord uden el er ubundet', res1.ubundne.some((r) => r.gruppe === 'SL8'), true);
res1.konflikter.forEach((k) => console.log(`      konflikt: ${k.katalogId}.${k.felt} ${k.nuvaerende} → ${k.foreslaaet}${k.afvigelsePct !== null ? ` (${k.afvigelsePct.toFixed(0)} %)` : ''}`));
res1.advarsler.forEach((a) => console.log(`      advarsel: ${a}`));

/* ---------- 2. Gruppeskema (Mariannes format) ---------- */
console.log('\n— Gruppeskema —');
const gruppeskema = [
  ['Salgslokale', '', 'Antal', 'antal tegning', 'Spænding', 'kW', 'A', '', '1P+N C10', '1P+N C16', '3P+N C10', '3P+N C16', '3p+n c32', 'Noter'],
  ['BU5', 'Impulskøler', 20, 18, '230', '0,385', 16, 'Stikkontakt', '', '', '', 6, '', ''],
  ['BC7', 'Ovn', 1, '', '400', '5,8', 32, '', '', '', '', '', 2, ''],
  ['BU11', 'Tobaksskab', 11, 1, '230', '', 10, '', 1, '', '', '', '', ''],
];
const map2 = matchKolonner(gruppeskema);
tjek('gruppekolonner fundet', map2.gruppekolonner.length, 5);
tjek('3P+N C32 tolket', map2.gruppekolonner.find((g) => g.mcb === 32)?.faser, 3);
const raa2 = laesRaekker(gruppeskema, map2);
tjek('BU5: 6 grupper fra skema', raa2[0].grupperFraSkema[0].antal, 6);
tjek('BC7: 2 stk. 3P+N C32', raa2[1].grupperFraSkema[0].mcb, 32);

/* ---------- 3. Feedbackloop ---------- */
console.log('\n— Feedbackloop —');
const foreslaaet = genererForbrugerliste(stam, KATALOG);
const lavRettelser = (projektId, aendringer, salgsAreal = 688) => {
  const gemt = foreslaaet.map((f) => ({ ...f }));
  Object.entries(aendringer).forEach(([raekkeId, felter]) => {
    const r = gemt.find((g) => g.raekkeId === raekkeId);
    if (r) Object.assign(r, felter);
  });
  return registrerRettelser(foreslaaet, gemt, { ...stam, salgsAreal }, projektId, {
    'SL12.kw': 'datablad', 'BU5.antal': 'tegning', 'V1.kw': 'datablad',
  });
};
const alle = [
  ...lavRettelser('p1', { SL12: { kw: 9.5 }, BU5: { antal: 18 }, V1: { kw: 11 } }, 688),
  ...lavRettelser('p2', { SL12: { kw: 9.6 }, BU5: { antal: 16 }, V1: { kw: 10.5 } }, 640),
  ...lavRettelser('p3', { SL12: { kw: 9.4 }, BU5: { antal: 24 }, D1: { rcd: 'RCBO 30 mA' } }, 900),
  ...lavRettelser('p4', { BU5: { antal: 21 } }, 780),
];
console.log(`      ${alle.length} rettelser fanget fra 4 projekter`);
const forslag = aggregerRettelser(alle, KATALOG);
forslag.slice(0, 5).forEach((f) => console.log(`      [${f.anbefaling}] ${f.katalogId}.${f.felt}: ${f.nuvaerende} → ${f.foreslaaet} — ${f.begrundelse}`));
const opvask = forslag.find((f) => f.katalogId === 'SL12' && f.felt === 'kw');
tjek('opvask: forslag om ny kW-værdi', opvask.foreslaaet, 9.5, 0.15);
tjek('opvask: anbefales godkendt', opvask.anbefaling, 'godkend');
tjek('antal bliver ikke til katalogværdi', forslag.some((f) => f.felt === 'antal'), false);
tjek('enkeltstående rettelse afventer', forslag.find((f) => f.katalogId === 'D1')?.anbefaling, 'afvent');

const { katalog: nytKatalog, historik } = anvendForslag(KATALOG, opvask, 'stefan');
tjek('katalog opdateret', nytKatalog.find((k) => k.id === 'SL12').kw, 9.5, 0.15);
tjek('historik skrevet', historik.foer !== historik.efter, true);

const skala = skaleringsforslag(alle, KATALOG);
skala.forEach((s) => console.log(`      [${s.anbefaling}] ${s.katalogId} skalering: ${s.nuvaerende} → ${s.foreslaaet} m²/stk — ${s.begrundelse}`));
tjek('skaleringsforslag for impulskølere', skala.find((s) => s.katalogId === 'BU5') !== undefined, true);

const kal = kalibrer([
  { projekt: 'Rask Mølle', butikstype: 'Dagli’Brugsen', salgsAreal: 688, beregnetA: 241, maaltPeakA: 120 },
  { projekt: 'Søby', butikstype: 'Dagli’Brugsen', salgsAreal: 600, beregnetA: 205, maaltPeakA: 110 },
  { projekt: 'Dragør', butikstype: 'SuperBrugsen', salgsAreal: 1000, beregnetA: 290, maaltPeakA: 130 },
]);
console.log(`      kalibrering: faktor ${kal.faktor} · ${kal.aPrM2.min.toFixed(3)}–${kal.aPrM2.max.toFixed(3)} A/m² · ${kal.anbefaling}`);
tjek('kalibreringsfaktor under 1', kal.faktor < 1, true);
tjek('kalibrering pr. butikstype', Object.keys(kal.prButikstype).length, 2);

const stat = udtraeksstatistik([
  { kode: 'EGM 600x1200', laest: 14, bekraeftet: 14 }, { kode: 'EGM 600x1200', laest: 16, bekraeftet: 15 },
  { kode: 'EGM 600x1200', laest: 12, bekraeftet: 12 },
  { kode: 'Kasselinje', laest: 22, bekraeftet: 3 }, { kode: 'Kasselinje', laest: 18, bekraeftet: 4 },
  { kode: 'Kasselinje', laest: 12, bekraeftet: 3 },
]);
const faldgruber = faldgruberTilPrompt(stat);
faldgruber.forEach((f) => console.log(`      prompt-tilføjelse: ${f.trim()}`));
tjek('kasselinje udpeget som faldgrube', faldgruber.some((f) => f.includes('Kasselinje')), true);
tjek('EGM uden faldgrube', faldgruber.some((f) => f.includes('EGM')), false);

const status = laeringsstatus(alle, forslag, kal);
console.log(`      status: ${status.rettelser} rettelser · ${status.forslagKlar} forslag klar · ${status.maalinger} målinger · faktor ${status.kalibreringsfaktor}`);

console.log(`\n${fejl === 0 ? 'Alle tjek passerede.' : `${fejl} tjek fejlede.`}`);
process.exit(fejl ? 1 : 0);
