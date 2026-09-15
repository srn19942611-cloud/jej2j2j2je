/* Døgnprofilen — det, der først bliver synligt med finopløst data.
 *
 * Et døgnforbrug er ét tal. Et døgn i kvarterer er 96, og de 96 tal indeholder
 * ting, summen aldrig kan vise:
 *
 *   Afrimninger   ligger som periodiske toppe. Med døgnværdier kan man se, AT
 *                 der bruges for meget. Med kvarterer kan man se, at det sker
 *                 seks gange i døgnet på faste klokkeslæt, og at hver top
 *                 varer 50 minutter i stedet for 25.
 *   Kortcykling   en kompressor, der starter og stopper for tit, slider sig
 *                 selv op. Det ses kun i variationen fra kvarter til kvarter.
 *   Tidsplaner    om et ventilationsanlæg faktisk starter kl. 6 og stopper kl.
 *                 21 — eller aldrig stopper. Det er en aflæsning, ikke et skøn.
 *   Grundlast     det, der kører hele natten. Stiger den, er noget nyt sat til.
 *                 Stiger toppen i stedet, er det belastningen, der er vokset.
 *                 To vidt forskellige sager med samme døgnsum.
 *
 * KALIBRERET MOD RIGTIGE DATA. Tallene nedenfor er målt på Kvickly Aarhus C,
 * 1. maj – 31. august 2026, 11.712 kvarterer pr. måler. De er værd at kende,
 * fordi tre af dem modsagde, hvad jeg havde regnet med:
 *
 *   Afrimninger kunne IKKE ses. Målepunktet er en hel teknik-tavle med flere
 *   kompressorer og en grundlast på 50–70 kW; en enkelt afrimning på 2–5 kW
 *   forsvinder i den. Afrimningsdetektoren er derfor ikke en detektor, der
 *   virker overalt — den kræver en måler pr. kølegruppe, og den skal sige det
 *   frem for at finde noget alligevel.
 *
 *   Der ligger en top på ét kvarter kl. 06:00 på 120 af 123 døgn, +70 % over
 *   baseline. Den er for regelmæssig og for kortvarig til at være et anlæg,
 *   og ligner en registreringsklump i måleren. Uden en regel for det ville
 *   den blive fundet som en afrimning hver eneste dag.
 *
 *   Små målere larmer. Ventilationsmåleren kører 0,49 kWh/t i drift mod 0,05
 *   i grundlast. Et spring på 0,01 kWh — altså intet — er 8 % af medianen.
 *   Alle relative tærskler skal derfor have en absolut bund under sig.
 *
 * Ærlighed om opløsningen: Enity spreder nogle måleres timeværdi ud på fire ens
 * kvarterer. På sådan en måler er "kvartervariation" et rent regneartefakt, og
 * alt her, der bygger på kvartersvingninger, skal nægte at svare. Det er derfor
 * hver funktion først spørger, hvad målingen kan bære.
 */

import { median, kvantil, mad } from './statistik.js';

/* Under dette er et målepunkt for lille til, at procenter betyder noget.
 * Sat efter ventilationsmåleren i Aarhus C, der kører 0,12 kWh pr. kvarter:
 * dér er en ændring på 0,01 kWh både usynlig i praksis og 8 % på papiret. */
export const MIN_KVARTER_KWH = 0.25;

