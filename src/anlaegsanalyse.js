/* Normallast og mønsterbrud pr. anlæg.
 *
 * Spørgsmålet modellen skal svare på er ikke "bruger anlægget meget?" men
 * "bruger det mere, end det plejer at gøre UNDER DE HER FORHOLD?". Et
 * køleanlæg, der bruger mere i juli end i januar, er ikke i stykker. Et
 * køleanlæg, der bruger mere i juli end det gjorde sidste juli ved samme
 * udetemperatur, er værd at kigge på.
 *
 * Modellen er derfor bygget i to lag:
 *
 *   1. En NORMALLAST, der siger hvad enheden burde bruge givet vejret,
 *      ugedagen og om butikken er åben. Den regnes af enhedens egen historik
 *      — ikke af en norm udefra, for to butikker med samme anlægstype kan
 *      have vidt forskellig normal.
 *
 *   2. MØNSTERBRUD, der ser på afvigelsen fra normallasten over tid. Et
 *      enkelt skævt døgn er ikke en fejl. Et niveau, der flytter sig og
 *      bliver liggende, er.
 *
 * Alle modeller er valgt, så de kan forklares for en tekniker. Der står
 * aldrig "modellen siger" i en sag — der står "anlægget bruger 34 kWh mere
 * i døgnet, end det plejer ved 18 grader, og det har det gjort i elleve dage".
 */

import { median, mad, robustZ, theilSen, regression, cusum, kvantil, daekning } from './statistik.js';

/* ---- Hvilke forhold påvirker hvilke anlæg -------------------------------
 * Et lysanlæg bryder sig ikke om udetemperaturen, men om dagslyset. Et
 * køleanlæg gør det modsatte. At give alle enheder den samme model ville
 * enten overtilpasse de simple eller undertilpasse de komplekse.
 */
export const VEJRFOELSOMHED = {
  // Køleanlæg reagerer på udetemperaturen HELE vejen, ikke kun over en
  // tærskel: kondenseringstrykket følger den omgivende luft, også når den er
  // 5 grader. Kølegraddage med basis 20 ville derfor være nul det meste af
  // året og give en model, der intet forklarer. Vi bruger temperaturen selv.
  koel_frys:      { variable: ['temperatur'],   note: 'Køleanlæggets kondensering følger udetemperaturen hele året, ikke kun om sommeren.' },
  // Komfortkøl er derimod ægte tærskelstyret: der køles ikke, før der er
  // behov, og så er kølegraddage det rigtige mål.
  koeleflader:    { variable: ['cdd'],          note: 'Komfortkøl sætter først ind over en tærskel — derfor kølegraddage.' },
  ventilation:    { variable: [],               note: 'Ventilatordrift følger tidsplanen, ikke vejret. Gør den det alligevel, er det i sig selv et fund.' },
  varme_fjern:    { variable: ['hdd'],          note: 'Varmeflader og fjernvarme følger varmegraddagene.' },
  varme_el:       { variable: ['hdd'],          note: 'Varmepumper og elvarme følger varmegraddagene.' },
  overskudsvarme: { variable: ['cdd'],          note: 'Genvundet varme følger køleanlæggets last, altså varmen udenfor.' },
  lys_inde:       { variable: ['indstraaling'], note: 'Indendørs lys styres sjældent af dagslys — gør det det, er det en dagslysstyring, der virker.' },
  lys_ude:        { variable: ['indstraaling'], note: 'Udendørs lys skal følge dagslyset. Gør det ikke det, er skumringsrelæet i stykker.' },
  solceller:      { variable: ['indstraaling'], note: 'Produktion følger indstrålingen. Alt andet er en fejl.' },
  cts:            { variable: [],               note: 'Automatik har en fast last.' },
};

/* ---- Normallast ---------------------------------------------------------- */

/**
 * Bygger normallasten for én analyseenhed.
 *
 * `raekker` er døgnværdier: { dato, kwh, aaben, ugedag, hdd, cdd, indstraaling }.
 * Vi bruger et glidende vindue på op til 12 måneder, så modellen kender
 * enhedens egen sæson, og deler på dagtype, fordi en søndag ikke er en tirsdag.
 */
