/**
 * MODUL 8 - Skyggeanalyse
 *
 * Automatiseringsgrad: delvis. Geometrien er automatisk, men resultatet bør
 * valideres visuelt, og kvaliteten afhænger helt af, hvor godt omgivelserne
 * er beskrevet.
 *
 * Tre skyggebidrag regnes hver for sig:
 *   1. Selvskygning mellem panelrækker  - lukket form, altid tilgængelig
 *   2. Tagopbygninger (ovenlys, ventilation, skorsten, teknikrum)
 *   3. Nabobygninger og terræn
 *
 * Bidrag 2 og 3 kræver højder. De kommer fra Danmarks Højdemodel
 * (overfladen) via Datafordeleren, eller fra brugerens egne indtegninger.
 * Uden højdedata regnes KUN selvskygning, og modulet siger det tydeligt -
 * det er vigtigt, for en analyse der kun dækker selvskygning ligner en
 * fuld skyggeanalyse i rapporten, hvis man ikke passer på.
 *
 * Overskrider skyggetabet tærsklen, returnerer modulet konkrete
 * justeringsforslag, som orchestrator sender tilbage til modul 2.
 */

import { aarsSolpunkter, solvektor, cosIndfaldsvinkel, selvskyggetAndel } from "../lib/sol.js";
import { punktIPolygon, centroide, bbox } from "../lib/geometri.js";
import { LAYOUT } from "../config/antagelser.js";
import { beregnet, antagelse, mangler, hentet } from "../lib/kilde.js";

/**
 * Elektrisk forstærkning af et geometrisk skyggetab.
 *
 * Et delvist skygget modul taber mere effekt end den skyggede andel af
 * arealet, fordi bypass-dioder kobler hele cellestrenge ud, og fordi det
 * svageste modul begrænser strømmen i hele strengen. Faktoren er et
 * projekteringsskøn - den præcise værdi afhænger af modul- og
 * strengtopologi og kan kun afgøres med en elektrisk simulering.
 */
export const ELEKTRISK_FORSTAERKNING = 1.6;

/**
 * @param {object} input
 * @param {object} input.layout       fra modul 2
 * @param {number} input.lat @param {number} input.lon
 * @param {Array} [input.forhindringer]  tagopbygninger med højdeM
 * @param {Array} [input.nabobygninger]  {polygonMeter, højdeM}
 * @param {number} [input.tærskelPct]
 */
