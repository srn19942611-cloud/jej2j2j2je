/* Anlægs- og faggruppemotoren.
 *
 * Opgaven: læs en Dalux-opgave og find ud af, HVILKET anlæg den handler om —
 * og derfra hvilken faggruppe den hører til.
 *
 * Nogle gange står det direkte. Oftere gør det ikke. Af 23.040 rigtige
 * opgaver har kun 5.909 udfyldt anlægsfeltet, og feltet indeholder tit et
 * STED frem for et anlæg: "Lager", "Slagter", "Grøntafdeling", "På lagret".
 * Resten skal læses ud af fritekst.
 *
 * Motoren er bygget på tre principper:
 *
 *  1. Anlægget først, faggruppen bagefter. Kan vi pege på et konkret anlæg i
 *     butikkens register, kender vi dets klassifikation — og faggruppen følger
 *     af klassifikationen. Det er langt mere pålideligt end at gætte ud fra ord.
 *
 *  2. Kandidatmængden skal være lille. Vi matcher aldrig mod alle 50.000 anlæg,
 *     men kun mod dem, der står i netop den butik. Det gør et svagt tekstmatch
 *     til et stærkt et.
 *
 *  3. Handlingsord må aldrig bestemme emnet. "Ovnen kan ikke gøre sig selv REN"
 *     er en ovn, ikke rengøring. Ord som rens, vask, skift, service, eftersyn
 *     og tilbud beskriver, hvad der skal gøres — ikke hvad det handler om.
 *     Uden den regel bliver en bageriovn til en rengøringsopgave.
 *
 * Motoren svarer altid med et trin, en konfidens og en begrundelse — og den
 * har lov til at sige "kan ikke afgøres". Det er en ekspertegenskab, ikke en
 * mangel: andelen af uafklarede sager er et sundhedstegn i begge retninger.
 */

import { klassificerOpgave, fraAnlaeg, FO, laesButik } from './opgaver.js';
import { ANLAEGSKLASSER } from './anlaeg.js';

/* ---- Normalisering -------------------------------------------------------- */

const STOPORD = new Set([
  'og', 'i', 'på', 'til', 'af', 'den', 'det', 'der', 'som', 'er', 'har', 'kan',
  'ikke', 'vi', 'en', 'et', 'for', 'med', 'fra', 'ved', 'om', 'hvis', 'skal',
  'blev', 'bliver', 'vores', 'jeg', 'du', 'de', 'man', 'hej', 'tak', 'mvh',
]);

/** Handlingsord: beskriver hvad der skal gøres, ikke hvad det handler om. */
const HANDLINGSORD = new Set([
  'rengøring', 'rengøre', 'rengjort', 'ren', 'rens', 'rensning', 'renses',
  'vask', 'vaskes', 'vasket', 'skift', 'skiftes', 'udskift', 'udskiftning',
  'service', 'servicering', 'eftersyn', 'tilsyn', 'kontrol', 'gennemgang',
  'tilbud', 'bestilling', 'bestil', 'reparation', 'reparer', 'rep', 'montering',
  'opsætning', 'nedtagning', 'flytning', 'budget', 'akut', 'haster',
]);

