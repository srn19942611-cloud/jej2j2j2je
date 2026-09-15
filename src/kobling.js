/* Koblingen mellem et anlæg i Dalux og et målepunkt i Enity.
 *
 * Det er den vigtigste kobling i hele hubben. Uden den kan vi sige "køl i
 * denne butik bruger 340.000 kWh" — men ikke "DETTE køleanlæg bruger for
 * meget". Forskellen er hele forskellen mellem en rapport og en driftsopgave.
 *
 * ---------------------------------------------------------------------------
 * Hvad data faktisk tillader — og hvad den ikke gør
 *
 * Ved gennemgang af de rigtige målepunkter viste sig ét stærkt mønster:
 * anlægskoden står i målernavnet. Enity-måleren "VE.02 Slagter" hører til
 * Dalux-anlægget "VE02.1". Det er ikke et gæt — det er den samme kode.
 *
 * Men det gælder kun 386 af 11.817 el- og varmemålere, altså 3,3 %. Resten
 * har ingen kode, og der findes typisk ÉN måler til FLERE anlæg: en butik med
 * fire ventilationsanlæg (VE01–VE04) kan have én måler mærket "Ventilation".
 *
 * Derfor er modellen bygget om det, data kan bære, ikke om det, vi kunne
 * ønske os:
 *
 *   · Er måleren dedikeret til ét anlæg → analysenheden ER anlægget.
 *   · Dækker måleren flere anlæg → analysenheden er GRUPPEN, ikke anlægget.
 *     Vi opfinder aldrig en fordelingsnøgle, der ikke er målt.
 *   · Har et anlæg ingen måler → det kan ikke energianalyseres. Det tælles
 *     som et hul, frem for at blive tildelt en andel af noget andet.
 *
 * At fordele en delt måler ud på fire anlæg efter fx installeret effekt ville
 * give fire pæne tal, som ingen kan efterprøve, og som ville lade en fejl på
 * ét anlæg forsvinde i gennemsnittet af fire. Det er præcis den slags tal, der
 * bruger tilliden op.
 *
 * ---------------------------------------------------------------------------
 * Ét anlæg har flere energistrømme
 *
 * Et ventilationsaggregat har både en elmåler (ventilatordrift), en varmemåler
 * (varmeflade) og ofte en elmåler til kølefladen. Det er tre forskellige
 * fysikker med hver sine fejlmåder — og i Coops opsætning tre forskellige
 * ansvarlige. L4-tagget fortæller præcis hvilken strøm måleren måler.
 */

import { klassificerMaalepunkt } from './anlaeg.js';

/* ---- Energistrømme (L4) --------------------------------------------------- */

export const ENERGISTROEMME = {
  'Kun ventilation':                     { stroem: 'el',    rolle: 'ventilatordrift', separabel: true,  fg: 'ventilation' },
  'Køleflade':                           { stroem: 'el',    rolle: 'køleflade',       separabel: true,  fg: 'koeleflader' },
  'Varmeflade':                          { stroem: 'varme', rolle: 'varmeflade',      separabel: true,  fg: 'varme_fjern' },
  'Samlet anlæg':                        { stroem: 'blandet', rolle: 'samlet',        separabel: false, fg: null },
  'køl- og varmeflade':                  { stroem: 'blandet', rolle: 'samlet',        separabel: false, fg: null },
  'El varmepumpe luft > vand':           { stroem: 'el',    rolle: 'varmepumpe-el',   separabel: true,  fg: 'varme_el' },
  'El varmepumpe luft > luft (Opvarmning)': { stroem: 'el', rolle: 'varmepumpe-el',   separabel: true,  fg: 'varme_el' },
  'El varmepumpe luft > luft (Nedkøling)':  { stroem: 'el', rolle: 'varmepumpe-køl',  separabel: true,  fg: 'koeleflader' },
  'Varme varmepumpe luft > vand':        { stroem: 'varme', rolle: 'varmepumpe-varme', separabel: true, fg: 'varme_el' },
  'Elpatron rørledning (elkassette)':    { stroem: 'el',    rolle: 'elpatron',        separabel: true,  fg: 'varme_el' },
  'Elpatron VVB':                        { stroem: 'el',    rolle: 'elpatron',        separabel: true,  fg: 'varme_el' },
  'Elpatron buffer-tank':                { stroem: 'el',    rolle: 'elpatron',        separabel: true,  fg: 'varme_el' },
  'Elvarme':                             { stroem: 'el',    rolle: 'elvarme',         separabel: true,  fg: 'varme_el' },
};

