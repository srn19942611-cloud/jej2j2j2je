/* Signaturer målt et andet sted.
 *
 * Hubben kan ikke selv nå Enity herindefra — egress-proxyen afviser værten.
 * Det betyder ikke, at analysen skal køre på modellerede tal: målingen kan
 * laves dér, hvor data er, og diagnosen stilles her, hvor kataloget er.
 *
 * Det er en fornuftig arbejdsdeling og ikke kun en nødløsning. Målingen er
 * mekanisk og veldefineret — en regression, et skiftepunkt, en hældning. Det,
 * der kræver fagligheden, er at vide hvad formen BETYDER, og det ligger i
 * årsagskataloget.
 *
 * Men det stiller ét krav, som denne fil handler om: tal, der kommer udefra,
 * skal efterprøves, før de bruges. En signatur, der er målt forkert, giver en
 * diagnose, der lyder lige så overbevisende som en rigtig. Derfor afvises
 * rækker, der er indbyrdes modstridende, frem for at blive regnet på.
 */

import { diagnosticer } from './aarsag.js';
import { samtidighed, FG_FAGOMRAADER } from './korrelation.js';
import { median } from './statistik.js';

/* ---- Efterprøvning -------------------------------------------------------- */

/**
 * Er de målte tal indbyrdes konsistente?
 *
 * Tjekkene er ikke formaliteter. Hver af dem svarer til en fejl, det er let at
 * begå, når signaturen regnes et andet sted end der, hvor den bruges.
 */
