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
  detektorNatlast, detektorKoeleandel, detektorGentagneAnlaeg, detektorGentagneButik,
  byggSager, grupperSambesoeg, FORUDSAETNINGER,
} from './engine.js';

const NØGLE = 'coop-driftshub-v1';

const standard = {
  cfg: {
    enityUrl: DEFAULTS.enity,
    daluxUrl: DEFAULTS.dalux,
    proxy: '',
    liveData: false,
    tema: 'auto',
    syncTidspunkt: '03:15',
    autoSync: false,
  },
  forudsaetninger: { ...FORUDSAETNINGER },
  beslutninger: {},      // sagId → { valg, aarsag, note, bruger, tid, daluxWorkOrderId }
  undertrykkelser: [],   // { anlaeg, detektor, begrundelse, ejer, udloeb }
  ansvarlige: {},        // person → { navn, email, stedfortraeder }
  visitationer: {},      // sagsnøgle → personId, sat af visitatoren
  routingregler: {},     // regelnøgle → { personId, begrundelse } — visitation, der er blevet permanent
  /* Alt, agenten har lært af svarene. Gemmes lokalt sammen med resten, så en
   * afvisning ikke går tabt, når fanen lukkes — den er den eneste kilde til
   * at vide, om diagnoserne rammer. */
  laering: {
    svar: [], priorJusteringer: {}, undertrykkelser: [],
    beloebsgraenser: {}, koblingsfejl: [], ruter: {},
  },
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
  sidsteKoersel: null,
  vandmaerker: {},
  anlaegsindeks: null,
  varsler: [],
  varslerVenter: [],
  systematiske: [],
  sigteregnskab: null,
  sigtedetaljer: null,
  raadata: {},
  planlaegger: null,
  log: [],
  lyttere: new Set(),
};

state.klienter = buildClients(state.cfg);

