/**
 * MODUL 2 - Solcelle-layout generator
 *
 * Automatiseringsgrad: fuld (ren geometri).
 *
 * Placerer paneler på tagfladen under hensyn til:
 *   - orientering (sydvendt eller øst/vest på fladt tag)
 *   - mindsteafstand til tagkant
 *   - forhindringer på taget (ovenlys, ventilation, skorsten, teknikrum)
 *   - rækkeafstand mod selvskygning
 *   - brandveje og friarealer, som modul 10 sender retur
 *   - skyggeramte felter, som modul 8 sender retur
 *
 * Modulet er rent og uden bivirkninger: samme input giver samme layout.
 * Den iterative del ligger i orchestrator.js, som kalder modulet igen med
 * udvidede `udelukkelseszoner` og evt. ændret orientering.
 */

import {
  bbox, centroide, rektangelHjoerner, rektangelInde, overlapper,
  bufferHjoerner, tilRadian, areal, punktIPolygon,
} from "../lib/geometri.js";
import { raekkeafstand } from "../lib/sol.js";
import { PANELTYPER, MONTAGESYSTEMER, LAYOUT } from "../config/antagelser.js";
import { beregnet, antagelse, bekraeftet, mangler } from "../lib/kilde.js";

export const ORIENTERINGER = Object.freeze({
  SYD: "syd",
  OEST_VEST: "oest-vest",
  TAGFLADE: "tagflade", // paralleit med et skraat tag
});

/**
 * @param {object} input
 * @param {Array<{x,y}>} input.tagpolygonMeter
 * @param {Array} [input.forhindringer]
 * @param {"fladt"|"skråt"} input.tagtype
 * @param {number} [input.taghældningGrader]  kun skråt tag
 * @param {number} [input.tagAzimutGrader]     kun skråt tag, 0 = syd
 * @param {number} input.lat
 * @param {string} [input.paneltype]
 * @param {string} [input.montagesystem]
 * @param {string} [input.orientering]
 * @param {Array<Array<{x,y}>>} [input.udelukkelseszoner]  fra modul 8 og 10
 * @param {number} [input.maxPaneler]
 */