export function byggNormallast(raekker, { faggruppe, minDage = 30, referenceAndel = 0.6, karensDage = 30 } = {}) {
  const alle = (raekker || []).filter((r) => Number.isFinite(r.kwh));
  const daek = daekning((raekker || []).map((r) => r.kwh));

  /* Baseline må ikke bygges på data, der indeholder fejlen.
   *
   * Det er den fejl, der oftest gør en energimodel ubrugelig: tilpasser man
   * normallasten på hele perioden, bliver et merforbrug i de sidste måneder
   * suget ind i modellens koefficienter. Anlægget får så en "normal", der
   * indeholder dets egen fejl, og afvigelsen forsvinder.
   *
   * I en prøve, hvor et køleanlæg fik +45 kWh/døgn fra dag 200, endte
   * temperaturkoefficienten på 8,96 mod de sande 6,0 — fejlen var blevet til
   * en påstået vejrfølsomhed, og bruddet blev fundet 140 døgn for tidligt.
   *
   * Derfor: modellen tilpasses på den ÆLDSTE del af vinduet og bruges til at
   * bedømme den nyeste. De seneste døgn indgår aldrig i deres egen normal.
   */
  const referenceSlut = Math.max(minDage,
    Math.min(Math.floor(alle.length * referenceAndel), alle.length - karensDage));
  let gyldige = alle.slice(0, referenceSlut);
  const vurderes = alle.slice(referenceSlut);

  if (gyldige.length < minDage) {
    return { brugbar: false, grund: `Kun ${gyldige.length} døgn i referenceperioden — der skal mindst ${minDage} til, før en normal kan regnes.`, daekning: daek };
  }

  /* Referencen må ikke være en anden årstid end det, den skal bedømme.
   *
   * Ovenstående sikrer, at fejlen ikke ryger ind i sin egen normal. Men den
   * sikrer ikke, at normalen er relevant: de første 60 % af et vindue, der
   * slutter i september, er efterår og vinter, og de bruges så til at bedømme
   * sommeren. På rigtige data gav det et målepunkt med −13.346 % afvigelse,
   * fordi en vintertilpasset model forudsagde nul forbrug på en julidag — og
   * 37 af 113 målere fik deres brud på de samme to døgn i juni, hvilket ikke
   * er 37 fejl, men ét modelsammenbrud.
   *
   * Derfor vælges referencedøgnene også efter, om de ligner dem, der skal
   * bedømmes. Samme rettelse som i aarsag.js — de to steder skal ikke kunne
   * pege hver sin vej. */
  const tempvar = (VEJRFOELSOMHED[faggruppe] || { variable: [] }).variable
    .find((v) => ['temperatur', 'cdd', 'hdd'].includes(v));
  let refudvalg = null;
  let ekstrapolation = null;
  if (tempvar && vurderes.length > 10) {
    const tNu = vurderes.map((r) => r[tempvar]).filter(Number.isFinite);
    if (tNu.length > 10) {
      const lav = Math.min(...tNu), hoej = Math.max(...tNu);
      const luft = (hoej - lav) * 0.15;
      const udvalgt = gyldige.filter((r) => Number.isFinite(r[tempvar]) && r[tempvar] >= lav - luft && r[tempvar] <= hoej + luft);
      if (udvalgt.length >= Math.max(45, minDage)) {
        gyldige = udvalgt;
        refudvalg = `${udvalgt.length} døgn med samme slags vejr (${Math.round(lav)}–${Math.round(hoej)} °C)`;
      }
      const tRef = gyldige.map((r) => r[tempvar]).filter(Number.isFinite);
      if (tRef.length) {
        const rMin = Math.min(...tRef), rMax = Math.max(...tRef);
        const udenfor = tNu.filter((t) => t < rMin || t > rMax).length / tNu.length;
        ekstrapolation = { andelUdenfor: Math.round(udenfor * 1000) / 10, refSpaend: [Math.round(rMin), Math.round(rMax)] };
        if (udenfor > 0.35) {
          return {
            brugbar: false, daekning: daek, ekstrapolation,
            grund: `Referenceperioden dækker ${Math.round(rMin)} til ${Math.round(rMax)} °C, men `
              + `${Math.round(udenfor * 100)} % af de døgn, der skal bedømmes, ligger udenfor. Modellen ville `
              + 'skulle gætte på vejr, den aldrig har set. Der skal en reference til, der dækker samme årstid — '
              + 'i praksis omkring to års data.',
          };
        }
      }
    }
  }

  const foelsomhed = VEJRFOELSOMHED[faggruppe] || { variable: [], note: null };
  // En variabel uden spredning kan ikke forklare noget. Kølegraddage er nul
  // hele vinteren, og at lade dem indgå ville give en model, der ser
  // avanceret ud og intet ved.
  const afvist = [];
  const variable = foelsomhed.variable.filter((v) => {
    const vaerdier = gyldige.map((r) => r[v]).filter(Number.isFinite);
    if (vaerdier.length < gyldige.length * 0.7) { afvist.push({ v, grund: 'mangler i for mange døgn' }); return false; }
    const spredning = mad(vaerdier);
    if (!spredning || spredning < 1e-6) { afvist.push({ v, grund: 'står stille i perioden' }); return false; }
    return true;
  });

  /* Dagtype: åben hverdag, åben weekend, lukket. Butikkens rytme betyder mere
     for forbruget end noget andet, og den skal ud af modellen, før vejret
     overhovedet kan ses. */
  const dagtype = (r) => (r.aaben === false ? 'lukket' : (r.ugedag === 0 || r.ugedag === 6) ? 'weekend' : 'hverdag');
  const grupper = {};
  for (const r of gyldige) (grupper[dagtype(r)] ||= []).push(r);

  const modeller = {};
  for (const [type, liste] of Object.entries(grupper)) {
    if (liste.length < 8) continue;
    const m = variable.length
      ? regression(liste.map((r) => ({ ...r, y: r.kwh })), variable)
      : null;
    const vaerdier = liste.map((r) => r.kwh);
    modeller[type] = {
      n: liste.length,
      median: median(vaerdier),
      spredning: mad(vaerdier),
      // Vejrmodellen bruges kun, hvis den faktisk forklarer noget. En R² på
      // 0,1 betyder, at vejret ikke er forklaringen, og så er medianen en
      // bedre normal end en model, der lader som om den ved noget.
      regression: m && m.r2 != null && m.r2 >= 0.25 ? m : null,
      afvistRegression: m && (m.r2 == null || m.r2 < 0.25)
        ? { r2: m.r2, grund: 'Vejret forklarer for lidt til at indgå — medianen bruges i stedet.' } : null,
    };
  }

  if (!Object.keys(modeller).length) {
    return { brugbar: false, grund: 'For få døgn inden for hver dagtype.', daekning: daek };
  }

  return {
    brugbar: true,
    daekning: daek,
    variable,
    afvisteVariable: afvist,
    ekstrapolation,
    reference: {
      fra: gyldige[0].dato, til: gyldige[gyldige.length - 1].dato, doegn: gyldige.length,
      udvalg: refudvalg,
      note: 'Normallasten er regnet på denne periode alene. De nyeste døgn indgår ikke i deres egen normal — '
        + 'ellers ville en fejl, der har stået på et stykke tid, blive til en del af det "normale".'
        + (refudvalg ? ` Døgnene er desuden valgt efter, om de ligner dem, der skal bedømmes: ${refudvalg}.` : ''),
    },
    vejrnote: foelsomhed.note,
    modeller,
    dagtype,
    /** Forventet forbrug for ét døgn, og hvordan tallet fremkom. */
    forvent(r) {
      const t = dagtype(r);
      const m = modeller[t] || modeller.hverdag || Object.values(modeller)[0];
      if (!m) return null;
      if (m.regression) {
        const p = m.regression.forudsig(r);
        if (Number.isFinite(p)) {
          return { forventet: p, metode: 'vejrmodel', dagtype: t, r2: m.regression.r2, spredning: m.regression.rmse, n: m.n };
        }
      }
      return { forventet: m.median, metode: 'median', dagtype: t, spredning: m.spredning, n: m.n };
    },
  };
}

