/**
 * Geometri-primitiver i et lokalt metrisk plan.
 *
 * Alle tag-beregninger foregår i meter i et lokalt ENU-plan (x = øst,
 * y = nord) med origo i bygningens centroide. For en enkelt bygning er
 * fejlen ved den plane approksimation under en millimeter, så vi undgår
 * en fuld projektionsafhængighed.
 */

const GRADER = Math.PI / 180;
export const tilRadian = (g) => g * GRADER;
export const tilGrader = (r) => r / GRADER;

/* ------------------------------------------------------------------ */
/* Projektion                                                          */
/* ------------------------------------------------------------------ */

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** Meter pr. grad breddegrad og længdegrad på en given breddegrad. */
export function meterPrGrad(lat) {
  const s = Math.sin(tilRadian(lat));
  const n = 1 - WGS84_E2 * s * s;
  const mLat = (Math.PI * WGS84_A * (1 - WGS84_E2)) / (180 * Math.pow(n, 1.5));
  const mLon = (Math.PI * WGS84_A * Math.cos(tilRadian(lat))) / (180 * Math.sqrt(n));
  return { mLat, mLon };
}

/** Bygger en frem-og-tilbage projektion mellem WGS84 og lokalt metrisk plan. */
export function lokaltPlan(origoLat, origoLon) {
  const { mLat, mLon } = meterPrGrad(origoLat);
  return {
    origo: { lat: origoLat, lon: origoLon },
    tilMeter: ({ lat, lon }) => ({ x: (lon - origoLon) * mLon, y: (lat - origoLat) * mLat }),
    tilGrad: ({ x, y }) => ({ lat: origoLat + y / mLat, lon: origoLon + x / mLon }),
  };
}

/* ------------------------------------------------------------------ */
/* Polygoner                                                           */
/* ------------------------------------------------------------------ */

/** Sikrer at ringen er lukket-fri (uden gentaget slutpunkt) og mod uret. */
export function normaliserRing(punkter) {
  const p = punkter.slice();
  if (p.length > 1) {
    const a = p[0], b = p[p.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) p.pop();
  }
  return signeretAreal(p) < 0 ? p.reverse() : p;
}

export function signeretAreal(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const areal = (ring) => Math.abs(signeretAreal(ring));

export function centroide(ring) {
  const a = signeretAreal(ring);
  if (Math.abs(a) < 1e-12) {
    const n = ring.length || 1;
    return {
      x: ring.reduce((s, p) => s + p.x, 0) / n,
      y: ring.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  let cx = 0, cy = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function bbox(ring) {
  const xs = ring.map((p) => p.x), ys = ring.map((p) => p.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

/** Ray casting. Punkter præcis på kanten regnes som indenfor. */
export function punktIPolygon(p, ring) {
  let inde = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (afstandPunktSegment(p, a, b) < 1e-9) return true;
    const kryds = a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (kryds) inde = !inde;
  }
  return inde;
}

export function afstandPunktSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Mindste afstand fra et punkt til polygonens rand (uanset inde/ude). */
export function afstandTilRand(p, ring) {
  let d = Infinity;
  for (let i = 0, n = ring.length; i < n; i++) {
    d = Math.min(d, afstandPunktSegment(p, ring[i], ring[(i + 1) % n]));
  }
  return d;
}

/**
 * Ligger hele rektanglet mindst `margin` inde i polygonen?
 *
 * Vi undgår bevidst polygon-offset (som selvskærer på konkave tage) og
 * tester i stedet hjørnerne direkte. Kantmidtpunkter tages med, så et
 * langt panel ikke kan spænde hen over et smalt indhak i tagfladen.
 */
export function rektangelInde(hjoerner, ring, margin = 0) {
  const test = [...hjoerner, ...kantMidtpunkter(hjoerner)];
  for (const h of test) {
    if (!punktIPolygon(h, ring)) return false;
    if (margin > 0 && afstandTilRand(h, ring) < margin - 1e-9) return false;
  }
  return true;
}

export function kantMidtpunkter(hjoerner) {
  const ud = [];
  for (let i = 0, n = hjoerner.length; i < n; i++) {
    const a = hjoerner[i], b = hjoerner[(i + 1) % n];
    ud.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return ud;
}

/* ------------------------------------------------------------------ */
/* Rektangler og rotation                                              */
/* ------------------------------------------------------------------ */

export function rotér(p, vinkelRad, om = { x: 0, y: 0 }) {
  const c = Math.cos(vinkelRad), s = Math.sin(vinkelRad);
  const dx = p.x - om.x, dy = p.y - om.y;
  return { x: om.x + dx * c - dy * s, y: om.y + dx * s + dy * c };
}

/** Hjørnerne på et akse-parallelt rektangel, roteret `rotation` radianer. */
export function rektangelHjoerner(rekt, om = { x: 0, y: 0 }) {
  const { x, y, bredde, hoejde, rotation = 0 } = rekt;
  const raa = [
    { x, y },
    { x: x + bredde, y },
    { x: x + bredde, y: y + hoejde },
    { x, y: y + hoejde },
  ];
  return rotation ? raa.map((p) => rotér(p, rotation, om)) : raa;
}

/** Separating axis theorem for to konvekse polygoner. */
export function overlapper(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0, n = poly.length; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      const akse = { x: -(q.y - p.y), y: q.x - p.x };
      const [a0, a1] = projicér(a, akse);
      const [b0, b1] = projicér(b, akse);
      if (a1 < b0 - 1e-9 || b1 < a0 - 1e-9) return false;
    }
  }
  return true;
}

function projicér(poly, akse) {
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) {
    const v = p.x * akse.x + p.y * akse.y;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return [lo, hi];
}

/** Udvider et rektangel-lignende hjørnesæt med `d` meter i alle retninger. */
export function bufferHjoerner(hjoerner, d) {
  if (d === 0) return hjoerner.slice();
  const c = centroide(hjoerner);
  return hjoerner.map((p) => {
    const dx = p.x - c.x, dy = p.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * d, y: p.y + (dy / len) * d };
  });
}

/** GeoJSON-ring (lon/lat-par) -> lokale meterkoordinater. */
export function ringTilMeter(koordinater, plan) {
  return normaliserRing(
    koordinater.map(([lon, lat]) => plan.tilMeter({ lat, lon }))
  );
}
