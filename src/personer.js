/* Hvem har hvad.
 *
 * Ingen sag må stå uden en navngiven modtager. Tabellen her er den, der gør
 * en faggruppe til en person — og dermed en sag til nogens ansvar.
 *
 * To ting er værd at bemærke i opdelingen:
 *
 *  · Mads har ventilationsanlæggene, Morten har ventilations- og klimakøl.
 *    Det er to forskellige personer på det samme fysiske aggregat. Den
 *    opdeling kan kun holdes i data, fordi Enity-målepunkterne har et L4-tag,
 *    der skiller "Kun ventilation" fra "Køleflade" — og fordi et bredt
 *    "L0/1 HVAC" aldrig auto-mappes alene. Uden den regel ville halvdelen af
 *    Mortens forbrug lande hos Mads.
 *
 *  · Lars og Martin har områder uden en energiside. Deres anlæg bruger strøm,
 *    men vi måler det ikke separat. Deres billede er derfor drevet af
 *    Dalux-opgaver og gentagne fejl, ikke af kWh. Det er en reel forskel,
 *    ikke en mangel ved deres dashboard — og den vises frem for at skjules.
 */

export const PERSONER = [
  {
    id: 'henrik',
    navn: 'Henrik Ravn',
    omraade: 'Køl og frost',
    beskrivelse: 'Drift af køleanlæg og frost: kompressorer, konsumkøl, kølemøbler, kondensatorer og afrimning.',
    faggrupper: ['koel_frys'],
    fagomraader: ['Køl/Frost'],
    fag: 'Køletekniker',
    detektorer: ['D-06', 'D-11', 'D-12', 'D-13', 'D-14', 'D-19', 'D-20'],
    noegleKilder: ['Enity bimåler køl', 'AK-centralen', 'Dalux opgavehistorik'],
    p1: true,   // fødevaresikkerhed ligger her
  },
  {
    id: 'mads',
    navn: 'Mads',
    omraade: 'Ventilation',
    beskrivelse: 'Drift af ventilationsanlæg: aggregater, ventilatorer, filtre, varmegenvinding og luftmængder.',
    faggrupper: ['ventilation'],
    fagomraader: ['Ventilation/Klima'],
    fag: 'Ventilationstekniker',
    detektorer: ['D-17', 'D-19', 'D-20'],
    noegleKilder: ['Unikair', 'Enity el til ventilation', 'CTS-tidsplan'],
    deler: [{ med: 'morten', hvad: 'Samme fysiske aggregat — Mads har luftsiden, Morten har kølefladen.' }],
  },
  {
    id: 'morten',
    navn: 'Morten',
    omraade: 'CTS, elevatorer og klimakøl',
    beskrivelse: 'CTS-drift, elevatorer og rulletrapper samt ventilations- og klimakøl: køleflader, chillere og lufttæpper.',
    faggrupper: ['cts', 'koeleflader'],
    fagomraader: ['Elevator/Rulletrappe'],
    fag: 'CTS-programmør',
    detektorer: ['D-15', 'D-16', 'D-19', 'D-20'],
    noegleKilder: ['CTS Ltech', 'Enity køleflade-målere', 'Dalux elevatoropgaver'],
    deler: [{ med: 'mads', hvad: 'Samme fysiske aggregat — Morten har kølefladen, Mads har luftsiden.' }],
  },
  {
    id: 'emil',
    navn: 'Emil',
    omraade: 'Varme og overskudsvarme',
    beskrivelse: 'Overskudsvarme, varmepumper og varmeinstallationer, herunder fjernvarme, vekslere og varmtvandsbeholdere.',
    faggrupper: ['overskudsvarme', 'varme_el', 'varme_fjern'],
    fagomraader: [],
    fag: 'VVS',
    detektorer: ['D-18', 'D-19', 'D-20'],
    noegleKilder: ['Leanheat', 'Enity fjernvarme', 'Enity el til varmepumpe', 'CTS varmebehov'],
  },
  {
    id: 'stefan',
    navn: 'Stefan',
    omraade: 'Solceller og belysning',
    beskrivelse: 'Solcelleanlæg og invertere samt indendørs og udendørs belysning.',
    faggrupper: ['solceller', 'lys_inde', 'lys_ude'],
    fagomraader: ['Solceller', 'Lys/El'],
    fag: 'Elektriker',
    detektorer: ['D-07', 'D-08', 'D-21', 'D-22', 'D-19', 'D-20'],
    noegleKilder: ['Solcelleplatformen', 'Enity lysmålere', 'Indstrålingsdata'],
  },
  {
    id: 'lars',
    navn: 'Lars',
    omraade: 'Flaskeautomater og porte',
    beskrivelse: 'Flaskeautomater og pantsystemer samt porte, døre og dørautomatik.',
    faggrupper: [],
    fagomraader: ['Flaskeautomat', 'Port/Dør'],
    fag: 'Portmontør / serviceleverandør',
    detektorer: ['D-19', 'D-20'],
    noegleKilder: ['Dalux opgavehistorik', 'Dalux anlægsregister'],
    udenEnergiside: true,
  },
  {
    id: 'martin',
    navn: 'Martin',
    omraade: 'Systemydelser og eltavler',
    beskrivelse: 'Systemydelser samt eltavler, hovedtavler og gruppetavler.',
    faggrupper: [],
    fagomraader: ['El tavler', 'IT/Kasse'],
    fag: 'Elektriker / IT',
    detektorer: ['D-19', 'D-20'],
    noegleKilder: ['Dalux opgavehistorik', 'Enity målerhierarki'],
    udenEnergiside: true,
    // "Systemydelser" er ikke defineret i data. Indtil området er afgrænset,
    // er IT/Kasse lagt ind som den nærmeste kandidat — det skal bekræftes,
    // ikke antages.
    uafklaret: 'Området "systemydelser" er ikke afgrænset i data. IT/Kasse er lagt ind som nærmeste kandidat '
      + 'og skal bekræftes af Martin selv, før sager routes derhen.',
  },
];

