/* Lag 3: årsagsanalysen.
 *
 * Detektoren siger "forbruget er 14 % over normalen siden 24. maj". Det er et
 * symptom, og et symptom sender ingen tekniker nogen steder hen. Spørgsmålet,
 * der skal besvares, før nogen kan handle, er HVORFOR.
 *
 * Måden det gøres på her er differentialdiagnose, ikke gæt: et katalog af
 * kendte årsager, hver med den signatur de sætter i målerdata, og en
 * afvejning af hvilke af dem der passer på det, der faktisk er målt.
 *
 * Det afgørende er, at årsagerne adskilles på FORM og ikke på størrelse. To
 * fejl kan koste det samme og se helt ens ud på en månedsopgørelse:
 *
 *   Tilsmudset kondensator  → merforbruget vokser med udetemperaturen.
 *                             Om vinteren er det næsten væk.
 *   Fastlåst afrimning      → det samme antal kWh i døgnet, året rundt.
 *
 * Det er vejrdataene, der skiller dem ad. Uden dem er begge bare "+14 %", og
 * anbefalingen bliver "få en tekniker til at kigge på det" — hvilket er det
 * samme som ingen anbefaling.
 *
 * Al vægtning sker i log-odds, så beviser kan lægges sammen, og så det kan
 * gøres op bagefter, hvilket bevis der trak i hvilken retning. Ingen
 * sprogmodel stiller diagnosen; den beskriver kun den, tallene har stillet.
 */

import { median, mad, regression, cusum, theilSen } from './statistik.js';
import { VEJRFOELSOMHED, sseTrinmodel, sseLinjemodel } from './anlaegsanalyse.js';
import { SAMTIDIGHED } from './korrelation.js';

/* ---- 1 · Signaturen ·-------------------------------------------------------
 * Hvad kan overhovedet måles om en afvigelse? Seks ting, og de er valgt fordi
 * hver af dem adskiller mindst ét årsagspar fra hinanden.
 */

/**
 * Måler afvigelsens signatur ud fra døgnserien og en referenceperiode.
 *
 * `referenceSlut` er sidste døgn, der må indgå i det normale. Alt efter den
 * bedømmes mod modellen — og indgår aldrig i sin egen normal.
 */