export function efterproev(m) {
  const fejl = [];
  const advarsler = [];

  const tal = (x) => Number.isFinite(x);

  if (!tal(m.medianResidual) || !tal(m.medianForudsagt)) fejl.push('mangler median residual eller forudsagt');
  if (tal(m.medianForudsagt) && m.medianForudsagt <= 0) fejl.push('forudsagt forbrug er nul eller negativt — modellen kan ikke være tilpasset');

  /* Procenten skal kunne genberegnes af de to tal, den er lavet af. Gør den
   * ikke det, er mindst ét af dem fra en anden periode end de andre — og det
   * er den hyppigste fejl, når tal samles fra flere kørsler. */
  if (tal(m.afvigPct) && tal(m.medianResidual) && tal(m.medianForudsagt) && m.medianForudsagt > 0) {
    const regnet = 100 * m.medianResidual / m.medianForudsagt;
    if (Math.abs(regnet - m.afvigPct) > Math.max(2, Math.abs(m.afvigPct) * 0.15)) {
      fejl.push(`afvigelsen på ${m.afvigPct} % passer ikke med ${m.medianResidual} / ${m.medianForudsagt} = ${Math.round(regnet)} %`);
    }
  }

  /* Restniveau og afvigelse måler det samme fra hver sin ende: restniveau er
   * faktisk/forudsagt, afvigelsen er (faktisk−forudsagt)/forudsagt. De skal
   * summere til 1. */
  if (tal(m.restniveau) && tal(m.afvigPct)) {
    const forventet = 1 + m.afvigPct / 100;
    /* Tolerancen skal være RELATIV, ikke absolut.
     *
     * Første udgave krævede, at de to lå inden for 0,08 af hinanden. Ved et
     * restniveau omkring 1 er det 8 % og rimeligt. Men restniveauet kan
     * sagtens være 6,3 — et anlæg, der bruger seks gange det forventede — og
     * dér er 0,08 en tolerance på 1,3 %, altså strengere end de afrundinger,
     * tallene overhovedet er opgivet med. Tolv af fyrre rigtige rækker blev
     * afvist på den konto, og de var alle sammen konsistente. */
    const tolerance = Math.max(0.08, Math.abs(forventet) * 0.04);
    if (Math.abs(m.restniveau - forventet) > tolerance) {
      fejl.push(`restniveau ${m.restniveau} og afvigelse ${m.afvigPct} % er uforenelige — `
        + `de burde give ${Math.round(forventet * 100) / 100}`);
    }
  }

  if (tal(m.restniveau) && m.restniveau < 0) fejl.push('negativt restniveau');

  // En temperaturkoefficient på nul gør vejrbeviset meningsløst frem for falsk.
  if (tal(m.b) && Math.abs(m.b) < 1e-6) advarsler.push('temperaturkoefficienten er nul — vejrafhængigheden kan ikke vurderes');

  if (tal(m.overgangsdoegn) && m.overgangsdoegn < 0) fejl.push('negativ overgangsbredde');

  /* En model, der ikke forklarer noget, giver en normal, der næsten er et
   * gennemsnit — og en afvigelse målt mod den bærer modellens usikkerhed med
   * sig. Benchmarket satte tal på: en normallastmodel uden dagtypeled melder
   * op til 15 % afvigelse på en ren ventilationsserie. Er den målte afvigelse
   * ikke væsentligt større end det, kan den lige så godt være modellens som
   * anlæggets. */
  /* Men ikke på fund, der slet ikke afhænger af modellen.
   *
   * Et målepunkt på nul er på nul, uanset hvad normalen siger. Første udgave
   * hæftede forbeholdet på tyve af tredive fund — og hovedparten var døde
   * målere på −100 %, hvor konklusionen står lige så fast med eller uden
   * model. Et forbehold, der sættes på alt, betyder ingenting. */
  const modeluafhaengigt = tal(m.restniveau) && (m.restniveau <= 0.05 || m.restniveau >= 3);
  if (tal(m.r2) && m.r2 < 0.25 && !modeluafhaengigt) {
    advarsler.push(`Modellen forklarer kun ${Math.round(m.r2 * 100)} % af variationen. Normalen er dermed `
      + 'tæt på et gennemsnit, og afvigelsen bærer den usikkerhed med sig.');
    if (tal(m.afvigPct) && Math.abs(m.afvigPct) < 40) {
      advarsler.push(`Afvigelsen på ${m.afvigPct} % ligger i det interval, hvor en modelskævhed alene kan `
        + 'flytte konklusionen. Bekræft med en sammenligning mod samme periode sidste år på lige varme '
        + 'døgn, før nogen rykker ud.');
    }
  }
  if (tal(m.segmentdoegn) && m.segmentdoegn < 10) {
    advarsler.push(`kun ${m.segmentdoegn} døgn efter bruddet — afvigelsen har ikke holdt længe nok til at være sikker`);
  }
  if (tal(m.referencedoegn) && m.referencedoegn < 60) {
    advarsler.push(`kun ${m.referencedoegn} referencedøgn — normalen er tynd`);
  }

  return { ok: !fejl.length, fejl, advarsler };
}

/* ---- Fra måling til signatur ---------------------------------------------- */

/**
 * Bygger den signatur, `diagnosticer` forventer, ud af målte tal.
 *
 * Grænserne herinde er de samme som i `maalSignatur`, og det er med vilje: to
 * sæt tærskler for det samme ville før eller siden komme til at pege hver sin
 * vej, og så ville ingen kunne se hvorfor.
 */
