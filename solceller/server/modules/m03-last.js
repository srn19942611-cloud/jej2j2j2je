/**
 * MODUL 3 - Vægt- og lastberegning
 *
 * Automatiseringsgrad: fuld (ren beregning), men resultatet er et
 * projekteringsgrundlag, ikke en statisk dokumentation.
 *
 * Beregner:
 *   - egenlast fra paneler og montagesystem (kg/m2 og kN/m2)
 *   - vindlast efter EN 1991-1-4 med dansk nationalt anneks
 *   - nødvendig ballast på fladt tag, hvis systemet ikke er gennemboret
 *   - snelast efter EN 1991-1-3
 *   - punktlaster i montagepunkterne
 *
 * VIGTIGE FORBEHOLD, som føres med i rapporten:
 *   1. Løftekoefficienten cf for et konkret ballastsystem kommer fra
 *      vindtunnelforsøg i systemets ETA. Værdien her er en generisk,
 *      konservativ værdi og erstatter ikke leverandørens beregning.
 *   2. Zoneinddelingen på taget (hjørne/kant/indre) er forenklet.
 *   3. Snelast mellem panelrækker kan give ophobning, som ikke er medregnet.
 */

import { VINDLAST, SNELAST, PANELTYPER, MONTAGESYSTEMER } from "../config/antagelser.js";
import { vindzone } from "../config/kommuner.js";
import { beregnet, antagelse, hentet, mangler, bekraeftet } from "../lib/kilde.js";
import { areal, bbox, tilRadian } from "../lib/geometri.js";

const G = 9.81; // m/s2

/**
 * @param {object} input
 * @param {object} input.layout         resultat fra modul 2
 * @param {number} input.bygningshøjdeM
 * @param {number} [input.kommunekode]
 * @param {string} [input.terrænkategori]
 * @param {number} [input.vb0Overstyring]
 * @param {number} [input.parapethøjdeM]
 */