export function maalSignatur(raekker, { faggruppe, referenceSlut, knaek = 15, vurderingsdage = 120 } = {}) {
  const alle = (raekker || []).filter((r) => Number.isFinite(r.kwh));

  const foelsom = (VEJRFOELSOMHED[faggruppe] || { variable: [] }).variable;
  const tempvar = foelsom.includes('temperatur') ? 'temperatur' : (foelsom.includes('cdd') ? 'cdd' : (foelsom.includes('hdd') ? 'hdd' : null));

  /* ---- Hvilke døgn bedømmer vi, og hvad bedømmer vi dem imod? -------------
   *
   * To fejl, som begge kom frem, da modellen blev kørt på rigtige data:
   *
   * (1) Vurderingsvinduet var "alt efter referencen". På et toårigt udtræk
   *     bliver det 365 døgn, og en glidende fejl i de sidste fire måneder
   *     fortyndes af otte rene måneder foran. Træfsikkerheden faldt fra 95 til
   *     77 %, ikke fordi modellen blev dårligere, men fordi den blev spurgt om
   *     et helt år i stedet for om nu. Vi bedømmer derfor de seneste
   *     `vurderingsdage` døgn — en tilstand, ikke en årsberetning.
   *
   * (2) Referencen var de første 60 % af vinduet, altså efterår og vinter, og
   *     den blev brugt til at bedømme sommeren. Nu vælges referencedøgnene
   *     efter, om de LIGNER de døgn, der skal bedømmes: kun døgn inden for
   *     vurderingsperiodens temperaturinterval kommer i betragtning. Så
   *     tilpasses modellen dér, hvor den skal bruges, og den bliver aldrig
   *     bedt om at gætte på vejr, den ikke har set.
   */
  const nuStart = referenceSlut != null
    ? referenceSlut
    : Math.max(30, alle.length - vurderingsdage);
  const nu = alle.slice(nuStart);
  const foer = alle.slice(0, nuStart);

  if (foer.length < 30 || nu.length < 14) {
    return { brugbar: false, grund: `For kort serie: ${foer.length} referencedøgn og ${nu.length} vurderingsdøgn.` };
  }

  /* Sæsonligt udvalg. Kun hvis der er nok tilbage — ellers er en bred
   * reference med en ærlig advarsel bedre end en smal, der ikke kan bære en
   * regression. */
  let ref = foer;
  let refudvalg = 'hele perioden før';
  if (tempvar) {
    const tNu = nu.map((r) => r[tempvar]).filter(Number.isFinite);
    if (tNu.length > 10) {
      const lav = Math.min(...tNu), hoej = Math.max(...tNu);
      const luft = (hoej - lav) * 0.15;
      const udvalgt = foer.filter((r) => Number.isFinite(r[tempvar]) && r[tempvar] >= lav - luft && r[tempvar] <= hoej + luft);
      if (udvalgt.length >= 45) {
        ref = udvalgt;
        refudvalg = `${udvalgt.length} af ${foer.length} tidligere døgn med samme slags vejr (${Math.round(lav)}–${Math.round(hoej)} °C)`;
      }
    }
  }

  const vejrvar = foelsom.filter((v) => ref.some((r) => Number.isFinite(r[v])) && mad(ref.map((r) => r[v]).filter(Number.isFinite)) > 1e-6);

  /* ---- Ekstrapolationsvagten ---------------------------------------------
   *
   * Det her er den vigtigste enkeltrettelse i hele modellen, og den kom af,
   * at tallene blev kørt på rigtige data for første gang.
   *
   * Referenceperioden er de første 60 % af vinduet. For et vindue, der
   * slutter i september, er det 16. september til 23. april — altså ren
   * vinter, middeltemperatur 5,3 °C. Vurderingsperioden er sommeren, middel
   * 15,5 °C, og 24 % af dens døgn er varmere end den varmeste dag i hele
   * referencen. En lineær model tilpasset på vinter og anvendt på juli
   * ekstrapolerer ud i det blå: med negativ hældning forudsiger den nær nul,
   * og så eksploderer både afvigelsen i procent og restniveauet. Ét
   * målepunkt kom ud med −13.346 % og et restniveau på −133.
   *
   * Beviset for at det var modellen og ikke anlæggene: 37 ud af 113 målere
   * fik deres brud på 18. eller 19. juni — de samme to døgn. 113 anlæg går
   * ikke i stykker samtidig. CUSUM fandt ikke en fejl; den fandt det sted,
   * hvor modellen holdt op med at passe, altså sommerens begyndelse.
   *
   * Mine egne scenarieprøver kunne aldrig fange det: jeg genererede serierne
   * med præcis den lineære form, modellen tilpasser. En model, der prøves af
   * mod data, den selv har frembragt, består altid.
   */
  let ekstrapolation = null;
  if (tempvar) {
    const tRef = ref.map((r) => r[tempvar]).filter(Number.isFinite);
    const tNu = nu.map((r) => r[tempvar]).filter(Number.isFinite);
    if (tRef.length && tNu.length) {
      const refMax = Math.max(...tRef), refMin = Math.min(...tRef);
      const udenfor = tNu.filter((t) => t > refMax || t < refMin).length / tNu.length;
      ekstrapolation = {
        variabel: tempvar,
        refSpaend: [Math.round(refMin * 10) / 10, Math.round(refMax * 10) / 10],
        vurderingSpaend: [Math.round(Math.min(...tNu) * 10) / 10, Math.round(Math.max(...tNu) * 10) / 10],
        andelUdenfor: Math.round(udenfor * 1000) / 10,
      };
      /* Grænsen var 35 % og er sat ned til 15 %.
       *
       * Den gamle grænse slap en opsætning igennem med 32 % af
       * vurderingsdøgnene uden for referencen. Med en ret linje så det ud til
       * at gå: linjen ekstrapolerer villigt, og på data frembragt af en ret
       * linje er den tilfældigvis rigtig. Med en båndmodel, der ikke kan
       * ekstrapolere, blev det synligt — hver tredje forudsigelse var
       * nærmeste bånds median, altså et gæt.
       *
       * Det var modellen, der afslørede grænsen, ikke omvendt. På de rigtige
       * toårsdata var den højeste andel udenfor 3,3 %, så 15 % er rigelig luft
       * til den opsætning, der faktisk skal bruges. */
      if (udenfor > 0.15) {
        return {
          brugbar: false,
          ekstrapolation,
          grund: `Referenceperioden dækker ${Math.round(refMin)} til ${Math.round(refMax)} °C, men `
            + `${Math.round(udenfor * 100)} % af vurderingsdøgnene ligger udenfor det interval. `
            + 'Modellen ville skulle gætte på vejr, den aldrig har set, og en afvigelse målt på et gæt '
            + 'er ikke en måling. Flyt referenceperioden, så den dækker den samme årstid som det, der '
            + 'vurderes — eller vent, til der er et helt år at bygge normalen på.',
        };
      }
    }
  }

  /* ---- Modellen: dagtype × temperaturbånd --------------------------------
   *
   * Den model, der stod her først, var en ret linje i temperaturen. Den blev
   * målt mod tre alternativer på anlægsformer, hvor sandheden IKKE er lineær
   * — og det er den aldrig i en butik. Resultatet:
   *
   *   ret linje i temperatur   33 % falske alarmer
   *   dagtype × bånd (TOWT)     0 %
   *   medianregression          0 %
   *   nærmeste naboer           8 %
   *
   * Alle fire fandt hver eneste ægte fejl. Forskellen lå udelukkende i de
   * falske — altså i netop det, der afgør, om agenten overlever i drift.
   *
   * Fejlen var lokaliserbar: ventilation. Et aggregat kører 180 kWh på en
   * hverdag og 70 i weekenden, med et temperaturled først over 18 grader. En
   * model, der kun kender temperaturen, kan ikke udtrykke den forskel og
   * midler den — og så flytter residualmedianen sig, bare fordi
   * vurderingsvinduet har en anden fordeling af hverdage og weekender end
   * referencen. På en ren ventilationsserie meldte den 12 % afvigelse, med
   * værste tilfælde på 15,6 %.
   *
   * Det pinlige er, at dagtypeopdelingen allerede fandtes i byggNormallast i
   * anlaegsanalyse.js. Jeg tabte den, da jeg skrev denne nyere motor.
   *
   * TOWT (time-of-week-and-temperature) er den model, der bruges i M&V-
   * standarderne netop af den grund. Her i døgnudgave: median for hver
   * kombination af dagtype og temperaturbånd. Den er ikke-parametrisk i
   * temperaturen, så den forudsætter ingen form — og den kan ikke
   * ekstrapolere vildt, fordi den falder tilbage på nærmeste bånd.
   */
  let model = null;
  let modelform = 'konstant';

  if (tempvar) {
    model = byggTOWT(ref, tempvar);
    modelform = model ? `dagtype × ${model.baand} temperaturbånd` : 'konstant';
  }
  /* Er der for få døgn til at fylde cellerne, falder vi tilbage på en ret
   * linje. Det er dårligere, men det er bedre end en model bygget på celler
   * med to døgn i hver. */
  if (!model && vejrvar.length) {
    const lin = regression(ref.map((r) => ({ ...r, y: r.kwh })), vejrvar);
    if (lin) { model = lin; modelform = 'lineær (for få døgn til bånd)'; }
  }

  /* Et anlæg, der stod stille i referenceperioden, kan ikke få en normal.
   * Tre målere i udsnittet var slukket hele vinteren og startede i juni —
   * dér er der ingen normal at afvige fra, og en diagnose ville være et
   * postulat. */
  const refMedian = median(ref.map((r) => r.kwh));
  if (!refMedian || refMedian <= 0) {
    return {
      brugbar: false, ekstrapolation,
      grund: 'Anlægget brugte intet i referenceperioden. Der er ingen normal at afvige fra — '
        + 'det er et anlæg, der først sættes i drift, ikke et anlæg, der afviger.',
    };
  }

  const forudsig = model ? model.forudsig : () => refMedian;

  const rest = nu.map((r) => ({ ...r, afvig: r.kwh - forudsig(r) }));
  const restRef = ref.map((r) => ({ ...r, afvig: r.kwh - forudsig(r) }));
  const spredning = mad(restRef.map((r) => r.afvig)) || 1;
  const normal = median(ref.map((r) => r.kwh));

  /* (a) Formen — og hvilket stykke af serien der overhovedet skal måles på.
   *
   * Rækkefølgen er afgørende og var forkert i første udgave: måler man
   * signaturen på hele vurderingsvinduet, drukner en fejl, der startede for
   * tre uger siden, i de tre måneder, hvor alt var normalt. Et kompressorsvigt
   * 25 døgn før seriens slutning gav en medianafvigelse på 0,1 % og blev
   * læst som "ingen afvigelse".
   *
   * Derfor: find bruddet FØRST, og mål så kun på stykket efter det. Er der
   * intet brud, er hele vinduet stykket. */
  /* ---- Residualerne skal standardiseres, før der ledes efter et brud ------
   *
   * CUSUM forudsætter, at spredningen er den samme hele vejen. Det er den
   * ikke: et køleanlægs residualer svinger mere på en varm dag end på en kold,
   * simpelthen fordi der er mere last at svinge omkring. Den kumulerede
   * afvigelse driver derfor af sted, når sæsonen skifter, og argmax lander på
   * sommerens begyndelse i stedet for på en fejl.
   *
   * Det blev målt: 19 af 114 målere fik deres brud 18.–19. juni, netop det
   * døgn hvor temperaturen springer fra 13,6 til 18,2 °C og bliver deroppe.
   * Det holdt, også med knækket model og med knæk ved 18 og 20 °C — fordi det
   * ikke er modelformen, der er problemet, men antagelsen om konstant
   * spredning.
   *
   * Rettelsen er at dele hvert residual med den spredning, der hører til DEN
   * slags dag. Spredningen estimeres i temperaturbånd på referenceperioden,
   * så et residual på en varm dag holdes op mod, hvad der er normalt at svinge
   * på en varm dag. */
  const standardiser = byggStandardisering(restRef, tempvar, spredning);
  const brud = cusum(rest.map((r) => r.afvig / standardiser(r)), { minStyrke: 2.5, minSegment: 7 });
  const helTrend = theilSen(rest.map((r, i) => ({ x: i, y: r.afvig })));
  const trendSamlet = helTrend ? helTrend.haeldning * rest.length : 0;

  /* Spring eller glidning? Det kan ikke afgøres ved at holde springets højde
   * op mod trendens samlede udslag — for en ret linje lagt gennem et spring
   * stiger netop omtrent lige så meget som springet selv. I en prøve gav et
   * rent spring på 106 kWh en trend på 147 kWh over vinduet, og testen
   * konkluderede "glidning" om noget, der er et spring.
   *
   * Det, der kan afgøres, er hvilken af de to modeller der forklarer serien
   * bedst. Den sammenligning står allerede i anlaegsanalyse.js og bruges her
   * frem for at blive opfundet en gang til. */
  const y = rest.map((r) => r.afvig);
  const sseTrin = sseTrinmodel(y);
  const sseLinje = sseLinjemodel(y);
  let springer = !!brud && sseTrin <= sseLinje;

  /* Hvor lang tid tog overgangen?
   *
   * SSE-sammenligningen alene er ikke nok. En fejl, der trappes op over otte
   * uger og derefter ligger stille i to måneder, forklares bedst af et trin —
   * modellen ser det lange, flade stykke til sidst og kalder det et nyt
   * niveau. Men en tilsmudset kondensator SPRINGER ikke; den sander til. Og
   * forskellen på "det skete på én dag" og "det skete over otte uger" er
   * forskellen på en installation og en nedslidning.
   *
   * Så vi måler overgangens bredde direkte: hvor mange døgn går der, fra
   * afvigelsen har bevæget sig 20 % af vejen, til den har bevæget sig 80 %?
   * Et ægte spring gør det på få døgn. En optrapning bruger uger. */
  const overgang = maalOvergang(rest.map((r) => r.afvig));
  if (overgang) springer = overgang.bredde <= 14 && !!brud;

  const segment = springer ? rest.slice(brud.indeks) : rest;

  const afvigMedian = median(segment.map((r) => r.afvig));

  /* Hvor meget kører der stadig? Det er dét, der skiller en død måler fra et
   * standset anlæg: en måler, der er faldet ud, viser nul. Et anlæg, der er
   * gået i stå, viser stadig styring og ventilatorer — typisk 5–20 % af det
   * normale. To vidt forskellige sager, som ellers ser ens ud.
   *
   * Målt mod det VEJRKORRIGEREDE forventede forbrug, ikke mod et råt median
   * af referenceperioden. Første udgave gjorde det sidste og fik 1,046 ud af
   * et køleanlæg, der havde mistet et kompressortrin: segmentet lå i juli,
   * referencen strakte sig fra oktober til maj, og sommervarmen gjorde et
   * skadet anlæg til et, der brugte mere end normalt. En sæsonforskel
   * forklædt som en måling. */
  const forventet = median(segment.map((r) => forudsig(r)));
  const restniveau = forventet ? median(segment.map((r) => r.kwh)) / forventet : null;

  let form;
  if (median(segment.map((r) => r.kwh)) <= median(segment.map((r) => forudsig(r))) * 0.02) form = 'nul';
  else if (Math.abs(afvigMedian) < spredning * 0.8) form = 'ingen';
  else if (springer) form = 'spring';
  else if (Math.abs(trendSamlet) > spredning * 1.5) form = 'glidende';
  else form = 'spring';

  /* (b) Er merforbruget vejrafhængigt?
   *
   *     Det her er den vigtigste enkeltmåling i hele diagnosen. Vi tager
   *     afvigelsen — dét modellen IKKE kunne forklare — og ser, om den vokser
   *     med temperaturen. Gør den det, er merforbruget noget, der arbejder
   *     hårdere når det er varmt: kondensering, køleflader, kompressorløft.
   *     Er den flad, er det en konstant last: et varmelegeme, en pumpe, et
   *     setpunkt.
   *
   *     Vi måler det på afvigelsen og ikke på forbruget, netop fordi den
   *     normale vejrafhængighed allerede er trukket ud af modellen. Det, der
   *     er tilbage, er den vejrafhængighed, anlægget ikke plejer at have. */
  let vejrkobling = null;
  if (tempvar && form !== 'nul') {
    /* Tidstrenden ud først.
     *
     * En fejl, der vokser hen over sommeren, vokser samtidig med
     * temperaturen — uden at have noget med den at gøre. En kølemiddellækage,
     * der trappes op fra maj til september, fik derfor stemplet
     * "vejrafhængig" og blev forvekslet med en tilsmudset kondensator, som er
     * en helt anden reparation.
     *
     * Ved at trække den jævne udvikling ud først står kun døgn-til-døgn-
     * variationen tilbage, og dét er den ægte vejrrespons: reagerer
     * merforbruget på, at i går var otte grader varmere end i forgårs? En
     * lækage gør ikke. En tilsmudset kondensator gør. */
    const tid = theilSen(segment.map((r, i) => ({ x: i, y: r.afvig })));
    const punkter = segment
      .map((r, i) => ({ ...r, ren: r.afvig - (tid ? tid.haeldning * i : 0) }))
      .filter((r) => Number.isFinite(r[tempvar]))
      .map((r) => ({ x: r[tempvar], y: r.ren }));
    const ts = theilSen(punkter);
    /* Hvor vejrafhængigt er merforbruget? Målt som afvigelsens hældning pr.
     * grad, holdt op mod anlæggets EGEN temperaturkoefficient.
     *
     * Første udgave delte med selve afvigelsen, og det er forkert: er
     * afvigelsen tæt på nul, eksploderer forholdet, og en ren serie fik
     * stemplet "vejrafhængig" på støj alene. Anlæggets egen koefficient er
     * derimod stabil og har den rigtige enhed — så tallet bliver til
     * "merforbruget reagerer halvt så kraftigt på vejret som anlægget selv",
     * hvilket er en påstand, en køletekniker kan tage stilling til. */
    const basiskoef = model && model.koefficienter ? model.koefficienter[tempvar] : null;
    if (ts && basiskoef && Math.abs(basiskoef) > 1e-6) {
      const spred = mad(punkter.map((q) => q.x)) || 1;
      vejrkobling = {
        variabel: tempvar,
        haeldning: Math.round(ts.haeldning * 100) / 100,
        anlaegKoef: Math.round(basiskoef * 100) / 100,
        udslag: Math.round(ts.haeldning * spred * 2),
        andel: ts.haeldning / Math.abs(basiskoef),
      };
    }
  }
  const vejrafhaengig = vejrkobling
    ? (Math.abs(vejrkobling.andel) > 0.25 ? (vejrkobling.andel > 0 ? 'ja' : 'omvendt') : 'nej')
    : 'ukendt';

  /* (c) Ændrede anlæggets vejrfølsomhed sig? Et anlæg, der pludselig ikke
   *     længere reagerer på vejret, kører for fuld kraft hele tiden — eller
   *     er holdt op med at køre. */
  let koefFoer = null, koefEfter = null;
  if (tempvar) {
    const a = theilSen(ref.filter((r) => Number.isFinite(r[tempvar])).map((r) => ({ x: r[tempvar], y: r.kwh })));
    const b = theilSen(segment.filter((r) => Number.isFinite(r[tempvar])).map((r) => ({ x: r[tempvar], y: r.kwh })));
    koefFoer = a ? a.haeldning : null;
    koefEfter = b ? b.haeldning : null;
  }
  let vejrrespons = 'ukendt';
  if (koefFoer != null && koefEfter != null && Math.abs(koefFoer) > 1e-6) {
    const forhold = koefEfter / koefFoer;
    vejrrespons = forhold < 0.25 ? 'brudt' : forhold > 1.6 ? 'forstærket' : 'uændret';
  }

  return {
    brugbar: true,
    form,
    retning: afvigMedian > 0 ? 'op' : afvigMedian < 0 ? 'ned' : 'flad',
    afvigKwhPrDoegn: Math.round(afvigMedian),
    /* Procenten regnes mod det, anlægget BURDE have brugt i netop de døgn —
     * ikke mod referenceperiodens median. Ellers bliver et sommerfald målt
     * mod en vinternormal, og et anlæg, der står helt stille, kan komme ud
     * som −105 %, hvilket ikke er en ting, der kan lade sig gøre. */
    afvigPct: forventet ? Math.round(1000 * afvigMedian / forventet) / 10 : null,
    forventetKwhPrDoegn: Math.round(forventet),
    normalKwhPrDoegn: Math.round(normal),
    z: Math.round(10 * afvigMedian / spredning) / 10,
    restniveau: restniveau == null ? null : Math.round(restniveau * 1000) / 1000,
    vejrafhaengig,
    vejrkobling,
    vejrrespons,
    koefFoer: koefFoer == null ? null : Math.round(koefFoer * 100) / 100,
    koefEfter: koefEfter == null ? null : Math.round(koefEfter * 100) / 100,
    brud: brud ? { indeks: nuStart + brud.indeks, forskel: Math.round(brud.forskel), styrke: Math.round(brud.styrke * 10) / 10, dato: alle[nuStart + brud.indeks]?.dato } : null,
    trendKwh: Math.round(trendSamlet),
    overgangsdoegn: overgang ? overgang.bredde : null,
    // Døgn er længden af det stykke, signaturen faktisk er målt på — ikke af
    // hele vinduet. Det er dét tal, konfidensen skal stå i forhold til.
    doegn: segment.length,
    vurderingsdoegn: nu.length,
    segmentStart: springer ? alle[nuStart + brud.indeks]?.dato : alle[nuStart]?.dato,
    referencedoegn: ref.length,
    modelleret: alle.some((r) => r.modelleret),
    modelform,
    refudvalg,
    ekstrapolation,
    // Hvad vi IKKE kunne måle. Det skal med, for det sætter loftet over konfidensen.
    mangler: [
      tempvar ? null : 'vejrdata for anlægstypen',
      ekstrapolation && ekstrapolation.andelUdenfor > 10
        ? `${ekstrapolation.andelUdenfor} % af vurderingsdøgnene ligger uden for referenceperiodens temperaturinterval` : null,
      alle.some((r) => r.time) ? null : 'timedata — døgnprofil og natandel kan ikke ses',
    ].filter(Boolean),
  };
}

