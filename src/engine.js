/* Lag 1 og 2: detektorer der finder symptomer, og sagsbyggeren der samler dem.
 *
 * Opdelingen er bevidst. En detektor må sige "restposten er 74 % af forbruget".
 * Den må ikke sige "der mangler en bimåler" — det er en diagnose, og den stilles
 * først, når signaler fra flere kilder er lagt sammen i en sag.
 *
 * Alt beløbsregning sker her i kode med en metodetekst, der følger med sagen,
 * så tallet kan efterprøves. Ingen sprogmodel skønner kroner.
 */

import { FG, fgNavn, DETEKTORER } from './taxonomy.js';

export const FORUDSAETNINGER = {
  elpris: 0.77,      // kr/kWh
  varmepris: 0.65,   // kr/kWh
  vandpris: 55,      // kr/m3
  restpostGraense: 30,       // % restpost der udløser sag
  natandelGraense: 42,       // % af døgnforbrug i lukketimer
  benchmarkGraense: 1.40,    // faktor over kædens median
  springGraense: 18,         // % år-til-år stigning
  daekningForbehold: 70,     // % målt data der giver forbehold
  daekningMinimum: 50,       // % under dette oprettes sagen ikke
};

let signalSeq = 0;
const nyId = (p) => `${p}-${String(++signalSeq).padStart(4, '0')}`;

/* ---- Lag 1 · detektorer ---------------------------------------------------
 * Hver detektor tager porteføljedata ind og lægger signaler ud. Et signal
 * bærer detektor, version, anlæg, periode, styrke, evidens og datadækning.
 */

/** D-03 · Bimålersum mod hovedmåler. Restposten er ikke et spild, men et blindt punkt. */
export function detektorRestpost(butikker, { restpostGraense } = FORUDSAETNINGER) {
  const ud = [];
  for (const b of butikker) {
    if (!b.kwhAar || b.daekningPct == null) continue;
    // Er der slet ingen bimåling, er det D-04's sag — ikke to sager om det samme.
    if (b.daekningPct === 0) continue;
    const rest = 100 - b.daekningPct;
    if (rest <= restpostGraense) continue;
    const restKwh = Math.round(b.kwhAar * rest / 100);
    ud.push({
      id: nyId('SIG'), detektor: 'D-03', version: '1.0', butiksnummer: b.butiksnummer,
      anlaeg: 'Elmålerhierarki', faggruppe: 'oevrigt',
      periode: '2025-09 – 2026-08', styrke: Math.min(1, rest / 100),
      symptom: `Restposten er ${rest} % af butikkens el. ${fmtKwh(restKwh)} kWh/år kan ikke henføres til et målepunkt.`,
      evidens: [
        ['Forsyningsmåler, år', `${fmtKwh(b.kwhAar)} kWh`],
        ['Sum af bimålere', `${fmtKwh(b.kwhAar - restKwh)} kWh (${b.daekningPct} %)`],
        ['Restpost', `${fmtKwh(restKwh)} kWh (${rest} %)`],
      ],
      datadaekning: b.daekningPct,
      maaleenhed: { kwh: restKwh, klasse: 'blindt' },
    });
  }
  return ud;
}

/** D-05 · Benchmark pr. m². Peer-gruppen er kæden — ikke hele porteføljen. */
export function detektorBenchmark(butikker, { benchmarkGraense, elpris } = FORUDSAETNINGER) {
  const medianer = medianPrKaede(butikker);
  const ud = [];
  for (const b of butikker) {
    const median = medianer[b.kaede];
    if (!median || !b.kwhPrM2 || !b.salgsareal_m2) continue;
    if (b.kwhPrM2 < median * benchmarkGraense) continue;
    const merKwh = Math.round((b.kwhPrM2 - median) * b.salgsareal_m2);
    const pct = Math.round(100 * (b.kwhPrM2 - median) / median);
    ud.push({
      id: nyId('SIG'), detektor: 'D-05', version: '1.0', butiksnummer: b.butiksnummer,
      anlaeg: 'Butikken samlet', faggruppe: 'oevrigt',
      periode: '2025-09 – 2026-08', styrke: Math.min(1, pct / 150),
      symptom: `${b.kwhPrM2} kWh/m² mod ${Math.round(median)} kWh/m² for ${b.kaede} — ${pct} % over medianen.`,
      evidens: [
        ['Butikkens nøgletal', `${b.kwhPrM2} kWh/m²`],
        ['Median i kæden', `${Math.round(median)} kWh/m² (${medianer['_antal_' + b.kaede]} butikker)`],
        ['Salgsareal', `${fmtKwh(b.salgsareal_m2)} m²`],
        ['Merforbrug mod median', `${fmtKwh(merKwh)} kWh/år`],
      ],
      datadaekning: b.daekningPct,
      maaleenhed: { kwh: merKwh, klasse: 'potentiale' },
      forbehold: 'Benchmark er en kandidat til gennemgang, ikke en fejl. Butiksformat, åbningstider og lejere kan forklare afvigelsen.',
    });
  }
  return ud;
}

