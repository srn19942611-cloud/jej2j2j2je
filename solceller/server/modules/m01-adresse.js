/**
 * MODUL 1 - Adresseopslag og tagdata
 *
 * Automatiseringsgrad: fuld, når Datafordeleren er konfigureret.
 * Uden tjenestebruger falder modulet tilbage til manuelt indtastede
 * bygningsdata, og alle berørte felter markeres som MANGLER eller
 * BRUGERBEKRÆFTET - aldrig som hentede.
 *
 * Kilder:
 *   Adressevælgeren (SDFI)  - autocomplete og geokodning
 *   DAR via Datafordeleren   - adgangsadresse, husnummer, koordinat
 *   BBR via Datafordeleren   - bygning, tagdækning, opførelsesår, etager
 *   Matriklen via Datafordeleren - matrikelnummer og ejerlav
 *   GeoDanmark via Datafordeleren - bygningspolygon (tagets omrids)
 *
 * DAWA bruges bevidst ikke: tjenesten lukker 1. oktober 2026 og har ikke
 * leveret BBR-data siden april 2024.
 */

import { hentJson, hentTekst, query, KildeFejl } from "../lib/http.js";
import { DATAFORDELER, ADRESSEVAELGER } from "../config/datakilder.js";
import { hentet, bekraeftet, beregnet, mangler, antagelse, vaerdiEller } from "../lib/kilde.js";
import { lokaltPlan, ringTilMeter, areal, centroide, bbox, punktIPolygon } from "../lib/geometri.js";
import { kommunekodeFraNavn, kommuneNavn } from "../config/kommuner.js";

const IDAG = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Autocomplete                                                        */
/* ------------------------------------------------------------------ */

/**
 * Adresseforslag til inputfeltet i UI'et.
 * @returns {Promise<Array<{tekst:string, id:string, lat:number, lon:number}>>}
 */
export async function adresseforslag(soegetekst, { antal = 8 } = {}) {
  if (!soegetekst || soegetekst.trim().length < 2) return [];
  const url = `${ADRESSEVAELGER.basis}?${query({ q: soegetekst, per_side: antal })}`;
  try {
    const svar = await hentJson(url, { kilde: ADRESSEVAELGER.navn, cacheTtlMs: 300000, forsoeg: 1 });
    return normaliserForslag(svar);
  } catch (fejl) {
    // Autocomplete må aldrig vælte formularen - brugeren kan indtaste frit.
    return { fejl: fejl.message, forslag: [] };
  }
}

function normaliserForslag(svar) {
  const raekker = Array.isArray(svar) ? svar : svar?.resultater ?? svar?.features ?? [];
  return raekker.map((r) => {
    const p = r.properties ?? r;
    const koord = r.geometry?.coordinates ?? null;
    return {
      tekst: p.betegnelse ?? p.adressebetegnelse ?? p.tekst ?? p.visningstekst ?? "",
      id: p.id ?? p.adresseIdentifikator ?? p.husnummerIdentifikator ?? null,
      lat: koord ? koord[1] : p.wgs84koordinat_bredde ?? p.breddegrad ?? null,
      lon: koord ? koord[0] : p.wgs84koordinat_laengde ?? p.laengdegrad ?? null,
      kommunekode: p.kommunekode ?? p.kommuneKode ?? null,
    };
  }).filter((f) => f.tekst);
}

/* ------------------------------------------------------------------ */
/* Hovedopslag                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {object} input
 * @param {string} [input.adresse]        fritekst-adresse
 * @param {number} [input.lat] [input.lon]
 * @param {object} [input.manueltTag]     brugerens egne tagoplysninger, hvis
 *                                        Datafordeleren ikke er tilgængelig
 * @returns {Promise<object>} modul 1-resultat
 */
