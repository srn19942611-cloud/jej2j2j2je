/**
 * SVG-tegning af tagfladen med panelplacering.
 *
 * Bruges både af UI'et og af rapporten, så de to altid viser det samme.
 * Tegningen er i tagets lokale metriske plan, med nord opad.
 */

import { bbox } from "./geometri.js";

const FARVER = {
  tag: "#f4f1ea",
  tagkant: "#3d4451",
  panel: "#1d3f6e",
  panelOest: "#2f6ea8",
  panelVest: "#7aa5cc",
  forhindring: "#b8532f",
  brandvej: "#d99a2b",
  skygge: "#8a2f2f",
  maal: "#6b7385",
  tekst: "#1b2130",
};

/**
 * @param {object} data
 * @param {Array} data.tagpolygonMeter
 * @param {Array} data.paneler
 * @param {Array} [data.forhindringer]
 * @param {Array} [data.brandveje]
 * @param {Array} [data.panelTab]      fra modul 8, farver panelerne efter skyggetab
 * @param {object} [opt]
 */
export function tegnTag(data, opt = {}) {
  const { bredde = 900, margin = 60, visSkygge = false, visMaal = true } = opt;
  const tag = data.tagpolygonMeter ?? [];
  if (tag.length < 3) return `<svg xmlns="http://www.w3.org/2000/svg" width="${bredde}" height="80"></svg>`;

  const b = bbox(tag);
  const bM = b.maxX - b.minX, hM = b.maxY - b.minY;
  const skala = (bredde - 2 * margin) / bM;
  const hoejde = hM * skala + 2 * margin;

  // y vendes, så nord peger opad i tegningen
  const X = (x) => margin + (x - b.minX) * skala;
  const Y = (y) => hoejde - margin - (y - b.minY) * skala;
  const sti = (ring) => ring.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ") + " Z";

  const tabKort = new Map((data.panelTab ?? []).map((t) => [t.id, t.skyggetabPct]));
  const dele = [];

  dele.push(`<rect width="${bredde}" height="${hoejde}" fill="#ffffff"/>`);
  dele.push(`<path d="${sti(tag)}" fill="${FARVER.tag}" stroke="${FARVER.tagkant}" stroke-width="2"/>`);

  // Brandveje under panelerne, så konflikter er synlige
  for (const v of data.brandveje ?? []) {
    dele.push(`<path d="${sti(v.polygonMeter)}" fill="${FARVER.brandvej}" fill-opacity="0.18" stroke="${FARVER.brandvej}" stroke-width="1" stroke-dasharray="6 4"/>`);
  }

  for (const f of data.forhindringer ?? []) {
    if (!f.polygonMeter?.length) continue;
    dele.push(`<path d="${sti(f.polygonMeter)}" fill="${FARVER.forhindring}" fill-opacity="0.35" stroke="${FARVER.forhindring}" stroke-width="1.5"/>`);
    const c = midt(f.polygonMeter);
    dele.push(`<text x="${X(c.x).toFixed(1)}" y="${Y(c.y).toFixed(1)}" font-size="9" fill="${FARVER.tekst}" text-anchor="middle" dominant-baseline="middle">${undslip(f.type ?? "")}</text>`);
  }

  for (const p of data.paneler ?? []) {
    let fyld = FARVER.panel;
    if (visSkygge && tabKort.has(p.id)) {
      const t = tabKort.get(p.id);
      fyld = t > 20 ? FARVER.skygge : t > 10 ? "#b06a3b" : t > 3 ? "#7a8a5e" : FARVER.panel;
    } else if (p.orientering === "oest") fyld = FARVER.panelOest;
    else if (p.orientering === "vest") fyld = FARVER.panelVest;
    dele.push(`<path d="${sti(p.hjoerner)}" fill="${fyld}" fill-opacity="0.9" stroke="#ffffff" stroke-width="0.4"/>`);
  }

  if (visMaal) {
    const y = hoejde - margin / 2.2;
    dele.push(`<line x1="${X(b.minX)}" y1="${y}" x2="${X(b.maxX)}" y2="${y}" stroke="${FARVER.mål}" stroke-width="1"/>`);
    dele.push(`<text x="${(X(b.minX) + X(b.maxX)) / 2}" y="${y - 5}" font-size="11" fill="${FARVER.mål}" text-anchor="middle">${bM.toFixed(1)} m</text>`);
    const x = margin / 2.2;
    dele.push(`<line x1="${x}" y1="${Y(b.minY)}" x2="${x}" y2="${Y(b.maxY)}" stroke="${FARVER.mål}" stroke-width="1"/>`);
    dele.push(`<text x="${x + 4}" y="${(Y(b.minY) + Y(b.maxY)) / 2}" font-size="11" fill="${FARVER.mål}" transform="rotate(-90 ${x + 4} ${(Y(b.minY) + Y(b.maxY)) / 2})" text-anchor="middle">${hM.toFixed(1)} m</text>`);
    // Nordpil
    const nx = bredde - margin / 2, ny = margin / 1.5;
    dele.push(`<path d="M${nx},${ny + 14} L${nx},${ny - 12} M${nx - 5},${ny - 5} L${nx},${ny - 12} L${nx + 5},${ny - 5}" stroke="${FARVER.tekst}" stroke-width="1.6" fill="none"/>`);
    dele.push(`<text x="${nx}" y="${ny + 26}" font-size="11" fill="${FARVER.tekst}" text-anchor="middle">N</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bredde} ${hoejde.toFixed(0)}" width="${bredde}" height="${hoejde.toFixed(0)}" font-family="system-ui, sans-serif">${dele.join("")}</svg>`;
}

function midt(ring) {
  return {
    x: ring.reduce((s, p) => s + p.x, 0) / ring.length,
    y: ring.reduce((s, p) => s + p.y, 0) / ring.length,
  };
}

export function undslip(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export { FARVER };