/** D-02 · Ny konstant last, målt som år-til-år-spring på samme måneder. */
export function detektorSpring(spring, butikIndex, { springGraense, elpris } = FORUDSAETNINGER) {
  const ud = [];
  for (const s of spring) {
    if (s.pct < springGraense) continue;
    const b = butikIndex[s.bn];
    if (!b) continue;
    const merPeriode = s.iAar - s.sidsteAar;
    const merAar = Math.round(merPeriode * 3);   // fire målte måneder → helt år
    ud.push({
      id: nyId('SIG'), detektor: 'D-02', version: '1.0', butiksnummer: s.bn,
      anlaeg: 'Butikken samlet', faggruppe: 'oevrigt',
      periode: 'maj–aug 2026 mod maj–aug 2025', styrke: Math.min(1, s.pct / 60),
      symptom: `Forbruget ligger ${s.pct} % over samme fire måneder sidste år og er ikke faldet tilbage.`,
      evidens: [
        ['Maj–aug 2025', `${fmtKwh(s.sidsteAar)} kWh`],
        ['Maj–aug 2026', `${fmtKwh(s.iAar)} kWh`],
        ['Forskel i perioden', `${fmtKwh(merPeriode)} kWh`],
        ['Fremskrevet til år', `${fmtKwh(merAar)} kWh`],
      ],
      datadaekning: b.daekningPct,
      maaleenhed: { kwh: merAar, klasse: 'besparelse' },
      forbehold: 'Fremskrivningen antager, at niveauet holder. Et varmt kvartal kan forklare en del af springet — vejrkorrektion mangler, indtil graddage er koblet på.',
    });
  }
  return ud;
}

/** D-04 · Måler uden data. Et tagget målepunkt, der står på nul, gør alle andre detektorer blinde. */
export function detektorDoedMaaler(butikker) {
  const ud = [];
  for (const b of butikker) {
    if (b.daekningPct !== 0 || !b.kwhAar) continue;
    ud.push({
      id: nyId('SIG'), detektor: 'D-04', version: '1.0', butiksnummer: b.butiksnummer,
      anlaeg: 'Bimålere', faggruppe: 'oevrigt',
      periode: '2025-09 – 2026-08', styrke: 1,
      symptom: `Ingen af butikkens bimålere har leveret data i perioden, mens forsyningsmåleren har registreret ${fmtKwh(b.kwhAar)} kWh.`,
      evidens: [
        ['Forsyningsmåler', `${fmtKwh(b.kwhAar)} kWh/år — kører`],
        ['Bimålere med data', '0'],
        ['Konsekvens', 'Alle anlægsnære detektorer er ude af drift i denne butik'],
      ],
      datadaekning: 0,
      maaleenhed: { kwh: b.kwhAar, klasse: 'blindt' },
    });
  }
  return ud;
}

