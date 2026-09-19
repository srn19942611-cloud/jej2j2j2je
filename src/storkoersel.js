/* Den store kørsel: hele porteføljen, fra to tabeller til varsler pr. faggruppe.
 *
 * Signaturerne kan ikke måles herfra — Enity ligger bag en proxy, der afviser
 * værten. Så de måles dér, hvor data er, og skrives i en tabel. Opgaverne fra
 * Dalux ligeså. Det, der sker HER, er alt det, der kræver fagligheden: hvad
 * formen betyder, hvem der har anlægget, om det er set før, og hvad det er
 * værd at gøre ved.
 *
 * Kæden, i den rækkefølge den kører:
 *
 *   1. Målerne får en faggruppe af deres TAGS — ikke af navnet. Navnet var
 *      en nødløsning på de første fyrre rækker; tagmappingen er den rigtige.
 *   2. Opgaverne fordeles på målerne, mistroisk (korrelation.fordelOpgaver).
 *   3. Kvartersdetektorernes fund lægges på som bekræftelse, hvor de findes.
 *   4. Hver signatur bliver til et varsel ad den samme vej som agentens egen.
 *   5. Sigten: gate, dedupering, FDR, systematiske fejl, budget.
 *   6. Første kørsel: straks / kampagne / sambesøg, og et skøn over tiden.
 *   7. Alt grupperes pr. faggruppe og pr. ejer — det er dét, der skal ud.
 *
 * Alt, der ikke kan bruges, følger med ud med en grund. En kørsel, der taber
 * rækker i stilhed, er en kørsel, ingen kan stole på.
 */

import { klassificerMaalepunkt } from './anlaeg.js';
import { energistroem, udtraekKoder, koblButik } from './kobling.js';
import { signaturFraMaaling } from './maaling.js';
import { fordelOpgaver, normButik } from './korrelation.js';
import { varselFraSignatur, PRISER } from './agent.js';
import { sigt, foersteKoersel, STANDARDBUDGET } from './flaade.js';
import { fgNavn } from './taxonomy.js';

/* ---- Rækker fra databasen ------------------------------------------------- */