/** Hvad en måling kan bære. `q` er flaget fra Enity-udtrækket. */
export function opløsning(punkter) {
  const n = punkter.length;
  if (!n) return { skridtMin: null, kanDoegnprofil: false, kanKvarter: false, grund: 'ingen punkter' };

  const tider = punkter.map((p) => new Date(p.t).getTime()).sort((a, b) => a - b);
  const skridt = [];
  for (let i = 1; i < Math.min(tider.length, 200); i++) skridt.push(tider[i] - tider[i - 1]);
  const skridtMin = Math.round((median(skridt) || 0) / 60000);

  const spredte = punkter.filter((p) => p.q === 'spread').length;
  const manglende = punkter.filter((p) => p.v == null).length;
  const daekning = Math.round(100 * (n - manglende) / n);

  /* Er målepunktet stort nok til, at procenter betyder noget? Og er det
   * overhovedet i live? Fire måneder med konstant nul er ikke en profil — det
   * er en død måler, og den fandtes faktisk: 548601 AC Kontor. */
  const vaerdier = punkter.map((p) => p.v).filter((v) => v != null);
  const m = median(vaerdier) || 0;
  const unikke = new Set(vaerdier).size;
  const doed = vaerdier.length > 0 && unikke <= 1;
  // Pulsmålere med hele kWh-trin kan ikke bære finanalyse — værdierne
  // eksisterer, men de er kvantiseret grovere end det, der skal måles.
  const heltallige = vaerdier.length ? vaerdier.filter((v) => Number.isInteger(v)).length / vaerdier.length : 0;
  const puls = heltallige > 0.95 && unikke < 40;

  return {
    skridtMin,
    punkter: n,
    daekning,
    manglende,
    // En udspredt timeværdi kan bære en døgnprofil (timen er rigtig nok),
    // men aldrig en kvarteranalyse.
    medianKwh: Math.round(m * 1000) / 1000,
    unikkeVaerdier: unikke,
    doed, puls,
    forSmaa: m > 0 && m < MIN_KVARTER_KWH,
    kanDoegnprofil: daekning >= 70 && skridtMin <= 60 && !doed && !puls,
    kanKvarter: daekning >= 70 && skridtMin <= 15 && spredte < n * 0.1 && !doed && !puls && m >= MIN_KVARTER_KWH,
    ægteKvarter: spredte < n * 0.1,
    spredteAndel: Math.round(100 * spredte / n),
    grund: daekning < 70 ? `kun ${daekning} % dækning`
      : doed ? 'målepunktet har kun én værdi i hele perioden — det er en død måler eller et anlæg ude af drift'
        : puls ? `pulsmåler med hele kWh-trin (kun ${unikke} forskellige værdier) — for groft kvantiseret til finanalyse`
          : skridtMin > 60 ? `${skridtMin} minutters opløsning er for groft`
            : spredte >= n * 0.1 ? `${Math.round(100 * spredte / n)} % af værdierne er udspredte timeværdier, ikke målte kvarterer`
              : m < MIN_KVARTER_KWH ? `målepunktet er for lille (median ${Math.round(m * 1000) / 1000} kWh pr. kvarter) — procenter bliver meningsløse`
                : null,
  };
}

/* ---- Profilen ------------------------------------------------------------- */

const timeAf = (t) => Number(String(t).slice(11, 13));
const datoAf = (t) => String(t).slice(0, 10);
const ugedagAf = (t) => new Date(t).getDay();

/**
 * Bygger døgnprofilen: gennemsnitligt forbrug pr. time, delt på dagtype.
 * Butikkens rytme er det stærkeste signal i et energiforbrug, og den skal
 * kendes, før noget som helst andet kan kaldes en afvigelse.
 */
export function doegnprofil(punkter, { lukketimer = [0, 1, 2, 3, 4, 5] } = {}) {
  const opl = opløsning(punkter);
  if (!opl.kanDoegnprofil) return { brugbar: false, opløsning: opl, grund: opl.grund };

  const gyldige = punkter.filter((p) => p.v != null);
  const prTime = { hverdag: Array.from({ length: 24 }, () => []), weekend: Array.from({ length: 24 }, () => []) };
  const prDoegn = new Map();

  for (const p of gyldige) {
    const d = ugedagAf(p.t);
    const type = d === 0 || d === 6 ? 'weekend' : 'hverdag';
    prTime[type][timeAf(p.t)].push(p.v);
    const dag = datoAf(p.t);
    if (!prDoegn.has(dag)) prDoegn.set(dag, []);
    prDoegn.get(dag).push(p);
  }

  // Punkterne pr. time skal lægges sammen, ikke midles, når der er fire pr. time.
  const prTimeKwh = Math.round(60 / opl.skridtMin);
  const timeserie = (liste) => liste.map((v) => (v.length ? median(v) * prTimeKwh : null));

  const alle = gyldige.map((p) => p.v);
  const grundlast = kvantil(alle, 0.05);
  const spids = kvantil(alle, 0.95);

  // Natandel regnes pr. døgn og medianeres — ikke som ét samlet forhold, så en
  // enkelt skæv nat ikke kan flytte tallet.
  const natandele = [];
  for (const [, liste] of prDoegn) {
    if (liste.length < prTimeKwh * 20) continue;   // ufuldstændigt døgn
    const sum = liste.reduce((a, p) => a + (p.v || 0), 0);
    const nat = liste.filter((p) => lukketimer.includes(timeAf(p.t))).reduce((a, p) => a + (p.v || 0), 0);
    if (sum > 0) natandele.push(nat / sum);
  }

  return {
    brugbar: true,
    opløsning: opl,
    hverdag: timeserie(prTime.hverdag),
    weekend: timeserie(prTime.weekend),
    grundlast: Math.round(grundlast * 1000) / 1000,
    spids: Math.round(spids * 1000) / 1000,
    // Hvor "fladt" kører anlægget? Tæt på 1 betyder konstant drift.
    fladhed: spids > 0 ? Math.round((grundlast / spids) * 100) / 100 : null,
    natandel: natandele.length ? Math.round(median(natandele) * 1000) / 10 : null,
    lukketimer,
    doegn: prDoegn.size,
  };
}