export function koer(input) {
  const advarsler = [];
  const layout = input.layout;
  if (!layout?.paneler?.length) {
    return { modul: 8, navn: "Skyggeanalyse", status: "ufuldstaendig",
      blokerende: ["Intet layout fra modul 2."], advarsler };
  }

  const taerskel = input.taerskelPct ?? LAYOUT.maxSkyggetabPct;
  const haeldning = layout.forudsaetninger?.haeldningGrader?.vaerdi ?? 15;
  const pitch = layout.forudsaetninger?.raekkeafstandM?.vaerdi ?? null;
  const panelDybde = layout.geometri?.panelDybdeM ?? 1.134;
  const panelLaengdeIFald = haeldning > 0 && pitch
    ? panelDybde / Math.cos((haeldning * Math.PI) / 180)
    : panelDybde;

  /* --- Skyggekastere ------------------------------------------------ */
  const kastere = [];
  for (const f of input.forhindringer ?? []) {
    if (f.polygonMeter?.length >= 3 && f.hoejdeM > 0) {
      kastere.push({ polygon: f.polygonMeter, hoejdeM: f.hoejdeM, type: f.type ?? "tagopbygning", paaTaget: true });
    }
  }
  for (const n of input.nabobygninger ?? []) {
    if (n.polygonMeter?.length >= 3 && n.hoejdeM > 0) {
      kastere.push({ polygon: n.polygonMeter, hoejdeM: n.hoejdeM, type: n.type ?? "nabobygning", paaTaget: false });
    }
  }

  const udenHoejde = (input.forhindringer ?? []).filter((f) => !(f.hoejdeM > 0)).length;
  if (udenHoejde > 0) {
    advarsler.push(
      `${udenHoejde} tagopbygning(er) har ingen højde og indgår derfor ikke i skyggeberegningen. ` +
      "De er stadig udeladt af layoutet som fysisk forhindring, men deres skygge er ikke regnet med."
    );
  }
  if (kastere.length === 0) {
    advarsler.push(
      "Der er ingen skyggekastere med højde. Beregningen dækker derfor KUN selvskygning " +
      "mellem panelrækkerne. Nabobygninger og tagopbygninger er ikke vurderet - " +
      "hent Danmarks Højdemodel eller indtegn omgivelserne, før tallet bruges."
    );
  }

  /* --- Solpunkter over året ---------------------------------------- */
  const punkter = aarsSolpunkter(input.lat, input.lon, {
    dageIntervalDage: input.finberegning ? 5 : 10,
    timeSkridt: 1,
  });

  /* --- Pr. panel ----------------------------------------------------- */
  const panelTab = [];
  for (const p of layout.paneler) {
    const panelAz = p.azimutGrader ?? 0;
    let vaegtSum = 0, tabSum = 0;
    let selvSum = 0, objektSum = 0;

    for (const sp of punkter) {
      const cosI = cosIndfaldsvinkel(sp.hoejde, sp.azimut, haeldning, panelAz);
      if (cosI <= 0) continue;                 // solen staar bag panelet
      const vaegt = sp.vaegt * cosI;
      vaegtSum += vaegt;

      // 1) selvskygning - første række har intet foran sig
      let selv = 0;
      if (p.raekke > 1 && pitch) {
        selv = selvskyggetAndel({
          raekkeafstandM: pitch,
          panelLaengde: panelLaengdeIFald,
          haeldningGrader: haeldning,
          solhoejdeGrader: sp.hoejde,
          azimutAfvigelseGrader: sp.azimut - panelAz,
        });
      }

      // 2+3) objekter
      const objekt = kastere.length
        ? andelISkygge(p, kastere, solvektor(sp.hoejde, sp.azimut))
        : 0;

      const geometrisk = Math.min(1, Math.max(selv, objekt));
      selvSum += vaegt * selv;
      objektSum += vaegt * objekt;
      tabSum += vaegt * Math.min(1, geometrisk * ELEKTRISK_FORSTAERKNING);
    }

    const tabPct = vaegtSum > 0 ? (tabSum / vaegtSum) * 100 : 0;
    panelTab.push({
      id: p.id, raekke: p.raekke, kolonne: p.kolonne,
      skyggetabPct: rund(tabPct, 2),
      selvskygningPct: rund(vaegtSum > 0 ? (selvSum / vaegtSum) * 100 : 0, 2),
      objektskyggePct: rund(vaegtSum > 0 ? (objektSum / vaegtSum) * 100 : 0, 2),
      centrum: p.centrum,
    });
  }

  const samletTabPct = panelTab.length
    ? panelTab.reduce((s, t) => s + t.skyggetabPct, 0) / panelTab.length
    : 0;

  /* --- Strenge ------------------------------------------------------- */
  const raekketab = grupper(panelTab, (t) => t.raekke).map(([raekke, liste]) => ({
    raekke,
    antalPaneler: liste.length,
    gennemsnitPct: rund(liste.reduce((s, t) => s + t.skyggetabPct, 0) / liste.length, 2),
    vaersteePct: rund(Math.max(...liste.map((t) => t.skyggetabPct)), 2),
  })).sort((a, b) => a.raekke - b.raekke);

  /* --- Justeringsforslag til modul 2 --------------------------------- */
  const haardtRamte = panelTab
    .filter((t) => t.skyggetabPct > taerskel * 2)
    .sort((a, b) => b.skyggetabPct - a.skyggetabPct);

  const forslag = [];
  if (samletTabPct > taerskel) {
    if (haardtRamte.length) {
      forslag.push({
        type: "fjern-paneler",
        beskrivelse:
          `${haardtRamte.length} paneler har over ${rund(taerskel * 2, 1)} % skyggetab. ` +
          "De giver et dårligt bidrag og trækker de øvrige paneler i samme streng ned. " +
          "Overvej at tage dem ud af layoutet.",
        panelIder: haardtRamte.map((t) => t.id),
        udelukkelseszoner: haardtRamte.map((t) => ({
          polygonMeter: layout.paneler.find((p) => p.id === t.id)?.hjoerner,
          aarsag: `skygge ${t.skyggetabPct} %`,
        })).filter((z) => z.polygonMeter),
      });
    }
    const selvAndel = panelTab.reduce((s, t) => s + t.selvskygningPct, 0) / (panelTab.length || 1);
    if (selvAndel > taerskel / 2 && pitch) {
      forslag.push({
        type: "oeg-raekkeafstand",
        beskrivelse:
          `Selvskygningen bidrager med ca. ${rund(selvAndel, 1)} %. En større rækkeafstand ` +
          "giver færre paneler, men højere ydelse pr. panel. Afvej de to mod hinanden.",
        foreslaaetRaekkeafstandM: rund(pitch * 1.15, 2),
      });
    }
  }

  const kunSelvskygning = kastere.length === 0;

  return {
    modul: 8,
    navn: "Skyggeanalyse",
    status: kunSelvskygning ? "delvis" : "ok",
    advarsler,
    daekning: kunSelvskygning
      ? mangler("Danmarks Højdemodel / indtegning",
          "Kun selvskygning er beregnet. Omgivelser og tagopbygninger indgår ikke.")
      : hentet(`${kastere.length} skyggekaster(e) indgår`, "Brugerindtegning / Danmarks Højdemodel"),
    forudsaetninger: {
      elektriskForstaerkning: antagelse(ELEKTRISK_FORSTAERKNING, "Projekteringsskoen", {
        note: "Et delvist skygget modul taber mere end den skyggede areal-andel. " +
              "Den præcise værdi kræver elektrisk strengsimulering." }),
      antalSolpunkter: beregnet(punkter.length, "sol.js årssampling", { enhed: "stk" }),
      taerskelPct: antagelse(taerskel, "LAYOUT.maxSkyggetabPct", { enhed: "%" }),
    },
    resultat: {
      samletSkyggetabPct: beregnet(rund(samletTabPct, 2),
        "Indstrålingsvægtet gennemsnit over alle paneler", { enhed: "%",
        note: kunSelvskygning ? "Dækker kun selvskygning mellem rækker" : null }),
      vaersteePanelPct: beregnet(rund(Math.max(0, ...panelTab.map((t) => t.skyggetabPct)), 2), "Modul 8", { enhed: "%" }),
      antalPanelerOverTaerskel: beregnet(panelTab.filter((t) => t.skyggetabPct > taerskel).length,
        `Paneler med over ${taerskel} % tab`, { enhed: "stk" }),
    },
    panelTab,
    raekketab,
    overTaerskel: samletTabPct > taerskel,
    justeringsforslag: forslag,
  };
}

