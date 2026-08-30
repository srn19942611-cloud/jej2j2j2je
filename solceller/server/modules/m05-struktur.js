/**
 * MODUL 5 - Strukturel vurdering
 *
 * Automatiseringsgrad: delvis. Selve sammenligningen er automatisk, men den
 * afhænger fuldstændig af et tal, der kun kan komme fra modul 4 - og modul 4
 * kan ikke automatiseres.
 *
 * Modulet må lande på én af tre konklusioner, og aldrig noget derimellem:
 *
 *   INDEN_FOR_KAPACITET   - der findes en brugerbekræftet bæreevne, og den
 *                           tilføjede last ligger under den med margin
 *   KRÆVER_VURDERING     - der findes et tal, men lasten ligger tæt på
 *                           eller over det
 *   UTILSTRÆKKELIG_DOK   - der er ikke bekræftet et tal at regne imod
 *
 * Uanset konklusion gælder forbeholdet: en automatisk sammenligning er ikke
 * en statisk dokumentation. For CC2 og CC3 - hvor erhvervsbygninger som
 * butikker typisk ligger - skal dokumentationen underskrives af en
 * certificeret statiker.
 */

import { beregnet, bekraeftet, mangler, erPaalideligt, vaerdiEller, erMangel } from "../lib/kilde.js";

export const Konklusion = Object.freeze({
  INDEN_FOR_KAPACITET: "inden-for-dokumenteret-kapacitet",
  KRAEVER_VURDERING: "kraever-yderligere-teknisk-vurdering",
  UTILSTRAEKKELIG_DOK: "utilstraekkelig-dokumentation-fundet",
});

export const KONKLUSIONSTEKST = {
  [Konklusion.INDEN_FOR_KAPACITET]: "Inden for dokumenteret kapacitet",
  [Konklusion.KRAEVER_VURDERING]: "Kræver yderligere teknisk vurdering",
  [Konklusion.UTILSTRAEKKELIG_DOK]: "Utilstrækkelig dokumentation fundet",
};

/**
 * Sikkerhedsmargin: hvor stor en del af den dokumenterede kapacitet den
 * tilføjede last må optage, før vi ikke længere vil sige "inden for".
 * Marginen dækker, at aflæsningen af en gammel tegning er usikker, og at
 * lastberegningen selv bygger på generiske systemværdier.
 */
export const UDNYTTELSESGRAENSE = 0.8;

