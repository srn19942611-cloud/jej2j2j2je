/* Flådelaget: fra 13.529 målepunkter til det, nogen skal se på i morgen.
 *
 * Det her lag findes, fordi en detektor, der virker på ét anlæg, ikke
 * nødvendigvis virker på 13.529. Regnestykket er ubarmhjertigt:
 *
 *   0,9 % falske alarmer — som er et godt tal for en enkelt detektor —
 *   gange 11.770 analyseenheder = 109 falske alarmer. Hver nat.
 *   Fordelt på ni fagansvarlige: 12 stykker hver, hver nat, mod en
 *   realistisk kapacitet på under én ny sag om dagen.
 *
 * Agenten ville blive slået fra i løbet af en uge, og den ville have fortjent
 * det. Problemet løses ikke med en bedre detektor — det er et spørgsmål om
 * multiplicitet, og det har sin egen matematik.
 *
 * Fire greb, i denne rækkefølge:
 *   1 · gate      enheder uden nok data kommer slet ikke i betragtning
 *   2 · dedupér   et varsel, der allerede står åbent, er ikke et nyt varsel
 *   3 · FDR       Benjamini-Hochberg: hold det FORVENTEDE antal falske nede
 *   4 · budget    hver fagansvarlig får det, de kan nå — resten venter, synligt
 *
 * Og ét greb, der går den anden vej: findes den samme fejl på tredive butikker
 * samtidig, er det ikke tredive opgaver. Det er én beslutning.
 */

import { median, mad } from './statistik.js';
import { AARSAG } from './aarsag.js';
import { normButik } from './korrelation.js';
import { fgNavn } from './taxonomy.js';

/* ---- 1 · Gaten ------------------------------------------------------------
 * Hvad der slet ikke må give et varsel. Billigere at afvise her end at lade
 * en fagansvarlig bruge sin tid på at afvise det.
 */
export const GATE = {
  minDaekning: 70,        // % døgn med data i vurderingsperioden
  minReferencedoegn: 60,  // uden en ordentlig normal er afvigelsen et gæt
  minDoegn: 10,           // en afvigelse på under 10 døgn har ikke holdt endnu
  minKr: 2000,            // under dette er et servicebesøg dyrere end fejlen
};

export function passerGate(varsel, gate = GATE) {
  const s = varsel.signatur;
  const grunde = [];
  if (s.referencedoegn < gate.minReferencedoegn) grunde.push(`kun ${s.referencedoegn} referencedøgn`);
  if (s.doegn < gate.minDoegn) grunde.push(`afvigelsen har kun holdt i ${s.doegn} døgn`);
  // Hastende sager og blinde punkter slipper forbi beløbsgrænsen: et standset
  // anlæg koster ingenting på elregningen og er alligevel det vigtigste.
  if (!varsel.hastende && varsel.krKlasse === 'besparelse' && varsel.kr < gate.minKr) {
    grunde.push(`${varsel.kr} kr./år er under grænsen på ${gate.minKr}`);
  }
  return { ok: !grunde.length, grunde };
}

/* ---- 2 · Sandsynligheden for, at det er tilfældigt ------------------------
 * For at kunne styre antallet af falske alarmer skal hvert varsel have et tal
 * for, hvor overraskende det er. Det regnes ud af afvigelsens robuste z-værdi.
 *
 * To ting gøres med vilje konservativt:
 *
 * Medianens usikkerhed. Medianen af n døgn er mere sikker end ét døgn, men
 * ikke n gange — faktoren er √n/1,253 for normalfordelt støj.
 *
 * Autokorrelation. Døgnene er ikke uafhængige: er det koldt i dag, er det
 * sandsynligvis også koldt i morgen, og vejrmodellen fjerner ikke det hele.
 * Regner man som om de var uafhængige, bliver hver p-værdi for lille, og så
 * slipper alt for meget igennem. Vi deler derfor det effektive antal døgn med
 * tre. Tallet er et skøn, ikke en måling — og det er sat, så det hellere
 * afviser et ægte fund end slipper et falskt igennem.
 */
const EFFEKTIV_DELER = 3;

