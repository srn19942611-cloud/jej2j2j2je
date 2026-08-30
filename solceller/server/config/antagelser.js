/**
 * MANUELT VEDLIGEHOLDT KONFIGURATION.
 *
 * Alt i denne fil er antagelser, ikke hentede data. Hver post har et
 * `kilde`- og `gældendeFra`-felt, som føres direkte videre til rapportens
 * kildeliste, så læseren kan se hvad der er slået op og hvad der er sat.
 *
 * Opdatér `gældendeFra` når en værdi ændres. Værdier der står med
 * kilde "SKAL VERIFICERES" er placeholders: de er fagligt rimelige, men de er
 * ikke slået op i den gældende udgave af normen/prislisten, og de skal
 * bekræftes før rapporten bruges i en ansøgning.
 */

export const PANELTYPER = {
  "standard-450": {
    navn: "Monokrystallinsk 450 Wp (standard erhvervspanel)",
    effektWp: 450,
    breddeM: 1.134,
    laengdeM: 2.278,
    vaegtKg: 24.5,
    virkningsgrad: 0.209,
    temperaturkoefficientPctPrGrad: -0.35,
    degraderingPctPrAar: 0.45,
    kilde: "Typisk datablad for 450 Wp monokrystallinsk modul - SKAL VERIFICERES mod valgt fabrikat",
    gaeldendeFra: "2026-08-30",
  },
  "standard-500": {
    navn: "Monokrystallinsk 500 Wp",
    effektWp: 500,
    breddeM: 1.134,
    laengdeM: 2.278,
    vaegtKg: 26.0,
    virkningsgrad: 0.232,
    temperaturkoefficientPctPrGrad: -0.34,
    degraderingPctPrAar: 0.4,
    kilde: "Typisk datablad for 500 Wp monokrystallinsk modul - SKAL VERIFICERES mod valgt fabrikat",
    gaeldendeFra: "2026-08-30",
  },
};

export const MONTAGESYSTEMER = {
  ballast: {
    navn: "Ballasteret aerodynamisk system på fladt tag",
    gennemboring: false,
    egenvaegtKgPrM2: 5.0,
    haeldningGrader: 15,
    minAfstandTagkantM: 1.0,
    beskrivelse:
      "Systemets egenvægt uden ballast. Ballastbehovet beregnes i modul 3 ud fra vindlast.",
    kilde: "Typisk aerodynamisk ballastsystem - SKAL VERIFICERES mod leverandørens ETA",
    gaeldendeFra: "2026-08-30",
  },
  gennemboret: {
    navn: "Gennemboret montage på fladt tag",
    gennemboring: true,
    egenvaegtKgPrM2: 4.0,
    haeldningGrader: 10,
    minAfstandTagkantM: 0.6,
    beskrivelse:
      "Punktfastgjort i tagets bærende konstruktion. Ingen ballast, men kræver inddækning af hver gennemføring.",
    kilde: "Typisk punktfastgjort system - SKAL VERIFICERES mod leverandørens ETA",
    gaeldendeFra: "2026-08-30",
  },
  skraatag: {
    navn: "Skinnesystem på skråt tag (parallelt med tagfladen)",
    gennemboring: true,
    egenvaegtKgPrM2: 3.5,
    haeldningGrader: null, // følger tagets hældning
    minAfstandTagkantM: 0.4,
    beskrivelse: "Tagkroge/skinner fastgjort til spær eller lægter.",
    kilde: "Typisk skinnesystem til skråt tag - SKAL VERIFICERES mod leverandørens ETA",
    gaeldendeFra: "2026-08-30",
  },
};

/**
 * Vindlast, EN 1991-1-4 med dansk nationalt anneks.
 * Grundvindhastigheden er zoneopdelt; værktøjet vælger zone ud fra
 * kommune (se vindzoner.js) og lader brugeren overstyre.
 */