/** Læser energistrømmen af et målepunkts L4-tag. */
export function energistroem(maaler) {
  const tags = (maaler.tags || []).map((t) => String(t).replace(/^custom:/, '').trim());
  const l4 = tags.find((t) => t.startsWith('L4 '));
  if (l4) {
    const n = l4.slice(3).trim();
    const noegle = Object.keys(ENERGISTROEMME).find((k) => n.startsWith(k));
    if (noegle) return { ...ENERGISTROEMME[noegle], tag: l4 };
  }
  const et = String(maaler.energyType || maaler.energitype || '').toLowerCase();
  return {
    stroem: et === 'heat' ? 'varme' : et === 'water' ? 'vand' : 'el',
    rolle: 'ukendt', separabel: true, fg: null, tag: null,
  };
}

/* ---- Anlægskoder ----------------------------------------------------------
 * Coops egen navngivning: VE01, VE.02, KØ02.1, AC01. Vi normaliserer begge
 * sider til samme form og kræver, at koden findes i BÅDE anlægsnavnet og
 * målernavnet. Et falsk positivt på den ene side alene kan derfor ikke lave
 * en kobling.
 */
const KODE_PRAEFIKS = ['VE', 'KØ', 'KO', 'AC', 'VP', 'CTS', 'VA', 'KL', 'BE', 'EL'];
const KODE_RE = new RegExp(`\\b(${KODE_PRAEFIKS.join('|')})[\\s.\\-]?(\\d{1,2})(?:[.\\-]\\d{1,2})?\\b`, 'gi');

export function udtraekKoder(tekst) {
  const ud = new Set();
  for (const m of String(tekst || '').matchAll(KODE_RE)) {
    const praefiks = m[1].toUpperCase().replace('KO', 'KØ');
    ud.add(praefiks + String(parseInt(m[2], 10)).padStart(2, '0'));
  }
  return ud;
}

/* ---- Anlægsklasse → forventede målepunkt-tags ----------------------------- */

export const KLASSE_TIL_TAG = {
  'Ventilationsanlæg':                 ['L2 Ventilation'],
  'Varmegenvindingsanlæg':             ['L2 Ventilation', 'L0/1 Overskudsvarme'],
  'Ventilatorer/udsugning/indblæsning':['L2 Ventilation'],
  'Ventilatorer':                      ['L2 Ventilation'],
  'Chillere (komfortkøl)':             ['L2 Klimaanlæg', 'L4 Køleflade'],
  'Fancolis':                          ['L2 Klimaanlæg'],
  'Integreret køl':                    ['L4 Køleflade'],
  'Lufttæpper':                        ['L2 Klimaanlæg'],
  'Centralt køleanlæg (konsumkøl)':    ['L2 Primær køleanlæg', 'L0/1 Konsumkøl'],
  'Køleanlæg (konsumkøl)':             ['L2 Primær køleanlæg', 'L0/1 Konsumkøl'],
  'Single køleanlæg (konsumkøl)':      ['L2 Køle/frostrum med singlekomp.', 'L2 Køle/frostmøbel med singlekomp.'],
  'Køle-/frostgondoler':               ['L2 Møbler', 'L0/1 Konsumkøl'],
  'Køle-/frostreoler':                 ['L2 Møbler', 'L0/1 Konsumkøl'],
  'Køle-/frostrum':                    ['L2 Køle/frostrum med singlekomp.', 'L0/1 Konsumkøl'],
  'Anlæg for almen belysning':         ['L2 Grundbelysning', 'L2 Blandet belysning', 'L0/1 Lys'],
  'Anlæg for særbelysning':            ['L2 Særbelysning'],
  'Anlæg for sikkerhedsbelysning':     ['L0/1 Lys'],
  'Belysningsinstallation (udvendig)': ['L3 Udvendigt'],
  'Varmepumpeanlæg (Luft/Luft)':       ['L2 Varmepumpe'],
  'Varmepumpeanlæg (Luft/Vand)':       ['L2 Varmepumpe'],
  'Varmekabelanlæg':                   ['L2 Eltracing'],
  'Fjernvarmeanlæg':                   ['L0/1 Forsyningsmåler'],
  'Varmevekslere':                     ['L2 Varme VVB'],
  'Varmtvandsbeholdere (VVB)':         ['L2 Varme VVB', 'L2 Vand VVB'],
  'CTS-anlæg':                         ['L2 EDB / Terminal Tavle'],
  'BMS-anlæg':                         ['L2 EDB / Terminal Tavle'],
};

