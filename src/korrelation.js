/* Koblingen mellem en hændelse på måleren og en opgave i Dalux.
 *
 * Det hele hænger på ét spørgsmål: kom opgaven FØR eller EFTER, at forbruget
 * ændrede sig?
 *
 *   Opgave FØR springet   → opgaven forklarer springet. Nogen har lavet noget.
 *                           En ny frostsektion sat i drift, et setpunkt skruet
 *                           ned, en kompressor skiftet. Det er ikke en fejl,
 *                           og der skal ikke sendes nogen ud.
 *
 *   Opgave SAMTIDIG       → butikken meldte det samme dag, måleren så det.
 *                           To uafhængige kilder om det samme. Det er den
 *                           højeste konfidens, hubben kan opnå.
 *
 *   Opgave EFTER          → måleren så det først. Antallet af dage imellem er
 *                           varslingstiden, og det er hele forretningsargumentet
 *                           for at overvåge: de dage kunne have været brugt.
 *
 *   Ingen opgave          → enten en fejl, ingen har opdaget, eller en ændring,
 *                           der ikke er en fejl. De to kan ikke skelnes på
 *                           måleren alene, og agenten skal sige det frem for
 *                           at vælge den mest dramatiske.
 *
 * Retningen i tid er altså ikke en detalje i beregningen. Den afgør, om sagen
 * overhovedet er en sag.
 */

const DAG = 864e5;
const dagTal = (d) => Math.round(new Date(d + 'T00:00:00Z').getTime() / DAG);
const dageMellem = (a, b) => dagTal(b) - dagTal(a);

export const SAMTIDIGHED = {
  forklaret: {
    navn: 'Forklaret af en opgave',
    betydning: 'Der blev udført arbejde på anlægget, lige før forbruget ændrede sig. '
      + 'Ændringen er med al sandsynlighed en følge af det arbejde — ikke en fejl.',
    farve: 'ok', erFejl: false, konfidensbidrag: -0.30,
  },
  bekraeftet: {
    navn: 'Bekræftet af butikken',
    betydning: 'Butikken meldte fejlen ind stort set samtidig med, at måleren så den. '
      + 'To uafhængige kilder peger på det samme anlæg på det samme tidspunkt.',
    farve: 'p1', erFejl: true, konfidensbidrag: +0.25,
  },
  varsel: {
    navn: 'Måleren så det først',
    betydning: 'Forbruget ændrede sig, og først flere uger senere blev fejlen meldt ind. '
      + 'De mellemliggende dage er den tid, overvågningen kunne have sparet.',
    farve: 'p2', erFejl: true, konfidensbidrag: +0.20,
  },
  uledsaget: {
    navn: 'Ingen opgave på anlægget',
    betydning: 'Ingen har meldt noget ind. Enten er fejlen ikke opdaget endnu, eller også '
      + 'er ændringen ikke en fejl. Måleren alene kan ikke afgøre hvilket.',
    farve: 'p3', erFejl: null, konfidensbidrag: 0,
  },
};

/** Vinduerne, i dage, omkring hændelsesdatoen. */
export const VINDUER = {
  forklarerFoer: 21,   // en opgave op til 21 dage før springet kan forklare det
  samtidig: 3,         // en fejlmelding op til 3 dage efter regnes som samtidig
  varslerEfter: 120,   // en opgave op til 120 dage efter kan være den samme fejl
};

/* ---- Hvad slags opgave er det? -------------------------------------------
 * Datoen alene kan ikke afgøre, om en opgave forklarer en ændring eller melder
 * den. En opgave to dage før springet kan være begge dele: enten skruede nogen
 * på anlægget i mandags, eller også ringede butikken i mandags om noget, der
 * var gået galt i weekenden.
 *
 * Teksten kan afgøre det. "Idriftsættelse af ny frostsektion" er planlagt
 * arbejde; "køleanlægget står, temperaturen stiger" er en fejlmelding. Det er
 * forskellen på at sende en tekniker ud og på at lade være.
 *
 * Bemærk rækkefølgen: fejlmelding slår arbejde. En opgave, der både nævner
 * "service" og "anlægget står", er en fejlmelding — servicebesøget er, hvad
 * der skal ske, ikke hvad der er sket.
 */
