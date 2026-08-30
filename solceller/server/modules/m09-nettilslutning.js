/**
 * MODUL 9 - Nettilslutning og elinstallation
 *
 * Automatiseringsgrad: MANUEL/ASSISTERET.
 *
 * Der findes ingen bekræftet åben API til at slå netselskab op på en
 * adresse. Modulet bruger derfor en internt vedligeholdt kommune-tabel, og
 * resultatet er INDIKATIVT indtil brugeren har bekræftet det. Flere kommuner
 * er delt mellem to selskaber, så selv en korrekt kommune-tabel kan give det
 * forkerte selskab for en konkret adresse.
 *
 * Kapacitet i nettet kan under ingen omstændigheder afgøres af værktøjet.
 * Et bindende tilsagn kommer kun fra netselskabet efter en forespørgsel på
 * det konkrete målepunkt.
 */

import { NETSELSKAB_PR_KOMMUNE, kommuneNavn, Sikkerhed } from "../config/kommuner.js";
import { LAYOUT } from "../config/antagelser.js";
import { hentet, beregnet, antagelse, mangler, bekraeftet, vaerdiEller } from "../lib/kilde.js";

/**
 * Energinets prioritering af nettilslutninger. Gengivet som kontekst, ikke
 * som et tilsagn - og bevidst uden tal, fordi vilkårene ændrer sig.
 */
export const NETKONTEKST = {
  overskrift: "Kø og prioritering ved nettilslutning",
  punkter: [
    "Tilslutning af produktionsanlæg sker efter en prioriteringsmodel, hvor " +
    "projekter, der er langt fremme - 'grydeklare' - rykker frem i køen.",
    "Modenhed dokumenteres typisk med rådighed over arealet, myndighedsgodkendelser " +
    "og et bindende bestillingsgrundlag. Byggetilladelsen er derfor selv et element " +
    "i at komme frem i køen.",
    "For anlæg, der alene dækker eget forbrug bag måleren, er tilslutningen " +
    "normalt enklere end for anlæg, der leverer til nettet.",
    "Netselskabet kan stille krav om effektbegrænsning, hvis nettet i området er belastet.",
  ],
  forbehold:
    "Punkterne er generel kontekst om, hvordan tilslutning håndteres. De er ikke " +
    "et tilsagn om kapacitet, tidsfrist eller vilkår, og de kan være ændret. " +
    "Kontakt netselskabet for det, der gælder for den konkrete adresse.",
};