const tagsAf = (m) => (m.tags || []).map((t) => String(t).replace(/^custom:/, '').trim());
const zoneAf = (m) => { const t = tagsAf(m).find((x) => x.startsWith('L3 ')); return t ? t.slice(3).trim() : null; };

/* ---- Selve koblingen ------------------------------------------------------ */

/**
 * Kobler én butiks anlæg til dens målepunkter.
 *
 * Returnerer koblinger OG de analyseenheder, energimodellen faktisk kan regne
 * på — plus de huller, der er tilbage. Hullerne er lige så vigtige som
 * koblingerne: et anlæg uden måler er et anlæg, ingen detektor kan se.
 */
export function koblButik(anlaegsliste, maalere) {
  const anlaeg = (anlaegsliste || []).map((a) => ({
    id: String(a.asset_id ?? a.id ?? ''),
    navn: a.name ?? a.navn ?? '',
    beskrivelse: a.description ?? '',
    klasse: a.classification_name ?? a.klasse ?? null,
    koder: udtraekKoder(a.name ?? a.navn ?? ''),
  }));

  const maalepunkter = (maalere || [])
    .map((m) => {
      const k = klassificerMaalepunkt(m);
      return {
        id: String(m.id ?? m.meter_id ?? ''),
        navn: m.name ?? m.navn ?? '',
        energyType: m.energyType ?? m.energy_type ?? null,
        tags: tagsAf(m),
        zone: zoneAf(m),
        koder: udtraekKoder(m.name ?? m.navn ?? ''),
        faggruppe: k.faggruppe,
        rolle: k.rolle,
        stroem: energistroem(m),
      };
    })
    // Forsynings- og hovedmålere hører til butikken, ikke til et anlæg.
    .filter((m) => m.rolle !== 'forsyning' && m.rolle !== 'hovedmaaler_intern' && m.rolle !== 'lejer');

  const koblinger = [];
  const brugteMaalere = new Set();

  /* Trin 1 · anlægskode i målernavnet. Den sikreste vej, og den eneste, der
     giver en ægte 1:1-kobling. */
  for (const m of maalepunkter) {
    if (!m.koder.size) continue;
    const traef = anlaeg.filter((a) => [...a.koder].some((k) => m.koder.has(k)));
    if (traef.length === 1) {
      koblinger.push(kobling(traef[0], m, 1, 0.95, false,
        `Anlægskoden "${[...m.koder][0]}" står i både anlægsnavnet "${traef[0].navn}" og målernavnet "${m.navn}".`));
      brugteMaalere.add(m.id);
    }
  }

  /* Trin 1b · zonekort lært af kodematchene.
   *
   * Måleren "VE.02 Slagter" fortæller to ting: at VE02 er anlægget, og at
   * VE02 står i slagteren. Den anden oplysning kan bruges på nabomåleren
   * "Klimakøl slagter", som kun har zonen at gå efter. Uden det her trin
   * bliver kølefladen i slagteren koblet til alle butikkens fem
   * ventilationsanlæg — og så kan ingen sige, hvad der er galt med hvad.
   */
  const zonekort = new Map();
  for (const k of koblinger) {
    const m = maalepunkter.find((x) => x.id === k.meterId);
    if (!m || !m.zone) continue;
    const z = m.zone.toLowerCase();
    if (!zonekort.has(z)) zonekort.set(z, new Set());
    zonekort.get(z).add(k.anlaegId);
  }
  // Zonen skal pege entydigt. Står der to anlæg i samme zone, lærer vi intet.
  for (const [z, ids] of zonekort) if (ids.size !== 1) zonekort.delete(z);

  /* Trin 2–3 · klasse mod tag. Her afgøres det, om måleren er dedikeret til
     ét anlæg eller dækker en gruppe — og dét afgør, hvad vi må regne på. */
  for (const m of maalepunkter) {
    if (brugteMaalere.has(m.id)) continue;
    const kandidater = anlaeg.filter((a) => {
      const forventede = KLASSE_TIL_TAG[normklasse(a.klasse)] || [];
      if (!forventede.length) return false;
      if (!forventede.some((f) => m.tags.some((t) => t.startsWith(f)))) return false;
      // Zonen skal passe, når begge har en. Ventilation i slagteren er ikke
      // ventilation i kontoret, og at slå dem sammen ville skjule begge.
      return true;
    });
    if (!kandidater.length) continue;

    // Er zonen kendt på måleren, så snævr ind: først via det zonekort, de
    // kodematchede målere har lært os, dernæst via anlæggets eget navn.
    let valgte = kandidater;
    let viaZone = null;
    if (m.zone && kandidater.length > 1) {
      const laert = zonekort.get(m.zone.toLowerCase());
      const fraKort = laert ? kandidater.filter((a) => laert.has(a.id)) : [];
      if (fraKort.length === 1) { valgte = fraKort; viaZone = 'lært'; }
      else {
        const iNavn = kandidater.filter((a) =>
          `${a.navn} ${a.beskrivelse}`.toLowerCase().includes(m.zone.toLowerCase()));
        if (iNavn.length) { valgte = iNavn; viaZone = 'navn'; }
      }
    }

    if (valgte.length === 1) {
      koblinger.push(kobling(valgte[0], m, viaZone === 'lært' ? 2 : 2, viaZone === 'lært' ? 0.85 : 0.8, false,
        viaZone === 'lært'
          ? `Måleren står i zonen "${m.zone}", og en anden måler i butikken har vist, at det er anlægget `
            + `"${valgte[0].navn}", der står der.`
          : `Målerens tag passer til anlægsklassen "${valgte[0].klasse}", og butikken har kun ét anlæg af den type`
            + (m.zone ? ` i zonen "${m.zone}".` : '.')));
      brugteMaalere.add(m.id);
    } else {
      // Delt måler. Analysenheden bliver gruppen — ikke det enkelte anlæg.
      for (const a of valgte) {
        koblinger.push(kobling(a, m, 3, 0.85, true,
          `Måleren dækker ${valgte.length} anlæg af typen "${a.klasse}". `
          + 'Forbruget kan derfor kun gøres op for gruppen, ikke for det enkelte anlæg.'));
      }
      brugteMaalere.add(m.id);
    }
  }

  /* Målere, der nævner en anlægskode, som ikke findes i Dalux.
   *
   * Butikken har en måler ved navn "VE.05 Kiosk køkken", men intet anlæg
   * VE05 i anlægsregistret. Det er ikke en koblingsfejl — det er et hul i
   * Dalux, og det er værd at melde som sådan. Et anlæg, der ikke er oprettet,
   * kan ingen opgave hænges på, og ingen serviceaftale dækker.
   */
  const kendteKoder = new Set(anlaeg.flatMap((a) => [...a.koder]));
  const manglendeAnlaeg = [];
  for (const m of maalepunkter) {
    for (const kode of m.koder) {
      if (kendteKoder.has(kode)) continue;
      manglendeAnlaeg.push({ kode, meterId: m.id, meterNavn: m.navn,
        hvorfor: `Måleren "${m.navn}" peger på anlægget ${kode}, men det findes ikke i butikkens Dalux-register.` });
    }
  }

  /* Analyseenheder: det, energimodellen faktisk kan regne på. */
  const enheder = byggEnheder(koblinger, maalepunkter, anlaeg, brugteMaalere);

  return {
    koblinger,
    enheder,
    anlaegUdenMaaler: anlaeg.filter((a) => !koblinger.some((k) => k.anlaegId === a.id)),
    maalereUdenAnlaeg: maalepunkter.filter((m) => !brugteMaalere.has(m.id)),
    manglendeAnlaeg,
    // To dækningstal, ikke ét. "Koblet" og "kan analyseres hver for sig" er
    // ikke det samme, og kun det sidste giver en sag på et bestemt anlæg.
    daekning: anlaeg.length ? Math.round(100 * new Set(koblinger.map((k) => k.anlaegId)).size / anlaeg.length) : 0,
    dedikeretDaekning: anlaeg.length
      ? Math.round(100 * new Set(koblinger.filter((k) => !k.delt).map((k) => k.anlaegId)).size / anlaeg.length) : 0,
  };
}