/* ---- Afrimninger ----------------------------------------------------------
 * Toppene i et køleanlægs kvarterserie. De findes ved at holde hvert kvarter op
 * mod døgnets egen grundlast — ikke mod et fast tal, for anlæggene er meget
 * forskellige i størrelse.
 */
export function afrimninger(punkter, { minLoeft = 1.35, maxVarighedMin = 120 } = {}) {
  const opl = opløsning(punkter);
  if (!opl.kanKvarter) {
    return {
      brugbar: false, opløsning: opl,
      grund: `Afrimninger kan ikke ses: ${opl.grund || 'for grov opløsning'}. `
        + 'Toppene varer typisk 20–50 minutter og forsvinder i en timeværdi.',
    };
  }

  const prDoegn = new Map();
  for (const p of punkter) {
    if (p.v == null) continue;
    const d = datoAf(p.t);
    if (!prDoegn.has(d)) prDoegn.set(d, []);
    prDoegn.get(d).push(p);
  }

  const alle = [];
  for (const [dag, liste] of prDoegn) {
    liste.sort((a, b) => a.t.localeCompare(b.t));
    const basis = kvantil(liste.map((p) => p.v), 0.35);
    if (!basis || basis <= 0) continue;

    let i = 0;
    while (i < liste.length) {
      if (liste[i].v < basis * minLoeft) { i++; continue; }
      let j = i;
      while (j < liste.length && liste[j].v >= basis * minLoeft) j++;
      const varighed = (j - i) * opl.skridtMin;
      if (varighed <= maxVarighedMin) {
        const top = liste.slice(i, j);
        const merforbrug = top.reduce((a, p) => a + (p.v - basis), 0);
        alle.push({
          dag,
          start: top[0].t.slice(11, 16),
          minutter: varighed,
          loeft: Math.round((median(top.map((p) => p.v)) / basis) * 100) / 100,
          merKwh: Math.round(merforbrug * 1000) / 1000,
          // Minutter siden midnat — bruges til at se, om de ligger fast.
          minut: Number(top[0].t.slice(11, 13)) * 60 + Number(top[0].t.slice(14, 16)),
        });
      }
      i = j;
    }
  }

  if (!alle.length) {
    return {
      brugbar: true, opløsning: opl, antal: 0, prDoegn: 0,
      tolkning: 'Ingen periodiske toppe fundet. Enten afrimes der elektrisk et andet sted end på dette '
        + 'målepunkt, eller også afrimes der med varm gas, som ikke koster el på samme måde.',
    };
  }

  /* Registreringsklumper, ikke afrimninger.
   *
   * I de rigtige data lå der en top på ÉT kvarter kl. 06:00 på 120 af 123
   * døgn. Den ville blive fundet som en afrimning hver eneste dag. Men en
   * afrimning varer 20–50 minutter og rammer ikke det samme kvarter med
   * urværkets præcision — det gør en måler, der dumper en akkumuleret værdi
   * på et fast tidspunkt. Kombinationen "ét kvarter langt" og "samme
   * klokkeslæt næsten hver dag" er derfor et måleartefakt, ikke et anlæg.
   *
   * Vi fjerner dem og siger det. At skjule dem ville være værre: nogen ville
   * før eller siden se dem i rådataene og spørge, hvorfor de ikke er med. */
  const doegnTal = prDoegn.size;
  const prKlokkeslaet = new Map();
  for (const a of alle) {
    if (a.minutter > opl.skridtMin) continue;         // kun ét-kvarters toppe
    const n = String(a.minut);
    prKlokkeslaet.set(n, (prKlokkeslaet.get(n) || 0) + 1);
  }
  const artefakttider = new Set([...prKlokkeslaet].filter(([, c]) => c >= doegnTal * 0.8).map(([n]) => n));
  const artefakter = alle.filter((a) => a.minutter <= opl.skridtMin && artefakttider.has(String(a.minut)));
  const ægte = alle.filter((a) => !artefakter.includes(a));

  if (!ægte.length) {
    return {
      brugbar: true, opløsning: opl, antal: 0, prDoegn: 0,
      artefakter: artefakter.length,
      artefakttider: [...artefakttider].map((m) => minTilTid(Number(m))),
      tolkning: artefakter.length
        ? `Ingen afrimninger fundet. Der ligger ${artefakter.length} ét-kvarters toppe på faste `
          + `klokkeslæt (${[...artefakttider].map((m) => minTilTid(Number(m))).join(', ')}) på næsten hvert døgn — `
          + 'de er for korte og for regelmæssige til at være et anlæg og ligner en registreringsklump i '
          + 'måleren. De er holdt udenfor.'
        : 'Ingen periodiske toppe fundet.',
    };
  }

  const prDag = [...prDoegn.keys()].map((d) => ægte.filter((a) => a.dag === d).length).filter((n) => n > 0);
  const minutter = ægte.map((a) => a.minut);

  /* Ligger de på faste klokkeslæt? Målt som spredningen på starttidspunktet
   * modulo den typiske afstand mellem to afrimninger. En styring, der afrimer
   * på tid, rammer det samme klokkeslæt hver dag. En, der afrimer på behov,
   * flytter sig. Det er forskellen på en indstilling og en tilstand. */
  const typiskAntal = Math.round(median(prDag)) || 1;
  const periode = 1440 / typiskAntal;
  const fase = minutter.map((m) => m % periode);
  const faseSpredning = mad(fase);

  return {
    brugbar: true, opløsning: opl,
    antal: ægte.length,
    artefakter: artefakter.length,
    artefakttider: [...artefakttider].map((m) => minTilTid(Number(m))),
    prDoegn: Math.round(median(prDag) * 10) / 10,
    medianMinutter: Math.round(median(ægte.map((a) => a.minutter))),
    medianLoeft: Math.round(median(ægte.map((a) => a.loeft)) * 100) / 100,
    merKwhPrDoegn: Math.round(median(prDag) * median(ægte.map((a) => a.merKwh)) * 100) / 100,
    faseSpredningMin: Math.round(faseSpredning),
    paaFastTid: faseSpredning < periode * 0.12,
    doegn: prDoegn.size,
    tolkning: faseSpredning < periode * 0.12
      ? `${Math.round(median(prDag) * 10) / 10} afrimninger i døgnet på faste klokkeslæt (± ${Math.round(faseSpredning)} min). `
        + 'Fast tid betyder, at der afrimes lige meget, uanset om der er rim — om sommeren er det som regel for tit.'
      : `${Math.round(median(prDag) * 10) / 10} afrimninger i døgnet, men på skiftende tidspunkter (± ${Math.round(faseSpredning)} min). `
        + 'Det tyder på behovsstyret afrimning, hvilket er det, man vil have.',
  };
}

