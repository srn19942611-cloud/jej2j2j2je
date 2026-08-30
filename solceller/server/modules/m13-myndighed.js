/**
 * MODUL 13 - Myndighed og omgivelser
 *
 * Automatiseringsgrad: fuld for lokalplanopslaget.
 *
 * Lokalplaner hentes fra Plandata.dk's WFS, som er offentligt og uden login.
 * Der søges på punktet, og de fundne planer gennemgås for bestemmelser om
 * solenergianlæg. Naboorientering afledes som en geometrisk regel af
 * afstanden til skel - selve udsendelsen er en administrativ proces uden for
 * værktøjet.
 */

import { hentTekst, hentJson, query, KildeFejl } from "../lib/http.js";
import { PLANDATA } from "../config/datakilder.js";
import { hentet, beregnet, antagelse, mangler } from "../lib/kilde.js";
import { afstandTilRand, bbox } from "../lib/geometri.js";

/** WGS84 -> ETRS89 / UTM zone 32N, som Plandata leverer geometri i. */
export function tilUtm32(lat, lon) {
  const a = 6378137.0, f = 1 / 298.257223563;
  const k0 = 0.9996, lon0 = (9 * Math.PI) / 180;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const φ = (lat * Math.PI) / 180, λ = (lon * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2;
  const C = ep2 * Math.cos(φ) ** 2;
  const A = Math.cos(φ) * (λ - lon0);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * φ
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * φ)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * φ)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * φ));
  const easting = k0 * N * (A + ((1 - T + C) * A ** 3) / 6
    + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(φ) * ((A ** 2) / 2
    + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24
    + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  return { x: easting, y: northing };
}

export async function koer(input) {
  const advarsler = [];
  const { lat, lon } = input;
  if (lat == null || lon == null) {
    return { modul: 13, navn: "Myndighed og omgivelser", status: "ufuldstaendig",
      blokerende: ["Ingen koordinat fra modul 1."], advarsler };
  }

  /* --- Lokalplan ---------------------------------------------------- */
  let lokalplaner = null, lokalplanFejl = null;
  try {
    lokalplaner = await hentLokalplaner(lat, lon);
  } catch (fejl) {
    lokalplanFejl = fejl.message;
    advarsler.push(
      `Lokalplanopslaget mislykkedes. ${fejl.message} Slå manuelt op på plandata.dk ` +
      "eller hos kommunen - en lokalplan kan indeholde bestemmelser om solenergianlæg, " +
      "der ændrer eller udelukker projektet."
    );
  }

  const solcelleBestemmelser = (lokalplaner ?? []).filter(harSolcelleBestemmelse);

  /* --- Naboorientering ---------------------------------------------- */
  const nabo = vurderNaboorientering(input);

  /* --- Bevaringsstatus ---------------------------------------------- */
  // Fredning og bevaringsværdighed ligger i FBB/Slots- og Kulturstyrelsen,
  // ikke i Plandata. Vi påstår ikke noget, vi ikke har slået op.
  const bevaring = mangler(
    "Fredede og Bevaringsværdige Bygninger (FBB)",
    "Bevarings- og fredningsstatus er ikke slået op automatisk. Kontrollér i FBB " +
    "og i lokalplanens bevaringsbestemmelser - et bevaringsværdigt tag kan " +
    "udelukke synlige anlæg mod gaden."
  );
  advarsler.push(
    "Frednings- og bevaringsstatus er ikke slået op. Kontrollér den i FBB " +
    "(Slots- og Kulturstyrelsen) og i lokalplanens bevaringsbestemmelser."
  );

  return {
    modul: 13,
    navn: "Myndighed og omgivelser",
    status: lokalplanFejl ? "delvis" : "ok",
    advarsler,
    lokalplan: lokalplanFejl
      ? mangler(PLANDATA.navn, lokalplanFejl)
      : lokalplaner.length === 0
        ? hentet("Ingen vedtaget lokalplan rammer adressen", PLANDATA.navn, {
            reference: PLANDATA.wfs,
            note: "Fravær af lokalplan udelukker ikke byplanvedtægter, servitutter eller kommuneplanrammer." })
        : hentet(`${lokalplaner.length} vedtaget lokalplan(er) rammer adressen`, PLANDATA.navn, {
            reference: PLANDATA.wfs }),
    lokalplaner: (lokalplaner ?? []).map((p) => ({
      plannummer: p.planid ?? p.plannr ?? null,
      navn: p.plannavn ?? p.titel ?? null,
      vedtagetDato: p.datoforvedtagelse ?? p.vedtagelsesdato ?? null,
      anvendelse: p.anvendelsegenerel ?? p.anvendelse ?? null,
      link: p.doklink ?? p.planlink ?? null,
      harSolcellebestemmelse: harSolcelleBestemmelse(p),
    })),
    solcelleBestemmelser: solcelleBestemmelser.length > 0
      ? hentet(
          `${solcelleBestemmelser.length} plan(er) har en anvendelseskategori for solenergianlæg`,
          PLANDATA.navn,
          { note: "Læs planens bestemmelser om placering, højde, refleksion og synlighed fra vej." }
        )
      : beregnet("Ingen solcelle-specifik anvendelseskategori fundet", "Modul 13 filtrering", {
          note: "Bestemmelser om tagmaterialer, taghældning og synlighed kan alligevel " +
                "begrænse anlægget. Planens tekst skal læses - filtreringen ser kun på " +
                "anvendelseskategorien." }),
    naboorientering: nabo,
    bevaringsstatus: bevaring,
    tjeklisteMyndighed: [
      "Er der en lokalplan eller byplanvedtægt med bestemmelser om tagmateriale, refleksion eller synlighed?",
      "Er bygningen fredet eller udpeget som bevaringsværdig (FBB / lokalplan)?",
      "Kræver anlægget dispensation fra bygningshøjde eller tagform?",
      "Skal der naboorienteres, og er høringsfristen indregnet i tidsplanen?",
      "Er der servitutter på ejendommen, der begrænser tekniske anlæg på taget?",
    ],
  };
}

async function hentLokalplaner(lat, lon) {
  const { x, y } = tilUtm32(lat, lon);
  const url = `${PLANDATA.wfs}?${query({
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typenames: PLANDATA.lokalplanTema,
    srsName: "EPSG:25832",
    outputFormat: "application/json",
    count: 50,
    CQL_FILTER: `INTERSECTS(geometri,POINT(${x.toFixed(2)} ${y.toFixed(2)}))`,
  })}`;

  const svar = await hentJson(url, { kilde: PLANDATA.navn, timeoutMs: 25000 });
  const features = svar?.features ?? [];
  return features.map((f) => f.properties ?? {});
}

function harSolcelleBestemmelse(plan) {
  const felter = [
    plan.anvendelsegenerel, plan.anvendelsespecifik, plan.anvendelse,
    plan.plannavn, plan.titel,
  ].filter(Boolean).map((v) => String(v).toLowerCase());
  return PLANDATA.solcelleAnvendelser.some((k) =>
    felter.some((f) => f.includes(k.toLowerCase()))
  );
}

/**
 * Naboorientering afledes som en regel: ligger anlægget tæt på skel, eller
 * rager det op over tagfladen, skal kommunen typisk naboorientere efter
 * planlovens regler om helhedsvurdering. Værktøjet afgør det ikke - det
 * flager, hvornår spørgsmålet skal stilles.
 */
function vurderNaboorientering(input) {
  const { layout, skelpolygonMeter } = input;
  const grund = [];

  if (layout?.forudsaetninger?.haeldningGrader?.vaerdi > 0 &&
      layout?.forudsaetninger?.orientering?.vaerdi !== "tagflade") {
    grund.push(
      "Anlægget står på stativ og rager op over tagfladen. Det kan udløse en " +
      "helhedsvurdering, hvis det er synligt fra nabo eller vej."
    );
  }

  if (skelpolygonMeter?.length >= 3 && layout?.paneler?.length) {
    const afstande = layout.paneler.map((p) =>
      Math.min(...p.hjoerner.map((h) => afstandTilRand(h, skelpolygonMeter)))
    );
    const mindste = Math.min(...afstande);
    if (mindste < 2.5) {
      grund.push(`Nærmeste panel ligger ${rund(mindste, 2)} m fra skel.`);
    }
    return {
      mindsteAfstandTilSkelM: beregnet(rund(mindste, 2), "Modul 13 geometri", { enhed: "m" }),
      anbefaling: beregnet(
        grund.length ? "Naboorientering bør påregnes" : "Naboorientering ikke umiddelbart påkrævet",
        "Modul 13 regel", { note: grund.join(" ") || null }
      ),
      begrundelser: grund,
      forbehold: "Kommunen afgør selv, om der skal naboorienteres. Udsendelsen sker administrativt og ligger uden for værktøjet.",
    };
  }

  return {
    mindsteAfstandTilSkelM: mangler("Matriklen via Datafordeleren",
      "Skelpolygon er ikke hentet, så afstanden til skel er ikke beregnet"),
    anbefaling: beregnet(
      grund.length ? "Naboorientering bør påregnes" : "Kan ikke afgøres uden skel",
      "Modul 13 regel", { note: grund.join(" ") || null }),
    begrundelser: grund,
    forbehold: "Kommunen afgør selv, om der skal naboorienteres.",
  };
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
