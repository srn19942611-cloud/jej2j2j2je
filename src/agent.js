/* Lag 4: agenten, der reagerer — og lærer.
 *
 * Kæden er den samme hver gang, og hvert led har præcis ét job:
 *
 *   1. opdag      måleren afviger fra sin egen normal (aarsag.maalSignatur)
 *   2. koble      hvad siger Dalux om det anlæg i samme periode (korrelation)
 *   3. forklare   hvilken årsag passer på signaturen (aarsag.diagnosticer)
 *   4. prissætte  hvad koster det at lade stå — i den rigtige beløbsklasse
 *   5. adressere  hvem har anlægget (personer.ejerMedRolle)
 *   6. spørge     et varsel til netop den person, med to knapper
 *   7. lære       hvad svarede de, og hvad skal det ændre næste gang
 *
 * Trin 7 er det, der adskiller agenten fra en rapport. Et afvist varsel er
 * ikke spild — det er den eneste kilde til at vide, om diagnoserne holder.
 * En detektor uden afvisningsgrunde kan man kun måle på, om den lyder
 * overbevisende, ikke på om den har ret.
 *
 * Derfor er "Afvis" aldrig en knap alene. Den er altid en knap plus et
 * spørgsmål, og svaret på det spørgsmål ændrer noget konkret: en prior, en
 * tærskel, en undertrykkelse eller en sag i koblingsbunken.
 */

import { maalSignatur, diagnosticer, AARSAG, AARSAGER } from './aarsag.js';
import { samtidighed, tilbagefald, FG_FAGOMRAADER, varslingsstatistik } from './korrelation.js';
import { ejerMedRolle, ejerAfFaggruppe, PERSON, VISITATOR } from './personer.js';
import { fgNavn } from './taxonomy.js';

/* kr pr. kWh el, kr pr. kWh fjernvarme, kr pr. m³ vand inkl. afledning (ekskl. moms). */
export const PRISER = { elpris: 0.77, varmepris: 0.65, vandpris: 65 };

/* ---- Afvisningsgrundene ---------------------------------------------------
 * Seks grunde, og de er valgt sådan, at hver af dem peger på noget forskelligt,
 * der skal rettes. En fritekstboks ville give bedre historier og ingen læring;
 * en liste uden fritekst ville give læring uden nuancer. Derfor begge dele:
 * grunden styrer, hvad der ændres, og bemærkningen bliver stående til den,
 * der skal forstå hvorfor.
 */
export const AFVIS_GRUNDE = [
  {
    id: 'forkert_aarsag', navn: 'Årsagen er forkert — det var noget andet',
    spoerg: 'Hvad var det så?', kraeverValg: true,
    laerer: 'Justerer, hvor sandsynlig hver årsag er for denne faggruppe. Den forkerte vægtes ned, den rigtige op.',
  },
  {
    id: 'forkert_anlaeg', navn: 'Det er ikke det anlæg, måleren dækker',
    spoerg: 'Hvilket anlæg sidder måleren på, hvis du ved det?',
    laerer: 'Sendes til koblingsbunken. Det er en fejl i sammenkædningen af måler og anlæg, ikke i diagnosen — '
      + 'og den fejl rammer alle fremtidige varsler på samme måler.',
  },
  {
    id: 'kendt', navn: 'Kendt og accepteret — sådan skal det være',
    spoerg: 'Hvor længe skal den holde op med at melde?', kraeverUdloeb: true,
    laerer: 'Undertrykker varslet på dette anlæg indtil den valgte dato. Der sættes altid en udløbsdato, '
      + 'så en accept ikke bliver til et blindt punkt, ingen kan huske.',
  },
  {
    id: 'allerede_loest', navn: 'Allerede løst — der er en opgave på den',
    spoerg: 'Hvilken Dalux-opgave?',
    laerer: 'Lukker varslet og noterer opgaven. Tæller ikke som en forkert diagnose — agenten havde ret, '
      + 'den var bare for langsom.',
  },
  {
    id: 'for_lille', navn: 'For lille til at rykke ud på',
    spoerg: 'Hvad er grænsen for dig på denne type?',
    laerer: 'Hæver beløbsgrænsen for denne faggruppe, så varsler under grænsen samles i en liste i stedet '
      + 'for at afbryde nogen.',
  },
  {
    id: 'ikke_mit', navn: 'Ikke mit område',
    spoerg: 'Hvem skulle have haft den?',
    laerer: 'Sender varslet videre og noterer ruten. Rammer den samme rute tre gange, foreslås den som fast regel.',
  },
];
export const AFVIS_GRUND = Object.fromEntries(AFVIS_GRUNDE.map((g) => [g.id, g]));

