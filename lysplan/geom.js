/* Små geometri-hjælpere. Alle koordinater er i tegningens billed-pixels;
   omregning til meter sker via state.pxPerMeter. */

const Geom = {
  dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); },

  polylineLength(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Geom.dist(pts[i - 1], pts[i]);
    return l;
  },

  polygonArea(pts) {
    let s = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      s += (pts[j][0] * pts[i][1]) - (pts[i][0] * pts[j][1]);
    }
    return Math.abs(s / 2);
  },

  pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      const snit = (yi > p[1]) !== (yj > p[1]) &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi;
      if (snit) inside = !inside;
    }
    return inside;
  },

  /* Nærmeste punkt på linjestykke a-b samt afstand og parameter t. */
  projectOnSegment(p, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy;
    let t = len2 === 0 ? 0 : ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    const q = [a[0] + t * vx, a[1] + t * vy];
    return { punkt: q, t, afstand: Geom.dist(p, q) };
  },

  /* Nærmeste punkt på en polylinje. */
  projectOnPolyline(p, pts) {
    let bedst = null;
    for (let i = 1; i < pts.length; i++) {
      const r = Geom.projectOnSegment(p, pts[i - 1], pts[i]);
      if (!bedst || r.afstand < bedst.afstand) {
        bedst = { ...r, index: i - 1, vinkel: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) };
      }
    }
    return bedst;
  },

  /* Punkt på polylinje i afstanden d fra start. */
  pointAtLength(pts, d) {
    let rest = d;
    for (let i = 1; i < pts.length; i++) {
      const l = Geom.dist(pts[i - 1], pts[i]);
      if (rest <= l || i === pts.length - 1) {
        const t = l === 0 ? 0 : Math.max(0, Math.min(1, rest / l));
        return {
          punkt: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
                  pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t],
          vinkel: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
        };
      }
      rest -= l;
    }
    return { punkt: pts[0].slice(), vinkel: 0 };
  },

  rotate(p, c, a) {
    const cos = Math.cos(a), sin = Math.sin(a);
    const dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
  },

  bbox(pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  },

  /* Skæring mellem den vandrette linje y=y og en polygon.
     Returnerer sorterede x-intervaller der ligger inde i polygonen. */
  scanline(poly, y) {
    const xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y)) {
        xs.push(xi + ((xj - xi) * (y - yi)) / (yj - yi));
      }
    }
    xs.sort((a, b) => a - b);
    const intervaller = [];
    for (let i = 0; i + 1 < xs.length; i += 2) intervaller.push([xs[i], xs[i + 1]]);
    return intervaller;
  },

  /* Længste kant i en polygon - bruges til at orientere skinnerækker. */
  longestEdgeAngle(poly) {
    let bedst = 0, l = -1;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const d = Geom.dist(a, b);
      if (d > l) { l = d; bedst = Math.atan2(b[1] - a[1], b[0] - a[0]); }
    }
    return bedst;
  },

  snapOrtho(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return Math.abs(dx) > Math.abs(dy) ? [b[0], a[1]] : [a[0], b[1]];
  }
};