/**
 * Overgangens bredde i døgn, målt ved at tilpasse en rampe.
 *
 * Modellen er tre stykker: et fladt niveau, en ret stigning over `bredde`
 * døgn, og et nyt fladt niveau. Vi prøver bredder fra 1 døgn (et rent spring)
 * til det halve vindue, og tager den, der passer bedst. Den bredde ER svaret.
 *
 * Første udgave talte i stedet, hvornår serien krydsede 20 % og 80 % af
 * ændringen. Det duer ikke: med en støj på ±60 kWh mod et spring på 100 kWh
 * vandrer selv en udglattet serie hen over tærsklerne, og rene spring blev
 * målt som otte ugers optrapning. Mindste kvadraters afvejning har ikke det
 * problem — den bruger alle døgn på én gang i stedet for at hænge sin
 * afgørelse op på det første, der krydser en streg.
 */
export function maalOvergang(y) {
  if (y.length < 30) return null;
  const n = y.length;
  const bredder = [1, 3, 7, 14, 21, 35, 50, 70, Math.floor(n / 2)].filter((b) => b < n - 10);
  const trin = Math.max(1, Math.floor(n / 40));

  let bedst = null;
  for (const bredde of bredder) {
    for (let start = 5; start + bredde < n - 5; start += trin) {
      const a = middel(y.slice(0, start));
      const b = middel(y.slice(start + bredde));
      let sse = 0;
      for (let i = 0; i < n; i++) {
        const f = i <= start ? a : i >= start + bredde ? b : a + (b - a) * (i - start) / bredde;
        sse += (y[i] - f) ** 2;
      }
      if (!bedst || sse < bedst.sse) bedst = { sse, bredde, start, spring: b - a };
    }
  }
  return bedst;
}

const middel = (a) => (a.length ? a.reduce((x, y2) => x + y2, 0) / a.length : 0);

/**
 * TOWT i døgnudgave: median for hver kombination af dagtype og temperaturbånd.
 *
 * Båndene lægges på kvantiler frem for på faste grader, så de rummer omtrent
 * lige mange døgn uanset klimaet. Celler med under tre døgn bruges ikke —
 * en median af to tal er ikke en normal.
 *
 * `koefficienter[tempvar]` regnes som hældningen hen over båndenes medianer,
 * så diagnosen stadig har et tal at holde merforbrugets vejrafhængighed op
 * imod. Uden det ville skiftet til TOWT have kostet det vigtigste bevis.
 */
function byggTOWT(ref, tempvar, baandOenske = null, minICelle = 5) {
  const med = ref.filter((r) => Number.isFinite(r[tempvar]) && Number.isFinite(r.kwh));
  if (med.length < 45) return null;

  /* Antallet af bånd skal følge datamængden, ikke være et fast tal.
   *
   * Med seks bånd og tre dagtyper er der atten celler. På 90 referencedøgn
   * bliver det fem døgn i hver — og en median af fem tal med sæsonstøj er
   * ikke en normal, den er et gæt med decimaler på. Det kostede: en ren serie
   * meldte 4,5 % afvigelse, hvor den burde melde omkring én.
   *
   * Hverdage fylder fem syvendedele, så det er dem, der bestemmer. Vi sigter
   * efter mindst ti hverdagsdøgn pr. bånd. */
  const hverdage = med.filter((r) => r.aaben !== false && r.ugedag !== 0 && r.ugedag !== 6).length || med.length;
  const baand = baandOenske ?? Math.max(3, Math.min(8, Math.floor(hverdage / 10)));

  const t = med.map((r) => r[tempvar]).sort((a, b) => a - b);
  const skaer = Array.from({ length: baand - 1 }, (_, i) => t[Math.floor((i + 1) / baand * (t.length - 1))]);
  const bin = (v) => { let i = 0; while (i < skaer.length && v > skaer[i]) i++; return i; };
  const dagtype = (r) => (r.aaben === false ? 2 : (r.ugedag === 0 || r.ugedag === 6) ? 1 : 0);

  const celler = {};
  for (const r of med) (celler[`${dagtype(r)}|${bin(r[tempvar])}`] ||= []).push(r.kwh);
  const tabel = {};
  let fyldte = 0;
  for (const [n, v] of Object.entries(celler)) {
    if (v.length < minICelle) continue;
    tabel[n] = median(v);
    fyldte++;
  }
  if (fyldte < 4) return null;

  const samlet = median(med.map((r) => r.kwh));
  const forudsig = (r) => {
    const d = dagtype(r), b = bin(r[tempvar]);
    const eget = tabel[`${d}|${b}`];
    if (eget != null) return eget;
    // Nærmeste bånd i samme dagtype, derefter samme bånd i anden dagtype.
    for (let afs = 1; afs < baand; afs++) {
      for (const s of [-afs, afs]) {
        const v = tabel[`${d}|${b + s}`];
        if (v != null) return v;
      }
    }
    for (const d2 of [0, 1, 2]) if (tabel[`${d2}|${b}`] != null) return tabel[`${d2}|${b}`];
    return samlet;
  };

  /* Hældningen hen over båndene — anlæggets egen temperaturfølsomhed, som
   * diagnosen bruger som målestok. Regnet på hverdage, hvor der er flest døgn. */
  const punkter = [];
  for (let b = 0; b < baand; b++) {
    const v = tabel[`0|${b}`];
    if (v == null) continue;
    const midt = b === 0 ? skaer[0] : b === baand - 1 ? skaer[skaer.length - 1] : (skaer[b - 1] + skaer[b]) / 2;
    punkter.push({ x: midt, y: v });
  }
  const ts = punkter.length >= 3 ? theilSen(punkter) : null;

  let sse = 0;
  for (const r of med) sse += (r.kwh - forudsig(r)) ** 2;

  return {
    forudsig, baand, fyldteCeller: fyldte, referencedoegn: med.length,
    koefficienter: { [tempvar]: ts ? ts.haeldning : 0 },
    rmse: Math.sqrt(sse / med.length),
    n: med.length,
  };
}

/**
 * Spredning som funktion af vejret, estimeret i bånd.
 *
 * Fire bånd er nok: færre fanger ikke sæsonen, flere giver for få døgn i hvert
 * til at et robust spredningsmål betyder noget. Uden for de observerede bånd
 * bruges nærmeste, så funktionen aldrig gætter.
 */
function byggStandardisering(restRef, tempvar, faldback) {
  if (!tempvar) return () => faldback || 1;
  const med = restRef.filter((r) => Number.isFinite(r[tempvar]));
  if (med.length < 40) return () => faldback || 1;

  const t = med.map((r) => r[tempvar]).sort((a, b) => a - b);
  const skaer = [0.25, 0.5, 0.75].map((q) => t[Math.floor(q * (t.length - 1))]);
  const baand = [[-Infinity, skaer[0]], [skaer[0], skaer[1]], [skaer[1], skaer[2]], [skaer[2], Infinity]];

  const spred = baand.map(([lav, hoej]) => {
    const i = med.filter((r) => r[tempvar] > lav && r[tempvar] <= hoej).map((r) => r.afvig);
    return i.length >= 8 ? (mad(i) || faldback || 1) : null;
  });
  // Huller fyldes med nærmeste nabo frem for med et gennemsnit, der ikke er målt.
  for (let i = 0; i < spred.length; i++) {
    if (spred[i] != null) continue;
    spred[i] = spred.find((x, j) => x != null && Math.abs(j - i) === 1) ?? faldback ?? 1;
  }

  return (r) => {
    const v = r[tempvar];
    if (!Number.isFinite(v)) return faldback || 1;
    const i = v <= skaer[0] ? 0 : v <= skaer[1] ? 1 : v <= skaer[2] ? 2 : 3;
    return Math.max(spred[i], (faldback || 1) * 0.25);
  };
}

/**
 * Sammenligning med samme periode sidste år, på LIGE VARME DØGN.
 *
 * Det er den mest direkte prøve, der findes, og den er helt uden model: tag de
 * døgn i år, hvor det var mellem 17 og 22 grader, og hold dem op mod sidste
 * års døgn i det samme temperaturbånd. Er forholdet 1,05, er der ingen
 * niveauændring — uanset hvad en regression måtte mene.
 *
 * Den kræver to års data og kan derfor ikke stå alene. Men når den kan regnes,
 * vejer den tungere end alt andet, netop fordi den ikke forudsætter noget om
 * formen på sammenhængen mellem vejr og forbrug.
 */
export function aarSammenligning(raekker, { tempvar = 'temperatur', vurderingsdage = 120, baandBredde = 5 } = {}) {
  const alle = (raekker || []).filter((r) => Number.isFinite(r.kwh) && Number.isFinite(r[tempvar]));
  if (alle.length < 500) return { brugbar: false, grund: 'kræver to års data' };

  const nu = alle.slice(-vurderingsdage);
  const ifjor = alle.slice(Math.max(0, alle.length - vurderingsdage - 365), alle.length - 365);
  if (ifjor.length < 40) return { brugbar: false, grund: 'for få døgn i samme periode sidste år' };

  const t = nu.map((r) => r[tempvar]).sort((a, b) => a - b);
  const midt = t[Math.floor(t.length * 0.6)];
  const lav = midt - baandBredde / 2, hoej = midt + baandBredde / 2;

  const iBaand = (liste) => liste.filter((r) => r[tempvar] >= lav && r[tempvar] <= hoej).map((r) => r.kwh);
  const a = iBaand(nu), b = iBaand(ifjor);
  if (a.length < 8 || b.length < 8) {
    return { brugbar: false, grund: `for få døgn i båndet ${Math.round(lav)}–${Math.round(hoej)} °C (${a.length} i år, ${b.length} sidste år)` };
  }

  const mNu = median(a), mFjor = median(b);
  if (!mFjor) return { brugbar: false, grund: 'intet forbrug i samme bånd sidste år' };
  const forhold = mNu / mFjor;

  /* Medianen er selv usikker, og det skal med.
   *
   * Første udgave sammenlignede blot de to medianer mod en grænse på 10 %. På
   * en ren serie med kraftig døgnstøj gav det 13 % og dermed "ægte ændring" —
   * en falsk alarm skabt af stikprøven alene. Og en ægte stigning på 20 %
   * blev målt som 10 %, af samme grund.
   *
   * Medianens standardfejl er omtrent 1,253·σ/√n for normalfordelt støj.
   * Forskellen mellem to år har begge usikkerheder i sig. Vi kræver derfor
   * både at ændringen er over ti procent OG at den er større end to gange sin
   * egen usikkerhed — ellers er den ikke målt, den er gættet. */
  const se = (liste) => (liste.length ? 1.253 * (mad(liste) || 0) / Math.sqrt(liste.length) : Infinity);
  const usikkerhed = Math.sqrt(se(a) ** 2 + se(b) ** 2);
  const forskel = Math.abs(mNu - mFjor);
  const relUsikkerhed = mFjor ? usikkerhed / mFjor : Infinity;
  const signifikant = forskel > 2 * usikkerhed;

  return {
    brugbar: true,
    baand: [Math.round(lav), Math.round(hoej)],
    doegnIAar: a.length, doegnSidsteAar: b.length,
    kwhIAar: Math.round(mNu), kwhSidsteAar: Math.round(mFjor),
    forhold: Math.round(forhold * 100) / 100,
    aendring: Math.round((forhold - 1) * 1000) / 10,
    usikkerhedPct: Math.round(relUsikkerhed * 1000) / 10,
    signifikant,
    // Både over ti procent og større end støjen. Ét af kravene alene er ikke nok.
    bekraefter: Math.abs(forhold - 1) > 0.10 && signifikant,
    tolkning: !signifikant
      ? `På døgn mellem ${Math.round(lav)} og ${Math.round(hoej)} °C er forskellen til sidste år `
        + `${Math.round((forhold - 1) * 100)} %, men usikkerheden på de to medianer er ±${Math.round(relUsikkerhed * 100)} %. `
        + 'Forskellen er altså inden for støjen og kan ikke bruges til noget — hverken til at bekræfte eller '
        + 'afkræfte et brud.'
      : Math.abs(forhold - 1) <= 0.10
        ? `På døgn mellem ${Math.round(lav)} og ${Math.round(hoej)} °C bruger anlægget ${Math.round((forhold - 1) * 100)} % `
          + 'mere end sidste år på tilsvarende døgn. Det er ingen niveauændring. Finder modellen alligevel et '
          + 'brud, er det modellen og ikke anlægget.'
        : `På døgn mellem ${Math.round(lav)} og ${Math.round(hoej)} °C bruger anlægget ${Math.round((forhold - 1) * 100)} % `
          + `${forhold > 1 ? 'mere' : 'mindre'} end sidste år på tilsvarende døgn (±${Math.round(relUsikkerhed * 100)} %). `
          + 'Det er en ægte ændring — og den kan ses uden nogen model overhovedet.',
  };
}