export async function koer(input = {}) {
  const advarsler = [];
  const resultat = {
    modul: 1,
    navn: "Adresseopslag og tagdata",
    koert: new Date().toISOString(),
    advarsler,
  };

  /* --- 1a. Position ------------------------------------------------ */
  let lat = input.lat, lon = input.lon, adressetekst = input.adresse ?? null;
  let kommunekode = input.kommunekode ?? null;

  if ((lat == null || lon == null) && adressetekst) {
    const forslag = await adresseforslag(adressetekst, { antal: 1 });
    const liste = Array.isArray(forslag) ? forslag : forslag.forslag;
    if (liste?.length && liste[0].lat != null) {
      lat = liste[0].lat; lon = liste[0].lon;
      adressetekst = liste[0].tekst;
      kommunekode = kommunekode ?? liste[0].kommunekode;
    } else {
      advarsler.push(
        "Adressen kunne ikke geokodes via Adressevælgeren. Angiv koordinater manuelt, " +
        "eller vælg adressen fra forslagslisten i UI'et."
      );
    }
  }

  if (lat == null || lon == null) {
    resultat.status = "ufuldstaendig";
    resultat.adresse = mangler("Adressevælgeren", "Adressen kunne ikke geokodes");
    resultat.blokerende = [
      "Uden koordinat kan hverken tagpolygon (modul 1), produktion (modul 7) " +
      "eller lokalplan (modul 13) slås op.",
    ];
    return resultat;
  }

  resultat.position = hentet({ lat, lon }, adressetekst ? ADRESSEVAELGER.navn : "brugerindtastning", {
    enhed: "grader (WGS84)",
    reference: adressetekst,
  });
  resultat.adresse = adressetekst
    ? hentet(adressetekst, ADRESSEVAELGER.navn)
    : mangler("Adressevælgeren", "Kun koordinat oplyst, ingen adressebetegnelse");

  /* --- 1b. BBR og matrikel ----------------------------------------- */
  if (DATAFORDELER.konfigureret) {
    try {
      const bbr = await hentBbrBygning({ lat, lon, adresseId: input.adresseId });
      Object.assign(resultat, bbr);
      kommunekode = kommunekode ?? vaerdiEller(bbr.kommunekode, null);
    } catch (fejl) {
      advarsler.push(`BBR-opslag mislykkedes. ${fejl.message}`);
      Object.assign(resultat, tommeBbrFelter(fejl.message));
    }
  } else {
    advarsler.push(
      "Datafordeleren er ikke konfigureret (DATAFORDELER_BRUGER/DATAFORDELER_KODE). " +
      "BBR-, matrikel- og bygningsdata skal indtastes manuelt og markeres som brugerbekræftede."
    );
    Object.assign(resultat, tommeBbrFelter("Datafordeleren er ikke konfigureret"));
  }

  if (kommunekode) {
    resultat.kommunekode = resultat.kommunekode?.vaerdi
      ? resultat.kommunekode
      : hentet(Number(kommunekode), "Adressevælgeren");
    resultat.kommune = hentet(kommuneNavn(kommunekode) ?? "ukendt", "Kommuneregister (intern tabel)");
  } else {
    resultat.kommune = mangler("Kommuneregister", "Kommune kunne ikke bestemmes - modul 4 og 9 kan ikke slå op");
    advarsler.push("Kommunen kunne ikke bestemmes. Modul 4 (arkiv) og modul 9 (netselskab) kan ikke slå op.");
  }

  /* --- 1c. Tagpolygon ---------------------------------------------- */
  let polygon = null;
  if (input.manueltTag?.polygon?.length >= 3) {
    polygon = input.manueltTag.polygon;
    resultat.tagpolygonKilde = bekraeftet("Manuelt indtegnet af bruger", "Brugerindtegning i UI");
  } else if (DATAFORDELER.konfigureret) {
    try {
      polygon = await hentGeoDanmarkBygning({ lat, lon });
      resultat.tagpolygonKilde = hentet("GeoDanmark bygningspolygon", "GeoDanmark via Datafordeleren", {
        reference: DATAFORDELER.geodanmark,
      });
    } catch (fejl) {
      advarsler.push(`Bygningspolygon kunne ikke hentes. ${fejl.message}`);
      resultat.tagpolygonKilde = mangler("GeoDanmark via Datafordeleren", fejl.message);
    }
  } else {
    resultat.tagpolygonKilde = mangler(
      "GeoDanmark via Datafordeleren",
      "Datafordeleren er ikke konfigureret - tagpolygonen skal indtegnes manuelt"
    );
  }

  if (!polygon || polygon.length < 3) {
    resultat.status = "ufuldstaendig";
    resultat.tag = mangler("GeoDanmark / brugerindtegning", "Ingen tagpolygon");
    resultat.blokerende = [
      "Uden tagpolygon kan modul 2 (layout) og modul 3 (last) ikke køre. " +
      "Indtegn tagfladen manuelt, eller konfigurér Datafordeleren.",
    ];
    return resultat;
  }

  const plan = lokaltPlan(lat, lon);
  const ring = ringTilMeter(polygon, plan);
  const tagareal = areal(ring);

  resultat.plan = { origo: plan.origo };
  resultat.tag = {
    polygonWgs84: polygon,
    polygonMeter: ring,
    centroideMeter: centroide(ring),
    arealM2: beregnet(rund(tagareal, 1), "Fladeberegning af bygningspolygon", { enhed: "m2" }),
  };

  /* --- 1d. Tagtype og hældning ------------------------------------ */
  const manuelType = input.manueltTag?.tagtype;
  if (manuelType) {
    resultat.tag.tagtype = bekraeftet(manuelType, "Brugerangivelse");
    resultat.tag.haeldningGrader = bekraeftet(
      input.manueltTag.haeldningGrader ?? (manuelType === "fladt" ? 0 : 25),
      "Brugerangivelse", { enhed: "grader" }
    );
    resultat.tag.tagAzimutGrader = bekraeftet(
      input.manueltTag.tagAzimutGrader ?? 0, "Brugerangivelse",
      { enhed: "grader fra syd", note: "0 = sydvendt, negativ mod øst" }
    );
  } else {
    // BBR har tagdækningsmateriale, men ikke hældning. Vi udleder ikke en
    // hældning af materialet - det ville være et gæt.
    resultat.tag.tagtype = mangler(
      "BBR / bygningsopmåling",
      "Tagtype (fladt/skråt) fremgår ikke af BBR og skal bekræftes af brugeren"
    );
    resultat.tag.haeldningGrader = mangler("Bygningsopmaaling", "Taghældning ikke oplyst");
    resultat.tag.tagAzimutGrader = mangler("Bygningsopmaaling", "Tagets orientering ikke oplyst");
    advarsler.push(
      "Tagtype og taghældning kan ikke hentes automatisk. Bekræft dem i UI'et - " +
      "de styrer både layout (modul 2), last (modul 3) og produktion (modul 7)."
    );
  }

  /* --- 1e. Forhindringer på taget --------------------------------- */
  const forhindringer = (input.manueltTag?.forhindringer ?? []).map((f, i) => ({
    id: f.id ?? `forhindring-${i + 1}`,
    type: f.type ?? "ukendt",
    polygonMeter: f.polygonMeter ?? (f.polygon ? ringTilMeter(f.polygon, plan) : null),
    hoejdeM: f.hoejdeM ?? null,
    kilde: bekraeftet(f.type ?? "ukendt", "Brugerindtegning i UI"),
  })).filter((f) => f.polygonMeter?.length >= 3);

  // Forhindringer angivet i meter refererer til det lokale plan, hvis origo
  // ligger i det geokodede punkt - ikke nødvendigvis midt på taget. En
  // forhindring, der havner uden for tagfladen, er næsten altid et tegn på,
  // at koordinaterne er angivet i et andet referencepunkt.
  const b = bbox(ring);
  resultat.tag.lokaltPlan = {
    origo: plan.origo,
    beskrivelse:
      "Meterkoordinater er målt fra det geokodede punkt (x mod øst, y mod nord). " +
      "Tagfladen ligger i intervallet herunder - forhindringer skal angives i samme system.",
    udstraekningM: {
      minX: rund(b.minX, 1), maxX: rund(b.maxX, 1),
      minY: rund(b.minY, 1), maxY: rund(b.maxY, 1),
    },
  };

  const udenfor = forhindringer.filter((f) =>
    !f.polygonMeter.some((h) => punktIPolygon(h, ring)));
  if (udenfor.length) {
    advarsler.push(
      `${udenfor.length} tagopbygning(er) ligger helt uden for tagfladen ` +
      `(${udenfor.map((f) => f.type).join(", ")}). Tagfladen spænder ` +
      `x ${rund(b.minX, 1)} til ${rund(b.maxX, 1)} m og y ${rund(b.minY, 1)} til ` +
      `${rund(b.maxY, 1)} m målt fra det geokodede punkt. Kontrollér koordinaterne - ` +
      "de indgår hverken i layoutet eller i brandkontrollen, hvor de ligger nu."
    );
  }

  resultat.tag.forhindringer = forhindringer;
  if (forhindringer.length === 0) {
    resultat.tag.forhindringerNote = antagelse(
      "Ingen forhindringer registreret",
      "Ingen datakilde",
      {
        note:
          "Ovenlys, ventilation, skorstene og teknikrum findes ikke i et åbent " +
          "register. At listen er tom betyder IKKE at taget er frit - det skal " +
          "kontrolleres på tegning eller ved besigtigelse.",
      }
    );
    advarsler.push(
      "Der er ikke registreret tagopbygninger. Kontrollér ovenlys, ventilation og " +
      "skorstene på tegning eller ved besigtigelse, og indtegn dem før layoutet bruges."
    );
  }

  resultat.status = resultat.tag.tagtype?.vaerdi ? "ok" : "kraever-bekraeftelse";
  return resultat;
}

