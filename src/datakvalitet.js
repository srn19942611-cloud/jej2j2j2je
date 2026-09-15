/* Observerbarhed: hvad kan vi overhovedet se, og hvor skarpt?
 *
 * Det her er ikke en detektor. Det er kortet over, hvor detektorerne kan
 * arbejde — og det er mindst lige så vigtigt, fordi et anlæg, ingen kan måle,
 * heller ikke kan fejle synligt.
 *
 * Observerbarheden er et trappeforløb, ikke en ja/nej-ting. Hvert trin op
 * låser bestemte fejltyper op, og hvert trin ned gør dem usynlige:
 *
 *   0 · umålt       Forbruget findes, men ikke på noget målepunkt. 43 % af
 *                   Coops el ligger her. Intet kan findes.
 *   1 · årligt      Kun en årssum. Nok til at sammenligne med søskende,
 *                   men et nedbrud i marts ses aldrig.
 *   2 · døgn        Normallast, vejrkorrektion, niveauskift, glidning.
 *                   Det er her, hovedparten af fejlfindingen lever.
 *   3 · kvarter     Døgnprofil, tidsplaner, natforbrug, weekenddrift,
 *                   afrimninger — hvis måleren sidder tæt nok på.
 *
 * Og ét trin, der ikke er et trin: en måler kan sidde på DET FORKERTE anlæg
 * eller dække flere på én gang. Så er opløsningen ligegyldig — man kan se
 * afvigelsen og ikke sige hvad den handler om.
 */

import { median } from './statistik.js';
import { fgNavn } from './taxonomy.js';

export const NIVEAUER = [
  {
    id: 0, navn: 'Umålt', kort: 'intet målepunkt',
    laaserOp: [],
    betydning: 'Forbruget findes, men der er ingen måler. Ingen detektor kan se noget her, '
      + 'og et spild ville ingen opdage.',
    farve: 'p1',
  },
  {
    id: 1, navn: 'Kun årstal', kort: 'årssum',
    laaserOp: ['Søskendesammenligning', 'Benchmark pr. m²'],
    betydning: 'Nok til at se, at anlægget ligger højt mod sine søskende. Ikke nok til at se hvornår '
      + 'noget gik galt — et nedbrud i marts forsvinder i en årssum.',
    farve: 'p2',
  },
  {
    id: 2, navn: 'Døgnværdier', kort: 'døgn',
    laaserOp: ['Normallast med vejrkorrektion', 'Niveauskift', 'Glidende forværring', 'Nulforbrug', 'Korrelation mod Dalux'],
    betydning: 'Her lever hovedparten af fejlfindingen. Anlægget kan få sin egen normal, og en afvigelse '
      + 'kan dateres — og dermed holdes op mod opgaverne i Dalux.',
    farve: 'p3',
  },
  {
    id: 3, navn: 'Kvarterværdier', kort: 'kvarter',
    laaserOp: ['Døgnprofil', 'Tidsplan aflæst frem for gættet', 'Weekendnedsættelse', 'Natforbrug pr. ugedag', 'Grundlast mod spids', 'Afrimninger (kun tæt på anlægget)'],
    betydning: 'Det fine niveau. Her kan tidsplaner aflæses i stedet for gættes, og fejl der ikke koster '
      + 'mere i et døgn — men ligger på det forkerte tidspunkt — bliver synlige.',
    farve: 'ok',
  },
];
export const NIVEAU = Object.fromEntries(NIVEAUER.map((n) => [n.id, n]));

/* ---- Hvad ét målepunkt kan bære ------------------------------------------- */

/**
 * Bedømmer et målepunkt. `punkter` er valgfri — uden dem bedømmes kun på det,
 * metadata siger, og så er svaret et loft frem for en måling.
 */
