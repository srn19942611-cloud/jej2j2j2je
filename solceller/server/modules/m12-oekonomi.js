/**
 * MODUL 12 - Elforbrug og økonomi
 *
 * Automatiseringsgrad: fuld for forbruget (Eloverblik), manuel for
 * prisantagelserne.
 *
 * Egetforbrugsandelen er det tal, hele økonomien hænger på: en kWh brugt
 * selv er værd elprisen inklusive tarif og afgift, mens en kWh solgt til
 * nettet er værd langt mindre. Derfor matches produktion og forbrug time for
 * time - et årsgennemsnit ville overvurdere gevinsten kraftigt.
 */

import { hentJson, KildeFejl } from "../lib/http.js";
import { ELOVERBLIK } from "../config/datakilder.js";
import { OEKONOMI } from "../config/antagelser.js";
import { hentet, beregnet, antagelse, mangler, bekraeftet, vaerdiEller } from "../lib/kilde.js";
import { solposition } from "../lib/sol.js";
import { tilRadian } from "../lib/geometri.js";

/* ------------------------------------------------------------------ */
/* Eloverblik                                                          */
/* ------------------------------------------------------------------ */

async function dataAdgangsToken() {
  if (!ELOVERBLIK.konfigureret) {
    throw new KildeFejl(ELOVERBLIK.navn, "der er ikke sat noget tredjeparts-token (ELOVERBLIK_TOKEN)");
  }
  const svar = await hentJson(`${ELOVERBLIK.basis}/token`, {
    kilde: ELOVERBLIK.navn,
    headers: { Authorization: `Bearer ${ELOVERBLIK.token}` },
    cacheTtlMs: 60 * 60 * 1000,
  });
  const token = svar?.result;
  if (!token) throw new KildeFejl(ELOVERBLIK.navn, "kunne ikke hente et dataadgangs-token");
  return token;
}

export async function hentMaalepunkter() {
  const token = await dataAdgangsToken();
  const svar = await hentJson(`${ELOVERBLIK.basis}/meteringpoints/meteringpoints?includeAll=false`, {
    kilde: ELOVERBLIK.navn,
    headers: { Authorization: `Bearer ${token}` },
    cacheTtlMs: 0,
  });
  return (svar?.result ?? []).map((m) => ({
    id: m.meteringPointId,
    adresse: [m.streetName, m.buildingNumber, m.postcode, m.cityName].filter(Boolean).join(" "),
    type: m.typeOfMP,
    forbrugerkategori: m.consumerCategory,
    aftager: m.settlementMethod,
  }));
}

/**
 * Henter timeforbrug for et målepunkt. Eloverblik leverer tidsserier som
 * dag-perioder med timepunkter.
 */
export async function hentTimeforbrug(maalepunktId, fra, til) {
  const token = await dataAdgangsToken();
  const svar = await hentJson(
    `${ELOVERBLIK.basis}/meterdata/gettimeseries/${fra}/${til}/Hour`,
    {
      kilde: ELOVERBLIK.navn,
      metode: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ meteringPoints: { meteringPoint: [maalepunktId] } }),
      cacheTtlMs: 0,
    }
  );

  const timer = [];
  for (const r of svar?.result ?? []) {
    const perioder = r?.MyEnergyData_MarketDocument?.TimeSeries ?? [];
    for (const ts of perioder) {
      for (const p of ts.Period ?? []) {
        const start = new Date(p.timeInterval?.start);
        for (const pkt of p.Point ?? []) {
          const time = new Date(start.getTime() + (Number(pkt.position) - 1) * 3600000);
          timer.push({ tid: time, kWh: Number(pkt["out_Quantity.quantity"] ?? 0) });
        }
      }
    }
  }
  return timer.sort((a, b) => a.tid - b.tid);
}

/* ------------------------------------------------------------------ */
/* Forbrugsprofil                                                      */
/* ------------------------------------------------------------------ */

/**
 * Syntetisk butiksprofil, brugt når Eloverblik ikke er tilgængeligt.
 *
 * Formen er en almindelig detailprofil: åbningstid 8-20 på hverdage,
 * kortere i weekenden, med køl og belysning som konstant grundlast. Den er
 * et MØNSTER, ikke butikkens data, og egetforbrugsandelen beregnet på den
 * skal behandles som et overslag.
 */