export function pVaerdi(varsel) {
  const s = varsel.signatur;
  if (!Number.isFinite(s.z) || !s.doegn) return 1;
  const nEff = Math.max(1, s.doegn / EFFEKTIV_DELER);
  const z = Math.abs(s.z) * Math.sqrt(nEff) / 1.253;
  return 2 * (1 - normalfordeling(z));
}

/** Φ(x) — Zelen & Severo, nøjagtig nok til fire decimaler. */
function normalfordeling(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (1.330274429 * t ** 4 - 1.821255978 * t ** 3 + 1.781477937 * t ** 2 - 0.356563782 * t + 0.319381530);
  return x > 0 ? 1 - p : p;
}

/* ---- 3 · Benjamini-Hochberg ------------------------------------------------
 * Styrer den forventede ANDEL af falske blandt dem, vi sender videre — ikke
 * antallet af tests. Det er den rigtige størrelse at styre her: en
 * fagansvarlig kan leve med, at hver tiende sag er en blindgyde. Ikke med, at
 * ni ud af ti er det.
 *
 * Bonferroni ville også virke, men er alt for hård ved 11.770 tests: den ville
 * kræve p under 0,000004 og dermed kun lade totalhavarier igennem. BH tillader
 * netop så mange, som datagrundlaget bærer.
 */
export function fdr(varsler, { maalFDR = 0.10 } = {}) {
  const med = varsler.map((v) => ({ v, p: pVaerdi(v) })).sort((a, b) => a.p - b.p);
  const m = med.length;
  let graense = -1;
  for (let i = 0; i < m; i++) {
    if (med[i].p <= ((i + 1) / m) * maalFDR) graense = i;
  }
  const godkendt = med.slice(0, graense + 1);
  return {
    godkendt: godkendt.map((x) => ({ ...x.v, p: x.p })),
    afvist: med.slice(graense + 1).map((x) => ({ ...x.v, p: x.p })),
    tests: m,
    maalFDR,
    pGraense: graense >= 0 ? med[graense].p : 0,
    // Det tal, der skal siges højt: hvor mange af dem, vi sender videre,
    // forventer vi selv er blindgyder?
    forventedeFalske: Math.round((graense + 1) * maalFDR * 10) / 10,
  };
}

/* ---- 4 · Dedupering -------------------------------------------------------
 * Det samme anlæg med den samme årsag er den samme sag. Kører agenten hver
 * nat, må den ikke melde den samme tilsmudsede kondensator ind 60 gange, mens
 * den venter på et servicebesøg.
 */
export function dedupér(varsler, aabne = []) {
  const nøgle = (v) => `${v.enhed.id}|${v.aarsagId}`;
  const kendte = new Set(aabne.map(nøgle));
  const set = new Set();
  const nye = [];
  const gengangere = [];
  for (const v of varsler) {
    const n = nøgle(v);
    if (kendte.has(n) || set.has(n)) { gengangere.push(v); continue; }
    set.add(n);
    nye.push(v);
  }
  return { nye, gengangere };
}

/* ---- 5 · Budgettet --------------------------------------------------------
 * Hver fagansvarlig får det, de kan nå. Resten forsvinder ikke — den står i
 * en liste, der kan åbnes. Forskellen er, om den afbryder nogen.
 *
 * Rækkefølgen er ikke kroner alene. Et standset anlæg med nul kroner i
 * elbesparelse skal altid øverst, for der står varer og bliver varme.
 */
export const STANDARDBUDGET = 5;   // nye sager pr. person pr. uge

export function fordelEfterBudget(varsler, { budget = STANDARDBUDGET } = {}) {
  const prPerson = {};
  for (const v of varsler) (prPerson[v.ejerId || 'ingen'] ||= []).push(v);

  const sendt = [];
  const venter = [];
  for (const [personId, liste] of Object.entries(prPerson)) {
    const rangeret = [...liste].sort((a, b) => vaerdi(b) - vaerdi(a));
    sendt.push(...rangeret.slice(0, budget));
    venter.push(...rangeret.slice(budget).map((v) => ({ ...v, venter: true, ejerKø: personId })));
  }
  return { sendt: sendt.sort((a, b) => vaerdi(b) - vaerdi(a)), venter };
}