export function koer(input) {
  const advarsler = [];
  const forbehold = [];
  const layout = input.layout;

  if (!layout?.paneler?.length) {
    return {
      modul: 3, navn: "Vægt- og lastberegning", status: "ufuldstaendig",
      blokerende: ["Intet layout fra modul 2 at beregne last for."], advarsler,
    };
  }

  const panel = PANELTYPER[input.paneltype] ?? PANELTYPER["standard-450"];
  const montagenoegle = input.montagesystem
    ?? (layout.forudsaetninger?.orientering?.vaerdi === "tagflade" ? "skraatag" : "ballast");
  const montage = MONTAGESYSTEMER[montagenoegle] ?? MONTAGESYSTEMER.ballast;

  const antal = layout.paneler.length;
  const panelArealM2 = antal * panel.breddeM * panel.laengdeM;
  const haeldning = layout.forudsaetninger?.haeldningGrader?.vaerdi ?? montage.haeldningGrader ?? 15;

  /* --- 3a. Egenlast ------------------------------------------------- */
  const panelVaegtKg = antal * panel.vaegtKg;
  const montageVaegtKg = panelArealM2 * montage.egenvaegtKgPrM2;
  const egenlastUdenBallastKg = panelVaegtKg + montageVaegtKg;

  /* --- 3b. Vindlast, EN 1991-1-4 ------------------------------------ */
  const hoejde = input.bygningshoejdeM;
  let vind = null;
  if (hoejde == null || !(hoejde > 0)) {
    advarsler.push(
      "Bygningshøjden er ikke oplyst. Vindlasten kan ikke beregnes, og dermed " +
      "heller ikke ballastbehovet. Højden kan læses af facadetegning eller opmåles."
    );
  } else {
    const zone = input.vb0Overstyring
      ? { vb0: input.vb0Overstyring, zone: "overstyret", beskrivelse: "Manuelt angivet" }
      : vindzone(input.kommunekode);
    vind = beregnVindlast({
      hoejdeM: hoejde,
      vb0: zone.vb0,
      terraenkategori: input.terraenkategori ?? VINDLAST.standardTerraenkategori,
    });
    vind.zone = zone;
  }

  /* --- 3c. Ballast --------------------------------------------------- */
  let ballast = null;
  if (!montage.gennemboring) {
    if (!vind) {
      advarsler.push("Ballastbehovet kan ikke beregnes uden vindlast.");
    } else {
      ballast = beregnBallast({ vind, panel, haeldning, montage, parapethoejdeM: input.parapethoejdeM ?? 0 });
      const fordeling = beregnZonefordeling(layout, hoejde);
      if (fordeling) {
        ballast.zonefordeling = fordeling;
        ballast.samletKg =
          fordeling.indre * ballast.indreKgPrPanel +
          fordeling.kant * ballast.kantKgPrPanel +
          fordeling.hjoerne * ballast.hjoerneKgPrPanel;
      } else {
        // Uden zoneinddeling regnes konservativt med kantzoneværdien overalt.
        ballast.zonefordeling = { indre: 0, kant: antal, hjoerne: 0, note: "konservativ" };
        ballast.samletKg = antal * ballast.kantKgPrPanel;
        advarsler.push(
          "Zoneinddelingen kunne ikke beregnes, så hele feltet er regnet med " +
          "kantzone-ballast. Det er konservativt og giver en for høj samlet vægt."
        );
      }
      forbehold.push(
        "Ballastmængden er beregnet med en generisk løftekoefficient (cf = " +
        `${VINDLAST.netLoefteKoefficientCf}). Den endelige ballastplan skal komme fra ` +
        "montagesystemets ETA-dokumenterede vindtunnelberegning for den konkrete " +
        "taggeometri, parapethøjde og zoneinddeling."
      );
    }
  }

  const ballastKg = ballast?.samletKg ?? 0;
  const samletVaegtKg = egenlastUdenBallastKg + ballastKg;

  /* --- 3d. Fordelt last --------------------------------------------- */
  const tagarealM2 = layout.geometri?.tagpolygonMeter ? areal(layout.geometri.tagpolygonMeter) : null;
  const overPanelfeltKgPrM2 = panelArealM2 > 0 ? samletVaegtKg / panelArealM2 : 0;
  const overTagKgPrM2 = tagarealM2 ? samletVaegtKg / tagarealM2 : null;

  /* --- 3e. Punktlaster ---------------------------------------------- */
  // Fire understøtningspunkter pr. panel er det almindelige for både
  // skinne- og ballastsystemer.
  const punkterPrPanel = input.punkterPrPanel ?? 4;
  const punktlastKg = (samletVaegtKg / antal) / punkterPrPanel;

  /* --- 3f. Snelast --------------------------------------------------- */
  const sne = beregnSnelast({ haeldning, fladt: montagenoegle !== "skraatag" });
  forbehold.push(
    "Snelast er regnet med formfaktor for den frie tagflade. Ophobning af sne " +
    "mellem panelrækker og bag parapet er ikke medregnet og skal vurderes af rådgiver."
  );

  /* --- 3g. Samlet lastkombination ------------------------------------ */
  const egenlastKNPrM2 = (overPanelfeltKgPrM2 * G) / 1000;
  const snelastKNPrM2 = sne.dimensionerendeKNPrM2;
  // Karakteristisk nyttelast på tag under solceller regnes ikke samtidig
  // med sne i den kombination, der er dimensionerende for taget.
  const samletKarakteristiskKNPrM2 = egenlastKNPrM2 + snelastKNPrM2;

  return {
    modul: 3,
    navn: "Vægt- og lastberegning",
    status: vind ? "ok" : "delvis",
    advarsler,
    forbehold,
    forudsaetninger: {
      paneltype: antagelse(panel.navn, panel.kilde),
      panelvaegtKg: antagelse(panel.vaegtKg, panel.kilde, { enhed: "kg/stk" }),
      montagesystem: antagelse(montage.navn, montage.kilde),
      montagevaegtKgPrM2: antagelse(montage.egenvaegtKgPrM2, montage.kilde, { enhed: "kg/m2" }),
      bygningshoejdeM: hoejde != null
        ? bekraeftet(hoejde, "Brugerangivelse / facadetegning", { enhed: "m" })
        : mangler("Facadetegning", "Bygningshøjde ikke oplyst"),
      terraenkategori: antagelse(
        input.terraenkategori ?? VINDLAST.standardTerraenkategori,
        "EN 1991-1-4 tabel 4.1",
        { note: VINDLAST.terraenkategorier[input.terraenkategori ?? VINDLAST.standardTerraenkategori]?.beskrivelse }
      ),
    },
    egenlast: {
      antalPaneler: beregnet(antal, "Modul 2", { enhed: "stk" }),
      panelvaegtKg: beregnet(rund(panelVaegtKg, 0), "Antal x panelvægt", { enhed: "kg" }),
      montagevaegtKg: beregnet(rund(montageVaegtKg, 0), "Panelareal x systemvægt", { enhed: "kg" }),
      egenlastUdenBallastKg: beregnet(rund(egenlastUdenBallastKg, 0), "Modul 3", { enhed: "kg" }),
    },
    vindlast: vind
      ? {
          grundvindhastighedVb0: hentet(vind.vb0, "EN 1991-1-4 DK NA (vindzone)", {
            enhed: "m/s", reference: vind.zone.beskrivelse,
          }),
          middelvindVmMPrS: beregnet(rund(vind.vm, 2), "vm(z) = cr(z) * co(z) * vb", { enhed: "m/s" }),
          turbulensintensitet: beregnet(rund(vind.iv, 3), "Iv(z) = kl / (co(z) * ln(z/z0))"),
          peakhastighedstrykQpKNPrM2: beregnet(rund(vind.qp, 3),
            "qp(z) = [1 + 7*Iv(z)] * 0,5 * rho * vm(z)^2", { enhed: "kN/m2" }),
          loeftekoefficientCf: antagelse(VINDLAST.netLoefteKoefficientCf, VINDLAST.kilde,
            { note: "Generisk værdi - skal erstattes af ETA-værdi for det valgte system" }),
          loeftPrPanelKN: beregnet(rund(vind.loeftPrPanelKN ?? 0, 3), "cf * qp * panelareal", { enhed: "kN" }),
        }
      : mangler("EN 1991-1-4", "Bygningshøjde mangler, så vindlasten ikke kan beregnes"),
    ballast: ballast
      ? {
          indreZoneKgPrPanel: beregnet(rund(ballast.indreKgPrPanel, 1), "Modul 3 ballastberegning", { enhed: "kg/panel" }),
          kantzoneKgPrPanel: beregnet(rund(ballast.kantKgPrPanel, 1), "Modul 3, kantzonefaktor "
            + VINDLAST.kantzoneForoegelse, { enhed: "kg/panel" }),
          hjoernezoneKgPrPanel: beregnet(rund(ballast.hjoerneKgPrPanel, 1), "Modul 3, hjørnezonefaktor "
            + VINDLAST.hjoernezoneForoegelse, { enhed: "kg/panel" }),
          samletKg: beregnet(rund(ballast.samletKg, 0), "Modul 3", { enhed: "kg" }),
          zonefordeling: beregnet(ballast.zonefordeling, "Zoneinddeling ud fra afstand til tagkant"),
        }
      : montage.gennemboring
        ? antagelse(0, "Gennemboret system - ingen ballast", { enhed: "kg" })
        : mangler("Modul 3", "Ballast kunne ikke beregnes"),
    snelast: {
      karakteristiskTerraenSkKNPrM2: antagelse(SNELAST.karakteristiskTerraenvaerdiKNPrM2, SNELAST.kilde, { enhed: "kN/m2" }),
      formfaktorMu: antagelse(sne.mu, "EN 1991-1-3 tabel 5.2"),
      dimensionerendeKNPrM2: beregnet(rund(sne.dimensionerendeKNPrM2, 3), "s = mu * Ce * Ct * sk", { enhed: "kN/m2" }),
    },
    resultat: {
      samletVaegtKg: beregnet(rund(samletVaegtKg, 0), "Egenlast + ballast", { enhed: "kg" }),
      fordeltOverPanelfeltKgPrM2: beregnet(rund(overPanelfeltKgPrM2, 1),
        "Samlet vægt / panelareal", { enhed: "kg/m2",
        note: "Det er dette tal, tagets bæreevne skal sammenholdes med i modul 5." }),
      fordeltOverHeleTagetKgPrM2: overTagKgPrM2 != null
        ? beregnet(rund(overTagKgPrM2, 1), "Samlet vægt / tagareal", { enhed: "kg/m2" })
        : mangler("Modul 1", "Tagareal ukendt"),
      egenlastKNPrM2: beregnet(rund(egenlastKNPrM2, 3), "kg/m2 * g", { enhed: "kN/m2" }),
      samletKarakteristiskKNPrM2: beregnet(rund(samletKarakteristiskKNPrM2, 3),
        "Egenlast + snelast", { enhed: "kN/m2" }),
      punktlastPrMontagepunktKg: beregnet(rund(punktlastKg, 1),
        `Samlet vægt / (antal paneler x ${punkterPrPanel} punkter)`, { enhed: "kg" }),
      montagepunkterIAlt: beregnet(antal * punkterPrPanel, "Modul 3", { enhed: "stk" }),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Eurocode-delberegninger                                             */
/* ------------------------------------------------------------------ */

/**
 * Peak-hastighedstryk qp(z) efter EN 1991-1-4 punkt 4.5.
 * Terrænformfaktoren kr og ruhedsfaktoren cr følger ligning 4.4 og 4.5.
 */
export function beregnVindlast({ hoejdeM, vb0, terraenkategori = "III", cDir = 1.0, cSeason = 1.0 }) {
  const kat = VINDLAST.terraenkategorier[terraenkategori] ?? VINDLAST.terraenkategorier.III;
  const z0II = VINDLAST.terraenkategorier.II.z0;
  const z = Math.max(hoejdeM, kat.zmin);

  const kr = 0.19 * Math.pow(kat.z0 / z0II, 0.07);
  const cr = kr * Math.log(z / kat.z0);
  const co = 1.0; // fladt terraen
  const vb = cDir * cSeason * vb0;
  const vm = cr * co * vb;
  const iv = VINDLAST.turbulensfaktor / (co * Math.log(z / kat.z0));
  const qp = ((1 + 7 * iv) * 0.5 * VINDLAST.luftdensitetKgPrM3 * vm * vm) / 1000; // kN/m2

  return { vb0, vb, z, kr, cr, vm, iv, qp, terraenkategori };
}

/**
 * Ballast pr. panel, så systemet ikke løftes eller vælter.
 *
 * Ligevægt (forenklet, uden hensyn til friktion mellem rækker):
 *   gamma_Q * F_løft  <=  gamma_G,inf * (m_egen + m_ballast) * g
 *
 * Løser for m_ballast. Friktionen mod tagmembranen tages med i den
 * vandrette ligevægt, som her er den mindre kritiske.
 */
export function beregnBallast({ vind, panel, haeldning, montage, parapethoejdeM = 0 }) {
  const panelArealM2 = panel.breddeM * panel.laengdeM;
  // Løftekraften virker vinkelret på modulet; kun den lodrette komposant
  // skal holdes nede af vægten.
  const cf = VINDLAST.netLoefteKoefficientCf;
  const loeftKN = cf * vind.qp * panelArealM2 * Math.cos(tilRadian(haeldning));
  vind.loeftPrPanelKN = loeftKN;

  // En parapet skærmer feltet; reduktionen er konservativt begrænset.
  const parapetreduktion = parapethoejdeM > 0
    ? Math.max(0.75, 1 - Math.min(0.25, parapethoejdeM * 0.25))
    : 1.0;

  const egenvaegtPrPanelKg = panel.vaegtKg + panelArealM2 * montage.egenvaegtKgPrM2;

  const kraevet = (zonefaktor) => {
    const loeftDim = VINDLAST.partialkoefficientVind * loeftKN * zonefaktor * parapetreduktion; // kN
    const modvaegtKN = (VINDLAST.partialkoefficientEgenlastGunstig * egenvaegtPrPanelKg * G) / 1000;
    const manglerKN = loeftDim - modvaegtKN;
    if (manglerKN <= 0) return 0;
    return (manglerKN * 1000) / (VINDLAST.partialkoefficientEgenlastGunstig * G); // kg
  };

  return {
    indreKgPrPanel: kraevet(1.0),
    kantKgPrPanel: kraevet(VINDLAST.kantzoneForoegelse),
    hjoerneKgPrPanel: kraevet(VINDLAST.hjoernezoneForoegelse),
    // Zonefordelingen udfyldes af beregnZonefordeling() når layoutet er kendt
    zonefordeling: null,
    samletKg: 0,
  };
}

/**
 * Fordeler panelerne på indre zone, kantzone og hjørnezone efter afstand
 * til tagkant, og lægger den samlede ballast sammen.
 *
 * Zonebredden er efter EN 1991-1-4 e/10, hvor e = min(b, 2h).
 */
export function beregnZonefordeling(layout, bygningshoejdeM) {
  const tag = layout.geometri?.tagpolygonMeter;
  if (!tag || !bygningshoejdeM) return null;
  const b = bbox(tag);
  const bredde = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  const e = Math.min(bredde, 2 * bygningshoejdeM);
  const zonebredde = e / 10;

  const tael = { indre: 0, kant: 0, hjoerne: 0 };
  for (const p of layout.paneler) {
    // Et panel hører til den skarpeste zone, nogen del af det rækker ind i.
    const punkter = p.hjoerner ?? [p.centrum];
    const dx = Math.min(...punkter.map((h) => Math.min(h.x - b.minX, b.maxX - h.x)));
    const dy = Math.min(...punkter.map((h) => Math.min(h.y - b.minY, b.maxY - h.y)));
    const iKantX = dx <= zonebredde, iKantY = dy <= zonebredde;
    if (iKantX && iKantY) tael.hjoerne += 1;
    else if (iKantX || iKantY) tael.kant += 1;
    else tael.indre += 1;
  }
  return { ...tael, zonebreddeM: rund(zonebredde, 2), eM: rund(e, 2) };
}

export function beregnSnelast({ haeldning, fladt }) {
  // mu1 efter EN 1991-1-3 tabel 5.2: 0,8 for 0-30 grader, aftager til 0 ved 60.
  const a = fladt ? 0 : (haeldning ?? 0);
  const mu = a <= 30 ? SNELAST.formfaktorFladtTag
    : a >= 60 ? 0
    : SNELAST.formfaktorFladtTag * ((60 - a) / 30);
  const ce = 1.0, ct = 1.0;
  return { mu: rund(mu, 2), dimensionerendeKNPrM2: mu * ce * ct * SNELAST.karakteristiskTerraenvaerdiKNPrM2 };
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