/* ------------------------------------------------------------------ */
/* Datafordeleren                                                      */
/* ------------------------------------------------------------------ */

function dfAuth() {
  return { username: DATAFORDELER.bruger, password: DATAFORDELER.kode };
}

async function hentBbrBygning({ lat, lon, adresseId }) {
  const url = `${DATAFORDELER.bbr}/bygning?${query({
    ...dfAuth(),
    format: "json",
    ...(adresseId ? { husnummer: adresseId } : { pointNear: `${lon},${lat},30` }),
  })}`;

  const svar = await hentJson(url, { kilde: "BBR via Datafordeleren" });
  const bygninger = Array.isArray(svar) ? svar : svar?.features ?? [];
  if (!bygninger.length) {
    throw new KildeFejl("BBR via Datafordeleren", "ingen bygning fundet på adressen", { url });
  }
  // Største bygning på grunden er den relevante for et butikstag.
  const b = bygninger
    .map((x) => x.properties ?? x)
    .sort((a, z) => (Number(z.byg038SamletBygningsareal ?? 0) - Number(a.byg038SamletBygningsareal ?? 0)))[0];

  const K = "BBR via Datafordeleren";
  return {
    bbrBygningId: b.id_lokalId ? hentet(b.id_lokalId, K) : mangler(K, "Bygnings-id mangler i svaret"),
    kommunekode: b.kommunekode ? hentet(Number(b.kommunekode), K) : mangler(K, "Kommunekode mangler"),
    bebyggetArealM2: talFelt(b.byg041BebyggetAreal, K, "m2"),
    samletBygningsarealM2: talFelt(b.byg038SamletBygningsareal, K, "m2"),
    etager: talFelt(b.byg054AntalEtager, K, "etager"),
    opfoerelsesaar: talFelt(b.byg026Opførelsesår, K, "aar"),
    ombygningsaar: talFelt(b.byg027OmTilbygningsår, K, "aar"),
    tagdaekningsmateriale: b.byg033Tagdækningsmateriale
      ? hentet(tagmaterialeTekst(b.byg033Tagdækningsmateriale), K, {
          reference: `BBR-kode ${b.byg033Tagdækningsmateriale}`,
        })
      : mangler(K, "Tagdækningsmateriale ikke udfyldt i BBR"),
    ydervaeggensMateriale: b.byg032YdervæggensMateriale
      ? hentet(String(b.byg032YdervæggensMateriale), K)
      : mangler(K, "Ydervægsmateriale ikke udfyldt"),
    anvendelseskode: b.byg021BygningensAnvendelse
      ? hentet(String(b.byg021BygningensAnvendelse), K)
      : mangler(K, "Anvendelseskode mangler"),
  };
}