/* ---- Prioritet ------------------------------------------------------------
 * Kroner alene må ikke bestemme prioriteten. Et standset køleanlæg koster
 * ingenting på elregningen — det bruger jo mindre — og er alligevel det mest
 * hastende, der findes i en butik. Derfor slår "varer i fare" alt andet.
 */
/* Hvor sikker diagnosen skal være, før et stort beløb alene løfter sagen op.
 *
 * Stod på 55, dengang konfidensen blev regnet over et filtreret katalog og
 * derfor lå kunstigt højt — næsten halvdelen af diagnoserne lå over. Da
 * skalaen blev rettet, ville de samme 55 have betydet noget helt andet: kun
 * hver femte ville komme igennem. Grænsen er flyttet med skalaen, så den
 * slipper omtrent lige så mange igennem som før. Politikken er uændret; det
 * er målestokken, der er skiftet.
 *
 * Bemærk, at beløbet er MÅLT og årsagen er GÆTTET. Derfor er det kun P2, en
 * lav konfidens koster — sagen forsvinder ikke, den bliver til et besøg, der
 * skal afgøre hvad det er, i stedet for en bestilling på et stykke arbejde. */
const KONFIDENSPORT = 40;

export function prioriter(aarsag, kr, konfidens) {
  if (aarsag.hastende && aarsag.klasse === 'ingen') return 'P1';   // anlægget kører ikke som det skal
  if (aarsag.hastende) return kr > 40000 ? 'P1' : 'P2';
  if (aarsag.klasse === 'blindt') return 'P3';
  if (kr > 60000 && konfidens >= KONFIDENSPORT) return 'P2';
  if (kr > 15000) return 'P3';
  return 'P4';
}

/* ---- Beløbet --------------------------------------------------------------
 * Tre klasser, der aldrig lægges sammen:
 *   besparelse  penge, der holder op med at løbe, når fejlen rettes
 *   potentiale  penge, der KAN hentes, hvis en driftsbeslutning ændres
 *   blindt      forbrug, vi ikke kan se — hverken tab eller gevinst
 *   ingen       ingen elregning at hente; værdien ligger i varer og driftssikkerhed
 */