export function syntetiskButiksprofil(aarsforbrugKWh) {
  const timeVaegt = (dag, time) => {
    const weekend = dag === 0 || dag === 6;
    const aaben = weekend ? time >= 9 && time < 18 : time >= 7 && time < 20;
    const grundlast = 0.35;                       // koel, ventilation, nødbelysning
    if (!aaben) return grundlast;
    const spids = time >= 10 && time <= 17 ? 1.0 : 0.75;
    return grundlast + (weekend ? 0.5 : 0.65) * spids;
  };

  const timer = [];
  const aar = new Date().getUTCFullYear();
  let sum = 0;
  for (let d = 0; d < 365; d++) {
    const dato = new Date(Date.UTC(aar, 0, 1 + d));
    const ugedag = dato.getUTCDay();
    for (let t = 0; t < 24; t++) {
      // Let sæsonvariation: mere lys og varme om vinteren
      const saeson = 1 + 0.15 * Math.cos((2 * Math.PI * d) / 365);
      const v = timeVaegt(ugedag, t) * saeson;
      sum += v;
      timer.push({ tid: new Date(Date.UTC(aar, 0, 1 + d, t)), vaegt: v });
    }
  }
  const skala = aarsforbrugKWh / sum;
  return timer.map((t) => ({ tid: t.tid, kWh: t.vaegt * skala }));
}

/**
 * Timefordelt produktion afledt af månedstotaler og solens gang.
 *
 * PVGIS' PVcalc giver månedstotaler; formen inden for måneden modelleres
 * med clear-sky-geometrien og skaleres, så månedssummen holder. Det er
 * præcist nok til en egetforbrugsberegning, hvor det er sammenfaldet
 * mellem dag og forbrug, der afgør resultatet.
 */
export function timeprofilFraMaaneder(maanedligKWh, lat, lon, haeldning, azimut) {
  const aar = new Date().getUTCFullYear();
  const raa = [];
  const maanedsSum = new Array(12).fill(0);

  for (let d = 0; d < 365; d++) {
    for (let t = 0; t < 24; t++) {
      const tid = new Date(Date.UTC(aar, 0, 1 + d, t, 30));
      const { hoejde, azimut: solAz } = solposition(tid, lat, lon);
      let v = 0;
      if (hoejde > 0) {
        const h = tilRadian(hoejde), ti = tilRadian(haeldning), da = tilRadian(solAz - (azimut ?? 0));
        const cosI = Math.sin(h) * Math.cos(ti) + Math.cos(h) * Math.sin(ti) * Math.cos(da);
        v = Math.max(0, cosI) * Math.sin(h) ** 0.3; // luftmasse-dæmpning ved lav sol
      }
      const m = tid.getUTCMonth();
      maanedsSum[m] += v;
      raa.push({ tid, vaegt: v, maaned: m });
    }
  }

  return raa.map((r) => ({
    tid: r.tid,
    kWh: maanedsSum[r.maaned] > 0 ? (r.vaegt / maanedsSum[r.maaned]) * (maanedligKWh[r.maaned] ?? 0) : 0,
  }));
}

/* ------------------------------------------------------------------ */
/* Hovedmodul                                                          */
/* ------------------------------------------------------------------ */