/* ---- Kortcykling ----------------------------------------------------------
 * En kompressor, der starter og stopper for hyppigt, slider sig selv op. Den
 * mest almindelige årsag er for lidt kølemiddel eller en forkert indstillet
 * pressostat — og det er en fejl, ingen opdager, fordi temperaturen holder.
 *
 * Første udgave målte medianen af |v(t) − v(t−1)| som andel af forbruget. Det
 * er forkert, og prøven viste hvorfor: et anlæg, der cyklede hver anden time
 * mellem fuld drift og stop, fik uro 0,03 — det samme som et anlæg, der kørte
 * helt jævnt. Medianen er robust over for enkeltspring, og cyklingens spring
 * ER enkeltspring: kun to ud af otte kvarterer skifter tilstand, resten ligger
 * stille. Målet var immunt over for det, det skulle finde.
 *
 * Det rigtige mål er antallet af STARTER. Tæl hvor mange gange serien krydser
 * op over midten mellem stoppet og kørende. Det er samtidig det tal, en
 * køletekniker regner i — starter pr. time — så en anbefaling kan holdes op
 * mod fabrikantens grænse frem for mod en opfundet tærskel.
 */
export function kortcykling(punkter, { starterPrTime = 1.2 } = {}) {
  const opl = opløsning(punkter);
  if (!opl.kanKvarter) {
    return { brugbar: false, opløsning: opl, grund: `Kortcykling kræver ægte kvarterdata: ${opl.grund}` };
  }
  const gyldige = punkter.filter((p) => p.v != null);
  if (gyldige.length < 200) return { brugbar: false, grund: 'for kort serie' };

  const v = gyldige.map((p) => p.v);
  const lav = kvantil(v, 0.10);
  const hoej = kvantil(v, 0.90);
  if (hoej <= lav * 1.5) {
    return {
      brugbar: true, opløsning: opl, starterPrTime: 0, mistanke: false,
      tolkning: 'Anlægget skifter ikke mellem tændt og slukket — det modulerer eller kører konstant. '
        + 'Så er kortcykling ikke et spørgsmål her.',
    };
  }

  /* Hysterese, så støj omkring midten ikke tælles som starter. Vi kræver, at
   * serien har været nede under 35 % af spændet, før en tur over 65 % tæller
   * som en ny start. */
  const ned = lav + (hoej - lav) * 0.35;
  const op = lav + (hoej - lav) * 0.65;
  let tilstand = v[0] > op ? 'oppe' : 'nede';
  let starter = 0;
  for (const x of v) {
    if (tilstand === 'nede' && x >= op) { starter++; tilstand = 'oppe'; }
    else if (tilstand === 'oppe' && x <= ned) tilstand = 'nede';
  }

  const timer = gyldige.length * opl.skridtMin / 60;
  const pr = starter / timer;

  /* Hvad opløsningen overhovedet tillader. Med kvarterdata kan en cyklus, der
   * er kortere end en halv time, ikke ses — to punkter er det mindste, der kan
   * udgøre en top. Ægte kortcykling er ofte ti starter i timen, og dem er vi
   * blinde over for. Det skal stå, så ingen læser "ingen kortcykling" som
   * "anlægget cykler ikke". */
  const loft = 60 / (2 * opl.skridtMin);

  /* Ved loftet ved vi ikke, hvor hurtigt det i virkeligheden går. Det er ikke
   * et måleresultat, det er en underkant — og det er en helt anden besked. */
  const vedLoftet = pr >= loft * 0.85;

  return {
    brugbar: true, opløsning: opl,
    starter,
    starterPrTime: Math.round(pr * 100) / 100,
    graense: starterPrTime,
    synlighedsloft: Math.round(loft * 10) / 10,
    vedLoftet,
    mistanke: pr > starterPrTime,
    tolkning: vedLoftet
      ? `Anlægget starter mindst ${Math.round(pr * 10) / 10} gange i timen — og det er så hurtigt, som `
        + `${opl.skridtMin}-minutters data overhovedet kan vise. Den rigtige hastighed kan være meget højere. `
        + 'Det skal aflæses på styringen: starter pr. time er et tal, køleanlægget selv kender.'
      : pr > starterPrTime
        ? `Anlægget starter ${Math.round(pr * 10) / 10} gange i timen. Hver start belaster motor og `
          + 'olieforhold, og et anlæg, der cykler, holder ikke sin levetid. Kandidaterne er for lidt '
          + 'kølemiddel, en pressostat med for snæver difference, eller en kapacitet, der er for stor til '
          + 'den last, anlægget har nu.'
        : `${Math.round(pr * 10) / 10} starter i timen — inden for det normale.`,
    forbehold: `Med ${opl.skridtMin} minutters data kan højst ${Math.round(loft * 10) / 10} starter i timen ses, `
      + 'og ægte kortcykling ligger ofte på seks til ti. Måler man under loftet, er tallet rigtigt; måler '
      + 'man ved loftet, er det en underkant. Denne detektor kan altså udelukke langsom cykling, men den '
      + 'kan ikke frikende et anlæg for hurtig kortcykling — det kræver styringens egne starttællere.',
  };
}

