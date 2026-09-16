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
  /* Tilføjet efter kvarterskørslen: det er præcis de ord, et fund om drift
   * uden for tiden bliver meldt ind med, og uden dem læses de som "ukendt". */
  'kører konstant', 'kører hele tiden', 'kører i weekenden', 'kører om natten',
  'slukker ikke', 'går ikke i stå', 'mangler ugeprogram', 'ingen ugeprogram',
  'står og kører', 'kører døgnet rundt', 'for koldt', 'trækker', 'træk i',
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
  /* Hvor langt før hændelsen en opgave må ligge og stadig regnes som en
   * bekræftelse, afhænger af, om teksten siger hvad den er.
   *
   * Siger den tydeligt fejl — "aggregatet står", "kan ikke holde temperatur"
   * — så er de to-tre døgn ikke et problem, men det normale: butikken mærker
   * symptomet, før forbrugssignaturen har flyttet sig nok til at blive fundet,
   * og vores egen bruddato har selv et par døgns usikkerhed. Teksten afgør
   * dét, datoen ikke kan.
   *
   * Siger teksten ingenting, står tvetydigheden ved magt, og så er vinduet
   * kun ét døgn — resten falder igennem til den ærlige "kan ikke afgøres"
   * nedenfor. */
  const samme = kandidater
    .filter((o) => o.dage <= vinduer.samtidig
      && o.dage >= (o.karakter === 'fejlmelding' ? -vinduer.samtidig : -1))
    .sort((a, b) => Math.abs(a.dage) - Math.abs(b.dage))[0];
  if (samme) {
    return {
      klasse: 'bekraeftet', ...SAMTIDIGHED.bekraeftet, opgave: samme, dage: samme.dage, faggruppe,
      tekst: `Butikken meldte fejlen ind ${samme.dage === 0 ? 'samme dag' : beskrivDage(samme.dage)}: "${kort(samme.tekst)}".`
        + (samme.dage < -1 ? ' Den ligger lidt før vores bruddato, og det er det forventede: butikken mærker'
          + ' symptomet, før forbruget har flyttet sig nok til at blive fundet.' : ''),
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

/* ---- Opgaver udefra ---------------------------------------------------------
 *
 * Dalux kan ikke nås herindefra — egress-proxyen afviser værten på
 * gateway-niveau, og det er en politik, ikke en indstilling. Opgaverne må
 * derfor hentes dér, hvor der er adgang, og læses ind her.
 *
 * Det gør fordelingen til det svære led. En opgave peger på et ANLÆG ("VE.02
 * Slagter", "Ventilation bageri"), og analysen kører på en MÅLER. Imellem dem
 * står koblingen, og den er kun sikker, hvor anlægskoden går igen.
 *
 * Reglen herunder er derfor mistroisk med vilje: en opgave hænges kun på en
 * enhed, når koblingen kan begrundes. Kan den ikke, bliver opgaven liggende
 * på butikken som ufordelt. Det er et dårligere svar og et ærligt et — for en
 * opgave, der hænges på den forkerte måler, gør ikke diagnosen tom, den gør
 * den forkert. En "uledsaget" måler, der i virkeligheden har en opgave, er et
 * hul vi kan se; en forkert kobling ligner et fund.
 */

/* Anlægskoden læses med den samme regel som koblingen anlæg↔måler bruger.
 * kobling.js henter kun fra anlaeg.js, så der er ingen ring her. */
import { udtraekKoder } from './kobling.js';

/** Ord, der findes i næsten alle målernavne og derfor ikke kan skille noget ad. */
const GENERISKE_ORD = new Set([
  'ventilation', 'vent', 'anlæg', 'anlaeg', 'tavle', 'butik', 'lys', 'el', 'måler', 'maaler',
  'klima', 'køl', 'koel', 'varme', 'total', 'hoved', 'udv', 'udvendig', 'indedel', 'kompressor',
]);

const ord = (s) => String(s || '').toLowerCase().split(/[^a-zæøå0-9.]+/)
  .filter((o) => o.length > 2 && !GENERISKE_ORD.has(o));

/**
 * Fordeler opgaver ud på analyseenheder.
 *
 * `enheder` er dem, koblButik leverer: hver med `anlaeg: [{id, navn}]`,
 * `meterNavn` og `butiksnummer`. `opgaver` skal have `butiksnummer`, `dato`
 * og `anlaeg` (fritekst fra Dalux).
 *
 * Returnerer `{ prEnhed, ufordelt, begrundelser }`. `prEnhed` kan sendes
 * direkte til diagnosticerTabel som `opgaverPrEnhed`.
 */
export function fordelOpgaver(enheder, opgaver, { kunSammeButik = true } = {}) {
  const prEnhed = {};
  const ufordelt = [];
  const begrundelser = [];

  for (const o of opgaver || []) {
    const mulige = (enheder || []).filter((e) =>
      !kunSammeButik || String(e.butiksnummer) === String(o.butiksnummer));

    /* En blandet tavle eller en samlemåler kan aldrig bære en opgave. Den
     * dækker både butik og produktion, så et navnesammenfald er netop dét —
     * et sammenfald. Fælden er reel: 02020 548524 "Teknik Tavle (Butik V)"
     * ville ellers optage enhver ventilationsopgave i butikken. */
    const kandidater = mulige.filter((e) =>
      !/teknik.?tavle|tavle uden|blandet|alt i butikken|el total|hovedmåler|forsynings/i.test(e.meterNavn || ''));

    /* 1 · Anlægs-id. Det eneste, der er sikkert. */
    let traf = kandidater.filter((e) => (e.anlaeg || []).some((a) => o.anlaegId && String(a.id) === String(o.anlaegId)));
    let hvordan = 'anlægs-id';

    /* 2 · Anlægskoden. "VE.02 Slagter" og "VE02.1" er den samme kode. */
    if (!traf.length && o.anlaeg) {
      const koder = udtraekKoder(o.anlaeg);
      if (koder.size) {
        traf = kandidater.filter((e) => (e.anlaeg || []).some((a) => [...udtraekKoder(a.navn)].some((k) => koder.has(k)))
          || [...udtraekKoder(e.meterNavn || '')].some((k) => koder.has(k)));
        hvordan = 'anlægskode';
      }
    }

    /* 3 · Særegne ord i navnet — slagter, bageri, parkering. Generiske ord
     * tæller ikke, for "ventilation" findes i hver anden måler. */
    if (!traf.length && o.anlaeg) {
      const oo = new Set(ord(o.anlaeg));
      if (oo.size) {
        traf = kandidater.filter((e) => {
          const eo = [...ord(e.meterNavn), ...(e.anlaeg || []).flatMap((a) => ord(a.navn))];
          return eo.some((x) => oo.has(x));
        });
        hvordan = 'særegent ord i navnet';
      }
    }

    if (traf.length === 1) {
      const id = traf[0].id;
      (prEnhed[id] = prEnhed[id] || []).push(o);
      begrundelser.push({ opgave: o, enhedId: id, hvordan });
    } else {
      /* Nul træf er lige så meget et svar som for mange. Begge ender samme
       * sted, men grunden skal med, for den siger hvad der skal rettes:
       * ingen kobling betyder manglende anlægsdata, flere betyder en måler,
       * der dækker mere end ét anlæg. */
      ufordelt.push({
        ...o,
        grund: traf.length === 0
          ? 'ingen enhed i butikken kunne kobles til anlægget'
          : `${traf.length} enheder passer lige godt (${traf.map((e) => e.meterNavn).join(', ')}) — koblingen ville være et gæt`,
      });
    }
  }

  return { prEnhed, ufordelt, begrundelser };
}

/**
 * Læser en opgavetabel med rør som skilletegn.
 * Forventede kolonner: butik, anlæg, dato, fagområde, titel, status.
 */
export function laesOpgavetabel(tekst) {
  const linjer = String(tekst || '').split('\n').map((l) => l.trim()).filter((l) => l.includes('|'));
  const raekker = [];
  const fejl = [];
  for (const l of linjer) {
    const d = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());
    if (d.length < 4) { fejl.push(`for få felter: ${l}`); continue; }
    if (/^[-: ]+$/.test(d.join(''))) continue;                       // skillelinje
    if (/butik/i.test(d[0]) && /anl(æ|ae)g/i.test(d[1])) continue;   // overskrift
    const [butiksnummer, anlaeg, dato, fagomraade, titel, status] = d;
    if (!/^\d{4}-\d{2}-\d{2}/.test(dato)) { fejl.push(`ikke en dato: "${dato}" i ${l}`); continue; }
    raekker.push({
      butiksnummer, anlaeg, dato: dato.slice(0, 10), fagomraade: fagomraade || null,
      tekst: titel || '', titel: titel || '', status: status || null,
    });
  }
  return { raekker, fejl };
}
