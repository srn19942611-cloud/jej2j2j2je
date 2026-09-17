/* Lysplan - belysningsplanlægning oven på importerede bygningstegninger.
   Ingen build, ingen server: alt kører i browseren og alle data bliver i maskinen. */

'use strict';

const state = {
  lag: [],            // importerede tegninger
  pxPerMeter: null,   // målestok, sat via kalibrering
  kalibrering: null,  // {a, b, meter}
  zoner: [],          // {id, type, navn, pts, maalLux} - salgsareal, betjent område osv.
  inventar: [],       // {id, type, kategori, laengde, dybde, hoejde, vinkel, centrum, hjørner, fag}
  skinner: [],        // {id, pts:[[x,y]...], montage:'wire'|'loft'}
  armaturer: [],      // {id, type, x, y, vinkel, skinneId}
  manuelt: {},        // manuelle tillæg til styklisten, pr. katalognøgle
  valgt: null,        // {slags:'skinne'|'armatur'|'zone', id}
  vaerktoej: 'pan',
  tilstand: 'plan',   // 'plan' eller '3d'
  kamera: { x: 5, y: 5, h: 1.65, retning: 0, tilt: -0.12 },
  kameraer: [],       // gemte kamerapunkter i butikken
  scene: null, sceneVersion: -1, version: 0,
  reference: null, visReference: false,
  kladde: [],         // punkter under tegning
  muse: null,         // sidste musepunkt i verdenskoordinater
  visning: { x: 0, y: 0, zoom: 1 },
  indst: {
    preset: 'superbrugsen',
    mode: 'track',
    ccSkinner: 2.5, margin: 1.0, ccX: 2.4, ccY: 2.4,
    lofttype: 'skinne', zoneType: 'salg', mf: 0.8, loftshoejde: 3.2,
    refleksLoft: 0.70, refleksVaeg: 0.50, refleksGulv: 0.20,   // som SJOC's DIALux-rapporter
    beregningshoejde: 0.0, metrik: 'vandret',
    inventarType: 'reol', fagbredde: 1.0, visInventar: true, følgInventar: true,
    monteringshoejde: 2.8, fov: 72, farvetilstand: 'realistisk', maksLux: 1200, visVarme: false,
    skinneSpring: 2.5,
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
  // "arbejder" bliver stående, til næste besked afløser den
  if (slags !== 'arbejder') toast._t = setTimeout(() => el.classList.remove('vis'), slags === 'fejl' ? 9000 : 3600);
}

/* ---------- historik (fortryd) ---------- */
function gem() {
  historik.push(JSON.stringify({
    zoner: state.zoner,
    inventar: state.inventar,
    kameraer: state.kameraer, skinner: state.skinner, inventar: state.inventar,
    armaturer: state.armaturer, manuelt: state.manuelt
  }));
  if (historik.length > 60) historik.shift();
}
function fortryd() {
  const s = historik.pop();
  if (!s) { toast('Intet at fortryde'); return; }
  const d = JSON.parse(s);
  state.zoner = d.zoner; state.skinner = d.skinner; state.inventar = d.inventar || [];
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
        const mb = (fil.size / 1048576).toFixed(1);
        toast(`${navn} (${mb} MB): starter DWG-motoren … første gang tager det et øjeblik`, 'arbejder');
        const data = await fil.arrayBuffer();
        const db = await CAD.læsDwg(data, state.indst.dwgKilde,
          trin => toast(`${navn}: ${trin}`, 'arbejder'), { kunLokal: iSandkasse() });
        await importerCad(navn, db);
      } else if (fil.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(navn)) {
        await tilføjLag(navn, await læsSomDataUrl(fil));
      } else {
        toast('Filtypen understøttes ikke: ' + navn, 'fejl');
      }
    } catch (e) {
      console.error(e);
      toast(navn + ': ' + forklarFejl(e), 'fejl');
    }
  }
  opdater();
}

/* Webudgaven kører i en sandkasse, der blokerer eksterne hentninger.
   Så kan DWG- og PDF-motoren ikke hentes, og det skal siges tydeligt. */
function iSandkasse() {
  return /claudeusercontent|artifact/.test(location.hostname + location.pathname) ||
    typeof window.claude === 'object';
}

function forklarFejl(e) {
  const besked = e && e.message ? e.message : 'kunne ikke læses';
  if (iSandkasse() && /motor|hentes|pdf\.js/i.test(besked)) {
    return 'DWG og PDF kan ikke læses i webudgaven – sandkassen blokerer for at hente motoren. ' +
      'Brug den lokale udgave (start-lysplan), eller gem tegningen som DXF.';
  }
  return besked;
}