/* ---- Driftstid mod tidsplan -----------------------------------------------
 * Aflæser, hvornår anlægget faktisk starter og stopper. Det er den eneste måde
 * at kontrollere en tidsplan uden adgang til CTS — og adgangen til CTS har vi
 * ikke.
 */
export function driftstid(punkter, { aabner = '06:00', lukker = '21:00', taerskel = 0.35 } = {}) {
  const opl = opløsning(punkter);
  if (!opl.kanDoegnprofil) return { brugbar: false, opløsning: opl, grund: opl.grund };

  const prDoegn = new Map();
  for (const p of punkter) {
    if (p.v == null) continue;
    const d = datoAf(p.t);
    if (!prDoegn.has(d)) prDoegn.set(d, []);
    prDoegn.get(d).push(p);
  }

  const dage = [];
  for (const [dag, liste] of prDoegn) {
    liste.sort((a, b) => a.t.localeCompare(b.t));
    const v = liste.map((p) => p.v);
    const lav = kvantil(v, 0.05);
    const hoej = kvantil(v, 0.95);
    if (hoej <= lav * 1.15) {
      // Anlægget skelner ikke mellem dag og nat. Det ER fundet.
      dage.push({ dag, start: null, stop: null, konstant: true, ugedag: ugedagAf(liste[0].t) });
      continue;
    }
    const graense = lav + (hoej - lav) * taerskel;
    const foerste = liste.find((p) => p.v >= graense);
    const sidste = [...liste].reverse().find((p) => p.v >= graense);
    dage.push({
      dag, konstant: false, ugedag: ugedagAf(liste[0].t),
      start: foerste ? foerste.t.slice(11, 16) : null,
      stop: sidste ? sidste.t.slice(11, 16) : null,
    });
  }

  const tilMin = (s) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null);
  const hverdage = dage.filter((d) => d.ugedag >= 1 && d.ugedag <= 5 && !d.konstant);
  const weekend = dage.filter((d) => (d.ugedag === 0 || d.ugedag === 6) && !d.konstant);
  const konstante = dage.filter((d) => d.konstant).length;

  const opgør = (liste) => {
    const s = liste.map((d) => tilMin(d.start)).filter(Number.isFinite);
    const e = liste.map((d) => tilMin(d.stop)).filter(Number.isFinite);
    if (!s.length) return null;
    return {
      start: minTilTid(median(s)), stop: minTilTid(median(e)),
      startVariationMin: Math.round(mad(s)), stopVariationMin: Math.round(mad(e)),
      dage: liste.length,
    };
  };

  const h = opgør(hverdage);
  const planStart = tilMin(aabner);
  const planStop = tilMin(lukker);
  const foerTid = h ? tilMin(h.start) - planStart : null;
  const efterTid = h ? tilMin(h.stop) - planStop : null;

  return {
    brugbar: true, opløsning: opl,
    hverdag: h, weekend: opgør(weekend),
    konstanteDoegn: konstante,
    andelKonstant: dage.length ? Math.round(100 * konstante / dage.length) : 0,
    plan: { aabner, lukker },
    foerTidMin: foerTid, efterTidMin: efterTid,
    // En tidsplan, der følges, har lille variation fra dag til dag. Stor
    // variation betyder, at nogen tænder og slukker i hånden.
    følgerPlan: !!h && h.startVariationMin <= 20 && h.stopVariationMin <= 20,
    tolkning: konstante > dage.length * 0.5
      ? `Anlægget kører i konstant drift ${Math.round(100 * konstante / dage.length)} % af døgnene — `
        + 'der er ingen forskel på nat og dag. Enten er tidsplanen slået fra, eller også er der sat en '
        + 'håndoverstyring, som aldrig er taget af.'
      : h
        ? `Starter typisk ${h.start} og stopper ${h.stop} på hverdage (± ${h.startVariationMin}/${h.stopVariationMin} min). `
          + (foerTid < -30 ? `Det er ${Math.abs(foerTid)} minutter før butikken åbner. ` : '')
          + (efterTid > 30 ? `Og ${efterTid} minutter efter den lukker. ` : '')
          + (h.startVariationMin > 20 ? 'Den store variation tyder på manuel betjening frem for en tidsplan.' : '')
        : 'Kunne ikke aflæse start- og stoptidspunkter.',
  };
}