/** D-01 · Basislast om natten, på timeprofil for butikker hvor den findes. */
export function detektorNatlast(profiler, butikIndex, { natandelGraense, elpris } = FORUDSAETNINGER) {
  const ud = [];
  for (const p of profiler) {
    const timer = p.timer;
    if (!timer || timer.length !== 24) continue;
    const lukket = [22, 23, 0, 1, 2, 3, 4, 5];
    const natSum = lukket.reduce((s, h) => s + timer[h], 0);
    const doegn = timer.reduce((s, v) => s + v, 0);
    const andel = 100 * natSum / doegn;
    if (andel < natandelGraense) continue;

    const natMiddel = natSum / lukket.length;
    const dagMiddel = (doegn - natSum) / (24 - lukket.length);
    // Et realistisk sparepotentiale: den del af natlasten der ligger over
    // det, køl og nødvendig teknik alene kræver. Sættes konservativt til
    // 25 % af natlasten, indtil bimålerne kan vise, hvad der faktisk kører.
    const sparbarPrTime = natMiddel * 0.25;
    const kwhAar = Math.round(sparbarPrTime * lukket.length * 365);
    ud.push({
      id: nyId('SIG'), detektor: 'D-01', version: '1.0', butiksnummer: p.butiksnummer,
      anlaeg: 'Butikken samlet', faggruppe: 'oevrigt',
      periode: p.periode, styrke: Math.min(1, (andel - natandelGraense) / 25),
      symptom: `${Math.round(andel)} % af døgnforbruget falder i lukketimerne. Natniveauet er ${Math.round(100 * natMiddel / dagMiddel)} % af dagniveauet.`,
      evidens: [
        ['Middel i lukketimer (22–06)', `${natMiddel.toFixed(1)} kWh/time`],
        ['Middel i åbningstid', `${dagMiddel.toFixed(1)} kWh/time`],
        ['Andel af døgnforbrug', `${Math.round(andel)} %`],
        ['Antaget sparbart', '25 % af natlasten — konservativt skøn indtil bimålerne kan vise hvad der kører'],
      ],
      datadaekning: (butikIndex[p.butiksnummer] || {}).daekningPct ?? null,
      maaleenhed: { kwh: kwhAar, klasse: 'besparelse' },
      forbehold: 'Detektoren ser strøm om natten, men ikke af hvad. Uden CTS-tidsplan og ventilationens driftstilstand kan den ikke skelne nødvendig køledrift fra en tidsplan, der ikke slår igennem.',
    });
  }
  return ud;
}

/** D-06 · Køleandel mod naboer i samme kæde. */
export function detektorKoeleandel(butikker, splits, { elpris } = FORUDSAETNINGER) {
  const perButik = {};
  for (const s of splits) {
    (perButik[s.butiksnummer] ||= {})[s.fg] = s.kwh;
  }
  const andele = [];
  for (const b of butikker) {
    const fg = perButik[b.butiksnummer];
    if (!fg || !fg.koel_frys || !b.kwhAar || b.daekningPct < 40) continue;
    andele.push({ b, andel: 100 * fg.koel_frys / b.kwhAar, koel: fg.koel_frys });
  }
  const prKaede = {};
  for (const a of andele) (prKaede[a.b.kaede] ||= []).push(a.andel);
  const median = Object.fromEntries(Object.entries(prKaede).map(([k, v]) => [k, medianAf(v)]));

  const ud = [];
  for (const a of andele) {
    const m = median[a.b.kaede];
    if (!m || a.andel < m * 1.30) continue;
    const merKwh = Math.round((a.andel - m) / 100 * a.b.kwhAar);
    ud.push({
      id: nyId('SIG'), detektor: 'D-06', version: '1.0', butiksnummer: a.b.butiksnummer,
      anlaeg: 'Køleanlæg (konsumkøl)', faggruppe: 'koel_frys',
      periode: '2025-09 – 2026-08', styrke: Math.min(1, (a.andel - m) / m),
      symptom: `Køl står for ${Math.round(a.andel)} % af butikkens el mod ${Math.round(m)} % hos ${a.b.kaede}-butikker med bimåling.`,
      evidens: [
        ['Køl, år', `${fmtKwh(a.koel)} kWh`],
        ['Andel af butikkens el', `${Math.round(a.andel)} %`],
        ['Median i kæden', `${Math.round(m)} %`],
        ['Merforbrug mod median', `${fmtKwh(merKwh)} kWh/år`],
      ],
      datadaekning: a.b.daekningPct,
      maaleenhed: { kwh: merKwh, klasse: 'potentiale' },
      forbehold: 'Uden AK-centralen kan detektoren ikke skelne mellem kondensatorforhold, afrimning, kølemiddelmangel og et anlæg, der simpelthen er større end naboens. Den peger på butikken, ikke på årsagen.',
    });
  }
  return ud;
}

/* ---- Lag 2 · sagsbyggeren -------------------------------------------------
 * Én fysisk fejl giver én sag. Nøglen er butik + sagstype. Signaler, der
 * matcher en åben sag, hænges på som ny evidens — de bliver ikke til en ny sag.
 */

