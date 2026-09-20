#!/usr/bin/env node
/**
 * Ugens fem som arbejdsordrer — bygget, ikke sendt.
 *
 *   node sync/udsendelse.mjs --rapport data/rapport.json --bygninger data/bygninger.json --ud data/
 *
 * Skriver udsendelse.json (to bunker: straks og mandag, hver post med den
 * færdige Dalux-payload) og udsendelse.txt (teksterne, til at læse igennem).
 * Selve oprettelsen i Dalux sker et andet sted, efter at nogen har set
 * teksterne — en arbejdsordre er en tekniker, der kører.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { udsendelse } from '../src/udsendelse.js';

const argv = process.argv.slice(2);
const flag = (navn, standard = null) => {
  const i = argv.indexOf(`--${navn}`);
  return i === -1 ? standard : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};
const rapportSti = String(flag('rapport', 'data/rapport.json'));
const bygningerSti = flag('bygninger');
const udMappe = flag('ud');

const rapport = JSON.parse(await readFile(rapportSti, 'utf8'));
let bygninger = {};
if (typeof bygningerSti === 'string') {
  try { bygninger = JSON.parse(await readFile(bygningerSti, 'utf8')); }
  catch { console.error(`ingen bygningsliste på ${bygningerSti} — alle ordrer ender som «uden bygning»`); }
}

const u = udsendelse(rapport, { bygninger });

const l = [];
l.push(`UDSENDELSE · bygget ${u.dato} · straks ${u.straks.length} nu · ${u.mandagBunke.length} mandag ${u.mandag} · uden bygning ${u.udenBygning.length}`);
for (const [navn, bunke] of [['STRAKS', u.straks], ['MANDAG', u.mandagBunke]]) {
  l.push('', `==== ${navn} (${bunke.length}) ====`);
  for (const p of bunke) {
    l.push('', `---- ${p.varselId} · ${p.ejer} · ${p.butik} · prioritet ${p.workOrder.priorityId} · bygning ${p.workOrder.buildingId}`);
    l.push(`Emne: ${p.workOrder.subject}`);
    l.push(p.workOrder.description);
  }
}
if (u.udenBygning.length) {
  l.push('', '==== UDEN BYGNING ====');
  for (const p of u.udenBygning) l.push(`${p.varselId} · ${p.butik} · ${p.grund}`);
}
const tekst = l.join('\n');

if (udMappe) {
  await mkdir(String(udMappe), { recursive: true });
  await writeFile(join(String(udMappe), 'udsendelse.json'), JSON.stringify(u, null, 2));
  await writeFile(join(String(udMappe), 'udsendelse.txt'), tekst);
  console.error(`skrevet til ${join(String(udMappe), 'udsendelse.json')} og udsendelse.txt`);
}
console.log(l.slice(0, 1).join('\n'));
for (const p of u.straks) console.log(`  straks  ${p.varselId} ${p.ejer.padEnd(12)} ${p.butik.padEnd(26)} ${p.aarsag}`);
for (const p of u.mandagBunke) console.log(`  mandag  ${p.varselId} ${p.ejer.padEnd(12)} ${p.butik.padEnd(26)} ${p.aarsag}`);
