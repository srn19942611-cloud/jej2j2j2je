/* Applikationens tilstand: konfiguration, data, sager og beslutninger.
 *
 * Beslutninger, undertrykkelser og oprettede opgaver gemmes lokalt i browseren.
 * I drift hører de hjemme i de tabeller, "Agenter til drift og vedligehold"
 * beskriver (signal, sag, sag_signal, beslutning, resultat, undertrykkelse,
 * detektor_praecision) — lagret her har med vilje samme form, så det kan
 * flyttes uden at skulle oversættes.
 */

import { buildClients, DEFAULTS } from './mcp.js';
import * as seed from './seed.js';
import {
  detektorRestpost, detektorBenchmark, detektorSpring, detektorDoedMaaler,
  detektorNatlast, detektorKoeleandel, byggSager, grupperSambesoeg, FORUDSAETNINGER,
} from './engine.js';

const NØGLE = 'coop-driftshub-v1';

const standard = {
  cfg: {
    enityUrl: DEFAULTS.enity,
    daluxUrl: DEFAULTS.dalux,
    proxy: '',
    liveData: false,
    tema: 'auto',
  },
  forudsaetninger: { ...FORUDSAETNINGER },
  beslutninger: {},      // sagId → { valg, aarsag, note, bruger, tid, daluxWorkOrderId }
  undertrykkelser: [],   // { anlaeg, detektor, begrundelse, ejer, udloeb }
  ansvarlige: {},        // faggruppe → { navn, email, stedfortraeder }
};

function laes() {
  try {
    const raw = localStorage.getItem(NØGLE);
    if (!raw) return structuredClone(standard);
    const gemt = JSON.parse(raw);
    return {
      ...structuredClone(standard),
      ...gemt,
      cfg: { ...standard.cfg, ...(gemt.cfg || {}) },
      forudsaetninger: { ...standard.forudsaetninger, ...(gemt.forudsaetninger || {}) },
    };
  } catch {
    return structuredClone(standard);
  }
}

export const state = {
  ...laes(),
  klienter: null,
  data: null,        // { butikker, splits, kilde: 'seed' | 'live', hentet }
  sager: [],
  sambesoeg: [],
  daluxMetadata: null,
  log: [],
  lyttere: new Set(),
};

state.klienter = buildClients(state.cfg);

export function gem() {
  try {
    const { cfg, forudsaetninger, beslutninger, undertrykkelser, ansvarlige } = state;
    localStorage.setItem(NØGLE, JSON.stringify({ cfg, forudsaetninger, beslutninger, undertrykkelser, ansvarlige }));
  } catch { /* privat vindue eller fuldt lager — hubben virker uden */ }
}

export function abonner(fn) { state.lyttere.add(fn); return () => state.lyttere.delete(fn); }
export function opdater() { for (const fn of state.lyttere) fn(); }

export function skriv(besked, niveau = 'info') {
  state.log.unshift({ tid: new Date(), besked, niveau });
  state.log = state.log.slice(0, 60);
}

/* ---- Data ---------------------------------------------------------------- */

/** Indlæser porteføljedata — live fra Enity hvis muligt, ellers det seedede udtræk. */
export async function indlaesData({ live = state.cfg.liveData } = {}) {
  if (live) {
    try {
      const data = await hentLive();
      state.data = data;
      skriv(`Hentede ${data.butikker.length} bygninger fra Enity.`, 'ok');
      koerDetektorer();
      opdater();
      return data;
    } catch (err) {
      skriv(`Enity kunne ikke nås: ${err.message}`, 'fejl');
      state.cfg.liveData = false;
    }
  }
  state.data = {
    kilde: 'seed',
    hentet: seed.PORTEFOLJE.hentet,
    butikker: seed.BUTIKKER,
    splits: seed.BUTIK_FAGGRUPPE,
    portefoelje: seed.PORTEFOLJE,
    maaned: seed.MAANED,
    faggruppeAar: seed.FAGGRUPPE_AAR,
    kaeder: seed.KAEDER,
    profiler: [{ butiksnummer: '7360', ...seed.DOEGNPROFIL_EKSEMPEL }],
    spring: seed.AARSSPRING,
    maalere: seed.MAALERE_EKSEMPEL,
  };
  koerDetektorer();
  opdater();
  return state.data;
}

/** Live-hentning fra Enity. Bygninger og målere; forbrug hentes pr. butik ved behov. */
async function hentLive() {
  const { enity } = state.klienter;
  const bygninger = await enity.call('list_buildings', {});
  const liste = Array.isArray(bygninger) ? bygninger : (bygninger.buildings || bygninger.data || []);
  const butikker = liste
    .filter((b) => (b.type || 'building') === 'building')
    .map((b) => {
      const navn = b.name || b.navn || '';
      const m = navn.match(/^(?:L_)?(\d+)\s+(\S+)\s+(.*)$/);
      return {
        id: String(b.id), butiksnummer: m ? m[1] : String(b.id), navn,
        kaede: m ? kaedeAf(m[2]) : 'Ukendt', by: m ? m[3] : '',
        salgsareal_m2: b.area || null, kwhAar: null, solAar: 0, daekningPct: null,
        enityBuildingId: String(b.id), daluxBuildingId: null, kwhPrM2: null,
      };
    });
  return {
    kilde: 'live', hentet: new Date().toISOString().slice(0, 10),
    butikker, splits: [], portefoelje: { ...seed.PORTEFOLJE, butikker: butikker.length },
    maaned: seed.MAANED, faggruppeAar: seed.FAGGRUPPE_AAR, kaeder: seed.KAEDER,
    profiler: [], spring: [], maalere: [],
  };
}