const minTilTid = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

/* ---- Samtidig køl og varme ------------------------------------------------
 * Den klassiske, og den eneste her, der kræver to målere på én gang.
 *
 * Køles og varmes der i det samme rum på det samme tidspunkt, betaler man to
 * gange for at stå stille. Det kan ikke ses på nogen af de to målere hver for
 * sig — begge ser helt normale ud. Kun når de lægges ved siden af hinanden,
 * time for time, bliver det synligt.
 */
export function samtidigKoelOgVarme(koel, varme, { minTimer = 20 } = {}) {
  const oKoel = opløsning(koel);
  const oVarme = opløsning(varme);
  if (!oKoel.kanDoegnprofil || !oVarme.kanDoegnprofil) {
    return { brugbar: false, grund: `Kræver døgnprofil på begge målere: køl ${oKoel.grund || 'ok'}, varme ${oVarme.grund || 'ok'}.` };
  }

  // Læg dem på samme timeraster.
  const tilTimer = (punkter) => {
    const m = new Map();
    for (const p of punkter) {
      if (p.v == null) continue;
      const n = p.t.slice(0, 13);
      m.set(n, (m.get(n) || 0) + p.v);
    }
    return m;
  };
  const k = tilTimer(koel);
  const v = tilTimer(varme);

  const faelles = [...k.keys()].filter((t) => v.has(t));
  if (faelles.length < 24 * 7) return { brugbar: false, grund: `Kun ${faelles.length} fælles timer — der skal mindst en uge til.` };

  const kv = faelles.map((t) => k.get(t));
  const vv = faelles.map((t) => v.get(t));
  const kGraense = kvantil(kv, 0.6);
  const vGraense = kvantil(vv, 0.6);

  const samtidige = faelles.filter((t, i) => kv[i] > kGraense && vv[i] > vGraense);
  const andel = samtidige.length / faelles.length;

  // Hvad koster det? Den mindste af de to er den, der modarbejdes.
  const spildKwh = samtidige.reduce((a, t) => {
    const i = faelles.indexOf(t);
    return a + Math.min(kv[i] - kGraense, vv[i] - vGraense);
  }, 0);

  return {
    brugbar: true,
    timer: samtidige.length,
    faellesTimer: faelles.length,
    andel: Math.round(andel * 1000) / 10,
    spildKwh: Math.round(spildKwh),
    mistanke: samtidige.length >= minTimer && andel > 0.08,
    eksempler: samtidige.slice(0, 6),
    tolkning: samtidige.length >= minTimer && andel > 0.08
      ? `Der køles og varmes samtidig i ${samtidige.length} timer — ${Math.round(andel * 100)} % af perioden. `
        + 'De to anlæg arbejder imod hinanden, og der betales for begge dele. Det er næsten altid en '
        + 'reguleringsfejl: overlappende setpunkter, en ventil der ikke lukker, eller to styringer der '
        + 'ikke ved af hinanden. Ingen af de to målere ser unormale ud hver for sig — det er kun, når de '
        + 'holdes op mod hinanden, at det kan ses.'
      : `Køl og varme overlapper i ${samtidige.length} timer (${Math.round(andel * 100)} %) — inden for det normale.`,
  };
}


