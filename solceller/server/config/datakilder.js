/**
 * Endepunkter og legitimationsoplysninger for de eksterne datakilder.
 *
 * Datafordeleren og Eloverblik kræver begge en registreret bruger. Uden
 * legitimationsoplysninger kører værktøjet videre i en reduceret tilstand,
 * hvor de pågældende datapunkter markeres MANGLER og skal indtastes eller
 * bekræftes manuelt. Det er med vilje: et tomt felt i rapporten er bedre end
 * et gæt.
 *
 * Sæt variablene i miljøet (fx i en .env-fil som ikke commit'es):
 *   DATAFORDELER_BRUGER, DATAFORDELER_KODE
 *   ELOVERBLIK_TOKEN            (tredjeparts-refresh-token)
 */

const env = process.env;

export const DATAFORDELER = {
  navn: "Datafordeleren (SDFI)",
  bruger: env.DATAFORDELER_BRUGER || null,
  kode: env.DATAFORDELER_KODE || null,
  get konfigureret() {
    return Boolean(this.bruger && this.kode);
  },
  // REST-tjenesterne på Datafordeleren. Versionsstierne skal følge den
  // tjenesteudgave, tjenestebrugeren er abonneret på.
  dar: env.DF_DAR_URL || "https://services.datafordeler.dk/DAR/DAR/2.0.0/rest",
  bbr: env.DF_BBR_URL || "https://services.datafordeler.dk/BBR/BBRPublic/1/rest",
  matrikel: env.DF_MATRIKEL_URL || "https://services.datafordeler.dk/MATRIKLEN2/MatrikelGaeldendeOgForeloebigWFS/1.0.0/WFS",
  geodanmark: env.DF_GEODANMARK_URL || "https://services.datafordeler.dk/GeoDanmarkVektor/GeoDanmark60_NOHIST_GML3/1.0.0/WFS",
  dhm: env.DF_DHM_URL || "https://services.datafordeler.dk/DHMNedboer/dhm/1.0.0/WCS",
  opsaetningsvejledning:
    "Opret en tjenestebruger på datafordeler.dk, abonnér på DAR, BBR, " +
    "GeoDanmark Vektor, Matriklen og DHM, og sæt DATAFORDELER_BRUGER/DATAFORDELER_KODE.",
};

export const ADRESSEVAELGER = {
  navn: "Adressevælgeren (SDFI)",
  // SDFI's officielle afløser for DAWA's autocomplete. Basis-URL'en kan
  // ændres uden kodeændring, hvis tjenesten flytter.
  basis: env.ADRESSEVAELGER_URL || "https://api.adressevaelger.dk/adresser",
  note:
    "DAWA (api.dataforsyningen.dk) lukker 1. oktober 2026 og har ikke leveret " +
    "BBR-data siden april 2024. Værktøjet bruger derfor ikke DAWA.",
};

export const PVGIS = {
  navn: "PVGIS (EU Joint Research Centre)",
  basis: env.PVGIS_URL || "https://re.jrc.ec.europa.eu/api/v5_3",
  note:
    "Offentligt og gratis uden login. Har ikke CORS, så kaldet skal foretages " +
    "server-side - det er en af grundene til at værktøjet har en backend.",
  konfigureret: true,
};

export const PLANDATA = {
  navn: "Plandata.dk (Plan- og Landdistriktsstyrelsen)",
  wfs: env.PLANDATA_WFS_URL || "https://geoserver.plandata.dk/geoserver/wfs",
  lokalplanTema: "pdk:theme_pdk_lokalplan_vedtaget_v",
  // Anvendelseskategorier der signalerer solcelle-specifikke bestemmelser
  solcelleAnvendelser: ["Solcelleanlæg", "Solenergianlæg", "Solvarmeanlæg"],
  konfigureret: true,
};

export const ELOVERBLIK = {
  navn: "Eloverblik (Energinet)",
  basis: env.ELOVERBLIK_URL || "https://api.eloverblik.dk/customerapi/api",
  token: env.ELOVERBLIK_TOKEN || null,
  get konfigureret() {
    return Boolean(this.token);
  },
  opsaetningsvejledning:
    "Log ind på eloverblik.dk som kunde, opret et tredjeparts-token under " +
    "'Datadeling', og sæt ELOVERBLIK_TOKEN.",
};

/** Samlet status til UI'et, så brugeren kan se hvad der er slået til. */
export function datakildeStatus() {
  return [
    { noegle: "datafordeler", navn: DATAFORDELER.navn, konfigureret: DATAFORDELER.konfigureret,
      vejledning: DATAFORDELER.opsaetningsvejledning,
      daekker: "Modul 1 (adresse, BBR, matrikel, tagpolygon), modul 8 (højdemodel), modul 11 (tagmateriale)" },
    { noegle: "pvgis", navn: PVGIS.navn, konfigureret: true, vejledning: null,
      daekker: "Modul 7 (produktion), modul 8 (horisont)" },
    { noegle: "plandata", navn: PLANDATA.navn, konfigureret: true, vejledning: null,
      daekker: "Modul 13 (lokalplan)" },
    { noegle: "eloverblik", navn: ELOVERBLIK.navn, konfigureret: ELOVERBLIK.konfigureret,
      vejledning: ELOVERBLIK.opsaetningsvejledning,
      daekker: "Modul 12 (faktisk elforbrug og egetforbrugsandel)" },
    { noegle: "arkiv", navn: "FilArkiv / WebLager", konfigureret: false,
      vejledning: "Ingen API. Modul 4 kører som assisteret søgeflow med brugerbekræftelse.",
      daekker: "Modul 4 (statisk dokumentation) - flaskehalsen i hele analysen" },
  ];
}
