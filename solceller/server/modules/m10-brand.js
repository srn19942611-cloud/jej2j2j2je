/**
 * MODUL 10 - Brandsikkerhed
 *
 * Automatiseringsgrad: fuld. Modulet er en ren regelmotor, der anvender
 * faste afstandskrav på layoutets geometri - der indgår ingen
 * adressespecifik data, og modulet kalder ingen eksterne tjenester.
 *
 * Modulet producerer to ting:
 *   1. En liste af konstateringer (opfyldt / ikke opfyldt / skal afklares)
 *   2. Konkrete brandveje som udelukkelseszoner, der sendes tilbage til
 *      modul 2, så layoutet kan genberegnes med gangene friholdt.
 */

import { BRANDREGLER, regel } from "../config/brandregler.js";
import { bbox, afstandTilRand, overlapper, bufferHjoerner, centroide } from "../lib/geometri.js";
import { beregnet, antagelse, mangler } from "../lib/kilde.js";

export const Status = Object.freeze({
  OPFYLDT: "opfyldt",
  IKKE_OPFYLDT: "ikke-opfyldt",
  SKAL_AFKLARES: "skal-afklares",
});

/**
 * @param {object} input
 * @param {object} input.layout
 * @param {Array} [input.forhindringer]  med `type` (ovenlys, brandventilation, tagopgang, ...)
 * @param {Array} [input.brandsektionsvægge]  {linjeMeter:[{x,y},{x,y}]}
 */
