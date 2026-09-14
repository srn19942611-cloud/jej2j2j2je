/* Coop Energi- & Driftshub
 *
 * Kæden i fire lag, som den er beskrevet i "Agenter til drift og vedligehold":
 *   1 · detektorer finder symptomer i tidsserier          → src/engine.js
 *   2 · sagsbyggeren samler signaler til én sag pr. fejl   → src/engine.js
 *   3 · anbefalingen til den fagansvarlige                 → src/views/sager.js
 *   4 · beslutning og læring                               → src/state.js
 *
 * Agenterne taler sammen gennem data, ikke gennem samtale: detektorerne
 * lægger signaler, sagsbyggeren læser dem alle. Det kan køres igen med samme
 * resultat, det kan revideres, og en fejlet detektor stopper ikke de andre.
 */

import { h } from './ui.js';
import { state, abonner, indlaesData, skriv, opdater } from './state.js';
import { overblik } from './views/overblik.js';
import { sager } from './views/sager.js';
import { butikker } from './views/butikker.js';
import { detektorer, fagbog } from './views/detektorer.js';
import { opsaetning } from './views/opsaetning.js';

const SIDER = [
  { id: 'overblik',   navn: 'Overblik',   tegn: overblik },
  { id: 'sager',      navn: 'Sager',      tegn: sager },
  { id: 'butikker',   navn: 'Butikker',   tegn: butikker },
  { id: 'detektorer', navn: 'Detektorer', tegn: detektorer },
  { id: 'fagbog',     navn: 'Fagbogen',   tegn: fagbog },
  { id: 'opsaetning', navn: 'Opsætning',  tegn: opsaetning },
];

let nuvaerende = 'overblik';
let argumenter = {};

function gaaTil(id, args = {}) {
  nuvaerende = id;
  argumenter = args;
  location.hash = id + (args.sag ? `/${encodeURIComponent(args.sag)}` : '');
  tegn();
}

function fraHash() {
  const [id, arg] = location.hash.replace(/^#/, '').split('/');
  if (SIDER.some((s) => s.id === id)) {
    nuvaerende = id;
    argumenter = arg ? { sag: decodeURIComponent(arg) } : {};
  }
}

function tegnNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(...SIDER.map((s) => {
    const antal = s.id === 'sager' ? state.sager.filter((x) => x.status === 'ny' || x.status === 'vurderet').length : null;
    const b = h('button', { onclick: () => gaaTil(s.id) }, s.navn,
      antal ? h('span', { class: 'badge solid', style: { marginLeft: '6px' } }, String(antal)) : null);
    if (s.id === nuvaerende) b.setAttribute('aria-current', 'page');
    return b;
  }));
}

function tegnForbindelse() {
  const boks = document.getElementById('conn');
  const kilde = state.data ? state.data.kilde : '…';
  const prik = (c) => h('span', { class: `dot ${c.status === 'forbundet' ? 'live' : c.status === 'fejl' ? 'err' : 'off'}`, title: c.error || c.status });
  boks.replaceChildren(
    prik(state.klienter.enity), h('span', {}, 'Enity'),
    prik(state.klienter.dalux), h('span', {}, 'Dalux'),
    h('span', { class: 'badge', title: kilde === 'live' ? 'Live fra Enity' : 'Seedet udtræk — slå live til under Opsætning' },
      kilde === 'live' ? 'live' : 'udtræk'),
  );
}

function tegn() {
  tegnNav();
  tegnForbindelse();
  const side = SIDER.find((s) => s.id === nuvaerende) || SIDER[0];
  const vis = document.getElementById('view');
  vis.replaceChildren(side.tegn(gaaTil, argumenter));
  window.scrollTo({ top: 0 });

  const n = state.sager.length;
  document.getElementById('foot-status').textContent =
    `${n} sager bygget af ${state.sager.reduce((s, x) => s + x.signaler.length, 0)} signaler · `
    + `data: ${state.data ? (state.data.kilde === 'live' ? 'live fra Enity' : `udtræk fra ${state.data.hentet}`) : 'indlæser'} · `
    + 'beslutninger gemmes lokalt i denne browser';
}

window.addEventListener('hashchange', () => { fraHash(); tegn(); });
abonner(tegn);

fraHash();
tegn();

indlaesData().then(() => {
  skriv(`${state.sager.length} sager bygget ud fra ${state.data.butikker.length} butikker.`, 'ok');
  opdater();
});