export function prissaet(signatur, aarsag, { elpris, varmepris, vandpris } = PRISER, enhed = 'el') {
  const pris = enhed === 'varme' ? varmepris : enhed === 'vand' ? (vandpris ?? PRISER.vandpris) : elpris;
  /* Mængden hedder kwhAar i hele kæden; for vand er den m³. Navnet i
   * teksten følger enheden, feltet gør ikke — så tabeller og sider, der
   * læser kwhAar, bliver ved med at virke. */
  const E = enhed === 'vand' ? 'm³' : 'kWh';
  const kwhAar = Math.round(Math.abs(signatur.afvigKwhPrDoegn) * 365);

  if (aarsag.aldrigBesparelse || aarsag.klasse === 'ingen') {
    return {
      kr: 0, kwhAar, klasse: 'ingen',
      metode: aarsag.id === 'maaler_doed'
        ? `Målepunktet dækker ${fmt(kwhAar)} ${E}/år, som ikke længere kan ses. Det er hverken et tab eller en gevinst — det er et blindt punkt, og det prissættes derfor ikke.`
        : `Anlægget bruger ${fmt(kwhAar)} ${E}/år mindre, men det er ikke en besparelse: kapaciteten er væk. `
          + 'Værdien ligger i varer, der ikke bliver for varme, og i at fejlen ikke vokser — ikke på elregningen.',
    };
  }
  if (aarsag.klasse === 'blindt') {
    return { kr: 0, kwhAar, klasse: 'blindt',
      metode: `${fmt(kwhAar)} ${E}/år kan ikke henføres. Beløbet er ikke regnet, fordi vi ikke ved, om der er noget at hente.` };
  }
  const kr = Math.round(kwhAar * pris);
  return {
    kr, kwhAar, klasse: aarsag.klasse,
    metode: `${fmt(Math.abs(signatur.afvigKwhPrDoegn))} ${E}/døgn over den vejrkorrigerede normal × 365 døgn × ${pris} kr/${E}. `
      + `Normalen er tilpasset på ${signatur.referencedoegn} døgn før afvigelsen og indeholder derfor ikke fejlen selv. `
      + (aarsag.klasse === 'potentiale'
        ? 'Regnet som potentiale og ikke som besparelse: der kan være en driftsmæssig grund til ændringen, og den skal høres først.'
        : 'Beløbet holder op med at løbe, når fejlen er rettet.'),
  };
}

const fmt = (n) => Math.round(n).toLocaleString('da-DK');

/* ---- Varslet --------------------------------------------------------------- */

let seq = 0;

/**
 * Bygger ét varsel: hele kæden fra måling til en person med to knapper.
 *
 * `enhed` beskriver, hvad der måles: { id, navn, butik, butiksnummer, faggruppe,
 * energirolle, maaler, dedikeret }. `dedikeret` er afgørende — en delt måler
 * kan ikke pege på ét anlæg, og det skal trække konfidensen ned frem for at
 * blive skjult.
 */
export function byggVarsel(enhed, raekker, {
  opgaver = [], priser = PRISER, referenceSlut, gentagneOpgaver = 0, laering = null, nu = new Date(),
} = {}) {
  const signatur = maalSignatur(raekker, { faggruppe: enhed.faggruppe, referenceSlut });
  return varselFraSignatur(enhed, signatur, { opgaver, historik: opgaver, priser, gentagneOpgaver, laering, nu });
}

/**
 * Anden halvdel af kæden: fra en signatur — uanset hvor den er målt — til et
 * varsel med ejer, beløb og prioritet.
 *
 * Skilt ud, fordi porteføljekørslen ikke måler signaturen selv. Den kommer fra
 * Enitys endpoint som en tabelrække, og herfra skal vejen være den samme, som
 * når hubben selv har regnet på døgnserien. To veje til samme diagnose ville
 * være to steder at have en fejl.
 *
 * `historik` er hele opgavehistorikken på enheden, bevidst også de gamle. Det
 * er dem, tilbagefaldstesten lever af — og den manglede i agentens egen vej,
 * så en rettelse fra 2019 aldrig kunne ses derfra.
 */