/* ---- 2 · Årsagskataloget ·--------------------------------------------------
 * Hver årsag beskriver den signatur, den sætter. `prior` er hvor almindelig
 * årsagen er, når der først ER en afvigelse — ikke hvor almindelig den er i
 * al almindelighed. Tallene er sat efter fagfolks erfaring, ikke målt på
 * Coops egne data, og det står i `grundlag`, så de kan rettes, når de første
 * hundrede sager er lukket med en rigtig årsag.
 */

export const AARSAGER = [
  {
    id: 'kondensator_tilsmudset', navn: 'Tilsmudset eller tildækket kondensator',
    faggrupper: ['koel_frys', 'koeleflader'], prior: 0.26, klasse: 'besparelse', hastende: false,
    signatur: { form: ['glidende'], retning: 'op', vejrafhaengig: 'ja', vejrrespons: ['forstærket', 'uændret'] },
    forklaring: 'Kondensatorfladen afgiver ikke sin varme. Kondenseringstrykket stiger, og kompressoren '
      + 'skal bruge mere strøm for den samme køling. Merforbruget vokser med udetemperaturen, fordi '
      + 'kondensatoren har sværest ved at komme af med varmen, når det er varmt — og det er netop det '
      + 'mønster, der er målt her.',
    tjek: [
      'Se på kondensatorfladen. Fem minutter med en lygte afgør sagen i de fleste tilfælde — fnug, blade, fedt fra udsug, eller noget stillet op foran.',
      'Kontrollér at alle kondensatorventilatorer kører, og at ingen står baglæns.',
      'Mål kondenseringstrykket og sammenhold med udetemperaturen. Et løft på mere end 8–10 K over omgivelserne peger på fladen.',
      'Rens fladen, og aflæs forbruget igen efter en uge — det er samtidig prøven på, om diagnosen holdt.',
    ],
    typiskFund: 'En flade, der er sandet til. Rensningen tager en formiddag og tjener sig typisk hjem på under en måned.',
    grundlag: 'Den hyppigste enkeltårsag til snigende merforbrug på et køleanlæg. Prioriteret højest, fordi den både er almindelig og billig at udelukke.',
  },
  {
    id: 'afrimning_haenger', navn: 'Afrimningen afsluttes ikke korrekt',
    faggrupper: ['koel_frys'], prior: 0.17, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret'] },
    forklaring: 'Et afrimningsvarmelegeme, der ikke slukker, eller en afrimning der afsluttes på tid i '
      + 'stedet for på temperatur, lægger det samme antal kWh oven i døgnet — uanset vejret. Det er '
      + 'netop fraværet af vejrafhængighed, der peger herpå: et merforbrug, der er lige stort i frost '
      + 'og i sommervarme, kommer ikke fra kølearbejdet selv.',
    tjek: [
      'Aflæs afrimningsindstillingen: hyppighed, varighed, og om afrimningen afsluttes på temperatur eller på tid.',
      'Kontrollér afrimningsføleren — en føler, der er faldet af fordamperen, afslutter aldrig afrimningen.',
      'Se efter rim på fordamperen umiddelbart efter en afrimning. Er der rim tilbage, er afrimningen for kort; er fladen varm længe efter, er den for lang.',
      'Mål strømmen på afrimningskredsen mellem to afrimninger. Er der forbrug dér, står varmelegemet og koger.',
    ],
    typiskFund: 'En afrimning, der kører på tid, eller en løs føler. Rettes i styringen samme dag.',
    grundlag: 'Underdiagnosticeret, fordi den ikke udløser nogen alarm — anlægget holder sin temperatur, det koster bare mere.',
  },
  {
    id: 'koelemiddel_laekage', navn: 'Kølemiddelmangel — sandsynlig lækage',
    faggrupper: ['koel_frys', 'koeleflader'], prior: 0.13, klasse: 'besparelse', hastende: true,
    signatur: { form: ['glidende'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret', 'brudt'] },
    forklaring: 'Anlægget mangler kølemiddel og holder temperaturen ved at køre længere ad gangen. '
      + 'Forbruget kryber op over uger uden at springe, og uden at følge vejret — det er driftstiden, '
      + 'der vokser, ikke belastningen. Ubehandlet ender det med et anlæg, der ikke kan holde '
      + 'temperaturen, og med varer i fare.',
    tjek: [
      'Aflæs skueglas og overhedning. Bobler i skueglasset ved fuld last er svar nok.',
      'Lækagesøg på de sædvanlige steder: samlinger ved kompressor, ventiler og fordamperbøjninger.',
      'Kontrollér, hvornår anlægget sidst blev fyldt. Er det fyldt før, er det den samme lækage igen — og så skal den findes, ikke fyldes.',
      'Husk lovpligtig lækagekontrol og logføring af påfyldt mængde.',
    ],
    typiskFund: 'En utæt samling. Påfyldning uden lækagesøgning er symptombehandling og kommer igen.',
    grundlag: 'Glidende og vejruafhængig — det er den kombination, der adskiller den fra kondensatorsagen.',
  },
  {
    id: 'kompressor_nedbrud', navn: 'Anlægget står — kompressorsvigt',
    direkte: true,
    faggrupper: ['koel_frys', 'koeleflader'], prior: 0.06, klasse: 'ingen', hastende: true,
    signatur: { form: ['spring', 'nul'], retning: 'ned', vejrrespons: ['brudt'], restniveau: [0.02, 0.35] },
    forklaring: 'Forbruget er faldet til det, styring og ventilatorer trækker, og anlægget reagerer ikke '
      + 'længere på udetemperaturen. Det er ikke en besparelse — det er et anlæg, der ikke køler, og '
      + 'varer, der bliver varmere lige nu.',
    tjek: [
      'Kontrollér temperaturen i møbler og rum FØRST. Varerne er det, der haster — anlægget kan vente ti minutter.',
      'Aflæs alarmlog og driftsstatus på styringen.',
      'Kontrollér sikringer, motorværn og HP/LP-pressostater.',
      'Sæt nødkøling eller flytning af varer i gang, hvis temperaturen er på vej op.',
    ],
    typiskFund: 'En udløst sikring eller et havareret kompressortrin. Uanset hvad: varerne først.',
    grundlag: 'Sjælden, men den dyreste at overse. Derfor P1 uanset kroner — og aldrig bogført som en besparelse.',
    aldrigBesparelse: true,
  },
  {
    id: 'kompressor_delvist', navn: 'Ét kompressortrin ude af drift',
    faggrupper: ['koel_frys', 'koeleflader'], prior: 0.08, klasse: 'ingen', hastende: true,
    signatur: { form: ['spring'], retning: 'ned', vejrrespons: ['brudt', 'uændret'], restniveau: [0.70, 0.97] },
    forklaring: 'Forbruget er faldet en smule, og anlægget følger ikke længere udetemperaturen, som det '
      + 'plejede. Det er mønsteret for et anlæg, der har mistet et kompressortrin: det kan stadig køle, '
      + 'men det kan ikke køle mere, når det bliver varmt. På måleren ligner det en besparelse. Det er '
      + 'det modsatte — det er kapacitet, der er væk, og den mangler først for alvor på den varmeste dag.',
    tjek: [
      'Aflæs driftstimer og alarmhistorik pr. kompressortrin.',
      'Kontrollér motorværn og styring på det trin, der ikke kører.',
      'Sammenhold sugetryk med setpunkt på de varmeste døgn i perioden — kan anlægget nå ned?',
      'Kontrollér temperaturen i de møbler, der ligger yderst på anlægget.',
    ],
    typiskFund: 'Et udkoblet trin, ingen har opdaget, fordi temperaturen indtil videre holder.',
    grundlag: 'Den sværeste af dem alle, fordi den ser ud som en gevinst på enhver månedsrapport.',
    aldrigBesparelse: true,
  },
  {
    /* Ventilationens egen udgave af "anlægget står".
     *
     * Den skal være adskilt fra kompressorsvigtet, selv om signaturen på
     * måleren er den samme — et fald til standby. Årsagerne og tjeklisten er
     * nemlig helt forskellige, og den forkerte kombination var synlig med det
     * samme: et ventilationsaggregat fik en tjekliste, der begyndte med
     * "kontrollér temperaturen i møbler og rum, varerne først". Et
     * ventilationsaggregat har ingen varer. Det har til gengæld et lovkrav om
     * luftskifte, og det er dét, der haster, når det står. */
    id: 'ventilation_stoppet', navn: 'Aggregatet står',
    direkte: true,
    faggrupper: ['ventilation'], prior: 0.10, klasse: 'ingen', hastende: true,
    signatur: { form: ['spring', 'nul'], retning: 'ned', restniveau: [0.02, 0.35] },
    forklaring: 'Forbruget er faldet til det, styring og spjæld trækker. Aggregatet flytter ikke luft. '
      + 'Det er ikke en besparelse: butikken mister sit luftskifte, og i afdelinger med proces — bageri, '
      + 'slagter, opvask — mærkes det på både indeklima og fugt inden for et døgn.',
    tjek: [
      'Kontrollér driftstilstand på aggregatet: er det stoppet af en fejl, eller er det slukket i hånden?',
      'Aflæs alarmlog: motorværn, remvagt, filtervagt, frostsikring. Frostsikring er den hyppigste — og den er en styringssag, ikke en motorsag.',
      'Kontrollér remme og motorlejer på begge ventilatorer.',
      'Er butikken lukket ned i en afdeling med proceskøkken, så meld tilbage med det samme — luftskiftet er et arbejdsmiljøkrav, ikke en komfortsag.',
    ],
    typiskFund: 'En udløst frostsikring eller et motorværn. Ofte en styring, der har slået fra og aldrig er kvitteret.',
    grundlag: 'Adskilt fra kompressorsvigtet, fordi signaturen er den samme og reparationen en helt anden.',
    aldrigBesparelse: true,
  },
  {
    id: 'setpunkt_aendret', navn: 'Setpunkt eller driftstid ændret',
    faggrupper: ['koel_frys', 'koeleflader', 'ventilation', 'cts', 'varme_fjern', 'varme_el'], prior: 0.11, klasse: 'potentiale', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret'] },
    forklaring: 'Forbruget flyttede sig til et nyt niveau fra den ene dag til den anden og er blevet der, '
      + 'uden at vejret ændrede sig. Det er mønsteret for en indstilling, nogen har ændret — et setpunkt, '
      + 'en driftstid, en override. Det er ikke nødvendigvis en fejl: der kan have været en god grund. '
      + 'Men er grunden midlertidig, og indstillingen blevet stående, er det penge, der løber hver dag.',
    tjek: [
      'Slå op i styringen, hvornår setpunktet sidst blev ændret, og af hvem.',
      'Spørg butikken, om der var en anledning — en klage, en varegruppe, en ombygning.',
      'Afgør om anledningen stadig gælder. Gør den ikke, så sæt tilbage.',
      'Er der en god grund til at blive: notér den, så den ikke bliver fundet igen om tre måneder.',
    ],
    typiskFund: 'En midlertidig ændring, der aldrig blev sat tilbage.',
    grundlag: 'Regnes som potentiale og ikke som besparelse: der kan være en gyldig driftsmæssig grund, og den skal høres først.',
  },
  {
    id: 'ombygning', navn: 'Ny kapacitet sat i drift',
    faggrupper: ['koel_frys', 'koeleflader', 'ventilation', 'lys_inde', 'produktion'], prior: 0.09, klasse: 'ingen', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'ja' },
    forklaring: 'Forbruget er steget til et nyt, varigt niveau, og stigningen følger vejret på samme måde '
      + 'som det oprindelige anlæg. Det er mønsteret for mere af det samme — flere kølemøbler, en ny '
      + 'sektion, udvidet areal. Det er ikke en fejl, men normalen er nu en anden, og den skal '
      + 'genberegnes, ellers vil anlægget stå som afvigende resten af året.',
    tjek: [
      'Bekræft i Dalux, om der er lukket en ombygnings- eller idriftsættelsesopgave i butikken i perioden.',
      'Spørg butikken, om der er kommet nye møbler eller udstyr til.',
      'Er det bekræftet: nulstil normalen fra idriftsættelsesdatoen, så anlægget ikke bliver ved med at melde.',
    ],
    typiskFund: 'En ombygning, driften ikke var orienteret om.',
    grundlag: 'Vigtig at have med som kandidat — uden den bliver hver eneste ombygning til en falsk fejlmelding.',
  },
  {
    id: 'maaler_doed', navn: 'Måleren leverer ikke længere data',
    direkte: true,
    faggrupper: null, prior: 0.10, klasse: 'blindt', hastende: false,
    signatur: { form: ['nul'], retning: 'ned', restniveau: [0, 0.015] },
    forklaring: 'Målepunktet er holdt op med at tælle. Anlægget kører efter alt at dømme videre — det er '
      + 'målingen, der er væk, ikke forbruget. Det må aldrig bogføres som en besparelse, og så længe det '
      + 'står sådan, er anlægget usynligt for al overvågning.',
    tjek: [
      'Kontrollér om måleren fysisk sidder og tæller.',
      'Kontrollér dataopsamling og kommunikation til Enity.',
      'Sammenhold med hovedmåleren: er butikkens samlede forbrug uændret, kører anlægget stadig.',
    ],
    typiskFund: 'En afbrudt dataforbindelse, ikke en fejl på anlægget.',
    grundlag: 'Har sin egen diagnose, fordi forvekslingen med en besparelse er den dyreste, hubben kan lave.',
    aldrigBesparelse: true,
  },
  {
    id: 'ventilation_konstant_drift', navn: 'Ventilationen kører i konstant drift',
    faggrupper: ['ventilation', 'cts'], prior: 0.18, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret', 'brudt'] },
    forklaring: 'Aggregatet er gået fra at følge en tidsplan til at køre i fast drift — typisk en manuel '
      + 'override efter et servicebesøg eller en klage, som aldrig er sat tilbage. Forbruget springer til '
      + 'et nyt niveau og holder sig der uden at følge vejret eller ugerytmen.',
    tjek: [
      'Aflæs driftstilstand på aggregatet: automatik eller hånd?',
      'Sammenhold CTS-tidsplanen med butikkens faktiske åbningstider.',
      'Kontrollér om der ligger en override eller en forlænget drift, der aldrig udløber.',
    ],
    typiskFund: 'En override fra et servicebesøg.',
    grundlag: 'Den hyppigste ventilationssag, og den billigste at rette — den rettes i styringen.',
  },
  /* ---- Varme -------------------------------------------------------------
   * Kataloget dækkede længe kun køl og ventilation. Det betød, at et
   * varmeflademålerpunkt kun kunne få svarene "setpunkt ændret" eller "kan
   * ikke afgøres" — altså at agenten reelt ikke havde noget at sige om en
   * tredjedel af porteføljen. */
  {
    id: 'ventil_utaet', navn: 'Utæt eller hængende reguleringsventil',
    faggrupper: ['varme_fjern', 'varme_el'], prior: 0.22, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring', 'glidende'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret', 'brudt'] },
    forklaring: 'Varmeforbruget er steget uden at følge varmegraddagene. Det er mønsteret for en ventil, der '
      + 'ikke lukker helt: der løber varme igennem fladen året rundt, også når der ikke er brug for den. '
      + 'Den slags ses ikke i en månedsopgørelse om vinteren — den ses om sommeren, hvor der ikke burde '
      + 'være noget forbrug overhovedet.',
    tjek: [
      'Aflæs fremløbs- og returtemperatur over fladen på en dag, hvor der ikke kaldes på varme. Er der stadig afkøling, løber ventilen.',
      'Kontrollér ventilens motor og gang: sidder den fast, eller er den fejlmonteret, så den lukker mod trykket?',
      'Kontrollér, om der er sat en håndoverstyring på, som aldrig er sat tilbage.',
      'Sammenlign sommerforbruget med samme flade året før — en utæt ventil viser sig tydeligst uden for fyringssæsonen.',
    ],
    typiskFund: 'En ventil, der ikke lukker tæt, eller en motor, der er gået af sin gang.',
    grundlag: 'Den hyppigste varmefejl, der ikke opdages: anlægget virker jo — det varmer bare også, når det ikke skal.',
  },
  {
    id: 'veksler_daarlig_afkoeling', navn: 'Dårlig afkøling over veksleren',
    faggrupper: ['varme_fjern'], prior: 0.16, klasse: 'potentiale', hastende: false,
    signatur: { form: ['glidende'], retning: 'op', vejrafhaengig: 'ja', vejrrespons: ['forstærket'] },
    forklaring: 'Der skal mere fjernvarmevand igennem for at levere den samme varme. Det er mønsteret for en '
      + 'veksler, der er ved at kalke til, eller for en fremløbstemperatur, der er skruet op for at '
      + 'kompensere. Afkølingen er samtidig et afregningsforhold: dårlig afkøling koster et tillæg hos '
      + 'de fleste fjernvarmeselskaber, oven i den varme der bruges.',
    tjek: [
      'Aflæs afkølingen på fjernvarmemåleren og sammenhold med forsyningens krav.',
      'Kontrollér, om fremløbstemperaturen er skruet op for at dække over noget andet.',
      'Kontrollér veksleren for tilkalkning og shuntventilen for korrekt funktion.',
      'Indhent afregningen: er der allerede betalt afkølingstillæg, er sagen både en drifts- og en økonomisag.',
    ],
    typiskFund: 'En tilkalket veksler eller en shunt, der blander returvand ind.',
    grundlag: 'Regnet som potentiale, fordi gevinsten afhænger af forsyningens tarif og ikke kan regnes på kWh alene.',
  },

  /* Varme uden for sæsonen: den fejl, en månedsopgørelse om vinteren aldrig
   * viser, fordi den drukner i det rigtige forbrug. Om sommeren står den
   * alene. Stefan bad om varmemålerne 20. september; det her er den første
   * varmeårsag, der er skrevet til døgnsignaturen frem for til graddage. */
  {
    id: 'varme_uden_for_saeson', navn: 'Varmen kører uden for fyringssæsonen',
    faggrupper: ['varme_fjern', 'varme_el'], prior: 0.14, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring', 'glidende'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['brudt', 'uændret'] },
    forklaring: 'Varmeforbruget er steget, uden at udetemperaturen er faldet. Det er mønsteret for et anlæg, '
      + 'der ikke er sat i sommerdrift: en varmekurve, der ikke er slået fra, en natsænkning, der er '
      + 'taget ud, eller en varmeflade i ventilationen, der kalder på varme, mens kølefladen køler. '
      + 'Forbruget er lille i kWh, men det er hundrede procent spild.',
    tjek: [
      'Aflæs, om anlægget står i sommerdrift, og hvornår det sidst blev skiftet.',
      'Kontrollér udekompensering og setpunkt for fremløb: er varmekurven sat, så den kalder på varme ved 15–18 °C ude?',
      'Kontrollér i CTS, om varme- og køleflade i samme aggregat kan være åbne samtidig (dødbånd).',
      'Sammenlign med samme måned året før — kørte anlægget også dengang uden for sæsonen, er det en indstilling, ikke en fejl.',
    ],
    typiskFund: 'En varmekurve eller et sommerdriftsskift, der aldrig er sat, eller et dødbånd, der er for smalt.',
    grundlag: 'Ligger tæt på «utæt ventil» i signaturen; forskellen er, at ventilen viser sig ved konstant lille flow, mens sæsonfejlen følger de kølige nætter.',
  },

  /* ---- Vand ---------------------------------------------------------------
   * Vand er den enkleste af alle målere at læse: en butik har ikke et
   * grundforbrug om natten. Det, der løber mellem 01 og 05, er en lækage,
   * et toilet eller en køling med brugsvand — og alle tre er en opgave, ikke
   * en driftsbeslutning. Kataloget er skrevet uden at have set vanddata fra
   * porteføljen; dækningen er sat derefter (KATALOGDAEKNING.vand). */
  {
    id: 'vand_laekage', navn: 'Lækage i installation eller rør',
    faggrupper: ['vand'], prior: 0.30, klasse: 'besparelse', hastende: true,
    signatur: { form: ['spring', 'glidende'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret', 'brudt'] },
    forklaring: 'Vandforbruget er steget og bliver oppe, også på dage uden mere aktivitet i butikken. Et '
      + 'forbrug, der ikke følger åbningstiden, er vand, der løber af sig selv: et rør, en samling, en '
      + 'sikkerhedsventil på en varmtvandsbeholder eller en kølekreds med brugsvand. Det haster, fordi '
      + 'vand, der løber et sted, det ikke skal, ødelægger bygningen, før det ses på regningen.',
    tjek: [
      'Luk alle tapsteder efter lukketid og aflæs vandmåleren to gange med et kvarters mellemrum. Tæller den, løber der vand.',
      'Kontrollér sikkerhedsventilen på varmtvandsbeholderen — en åben ventil kan løbe i månedsvis uden at nogen ser det.',
      'Se efter fugt og misfarvning ved gulve, kældre og teknikrum, og lyt efter rislen ved stophanen om natten.',
      'Er der kvartersdata: natflowet mellem 01 og 05 er lækagens størrelse — den er konstant, hvor et toilet er trinvist.',
    ],
    typiskFund: 'En sikkerhedsventil, der løber, eller et rør, der drypper et sted, hvor ingen kommer.',
    grundlag: 'Vand koster omkring 65 kr/m³ inkl. afledning; 1 m³ i timen året rundt er over en halv million kr.',
  },
  {
    id: 'toilet_loeber', navn: 'Toilet eller urinal løber',
    faggrupper: ['vand'], prior: 0.25, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret'] },
    forklaring: 'Forbruget sprang op fra den ene dag til den anden og har ligget der siden. Det er mønsteret '
      + 'for en cisterne, der ikke lukker, eller et urinal, der skyller i ét: et fast tillæg døgnet rundt, '
      + 'uden sammenhæng med kunder eller vejr. Det er den billigste vandfejl at finde og den hyppigste.',
    tjek: [
      'Gå toiletterne igennem — personale, kunder, bageri — og lyt. En løbende cisterne kan høres.',
      'Kontrollér urinaler med tidsstyret skyl: står skyllet på hele natten?',
      'Aflæs måleren efter lukketid: et toilet giver 50–200 liter i timen, en lækage typisk mere og helt jævnt.',
    ],
    typiskFund: 'En cisterne med slidt flyder eller pakning.',
    grundlag: 'Et løbende toilet er 400–1.500 m³ om året — 25.000 til 100.000 kr.',
  },
  {
    id: 'koelevand_spild', navn: 'Køling med brugsvand',
    faggrupper: ['vand'], prior: 0.10, klasse: 'besparelse', hastende: false,
    signatur: { form: ['glidende', 'spring'], retning: 'op', vejrafhaengig: 'ja', vejrrespons: ['forstærket', 'uændret'] },
    forklaring: 'Vandforbruget stiger med varmen udenfor. Vand, der følger udetemperaturen, er vand, der '
      + 'bruges til at køle: en kondensator eller en kompressor med gennemstrømskøling på brugsvand, '
      + 'eller en nødkøling, der er blevet permanent. Det er dyrt vand — og det ses i Dalux som '
      + '«Vandspild – køling af anlæg», så det er set før.',
    tjek: [
      'Find kølekredsen: er der en vandtilslutning på køleanlæg, kompressor eller ismaskine, som løber til afløb?',
      'Kontrollér, om en midlertidig køling er sat op efter et nedbrud og aldrig taget ned igen.',
      'Sammenhold med udetemperaturen: stiger forbruget på varme dage, er det køling.',
    ],
    typiskFund: 'En gennemstrømskølet kompressor eller ismaskine på brugsvand.',
    grundlag: 'Sat lavt som prior, fordi de fleste anlæg er luftkølede; hvor det findes, er det stort.',
  },
  {
    id: 'vand_drift_aendret', navn: 'Vanding, rengøring eller produktion ændret',
    faggrupper: ['vand'], prior: 0.12, klasse: 'potentiale', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['uændret'] },
    forklaring: 'Forbruget flyttede sig til et nyt niveau og er blevet der. Det kan være en fejl — men det '
      + 'kan lige så godt være, at bageriet er begyndt at producere mere, at der er sat vanding op, '
      + 'eller at rengøringen er lagt om. Det er butikkens svar, der afgør det, ikke måleren.',
    tjek: [
      'Spørg butikken: er der sket noget i produktion, rengøring eller udenomsarealer på datoen?',
      'Kontrollér, om en vandingsautomatik står på hele døgnet.',
    ],
    typiskFund: 'En ændret drift, som er bevidst — eller en automatik, der ikke er.',
    grundlag: 'Regnet som potentiale: der kan være en driftsmæssig grund, og den skal høres først.',
  },

  {
    id: 'genvinding_bortkoeles', navn: 'Overskudsvarmen bliver ikke genvundet',
    faggrupper: ['overskudsvarme'], prior: 0.28, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring', 'glidende'], retning: 'ned', vejrrespons: ['brudt', 'uændret'] },
    forklaring: 'Den genvundne varme er faldet, uden at køleanlægget har lavet mindre. Varmen bliver altså '
      + 'stadig produceret — den bliver bare blæst ud over taget i stedet for at gå ind i bygningen. '
      + 'Det er dobbelt spild: varmen går tabt, og fjernvarmen køber det samme igen. Det er også den '
      + 'slags fejl, ingen melder, fordi butikken ikke mærker noget som helst.',
    tjek: [
      'Kontrollér, om varmegenvindingen overhovedet er sat i drift, eller om anlægget står i bypass.',
      'Aflæs styringens prioritering: kalder bygningen på fjernvarme, før den har brugt den genvundne varme?',
      'Kontrollér trevejsventilen mellem genvinding og tørkøler — hænger den mod tørkøleren, ryger varmen ud.',
      'Sammenhold med køleanlæggets forbrug i samme periode: er kølingen uændret, er varmen der stadig.',
    ],
    typiskFund: 'En styring, der er sat i bypass under et servicebesøg, eller en prioritering, der aldrig blev sat rigtigt op.',
    grundlag: 'Overskudsvarme er det eneste sted i porteføljen, hvor et FALD i et målepunkt er en ren tabt gevinst.',
  },

  /* ---- Belysning ---------------------------------------------------------- */
  {
    id: 'dagslysstyring_defekt', navn: 'Skumringsrelæ eller dagslysstyring virker ikke',
    faggrupper: ['lys_ude', 'lys_inde'], prior: 0.30, klasse: 'besparelse', hastende: false,
    signatur: { form: ['spring'], retning: 'op', vejrafhaengig: 'nej', vejrrespons: ['brudt'] },
    forklaring: 'Belysningen fulgte dagslyset og gør det ikke længere — forbruget er det samme, uanset hvor '
      + 'lyst der er udenfor. Det er mønsteret for et skumringsrelæ, der er brændt sammen, en føler, der '
      + 'er dækket til, eller en styring, der er sat i konstant drift. Udendørs belysning, der brænder '
      + 'om dagen, er samtidig det, kunderne lægger mærke til.',
    tjek: [
      'Kør forbi om formiddagen og se efter. Det er hurtigere end nogen måling.',
      'Kontrollér skumringsrelæets føler: dækket til, malet over, vendt forkert, eller peger den ind mod en lyskilde?',
      'Kontrollér om der er sat en håndoverstyring på tavlen.',
      'Aflæs det indstillede lux-niveau — er det sat så højt, at relæet aldrig slår fra?',
    ],
    typiskFund: 'En tilsmudset eller forkert placeret føler. Sjældnere relæet selv.',
    grundlag: 'Den hyppigste belysningsfejl og den billigste at rette — men usynlig for alle, der kun ser på en månedsopgørelse.',
  },

  /* ---- Solceller ---------------------------------------------------------- */
  {
    id: 'inverter_ude', navn: 'En inverter eller streng er ude af drift',
    direkte: true,
    faggrupper: ['solceller'], prior: 0.24, klasse: 'ingen', hastende: true,
    signatur: { form: ['spring'], retning: 'ned', vejrrespons: ['brudt', 'uændret'] },
    forklaring: 'Produktionen faldt fra den ene dag til den anden og fulgte ikke et fald i indstrålingen. '
      + 'Det er mønsteret for en inverter eller en streng, der er koblet ud. Anlægget producerer stadig — '
      + 'bare mindre — og derfor udløser det sjældent nogen alarm, nogen ser. Hver dag, det står, er '
      + 'produktion, der ikke kommer igen.',
    tjek: [
      'Aflæs produktionen pr. inverter og pr. streng i overvågningsportalen. Den, der er ude, står som nul.',
      'Kontrollér fejlkoder på den pågældende inverter og om den har forsøgt genstart.',
      'Kontrollér DC-sikringer og afbrydere på strengen.',
      'Notér datoen: tabt produktion frem til reparationen er et krav mod leverandøren, hvis anlægget er i garanti eller under driftsaftale.',
    ],
    typiskFund: 'En inverter i fejl, som ingen har fået besked om.',
    grundlag: 'Aldrig en besparelse: et fald i forbrug fra et produktionsanlæg er tabt indtægt.',
    aldrigBesparelse: true,
  },
  {
    id: 'sol_snavs_eller_skygge', navn: 'Snavs, skygge eller begroning på modulerne',
    faggrupper: ['solceller'], prior: 0.18, klasse: 'potentiale', hastende: false,
    signatur: { form: ['glidende'], retning: 'ned', vejrrespons: ['uændret'] },
    forklaring: 'Produktionen er gledet nedad i forhold til indstrålingen, uden at noget er faldet ud. Det er '
      + 'mønsteret for moduler, der gradvist bliver dækket til — støv, pollen, fugleklatter, mos, eller '
      + 'bevoksning, der er vokset op i det sydvestlige hjørne siden sidste sommer.',
    tjek: [
      'Se på anlægget, eller få et billede. Begroning og skygge kan ses fra jorden.',
      'Sammenhold ydelsen pr. streng: skygge rammer typisk én streng, snavs rammer alle.',
      'Vurdér om rensning kan svare sig — det afhænger af tabet og af, hvor let taget er at komme til.',
      'Er det bevoksning på nabogrunden, er det en sag, der skal tages nu, ikke når den er vokset færdig.',
    ],
    typiskFund: 'Almindeligt snavs eller en hæk, der er vokset. Sjældnere modulfejl.',
    grundlag: 'Regnet som potentiale: gevinsten ved rensning afhænger af, hvor hurtigt snavset kommer igen.',
  },

  {
    id: 'indstilling_falder_tilbage', navn: 'Indstillingen er sat før og holder ikke',
    faggrupper: ['ventilation', 'cts', 'koeleflader', 'koel_frys', 'varme_el', 'lys_inde'],
    prior: 0.05, klasse: 'besparelse', hastende: false,
    signatur: {},
    forklaring: 'Det samme mønster er meldt og rettet på dette anlæg før, og det er tilbage. Så indstillingen '
      + 'ER sat, og den holdt ikke. Det, der skal findes, er derfor ikke hvilken indstilling der mangler — '
      + 'det er hvad der nulstiller den. Sættes den bare igen, bestilles den samme opgave en tredje gang.',
    tjek: [
      'Læs den gamle opgave først. Hvad blev der præcist gjort, og af hvem?',
      'Står anlægget i håndstilling på panelet? Det er den hyppigste: sat i hånd under service, aldrig sat tilbage.',
      'Er CTS\'en opdateret eller udskiftet siden? En opdatering kan skrive tidsprogrammet tilbage til fabrik.',
      'Har der været strømsvigt? Nogle automatikker genskaber fabriksindstilling og ikke sidste indstilling.',
      'Sammenhold med sommer-/vintertidsskiftet — et ur, der ikke følger med, flytter hele programmet en time.',
      'Skriv i opgaven, hvordan indstillingen sikres mod at falde tilbage. Ellers er vi her igen om to år.',
    ],
    typiskFund: 'Oftest håndstilling efter service, eller en automatik der er nulstillet uden at nogen så det.',
    grundlag: 'Fundet i data: en opgave fra 2019 om netop dette blev lukket som udført, og mønstret er tilbage på '
      + 'de samme målere. Uden den historik ville diagnosen have været "der er aldrig sat et program", og '
      + 'handlingen ville have været at sætte et — altså den samme rettelse, der allerede er bevist ikke at holde.',
  },

  {
    id: 'ukendt', navn: 'Årsagen kan ikke afgøres på de data, vi har',
    faggrupper: null, prior: 0.12, klasse: 'potentiale', hastende: false,
    signatur: {},
    forklaring: 'Afvigelsen er reel, men dens form passer ikke entydigt på nogen af de kendte årsager — '
      + 'eller også mangler der data til at skille kandidaterne ad. Det er et ærligt svar og et bedre '
      + 'udgangspunkt for et servicebesøg end en diagnose, der lyder sikker og ikke er det.',
    tjek: [
      'Aflæs bimålerne i butikken og afgør, hvilken gruppe afvigelsen ligger i.',
      'Slå op i Dalux, om der er lukket opgaver på anlægget i perioden.',
      'Spørg butikken, om noget har ændret sig i drift, åbningstid eller udstyr.',
    ],
    typiskFund: 'Oftest en forklaring i driften, som ingen har skrevet ned.',
    grundlag: 'Sikkerhedsnettet. Uden den ville motoren tvinges til at vælge den næstbedste diagnose, også når ingen passer.',
  },
];