const tal = (x) => (x === null || x === undefined || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const tekst = (x) => (x === null || x === undefined ? '' : String(x));

/** En signaturrække, som porteføljekørslen skriver den, til den form maaling.js læser. */
export function signaturFraDb(r) {
  const tags = tekst(r.tags).split('|').map((t) => t.trim()).filter(Boolean);
  return {
    koerselId: tekst(r.koersel_id) || null,
    butiksnummer: tekst(r.butiksnummer), butiksnavn: tekst(r.butiksnavn),
    maalerId: tekst(r.enity_meter_id), navn: tekst(r.maaler_navn),
    tags, energitype: tekst(r.energitype) || 'Electricity',
    status: tekst(r.status) || 'ok',
    referencedoegn: tal(r.reference_doegn), segmentdoegn: tal(r.segment_doegn),
    celler: tal(r.celler), andelUdenfor: tal(r.andel_udenfor),
    brudDato: r.brud_dato ? tekst(r.brud_dato).slice(0, 10) : null,
    brudStyrke: tal(r.brud_styrke), overgangsdoegn: tal(r.overgang_doegn),
    medianForudsagt: tal(r.median_forudsagt), medianResidual: tal(r.median_residual),
    afvigPct: tal(r.afvig_pct), restniveau: tal(r.restniveau),
    vejrforhold: tal(r.vejrforhold), b: tal(r.b),
    vurderingsdoegn: 120,
  };
}

/** En Dalux-række til den form korrelation.js læser. */
export function opgaveFraDb(r) {
  return {
    opgavenr: tekst(r.opgavenr), butiksnummer: tekst(r.butiksnummer) || null,
    daluxBuildingId: tekst(r.dalux_building_id) || null,
    anlaegId: tekst(r.anlaeg_id) || null, anlaeg: tekst(r.anlaeg_navn),
    dato: r.oprettet ? tekst(r.oprettet).slice(0, 10) : null,
    lukket: r.lukket ? tekst(r.lukket).slice(0, 10) : null,
    fagomraade: tekst(r.fagomraade) || null,
    tekst: tekst(r.tekst) || tekst(r.titel),
    titel: tekst(r.titel), status: tekst(r.status) || null,
    udfoerende: tekst(r.udfoerende) || null,
    afvistAf: tekst(r.afvist_af) || null, afvistBegrundelse: tekst(r.afvist_begrundelse) || null,
  };
}

/**
 * En arbejdsordre direkte fra Dalux' API til den form korrelation.js læser.
 *
 * Kun 9 af 40 ordrer på Aarhus C havde et anlæg (assetRefs) på sig — resten
 * har kun en fritekst i placement.description. Så koblingen skal kunne bruge
 * begge: anlægs-id'et, når det findes, og ellers teksten. Status er et tal
 * og skal slås op i statuslisten; det samme med firmaet.
 */
/* Dalux' statuskoder, slået op 2026-09-19. De to afvisningsstatusser er
 * forskellige sager: 5 er afvist af os, 6 af leverandøren. */
export const DALUX_STATUS = {
  1: 'New', 2: 'Started', 4: 'Completed', 5: 'Rejected', 6: 'RejectedByExternal', 7: 'WaitingForApproval',
  8: 'StartedExternal', 9: 'Unknown', 10: 'NewAwaitingOrder', 11: 'OrderedAwaitingExternal',
  12: 'OrderedApprovedByExternal', 13: 'ExternalCompletionRejected', 14: 'EmployeeCompletedAwaitingDispatcher',
  15: 'EmployeeCompletionRejected', 16: 'ApprovedAwaitingCustomer',
};

export function opgaveFraDalux(wo, { statusNavne = DALUX_STATUS, anlaegNavne = {}, firmaNavne = {}, butiksnummer = null } = {}) {
  const w = wo?.data || wo || {};
  const pl = w.placement || {};
  const assetId = (pl.assetRefs || [])[0]?.assetId ?? null;
  const bygning = (pl.buildingRefs || [])[0]?.buildingId ?? null;
  return {
    opgavenr: tekst(w.number), workOrderId: tekst(w.workOrderId),
    butiksnummer: butiksnummer ? normButik(butiksnummer) : null,
    daluxBuildingId: bygning != null ? tekst(bygning) : null,
    anlaegId: assetId != null ? tekst(assetId) : null,
    anlaeg: [assetId != null ? anlaegNavne[tekst(assetId)] : null, pl.description].filter(Boolean).join(' · '),
    dato: w.createdDate ? tekst(w.createdDate).slice(0, 10) : null,
    lukket: w.completedDate ? tekst(w.completedDate).slice(0, 10) : null,
    fagomraade: null,                                   // Dalux' template/team er ikke vores fagområde; kobles i taxonomy
    tekst: [tekst(w.name), tekst(w.description)].filter(Boolean).join(' — '),
    titel: tekst(w.name),
    status: statusNavne[tekst(w.status)] || tekst(w.status) || null,
    type: tekst(w.type) || null,
    udfoerende: firmaNavne[tekst((w.companyRef || {}).companyId)] || null,
    afvistAf: null, afvistBegrundelse: null,            // ligger i historikloggen, ikke på ordren
  };
}

/**
 * Opgaver, der kun kender Dalux-bygningen, får butiksnummeret fra locations.
 * Kan bygningen ikke slås op, bliver opgaven stående uden — og falder så som
 * ufordelt i fordelOpgaver med den grund. Den bliver ikke gættet på plads.
 */
export function butiksnummerFraBygning(opgaver, locations) {
  const prBygning = new Map();
  for (const l of locations || []) {
    if (l.dalux_building_id && l.butiksnummer) prBygning.set(String(l.dalux_building_id), normButik(l.butiksnummer));
  }
  let koblet = 0;
  const ud = (opgaver || []).map((o) => {
    if (o.butiksnummer || !o.daluxBuildingId) return o;
    const bn = prBygning.get(String(o.daluxBuildingId));
    if (!bn) return o;
    koblet++;
    return { ...o, butiksnummer: bn };
  });
  return { opgaver: ud, koblet, udenButik: ud.filter((o) => !o.butiksnummer).length };
}

/**
 * Kvartersdetektorernes rækker → én bekræftelse pr. måler.
 *
 * Kun flag tæller, og kun de detektorer, aarsag.js kender som bekræftelse.
 * Er der flere på samme måler, vinder den, der siger mest om årsagen:
 * samtidig køl/varme foran weekend foran nat.
 */
const DETEKTOR_TIL_BEKRAEFTELSE = { samtidig: 'samtidig_koel_varme', weekend: 'weekenddrift', nat: 'natforbrug', afrimning: 'afrimning', kortcykling: 'kortcykling' };
const BEKRAEFTELSE_RANG = ['samtidig_koel_varme', 'kortcykling', 'afrimning', 'weekenddrift', 'natforbrug'];

export function bekraeftelserFraDb(rows) {
  const pr = new Map();
  for (const r of rows || []) {
    if (!r.flag) continue;
    const b = DETEKTOR_TIL_BEKRAEFTELSE[tekst(r.detektor)];
    if (!b) continue;
    /* Et par, hvor den ene er overskudsvarme, er ikke spild — Svendborg. */
    if (b === 'samtidig_koel_varme' && /overskudsvarme/i.test(tekst(r.note))) continue;
    const id = tekst(r.enity_meter_id);
    const nu = pr.get(id);
    if (!nu || BEKRAEFTELSE_RANG.indexOf(b) < BEKRAEFTELSE_RANG.indexOf(nu.bekraeftelse)) {
      pr.set(id, { bekraeftelse: b, detektor: tekst(r.detektor), note: tekst(r.note), vaerdier: [tal(r.vaerdi_1), tal(r.vaerdi_2), tal(r.vaerdi_3)], kwh: tal(r.kwh_i_perioden) });
    }
  }
  return pr;
}

/* ---- Årsniveau: forrige 12 måneder mod sidste 12 --------------------------------
 *
 * Trin 1 på observerbarhedstrappen, og det eneste trin, hele porteføljen
 * står på i dag: consumption_monthly dækker 1.145 butikker, døgndata kun
 * elleve. Så det her er den kørsel, der faktisk kan nå alle.
 *
 * Det, den ikke kan: vejrkorrigere, finde en bruddato, eller give en
 * p-værdi. Uden z falder rækken i FDR-sigten — og det er rigtigt, for en
 * varm sommer kan alene flytte et køleanlæg 15 %. Det, der bærer sig selv,
 * er de direkte aflæsninger: måleren i nul, anlægget på en tiendedel.
 * Resten er "kig nærmere, når døgndata kommer", og det siges i forbeholdet.
 *
 * Og før nogen række overhovedet regnes, skal butiksniveauet skilles fra
 * anlægsniveauet. Første kørsel fandt 611 målere "i nul" — 451 af dem faldt
 * i marts–april 2025, 289 hovedmålere, og en stribe brugsforeninger mistede
 * alle målere på én gang i november 2025. Det er lukkede butikker og
 * leveringsskift, ikke 611 anlæg. Filtreringen ligger i `aarsudvalg`.
 */
export function signaturFraAarsforhold(r, { koerselId = 'AAR', doegnPrAar = 365 } = {}) {
  const f = Number(r.f) / doegnPrAar, s = Number(r.s) / doegnPrAar;
  return signaturFraDb({
    koersel_id: koerselId, butiksnummer: r.b, butiksnavn: r.bn, enity_meter_id: r.m, maaler_navn: r.n, tags: r.t,
    energitype: 'Electricity', status: 'ok', reference_doegn: doegnPrAar, segment_doegn: doegnPrAar,
    median_forudsagt: f, median_residual: s - f, afvig_pct: f > 0 ? 100 * (s - f) / f : null, restniveau: f > 0 ? s / f : null,
  });
}

/**
 * Hvilke årsrækker må regnes på? Returnerer de brugbare og et regnskab over
 * resten — hver med den grund, der holdt den ude.
 */
export function aarsudvalg(rows, { scope = 'coop', butiksfald = new Set(), boelgeMaaneder = ['2025-02', '2025-03', '2025-04'] } = {}) {
  const regnskab = { ialt: rows.length, ikkeScope: 0, butiksfald: 0, boelge: 0, brugt: 0 };
  const brugbare = [];
  for (const x of rows) {
    if (scope && x.sc !== scope) { regnskab.ikkeScope++; continue; }
    if (butiksfald.has(normButik(x.b))) { regnskab.butiksfald++; continue; }
    const sn = String(x.sn || '').slice(0, 7);
    if ((x.k === 'nul' || x.k === 'staar') && boelgeMaaneder.includes(sn)) { regnskab.boelge++; continue; }
    regnskab.brugt++;
    brugbare.push(x);
  }
  return { brugbare, regnskab };
}

/* ---- Anlæg ↔ måler for hele porteføljen ------------------------------------
 *
 * anlaeg_maalepunkt i databasen er tom — koblingen blev aldrig udfyldt. Men
 * anlæggene ligger dér (38.752 i 530 butikker), og målerne ligeså, så den
 * sikre del af koblingen kan regnes: anlægskoden, der står i begge navne.
 * VE02.1 i Dalux og "VE.02 Slagter" i Enity er den samme kode.
 *
 * Det gav 330 par, 232 målere, 50 butikker første gang. Det er lidt, og det
 * er ærligt: kun 1.594 af 22.374 energirelevante anlæg bærer overhovedet en
 * kode i navnet. Resten kan kun kobles på klasse mod tag, og det gør
 * kobling.koblButik pr. butik — men den kræver hele anlægslisten pr. butik
 * og køres derfor kun dér, hvor der er noget at koble til.
 */
export function koblingFraTabeller(anlaegRows, meterRows) {
  const prButikAnlaeg = new Map();
  for (const a of anlaegRows || []) {
    const koder = udtraekKoder(a.navn);
    if (!koder.size) continue;
    const b = normButik(a.butiksnummer);
    if (!prButikAnlaeg.has(b)) prButikAnlaeg.set(b, []);
    prButikAnlaeg.get(b).push({ id: tekst(a.dalux_asset_id), navn: tekst(a.navn), klasse: tekst(a.klassifikation_navn), koder });
  }
  const ud = {};
  let par = 0;
  for (const m of meterRows || []) {
    const koder = udtraekKoder(m.navn ?? m.maaler_navn);
    if (!koder.size) continue;
    const liste = prButikAnlaeg.get(normButik(m.butiksnummer)) || [];
    const traef = liste.filter((a) => [...a.koder].some((k) => koder.has(k)));
    if (!traef.length) continue;
    ud[tekst(m.enity_meter_id)] = traef.map((a) => ({ id: a.id, navn: a.navn, klasse: a.klasse }));
    par += traef.length;
  }
  return { anlaegPrMaaler: ud, par, maalere: Object.keys(ud).length };
}

/**
 * Den fulde kobling pr. butik — anlægskode, dernæst anlægsklasse mod tag.
 *
 * Den kodebaserede kobling alene gav 2 af 20 målere i Vordingborg et anlæg,
 * og så kunne 339 af 351 opgaver ikke kobles: elevatorer, alarmer,
 * køleposition 76B. Elevatorerne skal ikke kobles. Men "Pos. 76B — høj temp"
 * er en køleordre, og den hører til konsumkøl-måleren som gruppe — det er
 * netop det, koblButik's trin 2–3 gør, og de kræver hele anlægslisten pr.
 * butik. Kun de energirelevante anlæg gives med; døre og hylder holdes ude.
 */
export function koblingPrButik(anlaegRows, meterRows) {
  const prButik = new Map();
  for (const a of anlaegRows || []) {
    const b = normButik(a.butiksnummer);
    if (!prButik.has(b)) prButik.set(b, { anlaeg: [], maalere: [] });
    prButik.get(b).anlaeg.push({ asset_id: tekst(a.dalux_asset_id), name: tekst(a.navn), classification_name: tekst(a.klassifikation_navn), description: tekst(a.placering) });
  }
  for (const m of meterRows || []) {
    const b = normButik(m.butiksnummer);
    if (!prButik.has(b)) prButik.set(b, { anlaeg: [], maalere: [] });
    const tags = Array.isArray(m.tags) ? m.tags : tekst(m.tags).split('|').map((t) => t.trim()).filter(Boolean);
    prButik.get(b).maalere.push({ id: tekst(m.enity_meter_id), name: tekst(m.navn ?? m.maaler_navn), tags, energyType: tekst(m.energitype) });
  }
  const ud = {};
  const regnskab = { butikker: 0, enheder: 0, medAnlaeg: 0, delt: 0 };
  for (const [, { anlaeg, maalere }] of prButik) {
    if (!anlaeg.length || !maalere.length) continue;
    const r = koblButik(anlaeg, maalere);
    regnskab.butikker++;
    for (const e of r.enheder) {
      regnskab.enheder++;
      if (!e.anlaeg?.length) continue;
      regnskab.medAnlaeg++;
      if (e.slags === 'gruppe') regnskab.delt++;
      ud[e.meterId] = e.anlaeg.map((a) => ({ id: tekst(a.id), navn: a.navn }));
    }
  }
  return { anlaegPrMaaler: ud, regnskab };
}

/* ---- Enheden: måleren som analyseenhed ------------------------------------ */

/**
 * En signaturrække bliver til en enhed, agenten kan adressere.
 * Faggruppen kommer af tagmappingen. Har måleren ingen brugbar klassifikation,
 * bliver faggruppen null — og så afviser diagnosen den med grund, i stedet for
 * at gætte. Det er med vilje; se aarsag.IKKE_DIAGNOSTICERBAR.
 */
export function enhedFraSignatur(s, { anlaeg = [] } = {}) {
  const meter = { tags: s.tags, energyType: s.energitype, name: s.navn };
  const k = klassificerMaalepunkt(meter);
  const e = energistroem(meter);
  /* Klassifikatoren svarer "oevrigt" med konfidens 0, når den ikke ved det.
   * Det er et rimeligt svar til en oversigt og et forkert svar til en
   * diagnose: her skal ukendt være null, så motoren afviser med grund i
   * stedet for at lede efter en årsag i faggruppen "øvrigt". Første prøve
   * sendte 38 af 40 målere den vej. */
  const fg = k.konfidens > 0 && k.faggruppe !== 'oevrigt' ? k.faggruppe : (e.fg || null);
  return {
    id: `E-${s.maalerId}`,
    slags: anlaeg.length > 1 ? 'gruppe' : 'anlæg',
    navn: s.navn, meterId: s.maalerId, meterNavn: s.navn, maaler: s.navn, tags: s.tags,
    butik: s.butiksnavn || s.butiksnummer, butiksnummer: s.butiksnummer,
    anlaeg,
    faggruppe: fg,
    maalerrolle: k.maalerrolle && k.maalerrolle !== 'bimaaler' ? k.maalerrolle : null,
    energirolle: e.rolle,
    energienhed: e.stroem === 'varme' ? 'varme' : 'el',
    dedikeret: anlaeg.length <= 1,
    klassifikationskonfidens: k.konfidens,
  };
}

/* ---- Selve kørslen --------------------------------------------------------- */

export function storkoersel({
  signaturer = [], opgaver = [], kvarter = [], anlaegPrMaaler = {},
  aabne = [], laering = null, priser = PRISER, budget = STANDARDBUDGET, personer = 9, nu = new Date(),
} = {}) {
  const regnskab = { signaturer: signaturer.length, opgaver: opgaver.length, kvarterRaekker: kvarter.length };

  /* 1 · Enheder. Rækker, endpointet selv afviste, bliver til fund af den
   * slags "anlægget stod stille i referencen" — de skal ses, ikke tabes. */
  const enheder = [];
  const ikkeModelleret = [];
  for (const s of signaturer) {
    const e = enhedFraSignatur(s, { anlaeg: anlaegPrMaaler[s.maalerId] || [] });
    if (s.status && s.status !== 'ok') { ikkeModelleret.push({ enhed: e, status: s.status, signaturraekke: s }); continue; }
    enheder.push({ enhed: e, raekke: s });
  }
  regnskab.ikkeModelleret = ikkeModelleret.length;

  /* 2 · Opgaverne på enhederne. */
  const fordeling = fordelOpgaver(enheder.map((x) => x.enhed), opgaver);
  regnskab.opgaverFordelt = fordeling.begrundelser.length;
  regnskab.opgaverUfordelt = fordeling.ufordelt.length;

  /* 3 · Kvartersbekræftelser. */
  const bekraeftelser = bekraeftelserFraDb(kvarter);
  regnskab.bekraeftelser = bekraeftelser.size;

  /* 4 · Varsler. */
  const varsler = [];
  const ikkeDiagnoserbare = [];
  const ingenAfvigelse = [];
  const afvistSignatur = [];
  for (const { enhed, raekke } of enheder) {
    const bek = bekraeftelser.get(raekke.maalerId);
    const signatur = signaturFraMaaling({ ...raekke, bekraeftelse: bek?.bekraeftelse || null });
    if (!signatur.brugbar) { afvistSignatur.push({ enhed, grund: signatur.grund }); continue; }
    const egne = fordeling.prEnhed[enhed.id] || [];
    const v = varselFraSignatur(enhed, signatur, { opgaver: egne, historik: egne, priser, laering, nu });
    if (!v) { ingenAfvigelse.push(enhed); continue; }
    if (v.ikkeDiagnoserbar) { ikkeDiagnoserbare.push(v); continue; }
    if (bek) v.kvarter = bek;
    varsler.push(v);
  }
  regnskab.afvistSignatur = afvistSignatur.length;
  regnskab.ingenAfvigelse = ingenAfvigelse.length;
  regnskab.ikkeDiagnoserbare = ikkeDiagnoserbare.length;
  regnskab.varsler = varsler.length;

  /* 5 · Sigten. */
  const sigtet = sigt(varsler, { aabne, budget });

  /* 6 · Første kørsel: hvad der kan slås sammen, og hvor lang tid bunken tager. */
  const foerste = foersteKoersel(sigtet.sendt.concat(sigtet.venter), { budget, personer });

  /* 7 · Pr. faggruppe og pr. ejer. */
  const prFaggruppe = grupper(varsler, (v) => v.faggruppe || 'ukendt', (fg) => fgNavn(fg) || fg);
  const prEjer = grupper(sigtet.sendt.concat(sigtet.venter), (v) => v.ejerId || 'ingen', (id, liste) => liste[0]?.ejerNavn || 'ingen');

  return {
    koerselId: signaturer[0]?.koerselId || null,
    tidspunkt: nu.toISOString(),
    regnskab: { ...regnskab, ...sigtet.regnskab },
    varsler, sigtet, foerste, prFaggruppe, prEjer,
    ikkeDiagnoserbare, ikkeModelleret, afvistSignatur,
    ufordelteOpgaver: fordeling.ufordelt,
    opgavekoblinger: fordeling.begrundelser,
  };
}

function grupper(liste, noegle, navn) {
  const m = new Map();
  for (const v of liste) {
    const k = noegle(v);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(v);
  }
  return [...m].map(([k, vs]) => ({
    id: k, navn: navn(k, vs), antal: vs.length,
    hastende: vs.filter((v) => v.hastende).length,
    /* Tre beløbsklasser, aldrig lagt sammen. */
    besparelseKr: sum(vs.filter((v) => v.krKlasse === 'besparelse'), 'kr'),
    potentialeKr: sum(vs.filter((v) => v.krKlasse === 'potentiale'), 'kr'),
    butikker: new Set(vs.map((v) => normButik(v.butiksnummer))).size,
    aarsager: taelAf(vs, (v) => v.aarsagNavn),
    varsler: vs.sort((a, b) => Number(b.hastende) - Number(a.hastende) || b.kr - a.kr),
  })).sort((a, b) => b.hastende - a.hastende || b.antal - a.antal);
}
const sum = (xs, k) => xs.reduce((s, x) => s + (x[k] || 0), 0);
function taelAf(xs, f) {
  const m = new Map();
  for (const x of xs) m.set(f(x), (m.get(f(x)) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([navn, antal]) => ({ navn, antal }));
}

/* ---- Rapporten som tekst ---------------------------------------------------
 * Til den, der læser den i en terminal eller en mail. Ikke pynt: det er
 * regnskabet, der skal kunne læses, for det er dér, en kørsel viser, om den
 * har tabt noget undervejs.
 */
export function rapportTekst(r) {
  const l = [];
  const k = r.regnskab;
  const kr = (n) => Math.round(n).toLocaleString('da-DK');
  l.push(`STOR KØRSEL · ${r.tidspunkt.slice(0, 16).replace('T', ' ')}${r.koerselId ? ` · ${r.koerselId}` : ''}`);
  l.push('');
  l.push('REGNSKAB');
  l.push(`  signaturrækker ind        ${k.signaturer}`);
  l.push(`    ikke modelleret         ${k.ikkeModelleret}   (stilstand, for få data, ekstrapolation)`);
  l.push(`    afvist ved efterprøvning ${k.afvistSignatur}   (tallene hang ikke sammen)`);
  l.push(`    ingen afvigelse         ${k.ingenAfvigelse}`);
  l.push(`    ikke diagnosticerbare   ${k.ikkeDiagnoserbare}   (samlemålere, lejere, mangler tag)`);
  l.push(`    varsler                 ${k.varsler}`);
  l.push(`  sigten`);
  l.push(`    faldt i gaten           ${k.faldtIGate}`);
  l.push(`    gengangere              ${k.gengangere}`);
  l.push(`    afvist af FDR           ${k.afvistAfFDR}   (p-grænse ${k.pGraense?.toExponential ? k.pGraense.toExponential(1) : k.pGraense}, forventet falske ${k.forventedeFalske})`);
  l.push(`    i systematiske fund     ${k.iSystematisk}`);
  l.push(`    sendt                   ${k.sendt}`);
  l.push(`    venter på budget        ${k.overBudget}`);
  l.push(`  opgaver ind ${k.opgaver} · fordelt på målere ${k.opgaverFordelt} · ufordelt ${k.opgaverUfordelt}`);
  l.push(`  kvartersbekræftelser ${k.bekraeftelser}`);
  l.push('');
  l.push('PR. FAGGRUPPE');
  for (const g of r.prFaggruppe) {
    l.push(`  ${g.navn.padEnd(22)} ${String(g.antal).padStart(4)} varsler · ${g.butikker} butikker · ${g.hastende} haster · besparelse ${kr(g.besparelseKr)} kr · potentiale ${kr(g.potentialeKr)} kr`);
    for (const a of g.aarsager.slice(0, 4)) l.push(`      ${String(a.antal).padStart(3)}  ${a.navn}`);
  }
  l.push('');
  l.push('PR. EJER (efter sigten)');
  for (const g of r.prEjer) {
    l.push(`  ${g.navn.padEnd(22)} ${String(g.antal).padStart(4)} · ${g.hastende} haster · besparelse ${kr(g.besparelseKr)} kr · potentiale ${kr(g.potentialeKr)} kr`);
  }
  if (r.sigtet.systematiske.length) {
    l.push('');
    l.push('SYSTEMATISKE FUND');
    for (const s of r.sigtet.systematiske) l.push(`  ${s.navn || s.aarsagId} · ${s.butikker} butikker${s.samtidig ? ' · samtidig' : ''}`);
  }
  if (r.foerste) {
    l.push('');
    l.push('FØRSTE KØRSEL');
    l.push(`  straks ${r.foerste.straks?.length ?? 0} · kampagner ${r.foerste.kampagner?.length ?? 0} · sambesøg ${r.foerste.sambesoeg?.length ?? 0} · alene ${r.foerste.alene?.length ?? 0}`);
    const o = r.foerste.opgoerelse;
    if (o) for (const [k, v] of Object.entries(o)) l.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
  return l.join('\n');
}