export function vurderMaaler(maaler, punkter = null) {
  const grunde = [];
  if (!maaler || !maaler.id) return { niveau: 0, grunde: ['intet målepunkt'], maalt: false };

  if (!punkter || !punkter.length) {
    // Uden data kan vi kun sige, hvad opløsningen lover.
    const lovet = maaler.opløsningMin && maaler.opløsningMin <= 15 ? 3 : maaler.opløsningMin <= 1440 ? 2 : 1;
    return { niveau: lovet, grunde: ['bedømt på metadata — ingen serie hentet'], maalt: false, loft: true };
  }

  const v = punkter.map((p) => p.v).filter((x) => x != null);
  const daekning = punkter.length ? v.length / punkter.length : 0;
  const unikke = new Set(v).size;
  const m = median(v) || 0;
  const heltallige = v.length ? v.filter((x) => Number.isInteger(x)).length / v.length : 0;

  /* Rækkefølgen betyder noget: en død måler er ikke "lav opløsning", den er
   * ingen måling. Og en pulsmåler med hele kWh-trin har masser af punkter og
   * alligevel ingen finstruktur. */
  if (unikke <= 1) {
    return { niveau: 0, maalt: true, doed: true, unikke, daekning,
      grunde: ['kun én værdi i hele perioden — død måler eller anlæg ude af drift'] };
  }
  if (daekning <= 0.5) {
    grunde.push(`kun ${Math.round(daekning * 100)} % af intervallerne har data`);
    return { niveau: 1, maalt: true, daekning, unikke, grunde };
  }

  const tider = punkter.map((p) => new Date(p.t).getTime()).sort((a, b) => a - b);
  const skridt = [];
  for (let i = 1; i < Math.min(tider.length, 100); i++) skridt.push(tider[i] - tider[i - 1]);
  const skridtMin = Math.round((median(skridt) || 0) / 60000);

  const puls = heltallige > 0.95 && unikke < 40;
  if (puls) grunde.push(`pulsmåler: ${unikke} forskellige værdier, alle hele tal`);

  /* Grovkornet — en fjerde klasse, som porteføljekørslen tvang frem.
   *
   * 34 af 209 målere havde mellem 7 og 45 forskellige værdier over fire
   * måneder. De er hverken døde eller rene pulsmålere, og de har masser af
   * punkter. Men et niveau kan ikke måles på syv forskellige tal — kun om
   * anlægget kører eller ej. De kan altså bære en tidsplan og ikke andet, og
   * det skal stå, for ellers regnes der procenter på noget, der reelt er en
   * tænd/sluk-kontakt. */
  const grovkornet = !puls && unikke >= 2 && unikke < 50;
  if (grovkornet) grunde.push(`kun ${unikke} forskellige værdier — nok til tænd/sluk, ikke til niveau`);

  /* Fladlinje: nøjagtig samme værdi i hver eneste time i månedsvis.
   *
   * Ni varmemålere i udsnittet så sådan ud. Der ER forbrug, så de tæller ikke
   * som døde — men profilen er en ret streg, og det er ikke en måling. Det er
   * en månedsaflæsning, der er fordelt jævnt ud over timerne. Bruges den i en
   * døgnprofil, får man et anlæg, der kører præcis lige meget kl. 3 om natten
   * og kl. 14 om eftermiddagen, og det er en påstand om virkeligheden, som
   * ingen har målt. */
  const spaend = v.length ? Math.max(...v) - Math.min(...v) : 0;
  const fladlinje = unikke <= 3 && spaend < (m || 1) * 0.02 && v.length > 500;
  if (fladlinje) grunde.push('samme værdi i hver eneste time — fordelt månedsaflæsning, ikke en måling');
  const forSmaa = m > 0 && m < 0.25;
  if (forSmaa) grunde.push(`median ${Math.round(m * 1000) / 1000} kWh pr. interval — for lille til at procenter betyder noget`);
  if (daekning < 0.9) grunde.push(`${Math.round((1 - daekning) * 100)} % huller`);

  let niveau = skridtMin <= 15 ? 3 : skridtMin <= 1440 ? 2 : 1;
  if (fladlinje) niveau = 1;
  // Grovkornet kan bære en tidsplan (niveau 3's tænd/sluk) men ikke et niveau.
  if (grovkornet && niveau === 3) niveau = 2;
  // Grov kvantisering eller et meget lille målepunkt kan ikke bære kvarteranalyse,
  // uanset hvor tit der måles.
  if (niveau === 3 && (puls || forSmaa)) niveau = 2;
  /* Og huller slår opløsning. En serie med hvert andet kvarter væk er ikke en
   * kvarterserie — en døgnprofil bygget på den ville have systematiske huller
   * på bestemte tidspunkter og dermed finde mønstre, der er målehuller. */
  if (niveau === 3 && daekning < 0.75) { niveau = 2; grunde.push('for mange huller til en døgnprofil'); }
  if (puls && niveau === 2 && unikke < 10) niveau = 1;

  return {
    niveau, maalt: true, skridtMin, daekning: Math.round(daekning * 100) / 100,
    unikke, medianKwh: Math.round(m * 1000) / 1000,
    puls, forSmaa, grovkornet, fladlinje,
    // Grovkornede målere kan stadig sige, HVORNÅR anlægget kører — bare ikke hvor meget.
    kanTidsplan: !fladlinje && !puls && unikke >= 2 && skridtMin <= 60,
    grunde,
  };
}

