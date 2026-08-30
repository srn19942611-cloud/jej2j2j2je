/**
 * MODUL 7 - Produktionsestimat
 *
 * Automatiseringsgrad: fuld, når PVGIS kan nås.
 *
 * Primærkilde er PVGIS v5.3 fra EU's Joint Research Centre. Tjenesten er
 * offentlig og gratis uden login, men den sætter ikke CORS-headere, så
 * kaldet skal foretages server-side - derfor ligger modulet her og ikke i
 * browseren.
 *
 * Hvis PVGIS ikke kan nås (lukket netværk, nedetid), falder modulet tilbage
 * på en intern indstrålingsmodel. Det resultat markeres som ANTAGELSE, ikke
 * som hentet, og rapporten skriver eksplicit at produktionstallet ikke er
 * verificeret mod en målt indstrålingsdatabase.
 */

import { hentJson, query, KildeFejl } from "../lib/http.js";
import { PVGIS } from "../config/datakilder.js";
import { SYSTEMTAB, PANELTYPER } from "../config/antagelser.js";
import { hentet, beregnet, antagelse, mangler } from "../lib/kilde.js";
import { aarsSolpunkter } from "../lib/sol.js";
import { tilRadian as rad } from "../lib/geometri.js";

/** Samlet systemtab i procent, som PVGIS' `loss`-parameter forventer. */
export function systemtabPct(ekstraPct = 0) {
  const t = SYSTEMTAB;
  return t.kablingPct + t.inverterPct + t.smudsPct + t.mismatchPct + t.tilgaengelighedPct + ekstraPct;
}

/**
 * @param {object} input
 * @param {number} input.lat @param {number} input.lon
 * @param {object} input.layout    fra modul 2
 * @param {number} [input.skyggetabPct] fra modul 8
 */
