/* Små, robuste statistikfunktioner.
 *
 * Alle er valgt, fordi de tåler udbrud. Driftsdata er fulde af enkeltdøgn,
 * der ikke ligner noget: en ombygning, en målerfejl, en helligdag. Bruger man
 * gennemsnit og standardafvigelse, flytter ét sådant døgn baseline så meget,
 * at den rigtige fejl dagen efter forsvinder i støjen.
 *
 * Median, MAD og Theil–Sen gør ikke det. De koster en smule følsomhed, og det
 * er en god handel: en detektor, der larmer på ombygninger, bliver slået fra.
 */

export const median = (a) => {
  const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Median absolute deviation, skaleret så den kan læses som en spredning. */
export const mad = (a) => {
  const m = median(a);
  if (m == null) return null;
  const afvig = a.filter(Number.isFinite).map((x) => Math.abs(x - m));
  const d = median(afvig);
  return d == null ? null : d * 1.4826;
};

/** Robust z-score. Bruger MAD frem for standardafvigelse. */
export function robustZ(vaerdi, serie) {
  const m = median(serie);
  let s = mad(serie);
  if (m == null) return null;
  // Står serien helt stille, er enhver afvigelse markant — men vi sætter et
  // gulv, så et enkelt kWh på en måler, der normalt viser nul, ikke bliver
  // til en alarm med z = uendelig.
  if (!s || s < 1e-9) s = Math.max(Math.abs(m) * 0.05, 0.5);
  return (vaerdi - m) / s;
}

export const kvantil = (a, p) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};

/**
 * Theil–Sen: hældningen som medianen af alle parvise hældninger.
 * Robust mod udbrud, i modsætning til mindste kvadraters regression, hvor ét
 * skævt punkt kan vippe hele trenden.
 */
export function theilSen(punkter) {
  const p = punkter.filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
  if (p.length < 4) return null;
  const haeldninger = [];
  // Ved mange punkter bliver alle par dyrt; vi tager et fast raster i stedet,
  // hvilket giver samme svar inden for få procent.
  const spring = p.length > 120 ? Math.ceil(p.length / 120) : 1;
  for (let i = 0; i < p.length; i += spring) {
    for (let j = i + spring; j < p.length; j += spring) {
      const dx = p[j].x - p[i].x;
      if (dx !== 0) haeldninger.push((p[j].y - p[i].y) / dx);
    }
  }
  const h = median(haeldninger);
  if (h == null) return null;
  const skaering = median(p.map((d) => d.y - h * d.x));
  return { haeldning: h, skaering, n: p.length };
}

/**
 * Vægtet mindste kvadraters regression med flere forklarende variable.
 * Bruges til vejrmodellen: forbrug = basis + a·varmegraddage + b·kølegraddage.
 * Løses med normalligningerne og Gauss-elimination — få variable, så det er
 * både hurtigt nok og til at gennemskue.
 */
export function regression(raekker, variable) {
  const X = [], y = [];
  for (const r of raekker) {
    const rk = [1, ...variable.map((v) => r[v])];
    if (rk.some((v) => !Number.isFinite(v)) || !Number.isFinite(r.y)) continue;
    X.push(rk); y.push(r.y);
  }
  const n = X.length, k = variable.length + 1;
  if (n < k + 3) return null;   // for få punkter til at sige noget

  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const koef = loes(XtX, Xty);
  if (!koef) return null;

  const forudsig = (r) => koef[0] + variable.reduce((s, v, i) => s + koef[i + 1] * r[v], 0);
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  let sse = 0, sst = 0;
  for (let i = 0; i < n; i++) {
    const p = koef.reduce((s, c, j) => s + c * X[i][j], 0);
    sse += (y[i] - p) ** 2;
    sst += (y[i] - ybar) ** 2;
  }
  return {
    basis: koef[0],
    koefficienter: Object.fromEntries(variable.map((v, i) => [v, koef[i + 1]])),
    r2: sst > 0 ? 1 - sse / sst : null,
    rmse: Math.sqrt(sse / n),
    n,
    forudsig,
  };
}

function loes(A, b) {
  const k = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let r = i + 1; r < k; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-10) return null;   // singulær — variablene er afhængige
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = 0; r < k; r++) {
      if (r === i) continue;
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= k; c++) M[r][c] -= f * M[i][c];
    }
  }
  // M er nu på diagonalform: hver række har sin pivot på plads i og
  // højresiden i kolonne k.
  return M.map((raekke, i) => raekke[k] / raekke[i]);
}

/**
 * CUSUM: finder det punkt, hvor en serie skifter niveau.
 * Bedre end at sammenligne to perioder, fordi den finder skiftet selv frem for
 * at forudsætte hvornår det skete — og fordi den kræver, at skiftet HOLDER.
 * Et enkelt skævt døgn giver ikke udslag.
 */
export function cusum(serie, { minStyrke = 3, minSegment = 7 } = {}) {
  const v = serie.filter(Number.isFinite);
  if (v.length < 2 * minSegment) return null;

  /* Klassisk CUSUM-estimator for skiftepunktet.
   *
   * S_i er den kumulerede afvigelse fra middelværdien. Ved et spring OP
   * falder S indtil springet og stiger derefter — så skiftepunktet er dér,
   * hvor |S| er størst. Det er vigtigt at bruge netop den, for den
   * tabelform af CUSUM, der bruges til procesovervågning, akkumulerer
   * videre til seriens ende og ville udpege sidste døgn som bruddet.
   */
  const middel = v.reduce((a, b) => a + b, 0) / v.length;
  const S = [];
  let sum = 0;
  for (const x of v) { sum += x - middel; S.push(sum); }

  let k = 0;
  for (let i = 1; i < S.length; i++) if (Math.abs(S[i]) > Math.abs(S[k])) k = i;
  // Skiftet ligger lige efter yderpunktet.
  const indeks = Math.min(Math.max(k + 1, minSegment), v.length - minSegment);
  if (indeks < minSegment || v.length - indeks < minSegment) return null;

  const foer = median(v.slice(0, indeks));
  const efter = median(v.slice(indeks));
  const forskel = efter - foer;
  const spredning = mad(v.slice(0, indeks)) || mad(v) || 1;

  // Styrken er springet målt i spredninger af perioden FØR skiftet, vægtet
  // med hvor mange døgn der bekræfter det. Et stort spring, der kun har
  // holdt i tre døgn, er ikke et niveauskift endnu.
  const doegn = v.length - indeks;
  const styrke = Math.abs(forskel) / spredning * Math.min(1, Math.sqrt(doegn / 14));
  if (styrke < minStyrke) return null;

  return { indeks, styrke, retning: forskel > 0 ? 'op' : 'ned', foer, efter, forskel, doegn, n: v.length };
}

/** Andel af serien, der overhovedet har data. Under 70 % giver forbehold. */
export const daekning = (serie) => (serie.length
  ? Math.round(100 * serie.filter((x) => Number.isFinite(x)).length / serie.length) : 0);