export async function koer(input) {
  const advarsler = [];
  const m7 = input.modul7;
  const aarsproduktion = vaerdiEller(m7?.resultat?.aarsproduktionKWh, null);
  const effektKWp = vaerdiEller(m7?.resultat?.installeretEffektKWp, null);

  if (aarsproduktion == null || !effektKWp) {
    return { modul: 12, navn: "Elforbrug og økonomi", status: "ufuldstaendig",
      blokerende: ["Intet produktionsestimat fra modul 7."], advarsler };
  }

  /* --- Forbrug -------------------------------------------------------- */
  let forbrugTimer = null, forbrugKilde, aarsforbrug = null;

  if (input.maalepunktId && ELOVERBLIK.konfigureret) {
    try {
      const til = new Date();
      const fra = new Date(til.getTime() - 365 * 86400000);
      forbrugTimer = await hentTimeforbrug(
        input.maalepunktId, fra.toISOString().slice(0, 10), til.toISOString().slice(0, 10)
      );
      aarsforbrug = forbrugTimer.reduce((s, t) => s + t.kWh, 0);
      forbrugKilde = hentet(rund(aarsforbrug, 0), ELOVERBLIK.navn, {
        enhed: "kWh/aar", reference: `Målepunkt ${input.maalepunktId}`,
        note: `Faktiske timeværdier for de seneste 12 måneder (${forbrugTimer.length} timer).`,
      });
    } catch (fejl) {
      advarsler.push(`Forbrugsdata kunne ikke hentes fra Eloverblik. ${fejl.message}`);
    }
  }

  if (!forbrugTimer) {
    if (input.aarsforbrugKWh) {
      aarsforbrug = input.aarsforbrugKWh;
      forbrugTimer = syntetiskButiksprofil(aarsforbrug);
      forbrugKilde = bekraeftet(aarsforbrug, "Brugerangivet årsforbrug", {
        enhed: "kWh/aar",
        note: "Årsforbruget er oplyst, men timefordelingen er modelleret med en " +
              "generisk butiksprofil. Egetforbrugsandelen er derfor et overslag.",
      });
      advarsler.push(
        "Timefordelingen af forbruget er modelleret, ikke målt. Egetforbrugsandelen " +
        "er det tal, økonomien er mest følsom over for - hent de faktiske timedata " +
        "fra Eloverblik, før tallene bruges i en investeringsbeslutning."
      );
    } else {
      advarsler.push(
        "Der er hverken hentet forbrugsdata fra Eloverblik eller oplyst et årsforbrug. " +
        "Egetforbrug og dermed hele økonomien kan ikke beregnes."
      );
      return {
        modul: 12, navn: "Elforbrug og økonomi", status: "kraever-brugerhandling",
        advarsler,
        forbrug: mangler(ELOVERBLIK.navn,
          "Hverken målepunkt eller årsforbrug er oplyst"),
        vejledning: ELOVERBLIK.opsaetningsvejledning,
      };
    }
  }

  /* --- Produktionsprofil og match ------------------------------------- */
  const maanedlig = vaerdiEller(m7.resultat.maanedligKWh, null);
  let produktionTimer = null;
  if (maanedlig?.length === 12) {
    const haeldning = vaerdiEller(m7.forudsaetninger?.haeldningGrader, 15);
    const delfelter = vaerdiEller(m7.forudsaetninger?.delfelter, [{ azimut: 0 }]);
    const hovedAzimut = delfelter[0]?.azimut ?? 0;
    produktionTimer = timeprofilFraMaaneder(maanedlig, input.lat, input.lon, haeldning, hovedAzimut);
  }

  const match = produktionTimer
    ? matchTimer(produktionTimer, forbrugTimer)
    : groftMatch(aarsproduktion, aarsforbrug);

  /* --- Økonomi -------------------------------------------------------- */
  const pris = { ...OEKONOMI, ...(input.oekonomiOverstyring ?? {}) };
  const capexPrKWp = interpolérCapex(effektKWp, pris.capexKurveKrPrKWp);
  const ballastKg = vaerdiEller(input.modul3?.ballast?.samletKg, 0);
  const ballastKr = (ballastKg / 1000) * pris.ballastTillaegKrPrTon;
  const capex = capexPrKWp * effektKWp + ballastKr;

  const aarligBesparelseAar1 =
    match.egetforbrugKWh * pris.elprisKoebKrPrKWh +
    match.overskudKWh * pris.elprisSalgKrPrKWh;
  const driftAar1 = pris.driftOgVedligeholdKrPrKWpPrAar * effektKWp;
  const nettoAar1 = aarligBesparelseAar1 - driftAar1;

  const kontantstroem = byggKontantstroem({
    capex, pris, effektKWp, match, m7, levetid: pris.levetidAar,
  });

  const tilbagebetaling = findTilbagebetaling(kontantstroem);
  const npv = kontantstroem.reduce((s, r) => s + r.diskonteret, -capex);
  const irr = beregnIrr(capex, kontantstroem);
  const lcoe = beregnLcoe(capex, kontantstroem, pris);

  return {
    modul: 12,
    navn: "Elforbrug og økonomi",
    status: forbrugKilde.herkomst === "hentet" ? "ok" : "delvis",
    advarsler,
    forbrug: {
      aarsforbrugKWh: forbrugKilde,
      antalTimevaerdier: beregnet(forbrugTimer.length, "Modul 12", { enhed: "timer" }),
      profilkilde: forbrugKilde.herkomst === "hentet"
        ? hentet("Målte timeværdier", ELOVERBLIK.navn)
        : antagelse("Generisk butiksprofil", "Modul 12 syntetisk profil", {
            note: "Grundlast plus åbningstid. Ikke butikkens faktiske mønster." }),
    },
    egetforbrug: {
      egetforbrugKWh: beregnet(rund(match.egetforbrugKWh, 0),
        match.metode === "time" ? "Time-for-time match af produktion og forbrug" : "Groft årsoverslag",
        { enhed: "kWh/aar" }),
      overskudTilNettetKWh: beregnet(rund(match.overskudKWh, 0), "Produktion minus egetforbrug", { enhed: "kWh/aar" }),
      egetforbrugsandelPct: beregnet(rund(match.egetforbrugsandelPct, 1),
        "Egetforbrug / samlet produktion", { enhed: "%" }),
      daekningsgradPct: beregnet(rund(match.daekningsgradPct, 1),
        "Egetforbrug / samlet elforbrug", { enhed: "%" }),
      metode: match.metode,
    },
    forudsaetninger: {
      elprisKoebKrPrKWh: antagelse(pris.elprisKoebKrPrKWh, pris.kilde, { enhed: "kr/kWh",
        note: "Inkl. tarif og afgift. Skal svare til butikkens faktiske elaftale." }),
      elprisSalgKrPrKWh: antagelse(pris.elprisSalgKrPrKWh, pris.kilde, { enhed: "kr/kWh" }),
      capexKrPrKWp: antagelse(rund(capexPrKWp, 0), pris.kilde, { enhed: "kr/kWp",
        note: "Interpoleret på anlægsstørrelsen. Erstat med et faktisk tilbud." }),
      kalkulationsrentePct: antagelse(pris.kalkulationsrentePct, pris.kilde, { enhed: "%" }),
      elprisstigningPctPrAar: antagelse(pris.elprisstigningPctPrAar, pris.kilde, { enhed: "%/aar" }),
      levetidAar: antagelse(pris.levetidAar, pris.kilde, { enhed: "aar" }),
    },
    resultat: {
      investeringKr: beregnet(rund(capex, 0),
        `${rund(capexPrKWp, 0)} kr/kWp x ${rund(effektKWp, 1)} kWp` +
        (ballastKr > 0 ? ` + ballast ${rund(ballastKr, 0)} kr` : ""), { enhed: "kr" }),
      aarligBesparelseAar1Kr: beregnet(rund(aarligBesparelseAar1, 0),
        "Egetforbrug x købspris + overskud x salgspris", { enhed: "kr/aar" }),
      driftPrAarKr: beregnet(rund(driftAar1, 0), "Drift og vedligehold", { enhed: "kr/aar" }),
      nettoAar1Kr: beregnet(rund(nettoAar1, 0), "Besparelse minus drift", { enhed: "kr/aar" }),
      tilbagebetalingstidAar: tilbagebetaling != null
        ? beregnet(rund(tilbagebetaling, 1), "Simpel tilbagebetaling af kontantstrømmen", { enhed: "aar" })
        : mangler("Modul 12", `Investeringen tjener sig ikke hjem inden for ${pris.levetidAar} år`),
      nutidsvaerdiKr: beregnet(rund(npv, 0),
        `Nutidsværdi over ${pris.levetidAar} år ved ${pris.kalkulationsrentePct} % kalkulationsrente`, { enhed: "kr" }),
      internRentePct: irr != null
        ? beregnet(rund(irr * 100, 1), "Intern rente af kontantstrømmen", { enhed: "%" })
        : mangler("Modul 12", "Intern rente kunne ikke bestemmes"),
      lcoeKrPrKWh: beregnet(rund(lcoe, 3),
        "Diskonteret omkostning / diskonteret produktion", { enhed: "kr/kWh" }),
    },
    kontantstroem,
    forbehold:
      "Tallene er et overslag, ikke et tilbud. CAPEX, elpriser og tariffer er manuelt " +
      "vedligeholdte antagelser i konfigurationen og skal erstattes af et faktisk tilbud " +
      "og butikkens egen elaftale, før de bruges i en investeringsbeslutning. " +
      (match.metode !== "time"
        ? "Egetforbruget er desuden beregnet groft og ikke time for time."
        : ""),
  };
}