export const AARSAG = Object.fromEntries(AARSAGER.map((a) => [a.id, a]));

/* ---- Målere, der ikke kan bære en komponentdiagnose ------------------------
 *
 * En forsyningsmåler er en SUM. Ændrer den sig, er ændringen lige så virkelig
 * som på enhver anden måler — men den kan ikke henføres til en komponent, for
 * måleren dækker dem alle. Det samme gælder en intern hovedmåler og en
 * lejermåler, hvor forbruget slet ikke er vores.
 *
 * Det stod ikke i motoren før, og det gav to forkerte svar i kørslen på de
 * rigtige tal: "El forsyningsmåler 2" og "El total" fik begge stillet en
 * diagnose om henholdsvis en tilsmudset kondensator og manglende
 * varmegenvinding. Grunden var, at en ukendt faggruppe var det MEST
 * tilladelige, motoren kendte: uden faggruppe blev ingen årsager sorteret
 * fra, og så vandt den, der tilfældigvis passede bedst på formen.
 *
 * Det er vendt om her. Kan måleren ikke bære en diagnose, siges det — og
 * svaret er stadig brugbart, for en sum, der flytter sig, er netop dét, der
 * skal brydes ned på bimålerne.
 */
export const IKKE_DIAGNOSTICERBAR = {
  forsyning: {
    id: 'sum_flytter_sig', navn: 'Afvigelse på en samlemåler — skal brydes ned',
    klasse: 'blindt', hastende: false,
    forklaring: 'Måleren er en forsyningsmåler og dækker hele butikken. Afvigelsen er reel, men den kan '
      + 'ikke henføres til et anlæg, for måleren ser dem alle på én gang. Den skal findes på bimålerne, '
      + 'før nogen sendes ud.',
    tjek: [
      'Læg butikkens bimålere sammen for samme periode og se, hvor forskellen ligger.',
      'Er summen af bimålerne uændret, sidder ændringen i noget umålt — eller i afregningen.',
      'Tjek om en lejermåler eller et solcelleanlæg er faldet ud; begge slår igennem på forsyningen.',
    ],
    grundlag: 'Ikke en diagnose, men en afvisning af at stille en. En samlemåler kan ikke pege på en komponent.',
  },
  hovedmaaler_intern: null, // samme svar som forsyning; sættes nedenfor
  lejer: {
    id: 'lejerforbrug', navn: 'Lejerforbrug — ikke vores anlæg',
    klasse: 'ingen', hastende: false,
    forklaring: 'Måleren dækker et lejemål. Forbruget er lejerens eget, og en ændring er ikke en driftsfejl '
      + 'hos os. Den skal kun følges, hvis den har betydning for afregningen.',
    tjek: [
      'Kontrollér at forbruget afregnes videre til lejeren.',
      'Er der tale om et tomt lejemål, bør forbruget være faldet, ikke steget.',
    ],
    grundlag: 'Afgrænsning. Uden den ender lejerens fejl i vores opgavekø.',
  },
  ukendt_faggruppe: {
    id: 'mangler_klassifikation', navn: 'Måleren mangler klassifikation',
    klasse: 'blindt', hastende: false,
    forklaring: 'Måleren er ikke tagget godt nok til, at vi ved, hvad den sidder på. Afvigelsen er målt, '
      + 'men uden at vide om det er køl, ventilation eller lys, kan der ikke stilles en diagnose — og et '
      + 'gæt ville lyde lige så sikkert som en rigtig.',
    tjek: [
      'Find måleren i Enity og sæt det rigtige L2- eller L4-tag på.',
      'Er tavlen blandet, skal den enten deles op eller tagges som blandet, så den holdes ude af analysen.',
    ],
    grundlag: 'Det er billigere at tagge en måler end at sende en montør ud på en gætteri-diagnose.',
  },
};
IKKE_DIAGNOSTICERBAR.hovedmaaler_intern = IKKE_DIAGNOSTICERBAR.forsyning;
/* ---- 3 · Afvejningen ·------------------------------------------------------ */