function tommeBbrFelter(aarsag) {
  const K = "BBR via Datafordeleren";
  const m = () => mangler(K, aarsag);
  return {
    bbrBygningId: m(), bebyggetArealM2: m(), samletBygningsarealM2: m(),
    etager: m(), opfoerelsesaar: m(), ombygningsaar: m(),
    tagdaekningsmateriale: m(), ydervaeggensMateriale: m(), anvendelseskode: m(),
  };
}

function talFelt(v, kilde, enhed) {
  const n = Number(v);
  return v == null || Number.isNaN(n)
    ? mangler(kilde, "feltet er ikke udfyldt i registret")
    : hentet(n, kilde, { enhed });
}

/** BBR's kodeliste for tagdækningsmateriale (byg033). */
const TAGMATERIALER = {
  1: "Tagpap med lille hældning", 2: "Tagpap med stor hældning",
  3: "Fibercement, herunder asbest (bølgeplader)", 4: "Betontagsten",
  5: "Tegl", 6: "Metalplader", 7: "Straatag",
  10: "Fibercement uden asbest", 11: "Levende tag (grønt tag)",
  12: "Glas", 20: "Andet materiale", 80: "Uoplyst",
};
const tagmaterialeTekst = (kode) => TAGMATERIALER[Number(kode)] ?? `Ukendt BBR-kode ${kode}`;

