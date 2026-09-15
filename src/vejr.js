/* Vejrdata.
 *
 * Uden vejret er halvdelen af alle kølesager falske om sommeren. Et køleanlæg,
 * der bruger mere i juli end i januar, er ikke i stykker — og en butik, der
 * bruger mindre varme i en mild vinter, har ikke sparet noget.
 *
 * Fire størrelser bruges, og hver har sin egen rolle:
 *
 *   temperatur   skiller sæson fra fejl på køl, varme og køleflader
 *   solindstråling  forventet produktion på solceller, og solindfald i butikken
 *   skydække     forklarer en grå dag uden at anlægget fejler
 *   vind         påvirker infiltration og kondensatorydelse
 *
 * ---------------------------------------------------------------------------
 * Vejrzoner frem for koordinater pr. butik
 *
 * Vi henter ikke vejr for 1.171 adresser. Danmark er lille, og temperaturen
 * varierer langt mindre end forbruget gør. Butikkerne grupperes derfor i ti
 * zoner efter postnummer, og hver zone har ét vejrpunkt.
 *
 * Det er en bevidst afvejning, ikke en forsimpling af nød: til graddage er
 * fejlen ved en zone lille (typisk under 1 °C), og den slår igennem ens på
 * alle butikker i zonen, så en nabosammenligning inden for zonen er upåvirket.
 * Til SOLINDSTRÅLING er fejlen større — skydække er lokalt — og derfor bruger
 * solcelleanalysen anlæggets egne koordinater, når de findes.
 */

export const VEJRZONER = [
  { id: 'nordjylland',   navn: 'Nordjylland',      lat: 57.05, lon: 9.92,  postnr: [[9000, 9999]] },
  { id: 'vestjylland',   navn: 'Vestjylland',      lat: 56.36, lon: 8.62,  postnr: [[6900, 6999], [7400, 7999]] },
  { id: 'oestjylland',   navn: 'Østjylland',       lat: 56.16, lon: 10.20, postnr: [[8000, 8399], [8900, 8999]] },
  { id: 'midtjylland',   navn: 'Midtjylland',      lat: 56.14, lon: 9.41,  postnr: [[7100, 7399], [8400, 8899]] },
  { id: 'sydjylland',    navn: 'Syd- og Sønderjylland', lat: 55.49, lon: 9.47, postnr: [[6000, 6899]] },
  { id: 'fyn',           navn: 'Fyn',              lat: 55.40, lon: 10.39, postnr: [[5000, 5999]] },
  { id: 'sydsjaelland',  navn: 'Syd- og Vestsjælland', lat: 55.23, lon: 11.76, postnr: [[4000, 4999]] },
  { id: 'koebenhavn',    navn: 'Storkøbenhavn',    lat: 55.68, lon: 12.57, postnr: [[1000, 2999]] },
  { id: 'nordsjaelland', navn: 'Nordsjælland',     lat: 55.93, lon: 12.30, postnr: [[3000, 3699]] },
  { id: 'bornholm',      navn: 'Bornholm',         lat: 55.10, lon: 14.70, postnr: [[3700, 3799]] },
];

/** Finder butikkens vejrzone ud fra postnummer. */
export function zoneFor(postnr) {
  const n = parseInt(postnr, 10);
  if (!Number.isFinite(n)) return null;
  return VEJRZONER.find((z) => z.postnr.some(([fra, til]) => n >= fra && n <= til)) || null;
}

/* ---- Graddage -------------------------------------------------------------
 * Dansk konvention: graddage regnes mod 17 °C, fordi bygningen selv bidrager
 * med de sidste grader op til en indetemperatur omkring 20. Kølegraddage
 * regnes mod 20 °C for butikker, hvor belysning, køl og mennesker giver et
 * betydeligt varmetilskud. Begge kan rettes under Opsætning — de er
 * forudsætninger, ikke naturlove.
 */
export const GRADDAGE = { varmebasis: 17, koelebasis: 20 };

export const varmegraddage = (tmiddel, basis = GRADDAGE.varmebasis) => Math.max(0, basis - tmiddel);
export const koelegraddage = (tmiddel, basis = GRADDAGE.koelebasis) => Math.max(0, tmiddel - basis);

/* ---- Hentning -------------------------------------------------------------
 * Open-Meteo er valgt, fordi den kræver ingen nøgle, har både historik og
 * prognose, og leverer alle fire størrelser i samme kald. DMI's egen API er
 * et alternativ med finere dansk dækning, men kræver en nøgle — den kan
 * sættes ind som udbyder uden at ændre resten.
 */

const ARKIV = 'https://archive-api.open-meteo.com/v1/archive';
const PROGNOSE = 'https://api.open-meteo.com/v1/forecast';

const TIMEFELTER = ['temperature_2m', 'wind_speed_10m', 'cloud_cover', 'shortwave_radiation', 'direct_radiation'];
const DOEGNFELTER = ['temperature_2m_mean', 'temperature_2m_max', 'temperature_2m_min',
  'sunshine_duration', 'shortwave_radiation_sum', 'wind_speed_10m_max', 'cloud_cover_mean'];

/**
 * Henter vejr for ét punkt. `opløsning` er 'doegn' eller 'time'.
 * Historik og prognose kommer fra to forskellige endpoints, men samme felter,
 * så resten af hubben ikke skal vide hvilket.
 */
