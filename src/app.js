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
import { state, abonner, indlaesData, skriv, opdater, gem, koerAgenten } from './state.js';
import { planlaegNatligKoersel, byggHenter, koerSynkronisering, opsummer } from './sync.js';
import { overblik } from './views/overblik.js';
import { mitOmraade } from './views/mitomraade.js';
import { sager } from './views/sager.js';
import { butikker } from './views/butikker.js';
import { anlaeg } from './views/anlaeg.js';
import { gentagne } from './views/gentagne.js';
import { solceller } from './views/solceller.js';
import { motor } from './views/motor.js';
import { anlaegsanalyse } from './views/anlaegsanalyse.js';
import { detektorer, fagbog } from './views/detektorer.js';
import { agentside } from './views/agent.js';
import { opsaetning } from './views/opsaetning.js';

const SIDER = [
  { id: 'overblik',   navn: 'Overblik',   tegn: overblik },
  { id: 'mitomraade', navn: 'Mit område', tegn: mitOmraade },
  { id: 'agent',      navn: 'Agenten',    tegn: agentside },
  { id: 'sager',      navn: 'Sager',      tegn: sager },
  { id: 'butikker',   navn: 'Butikker',   tegn: butikker },
  { id: 'anlaeg',     navn: 'Anlæg',      tegn: anlaeg },
  { id: 'gentagne',   navn: 'Gentagne fejl', tegn: gentagne },
  { id: 'solceller',  navn: 'Solceller',  tegn: solceller },
  { id: 'analyse',    navn: 'Anlægsanalyse', tegn: anlaegsanalyse },
  { id: 'motor',      navn: 'Motor',      tegn: motor },
  { id: 'detektorer', navn: 'Detektorer', tegn: detektorer },
  { id: 'fagbog',     navn: 'Fagbogen',   tegn: fagbog },
  { id: 'opsaetning', navn: 'Opsætning',  tegn: opsaetning },
];

let nuvaerende = 'overblik';
let argumenter = {};

function gaaTil(id, args = {}) {
  nuvaerende = id;
  argumenter = args;
  const arg = args.sag || args.person;
  location.hash = id + (arg ? `/${encodeURIComponent(arg)}` : '');
  tegn();
}

function fraHash() {
  const [id, arg] = location.hash.replace(/^#/, '').split('/');
  if (SIDER.some((s) => s.id === id)) {
    nuvaerende = id;
    argumenter = arg ? { sag: decodeURIComponent(arg), person: decodeURIComponent(arg) } : {};
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
  armNatligKoersel();
  // Agenten kører efter dataene er inde — den skal bruge koblingen.
  return koerAgenten().catch((f) => skriv(`Agenten kunne ikke køre: ${f.message}`, 'fejl'));
});

/* Den natlige kørsel armes kun, hvis brugeren har slået den til. Timeren er
 * en bekvemmelighed — en browserfane kan være lukket kl. 03, og den rigtige
 * kørsel sker fra sync/run.mjs. Se README. */
export function armNatligKoersel() {
  if (state.planlaegger) { state.planlaegger.stop(); state.planlaegger = null; }
  if (!state.cfg.autoSync) return;
  state.planlaegger = planlaegNatligKoersel(
    byggHenter({
      klienter: state.klienter,
      sol: null,
      gem: async (n, v) => { (state.raadata ||= {})[n] = v; return v; },
      vandmaerker: state.vandmaerker || {},
    }),
    {
      tidspunkt: state.cfg.syncTidspunkt,
      onKoersel: (k) => {
        state.sidsteKoersel = k;
        state.vandmaerker = { ...(state.vandmaerker || {}), ...k.vandmaerker };
        skriv(`Natlig synkronisering: ${opsummer(k)}`, k.status === 'ok' ? 'ok' : 'fejl');
        gem(); opdater();
      },
    });
  skriv(`Natlig kørsel armet — næste ${state.planlaegger.naeste().toLocaleString('da-DK')}.`);
}