/* ---- Mønsterbrud ---------------------------------------------------------
 * Seks mønstre, hver med sin egen fejlmåde bag sig. De er bevidst adskilte:
 * et niveauskift og en langsom drift er to forskellige fysiske ting, og de
 * skal ikke slås sammen til "afvigelse".
 */

const VARIABELNAVN = {
  temperatur: 'udetemperaturen',
  cdd: 'varmen udenfor',
  hdd: 'kulden',
  indstraaling: 'dagslyset',
};

/**
 * Kører alle mønstre på én enhed. Returnerer fund med symptom, evidens og
 * den metode, tallet kom fra — aldrig bare et tal.
 */
export function analyserEnhed(enhed, raekker, { elpris = 0.77, varmepris = 0.65, nu = new Date() } = {}) {
  const pris = enhed.energistroem === 'varme' ? varmepris : elpris;
  const normal = byggNormallast(raekker, { faggruppe: enhed.faggruppe });
  const fund = [];

  if (!normal.brugbar) {
    return { enhed, normal, fund, kanIkkeAnalyseres: normal.grund };
  }

  /* Afvigelsesserie: faktisk minus forventet, døgn for døgn. */
  const afvig = [];
  for (const r of raekker) {
    if (!Number.isFinite(r.kwh)) continue;
    const f = normal.forvent(r);
    if (!f) continue;
    afvig.push({ dato: r.dato, faktisk: r.kwh, forventet: f.forventet, rest: r.kwh - f.forventet, metode: f.metode, r: r });
  }
  if (afvig.length < 21) return { enhed, normal, fund, kanIkkeAnalyseres: 'For kort serie til at se et mønster.' };

  const rester = afvig.map((a) => a.rest);
  const seneste = afvig.slice(-14);
  const sidste = afvig[afvig.length - 1];

  /* 1 · Niveauskift. Forbruget flytter sig og bliver liggende.
   *
   * Når bruddet er fundet, bygges normallasten OM på tiden før bruddet alene,
   * og springet måles mod den. Ellers måles fejlen mod en normal, der selv er
   * delvist forurenet af fejlen, og springet bliver for lille. Det er en
   * ekstra runde, men den er forskellen på "noget er ændret" og "det er
   * ændret med 45 kWh i døgnet".
   */
  const skift = cusum(rester);
  if (skift && Math.abs(skift.forskel) > (mad(rester) || 1) * 1.5) {
    const dato = afvig[skift.indeks] ? afvig[skift.indeks].dato : null;
    const dageSiden = afvig.length - skift.indeks;
    if (dageSiden >= 7) {
      // Genberegn på tiden før bruddet, hvis der er nok af den.
      let springKwh = skift.forskel;
      let genberegnet = null;
      const foerRaekker = raekker.slice(0, skift.indeks);
      if (foerRaekker.length >= 45) {
        const rent = byggNormallast(foerRaekker, { faggruppe: enhed.faggruppe, referenceAndel: 1, karensDage: 0 });
        if (rent.brugbar) {
          const efter = raekker.slice(skift.indeks).filter((r) => Number.isFinite(r.kwh));
          const rest = efter.map((r) => { const f = rent.forvent(r); return f ? r.kwh - f.forventet : null; })
            .filter(Number.isFinite);
          const m = median(rest);
          if (Number.isFinite(m)) {
            springKwh = m;
            genberegnet = { doegnFoer: foerRaekker.length, variable: rent.variable,
              r2: rent.modeller.hverdag && rent.modeller.hverdag.regression
                ? rent.modeller.hverdag.regression.r2 : null };
          }
        }
      }
      const kwhAar = Math.abs(springKwh) * 365;
      fund.push({
        moenster: 'niveauskift', retning: skift.retning,
        symptom: `Forbruget skiftede niveau omkring ${dato} og er blevet der i ${dageSiden} døgn — `
          + `${springKwh > 0 ? '+' : ''}${springKwh.toFixed(0)} kWh/døgn mod det, anlægget brugte før, ved samme vejr.`,
        evidens: [
          ['Skiftet indtraf', dato || '—'],
          ['Holdt i', `${dageSiden} døgn`],
          ['Niveau før', `${(median(afvig.slice(0, skift.indeks).map((a) => a.faktisk)) || 0).toFixed(0)} kWh/døgn`],
          ['Niveau efter', `${(median(afvig.slice(skift.indeks).map((a) => a.faktisk)) || 0).toFixed(0)} kWh/døgn`],
          ['Spring', `${springKwh > 0 ? '+' : ''}${springKwh.toFixed(0)} kWh/døgn`],
          ['Metode', genberegnet
            ? `CUSUM fandt bruddet (styrke ${skift.styrke.toFixed(1)}); springet er målt mod en normal, `
              + `der er genberegnet på de ${genberegnet.doegnFoer} døgn FØR bruddet`
              + (genberegnet.r2 != null ? ` (R² ${genberegnet.r2.toFixed(2)})` : '')
            : `CUSUM på afvigelsen fra normallasten, styrke ${skift.styrke.toFixed(1)}`],
        ],
        kwhAar, krAar: Math.round(kwhAar * pris),
        alvor: springKwh > 0 ? 'hoej' : 'middel',
        // Et fald er ikke nødvendigvis en god nyhed: det kan være et anlæg,
        // der er holdt op med at køre, eller en måler, der er gået i stå.
        note: springKwh < 0
          ? 'Et fald kan være en besparelse — men også et anlæg, der er stoppet, eller en måler, der ikke tæller.'
          : null,
      });
    }
  }

  /* 2 · Drift. Langsom forværring uden et tydeligt skift. */
  const trend = theilSen(afvig.map((a, i) => ({ x: i, y: a.rest })));
  if (trend && afvig.length >= 60) {
    const overVinduet = trend.haeldning * afvig.length;
    const stoej = mad(rester) || 1;
    if (Math.abs(overVinduet) > stoej * 2 && Math.abs(trend.haeldning) > 0) {
      // Hvad driften koster NU, hvis den får lov at stå — ikke hvad den ville
      // koste, hvis den fortsatte et år endnu. Det sidste er et skøn over
      // fremtiden; det første er en aflæsning af nutiden.
      const naaetTil = Math.abs(trend.haeldning) * afvig.length;
      const kwhAar = naaetTil * 365;
      fund.push({
        moenster: 'drift', retning: trend.haeldning > 0 ? 'op' : 'ned',
        symptom: `Forbruget er gledet ${trend.haeldning > 0 ? 'op' : 'ned'} med `
          + `${Math.abs(trend.haeldning * 30).toFixed(1)} kWh/døgn pr. måned over ${afvig.length} døgn, `
          + 'uden et tydeligt skift undervejs.',
        evidens: [
          ['Hældning', `${trend.haeldning > 0 ? '+' : ''}${(trend.haeldning * 30).toFixed(2)} kWh/døgn pr. måned`],
          ['Nået til nu', `${overVinduet > 0 ? '+' : ''}${overVinduet.toFixed(0)} kWh/døgn over udgangspunktet`],
          ['Støjniveau', `${stoej.toFixed(1)} kWh/døgn`],
          ['Metode', `Theil–Sen på afvigelsen fra normallasten, ${trend.n} punkter`],
        ],
        kwhAar, krAar: Math.round(kwhAar * pris),
        alvor: 'middel',
        note: 'En gradvis forværring uden fejlkode peger typisk på tilsmudsning, slid eller en indstilling, '
          + 'der langsomt er gledet — ikke på et nedbrud.',
      });
    }
  }

  /* 3 · Vedvarende merforbrug uden skift eller drift. */
  const z = robustZ(median(seneste.map((a) => a.rest)), rester.slice(0, -14));
  if (z != null && Math.abs(z) > 2.5 && !fund.some((f) => f.moenster === 'niveauskift')) {
    const merDoegn = median(seneste.map((a) => a.rest));
    const kwhAar = Math.abs(merDoegn) * 365;
    fund.push({
      moenster: 'vedvarende_afvigelse', retning: merDoegn > 0 ? 'op' : 'ned',
      symptom: `De seneste 14 døgn ligger ${Math.abs(merDoegn).toFixed(0)} kWh/døgn `
        + `${merDoegn > 0 ? 'over' : 'under'} normalen for den slags døgn.`,
      evidens: [
        ['Seneste 14 døgn, median', `${median(seneste.map((a) => a.faktisk)).toFixed(0)} kWh/døgn`],
        ['Forventet', `${median(seneste.map((a) => a.forventet)).toFixed(0)} kWh/døgn`],
        ['Robust z-score', z.toFixed(1)],
        ['Metode', `Median af afvigelsen mod historikkens MAD (${afvig[0].metode})`],
      ],
      kwhAar, krAar: Math.round(kwhAar * pris), alvor: 'middel',
    });
  }

  /* 4 · Vejrresponsen er brudt.
   * Et køleanlæg, der holder op med at reagere på udetemperaturen, kører
   * enten konstant for fuld kraft eller er sat i hånd. Det er et mønster,
   * ingen tærskel på forbruget kan finde. */
  if (normal.variable.length && afvig.length >= 90) {
    const foer = afvig.slice(0, Math.floor(afvig.length / 2)).map((a) => a.r);
    const efter = afvig.slice(Math.floor(afvig.length / 2)).map((a) => a.r);
    const mFoer = regression(foer.map((r) => ({ ...r, y: r.kwh })), normal.variable);
    const mEfter = regression(efter.map((r) => ({ ...r, y: r.kwh })), normal.variable);
    if (mFoer && mEfter && mFoer.r2 >= 0.3) {
      const v = normal.variable[0];
      const kFoer = mFoer.koefficienter[v], kEfter = mEfter.koefficienter[v];
      if (Number.isFinite(kFoer) && Number.isFinite(kEfter) && Math.abs(kFoer) > 0.1) {
        const fald = 1 - kEfter / kFoer;
        if (fald > 0.6) {
          fund.push({
            moenster: 'vejrrespons_brudt', retning: 'op',
            symptom: `Anlægget reagerer ikke længere på ${VARIABELNAVN[v] || v}. `
              + `Følsomheden er faldet ${Math.round(fald * 100)} % i anden halvdel af perioden.`,
            evidens: [
              ['Følsomhed, første halvdel', `${kFoer.toFixed(2)} kWh pr. ${v}`],
              ['Følsomhed, anden halvdel', `${kEfter.toFixed(2)} kWh pr. ${v}`],
              ['Modelkvalitet før', `R² ${mFoer.r2.toFixed(2)}`],
              ['Metode', 'To regressioner på hver sin halvdel af perioden'],
            ],
            kwhAar: 0, krAar: 0, alvor: 'hoej',
            note: 'Et anlæg, der holder op med at følge vejret, står typisk i manuel drift eller kører konstant. '
              + 'Beløbet kan ikke regnes af mønsteret alene — det afhænger af, hvad anlægget nu står og gør.',
          });
        }
      }
    }
  }

  /* 5 · Nulforbrug. Enheden er holdt op med at levere data eller med at køre. */
  const sidste7 = afvig.slice(-7);
  if (sidste7.length === 7 && sidste7.every((a) => a.faktisk === 0) && median(rester.slice(0, -7)) !== 0) {
    const normalt = median(afvig.slice(0, -7).map((a) => a.faktisk)) || 0;
    fund.push({
      moenster: 'nulforbrug', retning: 'ned',
      symptom: `Enheden har vist nul i syv døgn i træk, hvor den normalt bruger ${normalt.toFixed(0)} kWh/døgn.`,
      evidens: [
        ['Normalt niveau', `${normalt.toFixed(0)} kWh/døgn`],
        ['Seneste 7 døgn', '0 kWh'],
        ['Metode', 'Direkte aflæsning — ikke en model'],
      ],
      kwhAar: 0, krAar: 0, alvor: 'hoej',
      note: 'Enten er anlægget stoppet, eller også er måleren. Rækkefølgen er at tjekke måleren først — '
        + 'det er det billigste tjek, og det afgør sagen i de fleste tilfælde.',
    });
  }

  /* 6 · Nyt spidsniveau. Relevant for effekttariffen. */
  const p99Hist = kvantil(afvig.slice(0, -14).map((a) => a.faktisk), 0.99);
  const maksSenest = Math.max(...seneste.map((a) => a.faktisk));
  if (p99Hist && maksSenest > p99Hist * 1.25) {
    fund.push({
      moenster: 'ny_spids', retning: 'op',
      symptom: `Højeste døgn de seneste to uger er ${maksSenest.toFixed(0)} kWh mod et historisk maksimum omkring ${p99Hist.toFixed(0)} kWh.`,
      evidens: [
        ['Historisk 99-percentil', `${p99Hist.toFixed(0)} kWh/døgn`],
        ['Højeste seneste 14 døgn', `${maksSenest.toFixed(0)} kWh/døgn`],
        ['Metode', 'Percentil på historikken uden det seneste vindue'],
      ],
      kwhAar: 0, krAar: 0, alvor: 'lav',
      note: 'En ny spids er ikke i sig selv et merforbrug, men den kan ramme effekttariffen. '
        + 'Den skal ses på timedata for at være noget værd.',
    });
  }

  /* En glidende forværring ligner et niveauskift, hvis man skærer den over,
   * og et niveauskift ligner en drift, hvis man lægger en linje gennem det.
   * At rapportere begge ville give to sager om den samme fysiske ting og
   * lægge to beløb sammen, der er det samme beløb. Vi vælger den forklaring,
   * der passer bedst til data, og siger hvilken vi valgte fra. */
  const valgt = vaelgForklaring(fund, afvig);

  return {
    enhed, normal, fund: valgt.fund, fravalgt: valgt.fravalgt,
    afvigelse: { serie: afvig.slice(-90), sidste },
    kanIkkeAnalyseres: null,
  };
}