/* ---- Weekendnedsættelse ---------------------------------------------------
 * Fundet direkte i de rigtige data: ventilationen i Kvickly Aarhus C kører
 * 08:45–23:15 på 118 af 123 døgn — og præcis det samme lørdag og søndag som
 * tirsdag. Der er ingen weekendnedsættelse overhovedet.
 *
 * Det er ikke en fejl på anlægget. Det er en tidsplan, der aldrig er sat op
 * efter butikkens faktiske åbningstid, og den slags koster hver eneste weekend
 * resten af anlæggets levetid. Ingen døgnsum kan vise det; det kræver, at man
 * lægger lørdagens profil oven på tirsdagens.
 */
export function weekendnedsaettelse(punkter, { minForskelPct = 12 } = {}) {
  const pr = doegnprofil(punkter);
  if (!pr.brugbar) return { brugbar: false, opløsning: pr.opløsning, grund: pr.grund };

  const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);
  const hv = sum(pr.hverdag);
  const we = sum(pr.weekend);
  if (!hv) return { brugbar: false, grund: 'intet hverdagsforbrug at sammenligne med' };

  const forskel = Math.round(1000 * (1 - we / hv)) / 10;

  /* Driftstimer hver for sig — det er dem, der afslører en tidsplan. Et anlæg
   * kan godt bruge mindre i weekenden, blot fordi der er færre kunder, og
   * alligevel køre præcis lige så mange timer. Det første er normalt, det
   * andet er en indstilling, ingen har rørt. */
  const timerOver = (profil) => {
    const top = Math.max(...profil.filter(Number.isFinite));
    const bund = Math.min(...profil.filter(Number.isFinite));
    if (top <= bund * 1.2) return 24;
    return profil.filter((v) => Number.isFinite(v) && v > bund + (top - bund) * 0.35).length;
  };
  const tHv = timerOver(pr.hverdag);
  const tWe = timerOver(pr.weekend);

  const sammeTider = Math.abs(tHv - tWe) <= 1;
  return {
    brugbar: true,
    hverdagKwh: Math.round(hv * 10) / 10,
    weekendKwh: Math.round(we * 10) / 10,
    forskelPct: forskel,
    driftstimerHverdag: tHv,
    driftstimerWeekend: tWe,
    sammeTider,
    mistanke: sammeTider && forskel < minForskelPct,
    tolkning: sammeTider && forskel < minForskelPct
      ? `Anlægget kører ${tWe} timer i weekenden mod ${tHv} på hverdage, og forbruget er kun ${forskel} % lavere. `
        + 'Der er reelt ingen weekendnedsættelse. Det er en tidsplan, der aldrig er sat efter butikkens '
        + 'åbningstid — og den koster hver weekend, året rundt.'
      : sammeTider
        ? `Samme driftstimer i weekenden som på hverdage, men ${forskel} % lavere forbrug — anlægget skruer ned uden at slukke.`
        : `${tWe} driftstimer i weekenden mod ${tHv} på hverdage — der er en nedsættelse.`,
  };
}

/* ---- Natforbrug, der ikke hører til ---------------------------------------
 * Også fundet i de rigtige data: lysmåleren i Aarhus C står på præcis nul i
 * 92 % af hverdagsnattens kvarterer — men bruger 0,97–1,15 kWh/t i
 * weekendnætterne. Der står noget og brænder fra fredag aften til mandag
 * morgen, som ikke gør det i ugen.
 *
 * Det er et lille tal og en tydelig sag: et anlæg enten slukker om natten
 * eller også gør det ikke. Gør det det fem ud af syv nætter, er de sidste to
 * en fejl i en tidsplan — ikke et behov.
 */