export function signaturFraMaaling(m) {
  const k = efterproev(m);
  if (!k.ok) return { brugbar: false, grund: k.fejl.join('; '), fejl: k.fejl };

  const afvig = m.medianResidual;
  const forventet = m.medianForudsagt;
  const pct = m.afvigPct ?? (100 * afvig / forventet);

  // Form: samme rækkefølge som i maalSignatur — nul først, så ingen, så form.
  let form;
  if (m.restniveau != null && m.restniveau <= 0.02) form = 'nul';
  else if (Math.abs(pct) < 3) form = 'ingen';
  else if (m.overgangsdoegn != null && m.overgangsdoegn <= 14 && m.brudDato) form = 'spring';
  else form = 'glidende';

  // Vejrafhængighed: hældningen af de detrendede residualer, målt i anlæggets
  // egen temperaturkoefficient. Over en fjerdedel regnes som afhængig.
  const forhold = m.vejrforhold;
  const vejrafhaengig = forhold == null ? 'ukendt'
    : Math.abs(forhold) > 0.25 ? (forhold > 0 ? 'ja' : 'omvendt') : 'nej';

  let vejrrespons = 'ukendt';
  if (Number.isFinite(m.koefFoer) && Number.isFinite(m.koefEfter) && Math.abs(m.koefFoer) > 1e-6) {
    const r = m.koefEfter / m.koefFoer;
    vejrrespons = r < 0.25 ? 'brudt' : r > 1.6 ? 'forstærket' : 'uændret';
  }

  return {
    brugbar: true,
    form,
    retning: afvig > 0 ? 'op' : afvig < 0 ? 'ned' : 'flad',
    afvigKwhPrDoegn: Math.round(afvig),
    afvigPct: Math.round(pct * 10) / 10,
    forventetKwhPrDoegn: Math.round(forventet),
    normalKwhPrDoegn: Math.round(forventet),
    restniveau: m.restniveau ?? null,
    vejrafhaengig,
    vejrkobling: forhold == null ? null : { variabel: 'temperatur', andel: forhold, anlaegKoef: m.b ?? null },
    vejrrespons,
    koefFoer: m.koefFoer ?? null,
    koefEfter: m.koefEfter ?? null,
    overgangsdoegn: m.overgangsdoegn ?? null,
    brud: m.brudDato ? { dato: m.brudDato } : null,
    segmentStart: m.brudDato || m.segmentStart || null,
    doegn: m.segmentdoegn ?? null,
    vurderingsdoegn: m.vurderingsdoegn ?? null,
    referencedoegn: m.referencedoegn ?? null,
    // Målt et andet sted — det skal følge med, så det kan ses i forbeholdene.
    modelleret: false,
    maaltEksternt: true,
    mangler: [
      m.vejrforhold == null ? 'vejrafhængighed er ikke målt' : null,
      'timedata — døgnprofil og natandel kan ikke ses',
      Number.isFinite(m.r2) && m.r2 < 0.25 && !(Number.isFinite(m.restniveau) && (m.restniveau <= 0.05 || m.restniveau >= 3))
        ? `normallastmodellen forklarer kun ${Math.round(m.r2 * 100)} % af variationen` : null,
    ].filter(Boolean),
    advarsler: k.advarsler,
  };
}

/**
 * Hele vejen: målte tal ind, diagnose ud.
 *
 * `opgaver` er valgfri. Uden Dalux-opgaver på anlægget bliver koblingen
 * "uledsaget", og det er et ærligt svar — ikke en mangel, der skal skjules.
 */
export function diagnosticerMaaling(m, { faggruppe, maalerrolle = null, opgaver = [], priors = null, gentagneOpgaver = 0 } = {}) {
  const signatur = signaturFraMaaling(m);
  if (!signatur.brugbar) return { brugbar: false, grund: signatur.grund, fejl: signatur.fejl };

  const kobling = signatur.segmentStart
    ? samtidighed({ dato: signatur.segmentStart }, opgaver, { faggruppe, relevante: FG_FAGOMRAADER[faggruppe] })
    : null;

  const diagnose = diagnosticer(signatur, { faggruppe, maalerrolle, kobling, priors, gentagneOpgaver });
  return { brugbar: true, signatur, kobling, diagnose };
}

/**
 * Kører en hel tabel igennem og holder regnskab med, hvad der ikke kunne bruges.
 * Rækker, der ikke består efterprøvningen, forsvinder ikke — de står som
 * afviste med en grund, så en fejl i målingen kan findes og rettes i stedet for
 * bare at mangle.
 */