const ARBEJDSORD = [
  'idriftsæt', 'idriftssæt', 'montering', 'monteret', 'opsætning', 'installation', 'installeret',
  'tilslutning', 'indregulering', 'justering', 'justeret', 'ombygning', 'opstart', 'igangsæt',
  'planlagt', 'årligt eftersyn', 'lovpligtig', 'renovering', 'udvidelse', 'setpunkt',
];
const FEJLORD = [
  'står', 'stoppet', 'virker ikke', 'kører ikke', 'alarm', 'fejl', 'nedbrud', 'defekt',
  'for varm', 'for høj temperatur', 'kan ikke holde', 'lækage', 'utæt', 'rim', 'dug',
  'støjer', 'larmer', 'haster', 'løber', 'drypper', 'kondens', 'går i stå', 'udkoblet',
];

/** 'arbejde' | 'fejlmelding' | 'ukendt' — læst ud af opgavens tekst. */
export function opgavekarakter(tekst) {
  const t = String(tekst || '').toLowerCase();
  if (!t) return 'ukendt';
  if (FEJLORD.some((o) => t.includes(o))) return 'fejlmelding';
  if (ARBEJDSORD.some((o) => t.includes(o))) return 'arbejde';
  return 'ukendt';
}

/**
 * Finder den opgave, der bedst forklarer eller bekræfter en hændelse.
 *
 * `haendelse` skal have `dato`. `opgaver` skal have `dato` og gerne
 * `fagomraade`. Kun opgaver i et fagområde, der hører til hændelsens
 * faggruppe, tæller med — en VVS-opgave forklarer ikke et køleanlæg.
 */
export function samtidighed(haendelse, opgaver, { faggruppe, vinduer = VINDUER, relevante } = {}) {
  const kandidater = (opgaver || [])
    .filter((o) => o.dato)
    .filter((o) => !relevante || !o.fagomraade || relevante.includes(o.fagomraade))
    .map((o) => ({ ...o, dage: dageMellem(haendelse.dato, o.dato), karakter: opgavekarakter(o.tekst) }))
    // Negativ = opgaven ligger før hændelsen.
    .filter((o) => o.dage >= -vinduer.forklarerFoer && o.dage <= vinduer.varslerEfter);

  if (!kandidater.length) {
    return { klasse: 'uledsaget', ...SAMTIDIGHED.uledsaget, opgave: null, dage: null, faggruppe };
  }

  /* Planlagt arbejde forklarer en ændring, hvis det ligger før den eller lige
   * omkring den. Det vejer tungest af alt: har nogen med vilje skruet på
   * anlægget, er det den mest sandsynlige grund til, at forbruget flyttede sig
   * — og det er dét, der holder os fra at sende en tekniker ud til noget, en
   * kollega lige har lavet efter aftale. */
  const arbejde = kandidater
    .filter((o) => o.karakter === 'arbejde' && o.dage <= vinduer.samtidig)
    .sort((a, b) => b.dage - a.dage)[0];
  if (arbejde) {
    return {
      klasse: 'forklaret', ...SAMTIDIGHED.forklaret, opgave: arbejde, dage: arbejde.dage, faggruppe,
      tekst: `Der blev udført planlagt arbejde på anlægget ${beskrivDage(arbejde.dage)}: "${kort(arbejde.tekst)}".`,
    };
  }

  /* Alt andet, der ligger før hændelsen, forklarer den også — men svagere,
   * for vi ved ikke, hvad der blev lavet. */
  const foer = kandidater.filter((o) => o.dage < -vinduer.samtidig)
    .sort((a, b) => b.dage - a.dage)[0];
  if (foer) {
    return {
      klasse: 'forklaret', ...SAMTIDIGHED.forklaret, opgave: foer, dage: foer.dage, faggruppe,
      usikker: true,
      tekst: `Der blev udført arbejde på anlægget ${-foer.dage} dage før ændringen: "${kort(foer.tekst)}". `
        + 'Opgaveteksten siger ikke hvad, så sammenhængen er ikke sikker.',
    };
  }

  /* En fejlmelding samme dag eller få dage efter: butikken og måleren så det
   * samme. Vinduet er med vilje skævt — en fejlmelding kommer efter fejlen,
   * ikke før den. */
  const samme = kandidater.filter((o) => o.dage >= -1 && o.dage <= vinduer.samtidig)
    .sort((a, b) => Math.abs(a.dage) - Math.abs(b.dage))[0];
  if (samme) {
    return {
      klasse: 'bekraeftet', ...SAMTIDIGHED.bekraeftet, opgave: samme, dage: samme.dage, faggruppe,
      tekst: `Butikken meldte fejlen ind ${samme.dage === 0 ? 'samme dag' : beskrivDage(samme.dage)}: "${kort(samme.tekst)}".`,
    };
  }

  const efter = kandidater.filter((o) => o.dage > vinduer.samtidig)
    .sort((a, b) => a.dage - b.dage)[0];
  if (efter) {
    return {
      klasse: 'varsel', ...SAMTIDIGHED.varsel, opgave: efter, dage: efter.dage, faggruppe,
      varslingsdage: efter.dage,
      tekst: `Måleren så ændringen ${efter.dage} dage før butikken meldte den ind: "${kort(efter.tekst)}".`,
    };
  }

  /* Der ER kandidater, men ingen af dem faldt i nogen af kasserne.
   *
   * Det kan lade sig gøre, fordi vinduerne med vilje er skæve: "forklaret"
   * kræver mere end tre døgn før, "bekræftet" tillader kun ét døgn før. En
   * opgave to eller tre døgn før hændelsen, hvis tekst ikke tydeligt er
   * planlagt arbejde, falder derfor imellem — og første udgave antog bare, at
   * der altid var en tilbage, og brød sammen på et undefined.
   *
   * Det rigtige svar er ikke at presse den ned i en af kasserne. Den ligger i
   * netop det tidsrum, hvor datoen ikke kan afgøre, om opgaven er årsag eller
   * virkning, og det skal siges. */
  const naermest = [...kandidater].sort((a, b) => Math.abs(a.dage) - Math.abs(b.dage))[0];
  return {
    klasse: 'uledsaget', ...SAMTIDIGHED.uledsaget,
    opgave: naermest, dage: naermest.dage, faggruppe, tvetydig: true,
    tekst: `Der ligger en opgave ${Math.abs(naermest.dage)} dage før ændringen: "${kort(naermest.tekst)}". `
      + 'Så tæt på kan datoen ikke afgøre, om opgaven forklarer ændringen eller melder den — og teksten '
      + 'siger det heller ikke. Den tæller derfor hverken for eller imod.',
  };
}