/* ------------------------------------------------------------------ */
/* Skyggegeometri                                                      */
/* ------------------------------------------------------------------ */

/**
 * Andel af et panels fodaftryk, der ligger i skygge fra objekterne.
 *
 * Skyggen af et objekt findes ved at projicere dets tagflade ned på
 * tagplanet langs solretningen. Panelet samples i et 3x3-net; det er
 * groft nok til at være hurtigt og fint nok til at fange, at en skygge
 * kun rammer en del af panelet.
 */
export function andelISkygge(panel, kastere, sol) {
  if (sol.z <= 0.02) return 1; // solen står praktisk talt i horisonten
  const proever = samplingspunkter(panel.hjoerner);
  let ramt = 0;
  for (const pkt of proever) {
    if (kastere.some((k) => punktISkyggeAf(pkt, k, sol))) ramt += 1;
  }
  return ramt / proever.length;
}

function punktISkyggeAf(punkt, kaster, sol) {
  // Skyggen af objektets overkant på tagplanet: hvert hjørne flyttes
  // t = h/sol.z langs den vandrette solretning, væk fra solen.
  const t = kaster.hoejdeM / sol.z;
  const skygge = kaster.polygon.map((p) => ({
    x: p.x - t * sol.x,
    y: p.y - t * sol.y,
  }));
  // Skyggefeltet spænder fra objektets fod til dets kastede overkant.
  return punktIPolygon(punkt, skygge) || punktIPolygon(punkt, spaendPolygon(kaster.polygon, skygge, punkt));
}

/**
 * Konvekst huld mellem fodaftryk og kastet overkant - det er der, skyggen
 * ligger, når objektet er lavt og solen høj.
 */
function spaendPolygon(fod, top, punkt) {
  // Billig test: ligger punktet i den konvekse indhylning af de to ringe?
  const alle = [...fod, ...top];
  return konveksIndhylning(alle);
}

function konveksIndhylning(punkter) {
  const p = punkter.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const kryds = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const nedre = [];
  for (const pt of p) {
    while (nedre.length >= 2 && kryds(nedre[nedre.length - 2], nedre[nedre.length - 1], pt) <= 0) nedre.pop();
    nedre.push(pt);
  }
  const oevre = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (oevre.length >= 2 && kryds(oevre[oevre.length - 2], oevre[oevre.length - 1], pt) <= 0) oevre.pop();
    oevre.push(pt);
  }
  nedre.pop(); oevre.pop();
  return nedre.concat(oevre);
}

function samplingspunkter(hjoerner) {
  const c = centroide(hjoerner);
  const b = bbox(hjoerner);
  const ud = [c];
  for (const fx of [0.2, 0.5, 0.8]) {
    for (const fy of [0.2, 0.5, 0.8]) {
      ud.push({
        x: b.minX + fx * (b.maxX - b.minX),
        y: b.minY + fy * (b.maxY - b.minY),
      });
    }
  }
  return ud;
}

function grupper(liste, noegle) {
  const m = new Map();
  for (const e of liste) {
    const k = noegle(e);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return [...m.entries()];
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
