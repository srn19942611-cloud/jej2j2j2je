/**
 * Solposition (NOÅ-algoritmen) og afledt solgeometri.
 *
 * Bruges to steder: modul 2 til at bestemme rækkeafstand på flade tage, og
 * modul 8 til at kaste skygger fra nabobygninger og tagopbygninger.
 *
 * Azimut-konvention i hele værktøjet: 0 grader = syd, negativ mod øst,
 * positiv mod vest. Det er samme konvention som PVGIS bruger, så modul 7
 * kan kalde API'et uden omregning.
 */

import { tilRadian, tilGrader } from "./geometri.js";

/** Julianske dage siden J2000.0 for et Date-objekt (UTC). */
function julianskeDage(dato) {
  return dato.getTime() / 86400000 - 10957.5;
}

/**
 * Solens position for et tidspunkt og en position.
 * @returns {{højde:number, azimut:number, deklination:number}} grader
 */
export function solposition(dato, lat, lon) {
  const d = julianskeDage(dato);

  // Middellængde og middelanomali (grader)
  const L = (280.46 + 0.9856474 * d) % 360;
  const g = tilRadian((357.528 + 0.9856003 * d) % 360);

  // Ekliptisk længde med de to største ligningsled
  const lambda = tilRadian(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const epsilon = tilRadian(23.439 - 0.0000004 * d);

  const deklination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  let rektascension = Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda)
  );

  // Greenwich middel-stjernetid -> lokal timevinkel
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = tilRadian(((gmst * 15 + lon) % 360 + 360) % 360);
  let timevinkel = lst - rektascension;
  timevinkel = Math.atan2(Math.sin(timevinkel), Math.cos(timevinkel));

  const latR = tilRadian(lat);
  const sinH =
    Math.sin(latR) * Math.sin(deklination) +
    Math.cos(latR) * Math.cos(deklination) * Math.cos(timevinkel);
  const hoejde = Math.asin(Math.max(-1, Math.min(1, sinH)));

  // Azimut målt fra syd, positiv mod vest
  const azimut = Math.atan2(
    Math.sin(timevinkel),
    Math.cos(timevinkel) * Math.sin(latR) - Math.tan(deklination) * Math.cos(latR)
  );

  return {
    hoejde: tilGrader(hoejde),
    azimut: tilGrader(azimut),
    deklination: tilGrader(deklination),
  };
}

/**
 * Solhøjden ved solhverv/jævndøgn midt på dagen - bruges som
 * dimensionerende kriterium for rækkeafstand.
 * @param {number} lat
 * @param {number} deklination grader (-23.44 vintersolhverv, 0 jævndøgn)
 * @param {number} timerFraSolMiddag
 */
export function solhoejdeVedTimevinkel(lat, deklination, timerFraSolMiddag) {
  const H = tilRadian(timerFraSolMiddag * 15);
  const latR = tilRadian(lat), decR = tilRadian(deklination);
  const sinH =
    Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(H);
  return tilGrader(Math.asin(Math.max(-1, Math.min(1, sinH))));
}

/** Tilsvarende azimut (fra syd, positiv mod vest). */
export function solazimutVedTimevinkel(lat, deklination, timerFraSolMiddag) {
  const H = tilRadian(timerFraSolMiddag * 15);
  const latR = tilRadian(lat), decR = tilRadian(deklination);
  return tilGrader(
    Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(latR) - Math.tan(decR) * Math.cos(latR))
  );
}

/**
 * Nødvendig rækkeafstand (pitch) for at undgå selvskygning ved en given
 * dimensionerende solhøjde.
 *
 *   pitch = b * cos(t)  +  b * sin(t) / tan(h) * |cos(a_sol - a_panel)|
 *
 * hvor b er panelets længde i hældningsretningen, t hældningen, h solhøjden
 * og a azimut. Formlen er standard-geometri for frit opstillede rækker.
 */