export function diagnosticerTabel(raekker, { priors = {}, opgaverPrEnhed = {} } = {}) {
  const fund = [];
  const afvist = [];
  const udenDiagnose = [];
  for (const m of raekker) {
    const r = diagnosticerMaaling(m, {
      faggruppe: m.faggruppe,
      maalerrolle: m.maalerrolle,
      opgaver: opgaverPrEnhed[m.maalerId] || [],
      priors: priors[m.faggruppe] || null,
    });
    if (!r.brugbar) { afvist.push({ ...m, grund: r.grund }); continue; }
    /* En måler, der ikke kan bære en diagnose, er hverken et fund eller en
     * målefejl. Den holdes for sig, så den ikke tælles med som et fund og
     * heller ikke forsvinder i afvisningerne sammen med de forkerte tal. */
    if (r.diagnose.diagnoserbar === false) {
      udenDiagnose.push({ ...m, signatur: r.signatur, grundId: r.diagnose.bedste.id,
        grund: r.diagnose.bedste.navn, forklaring: r.diagnose.bedste.forklaring, tjek: r.diagnose.bedste.tjek });
      continue;
    }
    fund.push({
      ...m,
      signatur: r.signatur,
      kobling: r.kobling,
      aarsagId: r.diagnose.bedste.id,
      aarsag: r.diagnose.bedste.navn,
      konfidens: r.diagnose.konfidens,
      entydig: r.diagnose.entydig,
      naest: r.diagnose.naest ? { id: r.diagnose.naest.id, navn: r.diagnose.naest.navn, andel: Math.round(r.diagnose.naest.andel * 100) } : null,
      beviser: r.diagnose.bedste.beviser,
      forbehold: r.diagnose.forbehold,
      klasse: r.diagnose.bedste.klasse,
      hastende: !!r.diagnose.bedste.hastende,
    });
  }
  return { fund, afvist, udenDiagnose };
}

/* ---- Indlæsning af en måletabel -------------------------------------------
 * Tallene kommer som en tabel, ikke som JSON. Det er med vilje: en tabel kan
 * læses af et menneske, og den, der har målt, kan se hvad de sendte.
 *
 * Til gengæld skal indlæsningen være mistroisk. Danske tal bruger komma som
 * decimaltegn og punktum som tusindtalsskilletegn, og "1.234" betyder derfor
 * noget vidt forskelligt afhængigt af, hvem der skrev det. Vi gætter ikke —
 * vi afgør det på formen og siger til, når den er tvetydig.
 */

/** Læser ét tal. Returnerer null frem for NaN, så et hul ikke bliver til nul. */
export function talAf(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s|kWh|%|kr\.?/gi, '');
  if (!t || t === '—' || t === '-' || t === 'n/a') return null;

  /* Dansk eller engelsk? Afgjort på formen, ikke på et gæt:
   *   "1.234,5"  → komma sidst: dansk, punktum er tusindtal
   *   "1,234.5"  → punktum sidst: engelsk, komma er tusindtal
   *   "0,52"     → kun komma: dansk decimal
   *   "1.234"    → kun punktum, præcis tre cifre efter: tusindtal (tvetydig!)
   */
  const sidsteKomma = t.lastIndexOf(',');
  const sidstePunktum = t.lastIndexOf('.');
  let rent;
  if (sidsteKomma >= 0 && sidstePunktum >= 0) {
    rent = sidsteKomma > sidstePunktum
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (sidsteKomma >= 0) {
    rent = t.replace(',', '.');
  } else if (sidstePunktum >= 0 && /\.\d{3}$/.test(t) && t.replace('.', '').length > 3) {
    // "1.234" med præcis tre cifre efter punktummet: dansk tusindtal.
    rent = t.replace(/\./g, '');
  } else {
    rent = t;
  }
  const n = Number(rent);
  return Number.isFinite(n) ? n : null;
}

/**
 * Læser en rørdelt tabel (markdown eller ren tekst) til rækker.
 *
 * Kolonnerne findes ud fra overskriften frem for ud fra deres plads, så en
 * tabel med en ekstra kolonne eller en anden rækkefølge stadig kan læses.
 */
export const KOLONNER = {
  butik: ['butik', 'store'],
  maalerId: ['måler-id', 'maaler-id', 'meterid', 'måler id', 'id'],
  navn: ['navn', 'name'],
  tags: ['tags', 'tag'],
  a: ['a'],
  b: ['b'],
  brudDato: ['brud-dato', 'bruddato', 'brud', 'dato'],
  overgangsdoegn: ['b (døgn)', 'overgang', 'bredde', 'b_doegn'],
  medianResidual: ['median residual', 'residual'],
  afvigPct: ['afvig %', 'afvig%', 'afvigelse %', 'afvigelse'],
  restniveau: ['restniveau'],
  vejrforhold: ['vejrhældning/|b|', 'vejrhældning/|b', 'vejrhaeldning', 'vejrforhold', 'vejrhældning', 'vejr'],
  koefFoer: ['koef før', 'koef foer', 'koeffør'],
  koefEfter: ['koef efter'],
  medianForudsagt: ['median forudsagt', 'forudsagt'],
};