/* Hvad er et varsel værd at afbryde nogen for? Haster slår kroner, kroner
 * slår konfidens — men konfidensen vægter, så en usikker stor sag ikke
 * trænger en sikker mellemstor væk. */
function vaerdi(v) {
  const hast = v.hastende ? 1e9 : 0;
  const blindt = v.krKlasse === 'blindt' ? 1e3 : 0;
  return hast + blindt + v.kr * (v.konfidens / 100);
}

/* ---- 6 · Den samme fejl mange steder --------------------------------------
 * Det her er grebet, der giver overblik frem for arbejde.
 *
 * Findes den samme årsag med den samme signatur på tredive butikker inden for
 * et par uger, er det ikke tredive anlæg, der er gået i stykker hver for sig.
 * Så er det en firmwareopdatering, en leverandør, en indstilling, der er rullet
 * ud, eller en fejl i vores egen model. Alle fire er ÉN beslutning — og de tre
 * første skal tages et helt andet sted end i en serviceopgave.
 *
 * Omvendt: melder tredive butikker det samme, og det viser sig at være vores
 * model, der er gal, er det den billigste fejl, hubben nogensinde kommer til
 * at finde. Den slags skal ses, ikke sendes ud.
 */
export function systematiskeFejl(varsler, { minButikker = 4, minAndel = 0.25, vinduedage = 45 } = {}) {
  const grupper = new Map();
  for (const v of varsler) {
    /* "Kan ikke afgøres" er ikke en årsag, og otte butikker, hvor vi ikke
     * ved hvad der er galt, er ikke ét fælles fund — det er otte huller. */
    if (v.aarsagId === 'ukendt') continue;
    const n = `${v.faggruppe}|${v.aarsagId}`;
    if (!grupper.has(n)) grupper.set(n, []);
    grupper.get(n).push(v);
  }

  const fund = [];
  for (const [n, liste] of grupper) {
    const butikker = new Set(liste.map((v) => normButik(v.butiksnummer)));
    if (butikker.size < minButikker) continue;

    /* Ligger de tæt i tid?
     *
     * To ting skal gøres rigtigt her, og begge blev gjort forkert først.
     *
     * (1) Kun et RIGTIGT fundet brud har en dato. En glidende fejl har ingen
     *     startdag — der står bare referenceperiodens slutning i feltet, og
     *     den er den samme for alle enheder. Første udgave regnede den med,
     *     og så fik fjorten lækager med vidt forskellige forløb en spredning
     *     på nul dage og blev udråbt til én fælles hændelse. Datoen var
     *     modellens, ikke anlæggets.
     *
     * (2) Spredningen fra første til sidste dato er ubrugelig: én enhed, hvor
     *     bruddet blev fundet tre måneder skævt, ødelægger målingen for alle
     *     de andre. Atten butikker, der FAKTISK fik den samme fejl samme dag,
     *     kom ud med "spredt over 88 dage" af netop den grund.
     *
     * Derfor: find i stedet den største KLUMP af datoer. Hvor mange falder
     * inden for et par uger af mediandatoen? Det tal holder, selv om enkelte
     * brud er fundet skævt — og det er dét, der afgør, om der er en fælles
     * hændelse at lede efter.
     */
    const datoer = liste
      .filter((v) => v.signatur.form === 'spring' && v.signatur.brud)
      .map((v) => v.signatur.segmentStart)
      .filter(Boolean)
      .map((d) => new Date(d + 'T00:00:00Z').getTime())
      .sort((a, b) => a - b);

    let klump = null;
    if (datoer.length >= minButikker) {
      const midt = datoer[Math.floor(datoer.length / 2)];
      const halvt = (vinduedage / 2) * 864e5;
      const indenfor = datoer.filter((t) => Math.abs(t - midt) <= halvt);

      /* Er klumpen tættere, end tilfældet ville give?
       *
       * Det spørgsmål manglede, og uden det er enhver gruppe "samtidig":
       * lægger man et vindue på 45 dage ned over elleve datoer spredt ud over
       * fire måneder, fanger det næsten halvdelen — og halvdelen så ud til at
       * være nok. Elleve kompressorsvigt på elleve tilfældige dage blev
       * dermed til én fælles hændelse, der ikke fandtes.
       *
       * Sammenligningsgrundlaget er, hvor bredt datoerne KUNNE ligge, altså
       * længden af det vindue, vi overhovedet kigger i. Ligger bruddene
       * tilfældigt, er den forventede andel i et 45-dages vindue netop
       * 45 delt med vinduets længde. Klumpen skal være mindst dobbelt så
       * tæt som det, før den betyder noget. */
      const vindue = median(liste.map((v) => v.signatur.vurderingsdoegn || v.signatur.doegn)) || vinduedage;
      const forventet = Math.min(1, vinduedage / vindue);
      const andel = indenfor.length / liste.length;
      klump = {
        antal: indenfor.length, andel,
        forventet: Math.round(forventet * 100) / 100,
        taethed: Math.round((andel / forventet) * 10) / 10,
        fra: new Date(indenfor[0]).toISOString().slice(0, 10),
        til: new Date(indenfor[indenfor.length - 1]).toISOString().slice(0, 10),
        midt: new Date(midt).toISOString().slice(0, 10),
      };
    }
    const samtidig = !!klump && klump.antal >= minButikker
      && klump.andel >= Math.max(minAndel, 2 * klump.forventet);

    const [faggruppe, aarsagId] = n.split('|');
    const a = AARSAG[aarsagId];
    fund.push({
      id: `SYS-${faggruppe}-${aarsagId}`,
      faggruppe, aarsagId, navn: a?.navn || aarsagId,
      butikker: butikker.size,
      varsler: liste.length,
      // Hvor mange havde en dato at gå ud fra overhovedet. Uden den kan
      // "samtidig" ikke afgøres, og det skal fremgå frem for at blive gættet.
      medDato: datoer.length,
      klump,
      samtidig,
      krSamlet: liste.reduce((x, v) => x + v.kr, 0),
      ejerId: liste[0].ejerId,
      ejerNavn: liste[0].ejerNavn,
      eksempler: liste.slice(0, 5).map((v) => ({ butik: v.butik, anlaeg: v.enhed.navn, dato: v.signatur.segmentStart })),
      tolkning: samtidig
        ? `${klump.antal} af ${liste.length} anlæg fik afvigelsen inden for ${vinduedage} dage omkring ${klump.midt} `
          + `— ${klump.taethed} gange tættere, end tilfældigt spredte datoer ville give. `
          + 'Så er det sjældent tilfældigt sammenfald: se efter en opdatering, en leverandør, en indstilling '
          + 'der er rullet ud — eller en fejl i vores egen model. Alle fire er én beslutning, ikke '
          + `${liste.length} opgaver.`
        : datoer.length < minButikker
          ? `${butikker.size} butikker viser det samme mønster, men kun ${datoer.length} af dem har en dato, `
            + 'vi kan stole på — resten er glidende fejl uden et bestemt starttidspunkt. Om det er én fælles '
            + 'hændelse kan derfor ikke afgøres på data. Behandl det som en anlægstype.'
          : `${butikker.size} butikker viser det samme mønster, men datoerne klumper sig ikke. `
            + 'Det ligner en almindelig fejltype snarere end én fælles hændelse — værd at se på som en '
            + 'anlægstype, ikke som en fælles årsag.',
      handling: samtidig
        ? 'Find den fælles hændelse, FØR der bestilles arbejde. Ét telefonopkald kan spare alle besøgene.'
        : 'Behandl som en anlægstype: er det den samme model eller leverandør, hører det til i en samlet aftale.',
    });
  }
  return fund.sort((a, b) => b.butikker - a.butikker);
}