export const VINDLAST = {
  luftdensitetKgPrM3: 1.25,
  terraenkategorier: {
    // z0 = ruhedslængde (m), zmin = mindste højde (m)
    I: { z0: 0.01, zmin: 1, beskrivelse: "Åbent hav, kystnært" },
    II: { z0: 0.05, zmin: 2, beskrivelse: "Åbent land med spredt bevoksning" },
    III: { z0: 0.3, zmin: 5, beskrivelse: "Forstad, industriområde, skov" },
    IV: { z0: 1.0, zmin: 10, beskrivelse: "Bymæssig bebyggelse, mindst 15 % dækket af bygninger over 15 m" },
  },
  standardTerraenkategori: "III",
  turbulensfaktor: 1.0,
  /**
   * Netto-løftekoefficient for et hældende, ballasteret modul på fladt tag.
   *
   * Værdien gælder et aerodynamisk system med deflektor, hvor luften føres
   * hen over modulrækken. Den er markant lavere end koefficienten for et frit
   * fritstående tagelement, netop fordi systemet er formet til det.
   *
   * Det rigtige tal kommer fra vindtunnelforsøg i montagesystemets ETA og
   * afhænger af zone på taget, parapethøjde, rækkeafstand og modulets
   * placering i feltet. Værdien her giver en ballast i den rigtige
   * størrelsesorden til et første overslag - den er ikke en dimensionering.
   */
  netLoefteKoefficientCf: 0.5,
  hjoernezoneForoegelse: 1.8,
  kantzoneForoegelse: 1.4,
  partialkoefficientVind: 1.5,
  partialkoefficientEgenlastGunstig: 0.9,
  friktionskoefficientTagmembran: 0.5,
  kilde: "EN 1991-1-4 + DK NA, forenklet implementering - SKAL VERIFICERES af rådgiver",
  gaeldendeFra: "2026-08-30",
};

export const SNELAST = {
  karakteristiskTerraenvaerdiKNPrM2: 1.0,
  formfaktorFladtTag: 0.8,
  kilde: "EN 1991-1-3 + DK NA, sk = 1,0 kN/m2 for Danmark - SKAL VERIFICERES",
  gaeldendeFra: "2026-08-30",
};

/** Systemtab ud over det PVGIS selv regner. */
export const SYSTEMTAB = {
  kablingPct: 1.5,
  inverterPct: 2.0,
  smudsPct: 2.0,
  mismatchPct: 1.5,
  tilgaengelighedPct: 0.5,
  kilde: "Branchefaste projekteringsværdier - SKAL VERIFICERES mod projektet",
  gaeldendeFra: "2026-08-30",
};

export const OEKONOMI = {
  // CAPEX falder med anlægsstørrelsen; interpoleres lineært mellem punkterne.
  capexKurveKrPrKWp: [
    { kWp: 10, krPrKWp: 11000 },
    { kWp: 50, krPrKWp: 8500 },
    { kWp: 100, krPrKWp: 7200 },
    { kWp: 250, krPrKWp: 6300 },
    { kWp: 500, krPrKWp: 5800 },
    { kWp: 1000, krPrKWp: 5400 },
  ],
  ballastTillaegKrPrTon: 900,
  driftOgVedligeholdKrPrKWpPrAar: 110,
  inverterUdskiftningAar: 13,
  inverterUdskiftningAndelAfCapex: 0.12,
  elprisKoebKrPrKWh: 2.35,      // inkl. tarif, afgift og moms - erhverv uden momsfradrag
  elprisSalgKrPrKWh: 0.42,      // overskudssalg til nettet
  elprisstigningPctPrAar: 2.0,
  kalkulationsrentePct: 5.0,
  levetidAar: 25,
  kilde: "Manuelt vedligeholdte pris- og elprisantagelser - SKAL VERIFICERES mod aktuelle tilbud og elaftale",
  gaeldendeFra: "2026-08-30",
};

export const CO2 = {
  emissionsfaktorGramPrKWh: 108,
  faktorKilde: "Deklarationsværdi for dansk elforsyning - SKAL VERIFICERES mod Energistyrelsens seneste Klimastatus",
  produktionsEmissionGramPrKWpProduceret: 0, // saettes hvis livscyklus medregnes
  gaeldendeFra: "2026-08-30",
};

/** Faste geometriske projekteringsregler for layoutgeneratoren. */
export const LAYOUT = {
  minAfstandTagkantM: 1.0,
  minAfstandForhindringM: 0.8,
  gabMellemPanelerIRaekkeM: 0.02,
  gabMellemPanelerSkraatagM: 0.02,
  dimensionerendeSolhoejdeGrader: 17,
  dimensionerendeSolhoejdeBegrundelse:
    "Svarer til solhøjden ca. 3 timer fra solmiddag ved jævndøgn på dansk breddegrad. " +
    "Et strengere kriterium (vintersolhverv) giver markant færre paneler for meget lidt årlig gevinst.",
  maxSkyggetabPct: 10,
  minPanelerPrStreng: 6,
  maxPanelerPrStreng: 22,
};
