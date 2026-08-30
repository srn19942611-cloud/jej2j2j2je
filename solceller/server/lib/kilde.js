/**
 * Kilde- og herkomstsporing (provenance).
 *
 * Hvert enkelt tal i værktøjet bæres rundt som et Datapunkt, der ud over
 * selve værdien altid indeholder hvor tallet kommer fra og hvornår det er
 * hentet. Rapporten (modul 6) og den strukturelle vurdering (modul 5) er
 * bygget op om at kunne skelne mellem:
 *
 *   HENTET          - hentet maskinelt fra en navngiven datakilde
 *   BRUGERBEKRÆFTET- læst af et dokument og udtrykkeligt bekræftet af brugeren
 *   BEREGNET        - udledt af andre datapunkter i værktøjet
 *   ANTAGELSE       - default/konfiguration som skal vedligeholdes manuelt
 *   MANGLER         - kunne ikke fremskaffes; skal stoppe og flages
 *
 * Reglen i hele kodebasen: gæt aldrig. Mangler et tal, så returnér
 * mangler() frem for en default, medmindre defaulten udtrykkeligt er en
 * dokumenteret ANTAGELSE.
 */

export const Herkomst = Object.freeze({
  HENTET: "hentet",
  BRUGERBEKRAEFTET: "brugerbekraeftet",
  BEREGNET: "beregnet",
  ANTAGELSE: "antagelse",
  MANGLER: "mangler",
});

/** Herkomster der er egnede som grundlag for en bindende konklusion. */
export const PAALIDELIGE = Object.freeze([
  Herkomst.HENTET,
  Herkomst.BRUGERBEKRAEFTET,
]);

/**
 * @param {number|string|boolean|object|null} værdi
 * @param {object} meta
 * @param {string} meta.herkomst      - en værdi fra Herkomst
 * @param {string} meta.kilde         - menneskelæsbart kildenavn, fx "BBR via Datafordeleren"
 * @param {string} [meta.enhed]
 * @param {string} [meta.reference]   - URL, sagsnummer, tegningsnummer, dokumentnavn
 * @param {string} [meta.dato]        - ISO-dato for hvornår værdien er hentet/gældende
 * @param {string} [meta.note]
 */
export function datapunkt(vaerdi, meta = {}) {
  const {
    herkomst = Herkomst.BEREGNET,
    kilde = "ukendt",
    enhed = null,
    reference = null,
    dato = new Date().toISOString().slice(0, 10),
    note = null,
  } = meta;

  if (!Object.values(Herkomst).includes(herkomst)) {
    throw new Error(`Ukendt herkomst: ${herkomst}`);
  }
  return { vaerdi, enhed, herkomst, kilde, reference, dato, note };
}

export const hentet = (v, kilde, o = {}) =>
  datapunkt(v, { ...o, herkomst: Herkomst.HENTET, kilde });

export const bekraeftet = (v, kilde, o = {}) =>
  datapunkt(v, { ...o, herkomst: Herkomst.BRUGERBEKRAEFTET, kilde });

export const beregnet = (v, kilde, o = {}) =>
  datapunkt(v, { ...o, herkomst: Herkomst.BEREGNET, kilde });

export const antagelse = (v, kilde, o = {}) =>
  datapunkt(v, { ...o, herkomst: Herkomst.ANTAGELSE, kilde });

export const mangler = (kilde, note, o = {}) =>
  datapunkt(null, { ...o, herkomst: Herkomst.MANGLER, kilde, note });

/** Trækker den rene talværdi ud. Kaster hvis datapunktet mangler. */
export function vaerdi(dp, navn = "datapunkt") {
  if (dp == null) throw new Error(`${navn} er ikke sat`);
  if (dp.herkomst === Herkomst.MANGLER || dp.vaerdi == null) {
    throw new Error(`${navn} mangler: ${dp.note || dp.kilde}`);
  }
  return dp.vaerdi;
}

/** Som værdi(), men returnerer fallback i stedet for at kaste. */
export function vaerdiEller(dp, fallback) {
  if (dp == null || dp.herkomst === Herkomst.MANGLER || dp.vaerdi == null) {
    return fallback;
  }
  return dp.vaerdi;
}

export const erPaalideligt = (dp) =>
  dp != null && PAALIDELIGE.includes(dp.herkomst) && dp.vaerdi != null;

export const erMangel = (dp) =>
  dp == null || dp.herkomst === Herkomst.MANGLER || dp.vaerdi == null;

/**
 * Går rekursivt gennem et modul-output og samler alle datapunkter til
 * rapportens kildeliste.
 * @returns {Array<{sti:string} & ReturnType<typeof datapunkt>>}
 */
export function samlKilder(objekt, sti = "") {
  const ud = [];
  const gaa = (v, s) => {
    if (v == null || typeof v !== "object") return;
    if (erDatapunkt(v)) {
      ud.push({ sti: s, ...v });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((e, i) => gaa(e, `${s}[${i}]`));
      return;
    }
    for (const [k, val] of Object.entries(v)) {
      gaa(val, s ? `${s}.${k}` : k);
    }
  };
  gaa(objekt, sti);
  return ud;
}

export function erDatapunkt(v) {
  return (
    v != null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "herkomst" in v &&
    "kilde" in v &&
    Object.values(Herkomst).includes(v.herkomst)
  );
}

/** Opsummerer herkomst-fordelingen, til rapportens tillidsafsnit. */
export function kildeStatistik(objekt) {
  const alle = samlKilder(objekt);
  const tael = Object.fromEntries(Object.values(Herkomst).map((h) => [h, 0]));
  for (const dp of alle) tael[dp.herkomst] += 1;
  return { antal: alle.length, fordeling: tael, mangler: alle.filter((d) => d.herkomst === Herkomst.MANGLER) };
}