export function laesMaaletabel(tekst) {
  const linjer = String(tekst || '').split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'));
  if (!linjer.length) return { raekker: [], fejl: ['ingen tabelrækker fundet'] };

  const del = (l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());
  let hoved = del(linjer[0]).map((x) => x.toLowerCase().replace(/\*/g, ''));
  const advarsler = [];

  /* En kolonneoverskrift kan selv indeholde et rørtegn.
   *
   * Det er ikke en teoretisk risiko: jeg bad selv om kolonnen
   * "vejrhældning/|b|", og den splitter i to. Resultatet var ikke en fejl —
   * det var tre kolonner, der tavst blev læst som null, hvorefter diagnosen
   * kørte videre uden vejrbevis og faldt tilbage på sine priors. Præcis den
   * slags stilhed, der får en model til at se ud som om den virker.
   *
   * Kroppens kolonneantal er facit. Er hovedet længere, er der splittet for
   * meget, og vi limer nabofelter sammen igen — helst dér, hvor sammenlimningen
   * giver et navn, vi genkender. */
  const kropslinjer = linjer.slice(1).filter((l) => !/^\|?[\s:|-]+$/.test(l));
  const kropsbredde = kropslinjer.length
    ? median(kropslinjer.map((l) => del(l).length)) : hoved.length;

  /* Et tomt kolonnenavn med data under sig giver ingen mening. Når hovedet er
   * længere end kroppen, er en tom celle utvetydigt affald fra en splitning —
   * og at fjerne den er ikke et gæt. "…|b| |" efterlader netop sådan en. */
  if (hoved.length > kropsbredde) {
    const uden = hoved.filter((h) => h !== '');
    if (uden.length >= kropsbredde && uden.length < hoved.length) hoved = uden;
  }

  if (hoved.length > kropsbredde) {
    /* Gæt ikke på, hvor der skal limes. Prøv hver mulighed og mål resultatet.
     *
     * Første forsøg brugte en tommelfingerregel — "lim dér, hvor navnet ikke
     * genkendes" — og den limede de to forkerte kolonner sammen, så koef før
     * og koef efter forsvandt. En sammenlimning, der lander tal i de forkerte
     * felter, er værre end ingen: den giver en diagnose, der ser rigtig ud.
     *
     * I stedet: prøv alle nabosammenlimninger, tæl hvor mange kendte kolonner
     * hver af dem får til at gå op, og tag vinderen. Er der uafgjort, limes
     * der ikke — så siges det i stedet, for et menneske kan se på tabellen,
     * og det kan denne funktion ikke. */
    const antalGenkendte = (h) => {
      const brugt = new Set();
      let n = 0;
      for (const navne of Object.values(KOLONNER)) {
        let i = h.findIndex((x, j) => !brugt.has(j) && navne.some((v) => x === v));
        if (i < 0) i = h.findIndex((x, j) => !brugt.has(j) && navne.some((v) => v.length > 2 && x.startsWith(v)));
        if (i >= 0) { brugt.add(i); n++; }
      }
      return n;
    };

    while (hoved.length > kropsbredde) {
      const bud = [];
      for (let i = 0; i < hoved.length - 1; i++) {
        const kandidat = [...hoved.slice(0, i), `${hoved[i]}|${hoved[i + 1]}`, ...hoved.slice(i + 2)];
        bud.push({ i, kandidat, score: antalGenkendte(kandidat) });
      }
      bud.sort((a, b) => b.score - a.score);
      if (bud.length > 1 && bud[0].score === bud[1].score) {
        return {
          raekker: [], hoved, advarsler,
          fejl: [`Overskriftsrækken har ${hoved.length} felter mod datarækkernes ${kropsbredde}. `
            + 'En kolonneoverskrift indeholder sandsynligvis selv et rørtegn, og der er flere lige gode '
            + 'måder at sætte den sammen igen på. Jeg gætter ikke — send tabellen igen uden rørtegn i '
            + 'overskrifterne, eller omdøb kolonnen.'],
        };
      }
      hoved = bud[0].kandidat;
    }
    advarsler.push('En kolonneoverskrift indeholdt selv et rørtegn. Kolonnerne er sat sammen igen efter '
      + `datarækkernes bredde (${kropsbredde}), og sammensætningen var entydig. Kontrollér alligevel, at `
      + 'tallene er landet de rigtige steder.');
  }

  /* Kolonnerne findes ved EKSAKT navn først, og kun derefter på begyndelsen.
   *
   * Rækkefølgen er ikke pedanteri. Aliaset for temperaturkoefficienten er "b",
   * og med startsWith matcher det "butik" — som står som første kolonne. Feltet
   * b læste altså butikkens navn, fik null, og vejrbeviset forsvandt uden en
   * lyd. Derfor: eksakt match vinder altid, og begyndelses-match tillades kun
   * for aliasser på over to tegn. En kolonne, der er taget, kan ikke stjæles. */
  const plads = {};
  const taget = new Set();
  for (const [felt, navne] of Object.entries(KOLONNER)) {
    const i = hoved.findIndex((h, j) => !taget.has(j) && navne.some((n) => h === n));
    if (i >= 0) { plads[felt] = i; taget.add(i); }
  }
  for (const [felt, navne] of Object.entries(KOLONNER)) {
    if (plads[felt] != null) continue;
    const i = hoved.findIndex((h, j) => !taget.has(j) && navne.some((n) => n.length > 2 && h.startsWith(n)));
    if (i >= 0) { plads[felt] = i; taget.add(i); }
  }

  const manglende = ['maalerId', 'medianResidual', 'afvigPct'].filter((f) => plads[f] == null);
  if (manglende.length) {
    return { raekker: [], fejl: [`tabellen mangler kolonnerne: ${manglende.join(', ')}`], hoved, advarsler };
  }

  const TEKSTFELT = new Set(['butik', 'maalerId', 'navn', 'tags', 'brudDato']);
  const raekker = [];
  for (const l of linjer.slice(1)) {
    // Skillelinjen mellem hoved og krop i markdown: |---|---|
    if (/^\|?[\s:|-]+$/.test(l)) continue;
    const c = del(l);
    if (c.length < hoved.length - 2) continue;
    const r = {};
    for (const [felt, i] of Object.entries(plads)) {
      const v = c[i];
      r[felt] = TEKSTFELT.has(felt) ? (v || null) : talAf(v);
    }
    if (!r.maalerId) continue;
    // Forudsagt kan udledes, hvis den ikke står i tabellen.
    if (r.medianForudsagt == null && r.medianResidual != null && r.afvigPct) {
      /* Ikke afrundet til heltal. Et lille målepunkt kan sagtens have et
       * forudsagt forbrug på 0,56 kWh/døgn, og Math.round gør det til 1 —
       * hvorefter afvigelsen i procent ikke længere passer med sin egen brøk,
       * og rækken afvises som selvmodsigende. */
      r.medianForudsagt = Math.round(100 * r.medianResidual / r.afvigPct * 1000) / 1000;
    }
    raekker.push(r);
  }
  /* Til sidst: sig til, hvis en kolonne, vi kender, slet ikke blev fundet. Det
   * er bedre at vide, at vejrbeviset mangler, end at få en diagnose uden det. */
  for (const felt of ['b', 'vejrforhold', 'koefFoer', 'koefEfter', 'restniveau']) {
    if (plads[felt] == null) advarsler.push(`Kolonnen "${felt}" blev ikke fundet — diagnosen kører uden den.`);
  }

  return { raekker, fejl: [], hoved, advarsler };
}