/* Hvor meget et bevis rykker. Udtrykt i log-odds, så de kan lægges sammen.
 * Tallene er sat, så ét stærkt bevis kan løfte en kandidat forbi en anden med
 * dobbelt så høj prior — men så to svage beviser ikke kan. */
const VÆGT = { staerk: 1.4, middel: 0.8, svag: 0.4 };

/* ---- Når to instrumenter ser det samme ------------------------------------
 *
 * Døgnmodellen og kvartersdetektoren måler ikke det samme. Døgnmodellen ser
 * et anlæg, der bruger mere end vejret kan forklare. Kvartersdetektoren ser
 * et anlæg, der kører lige så mange timer lørdag som onsdag. Det er to
 * forskellige spor efter én og samme ting: en tidsplan, ingen har sat.
 *
 * Rammer de den SAMME måler hver for sig, er det et stærkt bevis — stærkere
 * end noget enkelt tal i signaturen, for de to metoder deler hverken model,
 * periode eller fejlkilder. Det skete på rigtige data: 05020 564597
 * Ventilation Slagter ligger 166 % over sin normal i døgnmodellen OG kører
 * 2.715 kWh weekenddrift uden nedsættelse. Samme anlæg, to instrumenter.
 *
 * Bekræftelsen gør to ting. Den lægger vægt på den årsag, detektoren peger
 * på — og den fjerner forbeholdet om manglende timedata, for dem har vi så. */