export function koer(input) {
  const advarsler = [];
  const kommunekode = input.kommunekode ?? null;
  const layout = input.layout;
  const effektKWp = vaerdiEller(layout?.resultat?.installeretEffektKWp, null);

  /* --- Netselskab ---------------------------------------------------- */
  let netselskab;
  const kandidater = kommunekode ? NETSELSKAB_PR_KOMMUNE[Number(kommunekode)] : null;

  if (input.bekraeftetNetselskab) {
    netselskab = bekraeftet(input.bekraeftetNetselskab, "Bekræftet af bruger", {
      note: "Bekræftet mod målepunktet eller netselskabets eget områdeopslag.",
    });
  } else if (!kommunekode) {
    netselskab = mangler("Intern kommune-tabel", "Kommunen er ikke bestemt i modul 1");
    advarsler.push("Netselskabet kan ikke slås op, fordi kommunen ikke er bestemt.");
  } else if (!kandidater?.length) {
    netselskab = mangler("Intern kommune-tabel",
      `Kommunen ${kommuneNavn(kommunekode) ?? kommunekode} er ikke i tabellen. Slå selskabet op ` +
      "på målerens adresse hos Eloverblik eller i netselskabernes områdeoversigt.");
    advarsler.push(
      `Der er ingen tabelpost for ${kommuneNavn(kommunekode) ?? "kommunen"}. Netselskabet skal slås op manuelt.`
    );
  } else {
    netselskab = antagelse(
      kandidater.length === 1 ? kandidater[0] : kandidater.join(" eller "),
      "Intern kommune-tabel (indikativ)",
      {
        note: kandidater.length > 1
          ? "Kommunen er delt mellem flere netselskaber. Det rigtige selskab afgøres af " +
            "målepunktets placering og SKAL bekræftes."
          : "Indikativt opslag på kommuneniveau. SKAL bekræftes mod målepunktet, " +
            "da forsyningsområder ikke følger kommunegrænser præcist.",
      }
    );
    advarsler.push(
      `Netselskabet er sat indikativt til "${kandidater.join(" eller ")}". ` +
      "Bekræft det, før det skrives i ansøgningen - en forkert modtager forsinker sagen."
    );
  }

  /* --- Streng- og inverterdesign -------------------------------------- */
  const strengdesign = layout?.paneler?.length ? foreslaaStrenge(layout) : null;

  /* --- Teknikrum ------------------------------------------------------ */
  const teknikrum = layout?.paneler?.length ? foreslaaTeknikrum(layout, strengdesign) : null;

  /* --- Tilslutningsform ------------------------------------------------ */
  const tilslutning = vurderTilslutning(effektKWp, input.eksisterendeHovedsikringA);

  return {
    modul: 9,
    navn: "Nettilslutning og elinstallation",
    status: netselskab.herkomst === "brugerbekraeftet" ? "ok" : "kraever-bekraeftelse",
    advarsler,
    netselskab,
    kommune: kommunekode
      ? hentet(kommuneNavn(kommunekode) ?? String(kommunekode), "Modul 1")
      : mangler("Modul 1", "Kommune ikke bestemt"),
    kapacitet: mangler(
      "Netselskabet",
      "Kapacitet i nettet kan ikke slås op automatisk og kan ikke afgøres af " +
      "værktøjet. Der skal sendes en tilslutningsforespørgsel på det konkrete " +
      "målepunkt. Værktøjet afgiver ingen forventning om kapacitet."
    ),
    tilslutningsform: tilslutning,
    strengdesign,
    teknikrum,
    netkontekst: NETKONTEKST,
    naesteSkridt: [
      "Bekræft netselskabet på målepunktet (fx via Eloverblik eller netselskabets områdeopslag).",
      "Send en tilslutningsforespørgsel med anlæggets effekt, målepunkts-ID og forventet idriftsættelse.",
      "Afklar om anlægget skal effektbegrænses, og om der er tilslutningsbidrag.",
      "Få en autoriseret elinstallatør til at færdigprojektere streng- og inverterdesign.",
      "Tilmeld anlægget i stamdataregistret ved idriftsættelse.",
    ],
    forbehold:
      "Modulet leverer et projekteringsgrundlag. Bindende tilsagn om kapacitet, " +
      "tilslutningsvilkår og tidsfrister kan kun gives af netselskabet.",
  };
}

/**
 * Foreslår en strengopdeling. Panelerne grupperes rækkevis, så en streng
 * ligger i samme orientering og får samme skyggeforhold - det er den
 * vigtigste regel, fordi et skygget modul trækker hele strengen ned.
 */
export function foreslaaStrenge(layout) {
  const min = LAYOUT.minPanelerPrStreng, max = LAYOUT.maxPanelerPrStreng;
  const efterOrientering = new Map();
  for (const p of layout.paneler) {
    const noegle = `${p.orientering ?? "syd"}|${p.række}`;
    if (!efterOrientering.has(noegle)) efterOrientering.set(noegle, []);
    efterOrientering.get(noegle).push(p);
  }

  const strenge = [];
  for (const [noegle, paneler] of efterOrientering) {
    const [orientering, raekke] = noegle.split("|");
    let rest = paneler.slice();
    while (rest.length) {
      // Undgå en sidste ministreng: fordel jævnt når resten er lille.
      const antal = rest.length <= max ? rest.length
        : rest.length < max + min ? Math.ceil(rest.length / 2)
        : max;
      const del = rest.splice(0, antal);
      strenge.push({
        id: `S${strenge.length + 1}`,
        orientering, raekke: Number(raekke),
        antalPaneler: del.length,
        effektKWp: rund(del.reduce((s, p) => s + p.effektWp, 0) / 1000, 2),
        panelIder: del.map((p) => p.id),
        underMinimum: del.length < min,
      });
    }
  }

  const smaa = strenge.filter((s) => s.underMinimum);
  const samletKWp = strenge.reduce((s, x) => s + s.effektKWp ?? 0, 0);

  return {
    antalStrenge: beregnet(strenge.length, "Modul 9 strengopdeling", { enhed: "stk" }),
    panelerPrStreng: antagelse(`${min}-${max}`, "LAYOUT-konfiguration", {
      note: "Det reelle interval bestemmes af inverterens MPPT-spændingsvindue og " +
            "modulets spændingsdata ved dansk minimums- og maksimumstemperatur. " +
            "Det skal færdigberegnes af en autoriseret elinstallatør." }),
    strenge,
    bemaerkninger: [
      "Strengene er lagt rækkevis, så paneler i samme streng har samme orientering " +
      "og stort set samme skyggeforhold.",
      smaa.length
        ? `${smaa.length} streng(e) har færre end ${min} paneler. Saml dem, eller giv dem en egen MPPT.`
        : "Ingen strenge under minimumslængden.",
      "Spændingskontrol ved -10 og +70 grader C er IKKE udført her og skal laves " +
      "mod den valgte inverters datablad.",
    ],
    forbehold:
      "Strengdesignet er et udgangspunkt for projekteringen, ikke et færdigt eldesign.",
  };
}