export async function koer(input) {
  const advarsler = [];
  const layout = input.layout;

  if (!layout?.paneler?.length) {
    return { modul: 7, navn: "Produktionsestimat", status: "ufuldstaendig",
      blokerende: ["Intet layout fra modul 2."], advarsler };
  }
  if (input.lat == null || input.lon == null) {
    return { modul: 7, navn: "Produktionsestimat", status: "ufuldstaendig",
      blokerende: ["Ingen koordinat fra modul 1."], advarsler };
  }

  const panel = PANELTYPER[input.paneltype] ?? PANELTYPER["standard-450"];
  const haeldning = layout.forudsaetninger?.haeldningGrader?.vaerdi ?? 15;

  // Del anlægget op i delfelter efter azimut. Et øst/vest-anlæg giver to
  // delfelter, som skal regnes hver for sig og lægges sammen.
  const delfelter = grupperEfterAzimut(layout.paneler, panel.effektWp);

  const tab = systemtabPct(input.skyggetabPct ?? 0);
  const resultater = [];
  let kildeErPvgis = true;

  for (const felt of delfelter) {
    try {
      const r = await hentPvgis({
        lat: input.lat, lon: input.lon,
        kWp: felt.kWp, haeldning, azimut: felt.azimut, tabPct: tab,
      });
      resultater.push({ ...felt, ...r, kilde: "pvgis" });
    } catch (fejl) {
      kildeErPvgis = false;
      advarsler.push(
        `PVGIS kunne ikke nås for delfeltet mod ${beskrivAzimut(felt.azimut)}. ${fejl.message} ` +
        "Der er brugt en intern indstrålingsmodel i stedet - tallet er et overslag, " +
        "ikke et databaseopslag, og skal verificeres før det bruges i en ansøgning."
      );
      const r = internEstimat({
        lat: input.lat, lon: input.lon,
        kWp: felt.kWp, haeldning, azimut: felt.azimut, tabPct: tab,
      });
      resultater.push({ ...felt, ...r, kilde: "intern" });
    }
  }

  const aarsproduktionKWh = resultater.reduce((s, r) => s + r.aarsproduktionKWh, 0);
  const samletKWp = resultater.reduce((s, r) => s + r.kWp, 0);
  const maanedlig = laegSammenMaanedlig(resultater);

  const K = kildeErPvgis ? "PVGIS v5.3 (EU JRC)" : "Intern indstrålingsmodel";
  const dp = kildeErPvgis
    ? (v, k, o) => hentet(v, K, { ...o, reference: `${PVGIS.basis}/PVcalc` })
    : (v, k, o) => antagelse(v, K, { ...o, note: "Ikke verificeret mod målt indstrålingsdatabase" });

  /* --- Degradering over levetiden ---------------------------------- */
  const levetid = input.levetidAar ?? 25;
  const degradering = panel.degraderingPctPrAar;
  const aarsserie = [];
  let akkumuleret = 0;
  for (let aar = 1; aar <= levetid; aar++) {
    const faktor = Math.pow(1 - degradering / 100, aar - 1);
    const kwh = aarsproduktionKWh * faktor;
    akkumuleret += kwh;
    aarsserie.push({ aar, kWh: rund(kwh, 0), andelAfAar1: rund(faktor, 4) });
  }

  return {
    modul: 7,
    navn: "Produktionsestimat",
    status: kildeErPvgis ? "ok" : "delvis",
    advarsler,
    datakilde: kildeErPvgis
      ? hentet("PVGIS v5.3", "EU Joint Research Centre", { reference: `${PVGIS.basis}/PVcalc` })
      : antagelse("Intern indstrålingsmodel", "Modul 7 fallback", {
          note: "PVGIS kunne ikke nås. Produktionstallet er modelleret, ikke hentet." }),
    forudsaetninger: {
      haeldningGrader: beregnet(haeldning, "Modul 2", { enhed: "grader" }),
      systemtabPct: antagelse(rund(tab, 1), SYSTEMTAB.kilde, { enhed: "%",
        note: "Kabling, inverter, smuds, mismatch, tilgængelighed" +
              (input.skyggetabPct ? ` samt skyggetab ${rund(input.skyggetabPct,1)} % fra modul 8` : "") }),
      degraderingPctPrAar: antagelse(degradering, panel.kilde, { enhed: "%/aar" }),
      delfelter: beregnet(delfelter.map((d) => ({
        azimut: d.azimut, beskrivelse: beskrivAzimut(d.azimut),
        antalPaneler: d.antal, kWp: rund(d.kWp, 2),
      })), "Modul 2 layout"),
    },
    resultat: {
      installeretEffektKWp: beregnet(rund(samletKWp, 2), "Modul 2", { enhed: "kWp" }),
      aarsproduktionKWh: dp(rund(aarsproduktionKWh, 0), K, { enhed: "kWh/aar" }),
      specifikYdelseKWhPrKWp: dp(rund(samletKWp > 0 ? aarsproduktionKWh / samletKWp : 0, 0), K,
        { enhed: "kWh/kWp/aar" }),
      maanedligKWh: dp(maanedlig, K, { enhed: "kWh" }),
      samletProduktionOverLevetidKWh: beregnet(rund(akkumuleret, 0),
        `Sum over ${levetid} år med ${degradering} %/år degradering`, { enhed: "kWh" }),
      produktionAarSidsteKWh: beregnet(rund(aarsserie[aarsserie.length - 1].kWh, 0),
        `År ${levetid} efter degradering`, { enhed: "kWh/aar" }),
    },
    aarsserie,
    delfeltResultater: resultater.map((r) => ({
      azimut: r.azimut, beskrivelse: beskrivAzimut(r.azimut),
      kWp: rund(r.kWp, 2), aarsproduktionKWh: rund(r.aarsproduktionKWh, 0),
      specifikYdelse: rund(r.kWp > 0 ? r.aarsproduktionKWh / r.kWp : 0, 0),
      kilde: r.kilde,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* PVGIS                                                               */
/* ------------------------------------------------------------------ */

async function hentPvgis({ lat, lon, kWp, haeldning, azimut, tabPct }) {
  const url = `${PVGIS.basis}/PVcalc?${query({
    lat, lon,
    peakpower: rund(kWp, 3),
    loss: rund(tabPct, 2),
    angle: rund(haeldning, 1),
    aspect: rund(azimut, 1),      // PVGIS: 0 = syd, -90 = oest, 90 = vest
    pvtechchoice: "crystSi",
    mountingplace: "building",
    outputformat: "json",
  })}`;

  const svar = await hentJson(url, { kilde: PVGIS.navn, timeoutMs: 30000 });
  const fast = svar?.outputs?.totals?.fixed;
  if (!fast || fast.E_y == null) {
    throw new KildeFejl(PVGIS.navn, "svaret indeholdt ingen årsproduktion (E_y)", { url });
  }
  const maaned = (svar.outputs.monthly?.fixed ?? []).map((m) => rund(m.E_m ?? 0, 0));
  return {
    aarsproduktionKWh: fast.E_y,
    maanedligKWh: maaned.length === 12 ? maaned : null,
    indstraalingKWhPrM2: svar.outputs.totals.fixed["H(i)_y"] ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Intern fallback-model                                               */
/* ------------------------------------------------------------------ */

/**
 * Fysisk baseret overslag, brugt når PVGIS ikke kan nås.
 *
 * Metoden: solens position integreres over året (modul-lib sol.js), en
 * clear-sky-model giver den relative fordeling, og hele serien skaleres så
 * den vandrette årsindstråling rammer den kendte danske normalværdi.
 * Diffus stråling regnes isotropt. Det er en ærlig model, men den er
 * ringere end PVGIS' målte satellitdata og må ikke fremstilles som lige så god.
 */
export const DANSK_AARS_GHI_KWH_M2 = 1000; // vandret årsindstråling, normalaar

export function internEstimat({ lat, lon, kWp, haeldning, azimut, tabPct }) {
  const punkter = aarsSolpunkter(lat, lon, { dageIntervalDage: 5, timeSkridt: 1 });
  const t = rad(haeldning);
  const panelAz = rad(azimut);

  // Relativ vægtet indfaldsvinkel-gevinst i forhold til vandret
  let planSum = 0, vandretSum = 0;
  const maanedPlan = new Array(12).fill(0);

  for (const p of punkter) {
    const h = rad(p.hoejde);
    const a = rad(p.azimut);
    // cos(indfaldsvinkel) på hældende flade
    const cosI =
      Math.sin(h) * Math.cos(t) +
      Math.cos(h) * Math.sin(t) * Math.cos(a - panelAz);
    const direkte = Math.max(0, cosI);
    const vandraet = Math.max(0, Math.sin(h));
    // Isotrop diffus: himmelandel der ses af den hældende flade
    const diffusAndel = (1 + Math.cos(t)) / 2;
    const diffusVaegt = 0.5; // dansk år er ca. halvt diffust
    const planBidrag = p.vaegt * ((1 - diffusVaegt) * direkte / Math.max(vandraet, 1e-6) * vandraet
      + diffusVaegt * diffusAndel * vandraet);
    planSum += planBidrag;
    vandretSum += p.vaegt * vandraet;
    maanedPlan[p.dato.getUTCMonth()] += planBidrag;
  }

  const forhold = vandretSum > 0 ? planSum / vandretSum : 1;
  const indstraalingIPlan = DANSK_AARS_GHI_KWH_M2 * forhold;

  // Ydelse = indstråling i plan x kWp x (1 - tab). Temperaturtabet i dansk
  // klima er lille og ligger inde i performance-faktoren.
  const performanceUdenTab = 0.90;
  const aarsproduktionKWh = indstraalingIPlan * kWp * performanceUdenTab * (1 - tabPct / 100);

  const maanedSum = maanedPlan.reduce((s, v) => s + v, 0) || 1;
  const maanedligKWh = maanedPlan.map((v) => rund((v / maanedSum) * aarsproduktionKWh, 0));

  return { aarsproduktionKWh, maanedligKWh, indstraalingKWhPrM2: rund(indstraalingIPlan, 0) };
}

/* ------------------------------------------------------------------ */
/* Hjælpere                                                           */
/* ------------------------------------------------------------------ */

function grupperEfterAzimut(paneler, effektWp) {
  const grupper = new Map();
  for (const p of paneler) {
    const az = p.azimutGrader ?? 0;
    const n = grupper.get(az) ?? { azimut: az, antal: 0, kWp: 0 };
    n.antal += 1;
    n.kWp += (p.effektWp ?? effektWp) / 1000;
    grupper.set(az, n);
  }
  return [...grupper.values()].sort((a, b) => a.azimut - b.azimut);
}

function laegSammenMaanedlig(resultater) {
  const sum = new Array(12).fill(0);
  let harData = false;
  for (const r of resultater) {
    if (!r.maanedligKWh) continue;
    harData = true;
    r.maanedligKWh.forEach((v, i) => (sum[i] += v));
  }
  return harData ? sum.map((v) => rund(v, 0)) : null;
}

export function beskrivAzimut(az) {
  if (az == null) return "ukendt";
  if (az <= -135 || az >= 135) return "nord";
  if (az < -45) return "oest";
  if (az > 45) return "vest";
  if (az >= -15 && az <= 15) return "syd";
  return az < 0 ? "sydoest" : "sydvest";
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
