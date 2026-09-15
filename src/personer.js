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
    beskrivelse: 'Drift af ventilationsanlæg — hele aggregatet: ventilatorer, filtre, varmegenvinding, '
      + 'luftmængder OG aggregatets køle- og varmeflade.',
    faggrupper: ['ventilation'],
    // Kølefladen og varmefladen sidder i aggregatet og serviceres af den, der
    // har aggregatet. De hører til Mads, når de er en del af et
    // ventilationsanlæg — ikke når de står for sig selv.
    daekker: [
      { fg: 'ventilation' },
      { fg: 'koeleflader', roller: ['køleflade'], note: 'Kølefladen i et ventilationsaggregat' },
      { fg: 'varme_fjern', roller: ['varmeflade'], note: 'Varmefladen i et ventilationsaggregat' },
    ],
    fagomraader: ['Ventilation/Klima'],
    fag: 'Ventilationstekniker',
    detektorer: ['D-17', 'D-19', 'D-20', 'D-30', 'D-31', 'D-32'],
    noegleKilder: ['Unikair', 'Enity el til ventilation', 'Enity køle- og varmeflademålere', 'CTS-tidsplan'],
  },
  {
    id: 'morten',
    navn: 'Morten',
    omraade: 'CTS, elevatorer og klimakøl',
    beskrivelse: 'CTS-drift, elevatorer og rulletrapper samt selvstændig komfortkøl: chillere, '
      + 'klimaanlæg og lufttæpper, der ikke sidder i et ventilationsaggregat.',
    faggrupper: ['cts'],
    daekker: [
      { fg: 'cts' },
      // Komfortkøl, der IKKE er en flade i et aggregat. Skelnen ligger i
      // målepunktets tags: L2 Klimaanlæg står for sig selv, mens
      // L2 Ventilation + L4 Køleflade er en del af Mads' aggregat.
      { fg: 'koeleflader', undtagenRoller: ['køleflade'], note: 'Selvstændig komfortkøl — chillere, AC, lufttæpper' },
    ],
    fagomraader: ['Elevator/Rulletrappe'],
    fag: 'CTS-programmør',
    detektorer: ['D-15', 'D-16', 'D-19', 'D-20'],
    noegleKilder: ['CTS Ltech', 'Enity klimaanlægsmålere', 'Dalux elevatoropgaver'],
  },
  {
    id: 'emil',
    navn: 'Emil',
    omraade: 'Varme, overskudsvarme og VVS',
    beskrivelse: 'Overskudsvarme, varmepumper og varmeinstallationer, herunder fjernvarme, vekslere og '
      + 'varmtvandsbeholdere. Derudover VVS og sanitet: vand, afløb, kloak og toiletter.',
    faggrupper: ['overskudsvarme', 'varme_el'],
    daekker: [
      { fg: 'overskudsvarme' },
      { fg: 'varme_el' },
      // Fjernvarme, vekslere og VVB — men ikke varmefladen i et
      // ventilationsaggregat, som følger aggregatet.
      { fg: 'varme_fjern', undtagenRoller: ['varmeflade'], note: 'Fjernvarme, vekslere og varmtvandsbeholdere' },
    ],
    fagomraader: ['VVS/Sanitet'],
    fag: 'VVS',
    detektorer: ['D-18', 'D-19', 'D-20'],
    noegleKilder: ['Leanheat', 'Enity fjernvarme', 'Enity el til varmepumpe', 'CTS varmebehov', 'Dalux VVS-opgaver'],
  },
  {
    id: 'stefan',
    navn: 'Stefan',
    omraade: 'Solceller og belysning · energiansvarlig',
    beskrivelse: 'Solcelleanlæg og invertere samt indendørs og udendørs belysning. '
      + 'Derudover energiansvarlig og visitator for de sager, der ikke kan placeres på en anlægstype.',
    faggrupper: ['solceller', 'lys_inde', 'lys_ude'],
    fagomraader: ['Solceller', 'Lys/El'],
    fag: 'Elektriker',
    detektorer: ['D-07', 'D-08', 'D-21', 'D-22', 'D-19', 'D-20'],
    noegleKilder: ['Solcelleplatformen', 'Enity lysmålere', 'Indstrålingsdata', 'Enity målerhierarki'],
    // Visitator for alt, der ikke kan placeres på en anlægstype: restpost,
    // benchmark, målerfejl og ny konstant last. De sager handler netop om
    // forbrug, der endnu ikke er henført til et anlæg, og de har derfor
    // ingen naturlig fagansvarlig.
    visitator: true,
    visitatorDetektorer: ['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-09', 'D-10'],
    /* Benchmark er en energiscreening, ikke en måleropgave: spørgsmålet
     * "hvorfor ligger butikken højt mod sine søskende" hører til hos
     * energiansvarlig. Selve målersagerne — restpost og målerfejl — er
     * Christians. */
    egneSagstyper: ['benchmark'],
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
    id: 'charlie',
    navn: 'Charlie',
    omraade: 'Alarm og sikkerhed',
    beskrivelse: 'Indbrudsalarm, brandalarm, ABDL, ITV-overvågning, adgangskontrol, sprinkler og '
      + 'brandslukningsudstyr.',
    faggrupper: [],
    fagomraader: ['Sikkerhed/Alarm'],
    fag: 'Sikringstekniker',
    detektorer: ['D-19', 'D-20'],
    noegleKilder: ['Dalux opgavehistorik', 'Dalux anlægsregister'],
    udenEnergiside: true,
  },
  {
    id: 'christian',
    navn: 'Christian',
    omraade: 'Målere og målepunkter',
    beskrivelse: 'Målerhierarkiet: forsyningsmålere, bimålere, tagging af målepunkter i Enity og '
      + 'datakvaliteten bag hele overvågningen.',
    faggrupper: [],
    // Øvrigt/uspecificeret er restposten — det forbrug, der endnu ikke er
    // henført til en anlægstype. Det er ikke en anlægstype og kan derfor ikke
    // have en fagansvarlig i sædvanlig forstand. Men at lukke hullet ER
    // måleropgaven, og derfor er faggruppen Christians.
    daekker: [{ fg: 'oevrigt', note: 'Restposten — forbrug, der endnu ikke er henført til et anlæg' }],
    fagomraader: [],
    fag: 'Elektriker / måletekniker',
    detektorer: ['D-03', 'D-04', 'D-30'],
    noegleKilder: ['Enity målerhierarki', 'Enity tags', 'Datahub'],
    /* Målersagerne. De kan ikke sendes til en fagansvarlig, for der er netop
     * ikke noget anlæg at sende dem til — det er hele pointen med dem. */
    egneSagstyper: ['restpost', 'maalerfejl'],
    fokus: 'Hver måler, der kommer på plads, fjerner sager fra visitationskøen af sig selv: '
      + 'et forbrug med en bimåler på har en anlægstype, og en anlægstype har en fagansvarlig.',
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

/* Områder, der bevidst står uden ansvarlig.
 *
 * Forskellen på "ingen har taget den endnu" og "ingen skal have den" er
 * vigtig. Det første er et hul, der skal lukkes; det andet er en truffet
 * beslutning, og den skal kunne ses som sådan — ellers bliver den ved med at
 * dukke op som en mangel, nogen skal forholde sig til igen og igen.
 *
 * Sagerne oprettes stadig og kan stadig ses. De ligger bare ikke og venter på
 * en visitator, der ikke har nogen at sende dem til.
 */
export const BEVIDST_UDEN_ANSVARLIG = [
  { fagomraade: 'Skadedyr', opgaver: 2355,
    begrundelse: 'Skadedyrsbekæmpelse kører på serviceaftale med egen leverandør. Opgaverne er '
      + 'lovpligtige tilsyn frem for fejl, og driftsorganisationen har ingen rolle i dem.' },
  { fagomraade: 'Bygning/Tag', opgaver: 2162,
    begrundelse: 'Bygningsvedligehold ligger uden for de tekniske driftsområder og håndteres '
      + 'af byggeriet, ikke af driften.' },
];

export const erBevidstUdenAnsvarlig = (fagomraade) =>
  BEVIDST_UDEN_ANSVARLIG.some((x) => x.fagomraade === fagomraade);

/** Hvem ejer en faggruppe? Bruges til at route en sag til en person. */
export function ejerAfFaggruppe(fg) {
  const m = ejerMedRolle(fg, null);
  return m ? m.person : null;
}

/** Alle faggrupper, nogen dækker — uanset i hvilken rolle. */
export function daekkedeFaggrupper() {
  const ud = new Set();
  for (const p of PERSONER) for (const k of (p.daekker || p.faggrupper.map((f) => ({ fg: f })))) ud.add(k.fg);
  return ud;
}

/** Hvem ejer et fagområde på opgavesiden? */
export function ejerAfFagomraade(fo) {
  return PERSONER.find((p) => p.fagomraader.includes(fo)) || null;
}

/** Den, der visiterer sager uden en fagansvarlig. */
export const VISITATOR = PERSONER.find((p) => p.visitator) || null;

/**
 * Finder den FAGANSVARLIGE for en sag — den, der kender anlægget. Faggruppen
 * vejer tungest; det er den, energiregnskabet og anlægsklassifikationen peger
 * på. Er der ingen faggruppe (porte, flaskeautomater, tavler), bruges
 * fagområdet fra opgavesiden.
 *
 * `visiteret` er en manuel omrouting, visitatoren har foretaget. Den slår alt
 * andet — et menneske, der har set sagen, ved mere end reglerne.
 */
/**
 * Hvem dækker en faggruppe i en bestemt energirolle?
 *
 * Et ventilationsaggregats køleflade og en fritstående chiller ender begge i
 * faggruppen "Køleflader/klima", men de serviceres af hver sin person: fladen
 * følger aggregatet, chilleren står for sig selv. Forskellen ligger i
 * målepunktets tags — L2 Ventilation + L4 Køleflade mod L2 Klimaanlæg — og
 * den skelnen skal derfor kunne udtrykkes i ansvarstabellen.
 *
 * Et krav med eksplicitte roller vinder over et uden, så det mest præcise
 * ansvar afgør.
 */
export function ejerMedRolle(fg, energirolle) {
  let bredt = null;
  for (const p of PERSONER) {
    for (const k of (p.daekker || p.faggrupper.map((f) => ({ fg: f })))) {
      if (k.fg !== fg) continue;
      if (k.roller) {
        if (energirolle && k.roller.includes(energirolle)) return { person: p, krav: k, praecision: 'rolle' };
        continue;
      }
      if (k.undtagenRoller) {
        if (energirolle && k.undtagenRoller.includes(energirolle)) continue;
        if (!bredt) bredt = { person: p, krav: k, praecision: 'rolle-undtagelse' };
        continue;
      }
      if (!bredt) bredt = { person: p, krav: k, praecision: 'faggruppe' };
    }
  }
  return bredt;
}

export function ejerAfSag(sag, visitationer = {}, routingregler = {}) {
  // 1 · Et menneske har set sagen og sendt den videre.
  const manuelt = visitationer[`${sag.butiksnummer}|${sag.sagstype}`];
  if (manuelt && PERSON[manuelt]) return PERSON[manuelt];

  // 2 · En fast regel, nogen har godkendt.
  const regel = routingregler[`${sag.sagstype}|${sag.faggruppe || '-'}|${sag.energirolle || '-'}`];
  if (regel && PERSON[regel.personId]) return PERSON[regel.personId];

  // 3 · Sagstyper, en person har taget på sig som sit eget arbejde.
  const egen = PERSONER.find((p) => (p.egneSagstyper || []).includes(sag.sagstype));
  if (egen) return egen;

  /* 4 · Fagområdet før faggruppen, når faggruppen kun er "øvrigt".
   *
   * En sag om gentagne alarmfejl har faggruppen "Øvrigt", fordi alarmanlæg
   * ikke har en energiside — ikke fordi den er en målersag. Slog faggruppen
   * igennem først, ville hver eneste opgavesag uden energiside lande hos den,
   * der har restposten. "Øvrigt" er en restkategori, ikke en klassifikation,
   * og den må derfor aldrig vinde over et fagområde, nogen faktisk dækker. */
  if (sag.fagomraade) {
    const p = ejerAfFagomraade(sag.fagomraade);
    if (p) return p;
    /* Har sagen et fagområde, som ingen dækker, hører den til i visitationen
     * — ikke hos den, der har restposten. En toiletlækage er ikke en
     * målersag, blot fordi VVS ikke har en energiside. Faggruppen "Øvrigt"
     * må kun bruges, når der slet ikke er et fagområde at gå efter, og det
     * er der kun på de rene energi- og målersager. */
    return null;
  }

  // 5 · Faggruppen i den rolle, sagen handler om.
  if (sag.faggruppe) {
    const m = ejerMedRolle(sag.faggruppe, sag.energirolle);
    if (m) return m.person;
  }
  return null;
}

/**
 * Hvem sagen ligger hos LIGE NU. Har den ingen fagansvarlig, ligger den hos
 * visitatoren — ikke som ejer, men som en, der skal sende den videre.
 *
 * Forskellen er ikke kosmetisk. En sag i visitationskøen er ubehandlet
 * uanset hvor dygtig visitatoren er, og hvis de to køer blandes, forsvinder
 * netop det, man skal kunne se: at firs sager venter på at blive placeret.
 */
export function ansvarligFor(sag, visitationer = {}, routingregler = {}) {
  const ejer = ejerAfSag(sag, visitationer, routingregler);
  if (ejer) return { person: ejer, rolle: 'fagansvarlig', visiteret: !!visitationer[`${sag.butiksnummer}|${sag.sagstype}`] };
  if (VISITATOR) return { person: VISITATOR, rolle: 'visitator', visiteret: false };
  return { person: null, rolle: 'ingen', visiteret: false };
}

/** Sagerne, der hører til én person som fagansvarlig — hans eget område. */
export function sagerFor(person, sager, visitationer = {}, routingregler = {}) {
  return (sager || []).filter((s) => {
    const ejer = ejerAfSag(s, visitationer, routingregler);
    return ejer && ejer.id === person.id;
  });
}

/**
 * Sagerne, der venter på at blive placeret. De ligger hos visitatoren, men
 * de er ikke hans i faglig forstand — de er en kø, der skal tømmes ved at
 * sende hver sag videre eller lukke den.
 */
export function visitationskoe(sager, visitationer = {}, routingregler = {}) {
  return (sager || []).filter((s) => !ejerAfSag(s, visitationer, routingregler));
}

/** Bagudkompatibelt navn — samme liste, set fra den anden side. */
export const herreloeseSager = visitationskoe;

/** Faggrupper, ingen har. */
export function udaekkedeFaggrupper(faggrupper) {
  const daekket = daekkedeFaggrupper();
  return faggrupper.filter((f) => !daekket.has(f.key));
}