/**
 * Vælger mellem konkurrerende forklaringer på den samme afvigelse.
 *
 * Nulforbrug slår alt: står måleren på nul, er niveauskiftet bare den samme
 * observation set fra en anden vinkel — og dets "besparelse" er falsk.
 * Ellers sammenlignes, hvor godt et trin og en linje hver især forklarer
 * afvigelsen, og kun den bedste beholdes.
 */
function vaelgForklaring(fund, afvig) {
  const fravalgt = [];
  let liste = [...fund];

  const nul = liste.find((f) => f.moenster === 'nulforbrug');
  if (nul) {
    for (const f of liste) {
      if (f !== nul && (f.moenster === 'niveauskift' || f.moenster === 'drift' || f.moenster === 'vedvarende_afvigelse')) {
        fravalgt.push({ ...f, hvorfor: 'Samme observation som nulforbruget. En måler, der står stille, er ikke en besparelse.' });
      }
    }
    liste = liste.filter((f) => !fravalgt.includes(f) && (f === nul || !['niveauskift', 'drift', 'vedvarende_afvigelse'].includes(f.moenster)));
    return { fund: liste, fravalgt };
  }

  const trin = liste.find((f) => f.moenster === 'niveauskift');
  const drift = liste.find((f) => f.moenster === 'drift');
  if (trin && drift) {
    const y = afvig.map((a) => a.rest);
    const sseTrin = sseTrinmodel(y);
    const sseLinje = sseLinjemodel(y);
    if (sseTrin <= sseLinje) {
      fravalgt.push({ ...drift, hvorfor: `Et trin forklarer afvigelsen bedre end en linje (SSE ${Math.round(sseTrin)} mod ${Math.round(sseLinje)}).` });
      liste = liste.filter((f) => f !== drift);
    } else {
      fravalgt.push({ ...trin, hvorfor: `En glidende forværring forklarer afvigelsen bedre end et trin (SSE ${Math.round(sseLinje)} mod ${Math.round(sseTrin)}).` });
      liste = liste.filter((f) => f !== trin);
    }
  }
  return { fund: liste, fravalgt };
}

