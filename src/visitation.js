/* Visitationen.
 *
 * At visitere er ikke at flytte en sag. Det er at afgøre tre ting:
 * hører den til hos nogen, er den værd at bruge tid på, og er den her
 * afgørelse en, der burde have været truffet automatisk?
 *
 * Det sidste er det vigtigste. En visitator, der sender den samme slags sag
 * det samme sted hen hver uge, udfører et arbejde, en regel burde have gjort.
 * Derfor foreslår hubben en modtager med en begrundelse, og tilbyder at gøre
 * forslaget til en regel, når mønsteret har vist sig nok gange.
 */

import { PERSONER, PERSON, VISITATOR, ejerMedRolle, ejerAfFagomraade } from './personer.js';
import { FG, fgNavn } from './taxonomy.js';
import { FO } from './opgaver.js';

/* ---- Hvorfor har sagen ingen ejer? ---------------------------------------
 * De fem grunde kræver hver sin handling. At slå dem sammen til "uden ejer"
 * skjuler, at nogle er et bemandingsspørgsmål og andre er et datahul.
 */
export const GRUNDE = {
  udaekket_faggruppe: {
    navn: 'Faggruppen har ingen ansvarlig',
    handling: 'Udpeg en ansvarlig, eller afgør at området ikke skal overvåges.',
    slags: 'bemanding',
  },
  restpost: {
    navn: 'Forbruget er ikke henført til et anlæg',
    handling: 'Sagen kan først placeres, når der er en bimåler. Indtil da er den en måleropgave.',
    slags: 'datahul',
  },
  uden_faggruppe: {
    navn: 'Målepunktet mangler et tag',
    handling: 'Tag målepunktet i Enity, så falder sagen automatisk på plads.',
    slags: 'datahul',
  },
  bredt_tag: {
    navn: 'Tagget er for bredt til at afgøre faggruppen',
    handling: 'Tilføj et L2- eller L4-tag på målepunktet.',
    slags: 'datahul',
  },
  ukendt_fagomraade: {
    navn: 'Fagområdet har ingen ansvarlig',
    handling: 'Udpeg en ansvarlig for fagområdet på opgavesiden.',
    slags: 'bemanding',
  },
};

/** Afgør hvorfor en sag står uden fagansvarlig. */
export function grundFor(sag) {
  if (sag.faggruppe && sag.faggruppe !== 'oevrigt') {
    // Dækkes faggruppen i netop den energirolle, er sagen slet ikke uden ejer.
    if (ejerMedRolle(sag.faggruppe, sag.energirolle)) return 'ukendt_fagomraade';
    return FG[sag.faggruppe] ? 'udaekket_faggruppe' : 'uden_faggruppe';
  }
  if (['restpost', 'maalerfejl', 'benchmark'].includes(sag.sagstype)) return 'restpost';
  if (sag.fagomraade && !ejerAfFagomraade(sag.fagomraade)) return 'ukendt_fagomraade';
  if (sag.signaler && sag.signaler.some((s) => s.kilde === 'mangler-underniveau')) return 'bredt_tag';
  return 'restpost';
}

/* ---- Forslag til modtager -------------------------------------------------
 * Fire veje, i den rækkefølge. Forslaget er altid begrundet — en visitator,
 * der ikke kan se hvorfor, kan ikke tage stilling til om det er rigtigt.
 */