export const PERSON = Object.fromEntries(PERSONER.map((p) => [p.id, p]));

/** Hvem ejer en faggruppe? Bruges til at route en sag til en person. */
export function ejerAfFaggruppe(fg) {
  return PERSONER.find((p) => p.faggrupper.includes(fg)) || null;
}

/** Hvem ejer et fagområde på opgavesiden? */
export function ejerAfFagomraade(fo) {
  return PERSONER.find((p) => p.fagomraader.includes(fo)) || null;
}

/**
 * Finder den person, en sag hører til. Faggruppen vejer tungest — det er den,
 * energiregnskabet og anlægsklassifikationen peger på. Er der ingen faggruppe
 * (porte, flaskeautomater, tavler), bruges fagområdet fra opgavesiden.
 */
export function ejerAfSag(sag) {
  if (sag.faggruppe) {
    const p = ejerAfFaggruppe(sag.faggruppe);
    if (p) return p;
  }
  if (sag.fagomraade) {
    const p = ejerAfFagomraade(sag.fagomraade);
    if (p) return p;
  }
  return null;
}

/** Sagerne, der hører til én person. */
export function sagerFor(person, sager) {
  return (sager || []).filter((s) => {
    const ejer = ejerAfSag(s);
    return ejer && ejer.id === person.id;
  });
}

/**
 * Sagerne, ingen ejer. Det er den vigtigste liste i hele opsætningen:
 * en sag uden modtager bliver aldrig behandlet, og den fejl er tavs.
 */
export function herreloeseSager(sager) {
  return (sager || []).filter((s) => !ejerAfSag(s));
}

/** Faggrupper, ingen har. */
export function udaekkedeFaggrupper(faggrupper) {
  return faggrupper.filter((f) => !PERSONER.some((p) => p.faggrupper.includes(f.key)));
}