/**
 * Foreslår en placering af teknikrum/inverter ud fra panelfeltets tyngdepunkt.
 * Kortere DC-træk giver mindre tab og billigere kabel.
 */
export function foreslaaTeknikrum(layout, strengdesign) {
  const paneler = layout.paneler;
  const tx = paneler.reduce((s, p) => s + p.centrum.x, 0) / paneler.length;
  const ty = paneler.reduce((s, p) => s + p.centrum.y, 0) / paneler.length;
  const maxAfstand = Math.max(...paneler.map((p) => Math.hypot(p.centrum.x - tx, p.centrum.y - ty)));

  return {
    anbefaletPlaceringMeter: beregnet({ x: rund(tx, 1), y: rund(ty, 1) },
      "Panelfeltets tyngdepunkt", { note: "Koordinat i tagets lokale plan (modul 1)." }),
    laengsteDcTraekM: beregnet(rund(maxAfstand, 1), "Afstand fra tyngdepunkt til fjerneste panel",
      { enhed: "m", note: "Det faktiske kabeltræ bliver længere, fordi kablet følger rækker og fald." }),
    krav: [
      "Ventileret rum eller skab - invertere afgiver varme og taber ydelse ved høj temperatur.",
      "Adgang for service uden at skulle betræde panelfeltet.",
      "Nærhed til hovedtavlen, så AC-trækket bliver kort.",
      "Plads til DC-afbryder og til den nødafbryder, redningsberedskabet skal kunne betjene (modul 10).",
    ],
    forbehold: "Placeringen er et geometrisk forslag. Den endelige placering afgøres af " +
      "bygningens installationer og af adgangsforholdene.",
  };
}

function vurderTilslutning(effektKWp, hovedsikringA) {
  if (effektKWp == null) {
    return mangler("Modul 2", "Anlæggets effekt er ikke kendt");
  }
  const stroemA = (effektKWp * 1000) / (Math.sqrt(3) * 400);
  const forhold = {
    anlaegKWp: beregnet(rund(effektKWp, 2), "Modul 2", { enhed: "kWp" }),
    forventetVekselstroemA: beregnet(rund(stroemA, 1),
      "P / (sqrt(3) x 400 V) ved fuld ydelse", { enhed: "A" }),
    hovedsikringA: hovedsikringA
      ? bekraeftet(hovedsikringA, "Brugerangivelse", { enhed: "A" })
      : mangler("Eltavle / elinstallatør", "Eksisterende hovedsikring er ikke oplyst"),
  };
  forhold.vurdering = hovedsikringA
    ? beregnet(
        stroemA > hovedsikringA * 0.9
          ? "Anlægget ligger tæt på eller over den eksisterende hovedsikring - tilslutningen skal vurderes af elinstallatør"
          : "Anlægget ligger inden for den eksisterende hovedsikring",
        "Modul 9 sammenligning",
        { note: "Sammenligningen er grov. Samtidighed med bygningens eget forbrug og " +
                "netselskabets krav til effektbegrænsning skal med i den endelige vurdering." })
    : mangler("Modul 9", "Kan ikke vurderes uden hovedsikringens størrelse");
  return forhold;
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