function normklasse(k) {
  return String(k || '').replace(/^AFLEVERING\s*-\s*/i, '').trim();
}

function kobling(a, m, trin, konfidens, delt, begrundelse) {
  return {
    anlaegId: a.id, anlaegNavn: a.navn, anlaegKlasse: a.klasse,
    meterId: m.id, meterNavn: m.navn,
    energistroem: m.stroem.stroem, energirolle: m.stroem.rolle,
    separabel: m.stroem.separabel, faggruppe: m.stroem.fg || m.faggruppe,
    zone: m.zone, trin, konfidens, delt,
    // Vi sætter aldrig en andel, vi ikke har målt. Er måleren delt, er
    // andelen ukendt — og det er et ærligt svar, ikke en mangel.
    andel: delt ? null : 1,
    begrundelse,
  };
}

/**
 * Analyseenheder. Det er HER, modellen bliver ærlig: en enhed er enten
 * ét anlæg med sin egen måler, eller en gruppe anlæg, der deler en måler.
 * En måler uden anlæg er stadig en enhed — vi kan analysere forbruget, vi
 * kan bare ikke sige hvilket komponent, det sidder på.
 */
function byggEnheder(koblinger, maalepunkter, anlaeg, brugteMaalere) {
  const enheder = [];
  const prMaaler = new Map();
  for (const k of koblinger) {
    if (!prMaaler.has(k.meterId)) prMaaler.set(k.meterId, []);
    prMaaler.get(k.meterId).push(k);
  }

  for (const [meterId, liste] of prMaaler) {
    const m = maalepunkter.find((x) => x.id === meterId);
    const delt = liste.length > 1;
    enheder.push({
      id: `E-${meterId}`,
      slags: delt ? 'gruppe' : 'anlæg',
      navn: delt
        ? `${liste[0].anlaegKlasse} — ${liste.length} anlæg${m.zone ? ` (${m.zone})` : ''}`
        : liste[0].anlaegNavn,
      meterId,
      meterNavn: m.navn,
      anlaeg: liste.map((k) => ({ id: k.anlaegId, navn: k.anlaegNavn })),
      klasse: liste[0].anlaegKlasse,
      faggruppe: liste[0].faggruppe,
      energistroem: liste[0].energistroem,
      energirolle: liste[0].energirolle,
      separabel: liste[0].separabel,
      zone: m.zone,
      konfidens: liste[0].konfidens,
      // Hvad der kan konkluderes på enheden — og hvad der ikke kan.
      kanPegePaaAnlaeg: !delt,
      forbehold: delt
        ? `Måleren dækker ${liste.length} anlæg. En afvigelse peger på gruppen, ikke på et bestemt anlæg — `
          + 'servicebesøget skal starte med at finde ud af hvilket.'
        : liste[0].separabel ? null
          : 'Måleren dækker både ventilation, køle- og varmeflade i ét. De tre kan ikke skilles ad, '
            + 'og en afvigelse kan derfor ikke henføres til én af dem.',
    });
  }

  // Målere uden anlæg kan stadig analyseres — vi ved bare ikke hvad de sidder på.
  for (const m of maalepunkter) {
    if (brugteMaalere.has(m.id)) continue;
    enheder.push({
      id: `E-${m.id}`, slags: 'måler', navn: m.navn,
      meterId: m.id, meterNavn: m.navn, anlaeg: [], klasse: null,
      faggruppe: m.stroem.fg || m.faggruppe, energistroem: m.stroem.stroem,
      energirolle: m.stroem.rolle, separabel: m.stroem.separabel, zone: m.zone,
      konfidens: 0.5, kanPegePaaAnlaeg: false,
      forbehold: 'Målepunktet er ikke koblet til et anlæg i Dalux. Forbruget kan følges, '
        + 'men en sag på det kan ikke oprettes på et komponent.',
    });
  }

  return enheder;
}