const SAGSTYPE = {
  'D-01': { type: 'natlast',    navn: 'Noget kører, når butikken er lukket',           fg: 'cts' },
  'D-02': { type: 'spring',     navn: 'Ny konstant last — tændt og aldrig slukket',    fg: 'oevrigt' },
  'D-03': { type: 'restpost',   navn: 'Manglende bimåling — forbrug uden målepunkt',   fg: 'oevrigt' },
  'D-04': { type: 'maalerfejl', navn: 'Bimålere leverer ingen data',                   fg: 'oevrigt' },
  'D-05': { type: 'benchmark',  navn: 'Ligger højt mod sammenlignelige butikker',      fg: 'oevrigt' },
  'D-06': { type: 'koeleandel', navn: 'Køleanlægget yder dårligere end porteføljen',   fg: 'koel_frys' },
};

const HYPOTESER = {
  natlast:    'Noget står og kører i lukketimerne. Mønsteret matcher en tidsplan, der ikke slår igennem, eller et anlæg sat i manuel drift. Uden CTS og ventilationens driftstilstand kan vi ikke sige hvilket — det er derfor det første, servicebesøget skal afgøre.',
  spring:     'Forbruget er flyttet til et nyt, fast niveau og er blevet der. Det ligner en installation, der er sat i drift og aldrig slukket igen, snarere end en sæsonvariation, som ville være gået tilbage.',
  restpost:   'Størstedelen af butikkens el kan ikke henføres til et anlæg. Det er ikke i sig selv et spild, men det gør butikken usynlig for alle anlægsnære detektorer — og et spild her ville ingen opdage.',
  maalerfejl: 'Bimålingen er ude af drift i hele butikken. Enten er målerne faldet ud af dataopsamlingen, eller også er de aldrig kommet ind. Det er en dataopgave før en energiopgave.',
  benchmark:  'Butikken bruger mere pr. m² end sine søskende i kæden. Det er en kandidat til gennemgang — årsagen kan lige så godt være åbningstider, lejere eller butiksformat som en fejl på et anlæg.',
  koeleandel: 'Køleanlægget trækker en større andel af butikkens el end sammenlignelige anlæg. Kandidaterne er kondensatorforhold, afrimningsindstilling, kølemiddelforhold og reguleringsfejl — de kan ikke skelnes uden AK-data.',
};

const TJEKPUNKTER = {
  natlast: [
    'Aflæs hvad der faktisk kører kl. 02–04: ventilation, belysning, køleflader, bageriudstyr.',
    'Sammenhold CTS-tidsplanen med butikkens faktiske åbningstider.',
    'Tjek om ventilationsanlægget står i manuel drift eller har en override, der aldrig er sat tilbage.',
  ],
  spring: [
    'Find ud af, hvilken gruppe springet ligger i — aflæs bimålerne før noget andet.',
    'Slå op i Dalux, om der er lukket en opgave i butikken i samme uge som springet.',
    'Spørg butikken, om der er sat nyt udstyr i drift eller lavet ombygning.',
  ],
  restpost: [
    'Gennemgå eltavlen mod målerlisten i Enity og notér, hvilke grupper der ikke er målt.',
    'Kontrollér om eksisterende bimålere er koblet på dataopsamlingen.',
    'Prissæt eftermontering af de manglende målepunkter.',
  ],
  maalerfejl: [
    'Kontrollér om bimålerne fysisk sidder og tæller.',
    'Kontrollér dataopsamling og kommunikation til Enity.',
    'Er målerne aldrig sat op: behandl det som en installationsopgave, ikke en fejlretning.',
  ],
  benchmark: [
    'Bekræft salgsareal og åbningstider i Dalux — et forkert areal giver et forkert nøgletal.',
    'Træk lejerforbrug ud, og se om afvigelsen består.',
    'Kun hvis den består: gennemgå anlæggene efter den sædvanlige rækkefølge.',
  ],
  koeleandel: [
    'Visuel inspektion af kondensatorflade og luftindtag — fem minutter, og afgør sagen i de fleste tilfælde.',
    'Tjek at alle kondensatorventilatorer kører.',
    'Aflæs afrimningsindstilling: hyppighed, varighed og om afrimningen afsluttes på temperatur eller på tid.',
    'Først derefter måling af kondens- og sugetryk.',
  ],
};

const FORVENTET_FUND = {
  natlast:    'Et anlæg i drift uden for åbningstid — typisk ventilation eller belysning.',
  spring:     'En installation sat i drift i perioden, som ikke er kendt i driften.',
  restpost:   'Umålte grupper i eltavlen, ikke en fejl på et anlæg.',
  maalerfejl: 'Manglende eller afbrudt dataopsamling.',
  benchmark:  'I halvdelen af tilfældene en forklaring i stamdata, ikke en fejl.',
  koeleandel: 'Kondensatorforhold eller afrimningsindstilling.',
};