export async function hentVejr({ lat, lon, fra, til, oploesning = 'doegn', fetchFn = fetch }) {
  const idag = new Date().toISOString().slice(0, 10);
  const erHistorik = til <= idag;
  const url = new URL(erHistorik ? ARKIV : PROGNOSE);
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('timezone', 'Europe/Copenhagen');
  if (erHistorik) {
    url.searchParams.set('start_date', fra);
    url.searchParams.set('end_date', til);
  } else {
    url.searchParams.set('past_days', '7');
    url.searchParams.set('forecast_days', '7');
  }
  url.searchParams.set(oploesning === 'time' ? 'hourly' : 'daily',
    (oploesning === 'time' ? TIMEFELTER : DOEGNFELTER).join(','));

  const res = await fetchFn(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status} fra vejrtjenesten`);
  const data = await res.json();
  return oploesning === 'time' ? laesTimer(data) : laesDoegn(data);
}

function laesDoegn(d) {
  const t = (d.daily && d.daily.time) || [];
  return t.map((dato, i) => {
    const middel = d.daily.temperature_2m_mean[i];
    return {
      dato,
      temperatur: middel,
      tmax: d.daily.temperature_2m_max[i],
      tmin: d.daily.temperature_2m_min[i],
      solskinTimer: (d.daily.sunshine_duration ? d.daily.sunshine_duration[i] : null) / 3600 || null,
      indstraaling: d.daily.shortwave_radiation_sum ? d.daily.shortwave_radiation_sum[i] : null, // MJ/m²
      vind: d.daily.wind_speed_10m_max ? d.daily.wind_speed_10m_max[i] : null,
      skydaekke: d.daily.cloud_cover_mean ? d.daily.cloud_cover_mean[i] : null,
      hdd: middel == null ? null : varmegraddage(middel),
      cdd: middel == null ? null : koelegraddage(middel),
    };
  });
}

function laesTimer(d) {
  const t = (d.hourly && d.hourly.time) || [];
  return t.map((ts, i) => ({
    ts,
    temperatur: d.hourly.temperature_2m[i],
    vind: d.hourly.wind_speed_10m ? d.hourly.wind_speed_10m[i] : null,
    skydaekke: d.hourly.cloud_cover ? d.hourly.cloud_cover[i] : null,
    indstraaling: d.hourly.shortwave_radiation ? d.hourly.shortwave_radiation[i] : null,  // W/m²
    direkte: d.hourly.direct_radiation ? d.hourly.direct_radiation[i] : null,
  }));
}

/** Henter alle ti zoner. Ét kald pr. zone frem for ét pr. butik. */
export async function hentAlleZoner({ fra, til, oploesning = 'doegn', fetchFn = fetch, zoner = VEJRZONER }) {
  const ud = {};
  const fejl = [];
  for (const z of zoner) {
    try {
      ud[z.id] = await hentVejr({ lat: z.lat, lon: z.lon, fra, til, oploesning, fetchFn });
    } catch (err) {
      fejl.push({ zone: z.id, besked: String(err.message || err) });
    }
  }
  return { zoner: ud, fejl };
}

/* ---- Opslag --------------------------------------------------------------- */

/** Bygger et opslag: zone → dato → vejrdøgn. */
export function byggVejrindeks(zonedata) {
  const idx = new Map();
  for (const [zoneId, raekker] of Object.entries(zonedata || {})) {
    const m = new Map();
    for (const r of raekker) m.set(r.dato || String(r.ts).slice(0, 10), r);
    idx.set(zoneId, m);
  }
  return idx;
}

export function vejrFor(indeks, zoneId, dato) {
  const z = indeks.get(zoneId);
  return z ? z.get(dato) || null : null;
}

/**
 * Normalår: gennemsnitsvejret for en periode, brugt til at sige "korrigeret
 * for vejret". Uden et normalår kan man ikke sammenligne to vintre.
 * Danmarks officielle normalperiode er 1991–2020; her regnes den af de data,
 * vi selv har hentet, indtil den rigtige normal er lagt ind.
 */
export function normalaar(raekker) {
  const prMaaned = {};
  for (const r of raekker || []) {
    const m = String(r.dato).slice(5, 7);
    (prMaaned[m] ||= { hdd: [], cdd: [], sol: [] });
    if (r.hdd != null) prMaaned[m].hdd.push(r.hdd);
    if (r.cdd != null) prMaaned[m].cdd.push(r.cdd);
    if (r.indstraaling != null) prMaaned[m].sol.push(r.indstraaling);
  }
  const middel = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return Object.fromEntries(Object.entries(prMaaned).map(([m, v]) => [m, {
    hdd: middel(v.hdd), cdd: middel(v.cdd), indstraaling: middel(v.sol), dage: v.hdd.length,
  }]));
}

/** Graddagekorrektion: hvad forbruget ville have været i et normalt år. */
export function graddagekorriger(forbrug, hdd, normalHdd, vejrandel = 0.6) {
  // vejrandel er den del af forbruget, der følger vejret. Resten er basislast
  // og ændrer sig ikke med temperaturen. 0,6 er et udgangspunkt for varme —
  // for el i en dagligvarebutik er den langt lavere, og modellen i
  // anlaegsanalyse.js regner den ud af data frem for at antage den.
  if (!hdd || !normalHdd) return { korrigeret: forbrug, faktor: 1, anvendt: false };
  const faktor = 1 + vejrandel * (normalHdd / hdd - 1);
  return { korrigeret: forbrug * faktor, faktor, anvendt: true };
}