/* ------------------------------------------------------------------ */
/* Beregninger                                                         */
/* ------------------------------------------------------------------ */

/** Time-for-time: egetforbrug er min(produktion, forbrug) i hver time. */
export function matchTimer(produktion, forbrug) {
  const forbrugKort = new Map();
  for (const f of forbrug) {
    const n = noegle(f.tid);
    forbrugKort.set(n, (forbrugKort.get(n) ?? 0) + f.kWh);
  }

  let eget = 0, samletProd = 0, samletForbrug = 0;
  for (const p of produktion) {
    const f = forbrugKort.get(noegle(p.tid)) ?? 0;
    eget += Math.min(p.kWh, f);
    samletProd += p.kWh;
  }
  for (const v of forbrugKort.values()) samletForbrug += v;

  return {
    metode: "time",
    egetforbrugKWh: eget,
    overskudKWh: Math.max(0, samletProd - eget),
    egetforbrugsandelPct: samletProd > 0 ? (eget / samletProd) * 100 : 0,
    daekningsgradPct: samletForbrug > 0 ? (eget / samletForbrug) * 100 : 0,
  };
}

const noegle = (d) => `${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;

/** Nødløsning uden timeprofil - bevidst konservativ og tydeligt markeret. */
function groftMatch(produktion, forbrug) {
  const andel = Math.min(0.7, forbrug > 0 ? Math.min(1, forbrug / produktion) * 0.7 : 0);
  const eget = produktion * andel;
  return {
    metode: "groft",
    egetforbrugKWh: eget,
    overskudKWh: produktion - eget,
    egetforbrugsandelPct: andel * 100,
    daekningsgradPct: forbrug > 0 ? (eget / forbrug) * 100 : 0,
  };
}

export function interpolérCapex(kWp, kurve) {
  const s = [...kurve].sort((a, b) => a.kWp - b.kWp);
  if (kWp <= s[0].kWp) return s[0].krPrKWp;
  if (kWp >= s[s.length - 1].kWp) return s[s.length - 1].krPrKWp;
  for (let i = 0; i < s.length - 1; i++) {
    if (kWp >= s[i].kWp && kWp <= s[i + 1].kWp) {
      const t = (kWp - s[i].kWp) / (s[i + 1].kWp - s[i].kWp);
      return s[i].krPrKWp + t * (s[i + 1].krPrKWp - s[i].krPrKWp);
    }
  }
  return s[s.length - 1].krPrKWp;
}

function byggKontantstroem({ capex, pris, effektKWp, match, m7, levetid }) {
  const raekker = [];
  const r = pris.kalkulationsrentePct / 100;
  let akkumuleret = -capex;

  for (let aar = 1; aar <= levetid; aar++) {
    const degradering = m7.aarsserie?.[aar - 1]?.andelAfAar1
      ?? Math.pow(1 - 0.45 / 100, aar - 1);
    const prisfaktor = Math.pow(1 + pris.elprisstigningPctPrAar / 100, aar - 1);

    const indtaegt =
      (match.egetforbrugKWh * pris.elprisKoebKrPrKWh +
       match.overskudKWh * pris.elprisSalgKrPrKWh) * degradering * prisfaktor;
    const drift = pris.driftOgVedligeholdKrPrKWpPrAar * effektKWp * prisfaktor;
    const inverter = aar === pris.inverterUdskiftningAar
      ? capex * pris.inverterUdskiftningAndelAfCapex : 0;

    const netto = indtaegt - drift - inverter;
    akkumuleret += netto;
    raekker.push({
      aar,
      produktionKWh: rund((m7.aarsserie?.[aar - 1]?.kWh) ?? 0, 0),
      indtaegtKr: rund(indtaegt, 0),
      driftKr: rund(drift, 0),
      inverterudskiftningKr: rund(inverter, 0),
      nettoKr: rund(netto, 0),
      akkumuleretKr: rund(akkumuleret, 0),
      diskonteret: netto / Math.pow(1 + r, aar),
    });
  }
  return raekker;
}

function findTilbagebetaling(kontantstroem) {
  for (let i = 0; i < kontantstroem.length; i++) {
    if (kontantstroem[i].akkumuleretKr >= 0) {
      if (i === 0) return 1;
      const foer = kontantstroem[i - 1].akkumuleretKr;
      const netto = kontantstroem[i].nettoKr;
      return netto > 0 ? i + (-foer) / netto : i + 1;
    }
  }
  return null;
}

function beregnIrr(capex, kontantstroem) {
  const npv = (r) => kontantstroem.reduce((s, k, i) => s + k.nettoKr / Math.pow(1 + r, i + 1), -capex);
  let lav = -0.5, hoej = 1.0;
  if (npv(lav) * npv(hoej) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const midt = (lav + hoej) / 2;
    if (npv(lav) * npv(midt) <= 0) hoej = midt; else lav = midt;
  }
  return (lav + hoej) / 2;
}

function beregnLcoe(capex, kontantstroem, pris) {
  const r = pris.kalkulationsrentePct / 100;
  let omkostning = capex, produktion = 0;
  kontantstroem.forEach((k, i) => {
    const d = Math.pow(1 + r, i + 1);
    omkostning += (k.driftKr + k.inverterudskiftningKr) / d;
    produktion += k.produktionKWh / d;
  });
  return produktion > 0 ? omkostning / produktion : 0;
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