export function koer(input) {
  const advarsler = [];
  const tag = input.tagpolygonMeter;
  if (!tag || tag.length < 3) {
    return {
      modul: 2, navn: "Solcelle-layout", status: "ufuldstaendig",
      blokerende: ["Ingen tagpolygon fra modul 1."], advarsler,
    };
  }

  const panel = PANELTYPER[input.paneltype] ?? PANELTYPER["standard-450"];
  const fladt = input.tagtype !== "skraat";
  const montagenoegle = input.montagesystem ?? (fladt ? "ballast" : "skraatag");
  const montage = MONTAGESYSTEMER[montagenoegle] ?? MONTAGESYSTEMER.ballast;

  const orientering = input.orientering
    ?? (fladt ? ORIENTERINGER.SYD : ORIENTERINGER.TAGFLADE);

  const kantafstand = input.minAfstandTagkantM
    ?? Math.max(montage.minAfstandTagkantM, LAYOUT.minAfstandTagkantM);

  // Hældning: på fladt tag bestemmes den af montagesystemet, på skråt tag
  // af taget selv.
  const haeldning = fladt
    ? (input.haeldningGrader ?? montage.haeldningGrader ?? 15)
    : (input.taghaeldningGrader ?? null);

  if (!fladt && haeldning == null) {
    return {
      modul: 2, navn: "Solcelle-layout", status: "ufuldstaendig",
      blokerende: ["Taghældning mangler. Den skal bekræftes i modul 1 før et skråt tag kan dimensioneres."],
      advarsler,
    };
  }

  /* --- Panelgeometri i planet -------------------------------------- */
  // Paneler monteres stående (portræt) på skråt tag og liggende
  // (landskab) på fladt tag, hvor lav højde over taget giver mindre vindlast.
  const staaende = !fladt;
  const modulBredde = staaende ? panel.breddeM : panel.laengdeM;
  const modulDybde = staaende ? panel.laengdeM : panel.breddeM;

  // Fodaftrykket på taget er den projicerede dybde, ikke panelets længde.
  const projiceretDybde = fladt
    ? modulDybde * Math.cos(tilRadian(haeldning))
    : modulDybde;

  /* --- Rækkeafstand ----------------------------------------------- */
  let pitch, pitchNote;
  if (fladt && orientering === ORIENTERINGER.SYD) {
    pitch = raekkeafstand({
      panelLaengde: modulDybde,
      haeldningGrader: haeldning,
      solhoejdeGrader: LAYOUT.dimensionerendeSolhoejdeGrader,
    });
    pitchNote =
      `Beregnet for dimensionerende solhøjde ${LAYOUT.dimensionerendeSolhoejdeGrader} grader. ` +
      LAYOUT.dimensionerendeSolhoejdeBegrundelse;
  } else if (fladt && orientering === ORIENTERINGER.OEST_VEST) {
    // Øst/vest står ryg mod ryg; kun et lille servicegab mellem par.
    pitch = 2 * projiceretDybde + 0.15;
    pitchNote =
      "Øst/vest-opstilling ryg mod ryg. Panelerne skygger ikke for hinanden på " +
      "tværs af rækken, så rækkeafstanden er bestemt af servicegang, ikke af sol.";
  } else {
    pitch = modulDybde + LAYOUT.gabMellemPanelerSkraatagM;
    pitchNote = "Paneler ligger parallelt med tagfladen; kun montagegab mellem rækker.";
  }

  /* --- Rotation af griddet ----------------------------------------- */
  // På fladt tag lægges rækkerne øst-vest (paneler mod syd). På skråt
  // tag følger griddet tagets fald.
  const gridRotation = fladt ? 0 : tilRadian(-(input.tagAzimutGrader ?? 0));
  const om = centroide(tag);

  /* --- Forhindringer og udelukkelseszoner -------------------------- */
  const spaerrezoner = [];
  for (const f of input.forhindringer ?? []) {
    if (f.polygonMeter?.length >= 3) {
      spaerrezoner.push({
        hjoerner: bufferHjoerner(f.polygonMeter, LAYOUT.minAfstandForhindringM),
        aarsag: `forhindring: ${f.type ?? "ukendt"}`,
      });
    }
  }
  for (const z of input.udelukkelseszoner ?? []) {
    const hj = z.polygonMeter ?? z;
    if (hj?.length >= 3) {
      spaerrezoner.push({ hjoerner: hj, aarsag: z.aarsag ?? "udelukkelseszone" });
    }
  }

  /* --- Placering --------------------------------------------------- */
  const gab = LAYOUT.gabMellemPanelerIRaekkeM;
  const kolonneBredde = modulBredde + gab;
  const b = bbox(tag);
  const margin = Math.max(b.maxX - b.minX, b.maxY - b.minY);

  const paneler = [];
  const afvist = { udenforTag: 0, forhindring: 0, udelukkelseszone: 0 };
  let raekkeNr = 0;

  for (let y = b.minY - margin; y <= b.maxY + margin; y += pitch) {
    raekkeNr += 1;
    let kolonneNr = 0;
    let panelerIRaekke = 0;
    for (let x = b.minX - margin; x <= b.maxX + margin; x += kolonneBredde) {
      kolonneNr += 1;
      const rekt = { x, y, bredde: modulBredde, hoejde: projiceretDybde, rotation: gridRotation };
      const hjoerner = rektangelHjoerner(rekt, om);

      if (!rektangelInde(hjoerner, tag, kantafstand)) { afvist.udenforTag += 1; continue; }

      const ramt = spaerrezoner.find((z) => overlapper(hjoerner, z.hjoerner));
      if (ramt) {
        if (ramt.aarsag.startsWith("forhindring")) afvist.forhindring += 1;
        else afvist.udelukkelseszone += 1;
        continue;
      }

      paneler.push({
        id: `P${raekkeNr}-${kolonneNr}`,
        raekke: raekkeNr, kolonne: kolonneNr,
        hjoerner,
        centrum: centroide(hjoerner),
        effektWp: panel.effektWp,
        haeldningGrader: haeldning,
        azimutGrader: panelAzimut(orientering, input.tagAzimutGrader, panelerIRaekke),
        orientering: orientering === ORIENTERINGER.OEST_VEST
          ? (raekkeNr % 2 === 0 ? "vest" : "oest")
          : orientering,
      });
      panelerIRaekke += 1;
    }
  }

  // Fjern tomme rækker fra nummereringen, så tegningen bliver læsbar.
  omnummerér(paneler);

  if (input.maxPaneler && paneler.length > input.maxPaneler) {
    paneler.length = input.maxPaneler;
    advarsler.push(`Layoutet er begrænset til ${input.maxPaneler} paneler efter ønske.`);
  }

  const effektKWp = (paneler.length * panel.effektWp) / 1000;
  const panelArealM2 = paneler.length * panel.breddeM * panel.laengdeM;
  const tagarealM2 = areal(tag);

  if (paneler.length === 0) {
    advarsler.push(
      "Der kunne ikke placeres et eneste panel. Tjek tagets størrelse, " +
      "kantafstanden og de indtegnede forhindringer."
    );
  }

  return {
    modul: 2,
    navn: "Solcelle-layout",
    status: paneler.length > 0 ? "ok" : "uden-resultat",
    advarsler,
    forudsaetninger: {
      paneltype: antagelse(panel.navn, panel.kilde, { reference: `${panel.effektWp} Wp` }),
      montagesystem: antagelse(montage.navn, montage.kilde),
      orientering: beregnet(orientering, "Modul 2 layoutvalg"),
      haeldningGrader: fladt
        ? antagelse(haeldning, montage.kilde, { enhed: "grader" })
        : bekraeftet(haeldning, "Taghældning fra modul 1", { enhed: "grader" }),
      minAfstandTagkantM: antagelse(kantafstand, "Projekteringsregel i antagelser.js", { enhed: "m" }),
      raekkeafstandM: beregnet(rund(pitch, 3), "Selvskygningsberegning", { enhed: "m", note: pitchNote }),
    },
    resultat: {
      antalPaneler: beregnet(paneler.length, "Modul 2 layoutalgoritme", { enhed: "stk" }),
      installeretEffektKWp: beregnet(rund(effektKWp, 2), "Antal paneler x moduleffekt", { enhed: "kWp" }),
      panelArealM2: beregnet(rund(panelArealM2, 1), "Modul 2", { enhed: "m2" }),
      tagarealM2: beregnet(rund(tagarealM2, 1), "Modul 1", { enhed: "m2" }),
      udnyttelsesgradPct: beregnet(
        rund(tagarealM2 > 0 ? (panelArealM2 / tagarealM2) * 100 : 0, 1),
        "Panelareal / tagareal", { enhed: "%" }
      ),
      antalRaekker: beregnet(new Set(paneler.map((p) => p.raekke)).size, "Modul 2", { enhed: "stk" }),
    },
    paneler,
    afvistePositioner: afvist,
    spaerrezoner: spaerrezoner.map((z) => ({ aarsag: z.aarsag, hjoerner: z.hjoerner })),
    geometri: { tagpolygonMeter: tag, panelBreddeM: modulBredde, panelDybdeM: projiceretDybde },
  };
}