/** Bedste totrins-tilpasning: prøv hvert skæringspunkt, tag den mindste fejl. */
export function sseTrinmodel(y) {
  let bedst = Infinity;
  for (let k = 7; k < y.length - 7; k += Math.max(1, Math.floor(y.length / 60))) {
    const a = median(y.slice(0, k)), b = median(y.slice(k));
    let sse = 0;
    for (let i = 0; i < y.length; i++) sse += (y[i] - (i < k ? a : b)) ** 2;
    if (sse < bedst) bedst = sse;
  }
  return bedst;
}

/** Tilpasning med en ret linje. */
export function sseLinjemodel(y) {
  const t = theilSen(y.map((v, i) => ({ x: i, y: v })));
  if (!t) return Infinity;
  let sse = 0;
  for (let i = 0; i < y.length; i++) sse += (y[i] - (t.skaering + t.haeldning * i)) ** 2;
  return sse;
}

/* ---- Fra fund til sag ----------------------------------------------------- */

/**
 * Oversætter et mønsterfund til et signal, sagsbyggeren kan bruge.
 * Konfidensen tager højde for, hvad koblingen tillader: en delt måler kan
 * ikke pege på ét anlæg, og det skal trække ned — ikke skjules.
 */
export function tilSignal(resultat, fund, butiksnummer) {
  const e = resultat.enhed;
  const normal = resultat.normal;
  const delt = !e.kanPegePaaAnlaeg;

  let konfidens = { niveauskift: 0.8, nulforbrug: 0.9, drift: 0.65,
    vedvarende_afvigelse: 0.6, vejrrespons_brudt: 0.7, ny_spids: 0.45 }[fund.moenster] || 0.5;
  if (delt) konfidens *= 0.75;
  if (normal.daekning < 70) konfidens *= 0.8;
  if (normal.variable.length === 0 && VEJRFOELSOMHED[e.faggruppe]?.variable.length) konfidens *= 0.85;

  const forbehold = [];
  if (e.forbehold) forbehold.push(e.forbehold);
  if (normal.daekning < 70) forbehold.push(`Datadækningen er ${normal.daekning} % i perioden — normallasten hviler på et hul.`);
  if (!normal.variable.length && VEJRFOELSOMHED[e.faggruppe]?.variable.length) {
    forbehold.push('Vejrdata mangler for perioden, så afvigelsen er ikke vejrkorrigeret. '
      + 'En varm periode kan derfor ligne et merforbrug.');
  }
  if (fund.note) forbehold.push(fund.note);

  return {
    detektor: 'D-30', version: '1.0',
    butiksnummer,
    anlaeg: e.navn,
    anlaegId: e.anlaeg.length === 1 ? e.anlaeg[0].id : null,
    meterId: e.meterId,
    faggruppe: e.faggruppe,
    moenster: fund.moenster,
    periode: resultat.afvigelse ? `${resultat.afvigelse.serie[0].dato} – ${resultat.afvigelse.sidste.dato}` : '—',
    styrke: Math.min(1, Math.abs(fund.kwhAar || 0) / 20000),
    symptom: fund.symptom,
    evidens: [...fund.evidens,
      ['Analyseenhed', e.slags === 'anlæg' ? `Anlægget "${e.navn}" med egen måler`
        : e.slags === 'gruppe' ? `${e.anlaeg.length} anlæg, der deler måleren "${e.meterNavn}"`
        : `Målepunktet "${e.meterNavn}" uden kobling til et anlæg`],
      ['Normallast', normal.variable.length
        ? `Vejrmodel på ${normal.variable.join(' og ')}` : 'Median pr. dagtype — vejret forklarede for lidt'],
    ],
    datadaekning: normal.daekning,
    maaleenhed: { kwh: fund.kwhAar || 0, klasse: fund.kwhAar ? 'besparelse' : 'potentiale' },
    konfidensVaegt: konfidens,
    alvor: fund.alvor,
    forbehold: forbehold.join(' '),
  };
}