/* ---- 7 · Søskendesammenligning på anlægsniveau -----------------------------
 * Butikkens nøgletal pr. m² er for groft til at pege på et anlæg. Det, der
 * kan bruges, er at holde ét køleanlæg op mod alle de ANDRE køleanlæg af samme
 * slags — ikke mod butikkens naboer.
 *
 * Det er samtidig en detektor, der ikke behøver nogen normal og derfor virker
 * fra første dag på en butik, der lige er koblet på.
 */
export function soeskende(enheder, { minGruppe = 8, graenseZ = 2.5 } = {}) {
  const grupper = new Map();
  for (const e of enheder) {
    if (!e.faggruppe || !Number.isFinite(e.kwhAar) || !Number.isFinite(e.normaliseringsgrundlag) || e.normaliseringsgrundlag <= 0) continue;
    const n = `${e.faggruppe}|${e.klasse || 'ukendt'}`;
    if (!grupper.has(n)) grupper.set(n, []);
    grupper.get(n).push({ ...e, noegletal: e.kwhAar / e.normaliseringsgrundlag });
  }

  const fund = [];
  for (const [n, liste] of grupper) {
    if (liste.length < minGruppe) continue;
    const vaerdier = liste.map((x) => x.noegletal);
    const m = median(vaerdier);
    const spredning = mad(vaerdier);
    if (!spredning) continue;
    for (const e of liste) {
      const z = (e.noegletal - m) / spredning;
      if (z < graenseZ) continue;
      const [faggruppe, klasse] = n.split('|');
      fund.push({
        enhedId: e.id, navn: e.navn, butik: e.butik, butiksnummer: e.butiksnummer,
        faggruppe, klasse, z: Math.round(z * 10) / 10,
        noegletal: Math.round(e.noegletal), median: Math.round(m), gruppe: liste.length,
        merforbrugKwh: Math.round((e.noegletal - m) * e.normaliseringsgrundlag),
        symptom: `${Math.round(e.noegletal)} mod ${Math.round(m)} for de ${liste.length} andre ${fgNavn(faggruppe).toLowerCase()} af samme type `
          + `— ${Math.round(100 * (e.noegletal / m - 1))} % over.`,
        // Det her er et SYMPTOM, ikke en diagnose. En søskendesammenligning
        // kan ikke sige hvorfor — den kan kun sige hvor man skal kigge.
        forbehold: 'Sammenligningen siger hvor, ikke hvorfor. Den kan lige så godt skyldes '
          + 'anlæggets størrelse, alder eller det, det betjener, som en fejl.',
      });
    }
  }
  return fund.sort((a, b) => b.merforbrugKwh - a.merforbrugKwh);
}

