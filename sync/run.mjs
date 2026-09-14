#!/usr/bin/env node
/* Natlig synkronisering — indgangen til cron og scheduled workflows.
 *
 * En browserfane er ikke en pålidelig cron: den kan være lukket kl. 03. Det
 * her script kører den samme kode fra Node, så den rigtige kørsel sker et
 * sted, der er tændt.
 *
 *   node sync/run.mjs                        kør alle trin
 *   node sync/run.mjs --kun dalux,enity      kør kun de kilder
 *   node sync/run.mjs --toer                 vis planen uden at hente noget
 *   node sync/run.mjs --ud data/             skriv resultatet som JSON
 *
 * Cron (kl. 03.15 hver nat, dansk tid):
 *   15 3 * * *  cd /sti/til/hubben && /usr/bin/node sync/run.mjs --ud data/ >> sync.log 2>&1
 *
 * GitHub Actions: se .github/workflows/natlig-sync.yml
 *
 * Afslutningskoder: 0 = alt kørte, 1 = delvis, 2 = intet kunne hentes.
 * En delvis kørsel er med vilje ikke en fejl — én leverandørs API, der er
 * nede kl. 03, skal ikke få hele kørslen til at ligne et nedbrud.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { McpClient, DEFAULTS } from '../src/mcp.js';
import { koerSynkronisering, byggHenter, TRIN, opsummer } from '../src/sync.js';
import { byggAnlaegsindeks, koerMotor } from '../src/motor.js';

const argv = process.argv.slice(2);
const flag = (navn, standard = null) => {
  const i = argv.indexOf(`--${navn}`);
  return i === -1 ? standard : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};

const kun = flag('kun') ? String(flag('kun')).split(',').map((s) => s.trim()) : null;
const toer = !!flag('toer');
const udMappe = flag('ud');

const env = process.env;
const klienter = {
  enity: new McpClient('Enity', env.ENITY_MCP_URL || DEFAULTS.enity, { proxy: env.MCP_PROXY || '' }),
  dalux: new McpClient('Dalux', env.DALUX_MCP_URL || DEFAULTS.dalux, { proxy: env.MCP_PROXY || '' }),
};

/* Solcelleplatformen har ingen MCP-server. Indtil den får en, hentes den
 * gennem sin egen HTTP-API, hvis URL og nøgle er sat. Uden dem springes
 * solcelletrinnene over med en forklaring frem for en tavs mangel. */
