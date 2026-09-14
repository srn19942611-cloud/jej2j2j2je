/* Små byggesten til grænsefladen. Ingen ramme, ingen afhængigheder. */

export function h(tag, attrs = {}, ...børn) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const b of børn.flat(3)) {
    if (b == null || b === false) continue;
    el.append(b instanceof Node ? b : document.createTextNode(String(b)));
  }
  return el;
}

export const tom = (tekst) => h('div', { class: 'empty' }, tekst);

export function badge(tekst, klasse = '') {
  return h('span', { class: `badge ${klasse}`.trim() }, tekst);
}

export function prioritetBadge(p) {
  return badge(p, p.toLowerCase());
}

export function swatch(farve) {
  return h('span', { class: 'swatch', style: { background: farve } });
}

export function kpi(label, vaerdi, note) {
  return h('div', { class: 'card kpi' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, vaerdi),
    note ? h('div', { class: 'kpi-note' }, note) : null);
}

export function tabel(kolonner, raekker, { onRow } = {}) {
  const thead = h('thead', {}, h('tr', {}, kolonner.map((k) =>
    h('th', { class: k.r ? 'r' : '' }, k.navn))));
  const tbody = h('tbody', {}, raekker.map((r) => {
    const tr = h('tr', { class: onRow ? 'clickable' : '' },
      kolonner.map((k) => {
        const v = k.celle(r);
        return h('td', { class: [k.r ? 'r' : '', k.wrap ? 'wrap' : ''].filter(Boolean).join(' ') },
          v instanceof Node ? v : (v == null ? '—' : String(v)));
      }));
    if (onRow) tr.addEventListener('click', () => onRow(r));
    return tr;
  }));
  return h('div', { class: 'tablewrap' }, h('table', {}, thead, tbody));
}

/** Vandret stablet søjle — bruges til fordeling på faggrupper. */
export function stack(dele, total) {
  const bar = h('div', { class: 'stack' });
  for (const d of dele) {
    if (!d.vaerdi) continue;
    const pct = 100 * d.vaerdi / total;
    if (pct < 0.4) continue;
    bar.append(h('span', {
      style: { width: pct + '%', background: d.farve },
      title: `${d.navn}: ${Math.round(pct)} %`,
    }));
  }
  return bar;
}

export function legend(dele, total, fmt = (v) => v) {
  return h('div', { class: 'legend' }, dele.filter((d) => d.vaerdi).map((d) =>
    h('span', {}, swatch(d.farve), `${d.navn} · ${fmt(d.vaerdi)}`,
      total ? h('span', { class: 'muted' }, ` (${Math.round(100 * d.vaerdi / total)} %)`) : null)));
}

/** Døgnprofil som søjlediagram. Lukketimerne er markeret. */
export function doegnprofil(timer, { lukket = [22, 23, 0, 1, 2, 3, 4, 5], farve = '#1f6feb' } = {}) {
  const B = 24, W = 640, H = 170, pad = { t: 8, r: 8, b: 20, l: 34 };
  const maks = Math.max(...timer) * 1.1;
  const bw = (W - pad.l - pad.r) / B;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  const ns = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };

  for (let i = 0; i <= 3; i++) {
    const y = pad.t + (H - pad.t - pad.b) * i / 3;
    svg.append(mk('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'gridline' }));
    const lbl = mk('text', { x: 4, y: y + 3, class: 'lbl' });
    lbl.textContent = Math.round(maks * (1 - i / 3));
    svg.append(lbl);
  }
  timer.forEach((v, i) => {
    const hgt = (H - pad.t - pad.b) * v / maks;
    svg.append(mk('rect', {
      x: pad.l + i * bw + 1, y: H - pad.b - hgt, width: bw - 2, height: Math.max(hgt, 0.5),
      fill: lukket.includes(i) ? farve : farve, opacity: lukket.includes(i) ? 1 : 0.38, rx: 1.5,
    }));
    if (i % 3 === 0) {
      const t = mk('text', { x: pad.l + i * bw + bw / 2, y: H - 6, class: 'lbl', 'text-anchor': 'middle' });
      t.textContent = String(i).padStart(2, '0');
      svg.append(t);
    }
  });
  return svg;
}

/* ---- Modal ---- */
let luk = null;
export function modal({ titel, krop, knapper = [], bredde }) {
  lukModal();
  const m = h('div', { class: 'modal', style: bredde ? { width: `min(${bredde}px, 100%)` } : null },
    h('header', {}, h('strong', {}, titel), h('button', { class: 'btn', onclick: lukModal }, 'Luk')),
    h('div', { class: 'body' }, krop),
    knapper.length ? h('footer', {}, knapper) : null);
  const bd = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === bd) lukModal(); } }, m);
  document.getElementById('modal-root').append(bd);
  const esc = (e) => { if (e.key === 'Escape') lukModal(); };
  document.addEventListener('keydown', esc);
  luk = () => { bd.remove(); document.removeEventListener('keydown', esc); luk = null; };
  return { luk: lukModal };
}
export function lukModal() { if (luk) luk(); }

export function felt(label, kontrol, hjaelp) {
  return h('div', { class: 'field' },
    h('label', {}, label), kontrol,
    hjaelp ? h('small', { class: 'muted' }, hjaelp) : null);
}

export function vaelger(muligheder, { vaerdi, tom: tomTekst } = {}) {
  const s = h('select', {});
  if (tomTekst) s.append(h('option', { value: '' }, tomTekst));
  for (const m of muligheder) {
    const o = h('option', { value: m.vaerdi }, m.navn);
    if (String(m.vaerdi) === String(vaerdi)) o.selected = true;
    s.append(o);
  }
  return s;
}

export const dkTal = (n) => (n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('da-DK'));
export const dkKr  = (n) => (n == null ? '—' : dkTal(n) + ' kr.');
export const pct   = (n) => (n == null ? '—' : Math.round(n) + ' %');