/* ---- Det samlede gennemløb ------------------------------------------------ */

/**
 * Kører hele sigten og fortæller, hvad der blev sorteret fra hvor.
 * Regnskabet er med vilje synligt: en sigte, man ikke kan se igennem, er en
 * sigte, ingen tør stole på.
 */
export function sigt(varsler, { aabne = [], gate = GATE, maalFDR = 0.10, budget = STANDARDBUDGET } = {}) {
  const ialt = varsler.length;

  const gated = [];
  const faldtIGate = [];
  for (const v of varsler) {
    const g = passerGate(v, gate);
    (g.ok ? gated : faldtIGate).push(g.ok ? v : { ...v, gateGrunde: g.grunde });
  }

  const { nye, gengangere } = dedupér(gated, aabne);
  const f = fdr(nye, { maalFDR });
  const systematiske = systematiskeFejl(f.godkendt);

  /* Varsler, der indgår i en samtidig systematisk fejl, tages UD af den
   * personlige kø. De hører til ét sted, som én sag — ellers får den
   * fagansvarlige tredive opgaver om det samme og opdager aldrig mønsteret. */
  const iSystematisk = new Set();
  for (const s of systematiske.filter((x) => x.samtidig)) {
    for (const v of f.godkendt) {
      if (v.faggruppe === s.faggruppe && v.aarsagId === s.aarsagId) iSystematisk.add(v.id);
    }
  }
  const enkeltsager = f.godkendt.filter((v) => !iSystematisk.has(v.id));

  const { sendt, venter } = fordelEfterBudget(enkeltsager, { budget });

  return {
    sendt, venter, systematiske,
    regnskab: {
      ialt,
      faldtIGate: faldtIGate.length,
      gengangere: gengangere.length,
      afvistAfFDR: f.afvist.length,
      iSystematisk: iSystematisk.size,
      overBudget: venter.length,
      sendt: sendt.length,
      tests: f.tests,
      pGraense: f.pGraense,
      forventedeFalske: f.forventedeFalske,
      maalFDR,
    },
    detaljer: { faldtIGate, gengangere, afvistAfFDR: f.afvist },
  };
}