export const normaliser = (s) => String(s || '')
  .toLowerCase()
  .replace(/[‘’“”]/g, "'")
  .replace(/[^\wæøåäöüé\s./-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const ord = (s) => normaliser(s).split(' ').filter((o) => o.length > 2 && !STOPORD.has(o));

/** Let dansk stammematch: "bageren"/"bageri"/"bager" og "ovn"/"ovne" hører
 *  sammen, uden at hive en fuld stemmer ind. Fire tegns fælles forstavelse
 *  er nok til at binde dem, og kort nok til ikke at binde tilfældige ord. */
function beslaegtet(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return a.length > 2 && b.length > 2 && (a.startsWith(b) || b.startsWith(a));
  const n = Math.min(a.length, b.length, 5);
  return a.slice(0, n) === b.slice(0, n);
}

/* ---- Anlægsindeks ---------------------------------------------------------
 * Bygges pr. butik. Nøglen er kardex, så kandidatmængden bliver de anlæg, der
 * faktisk står i butikken — typisk 20–200 stykker frem for 50.000.
 */

/** Positionskoder, som Dalux bruger på kølemøbler: "Pos. 117A", "Pos 14A". */
const POSITION = /\bpos\.?\s?(\d{1,4}\s?[a-zæøå]?)\b/gi;
/** Anlægs-id'er: "205769-01", "13711-01", "AVS.01", "PVE298100-1". */
const ANLAEGS_ID = /\b([A-ZÆØÅ]{2,5}[.\-]?\d{1,3}|\d{4,8}[-.]\d{1,3}|[A-ZÆØÅ]{2,6}\d{4,9}[-.]?\d?)\b/g;

export function byggAnlaegsindeks(anlaegsliste) {
  const prButik = new Map();
  for (const a of anlaegsliste || []) {
    const kardex = String(a.kardex ?? a.butiksnummer ?? '').trim();
    if (!kardex) continue;
    if (!prButik.has(kardex)) prButik.set(kardex, []);
    const navn = a.name ?? a.navn ?? '';
    prButik.get(kardex).push({
      id: String(a.asset_id ?? a.id ?? ''),
      navn,
      beskrivelse: a.description ?? a.beskrivelse ?? '',
      klasse: a.classification_name ?? a.klasse ?? null,
      kode: a.classification_code ?? a.kode ?? null,
      kardex,
      tokens: new Set([...ord(navn), ...ord(a.description ?? '')]),
      positioner: new Set([...String(navn).matchAll(POSITION)].map((m) => normaliser(m[1]).replace(/\s/g, ''))),
      idNoegler: new Set([...String(navn).matchAll(ANLAEGS_ID)].map((m) => normaliser(m[1]))),
    });
  }
  return prButik;
}

/* ---- Klassifikation → faggruppe ------------------------------------------- */

const KLASSE_INDEX = new Map(ANLAEGSKLASSER.map((k) => [normaliser(k.navn), k]));

/** Slår en Dalux-anlægsklasse op og finder faggruppen. Matcher på præfiks,
 *  så "AFLEVERING - Ventilationsanlæg" rammer "Ventilationsanlæg". */
export function faggruppeForKlasse(klassenavn) {
  if (!klassenavn) return null;
  const n = normaliser(klassenavn).replace(/^aflevering\s*-\s*/, '');
  if (KLASSE_INDEX.has(n)) return KLASSE_INDEX.get(n);
  let bedst = null;
  for (const [navn, k] of KLASSE_INDEX) {
    if ((n.startsWith(navn) || navn.startsWith(n)) && (!bedst || navn.length > normaliser(bedst.navn).length)) bedst = k;
  }
  return bedst;
}

/* ---- Trin 1–3 · find anlægget --------------------------------------------- */

/**
 * Finder det anlæg, opgaven handler om, blandt butikkens egne anlæg.
 * Returnerer trin, konfidens, begrundelse og de kandidater, der var i spil —
 * så en fagansvarlig kan se, hvorfor motoren valgte som den gjorde.
 */
export function findAnlaeg(opgave, indeks) {
  const kardex = String(opgave.kardex ?? laesButik(opgave.building).kardex ?? '').trim();
  const kandidater = (indeks && indeks.get(kardex)) || [];
  const tekst = [opgave.taskName, opgave.description, opgave.workDescription, opgave.asset].filter(Boolean).join(' ');

  if (!kandidater.length) {
    return {
      trin: 0, anlaeg: null, konfidens: 0, kandidater: [],
      begrundelse: kardex
        ? `Butikken (kardex ${kardex}) har ingen anlæg i registret — der er intet at matche imod.`
        : 'Opgaven har ingen butiksreference, så kandidatmængden kan ikke afgrænses.',
    };
  }

  // Trin 1 · eksplicit anlægs-id i opgaven, matchet mod butikkens register.
  const idIOpgaven = new Set([...String(tekst).matchAll(ANLAEGS_ID)].map((m) => normaliser(m[1])));
  if (idIOpgaven.size) {
    const traef = kandidater.filter((k) => [...k.idNoegler].some((n) => idIOpgaven.has(n)));
    if (traef.length === 1) {
      return { trin: 1, anlaeg: traef[0], konfidens: 1, kandidater: traef,
        begrundelse: `Anlægs-id "${traef[0].navn}" står direkte i opgaven og findes i butikkens register.` };
    }
    if (traef.length > 1) {
      return { trin: 1, anlaeg: null, konfidens: 0, kandidater: traef,
        begrundelse: `${traef.length} anlæg i butikken deler det id, opgaven nævner. Det kan ikke afgøres herfra.` };
    }
  }

  // Trin 2 · positionskode. "Pos. 117A" peger på ét kølemøbel.
  const posIOpgaven = new Set([...String(tekst).matchAll(POSITION)].map((m) => normaliser(m[1]).replace(/\s/g, '')));
  if (posIOpgaven.size) {
    const traef = kandidater.filter((k) => [...k.positioner].some((p) => posIOpgaven.has(p)));
    if (traef.length === 1) {
      return { trin: 2, anlaeg: traef[0], konfidens: 0.95, kandidater: traef,
        begrundelse: `Positionskoden i opgaven svarer til "${traef[0].navn}" i butikken.` };
    }
    if (traef.length > 1) {
      return { trin: 2, anlaeg: null, konfidens: 0, kandidater: traef.slice(0, 6),
        begrundelse: `Positionskoden findes på ${traef.length} anlæg i butikken.` };
    }
  }

  // Trin 3 · navnematch mod butikkens anlæg.
  //
  // To ting afgør vægten. Et ord, der kun findes på ét anlæg i butikken, er
  // langt mere værd end et, der står på tyve — "ovn" peger entydigt, "pos"
  // gør ikke. Og et ord i overskriften vejer tungere end i brødteksten, fordi
  // overskriften er emnet. Uden den vægtning drukner et kort, entydigt navn.
  const opgaveOrd = new Set(ord(tekst).filter((o) => !HANDLINGSORD.has(o)));
  const overskriftOrd = emneord(opgave);

  // Hvor mange af butikkens anlæg bærer hvert ord?
  const df = new Map();
  for (const k of kandidater) for (const t of k.tokens) df.set(t, (df.get(t) || 0) + 1);
  const N = kandidater.length;
  const vaegt = (t) => 6 * (1 + Math.log(N / (df.get(t) || 1)));

  const scoret = kandidater
    .map((k) => {
      let score = 0;
      const traef = [];
      for (const t of k.tokens) {
        if (HANDLINGSORD.has(t)) continue;
        const rammer = opgaveOrd.has(t) || [...opgaveOrd].some((o) => beslaegtet(o, t));
        if (!rammer) continue;
        let v = vaegt(t);
        if (overskriftOrd.has(t) || [...overskriftOrd].some((o) => beslaegtet(o, t))) v *= 1.8;
        score += v;
        traef.push(t);
      }
      // Klassenavnet tæller med: nævner opgaven "kølereol", og anlægget er
      // klassificeret som "Køle-/frostreoler", er det et stærkt fingerpeg.
      if (k.klasse) for (const t of ord(k.klasse)) {
        if (opgaveOrd.has(t) || [...opgaveOrd].some((o) => beslaegtet(o, t))) { score += 8; traef.push(t); }
      }
      return { k, score, traef };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoret.length) {
    const bedst = scoret[0];
    const naestbedst = scoret[1];
    const margin = naestbedst ? bedst.score - naestbedst.score : bedst.score;
    // Et match tæller kun, hvis det er tydeligt bedre end nummer to. Ellers
    // er der flere ens anlæg i butikken, og så kan det ikke afgøres.
    if (bedst.score >= 9 && margin >= 5) {
      return { trin: 3, anlaeg: bedst.k, konfidens: Math.min(0.85, 0.5 + margin / 40),
        kandidater: scoret.slice(0, 4).map((x) => x.k),
        begrundelse: `Navnematch mod butikkens register på ${bedst.traef.join(', ')}: "${bedst.k.navn}"`
          + (bedst.k.klasse ? ` (${bedst.k.klasse})` : '') + ', tydeligt foran næste kandidat.' };
    }
    return { trin: 3, anlaeg: null, konfidens: 0, kandidater: scoret.slice(0, 5).map((x) => x.k),
      begrundelse: scoret.length === 1
        ? 'Kun ét svagt navnematch — for tyndt til at pege på et anlæg.'
        : `${scoret.length} anlæg i butikken matcher næsten lige godt. Motoren vælger ikke mellem dem.` };
  }

  return { trin: 0, anlaeg: null, konfidens: 0, kandidater: [],
    begrundelse: `Ingen af butikkens ${kandidater.length} anlæg matcher opgavens tekst.` };
}

/* ---- Trin 4–6 · bestem faggruppen ----------------------------------------- */

/** Ord i overskriften vejer tungere end i brødteksten: overskriften er emnet. */
function emneord(opgave) {
  return new Set(ord(opgave.taskName).filter((o) => !HANDLINGSORD.has(o)));
}

/**
 * Hele kæden: find anlægget, og bestem faggruppen ud fra det, vi ved.
 * Rækkefølgen er bevidst — anlæggets klassifikation slår altid tekst.
 */
export function analyserOpgave(opgave, indeks, { minKonfidens = 0.5 } = {}) {
  const anlaegResultat = findAnlaeg(opgave, indeks);
  const spor = [];

  // A · Anlægget er fundet, og dets klasse afgør faggruppen.
  if (anlaegResultat.anlaeg && anlaegResultat.anlaeg.klasse) {
    const klasse = faggruppeForKlasse(anlaegResultat.anlaeg.klasse);
    if (klasse) {
      spor.push(`Anlæg fundet (trin ${anlaegResultat.trin}) → klassifikation "${anlaegResultat.anlaeg.klasse}" → faggruppe.`);
      return svar({
        opgave, anlaegResultat, spor,
        faggruppe: klasse.fg,
        anlaegsklasse: klasse.navn,
        fagomraade: fagomraadeForFaggruppe(klasse.fg, opgave),
        konfidens: Math.min(0.97, anlaegResultat.konfidens * 0.95 + 0.05),
        metode: 'anlægsklassifikation',
      });
    }
    // Anlægget er kendt, men dets klasse hører ikke til energiregnskabet —
    // porte, ovne, elevatorer, alarmanlæg. Vi ved stadig præcis, hvad opgaven
    // handler om, og den sikkerhed skal ikke smides væk, fordi der ikke er en
    // energilinje at lægge den på.
    // Klassen er den sikreste kilde — men giver den kun "Andet", er anlæggets
    // eget navn ofte mere præcist: klassen "Stablere" siger mindre end navnet
    // "El palleløfter".
    const fraKlassenavn = fraAnlaeg(anlaegResultat.anlaeg.klasse);
    const fraAnlaegsnavn = fraAnlaeg(anlaegResultat.anlaeg.navn);
    const fraKlasse = (fraKlassenavn && fraKlassenavn !== 'Andet') ? fraKlassenavn : (fraAnlaegsnavn || fraKlassenavn);
    spor.push(`Anlæg fundet, men klassen "${anlaegResultat.anlaeg.klasse}" er ikke i energiregnskabets katalog.`);
    if (fraKlasse) {
      spor.push(`Klassen hører til fagområdet "${fraKlasse}" på opgavesiden.`);
      return svar({
        opgave, anlaegResultat, spor,
        faggruppe: null,
        anlaegsklasse: anlaegResultat.anlaeg.klasse,
        fagomraade: fraKlasse,
        konfidens: Math.min(0.95, anlaegResultat.konfidens * 0.95),
        metode: 'anlæg uden energiside',
      });
    }
  }

  // B · Anlægget er ikke fundet, men teksten peger på en anlægstype.
  const klasseFraTekst = gætAnlaegsklasse(opgave);
  if (klasseFraTekst) {
    spor.push(`Ingen konkret anlægsreference, men teksten peger på anlægstypen "${klasseFraTekst.navn}".`);
    return svar({
      opgave, anlaegResultat, spor,
      faggruppe: klasseFraTekst.fg,
      anlaegsklasse: klasseFraTekst.navn,
      fagomraade: fagomraadeForFaggruppe(klasseFraTekst.fg, opgave),
      konfidens: 0.7,
      metode: 'anlægstype fra tekst',
    });
  }

  // C · Kun fagområdet kan afgøres — og kun hvis emnet, ikke handlingen, bærer det.
  const fo = klassificerOpgave(opgave);
  if (fo && fo.fagomraade !== 'Andet' && fo.konfidens >= minKonfidens) {
    const emner = emneord(opgave);
    const bæresAfHandling = emner.size > 0 && !harEmnestoette(fo.fagomraade, opgave);
    spor.push(`Fagområde "${fo.fagomraade}" fra ${fo.kilde}.`);
    if (bæresAfHandling) {
      spor.push('Men overskriften peger et andet sted hen end nøgleordene — sagen sendes til gennemgang.');
      return svar({
        opgave, anlaegResultat, spor,
        faggruppe: null, anlaegsklasse: null, fagomraade: fo.fagomraade,
        konfidens: Math.min(fo.konfidens, 0.45), metode: 'fagområde fra tekst',
        tilGennemgang: true,
        hvorfor: 'Nøgleordene og overskriften peger forskellige steder hen. '
          + 'Typisk når et handlingsord som "rens" eller "skift" står i teksten, men emnet er et anlæg.',
      });
    }
    return svar({
      opgave, anlaegResultat, spor,
      faggruppe: (FO[fo.fagomraade] && FO[fo.fagomraade].fg) || null,
      anlaegsklasse: null, fagomraade: fo.fagomraade,
      konfidens: fo.konfidens * 0.9, metode: 'fagområde fra tekst',
    });
  }

  // D · Kan ikke afgøres. Det er et gyldigt svar.
  spor.push('Hverken anlæg, anlægstype eller fagområde kunne afgøres med rimelig sikkerhed.');
  return svar({
    opgave, anlaegResultat, spor,
    faggruppe: null, anlaegsklasse: null, fagomraade: null,
    konfidens: 0, metode: 'kan ikke afgøres',
    kanIkkeAfgoeres: true, tilGennemgang: true,
    hvorfor: manglerHvad(opgave, anlaegResultat),
  });
}

function svar(x) {
  return {
    opgaveId: x.opgave.id ?? x.opgave.task_nr ?? null,
    kardex: x.opgave.kardex ?? laesButik(x.opgave.building).kardex ?? null,
    anlaeg: x.anlaegResultat.anlaeg,
    anlaegTrin: x.anlaegResultat.trin,
    anlaegBegrundelse: x.anlaegResultat.begrundelse,
    kandidater: x.anlaegResultat.kandidater || [],
    anlaegsklasse: x.anlaegsklasse,
    faggruppe: x.faggruppe,
    fagomraade: x.fagomraade,
    konfidens: Math.round((x.konfidens || 0) * 100) / 100,
    metode: x.metode,
    spor: x.spor,
    kanIkkeAfgoeres: !!x.kanIkkeAfgoeres,
    tilGennemgang: !!x.tilGennemgang,
    hvorfor: x.hvorfor || null,
  };
}

/** Hvad der konkret manglede — listen er guld værd, når næste integration skal vælges. */
function manglerHvad(opgave, anlaegResultat) {
  const mangler = [];
  if (!opgave.kardex && !opgave.building) mangler.push('butiksreference');
  if (anlaegResultat.trin === 0 && !anlaegResultat.kandidater.length) mangler.push('anlægsregister for butikken');
  if (!opgave.description && !opgave.workDescription) mangler.push('beskrivelse — kun en overskrift at gå efter');
  if (!opgave.asset) mangler.push('udfyldt anlægsfelt');
  return mangler.length
    ? `Mangler: ${mangler.join(', ')}.`
    : 'Teksten beskriver ikke et anlæg, motoren kan genkende.';
}

/** Tekstens egen pegepind mod en anlægstype, når registret ikke rækker. */
const TYPEORD = [
  [/kølereol|kølegondol|kølemøbel|køledisk/, 'Køle-/frostreoler'],
  [/frostrum|kølerum|koldlager|kølelager/, 'Køle-/frostrum'],
  [/frostgondol/, 'Køle-/frostgondoler'],
  [/centralt køleanlæg|konsumkøl|kølekompressor|kølemaskine/, 'Centralt køleanlæg (konsumkøl)'],
  [/ventilationsanlæg|ventilationsaggregat|aggregat/, 'Ventilationsanlæg'],
  [/varmegenvinding|genvindingsanlæg|vgv/, 'Varmegenvindingsanlæg'],
  [/udsugning|indblæsning|ventilator/, 'Ventilatorer/udsugning/indblæsning'],
  [/chiller|komfortkøl/, 'Chillere (komfortkøl)'],
  [/lufttæppe/, 'Lufttæpper'],
  [/varmepumpe.*luft.?vand|luft.?vand.*varmepumpe/, 'Varmepumpeanlæg (Luft/Vand)'],
  [/varmepumpe/, 'Varmepumpeanlæg (Luft/Luft)'],
  [/nødbelysning|sikkerhedsbelysning|panikbelysning/, 'Anlæg for sikkerhedsbelysning'],
  [/almen belysning|butiksbelysning|loftbelysning|armatur/, 'Anlæg for almen belysning'],
  [/udendørsbelysning|facadebelysning|p-plads.*lys|skiltebelysning/, 'Belysningsinstallation (udvendig)'],
  [/cts.?anlæg|\bcts\b/, 'CTS-anlæg'],
  [/bms.?anlæg|\bbms\b/, 'BMS-anlæg'],
  [/lysstyring/, 'Lysstyringsanlæg'],
  [/fjernvarme|varmeveksler/, 'Fjernvarmeanlæg'],
  [/varmtvandsbeholder|\bvvb\b/, 'Varmtvandsbeholdere (VVB)'],
  [/varmekabel|eltracing|el-tracing/, 'Varmekabelanlæg'],
];

function gætAnlaegsklasse(opgave) {
  const t = normaliser([opgave.taskName, opgave.description, opgave.workDescription, opgave.asset].filter(Boolean).join(' '));
  for (const [re, klassenavn] of TYPEORD) {
    if (re.test(t)) {
      const k = faggruppeForKlasse(klassenavn);
      if (k) return k;
    }
  }
  return null;
}

/** Findes fagområdets emne overhovedet i overskrift eller beskrivelse som et
 *  emneord — eller er det kun et handlingsord, der har trukket det derhen? */
const EMNESTOETTE = {
  'Rengøring': /rengøring|rengøre|rens(?!e[rt]?\b)|gulvvask|vinduespudsning|hovedrengøring/,
  'Bygning/Tag': /tag|facade|mur|gulv|flise|loft|maling|tømrer|beton|vindue/,
  'Ventilation/Klima': /ventilation|aggregat|klima|aircon|varmepumpe|cts|bms|udsugning|indblæsning|lufttæppe|chiller|varmt i butik/,
  'VVS/Sanitet': /vvs|toilet|kloak|afløb|vandhane|cisterne|håndvask|vandskade|vandrør|sanitet/,
  'IT/Kasse': /kasse|pos|scanner|printer|terminal|netværk|internet|etiket|prismærkning/,
  'Andet': /./,
};
function harEmnestoette(fagomraade, opgave) {
  const re = EMNESTOETTE[fagomraade];
  if (!re) return true;          // fagområder uden kendt faldgrube
  const t = normaliser([opgave.taskName, opgave.description, opgave.workDescription].filter(Boolean).join(' '));
  return re.test(t);
}

function fagomraadeForFaggruppe(fg, opgave) {
  const direkte = Object.values(FO).find((f) => f.fg === fg);
  if (direkte) return direkte.navn;
  const fo = klassificerOpgave(opgave);
  return fo ? fo.fagomraade : null;
}

/* ---- Kørsel over mange opgaver -------------------------------------------- */

/** Kører motoren over en liste opgaver og gør resultatet op. */
export function koerMotor(opgaver, indeks, options = {}) {
  const resultater = [];
  const optaelling = { total: 0, anlaegFundet: 0, viaKlassifikation: 0, udenEnergiside: 0, viaAnlaegstype: 0, viaTekst: 0, uafklarede: 0, tilGennemgang: 0 };
  const trin = { 0: 0, 1: 0, 2: 0, 3: 0 };

  for (const o of opgaver || []) {
    const r = analyserOpgave(o, indeks, options);
    resultater.push(r);
    optaelling.total++;
    trin[r.anlaegTrin] = (trin[r.anlaegTrin] || 0) + 1;
    if (r.anlaeg) optaelling.anlaegFundet++;
    if (r.metode === 'anlægsklassifikation') optaelling.viaKlassifikation++;
    if (r.metode === 'anlæg uden energiside') optaelling.udenEnergiside++;
    if (r.metode === 'anlægstype fra tekst') optaelling.viaAnlaegstype++;
    if (r.metode === 'fagområde fra tekst') optaelling.viaTekst++;
    if (r.kanIkkeAfgoeres) optaelling.uafklarede++;
    if (r.tilGennemgang) optaelling.tilGennemgang++;
  }

  return {
    resultater, optaelling, trin,
    // Andelen af "kan ikke afgøres" er et sundhedstegn i begge retninger:
    // er den nul, gætter motoren; er den halvtreds procent, mangler vi data.
    uafklaretPct: optaelling.total ? Math.round(100 * optaelling.uafklarede / optaelling.total) : 0,
    anlaegPct: optaelling.total ? Math.round(100 * optaelling.anlaegFundet / optaelling.total) : 0,
  };
}

/** Køen af opgaver, et menneske skal se på, sorteret så de dyreste kommer først. */
export function gennemgangskoe(resultater, opgaveIndex = {}) {
  return resultater
    .filter((r) => r.tilGennemgang)
    .map((r) => ({ ...r, opgave: opgaveIndex[r.opgaveId] || null }))
    .sort((a, b) => (a.kanIkkeAfgoeres === b.kanIkkeAfgoeres ? b.konfidens - a.konfidens : a.kanIkkeAfgoeres ? -1 : 1));
}