/** Samler signaler til sager, regner kroner, konfidens og prioritet. */
export function byggSager(signaler, butikIndex, forud = FORUDSAETNINGER) {
  const grupper = new Map();
  for (const s of signaler) {
    const st = SAGSTYPE[s.detektor];
    if (!st) continue;
    const nøgle = `${s.butiksnummer}|${st.type}`;
    if (!grupper.has(nøgle)) grupper.set(nøgle, []);
    grupper.get(nøgle).push(s);
  }

  const sager = [];
  for (const [nøgle, sigs] of grupper) {
    const [bn, type] = nøgle.split('|');
    const butik = butikIndex[bn];
    if (!butik) continue;

    const st = SAGSTYPE[sigs[0].detektor];
    const kwh = sigs.reduce((m, s) => Math.max(m, s.maaleenhed.kwh || 0), 0);
    const klasse = sigs.reduce((k, s) => RANG_KLASSE[s.maaleenhed.klasse] > RANG_KLASSE[k] ? s.maaleenhed.klasse : k, 'blindt');
    const kr = Math.round(kwh * forud.elpris);
    const faggruppe = sigs.find((s) => s.faggruppe && s.faggruppe !== 'oevrigt')?.faggruppe || st.fg;
    const daekning = sigs.map((s) => s.datadaekning).filter((v) => v != null);
    const minDaekning = daekning.length ? Math.min(...daekning) : null;

    const konfidens = beregnKonfidens(sigs, minDaekning, type, forud);
    const prioritet = beregnPrioritet(kr, type, sigs, klasse);

    sager.push({
      id: nyId('SAG'),
      butiksnummer: bn, butik: butik.navn, kaede: butik.kaede, by: butik.by,
      daluxBuildingId: butik.daluxBuildingId, enityBuildingId: butik.enityBuildingId,
      sagstype: type, sagsnavn: st.navn, faggruppe,
      anlaeg: sigs[0].anlaeg,
      status: 'ny', aabnet: '2026-09-14',
      signaler: sigs,
      kwhAar: kwh, krAar: kr, krKlasse: klasse,
      krMetode: `${fmtKwh(kwh)} kWh/år × ${forud.elpris.toFixed(2)} kr/kWh = ${fmtKr(kr)} kr/år. `
        + KLASSE_FORKLARING[klasse]
        + ' Elprisen er en forudsætning, der kan rettes under Opsætning.',
      konfidens, prioritet,
      hypotese: HYPOTESER[type],
      tjekpunkter: TJEKPUNKTER[type] || [],
      forventetFund: FORVENTET_FUND[type],
      ansvarlig: FG[faggruppe] ? FG[faggruppe].rolle : 'Energiansvarlig',
      fag: FG[faggruppe] ? FG[faggruppe].fag : '—',
      datadaekning: minDaekning,
      forbehold: sigs.map((s) => s.forbehold).filter(Boolean),
      manglerKilder: [...new Set(sigs.flatMap((s) => (DETEKTORER.find((d) => d.id === s.detektor) || {}).mangler || []))],
    });
  }

  // Sager under dækningsminimum oprettes ikke — men målerfejlsagen er netop
  // sagen om, at dækningen mangler, så den slipper igennem.
  return sager
    .filter((s) => s.sagstype === 'maalerfejl' || s.datadaekning == null || s.datadaekning >= forud.daekningMinimum || s.sagstype === 'restpost')
    .sort((a, b) => rangPrioritet(a.prioritet) - rangPrioritet(b.prioritet) || b.krAar - a.krAar);
}

