/* Lysplan - belysningsplanlægning oven på importerede bygningstegninger.
   Ingen build, ingen server: alt kører i browseren og alle data bliver i maskinen. */

'use strict';

const state = {
  lag: [],            // importerede tegninger
  pxPerMeter: null,   // målestok, sat via kalibrering
  kalibrering: null,  // {a, b, meter}
  omraade: [],        // polygon for salgsareal
  skinner: [],        // {id, pts:[[x,y]...], montage:'wire'|'loft'}
  armaturer: [],      // {id, type, x, y, vinkel, skinneId}
  manuelt: {},        // manuelle tillæg til styklisten, pr. katalognøgle
  valgt: null,        // {slags:'skinne'|'armatur'|'omraade', id}
  vaerktoej: 'pan',
  kladde: [],         // punkter under tegning
  muse: null,         // sidste musepunkt i verdenskoordinater
  visning: { x: 0, y: 0, zoom: 1 },
  indst: {
    preset: 'superbrugsen',
    mode: 'track',
    ccSkinner: 2.5, margin: 1.0, ccX: 2.4, ccY: 2.4,
    maalLux: 800, uf: 0.5, mf: 0.8, loftshoejde: 3.2,
    primaer: 'bricks', accent: 'sirius', accentRatio: 0.35,
    minAfstand: 1.2, wireCC: 1.4, startPrRaekke: 1, wireMontage: 'wire',
    retning: 'auto', autoTaethed: true, dwgKilde: ''
  },
  projekt: {
    navn: '', adresse: '', by: '', tegner: '', maalestok: '1:100',
    dato: new Date().toISOString().slice(0, 10)
  }
};

const historik = [];
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
let nextId = 1;
const nyId = () => 'o' + (nextId++);

const fmt = (n, d = 0) => (isFinite(n) ? n : 0).toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d });

function toast(besked, slags = 'info') {
  const el = $('#toast');
  el.textContent = besked;
  el.dataset.slags = slags;
  el.classList.add('vis');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('vis'), 3200);
}

/* ---------- historik (fortryd) ---------- */
function gem() {
  historik.push(JSON.stringify({
    omraade: state.omraade, skinner: state.skinner,
    armaturer: state.armaturer, manuelt: state.manuelt
  }));
  if (historik.length > 60) historik.shift();
}
function fortryd() {
  const s = historik.pop();
  if (!s) { toast('Intet at fortryde'); return; }
  const d = JSON.parse(s);
  state.omraade = d.omraade; state.skinner = d.skinner;
  state.armaturer = d.armaturer; state.manuelt = d.manuelt;
  state.valgt = null;
  opdater();
}

/* ---------- målestok ---------- */
const mToPx = m => m * (state.pxPerMeter || 1);
const pxToM = px => px / (state.pxPerMeter || 1);
const harMaalestok = () => !!state.pxPerMeter;

/* ---------- filimport ---------- */
async function importerFiler(filer) {
  for (const fil of filer) {
    const navn = fil.name || 'tegning';
    try {
      if (/\.pdf$/i.test(navn) || fil.type === 'application/pdf') {
        await importerPdf(fil, navn);
      } else if (/\.dxf$/i.test(navn)) {
        toast('Læser DXF …');
        await importerCad(navn, CAD.parseDxf(await fil.text()));
      } else if (/\.dwg$/i.test(navn)) {
        toast('Henter DWG-motor og læser tegningen …');
        await importerCad(navn, await CAD.læsDwg(await fil.arrayBuffer(), state.indst.dwgKilde));
      } else if (fil.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(navn)) {
        await tilføjLag(navn, await læsSomDataUrl(fil));
      } else {
        toast('Filtypen understøttes ikke: ' + navn, 'fejl');
      }
    } catch (e) {
      console.error(e);
      toast(navn + ': ' + (e && e.message ? e.message : 'kunne ikke læses'), 'fejl');
    }
  }
  opdater();
}

/* CAD-tegning (DXF/DWG) lægges ind som vektorlag i tegningens egne mål. */
async function importerCad(navn, db) {
  const flad = CAD.fladgør(db);
  if (!flad.streger.length && !flad.tekster.length) {
    toast(navn + ': tegningen indeholder ingen linjer der kan vises', 'fejl');
    return null;
  }
  const nyMaalestok = !state.pxPerMeter;
  const pxPerM = state.pxPerMeter || 100;
  const k = flad.meterPerEnhed * pxPerM;       // verdens-px pr. CAD-enhed
  const r = flad.ramme;
  for (const s of flad.streger) {
    for (let i = 0; i < s.p.length; i += 2) {
      s.p[i] = (s.p[i] - r.x0) * k;
      s.p[i + 1] = (r.y1 - s.p[i + 1]) * k;     // DXF har y opad, lærredet nedad
    }
  }
  for (const t of flad.tekster) {
    t.x = (t.x - r.x0) * k;
    t.y = (r.y1 - t.y) * k;
    t.h = t.h * k;
    t.v = -t.v;
  }
  const lag = {
    id: nyId(), navn, slags: 'cad', synlig: true, opacitet: 1, x: 0, y: 0, skala: 1,
    bredde: (r.x1 - r.x0) * k, højde: (r.y1 - r.y0) * k,
    tegning: { streger: flad.streger, tekster: flad.tekster, lagInfo: flad.lagInfo, meterPerEnhed: flad.meterPerEnhed },
    egneFarver: false,
    cadLag: Object.fromEntries(Object.values(flad.lagInfo).map(l => [l.navn, l.synlig !== false]))
  };
  byggCadGrupper(lag);
  state.lag.push(lag);
  if (nyMaalestok) {
    state.pxPerMeter = pxPerM;
    toast(flad.gættetEnhed
      ? `${navn} indlæst. Enheden stod ikke i filen – der er regnet med ${flad.meterPerEnhed === 0.001 ? 'millimeter' : 'meter'}. Tjek et kendt mål med målestoksværktøjet.`
      : `${navn} indlæst med målestok fra tegningen (${fmt(1 / flad.meterPerEnhed, 0)} enheder pr. meter).`);
  } else {
    toast(`${navn} indlæst. Skalering følger den målestok, der allerede er sat.`);
  }
  if (state.lag.length === 1) tilpasVisning();
  return lag;
}

/* Linjerne samles i én Path2D pr. CAD-lag og farve, så store tegninger
   kan tegnes hurtigt ved hver panorering. */
function byggCadGrupper(lag) {
  const grupper = new Map();
  for (const s of lag.tegning.streger) {
    const nøgle = s.lag + '|' + s.aci;
    let g = grupper.get(nøgle);
    if (!g) { g = { lag: s.lag, aci: s.aci, sti: new Path2D() }; grupper.set(nøgle, g); }
    g.sti.moveTo(s.p[0], s.p[1]);
    for (let i = 2; i < s.p.length; i += 2) g.sti.lineTo(s.p[i], s.p[i + 1]);
  }
  lag.grupper = Array.from(grupper.values());
}

function lagRamme(lag) {
  const b = lag.slags === 'cad' ? lag.bredde : lag.img.width * lag.skala;
  const h = lag.slags === 'cad' ? lag.højde : lag.img.height * lag.skala;
  const s = lag.slags === 'cad' ? lag.skala : 1;
  return { x0: lag.x, y0: lag.y, x1: lag.x + b * s, y1: lag.y + h * s };
}

function læsSomDataUrl(fil) {
  return new Promise((ok, fejl) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => fejl(r.error);
    r.readAsDataURL(fil);
  });
}

function tilføjLag(navn, src) {
  return new Promise(ok => {
    const img = new Image();
    img.onload = () => {
      const lag = {
        id: nyId(), navn, src, img, slags: 'billede',
        synlig: true, opacitet: 1, x: 0, y: 0, skala: 1
      };
      state.lag.push(lag);
      if (state.lag.length === 1) tilpasVisning();
      ok(lag);
    };
    img.onerror = () => { toast('Kunne ikke læse ' + navn, 'fejl'); ok(null); };
    img.src = src;
  });
}

let pdfKlar = null;
function hentPdfBibliotek() {
  if (pdfKlar) return pdfKlar;
  pdfKlar = new Promise((ok, fejl) => {
    if (window.pdfjsLib) return ok(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      ok(window.pdfjsLib);
    };
    s.onerror = () => fejl(new Error('pdf.js kunne ikke hentes'));
    document.head.appendChild(s);
  });
  return pdfKlar;
}