/* CAD-tegning (DXF/DWG) lægges ind som vektorlag i tegningens egne mål. */
async function importerCad(navn, db) {
  const flad = CAD.fladgør(db);
  flad.diagnose = {
    entiteter: flad.antalEntiteter, blokke: flad.blokke, springOver: flad.springOver,
    xref: db.xref || 0, kilde: db.kilde || 'modelrum', enhed: flad.meterPerEnhed, gættet: flad.gættetEnhed
  };
  if (!flad.streger.length && !flad.tekster.length) {
    toast(navn + ': ' + tomTegningBesked(flad, db), 'fejl');
    console.warn('Lysplan – tegningen kunne ikke tegnes:', flad.diagnose);
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
  const kerne = flad.kerne ? {
    x0: (flad.kerne.x0 - r.x0) * k, x1: (flad.kerne.x1 - r.x0) * k,
    y0: (r.y1 - flad.kerne.y1) * k, y1: (r.y1 - flad.kerne.y0) * k
  } : null;
  const lag = {
    id: nyId(), navn, slags: 'cad', synlig: true, opacitet: 1, x: 0, y: 0, skala: 1,
    diagnose: flad.diagnose, kerne,
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
  // møblerne findes med det samme, så lysplanen kan tage højde for dem
  setTimeout(() => {
    findInventar(true);
    if (!state.zoner.length) findZonerITegning(true);
  }, 0);
  return lag;
}

/* Forklaring når en tegning kommer ind uden noget at vise. */
function tomTegningBesked(flad, db) {
  const sprunget = Object.entries(flad.springOver || {}).sort((a, b) => b[1] - a[1]);
  if (db.xref) {
    return `tegningen henviser til ${db.xref} ekstern${db.xref > 1 ? 'e' : ''} fil${db.xref > 1 ? 'er' : ''} (xref). Bind dem ind i CAD-programmet (BIND/INSERT) eller gem som DXF.`;
  }
  if (sprunget.length) {
    const top = sprunget.slice(0, 3).map(([t, n]) => `${n} ${t}`).join(', ');
    return `ingen af de ${flad.antalEntiteter} objekter kunne tegnes (${top}). Objekttyper fra f.eks. AutoCAD Architecture skal eksploderes eller gemmes som DXF.`;
  }
  return 'tegningen indeholder ingen linjer der kan vises – ligger geometrien i et xref eller i papirrummet?';
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

/* pdf.js hentes fra en lokal kopi i vendor/, hvis den findes, ellers fra nettet. */
const PDF_KILDER = [
  { js: 'vendor/pdfjs-dist/legacy/build/pdf.min.js', worker: 'vendor/pdfjs-dist/legacy/build/pdf.worker.min.js' },
  { js: 'vendor/pdfjs-dist/build/pdf.min.js', worker: 'vendor/pdfjs-dist/build/pdf.worker.min.js' },
  {
    js: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
];

let pdfKlar = null;
function hentPdfBibliotek() {
  if (pdfKlar) return pdfKlar;
  pdfKlar = (async () => {
    if (window.pdfjsLib) return window.pdfjsLib;
    const kilder = iSandkasse() ? PDF_KILDER.filter(k => !/^https?:/i.test(k.js)) : PDF_KILDER;
    for (const kilde of kilder) {
      try {
        await indlæsScript(kilde.js);
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = kilde.worker;
          return window.pdfjsLib;
        }
      } catch (e) { /* prøv næste kilde */ }
    }
    throw new Error(iSandkasse()
      ? 'PDF-motoren på siden kunne ikke startes. Gem tegningen som PNG eller DXF.'
      : 'pdf.js kunne ikke hentes');
  })();
  return pdfKlar;
}

function indlæsScript(url) {
  return new Promise((ok, fejl) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = ok;
    s.onerror = () => fejl(new Error('kunne ikke hente ' + url));
    document.head.appendChild(s);
  });
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
    // kerneområdet, hvis tegningen har udløbere langt væk
    const k = l.kerne;
    const r = k
      ? { x0: l.x + k.x0 * l.skala, y0: l.y + k.y0 * l.skala, x1: l.x + k.x1 * l.skala, y1: l.y + k.y1 * l.skala }
      : lagRamme(l);
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
  if (state.tilstand === '3d' && !eksportStørrelse) { tegn3d(); return; }
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

  tegnVarmekort();
  tegnZoner();
  tegnInventar();
  for (const s of state.skinner) tegnSkinne(s);
  for (const a of state.armaturer) tegnArmatur(a);
  tegnKameraer();
  tegnKladde();
  tegnRektKladde();
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

const zoneFarve = z => (ZONETYPER[z.type] || {}).farve || FARVER.omraade;
const zoneKrav = z => (z.maalLux != null ? z.maalLux : ((ZONETYPER[z.type] || {}).lux || 500));
const zoneNavn = z => z.navn || (ZONETYPER[z.type] || {}).navn || 'Zone';

/* Lysspredningen vist som farvet net oven på planen. */
function tegnVarmekort() {
  if (!state.indst.visVarme || !harMaalestok()) return;
  const scene = hentScene();
  if (!scene) return;
  const m = state.pxPerMeter;
  ctx.save();
  ctx.globalAlpha = 0.62;
  for (const g of scene.gulv) {
    ctx.fillStyle = Tre.luxFarve(g.lux, state.indst.maksLux, 'falsk');
    ctx.fillRect(g.x * m, g.y * m, g.celle * m + 0.5, g.celle * m + 0.5);
  }
  ctx.restore();
}

function tegnInventar() {
  if (!state.indst.visInventar || !state.inventar.length) return;
  const z = state.visning.zoom;
  ctx.lineWidth = 1.2 / z;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const i of state.inventar) {
    const t = Inventar.INVENTAR_TYPER[i.type] || Inventar.INVENTAR_TYPER.andet;
    const valgt = state.valgt && state.valgt.slags === 'inventar' && state.valgt.id === i.id;
    ctx.beginPath();
    ctx.moveTo(i.hjørner[0][0], i.hjørner[0][1]);
    for (const p of i.hjørner.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = t.farve + (valgt ? '55' : '2E');
    ctx.fill();
    ctx.strokeStyle = valgt ? FARVER.skinneValgt : t.farve;
    ctx.lineWidth = (valgt ? 2.2 : 1.2) / z;
    ctx.stroke();
    // modulopdeling, så møblet ligner en reolopstilling og ikke en kasse
    const op = Moebler.opgør(i);
    if (op.moduler > 1 && mToPx(i.laengde) * z > 40) {
      const c = Math.cos(i.vinkel), sn = Math.sin(i.vinkel);
      const halvD = mToPx(i.dybde) / 2;
      ctx.beginPath();
      for (let k = 1; k < op.moduler; k++) {
        const u = -mToPx(i.laengde) / 2 + (mToPx(i.laengde) / op.moduler) * k;
        const x = i.centrum[0] + u * c, y = i.centrum[1] + u * sn;
        ctx.moveTo(x + sn * halvD, y - c * halvD);
        ctx.lineTo(x - sn * halvD, y + c * halvD);
      }
      ctx.lineWidth = 0.7 / z;
      ctx.stroke();
    }
    if (harMaalestok() && mToPx(i.laengde) * z > 60) {
      ctx.save();
      ctx.translate(i.centrum[0], i.centrum[1]);
      let v = i.vinkel;
      if (v > Math.PI / 2 || v < -Math.PI / 2) v += Math.PI;
      ctx.rotate(v);
      ctx.fillStyle = t.farve;
      ctx.font = `${11 / z}px "IBM Plex Sans", sans-serif`;
      const mærkat = (i.kategori || t.navn) + (i.fag ? ` · ${i.fag} fag` : ` · ${fmt(i.laengde, 1)} m`);
      ctx.fillText(mærkat, 0, 0);
      ctx.restore();
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function tegnZoner() {
  const z = state.visning.zoom;
  for (const zone of state.zoner) {
    if (zone.pts.length < 3) continue;
    const valgt = state.valgt && state.valgt.slags === 'zone' && state.valgt.id === zone.id;
    const farve = zoneFarve(zone);
    ctx.beginPath();
    ctx.moveTo(zone.pts[0][0], zone.pts[0][1]);
    for (const p of zone.pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = farve + '12';
    ctx.fill();
    ctx.strokeStyle = farve;
    ctx.setLineDash(valgt ? [] : [8 / z, 6 / z]);
    ctx.lineWidth = (valgt ? 2.6 : 1.6) / z;
    ctx.stroke();
    ctx.setLineDash([]);
    if (harMaalestok()) {
      const r = Geom.bbox(zone.pts);
      const areal = Geom.polygonArea(zone.pts) / (state.pxPerMeter ** 2);
      ctx.fillStyle = farve;
      ctx.font = `${12 / z}px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`${zoneNavn(zone)} · ${fmt(areal, 0)} m² · krav ${fmt(zoneKrav(zone))} lux`,
        r.x0 + 6 / z, r.y0 - 6 / z);
    }
  }
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

function tegnRektKladde() {
  if (!træk || træk.slags !== 'rekt') return;
  const z = state.visning.zoom;
  const [a, b] = [træk.start, træk.nu];
  const t = Inventar.INVENTAR_TYPER[state.indst.inventarType];
  ctx.save();
  ctx.setLineDash([6 / z, 4 / z]);
  ctx.strokeStyle = t.farve;
  ctx.fillStyle = t.farve + '22';
  ctx.lineWidth = 1.6 / z;
  ctx.beginPath();
  ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function tegnKameraer() {
  if (!state.kameraer.length && state.tilstand !== 'plan') return;
  const z = state.visning.zoom, m = state.pxPerMeter || 100;
  const punkter = state.kameraer.concat(state.tilstand === '3d' ? [Object.assign({ navn: 'Nu', nu: true }, state.kamera)] : []);
  for (const k of punkter) {
    const x = k.x * m, y = k.y * m;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(k.retning);
    ctx.fillStyle = k.nu ? '#E02B20' : '#145DA0';
    ctx.beginPath();
    ctx.moveTo(14 / z, 0); ctx.lineTo(-8 / z, 8 / z); ctx.lineTo(-8 / z, -8 / z);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    if (k.navn && !k.nu) {
      ctx.fillStyle = '#145DA0';
      ctx.font = `${11 / z}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(k.navn, x + 12 / z, y - 10 / z);
    }
  }
}

function tegnKladde() {
  if (!state.kladde.length) return;
  const z = state.visning.zoom;
  const pts = state.muse ? state.kladde.concat([state.muse]) : state.kladde;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = state.vaerktoej === 'omraade'
    ? ((ZONETYPER[state.indst.zoneType] || {}).farve || FARVER.omraade) : FARVER.skinne;
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
  if (state.tilstand === '3d') {
    træk = { slags: 'kig', skærm: [e.clientX, e.clientY], start: { ...state.kamera } };
    return;
  }
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
    case 'inventar':
      træk = { slags: 'rekt', start: p, nu: p };
      break;
    case 'kamera':
      træk = { slags: 'kamera', start: p, nu: p };
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
  if (træk && træk.slags === 'kig') {
    state.kamera.retning = træk.start.retning + (e.clientX - træk.skærm[0]) * 0.005;
    state.kamera.tilt = Math.max(-1.35, Math.min(1.35, træk.start.tilt - (e.clientY - træk.skærm[1]) * 0.004));
    tegn();
    return;
  }
  if (state.tilstand === '3d') return;
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
  if (træk && (træk.slags === 'rekt' || træk.slags === 'kamera')) {
    træk.nu = p;
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
  if (træk && træk.slags === 'rekt') {
    gem();
    const post = tilføjInventarRekt(træk.start, træk.nu);
    if (post) state.valgt = { slags: 'inventar', id: post.id };
    opdater();
  }
  if (træk && træk.slags === 'kamera') {
    const m = state.pxPerMeter || 100;
    const dx = træk.nu[0] - træk.start[0], dy = træk.nu[1] - træk.start[1];
    const retning = Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : 0;
    const k = {
      id: nyId(), navn: 'Kig ' + (state.kameraer.length + 1),
      x: træk.start[0] / m, y: træk.start[1] / m, h: 1.65, retning, tilt: -0.1
    };
    state.kameraer.push(k);
    Object.assign(state.kamera, { x: k.x, y: k.y, h: k.h, retning: k.retning, tilt: k.tilt });
    visKameraer();
    tegn();
  }
  træk = null;
});

lærred.addEventListener('dblclick', () => afslutKladde());
lærred.addEventListener('contextmenu', e => e.preventDefault());

lærred.addEventListener('wheel', e => {
  e.preventDefault();
  if (state.tilstand === '3d') {
    flytKamera(-Math.sign(e.deltaY) * (e.shiftKey ? 1.5 : 0.5), 0, 0);
    return;
  }
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

function flytKamera(frem, side, op) {
  const c = Math.cos(state.kamera.retning), s = Math.sin(state.kamera.retning);
  state.kamera.x += c * frem - s * side;
  state.kamera.y += s * frem + c * side;
  state.kamera.h = Math.max(0.3, Math.min(6, state.kamera.h + op));
  tegn();
}

window.addEventListener('keydown', e => {
  if (/input|textarea|select/i.test(e.target.tagName)) return;
  if (state.tilstand === '3d') {
    const skridt = e.shiftKey ? 1.2 : 0.45;
    const taster = {
      w: [skridt, 0, 0], ArrowUp: [skridt, 0, 0], s: [-skridt, 0, 0], ArrowDown: [-skridt, 0, 0],
      a: [0, -skridt, 0], ArrowLeft: [0, -skridt, 0], d: [0, skridt, 0], ArrowRight: [0, skridt, 0],
      q: [0, 0, -0.2], e: [0, 0, 0.2]
    };
    if (taster[e.key]) { e.preventDefault(); flytKamera(...taster[e.key]); return; }
    if (e.key === 'Escape') { sætTilstand('plan'); return; }
    return;
  }
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
  else if (e.key === 'i') vælgVærktøj('inventar');
  else if (e.key === 'k') vælgVærktøj('kamera');
  else if (e.key === '3') sætTilstand('3d');
});

function snapHvisOrtho(e, p) {
  if (e.altKey || !state.kladde.length) return p;
  return Geom.snapOrtho(state.kladde[state.kladde.length - 1], p);
}

function afslutKladde() {
  if (state.vaerktoej === 'omraade' && state.kladde.length >= 3) {
    gem();
    const type = state.indst.zoneType;
    const antal = state.zoner.filter(z => z.type === type).length;
    state.zoner.push({
      id: nyId(), type, pts: state.kladde.slice(),
      navn: (ZONETYPER[type] || {}).navn + (antal ? ' ' + (antal + 1) : ''),
      maalLux: (ZONETYPER[type] || {}).lux
    });
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
  for (let i = state.inventar.length - 1; i >= 0; i--) {
    const inv = state.inventar[i];
    if (Geom.pointInPolygon(p, inv.hjørner)) return { slags: 'inventar', id: inv.id };
  }
  for (let i = state.zoner.length - 1; i >= 0; i--) {
    const zone = state.zoner[i];
    const kant = Geom.projectOnPolyline(p, zone.pts.concat([zone.pts[0]]));
    if (kant && kant.afstand <= tol) return { slags: 'zone', id: zone.id };
  }
  return null;
}

function fjernObjekt(ref) {
  if (ref.slags === 'armatur') state.armaturer = state.armaturer.filter(a => a.id !== ref.id);
  else if (ref.slags === 'skinne') {
    state.skinner = state.skinner.filter(s => s.id !== ref.id);
    state.armaturer = state.armaturer.filter(a => a.skinneId !== ref.id);
  } else if (ref.slags === 'zone') state.zoner = state.zoner.filter(z => z.id !== ref.id);
  else if (ref.slags === 'inventar') state.inventar = state.inventar.filter(i => i.id !== ref.id);
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
  } else if (ref.slags === 'zone') {
    const zone = state.zoner.find(z => z.id === ref.id);
    if (zone) zone.pts = zone.pts.map(p => [p[0] + dx, p[1] + dy]);
  } else if (ref.slags === 'inventar') {
    const inv = state.inventar.find(i => i.id === ref.id);
    if (inv) {
      inv.hjørner = inv.hjørner.map(p => [p[0] + dx, p[1] + dy]);
      inv.centrum = [inv.centrum[0] + dx, inv.centrum[1] + dy];
    }
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
    omraade: 'Klik hjørnerne i zonen. Enter eller dobbeltklik lukker den. Zonetypen vælges i panelet til højre.',
    skinne: 'Klik skinnens knækpunkter. Enter eller dobbeltklik afslutter rækken. Alt = fri vinkel.',
    inventar: 'Træk et rektangel hen over møblet. Typen vælges i fanen Inventar.',
    kamera: 'Klik hvor du vil stå, og træk i den retning du kigger. Skift derefter til 3D.',
    slet: 'Klik på et objekt for at slette det.'
  }[v] || 'Klik i planen for at placere armaturet. Det snapper til nærmeste skinne (Alt = fri placering).';
  $('#status-hjælp').textContent = hjælp;
  tegn();
}

/* ---------- inventar ---------- */
function findInventar(stille) {
  const cadLag = state.lag.filter(l => l.slags === 'cad' && l.synlig);
  if (!cadLag.length) {
    if (!stille) toast('Inventar findes i DWG- og DXF-tegninger. Importér en CAD-tegning først.', 'fejl');
    return 0;
  }
  if (!harMaalestok()) { if (!stille) toast('Sæt målestok først', 'fejl'); return 0; }
  gem();
  state.inventar = state.inventar.filter(i => i.kilde === 'manuel');
  let fundet = 0;
  for (const lag of cadLag) {
    const liste = Inventar.find(lag, {
      pxPerMeter: state.pxPerMeter / (lag.skala || 1),
      lagFilter: lag.cadLag,
      graenser: { fagbredde: state.indst.fagbredde }
    });
    const r = lagRamme(lag);
    for (const f of liste) {
      // lagets egen forskydning og skalering lægges på
      const flyt = p => [lag.x + p[0] * lag.skala, lag.y + p[1] * lag.skala];
      const post = {
        id: nyId(), ...f,
        centrum: flyt(f.centrum),
        hjørner: f.hjørner.map(flyt),
        laengde: f.laengde * lag.skala,
        dybde: f.dybde * lag.skala
      };
      // en reol midt på gulvet er dobbeltsidet; en langs væggen er enkeltsidet
      if (post.type === 'reol' || post.type === 'vaegreol') {
        const b = Geom.bbox(post.hjørner);
        const tilVæg = pxToM(Math.min(b.x0 - r.x0, r.x1 - b.x1, b.y0 - r.y0, r.y1 - b.y1));
        const midtIButikken = tilVæg > 1.2;
        post.type = midtIButikken ? 'reol' : 'vaegreol';
        post.model = midtIButikken ? (post.dybde > 1.15 ? 'gondol2100' : 'gondol1800') : 'vaegreol2200';
        post.hoejde = Moebler.MØBLER[post.model].hoejde;
      }
      post.vendt = vendModButikken(post, r);
      state.inventar.push(post);
      fundet++;
    }
  }
  opdater();
  if (!stille || fundet) {
    const st = Inventar.stykliste(state.inventar, state.indst.fagbredde);
    toast(fundet
      ? `${fundet} møbler fundet: ${fmt(st.meterReol, 0)} m reol, ${fmt(st.meterKoel, 0)} m køl og ${fmt(st.meterFrost, 0)} m frost`
      : 'Der blev ikke fundet inventar – prøv at slå flere lag til, eller tegn møblerne med inventarværktøjet');
  }
  return fundet;
}

/* Enkeltsidede møbler skal vende fronten ind mod butikken, ikke mod væggen. */
function vendModButikken(post, ramme) {
  const midte = [(ramme.x0 + ramme.x1) / 2, (ramme.y0 + ramme.y1) / 2];
  const v = [-Math.sin(post.vinkel), Math.cos(post.vinkel)];
  const mod = [midte[0] - post.centrum[0], midte[1] - post.centrum[1]];
  return (v[0] * mod[0] + v[1] * mod[1]) >= 0 ? 1 : -1;
}

/* Zoner læst af tegningen: rumnavne som SALGSAREAL og VINDFANG inde i et
   lukket omrids. Findes ingen, bruges det største omrids som salgsareal. */
function findZonerITegning(stille) {
  const cadLag = state.lag.filter(l => l.slags === 'cad' && l.synlig);
  if (!cadLag.length || !harMaalestok()) {
    if (!stille) toast('Zoner findes i DWG- og DXF-tegninger med rumnavne', 'fejl');
    return 0;
  }
  gem();
  let fundet = 0;
  const afvigelser = [];
  for (const lag of cadLag) {
    const flyt = p => [lag.x + p[0] * lag.skala, lag.y + p[1] * lag.skala];
    const rum = Inventar.findZoner(lag, {
      pxPerMeter: state.pxPerMeter / (lag.skala || 1),
      lagFilter: lag.cadLag
    });
    for (const r of rum) {
      const pts = r.pts.map(flyt);
      const areal = Geom.polygonArea(pts) / (state.pxPerMeter ** 2);
      state.zoner.push({
        id: nyId(), type: r.type, navn: r.navn,
        maalLux: (ZONETYPER[r.type] || ZONETYPER.salg).lux,
        pts, fraTegning: true
      });
      fundet++;
      // står arealet på tegningen, kan målestokken kontrolleres
      if (r.angivetAreal && Math.abs(areal - r.angivetAreal) / r.angivetAreal > 0.05) {
        afvigelser.push(`${r.navn}: tegningen siger ${fmt(r.angivetAreal, 1)} m², polygonen giver ${fmt(areal, 1)} m²`);
      }
    }
  }
  if (!fundet) {
    // Ingen rumnavne. Så lægges salgsarealet der hvor møblerne står, og er der
    // heller ikke inventar, tages det største lukkede omrids.
    const fraInventar = salgsarealFraInventar();
    const største = fraInventar || størsteOmrids(cadLag);
    if (største) {
      state.zoner.push({
        id: nyId(), type: 'salg', navn: ZONETYPER.salg.navn, maalLux: ZONETYPER.salg.lux,
        pts: største, fraTegning: true, fraInventar: !!fraInventar
      });
      fundet = 1;
      if (fraInventar) afvigelser.push('salgsarealet er lagt om møblerne, fordi tegningen ikke har et rum med navn');
    }
  }
  opdater();
  if (!stille || fundet) {
    toast(fundet
      ? `${fundet} zone${fundet > 1 ? 'r' : ''} fundet på tegningen` +
        (afvigelser.length ? ` · OBS: ${afvigelser[0]}` : '')
      : 'Ingen rum med navn fundet – tegn zonen med arealværktøjet (A)', fundet ? 'info' : 'fejl');
  }
  if (afvigelser.length) console.warn('Lysplan – arealer afviger fra tegningens tekst:', afvigelser);
  return fundet;
}

/* Tekst der fortæller at et areal ikke er butik - fx den tomme hal
   "Ikke udnyttet Br. areal ca. 259 m2" ved siden af salgslokalet. */
const IKKE_BUTIK = /ikke udnyttet|ikke i brug|udlejning|fremtidig|option|reserve/i;

function størsteOmrids(cadLag) {
  let bedst = null, areal = 0;
  for (const lag of cadLag) {
    const tekster = (lag.tegning.tekster || [])
      .filter(t => t.t && IKKE_BUTIK.test(t.t))
      .map(t => [lag.x + t.x * lag.skala, lag.y + t.y * lag.skala]);
    for (const s of lag.tegning.streger) {
      if (!s.lukket || s.p.length < 8) continue;
      const pts = [];
      for (let i = 0; i < s.p.length; i += 2) pts.push([lag.x + s.p[i] * lag.skala, lag.y + s.p[i + 1] * lag.skala]);
      // et areal der er mærket "ikke udnyttet", er ikke salgsareal
      if (tekster.some(t => Geom.pointInPolygon(t, pts))) continue;
      const a2 = Geom.polygonArea(pts);
      if (a2 > areal) { areal = a2; bedst = pts; }
    }
  }
  return bedst;
}

/* Rum på tegningen der ikke er salgsareal: lager, personale, terræn og alt
   der er mærket "ikke udnyttet". De trækkes fra, så salgsarealet ikke løber
   ind i baglokalerne. */
function ikkeSalgsOmraader(cadLag) {
  const ude = [];
  for (const lag of cadLag) {
    const omrids = [];
    for (const st of lag.tegning.streger) {
      if (!st.lukket || st.p.length < 8) continue;
      const pts = [];
      for (let i = 0; i < st.p.length; i += 2) pts.push([lag.x + st.p[i] * lag.skala, lag.y + st.p[i + 1] * lag.skala]);
      const areal = Geom.polygonArea(pts) / (state.pxPerMeter ** 2);
      if (areal >= 5) omrids.push({ pts, areal });
    }
    if (!omrids.length) continue;
    omrids.sort((a, b) => a.areal - b.areal);
    for (const t of (lag.tegning.tekster || [])) {
      if (!t.t) continue;
      const navn = t.t.trim();
      let ud = IKKE_BUTIK.test(navn);
      if (!ud) {
        for (const [mønster, ty] of Inventar.RUMNAVNE) {
          if (mønster.test(navn)) { ud = ty === 'lager' || ty === 'personale' || ty === 'ude'; break; }
        }
      }
      if (!ud) continue;
      const pkt = [lag.x + t.x * lag.skala, lag.y + t.y * lag.skala];
      const rum = omrids.find(o => Geom.pointInPolygon(pkt, o.pts));
      if (rum && !ude.includes(rum.pts)) ude.push(rum.pts);
    }
  }
  return ude;
}

/* Salgsarealet der hvor møblerne står.
   Mange tegninger har ikke salgslokalet som ét lukket omrids - butikken er
   tegnet med vægge, søjler og reoler hver for sig. Derfor lægges gulvet
   omkring hvert møbel ud på et net, de sammenhængende felter samles, og
   kanten trækkes rundt om dem. Tomme haller og baglokaler kommer ikke med,
   fordi der ikke står inventar. */
function salgsarealFraInventar(rækkevidde = 3.2) {
  const inv = state.inventar.filter(i => i.laengde > 0.4);
  if (inv.length < 4) return null;
  const celle = mToPx(0.75);
  const stykker = inv.map(i => {
    const halv = mToPx(i.laengde) / 2;
    const c = Math.cos(i.vinkel), sn = Math.sin(i.vinkel);
    return {
      ax: i.centrum[0] - c * halv, ay: i.centrum[1] - sn * halv,
      bx: i.centrum[0] + c * halv, by: i.centrum[1] + sn * halv,
      r: mToPx(rækkevidde + i.dybde / 2)
    };
  });
  const b = Geom.bbox(inv.flatMap(i => i.hjørner));
  const kant = mToPx(rækkevidde) + celle;
  const x0 = b.x0 - kant, y0 = b.y0 - kant;
  const nx = Math.ceil((b.x1 + kant - x0) / celle), ny = Math.ceil((b.y1 + kant - y0) / celle);
  if (nx < 3 || ny < 3 || nx * ny > 250000) return null;

  // 1. felter der ligger tæt nok på et møbel
  const sat = new Uint8Array(nx * ny);
  for (const s of stykker) {
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    const len2 = dx * dx + dy * dy;
    const gx0 = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - s.r - x0) / celle));
    const gx1 = Math.min(nx - 1, Math.ceil((Math.max(s.ax, s.bx) + s.r - x0) / celle));
    const gy0 = Math.max(0, Math.floor((Math.min(s.ay, s.by) - s.r - y0) / celle));
    const gy1 = Math.min(ny - 1, Math.ceil((Math.max(s.ay, s.by) + s.r - y0) / celle));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (sat[gy * nx + gx]) continue;
        const px = x0 + (gx + 0.5) * celle, py = y0 + (gy + 0.5) * celle;
        let t = len2 ? ((px - s.ax) * dx + (py - s.ay) * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - (s.ax + t * dx), ey = py - (s.ay + t * dy);
        if (ex * ex + ey * ey <= s.r * s.r) sat[gy * nx + gx] = 1;
      }
    }
  }

  // 1b. rum tegningen selv kalder lager, personale eller "ikke udnyttet"
  const udenfor = ikkeSalgsOmraader(state.lag.filter(l => l.slags === 'cad' && l.synlig));
  if (udenfor.length) {
    for (let gy = 0; gy < ny; gy++) {
      for (let gx = 0; gx < nx; gx++) {
        const i = gy * nx + gx;
        if (!sat[i]) continue;
        const px = x0 + (gx + 0.5) * celle, py = y0 + (gy + 0.5) * celle;
        if (udenfor.some(o => Geom.pointInPolygon([px, py], o))) sat[i] = 0;
      }
    }
  }

  // 2. største sammenhængende område
  const mærke = new Int32Array(nx * ny).fill(-1);
  let bedstNr = -1, bedstAntal = 0, nr = 0;
  const stak = [];
  for (let i = 0; i < sat.length; i++) {
    if (!sat[i] || mærke[i] >= 0) continue;
    let antal = 0;
    stak.push(i); mærke[i] = nr;
    while (stak.length) {
      const j = stak.pop(); antal++;
      const jx = j % nx, jy = (j - jx) / nx;
      if (jx > 0 && sat[j - 1] && mærke[j - 1] < 0) { mærke[j - 1] = nr; stak.push(j - 1); }
      if (jx < nx - 1 && sat[j + 1] && mærke[j + 1] < 0) { mærke[j + 1] = nr; stak.push(j + 1); }
      if (jy > 0 && sat[j - nx] && mærke[j - nx] < 0) { mærke[j - nx] = nr; stak.push(j - nx); }
      if (jy < ny - 1 && sat[j + nx] && mærke[j + nx] < 0) { mærke[j + nx] = nr; stak.push(j + nx); }
    }
    if (antal > bedstAntal) { bedstAntal = antal; bedstNr = nr; }
    nr++;
  }
  if (bedstAntal < 6) return null;
  const med = new Uint8Array(nx * ny);
  for (let i = 0; i < med.length; i++) med[i] = mærke[i] === bedstNr ? 1 : 0;

  // 3. huller inde i området lukkes - gangarealet midt i butikken hører med
  const ude = new Uint8Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) {
    const ix = i % nx, iy = (i - ix) / nx;
    if (!med[i] && (ix === 0 || iy === 0 || ix === nx - 1 || iy === ny - 1) && !ude[i]) { ude[i] = 1; stak.push(i); }
  }
  while (stak.length) {
    const j = stak.pop();
    const jx = j % nx, jy = (j - jx) / nx;
    const naboer = [];
    if (jx > 0) naboer.push(j - 1);
    if (jx < nx - 1) naboer.push(j + 1);
    if (jy > 0) naboer.push(j - nx);
    if (jy < ny - 1) naboer.push(j + nx);
    for (const n of naboer) if (!med[n] && !ude[n]) { ude[n] = 1; stak.push(n); }
  }
  for (let i = 0; i < med.length; i++) if (!med[i] && !ude[i]) med[i] = 1;

  return kantOmNet(med, nx, ny, x0, y0, celle);
}

/* Kanten rundt om et sæt netfelter: hver feltside uden nabo bliver en
   kant, og kanterne sættes sammen ende mod ende til en lukket polygon. */
function kantOmNet(med, nx, ny, x0, y0, celle) {
  const nøgle = (gx, gy) => gy * (nx + 1) + gx;
  const fra = new Map();
  const læg = (a, b) => {
    if (!fra.has(nøgle(a[0], a[1]))) fra.set(nøgle(a[0], a[1]), []);
    fra.get(nøgle(a[0], a[1])).push(b);
  };
  for (let gy = 0; gy < ny; gy++) {
    for (let gx = 0; gx < nx; gx++) {
      if (!med[gy * nx + gx]) continue;
      if (gy === 0 || !med[(gy - 1) * nx + gx]) læg([gx, gy], [gx + 1, gy]);
      if (gx === nx - 1 || !med[gy * nx + gx + 1]) læg([gx + 1, gy], [gx + 1, gy + 1]);
      if (gy === ny - 1 || !med[(gy + 1) * nx + gx]) læg([gx + 1, gy + 1], [gx, gy + 1]);
      if (gx === 0 || !med[gy * nx + gx - 1]) læg([gx, gy + 1], [gx, gy]);
    }
  }
  let bedst = null;
  while (fra.size) {
    const start = fra.keys().next().value;
    const løkke = [];
    let her = start;
    while (fra.has(her)) {
      const ud = fra.get(her);
      const næste = ud.pop();
      if (!ud.length) fra.delete(her);
      const hx = her % (nx + 1), hy = (her - hx) / (nx + 1);
      løkke.push([hx, hy]);
      her = nøgle(næste[0], næste[1]);
      if (her === start) break;
    }
    if (!bedst || løkke.length > bedst.length) bedst = løkke;
  }
  if (!bedst || bedst.length < 4) return null;
  // lige stykker samles til ét, så polygonen ikke bliver en trappe af småpunkter
  const pts = [];
  for (let i = 0; i < bedst.length; i++) {
    const f = bedst[(i - 1 + bedst.length) % bedst.length], m = bedst[i], e = bedst[(i + 1) % bedst.length];
    const retning = (a, b) => (b[0] - a[0]) + ',' + (b[1] - a[1]);
    if (retning(f, m) !== retning(m, e)) pts.push([x0 + m[0] * celle, y0 + m[1] * celle]);
  }
  return pts.length >= 4 ? pts : null;
}

function tilføjInventarRekt(a, b) {
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
  if (Math.max(dx, dy) < mToPx(0.3)) return null;
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const vandret = dx >= dy;
  const type = state.indst.inventarType;
  const t = Inventar.INVENTAR_TYPER[type];
  const laengde = pxToM(vandret ? dx : dy), dybde = pxToM(vandret ? dy : dx);
  const post = {
    id: nyId(), type, kategori: '', tekst: '', kilde: 'manuel',
    laengde, dybde, hoejde: t.hoejde, vinkel: vandret ? 0 : Math.PI / 2,
    centrum: [(x0 + x1) / 2, (y0 + y1) / 2],
    hjørner: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
    fag: t.maaler === 'fag' ? Math.max(1, Math.round(laengde / state.indst.fagbredde)) : null,
    dele: 1
  };
  const r = state.lag.length ? lagRamme(state.lag[0]) : Geom.bbox(post.hjørner);
  post.vendt = vendModButikken(post, r);
  state.inventar.push(post);
  return post;
}

/* ---------- beregning af stykliste og nøgletal ---------- */
function beregn() {
  const i = state.indst;

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

  // zoner: belysningsstyrken beregnes punkt for punkt fra armaturernes placering
  const net = hentGulvNet();
  const zoner = state.zoner.map(z => {
    const areal = harMaalestok() && z.pts.length > 2
      ? Geom.polygonArea(z.pts) / (state.pxPerMeter ** 2) : 0;
    let lm = 0, w = 0, lmGrund = 0, lmAccent = 0, stk = 0;
    const typer = {};
    for (const a of state.armaturer) {
      const f = FIXTURES[a.type];
      if (!f || !Geom.pointInPolygon([a.x, a.y], z.pts)) continue;
      lm += f.lm; w += f.w; stk++;
      typer[a.type] = (typer[a.type] || 0) + 1;
      if (f.rolle === 'grund') lmGrund += f.lm;
      else if (f.rolle === 'accent') lmAccent += f.lm;
    }
    const krav = zoneKrav(z);
    const tal = Tre.zoneTal(net, z.id);
    const lux = tal.snit;
    // grundbelysningens andel af lysstrømmen bestemmer dens andel af gennemsnittet
    const luxGrund = lm > 0 ? lux * (lmGrund / lm) : 0;
    return {
      id: z.id, navn: zoneNavn(z), type: z.type, farve: zoneFarve(z), krav,
      areal, lm, w, stk, typer, lux, luxGrund, jaevnhed: tal.jaevnhed, minLux: tal.min,
      wattPrM2: areal > 0 ? w / areal : 0,
      iProgram: !!(ZONETYPER[z.type] || {}).iProgram,
      opfyldt: areal > 0 && lux >= krav,
      indenforTolerance: areal > 0 && lux >= krav * (1 - KRAV.tolerance)
    };
  });
  const arealInde = zoner.filter(z => z.type !== 'ude').reduce((a, z) => a + z.areal, 0);
  const areal = arealInde;

  const lux = zoner.length ? zoner.reduce((a, z) => a + z.lux * z.areal, 0) / Math.max(1, areal) : 0;
  const grupper = Math.max(
    pr_fase.bricks ? Math.ceil(pr_fase.bricks / FASE_REGLER.bricks.maks) : 0,
    pr_fase.spot ? Math.ceil(pr_fase.spot / FASE_REGLER.spot.maks) : 0,
    (pr_fase.bricks || pr_fase.spot || pr_fase.fast) ? 1 : 0
  );

  return {
    areal, zoner, skinne, start, endestykke, tee, frieEnder, antal, watt, lumen, lux,
    wattPrM2: areal > 0 ? watt / areal : 0,
    lumenPrM2: areal > 0 ? lumen / areal : 0,
    pr_fase, grupper,
    zonerOpfyldt: zoner.filter(z => z.opfyldt).length
  };
}

let lodretCache = { nøgle: -1, tal: {} };
function zoneLodret(zone) {
  if (lodretCache.nøgle !== state.version) lodretCache = { nøgle: state.version, tal: {} };
  if (lodretCache.tal[zone.id]) return lodretCache.tal[zone.id];
  const poly = zone.pts.map(p => [p[0] / state.pxPerMeter, p[1] / state.pxPerMeter]);
  const tal = Tre.planTal(sceneKilde(), poly, {
    hoejde: BEREGNING.beregningshoejde, metrik: 'lodret', celle: 1.0
  });
  lodretCache.tal[zone.id] = tal;
  return tal;
}

/* ---------- kontrol mod byggeprogrammet ---------- */
function kravTjek(b) {
  const punkter = [];
  const tilføj = (status, emne, tekst) => punkter.push({ status, emne, tekst });

  if (!b.zoner.length) {
    tilføj('info', 'Zoner', 'Tegn zonerne (salgsareal, betjente områder, vindfang) for at få kontrolleret lux-kravene.');
  }
  for (const z of b.zoner) {
    if (!z.areal) continue;
    if (z.type === 'ude') {
      tilføj('info', z.navn, 'Udvendigt areal dimensioneres efter DS/EN 12464-2: klasse E-1 ved bygning og E-3 på P-plads. Lyskilder 3000K.');
      continue;
    }
    const status = z.lux >= z.krav ? 'ok' : (z.indenforTolerance ? 'advarsel' : 'fejl');
    const zone = state.zoner.find(x => x.id === z.id);
    const lod = zone ? zoneLodret(zone) : null;
    tilføj(status, z.navn,
      `${fmt(z.lux, 0)} lux på gulvet mod krav ${fmt(z.krav)} lux${z.iProgram ? ' (byggeprogram)' : ' (eget krav)'}` +
      ` – ${fmt(z.areal, 0)} m², ${z.stk} armaturer, ${fmt(z.wattPrM2, 1)} W/m²` +
      (z.lux > 0 ? `, ${fmt(z.wattPrM2 / (z.lux / 100), 2)} W/m²/100lx` : '') + '.' +
      (lod ? ` Lodret i ${fmt(BEREGNING.beregningshoejde, 1)} m: ${fmt(lod.snit, 0)} lux (Uo ${fmt(lod.uo, 2)}) – det tal SJOC's DIALux-rapporter opgiver mod normens ${BEREGNING.norm.salgsomraade} lux.` : ''));
    if (z.lux > 0 && z.luxGrund < z.krav) {
      tilføj(z.luxGrund >= z.krav * (1 - KRAV.tolerance) ? 'advarsel' : 'fejl', z.navn + ': grundbelysning',
        `Grundbelysningen alene giver ${fmt(z.luxGrund, 0)} lux. Spots må ikke anvendes som grundbelysning, kun til fremhævning af ${KRAV.spotOmraader.slice(0, 4).join(', ').toLowerCase()} m.fl.`);
    }
  }

  for (const z of b.zoner) {
    if (!z.areal || z.type === 'ude' || !z.jaevnhed) continue;
    const norm = BEREGNING.norm.uo;
    tilføj(z.jaevnhed >= norm ? 'ok' : 'advarsel', z.navn + ': jævnhed',
      `Uo ${fmt(z.jaevnhed, 2)} på gulvet mod ${norm} i DS/EN 12464-1. Mindste værdi ${fmt(z.minLux, 0)} lux. SJOC's egne beregninger ligger på 0,17–0,19, så tallet er til at holde øje med, ikke et afvisningskriterium.`);
  }

  // armaturdata mod kravene til lyskilder
  for (const [nøgle, antal] of Object.entries(b.antal)) {
    const f = FIXTURES[nøgle];
    if (!f || !antal || !f.w) continue;
    const ude = f.rolle === 'ude';
    const lmw = lmPrW(f);
    const grænse = f.rolle === 'grund' ? KRAV.lmwGrund : (f.rolle === 'accent' ? KRAV.lmwSpot : 0);
    if (grænse && lmw < grænse) {
      tilføj('advarsel', f.navn,
        `${fmt(lmw, 0)} lm/W mod krav ≥ ${grænse} lm/W for ${f.rolle === 'grund' ? 'grundbelysning' : 'spots'}. Tallet stammer fra kataloget – kontrollér databladet.`);
    }
    const kravCct = ude ? KRAV.ude.cct : KRAV.inde.cct;
    if (f.cct && f.cct !== kravCct) {
      tilføj('advarsel', f.navn, `Farvetemperatur ${f.cct}K mod krav ${kravCct}K ${ude ? 'udvendigt' : 'indvendigt'}.`);
    }
    if (!ude && f.ra && f.ra < KRAV.inde.ra) {
      tilføj('advarsel', f.navn, `Farvegengivelse Ra ${f.ra} mod krav > ${KRAV.inde.ra}.`);
    }
  }

  // opbygning mod lofttype
  const loft = LOFTTYPER[state.indst.lofttype] || LOFTTYPER.skinne;
  const harSkinner = state.skinner.length > 0;
  const harPaneler = state.armaturer.some(a => (FIXTURES[a.type] || {}).symbol === 'panel');
  if (state.indst.lofttype === 'system' && harSkinner) {
    tilføj('advarsel', 'Loftstype',
      'Ved nedsænket loft skal der bruges LED-paneler i loftets dimensioner og indbyggede tilt-spots, ikke 3-fasede skinner.');
  } else if (state.indst.lofttype === 'skinne' && harPaneler && !harSkinner) {
    tilføj('advarsel', 'Loftstype',
      'Ved øvrige lofttyper skal der bruges universelle 3-fasede skinnesystemer med skinnespots og nedhængte lysskinner.');
  } else if (b.antal && (harSkinner || harPaneler)) {
    tilføj('ok', 'Loftstype', loft.navn + '.');
  }

  if (b.grupper) {
    const brickPrGruppe = b.pr_fase.bricks / b.grupper;
    const spotPrGruppe = b.pr_fase.spot / b.grupper;
    const over = brickPrGruppe > FASE_REGLER.bricks.maks + 0.001 || spotPrGruppe > FASE_REGLER.spot.maks + 0.001;
    tilføj(over ? 'fejl' : 'ok', 'Gruppeopdeling',
      `${b.grupper} stk. 3-polede grupper: ${fmt(brickPrGruppe, 1)} Bricks og ${fmt(spotPrGruppe, 1)} spot pr. gruppe (maks. ${FASE_REGLER.bricks.maks} og ${FASE_REGLER.spot.maks}).`);
  }

  tilføj('info', 'Måling',
    `Lux måles på gulv (${KRAV.maalehoejde}) med ±${Math.round(KRAV.tolerance * 100)} % tolerance. Tallene her er beregnet direkte fra armaturernes placering og lysfordeling – den endelige dokumentation kræver lysberegning og måling i butikken.`);
  tilføj('info', 'Fersk­varer',
    `Ved slagter, delikatesse og kølemøbler til kød og pålæg kræves spots med Ra ≥ ${KRAV.fersk.ra} og R9 ≥ ${KRAV.fersk.r9}.`);

  return punkter;
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
  const zoneStatus = b.zoner.length
    ? (b.zonerOpfyldt === b.zoner.length ? 'god' : (b.zonerOpfyldt ? 'advarsel' : 'lav')) : '';
  const kort = [
    { navn: 'Areal i alt', vaerdi: b.areal ? fmt(b.areal, 0) + ' m²' : '–',
      note: b.zoner.length ? `${b.zoner.length} zone${b.zoner.length > 1 ? 'r' : ''}` : 'tegn zonerne' },
    { navn: 'Skinne i alt', vaerdi: fmt(b.skinne.laengde, 0) + ' m', note: `${b.skinne.antal} stk. i ${b.skinne.raekker} rækker` },
    { navn: 'Installeret effekt', vaerdi: fmt(b.watt, 0) + ' W', note: b.areal ? fmt(b.wattPrM2, 1) + ' W/m²' : '' },
    { navn: 'Lysstrøm', vaerdi: fmt(b.lumen / 1000, 1) + ' klm', note: b.areal ? fmt(b.lumenPrM2, 0) + ' lm/m²' : '' },
    { navn: 'Zoner med opfyldt krav', vaerdi: b.zoner.length ? `${b.zonerOpfyldt}/${b.zoner.length}` : '–',
      note: `LLMF ${i.mf} · refleks ${Math.round(i.refleksLoft * 100)}/${Math.round(i.refleksVaeg * 100)}/${Math.round(i.refleksGulv * 100)}`, slags: zoneStatus },
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

/* Zoneliste med beregnet lux over for kravet. */
function visZoner(b) {
  const boks = $('#zoneliste');
  if (!b.zoner.length) {
    boks.innerHTML = '<p class="tom">Ingen zoner tegnet endnu.</p>';
    return;
  }
  boks.innerHTML = '';
  for (const z of b.zoner) {
    const ude = z.type === 'ude';
    const status = !z.areal ? 'info' : ude ? 'info'
      : (z.lux >= z.krav ? 'ok' : (z.indenforTolerance ? 'advarsel' : 'fejl'));
    const el = document.createElement('div');
    el.className = 'zone';
    el.style.borderLeftColor = z.farve;
    el.innerHTML = `
      <div class="zone-top">
        <span class="prik ${status}"></span>
        <input class="zone-navn" value="${z.navn}" data-h="navn">
        <button class="ikon" data-h="slet" title="Slet zone">✕</button>
      </div>
      <div class="zone-tal">
        <span><strong>${fmt(z.areal, 0)}</strong> m²</span>
        <span><strong>${fmt(z.lux, 0)}</strong> lux${ude ? '' : ` af ${fmt(z.krav)}`}</span>
        <span>${z.stk} armaturer</span>
        <span class="krav">krav <input type="number" step="50" min="0" value="${z.krav}" data-h="krav"></span>
      </div>`;
    el.querySelector('[data-h="navn"]').onchange = e => {
      const zone = state.zoner.find(x => x.id === z.id);
      if (zone) { zone.navn = e.target.value; opdater(); }
    };
    el.querySelector('[data-h="krav"]').onchange = e => {
      const zone = state.zoner.find(x => x.id === z.id);
      if (zone) { zone.maalLux = Math.max(0, +e.target.value || 0); opdater(); }
    };
    el.querySelector('[data-h="slet"]').onclick = () => {
      gem();
      state.zoner = state.zoner.filter(x => x.id !== z.id);
      state.armaturer = state.armaturer.filter(a => !(a.auto && a.zoneId === z.id));
      state.skinner = state.skinner.filter(sk => !(sk.auto && sk.zoneId === z.id));
      opdater();
    };
    el.onclick = e => {
      if (e.target.dataset.h) return;
      state.valgt = { slags: 'zone', id: z.id };
      tegn();
    };
    boks.appendChild(el);
  }
}

/* Inventarfanen: opgørelse pr. type og en redigerbar liste over møblerne. */
function visInventarPanel() {
  const st = Inventar.stykliste(state.inventar, state.indst.fagbredde);
  $('#inventar-noegletal').innerHTML = [
    { navn: 'Reol', vaerdi: fmt(st.meterReol, 1) + ' m', note: `${st.fagIAlt} fag i alt` },
    { navn: 'Køl', vaerdi: fmt(st.meterKoel, 1) + ' m', note: 'løbende meter' },
    { navn: 'Frost', vaerdi: fmt(st.meterFrost, 1) + ' m', note: 'løbende meter' },
    { navn: 'Møbler', vaerdi: fmt(state.inventar.length), note: 'fundet i tegningen' }
  ].map(k => `<div class="kort"><span class="kort-navn">${k.navn}</span><strong>${k.vaerdi}</strong><span class="kort-note">${k.note}</span></div>`).join('');

  const krop = $('#inventar-tabel tbody');
  if (!st.grupper.length) {
    krop.innerHTML = '<tr><td colspan="4" class="tom">Intet inventar endnu.</td></tr>';
  } else {
    krop.innerHTML = st.grupper.map(g => {
      const detaljer = state.inventar.filter(i => i.type === g.type).map(i => Moebler.opgør(i));
      const moduler = detaljer.reduce((a, d) => a + d.moduler, 0);
      const hylder = detaljer.reduce((a, d) => a + d.hylder, 0);
      const låger = detaljer.reduce((a, d) => a + d.laager + d.laag, 0);
      const under = Object.entries(g.varegrupper)
        .sort((a, b) => b[1].meter - a[1].meter)
        .map(([navn, v]) => `<tr class="under"><td>${navn}</td><td class="tal">${v.antal}</td><td class="tal">${fmt(v.meter, 1)}</td><td class="tal">${v.fag || ''}</td></tr>`).join('');
      return `<tr><td><strong>${g.navn}</strong><span class="sub">${moduler} moduler${hylder ? ` · ${hylder} hylder` : ''}${låger ? ` · ${låger} låger/låg` : ''}</span></td>` +
        `<td class="tal">${g.antal}</td><td class="tal">${fmt(g.meter, 1)}</td><td class="tal">${g.fag || ''}</td></tr>` + under;
    }).join('');
  }

  const liste = $('#inventar-liste');
  if (!state.inventar.length) {
    liste.innerHTML = '<p class="tom">Tryk “Find inventar i tegningen”, eller tegn møblerne med inventarværktøjet.</p>';
    return;
  }
  liste.innerHTML = '';
  for (const i of state.inventar) {
    const t = Inventar.INVENTAR_TYPER[i.type] || Inventar.INVENTAR_TYPER.andet;
    const el = document.createElement('div');
    el.className = 'inv' + (state.valgt && state.valgt.slags === 'inventar' && state.valgt.id === i.id ? ' valgt' : '');
    el.style.borderLeftColor = t.farve;
    const op = Moebler.opgør(i);
    el.innerHTML = `
      <select data-h="type">${Object.entries(Inventar.INVENTAR_TYPER)
        .map(([k, v]) => `<option value="${k}" ${k === i.type ? 'selected' : ''}>${v.navn}</option>`).join('')}</select>
      <input data-h="kategori" value="${(i.kategori || '').replace(/"/g, '&quot;')}" placeholder="varegruppe">
      <span class="meter" title="længde × dybde × højde">${fmt(i.laengde, 1)}×${fmt(i.dybde, 1)}×${fmt(i.hoejde, 1)}</span>
      <input data-h="fag" type="number" min="0" step="1" value="${i.fag || ''}" title="fag">
      <button class="ikon" data-h="slet" title="Slet">✕</button>
      <select data-h="model" class="model">${Object.entries(Moebler.MØBLER)
        .map(([k, v]) => `<option value="${k}" ${k === (i.model || Moebler.STANDARDMODEL[i.type]) ? 'selected' : ''}>${v.navn}</option>`).join('')}</select>
      <span class="detalje">${op.moduler} moduler à ${fmt(op.modulBredde, 2)} m${op.hylder ? ` · ${op.hylder} hylder` : ''}${op.laager ? ` · ${op.laager} låger` : ''}${op.laag ? ` · ${op.laag} låg` : ''}</span>`;
    el.querySelector('[data-h="model"]').onchange = e => {
      i.model = e.target.value;
      const m = Moebler.MØBLER[i.model];
      if (m) { i.hoejde = m.hoejde; i.type = m.type; }
      opdater();
    };
    el.querySelector('[data-h="type"]').onchange = e => {
      i.type = e.target.value;
      const ny = Inventar.INVENTAR_TYPER[i.type];
      i.model = Inventar.vælgModel(i.type, i.dybde, i.laengde, i.tekst || '');
      i.hoejde = (Moebler.MØBLER[i.model] || ny).hoejde;
      i.fag = ny.maaler === 'fag' ? Math.max(1, Math.round(i.laengde / state.indst.fagbredde)) : null;
      opdater();
    };
    el.querySelector('[data-h="kategori"]').onchange = e => { i.kategori = e.target.value; opdater(); };
    el.querySelector('[data-h="fag"]').onchange = e => { i.fag = Math.max(0, parseInt(e.target.value, 10) || 0) || null; opdater(); };
    el.querySelector('[data-h="slet"]').onclick = () => { gem(); state.inventar = state.inventar.filter(x => x.id !== i.id); opdater(); };
    el.onclick = e => {
      if (e.target.dataset.h) return;
      state.valgt = { slags: 'inventar', id: i.id };
      visInventarPanel();
      tegn();
    };
    liste.appendChild(el);
  }
}

/* Kontrolberegning: værktøjet regner SJOC's egne DIALux-sager efter, så man
   kan se hvor tæt beregningen ligger på de rapporter, den skal kunne erstatte
   i skitsefasen. Opstillingen er forenklet - jævnt fordelte armaturer i et
   rektangel uden inventar - så uensartetheden (Uo) kan ikke sammenlignes. */
function referenceTjek() {
  return BEREGNING.benchmark.map(b => {
    const forhold = b.navn.includes('Kvickly') ? 79.53 / 37.4 : 45.419 / 27.042;
    const h = Math.sqrt(b.areal / forhold), bredde = b.areal / h;
    const armaturer = [];
    let watt = 0;
    for (const [type, antal] of b.armaturer) {
      const trin = Math.sqrt((bredde * h) / antal);
      const kolonner = Math.max(1, Math.round(bredde / trin));
      const rækker = Math.max(1, Math.ceil(antal / kolonner));
      for (let n = 0; n < antal; n++) {
        const r = Math.floor(n / kolonner), k = n % kolonner;
        armaturer.push({
          id: 'ref' + n + type, type,
          x: (bredde * (k + 0.5)) / kolonner * 100,
          y: (h * (r + 0.5)) / rækker * 100, vinkel: 0
        });
        watt += FIXTURES[type].w;
      }
    }
    const prøve = {
      pxPerMeter: 100, armaturer, inventar: [],
      zoner: [{ id: 'ref', type: 'salg', pts: [[0, 0], [bredde * 100, 0], [bredde * 100, h * 100], [0, h * 100]] }],
      indst: Object.assign({}, state.indst, {
        monteringshoejde: b.montage, loftshoejde: b.montage, mf: BEREGNING.vedligehold
      })
    };
    const poly = prøve.zoner[0].pts.map(p => [p[0] / 100, p[1] / 100]);
    const lodret = Tre.planTal(prøve, poly, { hoejde: BEREGNING.beregningshoejde, metrik: 'lodret', celle: 0.8 });
    const gulv = Tre.planTal(prøve, poly, { hoejde: 0, metrik: 'vandret', celle: 0.8 });
    const wPrM2 = watt / b.areal;
    return {
      navn: b.navn, dato: b.dato, areal: b.areal, montage: b.montage,
      antal: b.armaturer.reduce((a, x) => a + x[1], 0),
      rapportLodret: b.lodret, mitLodret: lodret.snit, mitGulv: gulv.snit,
      afvigelse: b.lodret > 0 ? (lodret.snit / b.lodret - 1) * 100 : 0,
      rapportW: b.wPrM2, mitW: wPrM2,
      rapportW100: b.wPr100lx, mitW100: lodret.snit > 0 ? wPrM2 / (lodret.snit / 100) : 0
    };
  });
}

/* Kontrolfanen: punkterne fra kravTjek samt kravene til lyskilder. */
function visKrav(b) {
  const punkter = kravTjek(b);
  $('#krav-kilde').textContent = `${KRAV.kilde}. Lux beregnes punkt for punkt på gulvet ud fra armaturernes placering og lysfordeling, med LLMF ${state.indst.mf} og refleksioner ${Math.round(state.indst.refleksLoft*100)}/${Math.round(state.indst.refleksVaeg*100)}/${Math.round(state.indst.refleksGulv*100)} %. Det er en direkte beregning uden fuld refleksionsmodel – ikke en DIALux-rapport.`;
  $('#kravliste').innerHTML = punkter.map(p => `
    <li class="${p.status}"><span class="prik ${p.status}"></span>
      <span><b>${p.emne}</b>${p.tekst}</span></li>`).join('');

  const rækker = [
    ['Salgsareal', '700 lux på gulvet'],
    ['Betjente områder', '1000 lux på gulvet'],
    ['Vindfang og indgang', '1000 lux på gulvet'],
    ['Farvetemperatur', `${KRAV.inde.cct}K inde · ${KRAV.ude.cct}K ude`],
    ['Farvegengivelse', `Ra > ${KRAV.inde.ra} · fersk Ra ≥ ${KRAV.fersk.ra} og R9 ≥ ${KRAV.fersk.r9}`],
    ['Farvekonsistens', `SDCM ≤ ${KRAV.inde.sdcm} inde · ≤ ${KRAV.ude.sdcm} ude`],
    ['Blænding', `UGR < ${KRAV.inde.ugr}`],
    ['Systemeffektivitet', `≥ ${KRAV.lmwGrund} lm/W grundbelysning · ≥ ${KRAV.lmwSpot} lm/W spots`],
    ['Flimmer', 'PstLM ≤ 1,0 (EN 61000-3-3)'],
    ['Levetid', KRAV.inde.levetid],
    ['Net', `THD ≤ ${KRAV.inde.thd} % · PF ≥ ${String(KRAV.inde.pf).replace('.', ',')}`],
    ['Spots', 'kun som accent: ' + KRAV.spotOmraader.join(', ')]
  ];
  $('#lyskildekrav').innerHTML = rækker.map(([a, v]) => `<li><span>${a}</span><span>${v}</span></li>`).join('');
  const ref = referenceTjek();
  const refEl = $('#referencer');
  if (refEl) {
    refEl.innerHTML = ref.map(r => `
      <li class="${Math.abs(r.afvigelse) <= 10 ? 'ok' : 'advarsel'}">
        <span class="prik ${Math.abs(r.afvigelse) <= 10 ? 'ok' : 'advarsel'}"></span>
        <span><b>${r.navn} · ${r.dato}</b>
        ${fmt(r.areal, 0)} m², ${r.antal} armaturer, montage ${fmt(r.montage, 1)} m.<br>
        Rapport: ${fmt(r.rapportLodret)} lx lodret · ${fmt(r.rapportW, 2)} W/m² · ${fmt(r.rapportW100, 2)} W/m²/100lx<br>
        Her: ${fmt(r.mitLodret, 0)} lx lodret (${r.afvigelse >= 0 ? '+' : ''}${fmt(r.afvigelse, 0)} %) · ${fmt(r.mitGulv, 0)} lx på gulvet · ${fmt(r.mitW, 2)} W/m² · ${fmt(r.mitW100, 2)} W/m²/100lx</span>
      </li>`).join('');
  }
  $('#dokumentation').innerHTML = KRAV.dokumentation
    .map(d => `<li><span>${d}</span><span>${/LUX/i.test(d) ? 'beregnes her' : 'fra datablad'}</span></li>`).join('');
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
    if (lag.slags === 'cad') {
      el.appendChild(cadLagPanel(lag));
      if (lag.diagnose) el.appendChild(diagnosePanel(lag));
    }
    liste.appendChild(el);
  });
}

/* Lagene inde i CAD-tegningen kan slukkes hver for sig - f.eks. møblering
   eller målsætning, der ellers støjer under lysplanen. */
function cadLagPanel(lag) {
  if (!lag.lagAntal) {
    const n = {};
    for (const s of lag.tegning.streger) n[s.lag] = (n[s.lag] || 0) + 1;
    for (const t of lag.tegning.tekster) n[t.lag] = (n[t.lag] || 0) + 1;
    lag.lagAntal = n;
  }
  const boks = document.createElement('div');
  boks.className = 'cad-lag';
  // de lag med mest på sig står øverst - de tomme nederst
  const navne = Object.keys(lag.cadLag).sort((a, b) =>
    (lag.lagAntal[b] || 0) - (lag.lagAntal[a] || 0) || a.localeCompare(b, 'da'));
  boks.innerHTML = `
    <label class="afkryds lille"><input type="checkbox" ${lag.egneFarver ? 'checked' : ''} data-h="farver"> Tegningens egne farver</label>
    <details>
      <summary>Lag i tegningen (<span data-h="tal"></span>)</summary>
      <input type="search" class="lag-soeg" data-h="soeg" placeholder="Søg i ${navne.length} lag …">
      <div class="cad-lag-liste">
        ${navne.map(n => `
          <label data-navn="${encodeURIComponent(n)}">
            <input type="checkbox" data-cadlag="${encodeURIComponent(n)}">
            <span class="navn" title="${n}">${n || '(uden navn)'}</span>
            <span class="antal">${fmt(lag.lagAntal[n] || 0)}</span>
            <button class="ikon" data-kun="${encodeURIComponent(n)}" title="Vis kun dette lag">◉</button>
          </label>`).join('')}
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
  boks.querySelectorAll('[data-kun]').forEach(knap => {
    knap.onclick = e => {
      e.preventDefault();
      const kun = decodeURIComponent(knap.dataset.kun);
      navne.forEach(n => { lag.cadLag[n] = n === kun; });
      synk();
    };
  });
  boks.querySelector('[data-h="soeg"]').oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    boks.querySelectorAll('.cad-lag-liste label').forEach(l => {
      l.hidden = q ? !decodeURIComponent(l.dataset.navn).toLowerCase().includes(q) : false;
    });
  };
  boks.querySelector('[data-h="alle"]').onclick = () => { navne.forEach(n => { lag.cadLag[n] = true; }); synk(); };
  boks.querySelector('[data-h="ingen"]').onclick = () => { navne.forEach(n => { lag.cadLag[n] = false; }); synk(); };
  synk();
  return boks;
}

/* Gulvnettet beregnes én gang pr. ændring og genbruges af nøgletal,
   kravkontrol, varmekort og 3D-billedet. */
function sceneKilde() {
  return (state.visReference && state.reference)
    ? Object.assign({}, state, {
      armaturer: state.reference.armaturer, skinner: state.reference.skinner, inventar: state.reference.inventar
    })
    : state;
}

let netCache = { nøgle: -1, net: null };
function hentGulvNet() {
  const nøgle = state.version * 2 + (state.visReference ? 1 : 0);
  if (netCache.nøgle === nøgle) return netCache.net;
  netCache = { nøgle, net: Tre.gulvNet(sceneKilde(), state.indst.trecelle || 0.5) };
  return netCache.net;
}

/* Scenen bygges igen, når planen er ændret - ikke når kameraet flyttes. */
function hentScene() {
  const nøgle = state.version * 2 + (state.visReference ? 1 : 0);
  if (state.scene && state.sceneVersion === nøgle) return state.scene;
  state.scene = Tre.byggScene(sceneKilde(), { net: hentGulvNet() });
  state.sceneVersion = nøgle;
  return state.scene;
}

function tegn3d() {
  const { b, h } = visningsStørrelse();
  ctx.save();
  ctx.setTransform(lærred.width / b, 0, 0, lærred.height / h, 0, 0);
  const scene = hentScene();
  if (!scene) {
    ctx.fillStyle = '#20242C';
    ctx.fillRect(0, 0, b, h);
    ctx.fillStyle = '#8A8F9C';
    ctx.font = '14px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tegn zoner og armaturer – så kan du gå ind i butikken her', b / 2, h / 2);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }
  Tre.tegn(ctx, b, h, state.kamera, scene, {
    fov: state.indst.fov, farvetilstand: state.indst.farvetilstand, maksLux: state.indst.maksLux
  });
  ctx.restore();
  visTreTal(scene);
}

function visTreTal(scene) {
  const tal = Tre.gulvTal(scene);
  const el = $('#tre-tal');
  if (!el) return;
  const ref = state.reference ? state.reference.tal : null;
  const diff = (nu, før) => {
    if (!ref) return '';
    const d = nu - før;
    return `<span class="diff ${d >= 0 ? 'op' : 'ned'}">${d >= 0 ? '+' : '−'}${fmt(Math.abs(d), 0)}</span>`;
  };
  el.innerHTML = `
    <div class="kort"><span class="kort-navn">Gennemsnit på gulvet</span><strong>${fmt(tal.snit, 0)} lux</strong>
      <span class="kort-note">direkte lys ${diff(tal.snit, ref ? ref.snit : 0)}</span></div>
    <div class="kort"><span class="kort-navn">Mindst</span><strong>${fmt(tal.min, 0)} lux</strong>
      <span class="kort-note">jævnhed ${fmt(tal.jaevnhed, 2)}</span></div>
    <div class="kort"><span class="kort-navn">Størst</span><strong>${fmt(tal.maks, 0)} lux</strong>
      <span class="kort-note">max/min ${fmt(tal.min > 0 ? tal.maks / tal.min : 0, 1)}</span></div>
    <div class="kort"><span class="kort-navn">Effekt</span><strong>${fmt(state.armaturer.reduce((a, x) => a + (FIXTURES[x.type] ? FIXTURES[x.type].w : 0), 0), 0)} W</strong>
      <span class="kort-note">${state.armaturer.length} armaturer</span></div>`;
}

/* Skift mellem plantegning og 3D-kig. */
function sætTilstand(t) {
  state.tilstand = t;
  $('#knap-plan').classList.toggle('aktiv', t === 'plan');
  $('#knap-3d').classList.toggle('aktiv', t === '3d');
  $$('.kun-3d').forEach(el => { el.hidden = t !== '3d'; });
  $$('.kun-plan').forEach(el => { el.hidden = t === '3d'; });
  $('#tre-tal').hidden = t !== '3d';
  if (t === '3d') $('#resultat').hidden = true;
  if (t === '3d') {
    if (!state.kameraer.length && state.zoner.length) placerStartkamera();
    lærred.style.cursor = 'grab';
  } else {
    vælgVærktøj(state.vaerktoej);
  }
  tegn();
}

function placerStartkamera() {
  const zone = state.zoner.find(z => z.type !== 'ude') || state.zoner[0];
  if (!zone) return;
  const m = state.pxPerMeter || 100;
  const r = Geom.bbox(zone.pts);
  const langs = (r.x1 - r.x0) >= (r.y1 - r.y0);
  const start = [
    langs ? r.x0 + (r.x1 - r.x0) * 0.08 : (r.x0 + r.x1) / 2,
    langs ? (r.y0 + r.y1) / 2 : r.y0 + (r.y1 - r.y0) * 0.08
  ];
  const punkt = frittPunkt(start, zone);
  state.kamera.x = punkt[0] / m;
  state.kamera.y = punkt[1] / m;
  state.kamera.retning = langs ? 0 : Math.PI / 2;
  state.kamera.tilt = -0.08;
  state.kameraer.push({ id: nyId(), navn: 'Indgang', ...state.kamera });
  visKameraer();
}

/* Nærmeste sted i zonen hvor der ikke står et møbel - så man ikke starter inde i en reol. */
function frittPunkt(p, zone) {
  const fri = q => Geom.pointInPolygon(q, zone.pts) &&
    !state.inventar.some(i => Geom.pointInPolygon(q, udvidetRekt(i, mToPx(0.4))));
  if (fri(p)) return p;
  for (let radius = mToPx(0.5); radius < mToPx(12); radius += mToPx(0.5)) {
    for (let v = 0; v < Math.PI * 2; v += Math.PI / 8) {
      const q = [p[0] + Math.cos(v) * radius, p[1] + Math.sin(v) * radius];
      if (fri(q)) return q;
    }
  }
  return p;
}

function udvidetRekt(i, margen) {
  const c = Math.cos(i.vinkel), s = Math.sin(i.vinkel);
  const hl = mToPx(i.laengde) / 2 + margen, hd = mToPx(i.dybde) / 2 + margen;
  const h = (u, v) => [i.centrum[0] + u * c - v * s, i.centrum[1] + u * s + v * c];
  return [h(-hl, -hd), h(hl, -hd), h(hl, hd), h(-hl, hd)];
}

function visKameraer() {
  const boks = $('#kameraliste');
  if (!state.kameraer.length) {
    boks.innerHTML = '<p class="hjælp">Sæt kigpunkter med kameraværktøjet (K), og skift til 3D.</p>';
    return;
  }
  boks.innerHTML = '';
  for (const k of state.kameraer) {
    const el = document.createElement('div');
    el.className = 'kamera-post';
    el.innerHTML = `<button class="gå">${k.navn}</button><button class="ikon" title="Slet">✕</button>`;
    el.querySelector('.gå').onclick = () => {
      Object.assign(state.kamera, { x: k.x, y: k.y, h: k.h, retning: k.retning, tilt: k.tilt });
      sætTilstand('3d');
    };
    el.querySelector('.ikon').onclick = () => {
      state.kameraer = state.kameraer.filter(x => x.id !== k.id);
      visKameraer(); tegn();
    };
    boks.appendChild(el);
  }
}

function gemReference() {
  const scene = hentScene();
  state.reference = {
    navn: new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }),
    armaturer: JSON.parse(JSON.stringify(state.armaturer)),
    skinner: JSON.parse(JSON.stringify(state.skinner)),
    inventar: JSON.parse(JSON.stringify(state.inventar)),
    tal: Tre.gulvTal(scene),
    watt: state.armaturer.reduce((a, x) => a + (FIXTURES[x.type] ? FIXTURES[x.type].w : 0), 0),
    antal: state.armaturer.length
  };
  $('#knap-vis-reference').hidden = false;
  visReferenceNote();
  toast('Reference gemt – ret nu planen og sammenlign');
}

function visReferenceNote() {
  const el = $('#reference-note');
  if (!state.reference) return;
  const nu = Tre.gulvTal(hentScene());
  const r = state.reference;
  const watt = state.armaturer.reduce((a, x) => a + (FIXTURES[x.type] ? FIXTURES[x.type].w : 0), 0);
  el.innerHTML = state.visReference
    ? `Viser referencen fra kl. ${r.navn}: ${fmt(r.tal.snit, 0)} lux og ${fmt(r.watt, 0)} W.`
    : `Mod referencen kl. ${r.navn}: ${fmt(nu.snit - r.tal.snit, 0)} lux, ${fmt(watt - r.watt, 0)} W og ${fmt(state.armaturer.length - r.antal, 0)} armaturer.`;
  $('#knap-vis-reference').textContent = state.visReference ? 'Vis den nye plan' : 'Vis reference';
}

/* Hvad tegningen indeholdt, og hvad der ikke kunne tegnes. Teksten kan
   kopieres, så den kan sendes videre når noget ikke ser rigtigt ud. */
function diagnoseTekst(lag) {
  const d = lag.diagnose || {};
  const sprunget = Object.entries(d.springOver || {}).sort((a, b) => b[1] - a[1]);
  const linjer = [
    `Fil: ${lag.navn}`,
    `Objekter i tegningen: ${fmt(d.entiteter || 0)} (${d.kilde || 'modelrum'})`,
    `Blokke: ${fmt(d.blokke || 0)}${d.xref ? ` · eksterne referencer (xref): ${d.xref}` : ''}`,
    `Tegnet: ${fmt(lag.tegning.streger.length)} streger, ${fmt(lag.tegning.tekster.length)} tekster, ${Object.keys(lag.cadLag).length} lag`,
    `Enhed: ${d.enhed === 0.001 ? 'millimeter' : d.enhed === 1 ? 'meter' : d.enhed + ' m pr. enhed'}${d.gættet ? ' (gættet – stod ikke i filen)' : ''}`,
    `Størrelse: ${fmt(lag.bredde / (state.pxPerMeter || 100), 1)} × ${fmt(lag.højde / (state.pxPerMeter || 100), 1)} m` +
      (lag.kerne ? ` (selve planen: ${fmt((lag.kerne.x1 - lag.kerne.x0) / (state.pxPerMeter || 100), 1)} × ${fmt((lag.kerne.y1 - lag.kerne.y0) / (state.pxPerMeter || 100), 1)} m)` : '')
  ];
  if (sprunget.length) {
    linjer.push('Sprunget over: ' + sprunget.map(([t, n]) => `${n} ${t}`).join(', '));
  }
  return linjer.join('\n');
}

function diagnosePanel(lag) {
  const boks = document.createElement('details');
  boks.className = 'diagnose';
  const d = lag.diagnose || {};
  const sprunget = Object.entries(d.springOver || {}).sort((a, b) => b[1] - a[1]);
  const advarsel = d.xref || (sprunget.length && sprunget.reduce((a, x) => a + x[1], 0) > lag.tegning.streger.length);
  boks.innerHTML = `
    <summary>${advarsel ? '⚠ ' : ''}Tegningsinfo</summary>
    <pre class="diagnose-tekst">${diagnoseTekst(lag).replace(/</g, '&lt;')}</pre>
    ${d.xref ? '<p class="hjælp">Tegningen henviser til eksterne filer. Bind dem ind i CAD-programmet (BIND) eller gem som DXF, ellers mangler geometrien.</p>' : ''}
    ${sprunget.length ? '<p class="hjælp">Objekter som HATCH, proxy-objekter fra AutoCAD Architecture og 3D-volumener tegnes ikke. Betyder de noget for planen, skal de eksploderes eller gemmes som DXF.</p>' : ''}
    <div class="rk lille"><button data-h="kopier">Kopiér info</button></div>`;
  boks.querySelector('[data-h="kopier"]').onclick = async () => {
    const tekst = diagnoseTekst(lag);
    try { await navigator.clipboard.writeText(tekst); toast('Tegningsinfo kopieret'); }
    catch (e) { console.log(tekst); toast('Kunne ikke kopiere – teksten står i browserens konsol', 'fejl'); }
  };
  return boks;
}

function opdater() {
  state.version++;
  const b = beregn();
  visStykliste(b);
  visNøgletal(b);
  visZoner(b);
  visInventarPanel();
  if (state.reference) visReferenceNote();
  visKrav(b);
  visLag();
  $('#status-valgt').textContent = state.valgt
    ? { skinne: 'Skinnerække valgt', armatur: 'Armatur valgt', zone: 'Zone valgt', inventar: 'Inventar valgt' }[state.valgt.slags]
    : '';
  tegn();
  return b;
}

/* ---------- automatisk belysningsplan ---------- */
/* Startgæt på lysstrømmen: næsten alt lys fra et nedadrettet armatur
   rammer gulv og inventar, så andelen sættes til 0,85. Tallet rettes
   bagefter af den punktvise beregning. */
function nødvendigLumen(areal, maalLux) {
  const i = state.indst;
  return areal > 0 ? (maalLux * areal) / (0.85 * i.mf * 1.25) : 0;
}

function generer() {
  if (!harMaalestok()) { toast('Sæt målestok først (værktøjet "Målestok")', 'fejl'); return; }
  const zoner = state.zoner.filter(z => z.type !== 'ude' && z.pts.length > 2);
  if (!zoner.length) { toast('Tegn mindst én zone – f.eks. salgsarealet – først', 'fejl'); return; }
  gem();
  state.skinner = state.skinner.filter(s => !s.auto);
  state.armaturer = state.armaturer.filter(a => !a.auto);
  let antal = 0;
  for (const zone of zoner) {
    antal += state.indst.mode === 'track' ? genererSkinner(zone) : genererPaneler(zone);
  }
  // Zonerne dimensioneres én ad gangen, så de første ikke kender lyset fra de
  // sidste. Anden runde retter antallet, nu hvor hele butikken er fyldt op.
  if (state.indst.mode === 'track' && zoner.length > 1) {
    for (const zone of zoner) antal += efterjuster(zone);
  }
  const b = opdater();
  toast(`Belysningsplan beregnet: ${antal} armaturer i ${zoner.length} zone${zoner.length > 1 ? 'r' : ''} – ${b.zonerOpfyldt} af ${b.zoner.length} opfylder lux-kravet`);
}

/* Roterer zonen så rækkerne bliver vandrette, lægger rækker med c/c-afstand
   og klipper dem mod zonens kanter. */
function rækkerIAreal(poly, cc, margin, retning) {
  const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
  const v = retning === 'auto' ? Geom.longestEdgeAngle(poly)
    : (retning === 'vandret' ? 0 : Math.PI / 2);
  const lokal = poly.map(p => Geom.rotate(p, c, -v));
  const bb = Geom.bbox(lokal);
  const ccPx = mToPx(cc), mPx = mToPx(margin);
  const linjer = [];
  const højde = bb.y1 - bb.y0 - 2 * mPx;
  if (højde <= 0) return linjer;
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
  return linjer;
}

/* Møbler i zonen, i den rækkefølge de skal have lys over sig. */
function inventarIZone(zone) {
  const medRække = { reol: 1, vaegreol: 1, koel: 1, frost: 1, frostoe: 1, betjening: 1 };
  return state.inventar.filter(i => medRække[i.type] && Geom.pointInPolygon(i.centrum, zone.pts));
}

/* Klipper et linjestykke mod zonens kant, så skinner ikke løber udenfor. */
function klipModPolygon(a, b, poly) {
  const ts = [0, 1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = poly[j], q = poly[i];
    const d1x = b[0] - a[0], d1y = b[1] - a[1];
    const d2x = q[0] - p[0], d2y = q[1] - p[1];
    const næv = d1x * d2y - d1y * d2x;
    if (Math.abs(næv) < 1e-9) continue;
    const t = ((p[0] - a[0]) * d2y - (p[1] - a[1]) * d2x) / næv;
    const u = ((p[0] - a[0]) * d1y - (p[1] - a[1]) * d1x) / næv;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const stykker = [];
  for (let k = 0; k + 1 < ts.length; k++) {
    const t0 = ts[k], t1 = ts[k + 1];
    if (t1 - t0 < 1e-6) continue;
    const m = (t0 + t1) / 2;
    const midt = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
    if (!Geom.pointInPolygon(midt, poly)) continue;
    stykker.push([
      [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
      [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]
    ]);
  }
  return stykker;
}

/* En gondolrække kan være delt i flere varegrupper. Skinnerne over dem
   ligger på linje og samles til én række, så samlinger og endestykker passer. */
function samlCollinear(linjer) {
  const grupper = new Map();
  for (const l of linjer) {
    let v = Math.atan2(l.pts[1][1] - l.pts[0][1], l.pts[1][0] - l.pts[0][0]);
    v = ((v % Math.PI) + Math.PI) % Math.PI;               // retning uden fortegn
    const c = Math.cos(v), sn = Math.sin(v);
    const tvaers = -l.pts[0][0] * sn + l.pts[0][1] * c;    // afstand fra origo på tværs
    const nøgle = Math.round(v * 40) + ':' + Math.round(tvaers / mToPx(0.25));
    let g = grupper.get(nøgle);
    if (!g) { g = { c, sn, tvaers, inventarId: l.inventarId, stykker: [] }; grupper.set(nøgle, g); }
    const u0 = l.pts[0][0] * c + l.pts[0][1] * sn;
    const u1 = l.pts[1][0] * c + l.pts[1][1] * sn;
    g.stykker.push([Math.min(u0, u1), Math.max(u0, u1)]);
  }
  const ud = [];
  for (const g of grupper.values()) {
    g.stykker.sort((a, b) => a[0] - b[0]);
    const punkt = u => [u * g.c - g.tvaers * g.sn, u * g.sn + g.tvaers * g.c];
    let [a, b] = g.stykker[0];
    const luk = () => ud.push({ pts: [punkt(a), punkt(b)], inventarId: g.inventarId });
    const spring = mToPx(state.indst.skinneSpring || 2.5);
    for (const [u0, u1] of g.stykker.slice(1)) {
      // en gondolrække er tegnet som enkeltreoler med mellemrum; skinnen går hen over dem
      if (u0 - b > spring) { luk(); a = u0; b = u1; }
      else b = Math.max(b, u1);
    }
    luk();
  }
  return ud;
}

/* Skinnerækker lagt oven på møblerne: én skinne pr. reol-, køle- eller frostrække. */
function skinnerOverInventar(zone) {
  const forlæng = mToPx(0.15);
  const linjer = [];
  for (const inv of inventarIZone(zone)) {
    const halv = mToPx(inv.laengde) / 2 + forlæng;
    const c = Math.cos(inv.vinkel), sn = Math.sin(inv.vinkel);
    const a = [inv.centrum[0] - c * halv, inv.centrum[1] - sn * halv];
    const b = [inv.centrum[0] + c * halv, inv.centrum[1] + sn * halv];
    for (const stk of klipModPolygon(a, b, zone.pts)) {
      if (pxToM(Geom.dist(stk[0], stk[1])) >= 1.2) linjer.push({ pts: stk, inventarId: inv.id });
    }
  }
  return samlCollinear(linjer);
}


function genererSkinner(zone) {
  const i = state.indst;
  const areal = Geom.polygonArea(zone.pts) / (state.pxPerMeter ** 2);
  const primær = FIXTURES[i.primaer];
  const accent = i.accent ? FIXTURES[i.accent] : null;
  const krav = zoneKrav(zone);
  const overInventar = i.følgInventar ? skinnerOverInventar(zone) : [];
  // startgæt; det rettes bagefter af den punktvise beregning på gulvet
  const førsteBud = Math.ceil(nødvendigLumen(areal, krav) / Math.max(1, primær.lm));

  const ryd = () => {
    state.skinner = state.skinner.filter(sk => !(sk.auto && sk.zoneId === zone.id));
    state.armaturer = state.armaturer.filter(a => !(a.auto && a.zoneId === zone.id));
  };

  let cc = i.ccSkinner, nye = [], længder = [], antalPrimær = 0, målt = 0, maks = 0;
  for (let forsøg = 0; forsøg < 6; forsøg++) {
    ryd();
    let linjer = overInventar.map(l => l.pts);
    const fraInventar = linjer.length;
    // resten af zonen dækkes med parallelle rækker, men ikke oven i de første
    for (const r of rækkerIAreal(zone.pts, cc, i.margin, i.retning || 'auto')) {
      const midt = [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2];
      const tætPå = linjer.slice(0, fraInventar).some(l => {
        const pr = Geom.projectOnPolyline(midt, l);
        return pr && pr.afstand < mToPx(Math.max(0.9, i.ccSkinner * 0.45));
      });
      if (!tætPå) linjer.push(r);
    }
    if (!linjer.length) {
      toast(`${zoneNavn(zone)}: for lille til c/c ${fmt(cc, 1)} m og ${fmt(i.margin, 1)} m til væg`, 'fejl');
      return 0;
    }
    nye = linjer.map((pts, idx) => {
      const sk = {
        id: nyId(), pts, montage: i.wireMontage, auto: true, zoneId: zone.id,
        overInventar: idx < overInventar.length ? overInventar[idx].inventarId : null
      };
      state.skinner.push(sk);
      return sk;
    });
    længder = nye.map(sk => pxToM(Geom.polylineLength(sk.pts)));
    const total = længder.reduce((a, b) => a + b, 0);
    maks = Math.floor(total / Math.max(0.3, i.minAfstand));
    antalPrimær = Math.max(1, Math.min(maks, førsteBud));

    // grundbelysningen lægges ud, og antallet rettes op eller ned efter
    // det beregnede lysniveau, så der hverken mangler eller spildes lys
    for (let runde = 0; runde < 5; runde++) {
      state.armaturer = state.armaturer.filter(a => !(a.auto && a.zoneId === zone.id));
      const pr = fordelAntal(antalPrimær, længder);
      nye.forEach((sk, idx) => fordelPåSkinne(sk, i.primaer, pr[idx], 0, zone.id));
      målt = Tre.zoneSnit(state, zone.pts, 0.7, 'grund').snit;
      const forHøjt = målt > krav * 1.08 && antalPrimær > 1;
      const forLavt = målt < krav * 0.99 && antalPrimær < maks;
      if (!forHøjt && !forLavt) break;
      let nyt = Math.round(antalPrimær * (krav / Math.max(1, målt)));
      if (forLavt) nyt = Math.max(nyt, antalPrimær + 1);
      if (forHøjt) nyt = Math.min(nyt, antalPrimær - 1);
      nyt = Math.max(1, Math.min(maks, nyt));
      if (nyt === antalPrimær) break;
      antalPrimær = nyt;
    }
    if (målt >= krav * 0.98 || cc <= 1.2001) break;
    // rækkerne rykkes tættere, så der er plads til mere lys
    const énRækkeMere = (cc * nye.length) / (nye.length + 1);
    cc = Math.max(1.2, Math.min(cc * Math.sqrt(Math.max(0.4, målt / krav)), énRækkeMere));
  }

  if (målt < krav * 0.98) {
    toast(`${zoneNavn(zone)}: ${fmt(krav)} lux kan ikke nås med ${kortNavn(i.primaer)} – der beregnes ${fmt(målt, 0)} lux. Vælg et kraftigere armatur eller mindre afstand.`, 'fejl');
  } else if (Math.abs(cc - i.ccSkinner) > 0.05) {
    toast(`${zoneNavn(zone)}: skinnerækkerne er rykket til c/c ${fmt(cc, 1)} m for at nå ${fmt(krav)} lux`);
  }

  // skinner uden armaturer tjener ikke noget formål
  const brugte = new Set(state.armaturer.filter(a => a.zoneId === zone.id).map(a => a.skinneId));
  const tomme = new Set(nye.filter(sk => !brugte.has(sk.id)).map(sk => sk.id));
  if (tomme.size) {
    state.skinner = state.skinner.filter(sk => !tomme.has(sk.id));
    for (let k = nye.length - 1; k >= 0; k--) if (tomme.has(nye[k].id)) { nye.splice(k, 1); længder.splice(k, 1); }
  }

  const antalAccent = accent ? Math.round(antalPrimær * i.accentRatio) : 0;
  const accentPrRække = fordelAntal(antalAccent, længder);
  nye.forEach((sk, idx) => {
    if (!accent || accentPrRække[idx] <= 0) return;
    // over et møbel sættes accentlyset i enderne, hvor endegavl og skilte sidder
    if (sk.overInventar) fordelIEnder(sk, i.accent, accentPrRække[idx], zone.id);
    else fordelPåSkinne(sk, i.accent, accentPrRække[idx], 0.5, zone.id, true);
  });
  return antalPrimær + antalAccent;
}

/* Retter antallet af armaturer i en zone, når resten af butikken er på plads.
   Skinnerne bliver liggende - kun armaturerne flyttes. */
function efterjuster(zone) {
  const i = state.indst;
  const krav = zoneKrav(zone);
  const skinner = state.skinner.filter(sk => sk.auto && sk.zoneId === zone.id);
  if (!skinner.length) return 0;
  const længder = skinner.map(sk => pxToM(Geom.polylineLength(sk.pts)));
  const total = længder.reduce((a, b) => a + b, 0);
  const maks = Math.floor(total / Math.max(0.3, i.minAfstand));
  let antal = state.armaturer.filter(a => a.auto && a.zoneId === zone.id && a.type === i.primaer).length;
  let ændring = 0;
  for (let runde = 0; runde < 3; runde++) {
    const målt = Tre.zoneSnit(state, zone.pts, 0.7, 'grund').snit;
    if (målt >= krav * 0.99 && målt <= krav * 1.08) break;
    const nyt = Math.max(1, Math.min(maks, Math.round(antal * (krav / Math.max(1, målt)))));
    if (nyt === antal) break;
    ændring += nyt - antal;
    antal = nyt;
    state.armaturer = state.armaturer.filter(a => !(a.auto && a.zoneId === zone.id));
    const pr = fordelAntal(antal, længder);
    skinner.forEach((sk, idx) => fordelPåSkinne(sk, i.primaer, pr[idx], 0, zone.id));
    const accent = i.accent ? Math.round(antal * i.accentRatio) : 0;
    const accentPr = fordelAntal(accent, længder);
    skinner.forEach((sk, idx) => {
      if (!accent || accentPr[idx] <= 0) return;
      if (sk.overInventar) fordelIEnder(sk, i.accent, accentPr[idx], zone.id);
      else fordelPåSkinne(sk, i.accent, accentPr[idx], 0.5, zone.id, true);
    });
  }
  return ændring;
}

/* Fordeler et antal armaturer på rækkerne efter længde, uden at miste
   stykker til afrunding (største rest får det overskydende). */
function fordelAntal(total, vægte) {
  const sum = vægte.reduce((a, b) => a + b, 0);
  if (!(total > 0) || !(sum > 0)) return vægte.map(() => 0);
  const eksakt = vægte.map(v => (total * v) / sum);
  const antal = eksakt.map(Math.floor);
  let rest = total - antal.reduce((a, b) => a + b, 0);
  const orden = eksakt.map((v, i) => [v - antal[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && orden.length; k++, rest--) antal[orden[k % orden.length][1]]++;
  return antal;
}

/* Accentlys ved endegavlene: først enderne, resten fordelt jævnt.
   Spottene drejes ud mod reolfronten, som byggeprogrammet lægger op til. */
function fordelIEnder(s, type, antal, zoneId) {
  const L = Geom.polylineLength(s.pts);
  const ender = [0.06, 0.94];
  for (let k = 0; k < Math.min(2, antal); k++) {
    const { punkt, vinkel } = Geom.pointAtLength(s.pts, L * ender[k]);
    state.armaturer.push({
      id: nyId(), type, x: punkt[0], y: punkt[1], vinkel, skinneId: s.id, zoneId, auto: true,
      sigte: sigteModReol(vinkel, k)
    });
  }
  if (antal > 2) fordelPåSkinne(s, type, antal - 2, 0.5, zoneId, true);
}

/* Spot drejet ca. 25 grader ud fra lodret, skiftevis til hver side. */
function sigteModReol(skinneVinkel, nr) {
  const side = nr % 2 ? 1 : -1;
  const nx = -Math.sin(skinneVinkel) * side, ny = Math.cos(skinneVinkel) * side;
  const h = Math.sin(0.44), v = -Math.cos(0.44);
  return [nx * h, ny * h, v];
}

function fordelPåSkinne(s, type, antal, forskydning, zoneId, drejet) {
  if (antal <= 0) return;
  const L = Geom.polylineLength(s.pts);
  const trin = L / antal;
  for (let k = 0; k < antal; k++) {
    const d = trin * (k + 0.5 + forskydning * 0.5);
    if (d > L) continue;
    const { punkt, vinkel } = Geom.pointAtLength(s.pts, d);
    const post = { id: nyId(), type, x: punkt[0], y: punkt[1], vinkel, skinneId: s.id, zoneId, auto: true };
    if (drejet) post.sigte = sigteModReol(vinkel, k);
    state.armaturer.push(post);
  }
}

function genererPaneler(zone) {
  const i = state.indst;
  const areal = Geom.polygonArea(zone.pts) / (state.pxPerMeter ** 2);
  const f = FIXTURES[i.primaer];
  const krav = zoneKrav(zone);
  if (!i.autoTaethed) return læggUdNet(zone, i.ccX, i.ccY);

  // Lux-kravet styrer tætheden: nettet strammes, til den beregnede
  // belysningsstyrke på gulvet er i hus.
  const behov = Math.max(1, Math.ceil(nødvendigLumen(areal, krav) / Math.max(1, f.lm)));
  let cc = Math.max(0.6, Math.sqrt(areal / behov));
  let n = 0, målt = 0;
  for (let forsøg = 0; forsøg < 5; forsøg++) {
    state.armaturer = state.armaturer.filter(a => !(a.auto && a.zoneId === zone.id));
    n = læggUdNet(zone, cc, cc);
    if (!n) break;
    målt = Tre.zoneSnit(state, zone.pts, 0.7, 'grund').snit;
    if (målt >= krav * 0.99 || cc <= 0.6001) break;
    cc = Math.max(0.6, cc * Math.sqrt(Math.max(0.4, målt / krav)));
  }
  if (n && målt < krav * 0.98) {
    toast(`${zoneNavn(zone)}: ${fmt(krav)} lux kan ikke nås med ${kortNavn(i.primaer)} – der beregnes ${fmt(målt, 0)} lux`, 'fejl');
  }
  return n;
}

function læggUdNet(zone, ccX, ccY) {
  const i = state.indst;
  const poly = zone.pts;
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
      state.armaturer.push({ id: nyId(), type: i.primaer, x: p[0], y: p[1], vinkel: v, skinneId: null, zoneId: zone.id, auto: true });
      n++;
    }
  }
  if (!n) toast(`${zoneNavn(zone)}: ingen armaturer kunne placeres – prøv mindre c/c eller margin`, 'fejl');
  return n;
}

/* ---------- kør det hele ---------- */

/* Ét tryk: find zoner og inventar, læg lysplanen ud, regn den efter og
   gør 3D-kigget klar. Hvert skridt melder undervejs, så man kan følge med. */
async function køralt() {
  const knap = $('#knap-alt');
  if (knap.disabled) return;
  if (!state.lag.length) {
    toast('Importér en tegning først – DWG, DXF, PDF eller et billede', 'fejl');
    return;
  }
  if (!harMaalestok()) {
    toast('Målestokken mangler. Mål en kendt længde med målestoksværktøjet (M), og prøv igen.', 'fejl');
    vælgVærktøj('maalestok');
    return;
  }
  knap.disabled = true;
  const gammelTekst = knap.textContent;
  knap.textContent = 'Arbejder …';
  const trin = [];
  const vent = () => new Promise(r => setTimeout(r, 30));
  try {
    sætTilstand('plan');

    if (!state.inventar.length) {
      toast('Finder inventar på tegningen …', 'arbejder');
      await vent();
      const n = findInventar(true);
      trin.push(n ? `${n} møbler genkendt` : 'intet inventar fundet på tegningen');
    } else {
      trin.push(`${state.inventar.length} møbler var allerede fundet`);
    }

    if (!state.zoner.length) {
      toast('Finder zoner på tegningen …', 'arbejder');
      await vent();
      const n = findZonerITegning(true);
      trin.push(n ? `${n} zoner læst af tegningen` : 'ingen zoner fundet');
    } else {
      trin.push(`${state.zoner.length} zoner var allerede tegnet`);
    }

    if (!state.zoner.length) {
      toast('Jeg kunne ikke finde et salgsareal på tegningen. Tegn det med arealværktøjet (A), og tryk igen.', 'fejl');
      vælgVærktøj('omraade');
      return;
    }

    toast('Lægger skinner og armaturer ud …', 'arbejder');
    await vent();
    generer();
    trin.push(`${state.armaturer.length} armaturer på ${state.skinner.length} skinnerækker`);

    toast('Regner lysniveauet efter …', 'arbejder');
    await vent();
    const b = opdater();
    hentScene();
    if (!state.kameraer.length) placerStartkamera();
    trin.push(`${b.zonerOpfyldt} af ${b.zoner.length} zoner opfylder lux-kravet`);

    visResultat(b, trin);
    $('.panel-faneblad[data-faneblad="beregn"]').click();
    toast('Lysplanen er klar', 'info');
  } catch (e) {
    console.error(e);
    toast('Der gik noget galt undervejs: ' + (e && e.message ? e.message : e), 'fejl');
  } finally {
    knap.disabled = false;
    knap.textContent = gammelTekst;
  }
}

/* Resultatkortet: hvad der blev gjort, nøgletallene og vejen videre. */
function visResultat(b, trin) {
  const kort = $('#resultat');
  const krav = kravTjek(b);
  const problemer = krav.filter(p => p.status === 'fejl' || p.status === 'advarsel');
  const linje = (navn, værdi) => `<div class="linje"><span>${navn}</span><span>${værdi}</span></div>`;
  $('#resultat-titel').textContent = problemer.length
    ? `Lysplan klar – ${problemer.length} ting at se på`
    : 'Lysplan klar – alle krav opfyldt';
  $('#resultat-krop').innerHTML =
    `<p class="trin">${trin.map(t => `<b>·</b> ${t}`).join('<br>')}</p>` +
    b.zoner.filter(z => z.areal).map(z =>
      linje(`${z.navn} (${fmt(z.areal, 0)} m²)`,
        `${fmt(z.lux, 0)} / ${fmt(z.krav)} lux`)).join('') +
    linje('Effekt', `${fmt(b.watt, 0)} W · ${fmt(b.wattPrM2, 1)} W/m²`) +
    linje('Skinner', `${fmt(b.skinne.laengde, 0)} m i ${b.skinne.raekker} rækker`) +
    linje('3-polede grupper', fmt(b.grupper)) +
    (problemer.length
      ? `<ul class="advarsel-liste">${problemer.slice(0, 4).map(p =>
        `<li><span class="prik ${p.status}"></span><span><b>${p.emne}:</b> ${p.tekst.slice(0, 150)}</span></li>`).join('')}</ul>`
      : '');
  kort.hidden = false;
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
  linjer.push(['Zone', 'Areal m2', 'Krav lux', 'Beregnet lux', 'Heraf grundbelysning', 'Armaturer', 'W/m2']);
  for (const z of b.zoner) {
    linjer.push([z.navn, fmt(z.areal, 1), fmt(z.krav), fmt(z.lux, 0), fmt(z.luxGrund, 0), String(z.stk), fmt(z.wattPrM2, 2)]);
  }
  linjer.push([]);
  linjer.push(['Areal i alt', fmt(b.areal, 1) + ' m2']);
  linjer.push(['Skinne i alt', fmt(b.skinne.laengde, 1) + ' m']);
  linjer.push(['Installeret effekt', fmt(b.watt, 0) + ' W', fmt(b.wattPrM2, 2) + ' W/m2']);
  linjer.push(['Lysstrøm', fmt(b.lumen, 0) + ' lm', fmt(b.lumenPrM2, 0) + ' lm/m2']);
  linjer.push(['Beregningsforudsætning', `LLMF ${state.indst.mf} / refleksioner ${Math.round(state.indst.refleksLoft*100)}-${Math.round(state.indst.refleksVaeg*100)}-${Math.round(state.indst.refleksGulv*100)} %`, 'punktberegning med interrefleksion']);
  linjer.push(['3-polede grupper', String(b.grupper)]);
  const inv = Inventar.stykliste(state.inventar, state.indst.fagbredde);
  if (inv.grupper.length) {
    linjer.push([]);
    linjer.push(['Inventar', 'Antal', 'Meter', 'Fag']);
    for (const g of inv.grupper) {
      linjer.push([g.navn, String(g.antal), fmt(g.meter, 1), g.fag ? String(g.fag) : '']);
      for (const [navn, v] of Object.entries(g.varegrupper).sort((a, b) => b[1].meter - a[1].meter)) {
        linjer.push(['   ' + navn, String(v.antal), fmt(v.meter, 1), v.fag ? String(v.fag) : '']);
      }
    }
    linjer.push(['Reol i alt', '', fmt(inv.meterReol, 1) + ' m', String(inv.fagIAlt) + ' fag']);
    linjer.push(['Køl i alt', '', fmt(inv.meterKoel, 1) + ' m']);
    linjer.push(['Frost i alt', '', fmt(inv.meterFrost, 1) + ' m']);
  }
  linjer.push([]);
  linjer.push(['Kontrol mod ' + KRAV.kilde]);
  for (const p of kravTjek(b)) linjer.push([p.status.toUpperCase(), p.emne, p.tekst]);
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
  for (const z of state.zoner) for (const p of z.pts) tag(p[0], p[1]);
  for (const i of state.inventar) for (const p of i.hjørner) tag(p[0], p[1]);
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
  const zoneRækker = b.zoner.map(z => `
    <tr><td style="text-align:left">${z.navn}</td><td>${fmt(z.areal, 0)}</td><td>${fmt(z.krav)}</td>
        <td>${fmt(z.lux, 0)}</td><td>${fmt(z.luxGrund, 0)}</td><td>${z.stk}</td><td>${fmt(z.wattPrM2, 1)}</td></tr>`).join('');
  const inv = Inventar.stykliste(state.inventar, state.indst.fagbredde);
  const invRækker = inv.grupper.map(g => `
    <tr><td style="text-align:left"><strong>${g.navn}</strong></td><td>${g.antal}</td><td>${fmt(g.meter, 1)}</td><td>${g.fag || ''}</td></tr>` +
    Object.entries(g.varegrupper).sort((a, c) => c[1].meter - a[1].meter).map(([navn, v]) => `
    <tr><td style="text-align:left;padding-left:16px;color:#555">${navn}</td><td>${v.antal}</td><td>${fmt(v.meter, 1)}</td><td>${v.fag || ''}</td></tr>`).join('')).join('');
  const kravRækker = kravTjek(b).map(p =>
    `<tr><td style="text-align:left">${{ ok: 'OK', advarsel: 'OBS', fejl: 'AFVIGER', info: 'NOTE' }[p.status]}</td>
         <td style="text-align:left">${p.emne}</td><td style="text-align:left">${p.tekst}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) { toast('Tillad pop op-vinduer for at udskrive', 'fejl'); return; }
  w.document.write(`<!doctype html><html lang="da"><head><meta charset="utf-8">
    <title>${p.navn || 'Lysplan'} – lysplan</title>
    <style>
      body{font:12px/1.45 "Helvetica Neue",Arial,sans-serif;margin:16mm;color:#111}
      h1{font-size:18px;margin:0 0 2px} h2{font-size:13px;margin:16px 0 4px} .meta{color:#555;margin-bottom:12px}
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
    <h2>Zoner og beregnet lysniveau</h2>
    <table><thead><tr><th style="text-align:left">Zone</th><th>Areal m²</th><th>Krav lux</th><th>Beregnet lux</th><th>Heraf grundbelysning</th><th>Armaturer</th><th>W/m²</th></tr></thead><tbody>${zoneRækker}</tbody></table>
    <h2>Stykliste</h2>
    <table><thead><tr><th>Antal</th><th>Beskrivelse</th><th>Lyskilde</th><th>Farve</th></tr></thead><tbody>${rækker}</tbody></table>
    ${invRækker ? `<h2>Inventar</h2>
    <table><thead><tr><th style="text-align:left">Type og varegruppe</th><th>Antal</th><th>Meter</th><th>Fag</th></tr></thead><tbody>${invRækker}</tbody></table>
    <p style="font-size:11px;margin:4px 0 0">Reol ${fmt(inv.meterReol, 1)} m (${inv.fagIAlt} fag) · køl ${fmt(inv.meterKoel, 1)} m · frost ${fmt(inv.meterFrost, 1)} m.</p>` : ''}
    <h2>Kontrol mod ${KRAV.kilde}</h2>
    <table><thead><tr><th style="text-align:left">Status</th><th style="text-align:left">Emne</th><th style="text-align:left">Bemærkning</th></tr></thead><tbody>${kravRækker}</tbody></table>
    <div class="noter">Areal i alt ${fmt(b.areal, 0)} kvm.
Installeret effekt ${fmt(b.watt, 0)} W (${fmt(b.wattPrM2, 1)} W/m²) · lysstrøm ${fmt(b.lumenPrM2, 0)} lm/m².
Lux er beregnet punkt for punkt på gulvet ud fra armaturernes placering med LLMF ${state.indst.mf} og refleksioner ${Math.round(state.indst.refleksLoft*100)}/${Math.round(state.indst.refleksVaeg*100)}/${Math.round(state.indst.refleksGulv*100)} %, og erstatter ikke lysberegning og måling i butikken. Lux måles på gulv (${KRAV.maalehoejde}) med ±${Math.round(KRAV.tolerance * 100)} % tolerance.
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
    zoner: state.zoner,
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
  state.inventar = d.inventar || [];
  state.kameraer = d.kameraer || [];
  visKameraer();
  state.zoner = d.zoner || (d.omraade && d.omraade.length > 2
    ? [{ id: nyId(), type: 'salg', pts: d.omraade, navn: ZONETYPER.salg.navn, maalLux: ZONETYPER.salg.lux }]
    : []);
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
      if (n === 'lofttype') {
        const loft = LOFTTYPER[el.value];
        if (loft) {
          Object.assign(state.indst, { mode: loft.mode, primaer: loft.grund, accent: loft.accent });
          visIndstillinger();
        }
      }
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
  $('#knap-alt').onclick = køralt;
  const resultat = $('#resultat');
  resultat.querySelector('[data-h="luk"]').onclick = () => { resultat.hidden = true; };
  resultat.querySelector('[data-h="tre"]').onclick = () => { resultat.hidden = true; sætTilstand('3d'); };
  resultat.querySelector('[data-h="krav"]').onclick = () => {
    resultat.hidden = true;
    $('.panel-faneblad[data-faneblad="krav"]').click();
  };
  resultat.querySelector('[data-h="csv"]').onclick = eksporterCsv;
  resultat.querySelector('[data-h="print"]').onclick = udskriv;
  $('#knap-plan').onclick = () => sætTilstand('plan');
  $('#knap-3d').onclick = () => sætTilstand('3d');
  $('#knap-reference').onclick = gemReference;
  $('#knap-vis-reference').onclick = () => {
    state.visReference = !state.visReference;
    visReferenceNote();
    tegn();
  };
  $('#knap-generer').onclick = generer;
  $('#knap-inventar').onclick = () => findInventar(false);
  $('#knap-zoner').onclick = () => findZonerITegning(false);
  $('#knap-inventar-ryd').onclick = () => {
    if (!state.inventar.length) return;
    gem(); state.inventar = []; opdater();
  };
  $('#knap-tilpas').onclick = tilpasVisning;
  $('#knap-fortryd').onclick = fortryd;
  $('#knap-csv').onclick = eksporterCsv;
  $('#knap-png').onclick = eksporterPng;
  $('#knap-print').onclick = udskriv;
  $('#knap-gem').onclick = gemProjekt;
  $('#knap-ryd').onclick = () => {
    if (!confirm('Slet alle zoner, skinner og armaturer? Tegningerne beholdes.')) return;
    gem();
    state.skinner = []; state.armaturer = []; state.zoner = []; state.valgt = null;
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
  visKameraer();
  bindIndstillinger();
  bindKnapper();
  visIndstillinger();
  vælgVærktøj('pan');
  tilpasStørrelse();
  opdater();
  window.addEventListener('resize', tilpasStørrelse);
}

document.addEventListener('DOMContentLoaded', start);