export function koer(input) {
  const layout = input.layout;
  const advarsler = [];
  if (!layout?.paneler?.length) {
    return { modul: 10, navn: "Brandsikkerhed", status: "ufuldstaendig",
      blokerende: ["Intet layout fra modul 2."], advarsler };
  }

  const tag = layout.geometri.tagpolygonMeter;
  const konstateringer = [];
  const udelukkelseszoner = [];

  /* --- 1. Friareal langs tagkant ------------------------------------ */
  const r1 = regel("friareal-tagkant");
  const kant = layout.forudsaetninger?.minAfstandTagkantM?.vaerdi ?? 0;
  const mindsteKantafstand = Math.min(
    ...layout.paneler.map((p) => Math.min(...p.hjoerner.map((h) => afstandTilRand(h, tag))))
  );
  konstateringer.push({
    regel: r1.id, navn: r1.navn, kravM: r1.kravM, alvor: r1.alvor, grundlag: r1.grundlag,
    maaltM: rund(mindsteKantafstand, 2),
    status: mindsteKantafstand >= r1.kravM - 0.01 ? Status.OPFYLDT : Status.IKKE_OPFYLDT,
    bemaerkning: mindsteKantafstand >= r1.kravM - 0.01
      ? `Mindste afstand fra panel til tagkant er ${rund(mindsteKantafstand, 2)} m.`
      : `Mindste afstand er ${rund(mindsteKantafstand, 2)} m, hvilket er under kravet på ${r1.kravM} m. ` +
        "Layoutet skal trækkes længere ind fra kanten.",
  });

  /* --- 2. Gennemgående brandveje ------------------------------------ */
  const r3 = regel("brandvej-afstand");
  const r2 = regel("brandvej-bredde");
  const b = bbox(tag);
  const feltBredde = b.maxX - b.minX;
  const feltDybde = b.maxY - b.minY;

  const brandveje = [];
  // Læg gange på tværs af den længste retning, så ingen del af feltet
  // ligger længere end kravet fra en fri gang.
  const laegGange = (laengde, akse) => {
    const antal = Math.max(0, Math.ceil(laengde / r3.kravM) - 1);
    const spring = antal > 0 ? laengde / (antal + 1) : 0;
    for (let i = 1; i <= antal; i++) {
      const pos = (akse === "x" ? b.minX : b.minY) + i * spring;
      const halv = r2.kravM / 2;
      brandveje.push(
        akse === "x"
          ? { akse, positionM: rund(pos, 2), polygonMeter: [
              { x: pos - halv, y: b.minY }, { x: pos + halv, y: b.minY },
              { x: pos + halv, y: b.maxY }, { x: pos - halv, y: b.maxY }] }
          : { akse, positionM: rund(pos, 2), polygonMeter: [
              { x: b.minX, y: pos - halv }, { x: b.maxX, y: pos - halv },
              { x: b.maxX, y: pos + halv }, { x: b.minX, y: pos + halv }] }
      );
    }
  };
  laegGange(feltBredde, "x");
  laegGange(feltDybde, "y");

  const spaerredeAfBrandvej = brandveje.length
    ? layout.paneler.filter((p) => brandveje.some((v) => overlapper(p.hjoerner, v.polygonMeter)))
    : [];

  konstateringer.push({
    regel: r3.id, navn: r3.navn, kravM: r3.kravM, alvor: r3.alvor, grundlag: r3.grundlag,
    maaltM: rund(Math.max(feltBredde, feltDybde), 1),
    status: brandveje.length === 0
      ? Status.OPFYLDT
      : spaerredeAfBrandvej.length === 0 ? Status.OPFYLDT : Status.IKKE_OPFYLDT,
    bemaerkning: brandveje.length === 0
      ? `Panelfeltet er ${rund(feltBredde,1)} x ${rund(feltDybde,1)} m og kræver ingen ` +
        `gennemgående gang ved et krav på ${r3.kravM} m.`
      : `Feltet kræver ${brandveje.length} gennemgående gang(e) på ${r2.kravM} m. ` +
        `${spaerredeAfBrandvej.length} paneler ligger i vejen og skal fjernes eller flyttes.`,
  });

  for (const v of brandveje) {
    udelukkelseszoner.push({ polygonMeter: v.polygonMeter, aarsag: `brandvej (${v.akse}=${v.positionM} m)` });
  }

  /* --- 3. Afstand til tagopbygninger med brandfunktion ---------------- */
  const typeTilRegel = {
    brandventilation: "afstand-brandventilation",
    roeglem: "afstand-brandventilation",
    ovenlys: "afstand-ovenlys",
    tagopgang: "afstand-tagopgang",
    adgangsluge: "afstand-tagopgang",
  };

  for (const f of input.forhindringer ?? []) {
    const regelId = typeTilRegel[String(f.type).toLowerCase()];
    if (!regelId || !f.polygonMeter?.length) continue;
    const r = regel(regelId);
    const zone = bufferHjoerner(f.polygonMeter, r.kravM);
    const konflikter = layout.paneler.filter((p) => overlapper(p.hjoerner, zone));
    konstateringer.push({
      regel: r.id, navn: `${r.navn} (${f.type})`, kravM: r.kravM, alvor: r.alvor, grundlag: r.grundlag,
      status: konflikter.length === 0 ? Status.OPFYLDT : Status.IKKE_OPFYLDT,
      bemaerkning: konflikter.length === 0
        ? `Ingen paneler inden for ${r.kravM} m.`
        : `${konflikter.length} paneler ligger nærmere end ${r.kravM} m og skal flyttes.`,
    });
    if (konflikter.length) {
      udelukkelseszoner.push({ polygonMeter: zone, aarsag: `brandkrav: ${f.type}` });
    }
  }

  /* --- 4. Brandsektionsvægge ---------------------------------------- */
  const rSekt = regel("afstand-brandsektionsvaeg");
  const vaegge = input.brandsektionsvaegge ?? [];
  if (vaegge.length === 0) {
    konstateringer.push({
      regel: rSekt.id, navn: rSekt.navn, kravM: rSekt.kravM, alvor: rSekt.alvor, grundlag: rSekt.grundlag,
      status: Status.SKAL_AFKLARES,
      bemaerkning:
        "Der er ikke oplyst nogen brandsektionsadskillelse. Placeringen fremgår ikke af " +
        "et åbent register og skal læses af brandplanen eller byggesagen. Ligger der en " +
        "adskillelse under panelfeltet, skal layoutet deles.",
    });
  } else {
    for (const v of vaegge) {
      const zone = korridorOmLinje(v.linjeMeter, rSekt.kravM);
      const konflikter = layout.paneler.filter((p) => overlapper(p.hjoerner, zone));
      konstateringer.push({
        regel: rSekt.id, navn: rSekt.navn, kravM: rSekt.kravM, alvor: rSekt.alvor, grundlag: rSekt.grundlag,
        status: konflikter.length === 0 ? Status.OPFYLDT : Status.IKKE_OPFYLDT,
        bemaerkning: konflikter.length === 0
          ? `Ingen paneler inden for ${rSekt.kravM} m af adskillelsen.`
          : `${konflikter.length} paneler ligger hen over eller tæt på adskillelsen.`,
      });
      if (konflikter.length) udelukkelseszoner.push({ polygonMeter: zone, aarsag: "brandsektionsadskillelse" });
    }
  }

  /* --- 5. Dokumentationskrav ----------------------------------------- */
  for (const r of BRANDREGLER.regler.filter((x) => x.erDokumentationskrav)) {
    konstateringer.push({
      regel: r.id, navn: r.navn, kravM: null, alvor: r.alvor, grundlag: r.grundlag,
      status: Status.SKAL_AFKLARES,
      bemaerkning:
        "Kravet kan ikke kontrolleres af geometrien. Det skal dokumenteres i " +
        "el-projektet og på situationsplanen til beredskabet.",
    });
  }

  const ikkeOpfyldt = konstateringer.filter((k) => k.status === Status.IKKE_OPFYLDT);
  const skalAfklares = konstateringer.filter((k) => k.status === Status.SKAL_AFKLARES);

  return {
    modul: 10,
    navn: "Brandsikkerhed",
    status: ikkeOpfyldt.length === 0 ? "ok" : "kraever-justering",
    advarsler,
    regelgrundlag: antagelse(`Brandregelsæt ${BRANDREGLER.version}`, "server/config/brandregler.js", {
      note: BRANDREGLER.generelForbehold, dato: BRANDREGLER.gaeldendeFra,
    }),
    resultat: {
      antalKonstateringer: beregnet(konstateringer.length, "Modul 10", { enhed: "stk" }),
      antalIkkeOpfyldt: beregnet(ikkeOpfyldt.length, "Modul 10", { enhed: "stk" }),
      antalSkalAfklares: beregnet(skalAfklares.length, "Modul 10", { enhed: "stk" }),
      samletVurdering: beregnet(
        ikkeOpfyldt.length > 0
          ? "Layoutet opfylder ikke alle brandtekniske afstandskrav og skal justeres"
          : skalAfklares.length > 0
            ? "Geometrien er i orden, men der udestår forhold, som kun kan afklares med beredskabet og el-projektet"
            : "Ingen brandtekniske konflikter fundet i geometrien",
        "Modul 10 regelmotor"
      ),
    },
    konstateringer,
    brandveje,
    udelukkelseszoner,
    kraeverJustering: ikkeOpfyldt.length > 0,
  };
}

/** Rektangulær korridor med given halvbredde om et linjestykke. */
function korridorOmLinje(linje, halvbredde) {
  const [a, b] = linje;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * halvbredde, ny = (dx / len) * halvbredde;
  return [
    { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny },
  ];
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