export function varselFraSignatur(enhed, signatur, {
  opgaver = [], historik = null, priser = PRISER, gentagneOpgaver = 0, laering = null, nu = new Date(),
} = {}) {
  if (!signatur || !signatur.brugbar) return null;
  if (signatur.form === 'ingen') return null;

  const relevante = FG_FAGOMRAADER[enhed.faggruppe];
  const haendelse = { dato: signatur.segmentStart || signatur.brud?.dato };
  /* Uden bruddato kan opgaverne ikke tidsrettes — men "ingen opgave på
   * anlægget overhovedet" er stadig et svar, og det er dét, der holder
   * "ny kapacitet sat i drift" fra at vinde på formen alene. 68 ventilations-
   * og 72 lysmålere fik den diagnose i første porteføljekørsel, uden én
   * opgave i Dalux; en ombygning efterlader mindst én. */
  const kobling = haendelse.dato
    ? samtidighed(haendelse, opgaver, { faggruppe: enhed.faggruppe, relevante })
    : (opgaver || []).length ? null : { klasse: 'uledsaget', konfidensbidrag: 0, opgave: null, dage: null, faggruppe: enhed.faggruppe,
        tekst: 'Der er ingen opgave i Dalux på anlægget.' };

  const hist = tilbagefald(historik || opgaver, { foer: haendelse.dato, nu });

  const diagnose = diagnosticer(signatur, {
    faggruppe: enhed.faggruppe, maalerrolle: enhed.maalerrolle, kobling, historik: hist, gentagneOpgaver,
    // Det, lukkede opgaver har lært os om netop denne faggruppe.
    priors: laering ? justeredePriors(laering, enhed.faggruppe) : null,
  });
  if (!diagnose.brugbar) return null;

  /* Kan måleren ikke bære en diagnose, bliver det ikke et varsel. Det ville
   * sende en montør ud på en samlemåler. Det bliver i stedet et datapunkt,
   * som koerAgent samler op — for en forsyningsmåler, der flytter sig, er
   * stadig værd at vide, og en utagget måler skal tagges. */
  if (diagnose.diagnoserbar === false) {
    return { ikkeDiagnoserbar: true, enhed, signatur, diagnose,
      grundId: diagnose.bedste.id, grund: diagnose.bedste.navn };
  }

  const aarsag = diagnose.bedste;
  const beloeb = prissaet(signatur, aarsag, priser, enhed.energienhed || 'el');

  /* Konfidensen fra diagnosen er, hvor godt årsagen passer på signaturen.
   * Den skal ned, hvis måleren ikke kun dækker dette anlæg — for så er det
   * ikke sikkert, at signaturen overhovedet handler om anlægget. */
  let konfidens = diagnose.konfidens;
  const forbehold = [...diagnose.forbehold];
  if (enhed.dedikeret === false) {
    konfidens = Math.round(konfidens * 0.7);
    forbehold.push(`Måleren "${enhed.maaler}" dækker flere anlæg. Afvigelsen er målt på gruppen og kan ikke henføres til ${enhed.navn} alene — servicebesøget skal starte med at afgøre hvilket anlæg.`);
  }

  // Har faggruppen fået hævet sin beløbsgrænse af en afvisning, respekteres det.
  const graense = laering?.beloebsgraenser?.[enhed.faggruppe] || 0;
  const underGraense = beloeb.klasse !== 'ingen' && beloeb.kr < graense;

  /* ejerMedRolle svarer med en indpakning { person, krav, præcision } — ikke
   * med personen selv. Uden .person blev ejerId undefined på hvert eneste
   * varsel, og alt endte hos "ingen". */
  const traef = ejerMedRolle(enhed.faggruppe, enhed.energirolle);
  const ejer = traef?.person || ejerAfFaggruppe(enhed.faggruppe) || VISITATOR;

  return {
    id: `VAR-${String(++seq).padStart(4, '0')}`,
    oprettet: nu.toISOString(),
    status: 'ny',
    enhed, signatur, kobling, historik: hist, diagnose,
    aarsagId: aarsag.id,
    overskrift: overskrift(enhed, signatur, aarsag),
    aarsagNavn: aarsag.navn,
    forklaring: aarsag.forklaring,
    tjekpunkter: aarsag.tjek,
    typiskFund: aarsag.typiskFund,
    alternativer: diagnose.rangeret.slice(1, 3).map((r) => ({ id: r.id, navn: r.navn, andel: Math.round(r.andel * 100) })),
    beviser: aarsag.beviser,
    kr: beloeb.kr, kwhAar: beloeb.kwhAar, krKlasse: beloeb.klasse, krMetode: beloeb.metode,
    konfidens, forbehold,
    prioritet: prioriter(aarsag, beloeb.kr, konfidens),
    hastende: !!aarsag.hastende,
    ejerId: ejer?.id || null,
    ejerNavn: ejer?.navn || 'ingen',
    ejerHvorfor: traef
      ? (traef.praecision === 'rolle'
        ? `${ejer.navn} har ${fgNavn(enhed.faggruppe)} i rollen "${enhed.energirolle}"${traef.krav.note ? ` — ${traef.krav.note.toLowerCase()}` : ''}.`
        : `${ejer.navn} har faggruppen ${fgNavn(enhed.faggruppe)}.`)
      : (ejer ? `Ingen har ${fgNavn(enhed.faggruppe)} direkte — sendt til ${ejer.navn} som visitator.` : null),
    underGraense,
    faggruppe: enhed.faggruppe,
    butik: enhed.butik,
    butiksnummer: enhed.butiksnummer,
  };
}

