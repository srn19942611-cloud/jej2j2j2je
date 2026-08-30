/**
 * MODUL 11 - Tagets tilstand
 *
 * Automatiseringsgrad: delvis. Alder og materiale kommer fra BBR; den
 * faktiske fysiske tilstand kan ikke afgøres af et register og kræver
 * enten et tilsynsdokument (modul 4) eller en besigtigelse.
 *
 * Modulet svarer på ét spørgsmål: når taget de 25-30 år, anlægget skal
 * sidde der? Hvis ikke, er det markant billigere at skifte tagpap FØR
 * panelerne monteres end at afmontere og genmontere anlægget bagefter.
 */

import { hentet, beregnet, antagelse, mangler, vaerdiEller, erMangel } from "../lib/kilde.js";
import { MONTAGESYSTEMER } from "../config/antagelser.js";

/**
 * Forventet teknisk levetid pr. tagdækning. Værdierne er
 * projekteringsskøn for normal vedligeholdelse i dansk klima.
 */
export const LEVETID_TAGDAEKNING = {
  "Tagpap med lille hældning": { aar: 30, note: "Toplag kan kræve fornyelse efter 20-25 år" },
  "Tagpap med stor hældning": { aar: 30, note: null },
  "Fibercement, herunder asbest (bølgeplader)": { aar: 40,
    note: "Asbestholdige plader kræver særlige forholdsregler ved gennemboring - " +
          "og gennemboring bør helt undgås." },
  "Fibercement uden asbest": { aar: 40, note: null },
  Betontagsten: { aar: 50, note: null },
  Tegl: { aar: 70, note: null },
  Metalplader: { aar: 45, note: "Klemmebeslag kan ofte undgå gennemboring" },
  Straatag: { aar: 30, note: "Solceller monteres normalt ikke på stråtag" },
  "Levende tag (grønt tag)": { aar: 35, note: "Kræver særlig opbygning under montagen" },
  Glas: { aar: 40, note: null },
  kilde: "Projekteringsskøn for teknisk levetid - SKAL VERIFICERES mod tagets faktiske opbygning",
};