/** Kører koblingen for hele porteføljen og gør dækningen op. */
export function koblPortefoelje(anlaegPrButik, maalerePrButik) {
  const resultat = new Map();
  const opgoerelse = { butikker: 0, koblinger: 0, trin1: 0, trin2: 0, trin3: 0,
    anlaegIAlt: 0, anlaegMedMaaler: 0, maalereUdenAnlaeg: 0, enheder: 0, gruppeenheder: 0 };

  for (const [kardex, anlaeg] of anlaegPrButik) {
    const maalere = maalerePrButik.get(kardex) || [];
    const r = koblButik(anlaeg, maalere);
    resultat.set(kardex, r);
    opgoerelse.butikker++;
    opgoerelse.koblinger += r.koblinger.length;
    for (const k of r.koblinger) opgoerelse['trin' + k.trin]++;
    opgoerelse.anlaegIAlt += anlaeg.length;
    opgoerelse.anlaegMedMaaler += new Set(r.koblinger.map((k) => k.anlaegId)).size;
    opgoerelse.maalereUdenAnlaeg += r.maalereUdenAnlaeg.length;
    opgoerelse.enheder += r.enheder.length;
    opgoerelse.gruppeenheder += r.enheder.filter((e) => e.slags === 'gruppe').length;
  }
  opgoerelse.daekningPct = opgoerelse.anlaegIAlt
    ? Math.round(100 * opgoerelse.anlaegMedMaaler / opgoerelse.anlaegIAlt) : 0;
  return { resultat, opgoerelse };
}