export function natrest(punkter, { natTimer = [1, 2, 3, 4], minKwh = 0.15 } = {}) {
  const opl = opløsning(punkter);
  if (!opl.kanDoegnprofil) return { brugbar: false, opløsning: opl, grund: opl.grund };

  const nat = { hverdag: [], weekend: [] };
  for (const p of punkter) {
    if (p.v == null) continue;
    if (!natTimer.includes(timeAf(p.t))) continue;
    const d = ugedagAf(p.t);
    // Natten EFTER fredag og lørdag regnes som weekend — det er den, der er lang.
    nat[d === 0 || d === 6 ? 'weekend' : 'hverdag'].push(p.v);
  }
  if (nat.hverdag.length < 40 || nat.weekend.length < 20) {
    return { brugbar: false, grund: 'for få natkvarterer til at sammenligne' };
  }

  /* Udendørsbelysning brænder om natten, fordi den skal.
   *
   * Porteføljekørslen fandt fire "Udv. Lys"-målere uden dagforbrug overhovedet
   * og kun natforbrug. De er fuldstændig korrekte, og en detektor, der ikke
   * kender dem, vil melde gadebelysning ind som en fejl hver eneste nat.
   *
   * Vi afgør det på forbruget frem for på navnet: er natten højere end dagen,
   * er anlægget natstyret, og så er "der brænder noget om natten" ikke en sag.
   */
  const dag = punkter.filter((p) => p.v != null && timeAf(p.t) >= 11 && timeAf(p.t) < 16).map((p) => p.v);
  const mDag = dag.length ? median(dag) : null;
  const alleNat = median([...nat.hverdag, ...nat.weekend]);
  /* Margin, ikke bare "større". Et anlæg, der brænder fladt døgnet rundt, har
   * et natforbrug, der på støjen alene kan ende marginalt over dagforbruget —
   * og blev derfor frikendt som natstyret. Et ægte natstyret anlæg bruger
   * markant mere om natten, ikke en anelse. */
  if (mDag != null && alleNat > mDag * 1.5) {
    return {
      brugbar: true, opløsning: opl, natstyret: true, mistanke: false,
      hverdagNat: Math.round(median(nat.hverdag) * 1000) / 1000,
      dagMedian: Math.round(mDag * 1000) / 1000,
      tolkning: 'Målepunktet bruger mere om natten end om dagen. Det er udendørs- eller natbelysning, '
        + 'der gør præcis, hvad den skal — ikke noget, der er glemt tændt. Et fravær af natforbrug ville '
        + 'her være fejlen.',
    };
  }

  const mHv = median(nat.hverdag);
  const mWe = median(nat.weekend);
  const slukkerHv = nat.hverdag.filter((v) => v < minKwh).length / nat.hverdag.length;
  const slukkerWe = nat.weekend.filter((v) => v < minKwh).length / nat.weekend.length;
  const slukkerIalt = (slukkerHv * nat.hverdag.length + slukkerWe * nat.weekend.length)
    / (nat.hverdag.length + nat.weekend.length);

  return {
    brugbar: true, opløsning: opl,
    hverdagNat: Math.round(mHv * 1000) / 1000,
    weekendNat: Math.round(mWe * 1000) / 1000,
    slukkerHverdagPct: Math.round(slukkerHv * 100),
    slukkerWeekendPct: Math.round(slukkerWe * 100),
    // Merforbruget over et år, hvis weekendnætterne bragte sig ned på hverdagsniveau.
    kwhPrAar: Math.round(Math.max(0, mWe - mHv) * natTimer.length * 4 * 104),
    /* To forskellige sager, og porteføljekørslen viste, at den anden er langt
     * den almindeligste: weekendhullet fandtes slet ikke på 29 lysmålere,
     * mens seks stod tændt døgnet rundt. Detektoren skal kunne begge dele —
     * ellers leder den efter et mønster, der er sjældent, og går glip af det,
     * der faktisk står og brænder. */
    /* Tærsklen var 15 %, og den var for hård. Porteføljekørslen fandt to
     * lysmålere, der kun slukkede 25 og 32 % af nætterne — hverdag som
     * weekend — og kaldte dem den største lysbesparelse i udsnittet. De blev
     * ikke fanget. En kreds, der slukker en fjerdedel af nætterne, HAR en
     * slukkefunktion; den bruges bare næsten aldrig, og det er værre end
     * ingen, ikke bedre. */
    slukkerSjaeldent: slukkerIalt < 0.5,
    slukkerAndel: Math.round(slukkerIalt * 100),
    mistanke: (slukkerHv > 0.7 && slukkerWe < slukkerHv - 0.25) || slukkerIalt < 0.5,
    tolkning: slukkerHv > 0.7 && slukkerWe < slukkerHv - 0.25
      ? `Anlægget slukker ${Math.round(slukkerHv * 100)} % af hverdagsnætterne, men kun `
        + `${Math.round(slukkerWe * 100)} % af weekendnætterne. Det slukker altså, når det skal — bare ikke `
        + 'i weekenden. Det er næsten altid en tidsplan, der mangler lørdag og søndag, og ikke et behov.'
      : slukkerIalt < 0.5
        ? `Anlægget slukker kun ${Math.round(slukkerIalt * 100)} % af nætterne — hverdag som weekend. `
          + `Resten af tiden brænder det ${Math.round(mHv * 4 * 100) / 100} kWh/t hele natten. `
          + (slukkerIalt > 0.05
            ? 'At det slukker nogle nætter viser, at det KAN — så det er ikke et behov, men en tidsplan, der '
              + 'ikke slår igennem.'
            : 'Er det ikke udendørs- eller nødbelysning, er det en tidsplan, der aldrig er sat op.')
        : `Natforbruget er ${mWe > mHv * 1.3 ? 'højere i weekenden' : 'ens hele ugen'} — ingen sag her.`,
  };
}