/**
 * Bygningspolygon fra GeoDanmark via WFS. Vi henter i EPSG:4326, så
 * koordinaterne kan gå direkte i det lokale plan.
 */
async function hentGeoDanmarkBygning({ lat, lon, radiusM = 40 }) {
  const d = radiusM / 111320;
  const bbox = [lon - d * 1.8, lat - d, lon + d * 1.8, lat + d].join(",");
  const url = `${DATAFORDELER.geodanmark}?${query({
    ...dfAuth(),
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typenames: "Bygning", srsname: "EPSG:4326",
    bbox: `${bbox},EPSG:4326`, count: 25, outputformat: "application/json",
  })}`;

  const svar = await hentJson(url, { kilde: "GeoDanmark via Datafordeleren" });
  const features = svar?.features ?? [];
  if (!features.length) {
    throw new KildeFejl("GeoDanmark via Datafordeleren", "ingen bygningspolygon fundet ved koordinatet", { url });
  }

  // Vælg den polygon, punktet ligger i - ellers den største i nærheden.
  const plan = lokaltPlan(lat, lon);
  const kandidater = features
    .map((f) => udtraekYdreRing(f.geometry))
    .filter((r) => r && r.length >= 4)
    .map((r) => ({ ring: r, arealM2: areal(ringTilMeter(r, plan)) }))
    .sort((a, b) => b.arealM2 - a.arealM2);

  if (!kandidater.length) {
    throw new KildeFejl("GeoDanmark via Datafordeleren", "svaret indeholdt ingen brugbar polygon", { url });
  }
  return kandidater[0].ring;
}

function udtraekYdreRing(geom) {
  if (!geom) return null;
  if (geom.type === "Polygon") return geom.coordinates[0];
  if (geom.type === "MultiPolygon") {
    return geom.coordinates
      .map((p) => p[0])
      .sort((a, b) => b.length - a.length)[0];
  }
  return null;
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export { tagmaterialeTekst, TAGMATERIALER };