/* ---- Den første kørsel er ikke en normal kørsel ---------------------------
 *
 * Det her er det sted, hvor en portefølje adskiller sig mest fra en enkelt
 * butik, og hvor det er lettest at gøre noget dumt.
 *
 * Når agenten kører første gang over hele porteføljen, finder den ikke det,
 * der gik galt i nat. Den finder alt, der har hobet sig op siden anlæggene
 * blev sat op. Med omkring 5.500 analyserbare elmålere og den fundrate, vi
 * målte på elleve butikker, bliver det i størrelsesordenen 1.400 sager efter
 * sigten — mod en kapacitet på 45 om ugen. Det er 32 ugers arbejde, der
 * lander på én morgen.
 *
 * Budgetlogikken ville stille de 1.355 i "venter". Det er teknisk korrekt og
 * praktisk ubrugeligt: ingen kan overskue en kø på halvandet tusind, og den,
 * der åbner hubben den morgen, slår den fra.
 *
 * Så en bunke skal behandles som en bunke. Tre greb, og de gør hver deres:
 *
 *   Sambesøg   seks fund i samme butik er ÉN køretur, ikke seks opgaver.
 *   Kampagne   to hundrede fund med samme årsag på tværs af butikker er én
 *              beslutning og en udrulning, ikke to hundrede servicebesøg.
 *   Straks     det, der ikke kan vente, uanset hvor lang køen er.
 *
 * Og ét krav: sig hvor lang tid bunken tager at tømme. Et estimat, ingen har
 * regnet, bliver til en forventning, ingen kan holde.
 */