export function koer(input) {
  const advarsler = [];
  const m1 = input.modul1 ?? {};
  const anlaegLevetidAar = input.anlaegLevetidAar ?? 25;
  const iAar = new Date().getFullYear();

  const materiale = m1.tagdaekningsmateriale;
  const opfoert = m1.opfoerelsesaar;
  const ombygget = m1.ombygningsaar;

  /* --- Alder --------------------------------------------------------- */
  const sidsteAendring = Math.max(
    vaerdiEller(ombygget, 0), vaerdiEller(opfoert, 0)
  ) || null;

  const tagAlderAar = sidsteAendring ? iAar - sidsteAendring : null;
  const alderKilde = erMangel(ombygget) && erMangel(opfoert)
    ? mangler("BBR via Datafordeleren", "Hverken opførelses- eller ombygningsår er udfyldt i BBR")
    : beregnet(tagAlderAar, "BBR-årstal sammenholdt med i dag", { enhed: "aar",
        note: "BBR's ombygningsår dækker om- og tilbygning generelt, ikke nødvendigvis " +
              "en tagudskiftning. Alderen er derfor en øvre grænse for tagets alder, " +
              "ikke tagets faktiske alder." });

  if (tagAlderAar != null) {
    advarsler.push(
      "Tagets alder er udledt af BBR's årstal. BBR registrerer ikke tagudskiftninger " +
      "selvstændigt, så taget kan være både nyere og ældre end tallet viser. " +
      "Bekræft med tilsynsrapport eller ejerens oplysninger."
    );
  }

  /* --- Restlevetid ---------------------------------------------------- */
  const materialeNavn = vaerdiEller(materiale, null);
  const levetid = materialeNavn ? LEVETID_TAGDAEKNING[materialeNavn] : null;
  let restlevetidAar = null, vurdering, anbefaling;

  if (levetid && tagAlderAar != null) {
    restlevetidAar = levetid.aar - tagAlderAar;
    if (restlevetidAar >= anlaegLevetidAar) {
      vurdering = "Taget forventes at holde hele anlæggets levetid";
      anbefaling = "Ingen tagarbejder nødvendige før montage, forudsat at en besigtigelse bekræfter tilstanden.";
    } else if (restlevetidAar >= anlaegLevetidAar * 0.6) {
      vurdering = "Taget holder sandsynligvis ikke hele anlæggets levetid";
      anbefaling =
        `Restlevetiden er skønnet til ca. ${restlevetidAar} år mod anlæggets ${anlaegLevetidAar} år. ` +
        "Overvej at forny tagdækning samtidig med montagen - af- og genmontering af " +
        "et anlæg midt i levetiden koster typisk mere end merprisen ved at gøre det nu.";
    } else {
      vurdering = "Taget bør fornyes før montage";
      anbefaling =
        `Restlevetiden er skønnet til ca. ${Math.max(0, restlevetidAar)} år. ` +
        "Tagdækningen bør fornyes før anlægget monteres.";
    }
  } else {
    vurdering = "Kan ikke vurderes";
    anbefaling =
      "Tagets alder eller materiale mangler i BBR. Restlevetiden skal fastlægges ved " +
      "besigtigelse eller ud fra tilsynsdokumentation, før montagetypen vælges.";
    advarsler.push(
      "Restlevetiden kunne ikke beregnes. Uden den kan det ikke afgøres, om taget " +
      "bør fornyes før montage."
    );
  }

  /* --- Montagetype og garanti ---------------------------------------- */
  const montagenoegle = input.montagesystem
    ?? (input.tagtype === "skraat" ? "skraatag" : "ballast");
  const montage = MONTAGESYSTEMER[montagenoegle] ?? MONTAGESYSTEMER.ballast;

  const garantiforhold = montage.gennemboring
    ? {
        montagetype: "Gennemboret",
        paavirkning:
          "Hver gennemføring bryder tagmembranen og skal inddækkes af en autoriseret " +
          "tagentreprenør. Membranens producentgaranti bortfalder typisk, hvis arbejdet " +
          "udføres af andre end en godkendt entreprenør.",
        anbefaling:
          "Indhent skriftlig accept fra tagleverandøren, og lad tagentreprenøren udføre " +
          "inddækningerne. Dokumentér antallet og placeringen af gennemføringer.",
      }
    : {
        montagetype: "Ballasteret",
        paavirkning:
          "Membranen brydes ikke, men den belastes punktvis og udsættes for slid, hvor " +
          "systemet ligger an. Ballasten øger den blivende last på taget.",
        anbefaling:
          "Brug beskyttelsesmåtter under alle anlægspunkter, og bekræft over for " +
          "tagleverandøren at systemet er foreneligt med membranen. Kontrollér at den " +
          "beregnede ballast (modul 3) kan bæres (modul 5).",
      };

  if (materialeNavn?.includes("asbest")) {
    advarsler.push(
      "BBR angiver fibercement med asbest. Gennemboring og bearbejdning er " +
      "underlagt særlige arbejdsmiljøregler. Vælg en montageløsning uden " +
      "gennemboring, og inddrag en rådgiver med asbesterfaring."
    );
  }

  return {
    modul: 11,
    navn: "Tagets tilstand",
    status: restlevetidAar != null ? "delvis" : "ufuldstaendig",
    advarsler,
    tagdaekningsmateriale: materiale ?? mangler("BBR via Datafordeleren", "Ikke oplyst"),
    opfoerelsesaar: opfoert ?? mangler("BBR via Datafordeleren", "Ikke oplyst"),
    ombygningsaar: ombygget ?? mangler("BBR via Datafordeleren", "Ikke oplyst"),
    tagAlderAar: alderKilde,
    forventetLevetidAar: levetid
      ? antagelse(levetid.aar, LEVETID_TAGDAEKNING.kilde, { enhed: "aar", note: levetid.note })
      : mangler("Levetidstabel", "Materialet er ukendt, så levetiden kan ikke slås op"),
    restlevetidAar: restlevetidAar != null
      ? beregnet(restlevetidAar, "Forventet levetid minus alder", { enhed: "aar" })
      : mangler("Modul 11", "Kan ikke beregnes uden både alder og materiale"),
    anlaegLevetidAar: antagelse(anlaegLevetidAar, "Projektforudsaetning", { enhed: "aar" }),
    vurdering: beregnet(vurdering, "Modul 11", { note: anbefaling }),
    montageOgGaranti: garantiforhold,
    fysiskTilstand: mangler(
      "Besigtigelse eller tilsynsrapport",
      "Revner, blæredannelse, stående vand, fastgørelse af eksisterende inddækninger og " +
      "membranens vedhæftning kan ikke afgøres fra et register. Der skal foreligge enten " +
      "et tilsynsdokument (modul 4) eller en fysisk besigtigelse."
    ),
    tjekliste: [
      "Er der foretaget en fysisk besigtigelse af tagfladen?",
      "Foreligger der en tilstandsrapport eller et tagtilsyn?",
      "Er tagets opbygning (isolering, damspærre, underlag) kendt?",
      "Er der stående vand eller utilstrækkeligt fald?",
      "Er tagleverandørens accept af montagetypen indhentet skriftligt?",
      "Er afvanding og tagbrønde friholdt i layoutet?",
    ],
  };
}