function overskrift(enhed, s, aarsag) {
  const hvor = `${enhed.navn} · ${enhed.butik}`;
  if (s.form === 'nul') return `${hvor}: målepunktet er holdt op med at levere`;
  if (s.retning === 'ned') return `${hvor}: forbruget er faldet ${Math.abs(s.afvigPct)} % — det er ikke en besparelse`;
  return `${hvor}: ${s.afvigPct} % over normalen siden ${dansk(s.segmentStart)}`;
}

const dansk = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${Number(d)}. ${['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'][Number(m) - 1]} ${a}`;
};

/** Kører agenten over en række analyseenheder. */
export function koerAgent(enheder, { priser = PRISER, laering = null, nu = new Date() } = {}) {
  const varsler = [];
  const ikkeDiagnoserbare = [];
  for (const e of enheder) {
    if (!e.raekker || e.raekker.length < 60) continue;
    if (undertrykt(e, laering, nu)) continue;
    const v = byggVarsel(e.enhed || e, e.raekker, {
      opgaver: e.opgaver, priser, referenceSlut: e.referenceSlut,
      gentagneOpgaver: e.gentagneOpgaver || 0, laering, nu,
    });
    if (!v) continue;
    if (v.ikkeDiagnoserbar) ikkeDiagnoserbare.push(v);
    else varsler.push(v);
  }
  varsler.sort((a, b) => RANG[a.prioritet] - RANG[b.prioritet] || b.kr - a.kr);
  /* Bagudkompatibelt: kaldere, der bare itererer over svaret, får varslerne
   * som før. De, der spørger efter afvisningerne, kan finde dem på listen. */
  varsler.ikkeDiagnoserbare = ikkeDiagnoserbare;
  return varsler;
}

const RANG = { P1: 0, P2: 1, P3: 2, P4: 3 };

function undertrykt(e, laering, nu) {
  if (!laering?.undertrykkelser) return false;
  const id = (e.enhed || e).id;
  const idag = nu.toISOString().slice(0, 10);
  return laering.undertrykkelser.some((u) => u.enhedId === id && (!u.udloeb || u.udloeb >= idag));
}

/* ---- Teksten, der følger med til Dalux ------------------------------------
 * Den skal kunne læses af en, der ikke har set hubben, og som står med en
 * skruetrækker. Derfor: hvad er set, hvad tror vi, hvad skal tjekkes — i den
 * rækkefølge — og hvad det koster at lade stå.
 *
 * Nederst står et spørgsmål om, hvad årsagen viste sig at være. Det er ikke
 * høflighed: det er den eneste vej til at vide, om diagnoserne rammer.
 */
export function varselTilOpgavetekst(v) {
  const l = [];
  l.push(`ENERGI- OG DRIFTSHUB · ${v.id}`);
  l.push('');
  l.push(`Butik:     ${v.butik} (${v.butiksnummer})`);
  l.push(`Anlæg:     ${v.enhed.navn} · ${fgNavn(v.faggruppe)}`);
  l.push(`Målepunkt: ${v.enhed.maaler || '—'}${v.enhed.dedikeret === false ? ' (deles med andre anlæg)' : ''}`);
  l.push(`Prioritet: ${v.prioritet}${v.hastende ? ' — HASTER' : ''}`);
  l.push('');
  l.push('HVAD MÅLEREN VISER');
  l.push(v.signatur.form === 'nul'
    ? `Målepunktet er gået til nul ${dansk(v.signatur.segmentStart)} og har ikke leveret data siden.`
    : `${v.signatur.afvigKwhPrDoegn > 0 ? 'Merforbrug' : 'Mindreforbrug'} på ${fmt(Math.abs(v.signatur.afvigKwhPrDoegn))} kWh/døgn `
      + `(${v.signatur.afvigPct} %) siden ${dansk(v.signatur.segmentStart)}, målt mod anlæggets vejrkorrigerede normal.`);
  l.push(`Normalen er bygget på ${v.signatur.referencedoegn} døgn FØR afvigelsen, så den ikke indeholder fejlen selv.`);
  if (v.signatur.overgangsdoegn != null) {
    l.push(v.signatur.overgangsdoegn <= 14
      ? `Ændringen skete på ${v.signatur.overgangsdoegn} døgn — altså pludseligt.`
      : `Ændringen skete gradvist over ${v.signatur.overgangsdoegn} døgn.`);
  }
  l.push('');
  l.push('HVAD VI TROR, DET ER');
  l.push(`${v.aarsagNavn} (${v.konfidens} % konfidens)`);
  l.push(v.forklaring);
  l.push('');
  l.push('HVAD DER PEGER PÅ DET');
  for (const b of v.beviser) l.push(`${b.for ? ' +' : ' −'} ${b.tekst}`);
  if (v.kobling) l.push(` ·  Dalux: ${v.kobling.tekst || v.kobling.betydning}`);
  if (v.alternativer.length) {
    l.push('');
    l.push('ANDRE MULIGHEDER, DER IKKE KAN UDELUKKES');
    for (const a of v.alternativer) l.push(` ·  ${a.navn} (${a.andel} %)`);
  }
  l.push('');
  l.push('HVAD DER SKAL TJEKKES — I DENNE RÆKKEFØLGE');
  v.tjekpunkter.forEach((t, i) => l.push(`${i + 1}. ${t}`));
  l.push('');
  l.push('HVAD VI FORVENTER, DER BLIVER FUNDET');
  l.push(v.typiskFund);
  l.push('');
  l.push('HVAD DET KOSTER AT LADE STÅ');
  l.push(v.krKlasse === 'ingen' || v.krKlasse === 'blindt' ? v.krMetode : `${fmt(v.kr)} kr./år. ${v.krMetode}`);
  if (v.forbehold.length) {
    l.push('');
    l.push('FORBEHOLD');
    for (const f of v.forbehold) l.push(` ·  ${f}`);
  }
  l.push('');
  l.push('VED AFSLUTNING — SVAR VENLIGST PÅ DETTE');
  l.push('Hvad viste årsagen sig at være? Var diagnosen ovenfor rigtig?');
  l.push('Svaret er det eneste, der gør overvågningen bedre næste gang. Uden det ved vi kun,');
  l.push('om anbefalingen lød overbevisende — ikke om den var rigtig.');
  return l.join('\n');
}

/* ---- Læringen -------------------------------------------------------------
 * Det, afvisningerne skal ændre. Hver grund har sin egen virkning, og
 * virkningen skal kunne ses — ellers er feedbacken en postkasse.
 */

export function tomLaering() {
  return {
    svar: [],                 // hele historikken, rå
    priorJusteringer: {},     // faggruppe -> årsag -> {rigtig, forkert}
    undertrykkelser: [],      // enhedId + udløb
    beloebsgraenser: {},      // faggruppe -> kr
    koblingsfejl: [],         // måler/anlæg, der ikke hænger sammen
    ruter: {},                // sagstype -> personId -> antal
  };
}

/**
 * Tager imod et svar på et varsel og opdaterer læringen.
 * `svar` er { valg: 'opgave'|'afvis', grund, note, rigtigAarsag, udloeb, tilPerson, graense, bruger }.
 */
export function registrerSvar(laering, varsel, svar, nu = new Date()) {
  const l = laering || tomLaering();
  const post = {
    varselId: varsel.id, enhedId: varsel.enhed.id, faggruppe: varsel.faggruppe,
    butiksnummer: varsel.butiksnummer, aarsagId: varsel.aarsagId,
    konfidens: varsel.konfidens, kr: varsel.kr, krKlasse: varsel.krKlasse,
    ...svar, tid: nu.toISOString(),
  };
  l.svar = [post, ...l.svar].slice(0, 1000);

  const pr = (l.priorJusteringer[varsel.faggruppe] ||= {});
  const tael = (id) => (pr[id] ||= { rigtig: 0, forkert: 0 });

  if (svar.valg === 'opgave') {
    // En oprettet opgave er ikke en bekræftelse i sig selv — den kommer først,
    // når opgaven lukkes med en årsag. Indtil da tæller den kun som "taget alvorligt".
    tael(varsel.aarsagId).sendt = (tael(varsel.aarsagId).sendt || 0) + 1;
    return l;
  }

  switch (svar.grund) {
    case 'forkert_aarsag':
      tael(varsel.aarsagId).forkert++;
      if (svar.rigtigAarsag) tael(svar.rigtigAarsag).rigtig++;
      break;
    case 'kendt':
      l.undertrykkelser = [...l.undertrykkelser, {
        enhedId: varsel.enhed.id, enhedNavn: varsel.enhed.navn, butik: varsel.butik,
        aarsagId: varsel.aarsagId, note: svar.note || '', bruger: svar.bruger || '',
        udloeb: svar.udloeb || null, oprettet: nu.toISOString().slice(0, 10),
      }];
      break;
    case 'forkert_anlaeg':
      l.koblingsfejl = [...l.koblingsfejl, {
        enhedId: varsel.enhed.id, maaler: varsel.enhed.maaler, paastaaetAnlaeg: varsel.enhed.navn,
        rigtigAnlaeg: svar.note || '', butik: varsel.butik, tid: nu.toISOString(),
      }];
      break;
    case 'for_lille':
      if (svar.graense > 0) l.beloebsgraenser[varsel.faggruppe] = svar.graense;
      break;
    case 'ikke_mit':
      if (svar.tilPerson) {
        const r = (l.ruter[varsel.aarsagId] ||= {});
        r[svar.tilPerson] = (r[svar.tilPerson] || 0) + 1;
      }
      break;
    default: break;
  }
  return l;
}

/**
 * Hvor godt rammer hver årsag? Målt på de svar, der faktisk siger noget om
 * rigtigt og forkert. Et varsel, der blev afvist som "allerede løst", tæller
 * ikke som en fejl — diagnosen var rigtig, den kom bare for sent.
 */
export function traefsikkerhed(laering) {
  const ud = [];
  for (const [fg, aarsager] of Object.entries(laering?.priorJusteringer || {})) {
    for (const [id, t] of Object.entries(aarsager)) {
      const n = (t.rigtig || 0) + (t.forkert || 0);
      ud.push({
        faggruppe: fg, aarsagId: id, navn: AARSAG[id]?.navn || id,
        rigtig: t.rigtig || 0, forkert: t.forkert || 0, sendt: t.sendt || 0, bedoemt: n,
        andel: n ? (t.rigtig || 0) / n : null,
        // Under fem bedømmelser er tallet for usikkert til at vise som en procent.
        sikker: n >= 5,
      });
    }
  }
  return ud.sort((a, b) => b.bedoemt - a.bedoemt);
}

/**
 * Bekræftelsen fra den lukkede Dalux-opgave.
 *
 * Det er HER, sandheden kommer fra. Et varsel, der blev sendt videre, er ikke
 * en bekræftelse — det betyder kun, at nogen tog det alvorligt nok til at
 * sende en tekniker ud. Først når opgaven lukkes med en årsag, ved vi, om
 * diagnosen ramte.
 *
 * Derfor står spørgsmålet nederst i hver eneste opgavetekst, og derfor er
 * denne funktion adskilt fra registrerSvar: de to ting sker med uger imellem.
 */
export function bekraeftFraOpgave(laering, varsel, faktiskAarsag, note = '', nu = new Date()) {
  const l = laering || tomLaering();
  const pr = (l.priorJusteringer[varsel.faggruppe] ||= {});
  const tael = (id) => (pr[id] ||= { rigtig: 0, forkert: 0 });

  if (faktiskAarsag) tael(faktiskAarsag).rigtig++;
  if (faktiskAarsag && faktiskAarsag !== varsel.aarsagId) tael(varsel.aarsagId).forkert++;

  l.svar = [{
    varselId: varsel.id, enhedId: varsel.enhed.id, faggruppe: varsel.faggruppe,
    aarsagId: varsel.aarsagId, valg: 'bekraeftet', faktiskAarsag, note,
    ramte: faktiskAarsag === varsel.aarsagId, tid: nu.toISOString(),
  }, ...l.svar].slice(0, 1000);
  return l;
}

/* Hvor mange observationer der skal til, før erfaringen vejer lige så tungt
 * som fagfolks udgangspunkt. Tolv er sat lavt nok til, at et halvt års drift
 * flytter noget, og højt nok til at tre tilfældige svar ikke kan vælte en
 * årsag, der er rigtig i almindelighed. */
const ERFARINGSSTYRKE = 12;

/**
 * De justerede priors — hvor almindelig hver årsag er i netop denne faggruppe.
 *
 * Opdateringen er en tælling af, hvor ofte hver årsag viste sig at VÆRE den
 * rigtige, blandet med udgangspunktet efter hvor meget erfaring der er.
 *
 * Første udgave blandede i stedet præcisionen ind — altså hvor ofte årsagen
 * ramte, NÅR den blev foreslået. Det er en anden størrelse på en anden skala,
 * og resultatet var derefter: en årsag, der var blevet afvist som forkert seks
 * gange i træk, fik sin prior sat OP. To tal, der begge ligner sandsynligheder,
 * er ikke det samme tal.
 */
export function justeredePriors(laering, faggruppe) {
  const t = laering?.priorJusteringer?.[faggruppe] || {};
  const sande = {};
  let n = 0;
  for (const [id, x] of Object.entries(t)) { sande[id] = x.rigtig || 0; n += x.rigtig || 0; }

  const ud = {};
  for (const a of AARSAGER) {
    ud[a.id] = ((sande[a.id] || 0) + ERFARINGSSTYRKE * a.prior) / (n + ERFARINGSSTYRKE);
  }
  return ud;
}

/** Hvor meget erfaringen fylder endnu — så en justeret prior kan læses rigtigt. */
export function erfaringsvaegt(laering, faggruppe) {
  const t = laering?.priorJusteringer?.[faggruppe] || {};
  const n = Object.values(t).reduce((a, x) => a + (x.rigtig || 0), 0);
  return { bekraeftede: n, vaegt: n / (n + ERFARINGSSTYRKE) };
}

/** Hvad har agenten sparet nogen for? Kun varsler, der blev til opgaver. */
export function agentnoegletal(varsler, laering) {
  const svar = laering?.svar || [];
  const bedoemte = svar.filter((s) => s.valg === 'opgave' || (s.valg === 'afvis' && s.grund === 'forkert_aarsag'));
  const koblinger = varsler.map((v) => v.kobling).filter(Boolean);
  return {
    aabne: varsler.filter((v) => v.status === 'ny').length,
    p1: varsler.filter((v) => v.prioritet === 'P1').length,
    besparelse: varsler.filter((v) => v.krKlasse === 'besparelse').reduce((a, v) => a + v.kr, 0),
    potentiale: varsler.filter((v) => v.krKlasse === 'potentiale').reduce((a, v) => a + v.kr, 0),
    hastende: varsler.filter((v) => v.hastende).length,
    besvarede: svar.length,
    opgaver: svar.filter((s) => s.valg === 'opgave').length,
    afvist: svar.filter((s) => s.valg === 'afvis').length,
    praecision: bedoemte.length >= 5
      ? Math.round(100 * bedoemte.filter((s) => s.valg === 'opgave').length / bedoemte.length) : null,
    varsling: varslingsstatistik(koblinger),
  };
}