export function foreslaaModtager(sag, { regler = {}, visitationer = {} } = {}) {
  // 1 · En regel, nogen allerede har lavet.
  const regel = regler[regelnoegle(sag)];
  if (regel && PERSON[regel.personId]) {
    return { person: PERSON[regel.personId], grund: `Fast regel: ${regel.begrundelse || regelnoegle(sag)}`, sikkerhed: 'regel' };
  }

  // 2 · Anlægget bag sagen peger på en faggruppe, selv om sagen ikke gør.
  if (sag.anlaegsklasse || sag.energirolle) {
    const m = ejerMedRolle(sag.faggruppe, sag.energirolle);
    if (m && m.person.id !== (VISITATOR && VISITATOR.id)) {
      return { person: m.person, grund: `Anlægget hører til ${m.krav.note || fgNavn(m.krav.fg)}.`, sikkerhed: 'anlæg' };
    }
  }

  // 3 · Fagområdet fra opgavesiden.
  if (sag.fagomraade) {
    const p = ejerAfFagomraade(sag.fagomraade);
    if (p) return { person: p, grund: `Fagområdet "${sag.fagomraade}" hører til ${p.navn}.`, sikkerhed: 'fagområde' };
  }

  // 3b · Faget. Et fagområde uden ansvarlig kan stadig have et fag, en af de
  // syv udfører — en VVS-opgave hører til hos den, der laver VVS, selv om
  // ingen formelt er sat på "VVS/Sanitet".
  if (sag.fagomraade && FO[sag.fagomraade]) {
    const fag = FO[sag.fagomraade].fag;
    const p = PERSONER.find((x) => x.fag && fag && x.fag.toLowerCase().includes(fag.toLowerCase()));
    if (p) {
      return { person: p, grund: `Fagområdet "${sag.fagomraade}" kræver ${fag}, og det er ${p.navn}s fag — `
        + 'men ingen er formelt sat på området.', sikkerhed: 'fag' };
    }
  }

  // 4 · Hvad der er sket med den samme sagstype før.
  const tidligere = {};
  for (const [noegle, personId] of Object.entries(visitationer)) {
    if (noegle.split('|')[1] !== sag.sagstype) continue;
    tidligere[personId] = (tidligere[personId] || 0) + 1;
  }
  const poster = Object.entries(tidligere).sort((a, b) => b[1] - a[1]);
  if (poster.length && PERSON[poster[0][0]]) {
    const ialt = poster.reduce((a, x) => a + x[1], 0);
    return {
      person: PERSON[poster[0][0]],
      grund: `${poster[0][1]} af ${ialt} sager af typen "${sag.sagsnavn}" er sendt derhen før.`,
      sikkerhed: 'historik',
    };
  }

  return null;
}

export const regelnoegle = (sag) => `${sag.sagstype}|${sag.faggruppe || '-'}|${sag.energirolle || '-'}`;

/* ---- Regler ---------------------------------------------------------------
 * Når den samme slags sag er sendt samme sted hen nok gange, er det ikke
 * længere en vurdering — det er en regel, der mangler at blive skrevet ned.
 * Hubben foreslår den; et menneske godkender den.
 */
export function moenstreKlarTilRegel(visitationer, sager, { minAntal = 3, minAndel = 0.8 } = {}) {
  const prNoegle = {};
  const sagPrNoegle = {};
  for (const sag of sager) {
    const n = regelnoegle(sag);
    const valgt = visitationer[`${sag.butiksnummer}|${sag.sagstype}`];
    if (!valgt) continue;
    (prNoegle[n] ||= {})[valgt] = ((prNoegle[n] || {})[valgt] || 0) + 1;
    sagPrNoegle[n] = sag;
  }
  return Object.entries(prNoegle)
    .map(([noegle, fordeling]) => {
      const poster = Object.entries(fordeling).sort((a, b) => b[1] - a[1]);
      const ialt = poster.reduce((a, x) => a + x[1], 0);
      return { noegle, personId: poster[0][0], antal: poster[0][1], ialt,
        andel: poster[0][1] / ialt, eksempel: sagPrNoegle[noegle] };
    })
    .filter((m) => m.ialt >= minAntal && m.andel >= minAndel)
    .sort((a, b) => b.antal - a.antal);
}

/* ---- Køens alder ----------------------------------------------------------
 * Nøgletallet er ikke køens længde, men hvor længe sagerne har ligget.
 * Målet er under fem arbejdsdage. Det måler, om funktionen er bemandet.
 */
export function koeAlder(sager, { nu = new Date(), maal = 5 } = {}) {
  const dage = sager.map((s) => Math.floor((nu - new Date(s.aabnet)) / 864e5)).filter(Number.isFinite);
  if (!dage.length) return { antal: 0, median: null, aeldste: null, overMaal: 0, maal };
  const sorteret = [...dage].sort((a, b) => a - b);
  return {
    antal: dage.length,
    median: sorteret[sorteret.length >> 1],
    aeldste: sorteret[sorteret.length - 1],
    overMaal: dage.filter((d) => d > maal).length,
    maal,
  };
}

/* ---- Hvad der ville tømme køen -------------------------------------------
 * Det mest nyttige, visitationen kan producere, er ikke en tømt kø — det er
 * en liste over, hvad der ville få sagerne til aldrig at havne der.
 */
export function hvadVilleToemmeKoeen(koe) {
  const prGrund = {};
  for (const sag of koe) {
    const g = grundFor(sag);
    (prGrund[g] ||= { grund: g, antal: 0, kr: 0, sager: [] });
    prGrund[g].antal++;
    prGrund[g].kr += sag.krAar;
    prGrund[g].sager.push(sag);
  }
  return Object.values(prGrund)
    .map((x) => ({ ...x, ...GRUNDE[x.grund] }))
    .sort((a, b) => b.antal - a.antal);
}