async function importerPdf(fil, navn) {
  let lib;
  try {
    lib = await hentPdfBibliotek();
  } catch (e) {
    toast('PDF kræver netforbindelse. Gem tegningen som PNG og prøv igen.', 'fejl');
    return;
  }
  const data = await fil.arrayBuffer();
  const pdf = await lib.getDocument({ data }).promise;
  const sider = Math.min(pdf.numPages, 10);
  for (let i = 1; i <= sider; i++) {
    const side = await pdf.getPage(i);
    const grund = side.getViewport({ scale: 1 });
    // ~2200 px bred giver læsbare streger uden at sprænge hukommelsen
    const skala = Math.min(4, Math.max(1, 2200 / grund.width));
    const vp = side.getViewport({ scale: skala });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await side.render({ canvasContext: ctx, viewport: vp }).promise;
    await tilføjLag(sider > 1 ? `${navn} (s. ${i})` : navn, c.toDataURL('image/png'));
  }
}

/* ---------- visning ---------- */
const lærred = $('#lærred');
const ctx = lærred.getContext('2d');

function tilpasStørrelse() {
  const r = lærred.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  lærred.width = Math.round(r.width * dpr);
  lærred.height = Math.round(r.height * dpr);
  lærred.style.width = r.width + 'px';
  lærred.style.height = r.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tegn();
}

let eksportStørrelse = null;
function visningsStørrelse() {
  if (eksportStørrelse) return eksportStørrelse;
  const r = lærred.getBoundingClientRect();
  return { b: r.width, h: r.height };
}

function tilpasVisning() {
  const lag = state.lag.filter(l => l.synlig);
  if (!lag.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of lag) {
    const r = lagRamme(l);
    x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0);
    x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1);
  }
  const { b, h } = visningsStørrelse();
  const zoom = Math.min(b / (x1 - x0), h / (y1 - y0)) * 0.96;
  state.visning.zoom = zoom;
  state.visning.x = x0 - (b / zoom - (x1 - x0)) / 2;
  state.visning.y = y0 - (h / zoom - (y1 - y0)) / 2;
  tegn();
}

const tilSkærm = p => [(p[0] - state.visning.x) * state.visning.zoom, (p[1] - state.visning.y) * state.visning.zoom];
const tilVerden = p => [p[0] / state.visning.zoom + state.visning.x, p[1] / state.visning.zoom + state.visning.y];

function musePunkt(e) {
  const r = lærred.getBoundingClientRect();
  return tilVerden([e.clientX - r.left, e.clientY - r.top]);
}

/* ---------- tegning af planen ---------- */
const FARVER = {
  skinne: '#E02B20',
  skinneValgt: '#0B7BD4',
  bricks: '#1F9D4D',
  omraade: '#0B7BD4',
  spot: '#E02B20',
  pendel: '#C21FA8',
  panel: '#E02B20',
  maal: '#0B7BD4'
};

function tegn() {
  const { b, h } = visningsStørrelse();
  ctx.save();
  ctx.clearRect(0, 0, b, h);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--lærred') || '#fff';
  ctx.fillRect(0, 0, b, h);

  const z = state.visning.zoom;
  ctx.translate(-state.visning.x * z, -state.visning.y * z);
  ctx.scale(z, z);

  for (const lag of state.lag) {
    if (!lag.synlig) continue;
    ctx.globalAlpha = lag.opacitet;
    if (lag.slags === 'cad') tegnCadLag(lag);
    else ctx.drawImage(lag.img, lag.x, lag.y, lag.img.width * lag.skala, lag.img.height * lag.skala);
  }
  ctx.globalAlpha = 1;

  tegnOmraade();
  for (const s of state.skinner) tegnSkinne(s);
  for (const a of state.armaturer) tegnArmatur(a);
  tegnKladde();
  tegnKalibrering();

  ctx.restore();
  tegnMaalestoksLinje();
  const tom = document.getElementById('tom-besked');
  if (tom) tom.hidden = state.lag.length > 0;
}

function linjebredde(meter, min = 1.2) {
  const z = state.visning.zoom;
  return Math.max(min / z, harMaalestok() ? mToPx(meter) : 2 / z);
}

function cadStregFarve(lag, aci) {
  if (!lag.egneFarver) return '#3A4150';
  const f = CAD.aciFarve(aci);
  return (f === '#000000' || f === '#FFFFFF') ? '#1B2130' : f;
}

