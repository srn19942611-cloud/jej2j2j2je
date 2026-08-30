/**
 * MODUL 14 - Drift og rapportering
 *
 * Automatiseringsgrad: fuld.
 *
 * To leverancer:
 *   1. CO2-reduktion ud fra produktionsestimatet og en fast emissionsfaktor
 *   2. En eksportstruktur, der kan kobles på et overvågningsværktøj, så
 *      det projekterede anlæg kan sammenlignes med den faktiske drift
 */

import { CO2 } from "../config/antagelser.js";
import { beregnet, antagelse, mangler, vaerdiEller } from "../lib/kilde.js";

export function koer(input) {
  const advarsler = [];
  const m7 = input.modul7;
  const aarsproduktion = vaerdiEller(m7?.resultat?.aarsproduktionKWh, null);

  if (aarsproduktion == null) {
    return { modul: 14, navn: "Drift og rapportering", status: "ufuldstaendig",
      blokerende: ["Intet produktionsestimat fra modul 7."], advarsler };
  }

  if (m7.resultat.aarsproduktionKWh.herkomst === "antagelse") {
    advarsler.push(
      "CO2-tallet bygger på et modelleret produktionsestimat, ikke på PVGIS. " +
      "Usikkerheden slår direkte igennem i CO2-reduktionen."
    );
  }

  const faktor = input.emissionsfaktorGramPrKWh ?? CO2.emissionsfaktorGramPrKWh;
  const levetid = input.levetidAar ?? 25;
  const samletProduktion = vaerdiEller(m7.resultat.samletProduktionOverLevetidKWh, aarsproduktion * levetid);

  const aarligTon = (aarsproduktion * faktor) / 1e6;
  const levetidTon = (samletProduktion * faktor) / 1e6;

  return {
    modul: 14,
    navn: "Drift og rapportering",
    status: "ok",
    advarsler,
    co2: {
      emissionsfaktorGramPrKWh: antagelse(faktor, CO2.faktorKilde, { enhed: "g CO2/kWh",
        dato: CO2.gaeldendeFra }),
      aarligReduktionTon: beregnet(rund(aarligTon, 1),
        "Årsproduktion x emissionsfaktor", { enhed: "ton CO2/år" }),
      reduktionOverLevetidTon: beregnet(rund(levetidTon, 1),
        `Samlet produktion over ${levetid} år x emissionsfaktor`, { enhed: "ton CO2" }),
      forbehold:
        "Reduktionen er regnet som fortrængt elforbrug ganget med en fast " +
        "emissionsfaktor. Den danske elmiks bliver renere over anlæggets levetid, " +
        "så den reelle fortrængning aftager år for år. Livscyklusudledningen fra " +
        "fremstilling af panelerne er ikke fratrukket.",
    },
    overvaagning: {
      beskrivelse:
        "Strukturen herunder er projektets referencetilstand. Kobles den på et " +
        "overvågningsværktøj, kan den faktiske produktion holdes op mod den " +
        "projekterede, og et afvigende månedsforhold kan fange skygge, smuds eller " +
        "en streng, der er faldet ud.",
      eksport: byggEksport(input),
    },
    esg: {
      beskrivelse: "Felter til bæredygtighedsrapportering på porteføljeniveau.",
      felter: {
        vedvarendeEnergiProduktionKWhPrAar: rund(aarsproduktion, 0),
        undgaaetCO2TonPrAar: rund(aarligTon, 1),
        installeretKapacitetKWp: vaerdiEller(m7.resultat.installeretEffektKWp, null),
        egetforbrugsandelPct: vaerdiEller(input.modul12?.resultat?.egetforbrugsandelPct, null),
        idriftsaettelsesaar: null,
      },
    },
  };
}

function byggEksport(input) {
  const m1 = input.modul1 ?? {}, m2 = input.modul2 ?? {}, m7 = input.modul7 ?? {};
  return {
    version: 1,
    genereret: new Date().toISOString(),
    anlaeg: {
      adresse: vaerdiEller(m1.adresse, null),
      position: vaerdiEller(m1.position, null),
      kommune: vaerdiEller(m1.kommune, null),
      installeretKWp: vaerdiEller(m2.resultat?.installeretEffektKWp, null),
      antalPaneler: vaerdiEller(m2.resultat?.antalPaneler, null),
      orientering: vaerdiEller(m2.forudsaetninger?.orientering, null),
      haeldningGrader: vaerdiEller(m2.forudsaetninger?.haeldningGrader, null),
    },
    reference: {
      aarsproduktionKWh: vaerdiEller(m7.resultat?.aarsproduktionKWh, null),
      specifikYdelseKWhPrKWp: vaerdiEller(m7.resultat?.specifikYdelseKWhPrKWp, null),
      maanedligKWh: vaerdiEller(m7.resultat?.maanedligKWh, null),
      degraderingsprofil: m7.aarsserie ?? null,
      kilde: m7.datakilde?.kilde ?? null,
    },
    noegletalAtOvervaage: [
      { navn: "Specifik ydelse", enhed: "kWh/kWp/måned", formaal: "Fanger generel underydelse" },
      { navn: "Månedsafvigelse fra reference", enhed: "%", formaal: "Fanger skygge og tilsmudsning" },
      { navn: "Strengspredning", enhed: "%", formaal: "Fanger en enkelt streng, der er faldet ud" },
      { navn: "Egetforbrugsandel", enhed: "%", formaal: "Følger økonomien i modul 12" },
      { navn: "Nedetid", enhed: "timer", formaal: "Grundlag for tilgængelighedstabet i modul 7" },
    ],
  };
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