export const KVARTERSBEKRAEFTELSE = {
  /* `indstilling_falder_tilbage` står med i begge de to første, og det er
   * ikke en detalje. Weekenddrift og natforbrug er OBSERVATIONER — de siger,
   * at anlægget kører uden for tiden, ikke hvorfor. En indstilling, der er
   * faldet tilbage, giver nøjagtig det samme billede som en, der aldrig blev
   * sat. Uden den linje trak bekræftelsen FRA på tilbagefaldet, og så kunne
   * historikken aldrig vinde over den forklaring, den modbeviser. */
  weekenddrift:   { aarsager: ['ventilation_konstant_drift', 'setpunkt_aendret', 'indstilling_falder_tilbage'],
                    tekst: 'Kvartersdata viser samme driftstimer i weekenden som på hverdage i et område uden weekendaktivitet.' },
  natforbrug:     { aarsager: ['dagslysstyring_defekt', 'setpunkt_aendret', 'indstilling_falder_tilbage'],
                    tekst: 'Kvartersdata viser, at anlægget ikke slukker om natten.' },
  afrimning:      { aarsager: ['afrimning_haenger'],
                    tekst: 'Kvartersdata viser afrimninger, der ikke afsluttes.' },
  kortcykling:    { aarsager: ['kompressor_delvist', 'koelemiddel_laekage'],
                    tekst: 'Kvartersdata viser kortcykling — kompressoren starter og stopper for tit.' },
  /* Vand: natflowet kl. 01–05 som andel af døgnets flow, regnet af Lovable på
   * kvartersdata. Nul er tæt. Over 0,3 er vand, der løber, mens butikken er
   * lukket — og det er de tre første årsager, ikke en ændret drift. */
  natflow:        { aarsager: ['vand_laekage', 'toilet_loeber', 'koelevand_spild'],
                    tekst: 'Kvartersdata viser et konstant natflow kl. 01–05 — vand, der løber, mens butikken er lukket.' },
  samtidig_koel_varme: { aarsager: ['genvinding_bortkoeles', 'ventil_utaet'],
                    tekst: 'Kvartersdata viser køl og varme over deres eget normalniveau på samme time.' },
};

/* Hvor stor en del af de fejl, der faktisk sker i en faggruppe, kataloget
 * dækker. Det er et skøn, og det skal være et skøn: det første forsøg brugte
 * antallet af årsager på listen, og det gav den modsatte rangorden af den
 * rigtige — lys fik 84 % og en køleflade 29 % på nøjagtig samme signatur,
 * alene fordi der står færre årsager under lys.
 *
 * Længden af listen siger ikke, hvor færdig den er. Solceller har fire
 * årsager og er nogenlunde udtømmende, for et solcelleanlæg kan ikke fejle på
 * ret mange måder. Lys har fire og dækker meget lidt: en lysgruppe kan ændre
 * sig, fordi et armatur er skiftet, fordi en sensor er klistret til, fordi
 * nogen har sat en timer om, eller fordi butikken har flyttet en afdeling.
 *
 * Tallene her er sat af os og kan diskuteres. Det er meningen. De skal
 * revideres, når tilbagemeldingerne fra lukkede opgaver viser, hvor tit
 * "ingen af de kendte årsager" bliver svaret. */
export const KATALOGDAEKNING = {
  koel_frys:      0.85,  // gennemarbejdet grundigst; scenarierne er bygget her
  koeleflader:    0.80,
  ventilation:    0.75,
  solceller:      0.70,  // få fejlmåder, og de er kendte
  varme_fjern:    0.65,
  varme_el:       0.60,
  lys_ude:        0.55,
  overskudsvarme: 0.55,
  lys_inde:       0.50,  // mange måder at ændre en lysgruppe på, som vi ikke kender
  cts:            0.40,
  vand:           0.60,  // få fejlmåder — lækage, toilet, køling med brugsvand — men vi har ikke set dem i data endnu
  produktion:     0.35,  // ovne, friture, kipstegere — vi har næsten intet her
};
const DAEKNING_UKENDT = 0.45;

/* Hvornår et udslag er stort nok til at stå alene, og hvor langt konfidensen
 * må falde, når det ikke er. Gulvet er der, fordi en lille afvigelse på et
 * stort anlæg stadig er mange kroner og skal kunne komme igennem. */
const TYDELIGT_UDSLAG = 20;
const SVAGT_UDSLAG_GULV = 0.45;

const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/**
 * Stiller diagnosen: rangordner årsagerne efter, hvor godt de passer på det målte.
 *
 * Returnerer altid mindst én kandidat — og hellere "kan ikke afgøres" end en
 * diagnose, tallene ikke bærer.
 */