/* ---- Kortet over porteføljen ---------------------------------------------- */

/**
 * Lægger observerbarheden sammen for en samling enheder og vægter den med
 * forbruget. Antallet af målere siger ikke så meget — det gør kWh'en bag dem.
 *
 * `enheder` skal have { id, faggruppe, kwhAar, niveau, dedikeret }.
 */
export function porteføljekort(enheder, { restpostKwh = 0 } = {}) {
  const trin = NIVEAUER.map((n) => ({ ...n, antal: 0, kwh: 0 }));
  let delte = 0, delteKwh = 0;

  for (const e of enheder) {
    const n = trin[Math.max(0, Math.min(3, e.niveau ?? 0))];
    n.antal++;
    n.kwh += e.kwhAar || 0;
    if (e.dedikeret === false) { delte++; delteKwh += e.kwhAar || 0; }
  }
  // Restposten er per definition niveau 0.
  trin[0].kwh += restpostKwh;

  const kwhIalt = trin.reduce((a, t) => a + t.kwh, 0) || 1;
  for (const t of trin) t.andel = Math.round(1000 * t.kwh / kwhIalt) / 10;

  return {
    trin,
    kwhIalt,
    enheder: enheder.length,
    // Det tal, der siger mest: hvor stor en del af forbruget kan overhovedet
    // få en normal og dermed en dateret afvigelse?
    kanDateres: Math.round(1000 * (trin[2].kwh + trin[3].kwh) / kwhIalt) / 10,
    kanDoegnprofil: Math.round(1000 * trin[3].kwh / kwhIalt) / 10,
    usynligt: Math.round(1000 * trin[0].kwh / kwhIalt) / 10,
    // Og hvor meget af det målte peger på ét bestemt anlæg?
    delte, delteKwh,
    delteAndel: Math.round(1000 * delteKwh / kwhIalt) / 10,
  };
}

/** Hvad hvert trin op ville låse op — regnet i kWh, ikke i målere. */
export function hvadEtTrinOpGiver(kort) {
  const ud = [];
  for (let i = 0; i < 3; i++) {
    const fra = kort.trin[i];
    const til = NIVEAU[i + 1];
    if (!fra.kwh) continue;
    ud.push({
      fra: fra.navn, til: til.navn,
      kwh: Math.round(fra.kwh),
      andel: fra.andel,
      antal: fra.antal,
      laaserOp: til.laaserOp,
      hvad: i === 0
        ? 'Eftermontering af bimålere. Det er den dyreste og den, der giver mest — forbruget går fra usynligt til målbart.'
        : i === 1
          ? 'Kobling af eksisterende målere på dataopsamlingen. Målerne sidder der allerede; de leverer bare ikke tidsserier.'
          : 'Hentning af finopløste værdier frem for døgnsummer. Ofte kun et spørgsmål om, hvad der trækkes — ikke om hardware.',
    });
  }
  return ud;
}

