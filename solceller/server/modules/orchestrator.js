/**
 * ORCHESTRATOR - kører modulerne i den rigtige rækkefølge og håndterer
 * tilbagekoblingen fra modul 8 (skygge) og modul 10 (brand) til modul 2.
 *
 * Rækkefølge:
 *   1-3   kerneflow: adresse -> layout -> last
 *   8, 10 giver justeringer tilbage til 2; layoutet genberegnes, indtil det
 *         er stabilt eller vi rammer loftet for antal gennemløb
 *   7     produktion på det endelige layout (med skyggetabet indregnet)
 *   4-5   dokumentation og strukturel vurdering
 *   9, 11, 12, 13, 14  køres på det færdige layout
 *   6     rapporten til sidst, da den trækker på alle de øvrige
 *
 * De uafhængige moduler køres parallelt, hvor de kan.
 */

import * as m01 from "./m01-adresse.js";
import * as m02 from "./m02-layout.js";
import * as m03 from "./m03-last.js";
import * as m04 from "./m04-dokumentation.js";
import * as m05 from "./m05-struktur.js";
import * as m06 from "./m06-rapport.js";
import * as m07 from "./m07-produktion.js";
import * as m08 from "./m08-skygge.js";
import * as m09 from "./m09-nettilslutning.js";
import * as m10 from "./m10-brand.js";
import * as m11 from "./m11-tagtilstand.js";
import * as m12 from "./m12-oekonomi.js";
import * as m13 from "./m13-myndighed.js";
import * as m14 from "./m14-drift.js";
import { vaerdiEller, kildeStatistik } from "../lib/kilde.js";
import { LAYOUT } from "../config/antagelser.js";

export const MAX_GENNEMLOEB = 3;

/**
 * @param {object} input  se server/index.js for feltbeskrivelser
 * @param {(besked:string)=>void} [logfør]
 */
export async function koerAlt(input, logfoer = () => {}) {
  const start = Date.now();
  const moduler = {};
  const forloeb = [];

  /* --- Modul 1 ------------------------------------------------------- */
  logfoer("Modul 1: adresseopslag og tagdata");
  const m1 = await m01.koer(input);
  moduler.m1 = m1;

  if (m1.status === "ufuldstaendig") {
    return afslut({ moduler, forloeb, start, input, stoppet: "modul 1" });
  }

  const lat = m1.position.vaerdi.lat, lon = m1.position.vaerdi.lon;
  const kommunekode = vaerdiEller(m1.kommunekode, null);
  const tagpolygon = m1.tag.polygonMeter;
  const tagtype = vaerdiEller(m1.tag.tagtype, "fladt");
  const forhindringer = m1.tag.forhindringer ?? [];

  /* --- Modul 2 + iterativ tilbagekobling fra 8 og 10 ----------------- */
  const layoutInput = {
    tagpolygonMeter: tagpolygon,
    forhindringer,
    tagtype,
    taghaeldningGrader: vaerdiEller(m1.tag.haeldningGrader, null),
    tagAzimutGrader: vaerdiEller(m1.tag.tagAzimutGrader, 0),
    lat,
    paneltype: input.paneltype,
    montagesystem: input.montagesystem,
    orientering: input.orientering,
    maxPaneler: input.maxPaneler,
    udelukkelseszoner: [],
  };

  let layout = null, skygge = null, brand = null;
  let gennemloeb = 0;

  while (gennemloeb < MAX_GENNEMLOEB) {
    gennemloeb += 1;
    logfoer(`Modul 2: layout (gennemløb ${gennemloeb})`);

    layout = m02.saetOestVestAzimut(m02.koer(layoutInput));
    if (layout.status !== "ok") break;

    // Modul 8 og 10 er uafhængige af hinanden og kan køre parallelt.
    logfoer("Modul 8 og 10: skygge og brandsikkerhed");
    [skygge, brand] = await Promise.all([
      Promise.resolve(m08.koer({
        layout, lat, lon, forhindringer,
        nabobygninger: input.nabobygninger ?? [],
        taerskelPct: input.skyggetaerskelPct,
        finberegning: input.finberegning,
      })),
      Promise.resolve(m10.koer({
        layout, forhindringer,
        brandsektionsvaegge: input.brandsektionsvaegge ?? [],
      })),
    ]);

    const nyeZoner = [
      ...(brand.udelukkelseszoner ?? []),
      ...(skygge.justeringsforslag ?? [])
        .filter((f) => f.type === "fjern-paneler")
        .flatMap((f) => f.udelukkelseszoner ?? []),
    ];

    const foer = layoutInput.udelukkelseszoner.length;
    // Kun zoner vi ikke allerede har, så løkken ikke kører i ring.
    for (const z of nyeZoner) {
      if (!layoutInput.udelukkelseszoner.some((e) => sammeZone(e, z))) {
        layoutInput.udelukkelseszoner.push(z);
      }
    }
    const tilfoejet = layoutInput.udelukkelseszoner.length - foer;

    forloeb.push({
      gennemloeb,
      antalPaneler: vaerdiEller(layout.resultat.antalPaneler, 0),
      effektKWp: vaerdiEller(layout.resultat.installeretEffektKWp, 0),
      skyggetabPct: vaerdiEller(skygge.resultat?.samletSkyggetabPct, null),
      brandKonflikter: vaerdiEller(brand.resultat?.antalIkkeOpfyldt, 0),
      nyeUdelukkelseszoner: tilfoejet,
    });

    if (tilfoejet === 0) {
      logfoer(`Layoutet er stabilt efter ${gennemloeb} gennemløb`);
      break;
    }
    logfoer(`${tilfoejet} nye udelukkelseszoner - layoutet genberegnes`);
  }

  moduler.m2 = layout;
  moduler.m8 = skygge;
  moduler.m10 = brand;

  if (layout?.status !== "ok") {
    return afslut({ moduler, forloeb, start, input, stoppet: "modul 2" });
  }

  /* --- Modul 3 ------------------------------------------------------- */
  logfoer("Modul 3: vægt- og lastberegning");
  moduler.m3 = m03.koer({
    layout,
    bygningshoejdeM: input.bygningshoejdeM,
    kommunekode,
    terraenkategori: input.terraenkategori,
    vb0Overstyring: input.vb0Overstyring,
    parapethoejdeM: input.parapethoejdeM,
    paneltype: input.paneltype,
    montagesystem: input.montagesystem,
  });

  /* --- Modul 7 ------------------------------------------------------- */
  logfoer("Modul 7: produktionsestimat");
  moduler.m7 = await m07.koer({
    lat, lon, layout,
    paneltype: input.paneltype,
    skyggetabPct: vaerdiEller(skygge?.resultat?.samletSkyggetabPct, 0),
    levetidAar: input.levetidAar,
  });

  /* --- Moduler der kan køre parallelt ------------------------------- */
  logfoer("Modul 4, 9, 11, 12, 13: dokumentation, net, tag, økonomi, myndighed");
  const [m4, m9, m11r, m12r, m13r] = await Promise.all([
    m04.koer({
      kommunekode,
      adresse: vaerdiEller(m1.adresse, null),
      matrikelnummer: input.matrikelnummer,
      ejerlav: input.ejerlav,
      bekraeftedeDokumenter: input.bekraeftedeDokumenter,
    }),
    Promise.resolve(m09.koer({
      layout, kommunekode,
      bekraeftetNetselskab: input.bekraeftetNetselskab,
      eksisterendeHovedsikringA: input.eksisterendeHovedsikringA,
    })),
    Promise.resolve(m11.koer({
      modul1: m1, tagtype,
      montagesystem: input.montagesystem,
      anlaegLevetidAar: input.levetidAar,
    })),
    m12.koer({
      modul7: moduler.m7, modul3: moduler.m3, lat, lon,
      maalepunktId: input.maalepunktId,
      aarsforbrugKWh: input.aarsforbrugKWh,
      oekonomiOverstyring: input.oekonomiOverstyring,
    }),
    m13.koer({
      lat, lon, layout,
      skelpolygonMeter: input.skelpolygonMeter,
    }),
  ]);

  moduler.m4 = m4;
  moduler.m9 = m9;
  moduler.m11 = m11r;
  moduler.m12 = m12r;
  moduler.m13 = m13r;

  /* --- Modul 5 ------------------------------------------------------- */
  logfoer("Modul 5: strukturel vurdering");
  moduler.m5 = m05.koer({ modul3: moduler.m3, modul4: m4 });

  /* --- Modul 14 ------------------------------------------------------ */
  logfoer("Modul 14: CO₂ og drift");
  moduler.m14 = m14.koer({
    modul1: m1, modul2: layout, modul7: moduler.m7, modul12: m12r,
    levetidAar: input.levetidAar,
  });

  return afslut({ moduler, forloeb, start, input });
}