export function diagnosticer(signatur, { faggruppe, maalerrolle = null, kobling, historik = null, gentagneOpgaver = 0, priors = null } = {}) {
  if (!signatur || !signatur.brugbar) {
    return { brugbar: false, grund: signatur?.grund || 'Ingen signatur at gå ud fra.' };
  }

  /* Først: kan denne måler overhovedet bære en diagnose? Spørgsmålet skal
   * stilles før rangordningen, ikke efter — ellers findes der altid en årsag,
   * der passer på formen, og den bliver præsenteret som et fund. */
  const spaerre = IKKE_DIAGNOSTICERBAR[maalerrolle]
    || (!faggruppe ? IKKE_DIAGNOSTICERBAR.ukendt_faggruppe : null);
  if (spaerre) {
    const bedste = { ...spaerre, faggrupper: null, prior: null, andel: 1, score: 0, sandsynlighed: 1, beviser: [
      { for: true, vaegt: 'stærk', tekst: `Afvigelsen er målt til ${signatur.afvigPct} % af det forventede. ${spaerre.navn}.` },
    ] };
    return {
      brugbar: true, diagnoserbar: false,
      bedste, naest: null, margin: 1, konfidens: null, entydig: true,
      rangeret: [bedste],
      forbehold: [spaerre.forklaring],
    };
  }

  const kandidater = AARSAGER
    .filter((a) => !a.faggrupper || !faggruppe || a.faggrupper.includes(faggruppe))
    .map((a) => {
      const beviser = [];
      /* Udgangspunktet er, hvor almindelig årsagen er i denne faggruppe. Har
       * lukkede opgaver lært os noget andet end fagfolks udgangspunkt, er det
       * dét tal, der bruges — se agent.justeredePriors. */
      const prior = Math.max(0.01, Math.min(0.85, priors?.[a.id] ?? a.prior));
      let score = logit(prior);

      const s = a.signatur || {};

      // Form: spring, glidende, fald eller nul.
      if (s.form) {
        if (s.form.includes(signatur.form)) {
          score += VÆGT.middel;
          beviser.push({ for: true, vaegt: 'middel', tekst: `Afvigelsen er ${formOrd(signatur.form)}, som forventet for denne årsag.` });
        } else {
          score -= VÆGT.staerk;
          beviser.push({ for: false, vaegt: 'stærk', tekst: `Afvigelsen er ${formOrd(signatur.form)}; denne årsag giver ${s.form.map(formOrd).join(' eller ')}.` });
        }
      }

      // Retning: op eller ned. Et fald og en stigning er aldrig den samme fejl.
      if (s.retning) {
        if (s.retning === signatur.retning) {
          score += VÆGT.middel;
          beviser.push({ for: true, vaegt: 'middel', tekst: `Forbruget går ${signatur.retning === 'op' ? 'op' : 'ned'}, som denne årsag giver.` });
        } else {
          score -= VÆGT.staerk * 1.6;
          beviser.push({ for: false, vaegt: 'stærk', tekst: `Forbruget går ${signatur.retning === 'op' ? 'op' : 'ned'}; denne årsag giver det modsatte.` });
        }
      }

      /* Vejrafhængigheden. Det tungeste bevis, fordi det er det eneste, der
       * kan skille to ellers identiske stigninger fra hinanden. */
      if (s.vejrafhaengig && signatur.vejrafhaengig !== 'ukendt') {
        if (s.vejrafhaengig === signatur.vejrafhaengig) {
          score += VÆGT.staerk;
          beviser.push({ for: true, vaegt: 'stærk', tekst: signatur.vejrafhaengig === 'ja'
            ? `Merforbruget vokser med udetemperaturen (${Math.round(signatur.vejrkobling.udslag)} kWh/døgn hen over et typisk temperaturudsving) — det peger på kølearbejdet selv.`
            : 'Merforbruget er det samme uanset vejret — det peger på en konstant last, ikke på kølearbejdet.' });
        } else {
          score -= VÆGT.staerk;
          beviser.push({ for: false, vaegt: 'stærk', tekst: signatur.vejrafhaengig === 'ja'
            ? 'Merforbruget følger udetemperaturen; denne årsag ville give en last, der er den samme året rundt.'
            : 'Merforbruget er vejruafhængigt; denne årsag ville give en effekt, der vokser med varmen.' });
        }
      }

      // Ændrede anlæggets vejrfølsomhed sig? Et brud peger på tabt kapacitet.
      if (s.vejrrespons && signatur.vejrrespons !== 'ukendt') {
        if (s.vejrrespons.includes(signatur.vejrrespons)) {
          score += VÆGT.middel;
          beviser.push({ for: true, vaegt: 'middel', tekst: vejrresponsOrd(signatur) });
        } else {
          score -= VÆGT.middel;
          beviser.push({ for: false, vaegt: 'middel', tekst: `${vejrresponsOrd(signatur)} Det passer ikke på denne årsag.` });
        }
      }

      /* Historikken på anlægget. Den vejer stærkt, for den siger noget, ingen
       * måling kan: om det her er set før, og hvad der skete med det.
       *
       * Og uden historik findes tilbagefaldet ikke. Årsagen "sat før og
       * holder ikke" må ikke kunne vinde på en kvartersbekræftelse alene —
       * den gjorde det 32 gange i køl/frys på hele porteføljen, uden én
       * eneste gammel opgave bag sig. */
      if (a.id === 'indstilling_falder_tilbage' && !historik?.tilbagefald) {
        score -= VÆGT.staerk * 3;
        beviser.push({ for: false, vaegt: 'stærk', tekst: 'Der er ingen tidligere rettelse på anlægget i Dalux, så der er ikke noget at falde tilbage fra.' });
      }
      if (historik?.tilbagefald) {
        if (a.id === 'indstilling_falder_tilbage') {
          score += VÆGT.staerk * 1.5;
          beviser.push({ for: true, vaegt: 'stærk', tekst: historik.tekst });
        } else if (a.id === 'setpunkt_aendret' || a.id === 'ventilation_konstant_drift') {
          /* De to er stadig en rigtig beskrivelse af tilstanden — men de
           * fører til den rettelse, der allerede er prøvet. */
          score -= VÆGT.middel;
          beviser.push({ for: false, vaegt: 'middel', tekst: 'Den rettelse er lavet før på dette anlæg og holdt ikke.' });
        }
      } else if (historik?.afvistTidligere && a.id === 'ukendt') {
        score -= VÆGT.svag;
        beviser.push({ for: false, vaegt: 'svag', tekst: 'Nogen har set det her før og beskrevet det — det er ikke uforklarligt.' });
      }

      /* Bekræftelse fra kvartersdata. Vejer stærkt, netop fordi den kommer
       * fra en anden måling end alt det andet i signaturen. */
      const bek = signatur.bekraeftelse ? KVARTERSBEKRAEFTELSE[signatur.bekraeftelse] : null;
      if (bek) {
        if (bek.aarsager.includes(a.id)) {
          score += VÆGT.staerk;
          beviser.push({ for: true, vaegt: 'stærk', tekst: `${bek.tekst} Det er set på den samme måler med et andet instrument end døgnmodellen.` });
        } else if (a.id !== 'ukendt') {
          score -= VÆGT.middel;
          beviser.push({ for: false, vaegt: 'middel', tekst: `${bek.tekst} Denne årsag ville ikke give det mønster.` });
        }
      }

      /* Samtidigheden med Dalux. Den vender hele sagen: er der udført
       * planlagt arbejde lige før, er ændringen sandsynligvis en følge af det. */
      if (kobling) {
        if (kobling.klasse === 'forklaret') {
          if (a.id === 'ombygning' || a.id === 'setpunkt_aendret') {
            score += VÆGT.staerk * 1.5;
            beviser.push({ for: true, vaegt: 'stærk', tekst: kobling.tekst });
          } else {
            score -= VÆGT.staerk;
            beviser.push({ for: false, vaegt: 'stærk', tekst: `${kobling.tekst} Så er en fejl på anlægget en mindre sandsynlig forklaring.` });
          }
        } else if (kobling.klasse === 'uledsaget' && a.id === 'ombygning') {
          /* En ombygning efterlader et spor. Der bestilles håndværkere, der
           * lukkes en idriftsættelsesopgave, butikken ved det. Er der intet i
           * Dalux overhovedet, er "ombygning" den dårligste af de forklaringer,
           * der passer på tallene — og uden den regel vinder den over enhver
           * snigende fejl, der ender på et nyt, stabilt niveau. */
          score -= VÆGT.staerk;
          beviser.push({ for: false, vaegt: 'stærk', tekst: 'Der er ingen opgave i Dalux på anlægget i perioden. En ombygning ville have efterladt mindst én.' });
        } else if (kobling.klasse === 'bekraeftet' || kobling.klasse === 'varsel') {
          /* En fejlmelding fra butikken siger, at NOGET er galt. Den siger
           * ikke HVAD, og derfor må den ikke lægges som en bonus på hver
           * eneste årsag.
           *
           * Første udgave gjorde netop det, og resultatet var bagvendt: da
           * butikken bekræftede fejlen på Ventilation Slagter, faldt
           * konfidensen fra 48 % til 41 %. Bonussen løftede både den bedste
           * og den næstbedste årsag, afstanden imellem dem blev mindre, og
           * konfidensen måler netop den afstand. En bekræftelse gjorde os
           * altså mere i tvivl.
           *
           * Et bevis, der rammer alle kandidater lige hårdt, indeholder
           * ingen oplysning om, hvilken af dem der er den rigtige. Det hører
           * derfor ikke til i afvejningen mellem årsagerne, men i loftet over
           * konfidensen — se `bekraeftetAfButik` nedenfor.
           *
           * Tilbage her står kun dét, der FAKTISK skiller årsagerne ad: en
           * fejlmelding taler imod en idriftsættelse. */
          if (a.id === 'ombygning') {
            score -= VÆGT.middel;
            beviser.push({ for: false, vaegt: 'middel', tekst: 'Opgaven i Dalux er en fejlmelding, ikke en idriftsættelse.' });
          } else if (a.id !== 'maaler_doed') {
            beviser.push({ for: true, vaegt: 'middel', tekst: kobling.tekst });
          }
        }
      }

      /* Hvor meget der stadig kører. Det tungeste bevis i de tre sager, hvor
       * forbruget FALDER — for det er det eneste, der skiller en død måler
       * (nul) fra et standset anlæg (styring og ventilatorer kører videre)
       * fra et tabt kompressortrin (næsten alt kører endnu). Uden det er alle
       * tre bare "forbruget faldt". */
      if (s.restniveau && signatur.restniveau != null) {
        const [lav, hoej] = s.restniveau;
        if (signatur.restniveau >= lav && signatur.restniveau <= hoej) {
          score += VÆGT.staerk;
          beviser.push({ for: true, vaegt: 'stærk', tekst: restniveauOrd(signatur.restniveau) });
        } else {
          score -= VÆGT.staerk;
          beviser.push({ for: false, vaegt: 'stærk', tekst: `${restniveauOrd(signatur.restniveau)} Denne årsag ville give ${Math.round(lav * 100)}–${Math.round(hoej * 100)} %.` });
        }
      }

      // Har anlægget meldt fejl mange gange før, er en udtjent komponent mere sandsynlig end en indstilling.
      if (gentagneOpgaver >= 3 && (a.id === 'koelemiddel_laekage' || a.id === 'kompressor_delvist')) {
        score += VÆGT.svag;
        beviser.push({ for: true, vaegt: 'svag', tekst: `Anlægget har ${gentagneOpgaver} opgaver i forvejen — en tilbagevendende fejl er mere sandsynlig end en enkeltstående.` });
      }

      return { ...a, prior, score, sandsynlighed: sigmoid(score), beviser };
    });

  // Normaliser til noget, der kan læses som procent.
  const sum = kandidater.reduce((x, k) => x + k.sandsynlighed, 0) || 1;
  const rangeret = kandidater
    .map((k) => ({ ...k, andel: k.sandsynlighed / sum }))
    .sort((a, b) => b.andel - a.andel);

  const bedste = rangeret[0];
  const naest = rangeret[1];
  /* Hvor sikkert står den bedste? Ikke dens egen sandsynlighed, men afstanden
   * ned til den næste. To kandidater på 30 % hver er ikke en diagnose. */
  const margin = naest ? bedste.andel - naest.andel : bedste.andel;

  let loft = 1;
  if (signatur.mangler.length) loft -= 0.12 * signatur.mangler.length;
  if (signatur.modelleret) loft -= 0.15;
  if (signatur.doegn < 21) loft -= 0.15;

  /* Andelen siger, hvor godt årsagen passer SAMMENLIGNET MED de andre på
   * listen. Konfidensen skal også tage højde for, at den rigtige forklaring
   * kan mangle på listen — og det afhænger af, hvor færdigt kataloget er i
   * netop den faggruppe. */
  /* Det gælder ikke de årsager, hvor signaturen ER fundet. En måler, der leverer
   * nul, er ikke ét bud blandt fire — den er en aflæsning. Kataloget kan være
   * nok så tyndt, uden at det gør den observation mere usikker. Uden den
   * undtagelse faldt "måleren leverer ikke længere data" på en måler med
   * restniveau 0,00 til 31 %, og det er forkert den anden vej. */
  if (!bedste.direkte) loft *= (KATALOGDAEKNING[faggruppe] ?? DAEKNING_UKENDT);

  /* Har butikken meldt fejlen ind, eller kom meldingen efter, at måleren så
   * den, ved vi med langt større sikkerhed, at afvigelsen er virkelig og
   * ikke en modelfejl. Det løfter loftet — ikke den enkelte årsag. */
  const bekraeftetAfButik = kobling && (kobling.klasse === 'bekraeftet' || kobling.klasse === 'varsel');
  if (bekraeftetAfButik && !bedste.direkte) loft = Math.min(1, loft * 1.35);

  /* Udslagets størrelse skal også tælle med.
   *
   * Uden det giver 3,5 % og 96 % afvigelse nøjagtig samme konfidens, for
   * formen er den samme. Men på en døgnmodel uden timedata er nogle få
   * procent inden for det, modellen selv kan tage fejl med, og dér kan flere
   * årsager passe lige godt. Et tydeligt udslag udelukker nogle af dem. */
  const udslag = Math.abs(signatur.afvigPct ?? 0);
  if (!bedste.direkte) loft *= Math.max(SVAGT_UDSLAG_GULV, Math.min(1, udslag / TYDELIGT_UDSLAG));

  const konfidens = Math.max(5, Math.min(95, Math.round(100 * Math.min(bedste.andel + margin, 0.95) * Math.max(0.3, loft))));
  const entydig = margin > 0.10;

  return {
    brugbar: true,
    bedste, naest, margin, konfidens, entydig,
    rangeret: rangeret.slice(0, 4),
    forbehold: [
      ...signatur.mangler.map((m) => `Mangler ${m}.`),
      signatur.modelleret ? 'Døgnserien er modelleret, ikke aflæst — tallene viser, at metoden virker, ikke hvad anlægget faktisk brugte.' : null,
      !entydig ? `${bedste.navn} og ${naest.navn} passer næsten lige godt. Servicebesøget skal skille dem ad, før der bestilles arbejde.` : null,
      historik?.afvistTidligere ? historik.tekst : null,
    ].filter(Boolean),
  };
}

function restniveauOrd(r) {
  const p = Math.round(r * 100);
  if (p <= 1) return 'Målepunktet står på nul — der registreres intet forbrug overhovedet.';
  if (p <= 35) return `Der kører stadig ${p} % af det normale — det svarer til styring og ventilatorer, altså et anlæg der står, men ikke er strømløst.`;
  return `Der kører stadig ${p} % af det normale — hovedparten af anlægget er i drift.`;
}

const formOrd = (f) => ({ spring: 'et spring til et nyt niveau', glidende: 'en glidning over uger', nul: 'et fald til nul', ingen: 'uden tydelig form' }[f] || f);

function vejrresponsOrd(s) {
  if (s.vejrrespons === 'brudt') return `Anlægget reagerer ikke længere på udetemperaturen (følsomheden er faldet fra ${s.koefFoer} til ${s.koefEfter} kWh pr. grad).`;
  if (s.vejrrespons === 'forstærket') return `Anlægget reagerer kraftigere på udetemperaturen end før (${s.koefFoer} → ${s.koefEfter} kWh pr. grad).`;
  return `Anlæggets vejrfølsomhed er uændret (${s.koefFoer} → ${s.koefEfter} kWh pr. grad).`;
}