/** Konfidens regnes af fire ting, og alle fire vises i sagen. */
function beregnKonfidens(sigs, daekning, type, forud) {
  const kilder = new Set(sigs.map((s) => s.detektor)).size;
  const kildeScore = kilder >= 3 ? 1 : kilder === 2 ? 0.7 : 0.4;

  const daekScore = daekning == null ? 0.5
    : daekning >= forud.daekningForbehold ? 1
    : daekning >= forud.daekningMinimum ? 0.6 : 0.3;

  // Historisk præcision pr. sagstype. Nulstilles først, når skyggedriften
  // har målt rigtige tal — indtil da er det et forsigtigt udgangspunkt.
  const praecision = { maalerfejl: 0.95, restpost: 0.9, spring: 0.7, natlast: 0.6, benchmark: 0.45, koeleandel: 0.5 }[type] ?? 0.5;

  // Stabilitet: et mønster målt over et år vejer tungere end et døgn.
  const stabilitet = { restpost: 1, maalerfejl: 1, benchmark: 1, koeleandel: 1, spring: 0.9, natlast: 0.7 }[type] ?? 0.6;

  const samlet = 0.30 * kildeScore + 0.25 * daekScore + 0.30 * praecision + 0.15 * stabilitet;
  return {
    samlet: Math.round(samlet * 100),
    dele: [
      { navn: 'Uafhængige kilder', vaerdi: kilder === 1 ? 'Én kilde' : `${kilder} kilder`, score: kildeScore },
      { navn: 'Datadækning i perioden', vaerdi: daekning == null ? 'Ukendt' : `${daekning} %`, score: daekScore },
      { navn: 'Detektorens historiske præcision', vaerdi: 'Udgangspunkt — ikke målt endnu', score: praecision },
      { navn: 'Stabilitet i mønsteret', vaerdi: stabilitet >= 0.9 ? 'Holdt over et år' : 'Kortere vindue', score: stabilitet },
    ],
  };
}

function beregnPrioritet(kr, type, sigs, klasse) {
  if (sigs.some((s) => (DETEKTORER.find((d) => d.id === s.detektor) || {}).p1)) return 'P1';
  // Et blindt beløb er ikke en besparelse, og må derfor ikke skubbe en
  // dataopgave op foran en fejl, der rent faktisk koster penge hver dag.
  if (klasse === 'blindt') return 'P3';
  if (klasse === 'potentiale') return kr >= 100000 ? 'P3' : 'P4';
  if (kr >= 25000) return 'P2';
  if (kr >= 5000) return 'P3';
  return 'P4';
}

/* Tre slags beløb, der ikke må lægges sammen:
 *   besparelse — realistisk gevinst ved at rette fejlen
 *   potentiale — øvre skøn, der først holder efter en gennemgang
 *   blindt     — forbrug, ingen kan se. Ikke et spild, men en risiko.
 */
const RANG_KLASSE = { blindt: 0, potentiale: 1, besparelse: 2 };
const KLASSE_FORKLARING = {
  besparelse: 'Beløbet er et realistisk skøn over, hvad fejlen koster om året.',
  potentiale: 'Beløbet er et ØVRE skøn. Afvigelsen kan lige så godt skyldes butiksformat, åbningstider eller lejere som en fejl — tallet holder først efter en gennemgang.',
  blindt:     'Beløbet er IKKE en besparelse. Det er den mængde forbrug, ingen kan se — og dermed det, et spild her ville kunne skjule sig i.',
};

const rangPrioritet = (p) => ({ P1: 0, P2: 1, P3: 2, P4: 3 }[p] ?? 4);

/** Sambesøg: åbne P3- og P4-sager i samme butik hører til på én tur. */
export function grupperSambesoeg(sager) {
  const pr = {};
  for (const s of sager) {
    if (s.prioritet !== 'P3' && s.prioritet !== 'P4') continue;
    if (s.status !== 'ny' && s.status !== 'vurderet') continue;
    (pr[s.butiksnummer] ||= []).push(s);
  }
  return Object.entries(pr)
    .filter(([, liste]) => liste.length >= 2)
    .map(([bn, liste]) => ({
      butiksnummer: bn, butik: liste[0].butik, antal: liste.length,
      krAar: liste.reduce((s, x) => s + x.krAar, 0),
      fag: [...new Set(liste.map((x) => x.fag))],
      sager: liste,
    }))
    .sort((a, b) => b.krAar - a.krAar);
}

/* ---- Hjælpere ---- */
function medianPrKaede(butikker) {
  const pr = {};
  for (const b of butikker) {
    if (!b.kwhPrM2 || !b.salgsareal_m2 || b.salgsareal_m2 < 200) continue;
    (pr[b.kaede] ||= []).push(b.kwhPrM2);
  }
  const ud = {};
  for (const [k, v] of Object.entries(pr)) { ud[k] = medianAf(v); ud['_antal_' + k] = v.length; }
  return ud;
}
function medianAf(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const fmtKwh = (n) => (n == null ? '—' : Math.round(n).toLocaleString('da-DK'));
export const fmtKr  = (n) => (n == null ? '—' : Math.round(n).toLocaleString('da-DK'));