const sol = env.SOL_API_URL ? {
  async hent(trinId, { siden }) {
    const sti = { 'sol-anlaeg': 'plants', 'sol-produktion': 'production', 'sol-alarmer': 'alarms' }[trinId];
    const url = new URL(sti, env.SOL_API_URL.replace(/\/?$/, '/'));
    if (siden) url.searchParams.set('since', siden);
    const res = await fetch(url, { headers: env.SOL_API_KEY ? { apikey: env.SOL_API_KEY } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status} fra solcelleplatformen`);
    return res.json();
  },
} : null;

/* Mellemlager. Cron-kørslen skriver til disk; en rigtig installation ville
 * skrive til den database, "Agenter til drift og vedligehold" beskriver. */
const lager = new Map();
const gem = async (noegle, vaerdi) => {
  if (vaerdi === undefined) return lager.get(noegle);
  lager.set(noegle, vaerdi);
  return vaerdi;
};

function log(k) {
  const sidste = TRIN.map((t) => k.trin[t.id]).filter((t) => t.status !== 'afventer').pop();
  if (!sidste) return;
  const id = TRIN.find((t) => k.trin[t.id] === sidste)?.id ?? '';
  const mærke = { ok: '·', fejl: '✕', 'sprunget over': '–', kører: '…' }[sidste.status] ?? ' ';
  if (sidste.status === 'kører') return;
  process.stdout.write(
    `${mærke} ${id.padEnd(18)} ${String(sidste.status).padEnd(14)}`
    + `${String(sidste.raekker || '').padStart(7)} rækker${sidste.forsoeg > 1 ? ` (${sidste.forsoeg} forsøg)` : ''}`
    + `${sidste.fejl ? `  ← ${sidste.fejl.slice(0, 80)}` : ''}\n`);
}

const relevant = (trin) => !kun || kun.includes(trin.kilde) || trin.slags === 'beregning';

if (toer) {
  console.log('Planlagte trin:\n');
  for (const t of TRIN) console.log(`  ${relevant(t) ? '•' : '–'} ${t.id.padEnd(18)} ${t.navn.padEnd(30)} ${t.beskrivelse}`);
  console.log(`\nEnity: ${klienter.enity.url}\nDalux: ${klienter.dalux.url}\nSol:   ${env.SOL_API_URL || 'ikke konfigureret'}`);
  process.exit(0);
}

console.log(`Natlig synkronisering — ${new Date().toLocaleString('da-DK')}\n`);

/* Beregningstrinnene kører her i Node på præcis samme kode som i browseren.
 * Detektorerne hører til hubbens tilstand og køres derfor først, når data
 * læses ind — cron-kørslens opgave er at have dem klar. */
const beregn = {
  async motor() {
    const anlaeg = await gem('daluxAnlaeg');
    const opgaver = await gem('daluxOpgaver');
    if (!Array.isArray(anlaeg) || !Array.isArray(opgaver)) {
      const f = new Error('Springer over: anlæg eller opgaver blev ikke hentet.');
      f.springOver = true; throw f;
    }
    const indeks = byggAnlaegsindeks(anlaeg);
    const k = koerMotor(opgaver.map((o) => ({
      id: o.workOrderId ?? o.id,
      kardex: o.kardex ?? null,
      building: o.building ?? o.buildingName ?? null,
      taskName: o.subject ?? o.taskName ?? o.name ?? null,
      description: o.description ?? null,
      workDescription: o.workDescription ?? null,
      asset: o.asset ?? o.assetName ?? null,
      taskTemplate: o.template ?? null,
      team: o.team ?? null,
      supplier: o.supplier ?? o.company ?? null,
    })), indeks);
    await gem('motorResultat', { optaelling: k.optaelling, trin: k.trin, uafklaretPct: k.uafklaretPct, anlaegPct: k.anlaegPct });
    await gem('motorFund', k.resultater);
    console.log(`  motoren: anlæg fundet i ${k.anlaegPct} %, ${k.uafklaretPct} % til gennemgang`);
    return { behandlede: k.optaelling.total };
  },
  async detektorer() {
    // Detektorerne kører i hubben, når den læser data ind. Cron-kørslens
    // opgave er at lægge data klar — ikke at duplikere sagsbyggeren her.
    const f = new Error('Kører i hubben, når data læses ind.');
    f.springOver = true; throw f;
  },
};

const henter = byggHenter({ klienter, sol, gem, beregn });
const udfoer = async (trin, koersel) => {
  if (!relevant(trin)) {
    koersel.trin[trin.id].status = 'sprunget over';
    return { raekker: 0 };
  }
  return henter(trin, koersel);
};

const koersel = await koerSynkronisering(udfoer, { udloest: 'natlig', onOpdatering: log });

console.log(`\n${opsummer(koersel)}`);
if (koersel.fejl.length) {
  console.log('\nFejl:');
  for (const f of koersel.fejl) console.log(`  ${f.trin}: ${f.besked}${f.gentagelig ? ' (forsøgt igen)' : ''}`);
}

if (udMappe) {
  await mkdir(udMappe, { recursive: true });
  await writeFile(join(udMappe, 'sidste-koersel.json'), JSON.stringify(koersel, null, 2));
  for (const [noegle, vaerdi] of lager) {
    await writeFile(join(udMappe, `${noegle}.json`), JSON.stringify(vaerdi));
  }
  console.log(`\nSkrevet til ${udMappe}`);
}

process.exit(koersel.status === 'ok' ? 0 : koersel.status === 'delvis' ? 1 : 2);