export function koer(input) {
  const advarsler = [];
  const m3 = input.modul3, m4 = input.modul4;

  const tilfoejetKNPrM2 = vaerdiEller(m3?.resultat?.egenlastKNPrM2, null);
  const tilfoejetKgPrM2 = vaerdiEller(m3?.resultat?.fordeltOverPanelfeltKgPrM2, null);
  const baereevne = m4?.dokumenteretBaereevne;

  if (tilfoejetKNPrM2 == null) {
    return {
      modul: 5, navn: "Strukturel vurdering", status: "ufuldstaendig",
      blokerende: ["Modul 3 har ikke leveret en tilføjet last at sammenligne med."],
      advarsler, konklusion: Konklusion.UTILSTRAEKKELIG_DOK,
    };
  }

  const forbehold = [
    "Denne vurdering er en sammenligning af to tal. Den er ikke en statisk " +
    "dokumentation og kan ikke træde i stedet for en sådan.",
    "Efter BR18 skal statisk dokumentation for højere konsekvensklasser " +
    "underskrives af en certificeret statiker. Erhvervsbygninger som butikker " +
    "ligger typisk i CC2 eller CC3.",
    "Sammenligningen ser på fordelt last. Punktlaster i montagepunkterne " +
    "(modul 3) skal vurderes særskilt mod den bærende konstruktions " +
    "spændvidder og oplægspunkter.",
    "Lokal ophobning af sne mellem panelrækker er ikke medregnet.",
  ];

  /* --- Ingen bekræftet dokumentation -------------------------------- */
  if (!erPaalideligt(baereevne)) {
    advarsler.push(
      "Der er ingen brugerbekræftet dokumentation for tagets bæreevne. " +
      "Vurderingen kan ikke gennemføres, og rapporten kan ikke konkludere på statikken."
    );
    return {
      modul: 5,
      navn: "Strukturel vurdering",
      status: "kraever-brugerhandling",
      konklusion: Konklusion.UTILSTRAEKKELIG_DOK,
      konklusionstekst: KONKLUSIONSTEKST[Konklusion.UTILSTRAEKKELIG_DOK],
      advarsler,
      forbehold,
      tilfoejetLast: {
        kNPrM2: beregnet(tilfoejetKNPrM2, "Modul 3", { enhed: "kN/m2" }),
        kgPrM2: beregnet(tilfoejetKgPrM2, "Modul 3", { enhed: "kg/m2" }),
      },
      dokumenteretKapacitet: baereevne ?? mangler("Modul 4", "Ingen bekræftet bæreevne"),
      begrundelse:
        "Der er ikke fremskaffet og bekræftet en dokumenteret bæreevne for taget. " +
        "Uden den kan det ikke afgøres, om anlægget kan bæres. Det er ikke en " +
        "sikkerhedsmargin, der mangler - det er selve sammenligningsgrundlaget.",
      naesteSkridt: [
        "Søg byggesagen i det arkiv, modul 4 udpeger, og find de statiske beregninger.",
        "Er sagen ikke offentligt tilgængelig, søg aktindsigt hos kommunen.",
        "Spørg ejeren eller driftsafdelingen efter tegningsmateriale.",
        "Findes dokumentationen ikke, skal en rådgivende ingeniør opmåle " +
          "konstruktionen og beregne bæreevnen. For et erhvervstag er det ofte " +
          "den eneste farbare vej.",
      ],
    };
  }

  /* --- Sammenligning -------------------------------------------------- */
  const kapacitet = baereevne.vaerdi;
  const udnyttelse = kapacitet > 0 ? tilfoejetKNPrM2 / kapacitet : Infinity;
  const restKapacitet = kapacitet - tilfoejetKNPrM2;

  let konklusion, begrundelse;
  if (udnyttelse <= UDNYTTELSESGRAENSE) {
    konklusion = Konklusion.INDEN_FOR_KAPACITET;
    begrundelse =
      `Den tilføjede fordelte last på ${dk(tilfoejetKNPrM2, 3)} kN/m² optager ` +
      `${dk(udnyttelse * 100, 1)} % af den dokumenterede kapacitet på ` +
      `${dk(kapacitet, 3)} kN/m². Der er ${dk(restKapacitet, 3)} kN/m² tilbage. ` +
      `Det ligger inden for den margin på ${dk(UDNYTTELSESGRAENSE * 100, 0)} %, ` +
      "værktøjet arbejder med.";
  } else if (udnyttelse <= 1.0) {
    konklusion = Konklusion.KRAEVER_VURDERING;
    begrundelse =
      `Den tilføjede last optager ${dk(udnyttelse * 100, 1)} % af den dokumenterede ` +
      "kapacitet. Det er under kapaciteten, men uden den margin, der skal dække " +
      "usikkerheden i aflæsningen af dokumentationen og i de generiske " +
      "systemværdier i lastberegningen. En rådgiver skal regne efter.";
  } else {
    konklusion = Konklusion.KRAEVER_VURDERING;
    begrundelse =
      `Den tilføjede last på ${dk(tilfoejetKNPrM2, 3)} kN/m² OVERSTIGER den ` +
      `dokumenterede kapacitet på ${dk(kapacitet, 3)} kN/m² ` +
      `(${dk(udnyttelse * 100, 1)} %). Anlægget kan ikke bæres som projekteret. ` +
      "Enten skal lasten ned - færre paneler, mindre ballast eller gennemboret " +
      "montage - eller konstruktionen skal forstærkes.";
  }

  if (konklusion !== Konklusion.INDEN_FOR_KAPACITET) {
    advarsler.push(
      "Den strukturelle vurdering er ikke gået igennem. Rapporten må ikke " +
      "fremstilles som et færdigt grundlag, før forholdet er afklaret af en rådgiver."
    );
  }

  const forslag = [];
  if (udnyttelse > UDNYTTELSESGRAENSE) {
    const ballastKg = vaerdiEller(m3?.ballast?.samletKg, 0);
    if (ballastKg > 0) {
      forslag.push(
        "Ballasten udgør " +
        `${dk((ballastKg / vaerdiEller(m3.resultat.samletVaegtKg, ballastKg)) * 100, 0)} % ` +
        "af den samlede vægt. En gennemboret montage fjerner ballasten helt, men " +
        "bryder tagmembranen - se modul 11 om garantiforhold."
      );
    }
    forslag.push("Færre paneler, eller et layout der holder sig til de bærende linjer.");
    forslag.push("Et letter modul- og montagesystem.");
    forslag.push("Forstærkning af tagkonstruktionen efter rådgiverens anvisning.");
  }

  return {
    modul: 5,
    navn: "Strukturel vurdering",
    status: "ok",
    konklusion,
    konklusionstekst: KONKLUSIONSTEKST[konklusion],
    advarsler,
    forbehold,
    tilfoejetLast: {
      kNPrM2: beregnet(rund(tilfoejetKNPrM2, 3), "Modul 3", { enhed: "kN/m2" }),
      kgPrM2: beregnet(rund(tilfoejetKgPrM2, 1), "Modul 3", { enhed: "kg/m2" }),
      punktlastKg: m3?.resultat?.punktlastPrMontagepunktKg ?? null,
    },
    dokumenteretKapacitet: baereevne,
    udnyttelsesgrad: beregnet(rund(udnyttelse * 100, 1),
      "Tilføjet last / dokumenteret kapacitet", { enhed: "%" }),
    restkapacitet: beregnet(rund(restKapacitet, 3),
      "Dokumenteret kapacitet minus tilføjet last", { enhed: "kN/m2" }),
    margingraense: beregnet(rund(UDNYTTELSESGRAENSE * 100, 0),
      "Modul 5 sikkerhedsmargin", { enhed: "%",
      note: "Dækker usikkerhed i aflæsning af dokumentation og i generiske systemværdier." }),
    begrundelse,
    handlemuligheder: forslag,
    grundlagsoversigt: byggGrundlagsoversigt(m3, m4),
  };
}