/* ---- Døde målere ----------------------------------------------------------
 * Den mest direkte anvendelige liste i hele kortet, og den eneste, der findes
 * uden at nogen detektor er involveret. En måler, der har stået på nul i fire
 * måneder, er enten et anlæg ude af drift eller en måler, der er faldet ud.
 * Begge dele skal nogen vide, og ingen opdager det af sig selv.
 */
export function doedeMaalere(enheder, { vindueDage = 3, minIBoelge = 2 } = {}) {
  const doede = enheder.filter((e) => e.vurdering?.doed || e.vurdering?.fladlinje);
  if (!doede.length) return { boelger: [], enkeltvis: [], aldrigLeveret: [], ialt: 0 };

  /* To bunker, og forskellen afgør alt for, hvem der skal handle.
   *
   * Porteføljekørslen viste det tydeligt: otte hovedmålere holdt op med at
   * tælle samme dag i marts 2025. Det er en målerudskiftning, ikke otte fejl,
   * og der skal ingen tekniker ud. Men de gamle id'er ligger stadig i Enity og
   * forurener enhver sum, så nogen skal rydde op.
   *
   * De målere, der stoppede ALENE mens nabomålerne kørte videre, er noget
   * andet — dér er enten anlægget eller måleren gået i stykker, og det skal
   * nogen se på.
   *
   * Uden den skelnen ville de otte udskiftede målere fylde toppen af listen
   * hver eneste dag og skubbe de rigtige fund ud.
   */
  const boelger = [];
  const brugt = new Set();
  const prButik = new Map();
  for (const e of doede) {
    const b = e.butiksnummer || '?';
    if (!prButik.has(b)) prButik.set(b, []);
    prButik.get(b).push(e);
  }

  for (const [butiksnummer, liste] of prButik) {
    const medDato = liste.filter((e) => e.sidstForbrug).sort((a, b) => a.sidstForbrug.localeCompare(b.sidstForbrug));
    let i = 0;
    while (i < medDato.length) {
      const start = new Date(medDato[i].sidstForbrug + 'T00:00:00Z').getTime();
      const klump = medDato.filter((e) => {
        const t = new Date(e.sidstForbrug + 'T00:00:00Z').getTime();
        return t >= start && t <= start + vindueDage * 864e5;
      });
      if (klump.length >= minIBoelge) {
        for (const e of klump) brugt.add(e.id);
        boelger.push({
          butiksnummer, butik: klump[0].butik,
          dato: medDato[i].sidstForbrug,
          antal: klump.length,
          maalere: klump.map((e) => ({ id: e.id, navn: e.navn, maaler: e.maaler })),
          tolkning: `${klump.length} målere i samme butik holdt op med at tælle inden for ${vindueDage} dage `
            + `omkring ${medDato[i].sidstForbrug}. Det er mønsteret for en målerudskiftning, ikke for `
            + `${klump.length} samtidige fejl — der skal ingen tekniker ud.`,
          handling: 'De gamle målepunkter ligger stadig i Enity og tæller med i enhver sum. '
            + 'De skal afsluttes eller markeres, ellers ser butikken ud til at mangle forbrug, den har.',
        });
        i += klump.length;
      } else i++;
    }
  }

  const enkeltvis = doede
    .filter((e) => !brugt.has(e.id) && e.sidstForbrug)
    .map((e) => ({
      id: e.id, navn: e.navn, butik: e.butik, butiksnummer: e.butiksnummer,
      maaler: e.maaler, faggruppe: e.faggruppe, sidstForbrug: e.sidstForbrug,
      dageStille: Math.round((Date.now() - new Date(e.sidstForbrug + 'T00:00:00Z').getTime()) / 864e5),
      fladlinje: !!e.vurdering?.fladlinje,
      tolkning: e.vurdering?.fladlinje
        ? 'Målepunktet leverer den samme værdi i hver eneste time. Det er en månedsaflæsning, der er '
          + 'fordelt jævnt ud — ikke en måling. Tallet kan bruges til en årssum og til intet andet.'
        : 'Denne måler stoppede alene, mens nabomålerne i butikken kørte videre. Enten er anlægget ude '
          + 'af drift, eller også er måleren faldet ud. De to kan ikke skelnes på målepunktet alene: '
          + 'begge ser ud som nul. Sammenhold med butikkens hovedmåler — er det samlede forbrug uændret, '
          + 'kører anlægget stadig.',
    }))
    .sort((a, b) => b.dageStille - a.dageStille);

  /* Målere, der aldrig har leveret noget. De er ikke gået i stykker — de er
   * oprettet i Enity og aldrig koblet på. Det er en installationsopgave, ikke
   * en fejlretning, og den hører et helt andet sted hjemme. */
  const aldrigLeveret = doede
    .filter((e) => !e.sidstForbrug)
    .map((e) => ({
      id: e.id, navn: e.navn, butik: e.butik, butiksnummer: e.butiksnummer,
      maaler: e.maaler, faggruppe: e.faggruppe,
      hovedmaaler: /hoved|forsyning/i.test(e.maaler || e.navn || ''),
      tolkning: 'Målepunktet har aldrig leveret data, så langt historikken går. Det er formentlig oprettet '
        + 'i Enity uden nogensinde at blive koblet på. Det er en installationsopgave, ikke en fejlretning.',
    }));

  return {
    boelger, enkeltvis, aldrigLeveret,
    ialt: doede.length,
    // Det tal, der skal frem: hvor mange kræver rent faktisk, at nogen rykker ud?
    kraeverHandling: enkeltvis.length,
  };
}