const KAEDER_KODE = { SB: 'SuperBrugsen', KV: 'Kvickly', BR: "Dagli'Brugsen", '365': '365 discount', C365: '365 discount', IM: 'Irma/Andet', LG: 'Lager/HQ', FDB: 'Irma/Andet', CE: 'Lager/HQ', ADM: 'Lager/HQ' };
const kaedeAf = (kode) => KAEDER_KODE[kode] || 'Ukendt';

/** Kører hele detektorkataloget og bygger sager. */
export function koerDetektorer() {
  const d = state.data;
  if (!d) return;
  const index = Object.fromEntries(d.butikker.map((b) => [b.butiksnummer, b]));
  const f = state.forudsaetninger;

  const signaler = [
    ...detektorDoedMaaler(d.butikker),
    ...detektorRestpost(d.butikker, f),
    ...detektorSpring(d.spring || [], index, f),
    ...detektorBenchmark(d.butikker, f),
    ...detektorNatlast(d.profiler || [], index, f),
    ...detektorKoeleandel(d.butikker, d.splits || [], f),
  ].filter((s) => !erUndertrykt(s));

  const sager = byggSager(signaler, index, f);
  for (const s of sager) {
    const b = state.beslutninger[nøgleFor(s)];
    if (b) { s.status = b.status; s.beslutning = b; }
  }
  state.sager = sager;
  state.sambesoeg = grupperSambesoeg(sager);
}

/** Sagens nøgle er butik + sagstype, så en sag overlever en ny detektorkørsel. */
export const nøgleFor = (sag) => `${sag.butiksnummer}|${sag.sagstype}`;

function erUndertrykt(signal) {
  const nu = new Date().toISOString().slice(0, 10);
  return state.undertrykkelser.some((u) =>
    u.butiksnummer === signal.butiksnummer && u.detektor === signal.detektor && (!u.udloeb || u.udloeb >= nu));
}

/* ---- Beslutninger -------------------------------------------------------- */

export function traefBeslutning(sag, valg, detaljer = {}) {
  const status = {
    opgave: 'sendt til Dalux',
    falsk: 'lukket (falsk)',
    undertryk: 'lukket (undertrykt)',
    overvaag: 'vurderet',
  }[valg] || 'vurderet';

  const beslutning = {
    valg, status, ...detaljer,
    bruger: detaljer.bruger || 'Driftshub-bruger',
    tid: new Date().toISOString(),
    detektorer: sag.signaler.map((s) => `${s.detektor}@${s.version}`),
    konfidensVedBeslutning: sag.konfidens.samlet,
    krVedBeslutning: sag.krAar,
  };
  state.beslutninger[nøgleFor(sag)] = beslutning;

  if (valg === 'undertryk') {
    for (const s of sag.signaler) {
      state.undertrykkelser.push({
        butiksnummer: sag.butiksnummer, butik: sag.butik, detektor: s.detektor,
        begrundelse: detaljer.note || '', ejer: detaljer.ejer || '', udloeb: detaljer.udloeb || '',
        oprettet: new Date().toISOString().slice(0, 10),
      });
    }
  }
  gem();
  koerDetektorer();
  opdater();
  return beslutning;
}

export function genaabn(sag) {
  delete state.beslutninger[nøgleFor(sag)];
  state.undertrykkelser = state.undertrykkelser.filter((u) => u.butiksnummer !== sag.butiksnummer);
  gem(); koerDetektorer(); opdater();
}

/* ---- Nøgletal ------------------------------------------------------------ */

export function noegletal() {
  const s = state.sager;
  const aabne = s.filter((x) => x.status === 'ny' || x.status === 'vurderet');
  const sum = (liste, klasse) => liste.filter((x) => !klasse || x.krKlasse === klasse).reduce((a, x) => a + x.krAar, 0);
  const bl = Object.values(state.beslutninger);
  return {
    sagerIAlt: s.length,
    aabne: aabne.length,
    p1: s.filter((x) => x.prioritet === 'P1' && aabenStatus(x)).length,
    p2: s.filter((x) => x.prioritet === 'P2' && aabenStatus(x)).length,
    p3: s.filter((x) => x.prioritet === 'P3' && aabenStatus(x)).length,
    p4: s.filter((x) => x.prioritet === 'P4' && aabenStatus(x)).length,
    krAabne: sum(aabne, 'besparelse'),
    krPotentiale: sum(aabne, 'potentiale'),
    krBlindt: sum(aabne, 'blindt'),
    krSendt: sum(s.filter((x) => x.status === 'sendt til Dalux')),
    opgaver: bl.filter((b) => b.valg === 'opgave').length,
    falske: bl.filter((b) => b.valg === 'falsk').length,
    undertrykkelser: state.undertrykkelser.length,
    undertrykkelserUdenUdloeb: state.undertrykkelser.filter((u) => !u.udloeb).length,
    behandlet: bl.length,
    praecision: (() => {
      const b = bl.filter((x) => x.valg === 'opgave' || x.valg === 'falsk');
      return b.length ? Math.round(100 * b.filter((x) => x.valg === 'opgave').length / b.length) : null;
    })(),
  };
}
const aabenStatus = (x) => x.status === 'ny' || x.status === 'vurderet';