function panelAzimut(orientering, tagAzimut, indexIRaekke) {
  if (orientering === ORIENTERINGER.OEST_VEST) return null; // saettes pr. panel af raekkepariteten
  if (orientering === ORIENTERINGER.TAGFLADE) return tagAzimut ?? 0;
  return 0; // syd
}

function omnummerér(paneler) {
  const raekker = [...new Set(paneler.map((p) => p.raekke))].sort((a, b) => a - b);
  const kort = new Map(raekker.map((r, i) => [r, i + 1]));
  const taeller = new Map();
  for (const p of paneler) {
    const ny = kort.get(p.raekke);
    const k = (taeller.get(ny) ?? 0) + 1;
    taeller.set(ny, k);
    p.raekke = ny; p.kolonne = k; p.id = `P${ny}-${k}`;
  }
}

/**
 * Øst/vest-varianten skal have azimut sat efter rækkepariteten, hvilket
 * først kan gøres når rækkerne er endeligt nummereret.
 */
export function saetOestVestAzimut(layout) {
  if (layout.forudsaetninger?.orientering?.vaerdi !== ORIENTERINGER.OEST_VEST) return layout;
  for (const p of layout.paneler) {
    p.azimutGrader = p.raekke % 2 === 0 ? 90 : -90; // vest / øst
    p.orientering = p.raekke % 2 === 0 ? "vest" : "oest";
  }
  return layout;
}

/**
 * Sammenligner to layoutvarianter og vælger den med størst forventet
 * udbytte. Bruges af orchestrator når den prøver syd mod øst/vest.
 */
export function vaelgBedste(varianter, vaegtning = (v) => v.resultat.installeretEffektKWp.vaerdi) {
  const gyldige = varianter.filter((v) => v?.status === "ok");
  if (!gyldige.length) return varianter[0] ?? null;
  return gyldige.reduce((a, b) => (vaegtning(b) > vaegtning(a) ? b : a));
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