/** Modul 6 køres for sig, så rapporten kan genskabes uden at køre alt om. */
export function byggRapport(sag) {
  return m06.koer(sag);
}

function afslut({ moduler, forloeb, start, input, stoppet = null }) {
  const sag = {
    version: "0.1",
    genereret: new Date().toISOString(),
    varighedMs: Date.now() - start,
    ansoeger: input.ansoeger ?? null,
    sagsnummer: input.sagsnummer ?? null,
    stoppetVed: stoppet,
    moduler,
    forloeb,
    statistik: kildeStatistik(moduler),
    samletStatus: samletStatus(moduler, stoppet),
  };
  sag.rapport = m06.koer(sag);
  return sag;
}

function samletStatus(moduler, stoppet) {
  if (stoppet) return { status: "stoppet", note: `Analysen stoppede ved ${stoppet}.` };
  const blokerende = Object.values(moduler).flatMap((m) => m?.blokerende ?? []);
  const kraeverHandling = Object.entries(moduler)
    .filter(([, m]) => m?.status === "kraever-brugerhandling" || m?.status === "kraever-bekraeftelse")
    .map(([k, m]) => m.navn ?? k);
  const delvise = Object.entries(moduler)
    .filter(([, m]) => m?.status === "delvis")
    .map(([k, m]) => m.navn ?? k);

  return {
    status: blokerende.length ? "blokeret" : kraeverHandling.length ? "kraever-handling" : "gennemfoert",
    blokerende,
    kraeverBrugerhandling: kraeverHandling,
    delvise,
  };
}

function sammeZone(a, b) {
  const pa = a.polygonMeter ?? [], pb = b.polygonMeter ?? [];
  if (pa.length !== pb.length) return false;
  return pa.every((p, i) =>
    Math.abs(p.x - pb[i].x) < 1e-6 && Math.abs(p.y - pb[i].y) < 1e-6);
}