/* ---- Hvad der kan findes i en given faggruppe ------------------------------
 * Bruges til at svare en fagansvarlig på det spørgsmål, de faktisk stiller:
 * "hvorfor får jeg ingen varsler på mit område?"
 *
 * Svaret er sjældent "der er ingen fejl". Det er som regel "vi kan ikke se dem".
 */
export function fagomraadeDaekning(enheder) {
  const pr = new Map();
  for (const e of enheder) {
    const fg = e.faggruppe || 'ukendt';
    if (!pr.has(fg)) pr.set(fg, { faggruppe: fg, navn: fgNavn(fg), antal: 0, kwh: 0, niveauer: [0, 0, 0, 0], delte: 0 });
    const g = pr.get(fg);
    g.antal++;
    g.kwh += e.kwhAar || 0;
    g.niveauer[Math.max(0, Math.min(3, e.niveau ?? 0))]++;
    if (e.dedikeret === false) g.delte++;
  }
  return [...pr.values()].map((g) => ({
    ...g,
    kanDateres: g.antal ? Math.round(100 * (g.niveauer[2] + g.niveauer[3]) / g.antal) : 0,
    kanDoegnprofil: g.antal ? Math.round(100 * g.niveauer[3] / g.antal) : 0,
    besked: g.niveauer[0] + g.niveauer[1] > g.antal * 0.5
      ? 'Over halvdelen af anlæggene har ikke tidsserier. Får du få varsler på dette område, er det '
        + 'sandsynligvis fordi vi ikke kan se dem — ikke fordi der ikke er noget.'
      : g.delte > g.antal * 0.5
        ? 'Over halvdelen af målerne dækker flere anlæg. Afvigelser kan findes, men ikke henføres til '
          + 'ét bestemt anlæg, og et servicebesøg skal starte med at afgøre hvilket.'
        : null,
  })).sort((a, b) => b.kwh - a.kwh);
}