export function foersteKoersel(varsler, { budget = STANDARDBUDGET, personer = 9, minSambesoeg = 3, minKampagne = 12 } = {}) {
  /* 1 · Straks. Varer i fare og blinde punkter venter ikke på en kø. */
  const straks = varsler.filter((v) => v.hastende);
  const resten = varsler.filter((v) => !v.hastende);

  /* 2 · Kampagner. Den samme årsag mange steder er én beslutning.
   *
   * Bemærk forskellen til systematiskeFejl(): dér ledte vi efter en FÆLLES
   * HÆNDELSE — noget, der skete samtidig. Her leder vi efter en fælles
   * ANLÆGSTYPE, hvor datoerne netop ikke klumper. Det er to forskellige ting
   * og to forskellige samtaler: den første er "hvad skete der i marts", den
   * anden er "sådan er de anlæg bygget". */
  const prAarsag = new Map();
  for (const v of resten) {
    const n = `${v.faggruppe}|${v.aarsagId}`;
    if (!prAarsag.has(n)) prAarsag.set(n, []);
    prAarsag.get(n).push(v);
  }
  const kampagner = [];
  const iKampagne = new Set();
  for (const [n, liste] of prAarsag) {
    const butikker = new Set(liste.map((v) => normButik(v.butiksnummer)));
    if (butikker.size < minKampagne) continue;
    const [faggruppe, aarsagId] = n.split('|');
    const a = AARSAG[aarsagId];
    for (const v of liste) iKampagne.add(v.id);
    kampagner.push({
      id: `KAM-${faggruppe}-${aarsagId}`,
      faggruppe, aarsagId, navn: a?.navn || aarsagId,
      butikker: butikker.size, varsler: liste.length,
      krSamlet: liste.reduce((x, v) => x + v.kr, 0),
      ejerId: liste[0].ejerId, ejerNavn: liste[0].ejerNavn,
      // Det, der gør en kampagne billigere end enkeltsager: tjeklisten er
      // den samme hver gang, så den kan lægges i en aftale frem for i 200 besøg.
      tjek: a?.tjek || [],
      typiskFund: a?.typiskFund || null,
      tolkning: `${a?.navn || aarsagId} findes på ${butikker.size} butikker. Datoerne klumper ikke, så det er `
        + 'ikke én hændelse — det er sådan, den slags anlæg er sat op hos os. Behandles det som '
        + `${liste.length} enkeltsager, bliver det ${liste.length} servicebesøg med den samme tjekliste. `
        + 'Behandles det som én kampagne, er det én aftale og én udrulning.',
      handling: 'Afgør først på tre til fem butikker, om diagnosen holder. Gør den det, så lav en samlet '
        + 'aftale frem for enkeltopgaver — og brug de første besøg til at prissætte resten.',
    });
  }

  /* 3 · Sambesøg. Flere fund i samme butik er én køretur. */
  const enkelte = resten.filter((v) => !iKampagne.has(v.id));
  const prButik = new Map();
  for (const v of enkelte) {
    if (!prButik.has(v.butiksnummer)) prButik.set(v.butiksnummer, []);
    prButik.get(v.butiksnummer).push(v);
  }
  const sambesoeg = [];
  const iSambesoeg = new Set();
  for (const [butiksnummer, liste] of prButik) {
    if (liste.length < minSambesoeg) continue;
    for (const v of liste) iSambesoeg.add(v.id);
    const ejere = [...new Set(liste.map((v) => v.ejerNavn))];
    sambesoeg.push({
      id: `SAM-${butiksnummer}`,
      butiksnummer, butik: liste[0].butik,
      antal: liste.length,
      krSamlet: liste.reduce((x, v) => x + v.kr, 0),
      ejere,
      varsler: liste.sort((a, b) => b.kr - a.kr),
      tolkning: ejere.length > 1
        ? `${liste.length} fund i samme butik, fordelt på ${ejere.length} fagansvarlige (${ejere.join(', ')}). `
          + 'Sendes de hver for sig, bliver det lige så mange kørsler. Koordineres de, er det ét besøg.'
        : `${liste.length} fund i samme butik, alle hos ${ejere[0]}. Ét besøg frem for ${liste.length}.`,
    });
  }

  const alene = enkelte.filter((v) => !iSambesoeg.has(v.id));

  /* 4 · Hvor lang tid tager bunken? Regnet i BESØG, ikke i sager — det er
   *     kørslerne, der koster tid, ikke linjerne i en liste. */
  const besoeg = straks.length + sambesoeg.length + alene.length;
  const ugentligKapacitet = budget * personer;
  const uger = ugentligKapacitet ? Math.ceil(besoeg / ugentligKapacitet) : null;

  return {
    straks: straks.sort((a, b) => b.kr - a.kr),
    kampagner: kampagner.sort((a, b) => b.butikker - a.butikker),
    sambesoeg: sambesoeg.sort((a, b) => b.krSamlet - a.krSamlet),
    alene: alene.sort((a, b) => b.kr - a.kr),
    opgoerelse: {
      varsler: varsler.length,
      straks: straks.length,
      iKampagne: iKampagne.size,
      kampagner: kampagner.length,
      iSambesoeg: iSambesoeg.size,
      sambesoeg: sambesoeg.length,
      alene: alene.length,
      besoeg,
      ugentligKapacitet,
      uger,
      // Det tal, der skal siges højt frem for at blive opdaget undervejs.
      besked: uger != null && uger > 8
        ? `${varsler.length} fund bliver til ${besoeg} besøg. Ved ${ugentligKapacitet} om ugen tager det `
          + `${uger} uger — altså omkring ${Math.round(uger / 4.3)} måneder. Det er ikke en kø, der kan `
          + 'tømmes ved at arbejde hårdere. Enten skal kampagnerne trække hovedparten, eller også skal '
          + 'beløbsgrænsen op, så de mindste fund samles i en liste frem for at blive til besøg.'
        : `${varsler.length} fund bliver til ${besoeg} besøg — omkring ${uger} ugers arbejde.`,
    },
  };
}