const beskrivDage = (d) => (d === 0 ? 'samme dag' : d < 0 ? `${-d} dage før` : `${d} dage efter`);

const kort = (t, n = 90) => (!t ? '' : t.length > n ? t.slice(0, n - 1) + '…' : t);

/* ---- Fagområder, der hører til en faggruppe -------------------------------
 * En opgave forklarer kun en hændelse, hvis den handler om det samme anlæg.
 * Uden den filtrering ville en tilfældig skadedyrsopgave i samme uge kunne
 * bortforklare et kompressorsvigt.
 */
export const FG_FAGOMRAADER = {
  koel_frys:    ['Køl/Frost', 'El tavler'],
  koeleflader:  ['Ventilation/Klima', 'Køl/Frost'],
  ventilation:  ['Ventilation/Klima', 'El tavler'],
  cts:          ['Ventilation/Klima', 'El tavler', 'Andet'],
  varme_fjern:  ['VVS/Sanitet', 'Ventilation/Klima'],
  varme_el:     ['VVS/Sanitet', 'El tavler'],
  overskudsvarme: ['VVS/Sanitet', 'Ventilation/Klima'],
  solceller:    ['Solceller', 'El tavler'],
  lys_inde:     ['Lys/El', 'El tavler'],
  lys_ude:      ['Lys/El', 'El tavler'],
  produktion:   ['Lys/El', 'Inventar/Vogne/Kurve'],
};

/**
 * Varslingstid på tværs af et sæt hændelser: hvor mange dage før butikken
 * ville måleren have sagt til?
 *
 * Kun `varsel` tæller med. `bekraeftet` giver nul dages forspring — begge
 * kilder så det samtidig — og skal ikke pynte på et gennemsnit.
 */
export function varslingsstatistik(koblinger) {
  const v = koblinger.filter((k) => k.klasse === 'varsel' && k.varslingsdage != null)
    .map((k) => k.varslingsdage).sort((a, b) => a - b);
  const tael = (k) => koblinger.filter((x) => x.klasse === k).length;
  return {
    antal: koblinger.length,
    varsler: v.length,
    bekraeftede: tael('bekraeftet'),
    forklarede: tael('forklaret'),
    uledsagede: tael('uledsaget'),
    medianDage: v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null,
    mindstDage: v.length ? v[0] : null,
    mestDage: v.length ? v[v.length - 1] : null,
  };
}