export function gem() {
  try {
    const { cfg, forudsaetninger, beslutninger, undertrykkelser, ansvarlige, visitationer, routingregler, vandmaerker, sidsteKoersel, laering } = state;
    localStorage.setItem(NØGLE, JSON.stringify({
      cfg, forudsaetninger, beslutninger, undertrykkelser, ansvarlige, visitationer, routingregler, vandmaerker, laering,
      // Kun hovedtallene fra sidste kørsel gemmes — ikke de hentede data.
      sidsteKoersel: sidsteKoersel && { ...sidsteKoersel, trin: sidsteKoersel.trin },
    }));
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
    opgaver: seed.OPGAVER_PORTEFOLJE,
    opgaveFagomraade: seed.OPGAVER_FAGOMRAADE,
    gentagneButik: seed.GENTAGNE_BUTIK,
    gentagneAnlaeg: seed.GENTAGNE_ANLAEG,
    fund: seed.AGENT_FUND,
    sol: {
      portefolje: seed.SOL_PORTEFOLJE, kilder: seed.SOL_KILDER, anlaeg: seed.SOL_ANLAEG,
      alarmer: seed.SOL_ALARMER, aabneKritiske: seed.SOL_AABNE_KRITISKE,
      kalibrering: seed.SOL_KALIBRERING, degradering: seed.SOL_DEGRADERING,
    },
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
/* ---- Agenten -------------------------------------------------------------
 * Kører hele kæden: kobling → normallast → korrelation mod Dalux → diagnose →
 * varsel til den fagansvarlige.
 *
 * Enhederne er RIGTIGE: anlæggene kommer fra Dalux og målerne fra Enity, og
 * koblingen mellem dem er den samme, som resten af hubben bruger. Døgnserierne
 * er derimod modellerede, indtil Enitys timedata er trukket med — og hvert
 * eneste varsel bærer det som forbehold, så ingen kommer til at læse et
 * konkret tal som en aflæsning.
 */
export async function koerAgenten() {
  const [{ koblButik }, { DEMO_ANLAEG, DEMO_MAALERE, DEMO_BUTIK, BUTIK_FAGGRUPPE }, { SCENARIER, byggScenarie }, { koerAgent }, { AARSAG }] =
    await Promise.all([
      import('./kobling.js'), import('./seed.js'), import('./scenarier.js'), import('./agent.js'), import('./aarsag.js'),
    ]);

  // koblButik svarer med { koblinger, enheder, ... } — analyseenhederne er
  // det felt, agenten skal have, ikke returværdien selv.
  const { enheder: alle } = koblButik(DEMO_ANLAEG, DEMO_MAALERE);
  const enheder = alle.filter((e) => e.faggruppe && e.meterId);

  /* Hver enhed får en scenarieserie — men den skal passe til enheden.
   *
   * Første udgave lagde et køleanlægs serie på 975 kWh/døgn ned over samtlige
   * målere, også lysmålerne. Det gav et varsel på 206.000 kr. på "Lys 1" i en
   * butik, hvis indendørs lys bruger 413 kWh/døgn i alt. Størrelsesordenen var
   * ren fiktion, og en demo, man ikke kan tale ud fra, er værre end ingen demo.
   *
   * Så: basis sættes efter butikkens FAKTISKE forbrug i den faggruppe, delt på
   * de enheder, der måler den, og der vælges kun scenarier, hvis årsag
   * overhovedet kan optræde i faggruppen. Valget er deterministisk ud fra
   * måler-id'et, så den samme enhed altid viser det samme.
   */
  const forbrug = {};
  for (const r of BUTIK_FAGGRUPPE) {
    if (r.butiksnummer === DEMO_BUTIK.kardex) forbrug[r.fg] = r.kwh;
  }
  const antalPrFg = {};
  for (const e of enheder) antalPrFg[e.faggruppe] = (antalPrFg[e.faggruppe] || 0) + 1;

  const relevanteScenarier = (fg) => SCENARIER.filter((sc) => {
    const a = AARSAG[sc.fejl];
    // 'ingen' har ingen årsag i kataloget og hører til overalt som kontrolprøve.
    return !a || !a.faggrupper || a.faggrupper.includes(fg);
  });

  const input = enheder.map((e, i) => {
    const kandidater = relevanteScenarier(e.faggruppe);
    if (!kandidater.length) return null;
    const froe = Number(e.meterId.slice(-4)) || i;
    /* Fordelt på enhedens plads i listen frem for på måler-id'et. Med id'et
     * klumpede valget: tre døde målere og tre totalhavarier i den samme butik,
     * hvilket ingen kan tale ud fra. */
    const sc = kandidater[i % kandidater.length];
    // Butikkens målte årsforbrug i faggruppen, delt på de enheder der måler den.
    const aar = forbrug[e.faggruppe];
    const basis = aar ? Math.max(8, Math.round(aar / (antalPrFg[e.faggruppe] || 1) / 365 * 0.8)) : 120;
    const s = byggScenarie(sc, {
      froe: 20260915 + froe,
      basis,
      // Vejrfølsomheden skaleres med anlægget — ellers får en lille måler en
      // temperaturrespons, der er større end den selv.
      tempkoef: Math.max(0.5, basis * 0.018),
      stoej: Math.max(4, basis * 0.08),
    });

    return {
      enhed: {
        id: e.id,
        navn: e.navn,
        butik: DEMO_BUTIK.navn,
        butiksnummer: DEMO_BUTIK.kardex,
        faggruppe: e.faggruppe,
        energirolle: e.energirolle,
        maaler: e.meterNavn,
        dedikeret: e.kanPegePaaAnlaeg,
        energienhed: e.energistroem === 'varme' ? 'varme' : 'el',
      },
      raekker: s.raekker,
      opgaver: s.opgaver,
      referenceSlut: 220,
    };
  }).filter(Boolean);

  const raa = koerAgent(input, { laering: state.laering });

  /* Sigten. Uden den drukner alt: 0,9 % falske alarmer gange 11.770
   * analyseenheder er 109 blindgyder hver nat, og det er tolv om dagen til
   * hver fagansvarlig mod en kapacitet på under én. Se src/flaade.js. */
  const { sigt } = await import('./flaade.js');
  const sigtet = sigt(raa, {
    aabne: state.varsler || [],
    maalFDR: 0.10,
    budget: state.cfg.varselbudget || 5,
  });
  state.varsler = sigtet.sendt;
  state.varslerVenter = sigtet.venter;
  state.systematiske = sigtet.systematiske;
  state.sigteregnskab = sigtet.regnskab;
  state.sigtedetaljer = sigtet.detaljer;

  const r = sigtet.regnskab;
  skriv(`Agenten kørte over ${input.length} enheder: ${r.ialt} varsler, hvoraf ${r.sendt} gik videre `
    + `(${r.faldtIGate} faldt i gaten, ${r.afvistAfFDR} afvist statistisk, ${r.iSystematisk} samlet i `
    + `systematiske fund, ${r.overBudget} venter).`, 'ok');
  opdater();
  return state.varsler;
}

export function koerDetektorer() {
  const d = state.data;
  if (!d) return;
  const index = Object.fromEntries(d.butikker.map((b) => [b.butiksnummer, b]));
  // Opgavedata er nøglet på kardex, energidata på butiksnummer. De er ofte ens,
  // men ikke altid — butikker, der kun kendes fra Dalux, lægges ind som skygge-
  // poster, så en sag om gentagne fejl ikke falder på gulvet.
  for (const g of [...(d.gentagneButik || []), ...(d.gentagneAnlaeg || [])]) {
    if (index[g.kardex]) continue;
    index[g.kardex] = {
      butiksnummer: g.kardex, navn: g.butik, kaede: 'Ukendt', by: '',
      salgsareal_m2: null, kwhAar: null, daekningPct: null,
      daluxBuildingId: null, enityBuildingId: null, kwhPrM2: null, kunDalux: true,
    };
  }
  const f = state.forudsaetninger;

  const signaler = [
    ...detektorDoedMaaler(d.butikker),
    ...detektorRestpost(d.butikker, f),
    ...detektorSpring(d.spring || [], index, f),
    ...detektorBenchmark(d.butikker, f),
    ...detektorNatlast(d.profiler || [], index, f),
    ...detektorKoeleandel(d.butikker, d.splits || [], f),
    ...detektorGentagneAnlaeg(d.gentagneAnlaeg || []),
    ...detektorGentagneButik(d.gentagneButik || []),
  ].filter((s) => !erUndertrykt(s));

  const sager = byggSager(signaler, index, {
    ...f,
    visitationer: state.visitationer || {},
    routingregler: state.routingregler || {},
  });
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

/**
 * Visitation: visitatoren sender en sag videre til en fagansvarlig.
 * Valget gemmes på sagstypen + butikken, så det holder, når detektorerne
 * kører igen — og så mønsteret kan gøres op bagefter. Rammer den samme
 * sagstype gang på gang den samme person, er det en regel, der mangler,
 * ikke en beslutning, nogen skal tage hver gang.
 */
export function visiter(sag, personId, note = '') {
  const noegle = nøgleFor(sag);
  if (personId) {
    state.visitationer[noegle] = personId;
    state.visitationslog = [{ noegle, personId, note, tid: new Date().toISOString(), sagstype: sag.sagstype },
      ...(state.visitationslog || [])].slice(0, 200);
  } else {
    delete state.visitationer[noegle];
  }
  gem(); koerDetektorer(); opdater();
}

/** Sagstyper, der gang på gang visiteres til den samme person. */
export function visitationsmoenstre() {
  const pr = {};
  for (const [noegle, personId] of Object.entries(state.visitationer)) {
    const sagstype = noegle.split('|')[1];
    (pr[sagstype] ||= {})[personId] = ((pr[sagstype] || {})[personId] || 0) + 1;
  }
  return Object.entries(pr)
    .map(([sagstype, fordeling]) => {
      const poster = Object.entries(fordeling).sort((a, b) => b[1] - a[1]);
      const ialt = poster.reduce((a, x) => a + x[1], 0);
      return { sagstype, personId: poster[0][0], antal: poster[0][1], ialt, andel: poster[0][1] / ialt };
    })
    .filter((m) => m.ialt >= 3 && m.andel >= 0.8)
    .sort((a, b) => b.antal - a.antal);
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