export function raekkeafstand({ panelLaengde, haeldningGrader, solhoejdeGrader, azimutAfvigelseGrader = 0 }) {
  const t = tilRadian(haeldningGrader);
  const h = tilRadian(Math.max(1, solhoejdeGrader));
  const skyggeLaengde = (panelLaengde * Math.sin(t)) / Math.tan(h);
  const projiceret = Math.abs(Math.cos(tilRadian(azimutAfvigelseGrader)));
  return panelLaengde * Math.cos(t) + skyggeLaengde * projiceret;
}

/**
 * Enhedsvektor mod solen i det lokale plan (x=øst, y=nord, z=op).
 */
export function solvektor(hoejdeGrader, azimutGrader) {
  const h = tilRadian(hoejdeGrader);
  const a = tilRadian(azimutGrader); // fra syd, positiv mod vest
  // Syd er (0,-1,0) og vest er (1,0,0) i planet x=øst, y=nord.
  return {
    x: Math.cos(h) * Math.sin(a),
    y: -Math.cos(h) * Math.cos(a),
    z: Math.sin(h),
  };
}

/**
 * cos til indfaldsvinklen på en flade med given hældning og azimut.
 * Negativ værdi betyder at solen står bag fladen.
 */
export function cosIndfaldsvinkel(solhoejde, solazimut, haeldning, panelazimut) {
  const h = tilRadian(solhoejde), t = tilRadian(haeldning);
  const da = tilRadian(solazimut - panelazimut);
  return Math.sin(h) * Math.cos(t) + Math.cos(h) * Math.sin(t) * Math.cos(da);
}

/**
 * Andel af panelets skrå længde, der er i skygge fra rækken foran.
 *
 * Lukket form udledt af samme geometri som rækkeafstand():
 *   f = 1 - d / (b * (cos t + k)),   k = sin t * cos(da) / tan(h)
 * hvor d er rækkeafstanden, b panelets længde i faldretningen, t
 * hældningen, h solhøjden og da solens azimutafvigelse fra panelet.
 * f = 0 når d er mindst den beregnede rækkeafstand.
 */
export function selvskyggetAndel({ raekkeafstandM, panelLaengde, haeldningGrader, solhoejdeGrader, azimutAfvigelseGrader }) {
  if (solhoejdeGrader <= 0.5) return 1;
  const t = tilRadian(haeldningGrader);
  const cosDa = Math.cos(tilRadian(azimutAfvigelseGrader));
  if (cosDa <= 0) return 0; // solen står bag rækken; ingen skygge fremad
  const k = (Math.sin(t) * cosDa) / Math.tan(tilRadian(solhoejdeGrader));
  const naevner = panelLaengde * (Math.cos(t) + k);
  if (naevner <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - raekkeafstandM / naevner));
}

/**
 * Et repræsentativt sæt soltidspunkter over året, vægtet med et groft
 * clear-sky indstrålingsmål. Bruges af modul 8 til at vægte skyggetab, så
 * en skygge i december tæller mindre end en skygge i juni.
 */
export function aarsSolpunkter(lat, lon, { dageIntervalDage = 15, timeSkridt = 1 } = {}) {
  const punkter = [];
  const aar = new Date().getUTCFullYear();
  for (let dag = 0; dag < 365; dag += dageIntervalDage) {
    for (let time = 0; time < 24; time += timeSkridt) {
      const dato = new Date(Date.UTC(aar, 0, 1 + dag, time, 30, 0));
      const { hoejde, azimut } = solposition(dato, lat, lon);
      if (hoejde <= 3) continue; // under 3 grader bidrager reelt ingenting
      // Clear-sky luftmasse-model som vægt (Kasten-Young)
      const am = 1 / (Math.sin(tilRadian(hoejde)) + 0.50572 * Math.pow(hoejde + 6.07995, -1.6364));
      const dni = 1353 * Math.pow(0.7, Math.pow(am, 0.678));
      punkter.push({
        dato, hoejde, azimut,
        vaegt: dni * Math.sin(tilRadian(hoejde)) * dageIntervalDage * timeSkridt,
      });
    }
  }
  const sum = punkter.reduce((s, p) => s + p.vaegt, 0) || 1;
  for (const p of punkter) p.vaegt /= sum;
  return punkter;
}