function tegnCadLag(lag) {
  ctx.save();
  ctx.translate(lag.x, lag.y);
  ctx.scale(lag.skala, lag.skala);
  // stregtykkelsen holdes på knap en skærm-pixel, også ved eksport i høj opløsning
  const t = ctx.getTransform();
  const enhed = Math.hypot(t.a, t.b) || 1;
  ctx.lineWidth = 0.9 / enhed;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const g of lag.grupper) {
    if (lag.cadLag[g.lag] === false) continue;
    ctx.strokeStyle = cadStregFarve(lag, g.aci);
    ctx.stroke(g.sti);
  }
  const tekster = lag.tegning.tekster;
  if (tekster.length) {
    ctx.textBaseline = 'alphabetic';
    for (const t of tekster) {
      if (lag.cadLag[t.lag] === false) continue;
      if (t.h * enhed < 7) continue;           // for småt til at kunne læses
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.v || 0);
      ctx.fillStyle = cadStregFarve(lag, t.aci);
      ctx.font = `${t.h}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(t.t, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function tegnOmraade() {
  if (state.omraade.length < 2) return;
  const z = state.visning.zoom;
  ctx.beginPath();
  ctx.moveTo(state.omraade[0][0], state.omraade[0][1]);
  for (const p of state.omraade.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = 'rgba(11,123,212,0.07)';
  ctx.fill();
  ctx.strokeStyle = FARVER.omraade;
  ctx.setLineDash([8 / z, 6 / z]);
  ctx.lineWidth = 1.6 / z;
  ctx.stroke();
  ctx.setLineDash([]);
}

function tegnSkinne(s) {
  const valgt = state.valgt && state.valgt.slags === 'skinne' && state.valgt.id === s.id;
  const z = state.visning.zoom;
  ctx.beginPath();
  ctx.moveTo(s.pts[0][0], s.pts[0][1]);
  for (const p of s.pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = valgt ? FARVER.skinneValgt : FARVER.skinne;
  ctx.lineWidth = linjebredde(0.05, 2.4);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.montage === 'loft') ctx.setLineDash([]);
  else ctx.setLineDash([]);
  ctx.stroke();

  // endemarkeringer
  for (const p of [s.pts[0], s.pts[s.pts.length - 1]]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], Math.max(2.5 / z, linjebredde(0.06)), 0, Math.PI * 2);
    ctx.fillStyle = valgt ? FARVER.skinneValgt : FARVER.skinne;
    ctx.fill();
  }
}

function tegnArmatur(a) {
  const f = FIXTURES[a.type];
  if (!f) return;
  const valgt = state.valgt && state.valgt.slags === 'armatur' && state.valgt.id === a.id;
  const z = state.visning.zoom;
  const enhed = harMaalestok() ? state.pxPerMeter : 40;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.vinkel || 0);
  ctx.lineWidth = Math.max(1.2 / z, enhed * 0.012);

  const L = f.laengde * enhed;
  switch (f.symbol) {
    case 'bricks':
      ctx.strokeStyle = FARVER.skinne;
      ctx.lineWidth = Math.max(2 / z, enhed * 0.05);
      ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke();
      ctx.strokeStyle = FARVER.bricks;
      ctx.lineWidth = Math.max(1.4 / z, enhed * 0.03);
      ctx.beginPath(); ctx.moveTo(-L / 2, -enhed * 0.05); ctx.lineTo(-L / 2, enhed * 0.05);
      ctx.moveTo(L / 2, -enhed * 0.05); ctx.lineTo(L / 2, enhed * 0.05); ctx.stroke();
      break;
    case 'spot':
      ctx.fillStyle = FARVER.spot;
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, -L * 0.4); ctx.lineTo(L * 0.5, 0); ctx.lineTo(-L * 0.5, L * 0.4);
      ctx.closePath(); ctx.fill();
      break;
    case 'pendel':
      ctx.strokeStyle = FARVER.pendel;
      ctx.beginPath(); ctx.arc(0, 0, L * 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, 0); ctx.lineTo(L * 0.5, 0);
      ctx.moveTo(0, -L * 0.5); ctx.lineTo(0, L * 0.5); ctx.stroke();
      break;
    case 'panel':
    case 'triproof': {
      const bredde = (f.symbol === 'panel' ? 0.3 : 0.12) * enhed;
      ctx.strokeStyle = FARVER.panel;
      ctx.strokeRect(-L / 2, -bredde / 2, L, bredde);
      ctx.beginPath();
      ctx.moveTo(-L / 2, -bredde / 2); ctx.lineTo(L / 2, bredde / 2);
      ctx.moveTo(-L / 2, bredde / 2); ctx.lineTo(L / 2, -bredde / 2);
      ctx.stroke();
      break;
    }
    case 'downlight':
      ctx.fillStyle = FARVER.spot;
      ctx.beginPath(); ctx.arc(0, 0, L * 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'gobo':
      ctx.strokeStyle = FARVER.pendel;
      ctx.beginPath(); ctx.arc(0, 0, L * 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = FARVER.pendel;
      ctx.beginPath(); ctx.arc(0, 0, L * 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    case 'park':
      ctx.strokeStyle = '#6B7385';
      ctx.beginPath(); ctx.arc(0, 0, L * 0.45, 0, Math.PI * 2); ctx.stroke();
      break;
    default:
      ctx.strokeStyle = FARVER.bricks;
      ctx.beginPath(); ctx.arc(0, 0, L * 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L * 0.8); ctx.stroke();
  }

  if (valgt) {
    ctx.strokeStyle = FARVER.skinneValgt;
    ctx.lineWidth = Math.max(1.4 / z, enhed * 0.015);
    ctx.strokeRect(-L * 0.6, -L * 0.45 - enhed * 0.05, L * 1.2, L * 0.9 + enhed * 0.1);
  }
  ctx.restore();
}

function tegnKladde() {
  if (!state.kladde.length) return;
  const z = state.visning.zoom;
  const pts = state.muse ? state.kladde.concat([state.muse]) : state.kladde;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = state.vaerktoej === 'omraade' ? FARVER.omraade : FARVER.skinne;
  ctx.setLineDash([6 / z, 4 / z]);
  ctx.lineWidth = 1.8 / z;
  ctx.stroke();
  ctx.setLineDash([]);
  for (const p of state.kladde) {
    ctx.beginPath(); ctx.arc(p[0], p[1], 3 / z, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 1.4 / z; ctx.stroke();
  }
}

function tegnKalibrering() {
  const k = state.kalibrering;
  if (!k) return;
  const z = state.visning.zoom;
  ctx.beginPath();
  ctx.moveTo(k.a[0], k.a[1]); ctx.lineTo(k.b[0], k.b[1]);
  ctx.strokeStyle = FARVER.maal;
  ctx.lineWidth = 2 / z;
  ctx.stroke();
  for (const p of [k.a, k.b]) {
    ctx.beginPath(); ctx.arc(p[0], p[1], 4 / z, 0, Math.PI * 2);
    ctx.fillStyle = FARVER.maal; ctx.fill();
  }
}

function tegnMaalestoksLinje() {
  if (!harMaalestok()) return;
  const { b, h } = visningsStørrelse();
  const pxPrM = state.pxPerMeter * state.visning.zoom;
  let meter = 1;
  const kandidater = [0.5, 1, 2, 5, 10, 20, 50, 100];
  for (const m of kandidater) { meter = m; if (m * pxPrM > 90) break; }
  const l = meter * pxPrM;
  const x = b - l - 24, y = h - 28;
  ctx.save();
  ctx.strokeStyle = '#1B2130';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillRect(x - 10, y - 18, l + 20, 34);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + l, y);
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
  ctx.moveTo(x + l, y - 5); ctx.lineTo(x + l, y + 5);
  ctx.stroke();
  ctx.fillStyle = '#1B2130';
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(meter + ' m', x + l / 2, y - 7);
  ctx.restore();
}

/* ---------- musehåndtering ---------- */
let træk = null;

lærred.addEventListener('pointerdown', e => {
  lærred.setPointerCapture(e.pointerId);
  const p = musePunkt(e);
  const panner = e.button === 1 || e.button === 2 || state.vaerktoej === 'pan' || e.shiftKey && state.vaerktoej === 'vaelg';
  if (panner) {
    træk = { slags: 'pan', startSkærm: [e.clientX, e.clientY], start: { ...state.visning } };
    return;
  }
  if (e.button !== 0) return;

  switch (state.vaerktoej) {
    case 'vaelg': {
      const ramt = ramtObjekt(p);
      state.valgt = ramt;
      if (ramt) {
        gem();
        træk = { slags: 'flyt', start: p, objekt: ramt, flyttet: false };
      }
      opdater();
      break;
    }
    case 'maalestok':
      state.kladde.push(p);
      if (state.kladde.length === 2) {
        const px = Geom.dist(state.kladde[0], state.kladde[1]);
        state.kalibrering = { a: state.kladde[0], b: state.kladde[1] };
        state.kladde = [];
        spørgMaalestok(px);
      }
      tegn();
      break;
    case 'omraade':
      state.kladde.push(e.altKey ? p : (state.kladde.length ? snapHvisOrtho(e, p) : p));
      tegn();
      break;
    case 'skinne':
      state.kladde.push(state.kladde.length ? snapHvisOrtho(e, p) : p);
      tegn();
      break;
    case 'slet': {
      const ramt = ramtObjekt(p);
      if (ramt) { gem(); fjernObjekt(ramt); opdater(); }
      break;
    }
    default:
      if (state.vaerktoej.startsWith('armatur:')) {
        gem();
        placerArmatur(state.vaerktoej.slice(8), p, !e.altKey);
        opdater();
      }
  }
});

lærred.addEventListener('pointermove', e => {
  const p = musePunkt(e);
  state.muse = state.kladde.length ? snapHvisOrtho(e, p) : p;
  visStatus(p);
  if (træk && træk.slags === 'pan') {
    const z = state.visning.zoom;
    state.visning.x = træk.start.x - (e.clientX - træk.startSkærm[0]) / z;
    state.visning.y = træk.start.y - (e.clientY - træk.startSkærm[1]) / z;
    tegn();
    return;
  }
  if (træk && træk.slags === 'flyt') {
    const dx = p[0] - træk.start[0], dy = p[1] - træk.start[1];
    træk.start = p;
    træk.flyttet = true;
    flytObjekt(træk.objekt, dx, dy);
    tegn();
    return;
  }
  if (state.kladde.length) tegn();
});

lærred.addEventListener('pointerup', e => {
  if (træk && træk.slags === 'flyt' && træk.flyttet) opdater();
  træk = null;
});

lærred.addEventListener('dblclick', () => afslutKladde());
lærred.addEventListener('contextmenu', e => e.preventDefault());

lærred.addEventListener('wheel', e => {
  e.preventDefault();
  const r = lærred.getBoundingClientRect();
  const skærm = [e.clientX - r.left, e.clientY - r.top];
  const før = tilVerden(skærm);
  const faktor = Math.exp(-e.deltaY * 0.0016);
  state.visning.zoom = Math.min(40, Math.max(0.02, state.visning.zoom * faktor));
  const efter = tilVerden(skærm);
  state.visning.x += før[0] - efter[0];
  state.visning.y += før[1] - efter[1];
  tegn();
}, { passive: false });

window.addEventListener('keydown', e => {
  if (/input|textarea|select/i.test(e.target.tagName)) return;
  if (e.key === 'Escape') { state.kladde = []; state.valgt = null; opdater(); }
  else if (e.key === 'Enter') afslutKladde();
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.valgt) { gem(); fjernObjekt(state.valgt); state.valgt = null; opdater(); }
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); fortryd(); }
  else if (e.key === 'v') vælgVærktøj('vaelg');
  else if (e.key === 'h') vælgVærktøj('pan');
  else if (e.key === 's') vælgVærktøj('skinne');
  else if (e.key === 'a') vælgVærktøj('omraade');
  else if (e.key === 'm') vælgVærktøj('maalestok');
});

function snapHvisOrtho(e, p) {
  if (e.altKey || !state.kladde.length) return p;
  return Geom.snapOrtho(state.kladde[state.kladde.length - 1], p);
}

function afslutKladde() {
  if (state.vaerktoej === 'omraade' && state.kladde.length >= 3) {
    gem();
    state.omraade = state.kladde.slice();
    state.kladde = [];
    opdater();
  } else if (state.vaerktoej === 'skinne' && state.kladde.length >= 2) {
    gem();
    state.skinner.push({ id: nyId(), pts: state.kladde.slice(), montage: state.indst.wireMontage });
    state.kladde = [];
    opdater();
  } else {
    state.kladde = [];
    tegn();
  }
}

function spørgMaalestok(px) {
  const svar = prompt('Hvor lang er den målte linje i meter?\n(f.eks. en kendt facadelængde eller en målsat kote)', '10');
  if (svar === null) { state.kalibrering = null; tegn(); return; }
  const meter = parseFloat(String(svar).replace(',', '.'));
  if (!(meter > 0)) { toast('Ugyldig længde', 'fejl'); state.kalibrering = null; tegn(); return; }
  state.pxPerMeter = px / meter;
  state.kalibrering.meter = meter;
  toast('Målestok sat: 1 m = ' + fmt(state.pxPerMeter, 1) + ' px');
  vælgVærktøj('vaelg');
  opdater();
}

/* ---------- objekter ---------- */
function ramtObjekt(p) {
  const tol = 10 / state.visning.zoom;
  for (let i = state.armaturer.length - 1; i >= 0; i--) {
    const a = state.armaturer[i];
    const f = FIXTURES[a.type];
    const r = Math.max(tol, mToPx((f ? f.laengde : 0.3) * 0.6));
    if (Geom.dist(p, [a.x, a.y]) <= r) return { slags: 'armatur', id: a.id };
  }
  for (let i = state.skinner.length - 1; i >= 0; i--) {
    const s = state.skinner[i];
    const pr = Geom.projectOnPolyline(p, s.pts);
    if (pr && pr.afstand <= tol) return { slags: 'skinne', id: s.id };
  }
  if (state.omraade.length > 2 && Geom.pointInPolygon(p, state.omraade)) {
    const kant = Geom.projectOnPolyline(p, state.omraade.concat([state.omraade[0]]));
    if (kant && kant.afstand <= tol) return { slags: 'omraade', id: 'omraade' };
  }
  return null;
}

function fjernObjekt(ref) {
  if (ref.slags === 'armatur') state.armaturer = state.armaturer.filter(a => a.id !== ref.id);
  else if (ref.slags === 'skinne') {
    state.skinner = state.skinner.filter(s => s.id !== ref.id);
    state.armaturer = state.armaturer.filter(a => a.skinneId !== ref.id);
  } else if (ref.slags === 'omraade') state.omraade = [];
}

function flytObjekt(ref, dx, dy) {
  if (ref.slags === 'armatur') {
    const a = state.armaturer.find(x => x.id === ref.id);
    if (a) { a.x += dx; a.y += dy; a.skinneId = null; }
  } else if (ref.slags === 'skinne') {
    const s = state.skinner.find(x => x.id === ref.id);
    if (!s) return;
    s.pts = s.pts.map(p => [p[0] + dx, p[1] + dy]);
    for (const a of state.armaturer) {
      if (a.skinneId === s.id) { a.x += dx; a.y += dy; }
    }
  } else if (ref.slags === 'omraade') {
    state.omraade = state.omraade.map(p => [p[0] + dx, p[1] + dy]);
  }
}

function placerArmatur(type, p, snap) {
  const f = FIXTURES[type];
  if (!f) return;
  let x = p[0], y = p[1], vinkel = 0, skinneId = null;
  if (snap && (f.fase === 'bricks' || f.fase === 'spot')) {
    const tol = Math.max(30 / state.visning.zoom, mToPx(1.0));
    let bedst = null;
    for (const s of state.skinner) {
      const pr = Geom.projectOnPolyline(p, s.pts);
      if (pr && pr.afstand <= tol && (!bedst || pr.afstand < bedst.pr.afstand)) bedst = { s, pr };
    }
    if (bedst) {
      x = bedst.pr.punkt[0]; y = bedst.pr.punkt[1];
      vinkel = bedst.pr.vinkel; skinneId = bedst.s.id;
    }
  }
  state.armaturer.push({ id: nyId(), type, x, y, vinkel, skinneId });
}

function visStatus(p) {
  const el = $('#status-koordinat');
  if (!harMaalestok()) { el.textContent = 'Målestok ikke sat'; return; }
  el.textContent = `x ${fmt(pxToM(p[0]), 2)} m · y ${fmt(pxToM(p[1]), 2)} m`;
}

function vælgVærktøj(v) {
  state.vaerktoej = v;
  state.kladde = [];
  $$('[data-vaerktoej]').forEach(b => b.classList.toggle('aktiv', b.dataset.vaerktoej === v));
  lærred.style.cursor = v === 'pan' ? 'grab' : (v === 'vaelg' ? 'default' : 'crosshair');
  const hjælp = {
    pan: 'Træk for at flytte tegningen. Scroll for at zoome.',
    vaelg: 'Klik for at vælge. Træk for at flytte. Delete sletter.',
    maalestok: 'Klik to punkter med kendt indbyrdes afstand, og indtast målet.',
    omraade: 'Klik hjørnerne i salgsarealet. Enter eller dobbeltklik lukker polygonen.',
    skinne: 'Klik skinnens knækpunkter. Enter eller dobbeltklik afslutter rækken. Alt = fri vinkel.',
    slet: 'Klik på et objekt for at slette det.'
  }[v] || 'Klik i planen for at placere armaturet. Det snapper til nærmeste skinne (Alt = fri placering).';
  $('#status-hjælp').textContent = hjælp;
  tegn();
}

/* ---------- beregning af stykliste og nøgletal ---------- */
function beregn() {
  const i = state.indst;
  const areal = (state.omraade.length > 2 && harMaalestok())
    ? Geom.polygonArea(state.omraade) / (state.pxPerMeter ** 2) : 0;

  const skinne = { stykker: {}, antal: 0, laengde: 0, lige: 0, hjoerne: 0, wire: 0, raekker: 0 };
  const ender = [];

  for (const s of state.skinner) {
    skinne.raekker++;
    let løbende = 0;
    for (let k = 1; k < s.pts.length; k++) {
      const L = pxToM(Geom.dist(s.pts[k - 1], s.pts[k]));
      løbende += L;
      const seg = segmenterSkinne(L);
      skinne.antal += seg.antal;
      skinne.lige += Math.max(0, seg.antal - 1);
      skinne.laengde += seg.monteret || L;
      for (const [mm, n] of Object.entries(seg.stykker)) skinne.stykker[mm] = (skinne.stykker[mm] || 0) + n;
    }
    skinne.hjoerne += Math.max(0, s.pts.length - 2);
    if (s.montage !== 'loft' && i.wireCC > 0) skinne.wire += Math.ceil(løbende / i.wireCC) + 1;
    ender.push({ id: s.id, p: s.pts[0] }, { id: s.id, p: s.pts[s.pts.length - 1] });
  }

  // T-samlinger: en fri ende der lander midt på en anden skinnerække
  const tol = harMaalestok() ? mToPx(0.3) : 12;
  let tee = 0, frieEnder = 0;
  for (const e of ender) {
    let erTee = false;
    for (const s of state.skinner) {
      if (s.id === e.id) continue;
      const pr = Geom.projectOnPolyline(e.p, s.pts);
      if (!pr || pr.afstand > tol) continue;
      const vedEnde = Geom.dist(pr.punkt, s.pts[0]) < tol || Geom.dist(pr.punkt, s.pts[s.pts.length - 1]) < tol;
      if (!vedEnde) { erTee = true; break; }
    }
    if (erTee) tee++; else frieEnder++;
  }

  const start = Math.max(0, Math.round(skinne.raekker * i.startPrRaekke));
  const endestykke = Math.max(0, frieEnder - start);

  // armaturer
  const antal = {};
  for (const a of state.armaturer) antal[a.type] = (antal[a.type] || 0) + 1;
  for (const [k, v] of Object.entries(state.manuelt)) {
    if (v) antal[k] = (antal[k] || 0) + Number(v);
  }

  let watt = 0, lumen = 0;
  const pr_fase = { bricks: 0, spot: 0, fast: 0 };
  for (const [k, n] of Object.entries(antal)) {
    const f = FIXTURES[k];
    if (!f) continue;
    watt += f.w * n;
    lumen += f.lm * n;
    pr_fase[f.fase] = (pr_fase[f.fase] || 0) + n;
  }

  const lux = areal > 0 ? (lumen * i.uf * i.mf) / areal : 0;
  const grupper = Math.max(
    pr_fase.bricks ? Math.ceil(pr_fase.bricks / FASE_REGLER.bricks.maks) : 0,
    pr_fase.spot ? Math.ceil(pr_fase.spot / FASE_REGLER.spot.maks) : 0,
    (pr_fase.bricks || pr_fase.spot || pr_fase.fast) ? 1 : 0
  );

  return {
    areal, skinne, start, endestykke, tee, frieEnder, antal, watt, lumen, lux,
    wattPrM2: areal > 0 ? watt / areal : 0,
    lumenPrM2: areal > 0 ? lumen / areal : 0,
    pr_fase, grupper,
    manglerLux: areal > 0 ? Math.max(0, i.maalLux - lux) : 0
  };
}

/* ---------- stykliste ---------- */
function styklisteRækker(b) {
  const r = [];
  const skinneAntal = Object.entries(b.skinne.stykker).sort((a, c) => c[0] - a[0]);
  if (skinneAntal.length) {
    r.push({
      gruppe: true, symbol: 'skinne',
      navn: `Trefaset lysskinne, 230V, ${state.indst.wireMontage === 'loft' ? 'direkte på loftet' : 'nedhængt i wire'}`,
      lyskilde: '', farve: 'Hvid', antal: ''
    });
    for (const [mm, n] of skinneAntal) {
      r.push({ symbol: '', navn: `Længde ${mm}mm`, antal: n, lyskilde: '', farve: '', indryk: true });
    }
  }
  for (const key of FIXTURE_ORDER) {
    const n = b.antal[key];
    if (!n) continue;
    const f = FIXTURES[key];
    r.push({
      symbol: f.symbol, navn: f.navn + (f.detalje ? '\n' + f.detalje : ''),
      antal: n, lyskilde: f.lyskilde, farve: f.farve
    });
  }
  const tilbehør = {
    start: b.start, ende: b.endestykke, lige: b.skinne.lige,
    hjoerne: b.skinne.hjoerne, flex: 0, tee: b.tee,
    wire: b.skinne.wire, bracket: b.skinne.wire
  };
  for (const t of ACCESSORIES) {
    const n = tilbehør[t.key];
    if (!n) continue;
    r.push({ symbol: t.kode || '', navn: t.navn, antal: n, lyskilde: '', farve: t.farve, tilbehør: true });
  }
  return r;
}

function visStykliste(b) {
  const krop = $('#stykliste tbody');
  const rækker = styklisteRækker(b);
  krop.innerHTML = '';
  if (!rækker.length) {
    krop.innerHTML = '<tr><td colspan="4" class="tom">Tegn skinner eller placér armaturer - så bygges styklisten her.</td></tr>';
    return;
  }
  for (const r of rækker) {
    const tr = document.createElement('tr');
    if (r.gruppe) tr.className = 'gruppe';
    if (r.indryk) tr.className = 'indryk';
    tr.innerHTML = `
      <td class="sym">${r.symbol && !r.gruppe && !r.indryk ? symbolMærkat(r.symbol, r.tilbehør) : ''}</td>
      <td class="antal">${r.antal === '' ? '' : fmt(r.antal)}</td>
      <td class="besk">${beskrivelseHtml(r.navn)}</td>
      <td class="kilde">${r.lyskilde || ''}${r.farve ? `<span class="sub">${r.farve}</span>` : ''}</td>`;
    krop.appendChild(tr);
  }
}

function beskrivelseHtml(navn) {
  const [hoved, ...rest] = String(navn).split('\n');
  return hoved + (rest.length ? `<span class="sub">${rest.join(' ')}</span>` : '');
}

function symbolMærkat(s, tekst) {
  if (tekst) return `<span class="symbol kode">${s}</span>`;
  const kort = {
    bricks: '▬', spot: '➤', pendel: '⊕', panel: '▭', triproof: '▭',
    downlight: '●', gobo: '⊕', park: '◯', udtag: '⌁', skinne: '▬'
  };
  return `<span class="symbol s-${s}">${kort[s] || s}</span>`;
}

function visNøgletal(b) {
  const i = state.indst;
  const kort = [
    { navn: 'Salgsareal', vaerdi: b.areal ? fmt(b.areal, 0) + ' m²' : '–', note: b.areal ? 'af tegnet polygon' : 'tegn arealet' },
    { navn: 'Skinne i alt', vaerdi: fmt(b.skinne.laengde, 0) + ' m', note: `${b.skinne.antal} stk. i ${b.skinne.raekker} rækker` },
    { navn: 'Installeret effekt', vaerdi: fmt(b.watt, 0) + ' W', note: b.areal ? fmt(b.wattPrM2, 1) + ' W/m²' : '' },
    { navn: 'Lysstrøm', vaerdi: fmt(b.lumen / 1000, 1) + ' klm', note: b.areal ? fmt(b.lumenPrM2, 0) + ' lm/m²' : '' },
    {
      navn: 'Overslag belysningsstyrke', vaerdi: b.areal ? fmt(b.lux, 0) + ' lux' : '–',
      note: `mål ${fmt(i.maalLux)} lux · UF ${i.uf} · LLMF ${i.mf}`,
      slags: b.areal ? (b.lux >= i.maalLux ? 'god' : (b.lux >= i.maalLux * 0.85 ? 'advarsel' : 'lav')) : ''
    },
    { navn: '3-polede grupper', vaerdi: fmt(b.grupper), note: `${b.pr_fase.bricks} Bricks · ${b.pr_fase.spot} spot/pendel` }
  ];
  $('#noegletal').innerHTML = kort.map(k => `
    <div class="kort ${k.slags || ''}">
      <span class="kort-navn">${k.navn}</span>
      <strong>${k.vaerdi}</strong>
      <span class="kort-note">${k.note || ''}</span>
    </div>`).join('');

  const faser = [
    { navn: FASE_REGLER.bricks.navn, antal: b.pr_fase.bricks, maks: FASE_REGLER.bricks.maks },
    { navn: FASE_REGLER.spot.navn, antal: b.pr_fase.spot, maks: FASE_REGLER.spot.maks },
    { navn: FASE_REGLER.fast.navn, antal: b.pr_fase.fast, maks: null }
  ];
  $('#faser').innerHTML = faser.map(f => {
    const pr = b.grupper ? f.antal / b.grupper : 0;
    const over = f.maks && pr > f.maks + 0.001;
    return `<li class="${over ? 'over' : ''}">
      <span>${f.navn}</span>
      <span class="tal">${fmt(f.antal)} stk.${f.maks ? ` · ${fmt(pr, 1)} pr. gruppe (maks ${f.maks})` : ''}</span>
    </li>`;
  }).join('');

  $('#el-note').textContent = b.grupper
    ? `Der skal bruges ${b.grupper} stk. 3-polede grupper til belysningen. Der udføres tilslutning i alle S./start samt mulighed for tilslutning i alle H.S./hjørnesamlinger.`
    : 'Tegn skinner og placér armaturer for at få gruppeopdelingen.';
}

function visLag() {
  const liste = $('#lag-liste');
  if (!state.lag.length) {
    liste.innerHTML = '<p class="tom">Ingen tegninger indlæst endnu.</p>';
    return;
  }
  liste.innerHTML = '';
  state.lag.forEach((lag, idx) => {
    const el = document.createElement('div');
    el.className = 'lag';
    el.innerHTML = `
      <label class="lag-top">
        <input type="checkbox" ${lag.synlig ? 'checked' : ''} data-h="synlig">
        <span class="lag-navn" title="${lag.navn}">${lag.navn}</span>
        <button class="ikon" data-h="fjern" title="Fjern lag">✕</button>
      </label>
      <div class="lag-ctrl">
        <label>Synlighed<input type="range" min="0" max="1" step="0.05" value="${lag.opacitet}" data-h="opacitet"></label>
        <label>Skala<input type="number" step="0.01" value="${lag.skala}" data-h="skala"></label>
        <label>X<input type="number" step="10" value="${Math.round(lag.x)}" data-h="x"></label>
        <label>Y<input type="number" step="10" value="${Math.round(lag.y)}" data-h="y"></label>
      </div>`;
    el.querySelector('[data-h="synlig"]').onchange = e => { lag.synlig = e.target.checked; tegn(); };
    el.querySelector('[data-h="opacitet"]').oninput = e => { lag.opacitet = +e.target.value; tegn(); };
    el.querySelector('[data-h="skala"]').onchange = e => { lag.skala = Math.max(0.01, +e.target.value || 1); tegn(); };
    el.querySelector('[data-h="x"]').onchange = e => { lag.x = +e.target.value || 0; tegn(); };
    el.querySelector('[data-h="y"]').onchange = e => { lag.y = +e.target.value || 0; tegn(); };
    el.querySelector('[data-h="fjern"]').onclick = () => {
      state.lag.splice(idx, 1); visLag(); tegn();
    };
    if (lag.slags === 'cad') el.appendChild(cadLagPanel(lag));
    liste.appendChild(el);
  });
}

/* Lagene inde i CAD-tegningen kan slukkes hver for sig - f.eks. møblering
   eller målsætning, der ellers støjer under lysplanen. */
function cadLagPanel(lag) {
  const boks = document.createElement('div');
  boks.className = 'cad-lag';
  const navne = Object.keys(lag.cadLag).sort((a, b) => a.localeCompare(b, 'da'));
  boks.innerHTML = `
    <label class="afkryds lille"><input type="checkbox" ${lag.egneFarver ? 'checked' : ''} data-h="farver"> Tegningens egne farver</label>
    <details>
      <summary>Lag i tegningen (<span data-h="tal"></span>)</summary>
      <div class="cad-lag-liste">
        ${navne.map(n => `<label><input type="checkbox" data-cadlag="${encodeURIComponent(n)}"><span title="${n}">${n || '(uden navn)'}</span></label>`).join('')}
      </div>
      <div class="rk lille"><button data-h="alle">Vis alle</button><button data-h="ingen">Skjul alle</button></div>
    </details>`;
  const afkryds = Array.from(boks.querySelectorAll('[data-cadlag]'));
  const tal = boks.querySelector('[data-h="tal"]');
  // panelet opdateres på stedet, så listen ikke klapper sammen ved hvert klik
  const synk = () => {
    afkryds.forEach(inp => { inp.checked = lag.cadLag[decodeURIComponent(inp.dataset.cadlag)] !== false; });
    tal.textContent = `${navne.filter(n => lag.cadLag[n] !== false).length}/${navne.length}`;
    tegn();
  };
  boks.querySelector('[data-h="farver"]').onchange = e => { lag.egneFarver = e.target.checked; tegn(); };
  afkryds.forEach(inp => {
    inp.onchange = () => { lag.cadLag[decodeURIComponent(inp.dataset.cadlag)] = inp.checked; synk(); };
  });
  boks.querySelector('[data-h="alle"]').onclick = () => { navne.forEach(n => { lag.cadLag[n] = true; }); synk(); };
  boks.querySelector('[data-h="ingen"]').onclick = () => { navne.forEach(n => { lag.cadLag[n] = false; }); synk(); };
  synk();
  return boks;
}

function opdater() {
  const b = beregn();
  visStykliste(b);
  visNøgletal(b);
  visLag();
  $('#status-valgt').textContent = state.valgt
    ? { skinne: 'Skinnerække valgt', armatur: 'Armatur valgt', omraade: 'Salgsareal valgt' }[state.valgt.slags]
    : '';
  tegn();
  return b;
}

/* ---------- automatisk belysningsplan ---------- */
function nødvendigLumen(areal) {
  const i = state.indst;
  return areal > 0 ? (i.maalLux * areal) / (i.uf * i.mf) : 0;
}

function generer() {
  if (!harMaalestok()) { toast('Sæt målestok først (værktøjet "Målestok")', 'fejl'); return; }
  if (state.omraade.length < 3) { toast('Tegn salgsarealet først', 'fejl'); return; }
  gem();
  state.skinner = state.skinner.filter(s => !s.auto);
  state.armaturer = state.armaturer.filter(a => !a.auto);
  const antal = state.indst.mode === 'track' ? genererSkinner() : genererPaneler();
  const b = opdater();
  toast(`Belysningsplan beregnet: ${antal} armaturer, overslag ${fmt(b.lux, 0)} lux`);
}

/* Roterer polygonen så rækkerne bliver vandrette, lægger rækker med c/c-afstand
   og klipper dem mod arealets kanter. */
function rækkerIAreal(cc, margin, retning) {
  const poly = state.omraade;
  const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
  const v = retning === 'auto' ? Geom.longestEdgeAngle(poly)
    : (retning === 'vandret' ? 0 : Math.PI / 2);
  const lokal = poly.map(p => Geom.rotate(p, c, -v));
  const bb = Geom.bbox(lokal);
  const ccPx = mToPx(cc), mPx = mToPx(margin);
  const linjer = [];
  const højde = bb.y1 - bb.y0 - 2 * mPx;
  if (højde <= 0) return { linjer, vinkel: v, center: c };
  const antal = Math.max(1, Math.round(højde / ccPx) + 1);
  const trin = antal > 1 ? højde / (antal - 1) : 0;
  for (let k = 0; k < antal; k++) {
    const y = bb.y0 + mPx + trin * k;
    for (const [x0, x1] of Geom.scanline(lokal, y)) {
      const a = x0 + mPx, b = x1 - mPx;
      if (pxToM(b - a) < 2) continue;
      linjer.push([[a, y], [b, y]].map(p => Geom.rotate(p, c, v)));
    }
  }
  return { linjer, vinkel: v, center: c };
}

function genererSkinner() {
  const i = state.indst;
  const { linjer } = rækkerIAreal(i.ccSkinner, i.margin, i.retning || 'auto');
  if (!linjer.length) { toast('Arealet er for lille til den valgte c/c-afstand', 'fejl'); return 0; }
  for (const pts of linjer) {
    state.skinner.push({ id: nyId(), pts, montage: i.wireMontage, auto: true });
  }

  const areal = Geom.polygonArea(state.omraade) / (state.pxPerMeter ** 2);
  const primær = FIXTURES[i.primaer];
  const accent = i.accent ? FIXTURES[i.accent] : null;
  const pr_sæt = primær.lm + (accent ? accent.lm * i.accentRatio : 0);
  const behov = nødvendigLumen(areal);
  let antalPrimær = Math.max(linjer.length, Math.ceil(behov / Math.max(1, pr_sæt)));

  const længder = state.skinner.filter(s => s.auto).map(s => pxToM(Geom.polylineLength(s.pts)));
  const total = længder.reduce((a, b) => a + b, 0);
  // respektér mindsteafstand mellem armaturer på samme skinne
  const maks = Math.floor(total / Math.max(0.3, i.minAfstand));
  if (antalPrimær > maks) antalPrimær = maks;

  const auto = state.skinner.filter(s => s.auto);
  let placeret = 0, placeretAccent = 0;
  const antalAccent = accent ? Math.round(antalPrimær * i.accentRatio) : 0;
  auto.forEach((s, idx) => {
    const andel = total > 0 ? længder[idx] / total : 0;
    const nP = idx === auto.length - 1 ? antalPrimær - placeret : Math.round(antalPrimær * andel);
    const nA = idx === auto.length - 1 ? antalAccent - placeretAccent : Math.round(antalAccent * andel);
    placeret += nP; placeretAccent += nA;
    fordelPåSkinne(s, i.primaer, Math.max(0, nP), 0);
    if (accent && nA > 0) fordelPåSkinne(s, i.accent, nA, 0.5);
  });
  return state.armaturer.filter(a => a.auto).length;
}

function fordelPåSkinne(s, type, antal, forskydning) {
  if (antal <= 0) return;
  const L = Geom.polylineLength(s.pts);
  const trin = L / antal;
  for (let k = 0; k < antal; k++) {
    const d = trin * (k + 0.5 + forskydning * 0.5);
    if (d > L) continue;
    const { punkt, vinkel } = Geom.pointAtLength(s.pts, d);
    state.armaturer.push({ id: nyId(), type, x: punkt[0], y: punkt[1], vinkel, skinneId: s.id, auto: true });
  }
}

function genererPaneler() {
  const i = state.indst;
  const areal = Geom.polygonArea(state.omraade) / (state.pxPerMeter ** 2);
  const f = FIXTURES[i.primaer];
  if (!i.autoTaethed) return læggUdNet(i.ccX, i.ccY);

  // Mål-lux styrer tætheden. Randafstanden koster armaturer, så nettet
  // strammes indtil det placerede antal rammer behovet.
  const behov = Math.max(1, Math.ceil(nødvendigLumen(areal) / Math.max(1, f.lm)));
  let cc = Math.max(0.6, Math.sqrt(areal / behov));
  let n = 0;
  for (let forsøg = 0; forsøg < 4; forsøg++) {
    state.armaturer = state.armaturer.filter(a => !a.auto);
    n = læggUdNet(cc, cc);
    if (n >= behov || n === 0) break;
    cc = Math.max(0.6, cc * Math.sqrt(Math.max(0.5, n / behov)));
  }
  return n;
}

function læggUdNet(ccX, ccY) {
  const i = state.indst;
  const poly = state.omraade;
  const f = FIXTURES[i.primaer];
  const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
  const v = (i.retning === 'vandret') ? 0 : (i.retning === 'lodret' ? Math.PI / 2 : Geom.longestEdgeAngle(poly));
  const lokal = poly.map(p => Geom.rotate(p, c, -v));
  const bb = Geom.bbox(lokal);
  const mPx = mToPx(i.margin);
  const dx = mToPx(ccX), dy = mToPx(ccY);
  const kant = poly.concat([poly[0]]);
  let n = 0;
  for (let y = bb.y0 + mPx; y <= bb.y1 - mPx + 1; y += dy) {
    for (let x = bb.x0 + mPx; x <= bb.x1 - mPx + 1; x += dx) {
      const p = Geom.rotate([x, y], c, v);
      if (!Geom.pointInPolygon(p, poly)) continue;
      const afstand = Geom.projectOnPolyline(p, kant);
      if (afstand && afstand.afstand < mToPx(Math.min(i.margin, f.laengde / 2))) continue;
      state.armaturer.push({ id: nyId(), type: i.primaer, x: p[0], y: p[1], vinkel: v, skinneId: null, auto: true });
      n++;
    }
  }
  if (!n) toast('Ingen armaturer kunne placeres - prøv mindre c/c eller margin', 'fejl');
  return n;
}

/* ---------- eksport ---------- */
function download(navn, indhold, type) {
  const blob = indhold instanceof Blob ? indhold : new Blob([indhold], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = navn;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function projektNavn() {
  return (state.projekt.navn || 'lysplan').replace(/[^\wæøåÆØÅ\- ]+/g, '').trim() || 'lysplan';
}

function eksporterCsv() {
  const b = beregn();
  const linjer = [['Antal', 'Beskrivelse', 'Lyskilde', 'Farve']];
  for (const r of styklisteRækker(b)) {
    if (r.gruppe) { linjer.push(['', r.navn, '', r.farve || '']); continue; }
    linjer.push([r.antal === '' ? '' : String(r.antal), String(r.navn).replace(/\n/g, ' - '), r.lyskilde || '', r.farve || '']);
  }
  linjer.push([]);
  linjer.push(['Salgsareal', fmt(b.areal, 1) + ' m2']);
  linjer.push(['Skinne i alt', fmt(b.skinne.laengde, 1) + ' m']);
  linjer.push(['Installeret effekt', fmt(b.watt, 0) + ' W', fmt(b.wattPrM2, 2) + ' W/m2']);
  linjer.push(['Lysstrøm', fmt(b.lumen, 0) + ' lm', fmt(b.lumenPrM2, 0) + ' lm/m2']);
  linjer.push(['Overslag belysningsstyrke', fmt(b.lux, 0) + ' lux', `UF ${state.indst.uf} / LLMF ${state.indst.mf}`]);
  linjer.push(['3-polede grupper', String(b.grupper)]);
  const csv = '﻿' + linjer.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(projektNavn() + '-stykliste.csv', csv, 'text/csv;charset=utf-8');
}

function sceneRamme() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const tag = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const l of state.lag) {
    if (!l.synlig) continue;
    const r = lagRamme(l);
    tag(r.x0, r.y0); tag(r.x1, r.y1);
  }
  for (const s of state.skinner) for (const p of s.pts) tag(p[0], p[1]);
  for (const p of state.omraade) tag(p[0], p[1]);
  for (const a of state.armaturer) tag(a.x, a.y);
  if (!isFinite(x0)) return null;
  const m = 40;
  return { x0: x0 - m, y0: y0 - m, b: (x1 - x0) + 2 * m, h: (y1 - y0) + 2 * m };
}

function tegnTilBillede(maksPx = 3600) {
  const r = sceneRamme();
  if (!r) return null;
  const skala = Math.min(2, maksPx / Math.max(r.b, r.h));
  const gemtVisning = { ...state.visning };
  const gemtBredde = lærred.width, gemtHøjde = lærred.height;
  const gemtStil = [lærred.style.width, lærred.style.height];
  eksportStørrelse = { b: r.b, h: r.h };
  lærred.width = Math.round(r.b * skala);
  lærred.height = Math.round(r.h * skala);
  ctx.setTransform(skala, 0, 0, skala, 0, 0);
  state.visning = { x: r.x0, y: r.y0, zoom: 1 };
  const gemtValg = state.valgt; state.valgt = null;
  tegn();
  const data = lærred.toDataURL('image/png');
  eksportStørrelse = null;
  state.visning = gemtVisning;
  state.valgt = gemtValg;
  lærred.width = gemtBredde; lærred.height = gemtHøjde;
  lærred.style.width = gemtStil[0]; lærred.style.height = gemtStil[1];
  tilpasStørrelse();
  return data;
}

function eksporterPng() {
  const data = tegnTilBillede();
  if (!data) { toast('Der er ikke noget at eksportere endnu', 'fejl'); return; }
  fetch(data).then(r => r.blob()).then(b => download(projektNavn() + '-lysplan.png', b));
}

function udskriv() {
  const data = tegnTilBillede(2400);
  const b = beregn();
  const p = state.projekt;
  const rækker = styklisteRækker(b).map(r => `
    <tr><td>${r.antal === '' ? '' : fmt(r.antal)}</td>
        <td>${String(r.navn).replace(/\n/g, ' – ')}</td>
        <td>${r.lyskilde || ''}</td><td>${r.farve || ''}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) { toast('Tillad pop op-vinduer for at udskrive', 'fejl'); return; }
  w.document.write(`<!doctype html><html lang="da"><head><meta charset="utf-8">
    <title>${p.navn || 'Lysplan'} – lysplan</title>
    <style>
      body{font:12px/1.45 "Helvetica Neue",Arial,sans-serif;margin:16mm;color:#111}
      h1{font-size:18px;margin:0 0 2px} .meta{color:#555;margin-bottom:12px}
      img{width:100%;border:1px solid #ccc}
      table{border-collapse:collapse;width:100%;margin-top:12px;font-size:11px}
      th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}
      th{background:#eee} td:first-child{width:52px;text-align:right}
      .noter{margin-top:10px;font-size:11px;color:#333;white-space:pre-line}
      @media print{ body{margin:10mm} }
    </style></head><body>
    <h1>${p.navn || 'Lysplan'}</h1>
    <div class="meta">${[p.adresse, p.by].filter(Boolean).join(', ')} · Lysplan · Mål ${p.maalestok} · ${p.dato}${p.tegner ? ' · ' + p.tegner : ''}</div>
    ${data ? `<img src="${data}" alt="Lysplan">` : ''}
    <table><thead><tr><th>Antal</th><th>Beskrivelse</th><th>Lyskilde</th><th>Farve</th></tr></thead><tbody>${rækker}</tbody></table>
    <div class="noter">Salgslokalet er på ${fmt(b.areal, 0)} kvm.
Installeret effekt ${fmt(b.watt, 0)} W (${fmt(b.wattPrM2, 1)} W/m²) · lysstrøm ${fmt(b.lumenPrM2, 0)} lm/m² · overslag ${fmt(b.lux, 0)} lux (UF ${state.indst.uf}, LLMF ${state.indst.mf}).
Der skal bruges ${b.grupper} stk. 3-pol grupper til belysningen.
Fase 1 bruges til Bricks, maks. 12 stk. pr. fase. Fase 2 bruges til spot, bast lamper og wall washer maks. 30 stk. pr. fase. Fase 3 er til fast strøm (nødbelysning).
Der udføres tilslutninger i alle S./start samt mulighed for tilslutning i alle H.S./hjørnesamlinger.</div>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

/* ---------- gem og hent projekt ---------- */
function gemProjekt() {
  const data = {
    version: 1,
    projekt: state.projekt,
    indst: state.indst,
    pxPerMeter: state.pxPerMeter,
    kalibrering: state.kalibrering,
    omraade: state.omraade,
    skinner: state.skinner,
    armaturer: state.armaturer,
    manuelt: state.manuelt,
    lag: state.lag.map(l => (l.slags === 'cad'
      ? {
        navn: l.navn, slags: 'cad', synlig: l.synlig, opacitet: l.opacitet, x: l.x, y: l.y, skala: l.skala,
        bredde: l.bredde, højde: l.højde, egneFarver: l.egneFarver, cadLag: l.cadLag, tegning: l.tegning
      }
      : { navn: l.navn, slags: 'billede', src: l.src, synlig: l.synlig, opacitet: l.opacitet, x: l.x, y: l.y, skala: l.skala }))
  };
  download(projektNavn() + '.lysplan.json', JSON.stringify(data), 'application/json');
}

async function hentProjekt(fil) {
  const tekst = await fil.text();
  let d;
  try { d = JSON.parse(tekst); } catch (e) { toast('Filen kunne ikke læses', 'fejl'); return; }
  state.projekt = Object.assign(state.projekt, d.projekt || {});
  state.indst = Object.assign(state.indst, d.indst || {});
  state.pxPerMeter = d.pxPerMeter || null;
  state.kalibrering = d.kalibrering || null;
  state.omraade = d.omraade || [];
  state.skinner = d.skinner || [];
  state.armaturer = d.armaturer || [];
  state.manuelt = d.manuelt || {};
  state.lag = [];
  for (const l of d.lag || []) {
    if (l.slags === 'cad') {
      const lag = { ...l, id: nyId(), slags: 'cad' };
      byggCadGrupper(lag);
      state.lag.push(lag);
    } else {
      const lag = await tilføjLag(l.navn, l.src);
      if (lag) Object.assign(lag, { synlig: l.synlig, opacitet: l.opacitet, x: l.x, y: l.y, skala: l.skala });
    }
  }
  nextId = 1 + Math.max(0, ...[...state.skinner, ...state.armaturer].map(o => parseInt(String(o.id).slice(1), 10) || 0));
  visIndstillinger();
  tilpasVisning();
  opdater();
  toast('Projekt indlæst');
}

/* ---------- indstillinger og opstart ---------- */
function byggArmaturKnapper() {
  const boks = $('#armatur-knapper');
  boks.innerHTML = FIXTURE_ORDER.map(k => {
    const f = FIXTURES[k];
    return `<button class="vaerktoej lille" data-vaerktoej="armatur:${k}" title="${f.navn}${f.detalje ? ' – ' + f.detalje : ''}">
      ${symbolMærkat(f.symbol)}<span>${kortNavn(k)}</span></button>`;
  }).join('');
  boks.querySelectorAll('[data-vaerktoej]').forEach(b => b.onclick = () => vælgVærktøj(b.dataset.vaerktoej));
}

function kortNavn(k) {
  return {
    sirius: 'Sirius spot', bricks: 'Bricks', bricksscan: 'Bricks scan', pendel: 'Coop pendel',
    triproof: 'Tri-proof', panel30: 'Panel 30W', panel22: 'Panel 22W', panmax: 'Pan Max',
    gobo: 'Gobo', park2: 'Park 2', effektudtag: 'Effektudtag'
  }[k] || k;
}

function byggArmaturValg() {
  const primær = $('#i-primaer'), accent = $('#i-accent');
  primær.innerHTML = FIXTURE_ORDER.map(k => `<option value="${k}">${kortNavn(k)} · ${FIXTURES[k].lm} lm</option>`).join('');
  accent.innerHTML = '<option value="">(ingen)</option>' +
    FIXTURE_ORDER.map(k => `<option value="${k}">${kortNavn(k)}</option>`).join('');
}

function byggManuelt() {
  const boks = $('#manuelt-liste');
  boks.innerHTML = FIXTURE_ORDER.map(k => `
    <label class="manuel"><span>${kortNavn(k)}</span>
      <input type="number" min="0" step="1" value="${state.manuelt[k] || 0}" data-manuel="${k}"></label>`).join('');
  boks.querySelectorAll('[data-manuel]').forEach(inp => {
    inp.onchange = () => {
      const n = Math.max(0, parseInt(inp.value, 10) || 0);
      state.manuelt[inp.dataset.manuel] = n;
      inp.value = n;
      opdater();
    };
  });
}

function visIndstillinger() {
  $$('[data-indst]').forEach(el => {
    const n = el.dataset.indst;
    if (!(n in state.indst)) return;
    if (el.type === 'checkbox') el.checked = !!state.indst[n];
    else el.value = state.indst[n];
  });
  $$('[data-projekt]').forEach(el => { el.value = state.projekt[el.dataset.projekt] || ''; });
  $('#i-preset').value = state.indst.preset;
  visTilstand();
  byggManuelt();
}

function visTilstand() {
  const track = state.indst.mode === 'track';
  $$('.kun-track').forEach(el => el.hidden = !track);
  $$('.kun-panel').forEach(el => el.hidden = track);
}

function bindIndstillinger() {
  $$('[data-indst]').forEach(el => {
    const hændelse = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'change';
    el.addEventListener(hændelse, () => {
      const n = el.dataset.indst;
      if (el.type === 'checkbox') state.indst[n] = el.checked;
      else if (el.type === 'number' || el.type === 'range') state.indst[n] = parseFloat(String(el.value).replace(',', '.')) || 0;
      else state.indst[n] = el.value;
      if (n === 'mode') visTilstand();
      opdater();
    });
  });
  $$('[data-projekt]').forEach(el => {
    el.addEventListener('change', () => { state.projekt[el.dataset.projekt] = el.value; });
  });
  $('#i-preset').addEventListener('change', e => {
    const p = PRESETS[e.target.value];
    if (!p) return;
    Object.assign(state.indst, p, { preset: e.target.value });
    visIndstillinger();
    opdater();
    toast('Koncept valgt: ' + p.navn);
  });
}

function bindKnapper() {
  $$('[data-vaerktoej]').forEach(b => b.onclick = () => vælgVærktøj(b.dataset.vaerktoej));
  $('#knap-generer').onclick = generer;
  $('#knap-tilpas').onclick = tilpasVisning;
  $('#knap-fortryd').onclick = fortryd;
  $('#knap-csv').onclick = eksporterCsv;
  $('#knap-png').onclick = eksporterPng;
  $('#knap-print').onclick = udskriv;
  $('#knap-gem').onclick = gemProjekt;
  $('#knap-ryd').onclick = () => {
    if (!confirm('Slet alle skinner, armaturer og salgsarealet? Tegningerne beholdes.')) return;
    gem();
    state.skinner = []; state.armaturer = []; state.omraade = []; state.valgt = null;
    opdater();
  };
  $('#knap-ryd-auto').onclick = () => {
    gem();
    state.skinner = state.skinner.filter(s => !s.auto);
    state.armaturer = state.armaturer.filter(a => !a.auto);
    opdater();
  };
  $('#fil-tegning').onchange = e => { importerFiler(Array.from(e.target.files)); e.target.value = ''; };
  $('#fil-projekt').onchange = e => { if (e.target.files[0]) hentProjekt(e.target.files[0]); e.target.value = ''; };
  $('#knap-import').onclick = () => $('#fil-tegning').click();
  $('#knap-hent').onclick = () => $('#fil-projekt').click();

  const zone = $('#lærred-boks');
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => {
    e.preventDefault(); zone.classList.add('drop');
  }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => {
    e.preventDefault(); zone.classList.remove('drop');
  }));
  zone.addEventListener('drop', e => {
    const filer = Array.from(e.dataTransfer.files || []);
    const projektfil = filer.find(f => /\.json$/i.test(f.name));
    if (projektfil) hentProjekt(projektfil);
    else importerFiler(filer);
  });

  $$('.panel-faneblad').forEach(b => b.onclick = () => {
    $$('.panel-faneblad').forEach(x => x.classList.toggle('aktiv', x === b));
    $$('.panel-side').forEach(s => s.hidden = s.dataset.side !== b.dataset.faneblad);
  });
}

function start() {
  byggArmaturKnapper();
  byggArmaturValg();
  bindIndstillinger();
  bindKnapper();
  visIndstillinger();
  vælgVærktøj('pan');
  tilpasStørrelse();
  opdater();
  window.addEventListener('resize', tilpasStørrelse);
}

document.addEventListener('DOMContentLoaded', start);