/**
 * Den vigtigste tabel i hele rapporten: hvilke tal i konklusionen kommer fra
 * en bekræftet kilde, og hvilke er beregnet eller antaget.
 */
function byggGrundlagsoversigt(m3, m4) {
  const raekker = [
    { navn: "Dokumenteret bæreevne", dp: m4?.dokumenteretBaereevne },
    { navn: "Tilføjet fordelt last", dp: m3?.resultat?.egenlastKNPrM2 },
    { navn: "Panelvaegt", dp: m3?.forudsaetninger?.panelvaegtKg },
    { navn: "Montagesystemets vægt", dp: m3?.forudsaetninger?.montagevaegtKgPrM2 },
    { navn: "Ballast", dp: m3?.ballast?.samletKg ?? null },
    { navn: "Bygningshøjde (vindlast)", dp: m3?.forudsaetninger?.bygningshoejdeM },
    { navn: "Løftekoefficient", dp: m3?.vindlast?.loeftekoefficientCf },
    { navn: "Snelast", dp: m3?.snelast?.dimensionerendeKNPrM2 },
  ];
  return raekker
    .filter((r) => r.dp)
    .map((r) => ({
      navn: r.navn,
      vaerdi: r.dp.vaerdi,
      enhed: r.dp.enhed,
      herkomst: r.dp.herkomst,
      kilde: r.dp.kilde,
      reference: r.dp.reference,
      kritisk: r.navn === "Dokumenteret bæreevne",
    }));
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Dansk talformat med komma som decimalskilletegn - rapporten er på dansk. */
const dk = (v, d = 2) =>
  rund(v, d).toLocaleString("da-DK", { maximumFractionDigits: d });
