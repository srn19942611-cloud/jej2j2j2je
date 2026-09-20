/* Udsendelsen: fra varsel til noget, en fagansvarlig kan handle på.
 *
 * Stefan, 20. september: «Send de 25 ud mandag, kun straks først.» Så ugens
 * fem går ud som to bunker — det, der ikke kan vente (anlæg, der står eller
 * er ved at gå), og resten mandag. Hver sag bliver til én arbejdsordre i
 * Dalux med en tekst, en tekniker kan gå ud på: hvad måleren viser, hvad vi
 * tror, hvad det koster at lade stå, hvad der skal tjekkes i hvilken
 * rækkefølge — og et spørgsmål, der skal svares på ved afslutning, for det
 * er svaret, der gør motoren bedre.
 *
 * Det her modul bygger payloads. Det opretter ingenting. Oprettelsen sker
 * først, når nogen har set dem (sync/udsendelse.mjs skriver dem ud, og
 * dalux.opretOpgave sender dem).
 */
import { fgNavn } from './taxonomy.js';

const fmt = (n) => Math.round(n || 0).toLocaleString('da-DK');
const pct = (n) => (n > 0 ? '+' : '') + Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' %';

/* Dalux-valg, slået op 2026-09-20 i templates/priorities/teams:
 *   skabelon 96  ENERGI - Afvigelser og forbedringer
 *   team     20  Energi
 *   prioritet 1 Høj (straks) · 2 Mellem (normal)
 * Køleopgaver (116) og Teknik (6) findes også; valget kan overstyres pr. kald. */
export const DALUX_VALG = { templateId: '96', teamId: '20', prioritetStraks: '1', prioritetNormal: '2' };

export function emne(v) {
  return `${v.aarsagNavn} — ${v.enhed.navn} · ${v.butik}`;
}

/** Teksten i arbejdsordren. `v` er et varsel som rapport.json bærer det. */
export function udsendelsestekst(v, { straks = false, kilde = 'Enity døgndata' } = {}) {
  const l = [];
  l.push(`ENERGI- OG DRIFTSHUB · ${v.id}${straks ? ' · STRAKS' : ''}`);
  l.push('');
  l.push(`Butik: ${v.butik}`);
  l.push(`Måler: ${v.enhed.meterId} ${v.enhed.navn} · ${fgNavn(v.faggruppe) || v.faggruppe}`);
  l.push(`Ansvarlig: ${v.ejerNavn} · Prioritet ${v.prioritet}`);
  l.push('');
  l.push('HVAD MÅLEREN VISER');
  l.push(`Forbruget ligger ${pct(v.afvigPct)} i forhold til anlæggets egen normal (${kilde}, ${v.doegn} døgn efter ${v.brud ? `bruddet ${v.brud}` : 'periodens start'}).`
    + (v.restniveau != null ? ` Restniveau ${Number(v.restniveau).toLocaleString('da-DK', { maximumFractionDigits: 2 })} af normalen.` : ''));
  l.push('');
  l.push('HVAD VI TROR');
  l.push(`${v.aarsagNavn}. Sikkerhed ${v.konfidens} %.`);
  l.push('');
  l.push('HVAD DET BETYDER');
  if (v.krKlasse === 'ingen') l.push(`Ingen elbesparelse at hente — anlægget yder ikke det, det skal. ${fmt(v.kwhAar)} kWh/år er forsvundet, og det er kapacitet, ikke gevinst.`);
  else if (v.krKlasse === 'blindt') l.push(`${fmt(v.kwhAar)} kWh/år kan ikke længere ses. Det er et blindt punkt, ikke en besparelse.`);
  else l.push(`Omkring ${fmt(v.kr)} kr/år (${fmt(v.kwhAar)} kWh/år × elpris), regnet som ${v.krKlasse}.`);
  l.push('');
  l.push('TJEK I DENNE RÆKKEFØLGE');
  (v.tjekpunkter || []).forEach((t, i) => l.push(`${i + 1}. ${t}`));
  if (v.forbehold?.length) {
    l.push('');
    l.push('FORBEHOLD');
    for (const f of v.forbehold) l.push(`· ${f}`);
  }
  if (v.tilbagefald) {
    l.push('');
    l.push('BEMÆRK: Der er lukket en opgave på det samme anlæg tidligere, og afvigelsen er tilbage. Det er et tilbagefald — find årsagen, ikke kun symptomet.');
  }
  l.push('');
  l.push('SVAR VENLIGST VED AFSLUTNING');
  l.push('Hvad var årsagen? Passede diagnosen (ja / nej / delvist)? Svaret er det, der gør overvågningen bedre næste gang.');
  return l.join('\n');
}

/** Payloaden til dalux_create_workorder. Opretter ikke noget. */
export function byggDaluxOpgave(v, { buildingId = null, straks = false, valg = DALUX_VALG, deadline = null } = {}) {
  const wo = {
    subject: emne(v),
    description: udsendelsestekst(v, { straks }),
    templateId: valg.templateId,
    priorityId: straks ? valg.prioritetStraks : valg.prioritetNormal,
    teamId: valg.teamId,
  };
  if (buildingId) wo.buildingId = String(buildingId);
  if (deadline) wo.deadline = deadline;
  return wo;
}

/**
 * Deler ugens fem i to bunker: straks (nu) og mandag (resten).
 * `bygninger` er { butiksnummer: { dalux } } — uden bygning kan ordren ikke
 * hænges op, og så står den i `udenBygning` med grund i stedet for at gå ud.
 */
export function udsendelse(rapport, { bygninger = {}, nu = new Date(), valg = DALUX_VALG } = {}) {
  const norm = (b) => String(b ?? '').replace(/^0+/, '');
  const straksIds = new Set((rapport.straks || []).map((v) => v.id));
  const mandag = naesteMandag(nu);
  const straks = [], senere = [], udenBygning = [];
  for (const v of rapport.sendt || []) {
    const b = bygninger[norm(v.butiksnummer)];
    const erStraks = straksIds.has(v.id);
    if (!b?.dalux) { udenBygning.push({ varselId: v.id, butik: v.butik, grund: 'ingen Dalux-bygning på butikken' }); continue; }
    const post = {
      varselId: v.id, ejerId: v.ejerId, ejer: v.ejerNavn, butik: v.butik, butiksnummer: v.butiksnummer,
      enhed: v.enhed.navn, aarsag: v.aarsagNavn, konfidens: v.konfidens, kr: v.kr, hastende: !!v.hastende,
      bunke: erStraks ? 'straks' : 'mandag', sendes: erStraks ? nu.toISOString().slice(0, 10) : mandag,
      workOrder: byggDaluxOpgave(v, { buildingId: b.dalux, straks: erStraks, valg }),
    };
    (erStraks ? straks : senere).push(post);
  }
  const vaerdi = (p) => (p.hastende ? 1e9 : 0) + (p.kr || 0) * (p.konfidens / 100);
  straks.sort((a, b) => vaerdi(b) - vaerdi(a));
  senere.sort((a, b) => a.ejer.localeCompare(b.ejer) || vaerdi(b) - vaerdi(a));
  return { dato: nu.toISOString().slice(0, 10), mandag, straks, mandagBunke: senere, udenBygning, valg };
}

export function naesteMandag(nu = new Date()) {
  const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()));
  const dag = d.getUTCDay(); // 0 søndag
  const frem = dag === 1 ? 7 : ((8 - dag) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + frem);
  return d.toISOString().slice(0, 10);
}
