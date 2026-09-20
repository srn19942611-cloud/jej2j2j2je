#!/usr/bin/env node
/**
 * Domme fra beslutningsarket ind i læringen.
 *
 *   node sync/domme.mjs --domme data/domme --laering data/laering.json
 *
 * Beslutningsarket gemmer hver dom som ét dokument i samlingen «domme»:
 * { id: 'sag2', data: { verdict: 'rigtig'|'forkert'|'uafklaret', note, at } }.
 * Hentes de ned som JSON-filer (én pr. dom), samler dette script dem i
 * læringsfilen, så kørslen kan læse dem tilbage — og så det kan ses, hvilke
 * sager der er dømt, af hvem og med hvilken begrundelse.
 *
 * Det er de første rigtige svar, motoren har fået. Reglen, som en dom
 * ændrer, rettes i koden med henvisning til dommen (se WEEKENDFORVENTNING i
 * src/doegnprofil.js for sag 2); her gemmes selve dommen, så den ikke går
 * tabt, og så den samme sag ikke stilles igen som ny.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tomLaering } from '../src/agent.js';

const argv = process.argv.slice(2);
const arg = (navn, standard) => {
  const i = argv.indexOf(`--${navn}`);
  return i === -1 ? standard : argv[i + 1];
};

const dommeMappe = arg('domme', 'data/domme');
const laeringSti = arg('laering', 'data/laering.json');

/** Finder alle JSON-filer under mappen, uanset om de ligger ét eller to niveauer nede. */
function findJson(mappe) {
  const ud = [];
  for (const navn of fs.readdirSync(mappe)) {
    const sti = path.join(mappe, navn);
    if (fs.statSync(sti).isDirectory()) ud.push(...findJson(sti));
    else if (navn.endsWith('.json')) ud.push(sti);
  }
  return ud;
}

/** Læser én dom-fil. Tåler både {id, data:{...}} (eksport) og den rå {verdict, note, at}. */
export function laesDom(sti) {
  const raa = JSON.parse(fs.readFileSync(sti, 'utf8'));
  const data = raa.data || raa;
  const id = raa.id || data.id || path.basename(sti, '.json');
  if (!data.verdict && !data.note) return null;
  return { sagId: id, verdict: data.verdict || null, note: data.note || '', tid: data.at || raa.updatedAt || null };
}

/** Lægger domme ind i læringen. Samme sag + samme tidspunkt tæller kun én gang. */
export function indarbejdDomme(laering, domme) {
  const l = laering || tomLaering();
  l.domme = Array.isArray(l.domme) ? l.domme : [];
  const set = new Set(l.domme.map((d) => `${d.sagId}|${d.tid}`));
  let nye = 0;
  for (const d of domme) {
    if (!d) continue;
    const noegle = `${d.sagId}|${d.tid}`;
    if (set.has(noegle)) continue;
    set.add(noegle);
    l.domme.push({ ...d, kilde: 'beslutningsark' });
    nye++;
  }
  l.domme.sort((a, b) => String(a.tid).localeCompare(String(b.tid)));
  return { laering: l, nye };
}

const laering = fs.existsSync(laeringSti) ? JSON.parse(fs.readFileSync(laeringSti, 'utf8')) : tomLaering();
const domme = findJson(dommeMappe).map(laesDom);
const { laering: ny, nye } = indarbejdDomme(laering, domme);
fs.mkdirSync(path.dirname(laeringSti), { recursive: true });
fs.writeFileSync(laeringSti, JSON.stringify(ny, null, 2));

console.log(`${domme.filter(Boolean).length} domme læst, ${nye} nye · ${ny.domme.length} i alt · skrevet til ${laeringSti}`);
for (const d of ny.domme) console.log(`  ${d.sagId.padEnd(6)} ${String(d.verdict).padEnd(10)} ${d.tid ? d.tid.slice(0, 10) : '—'}  ${d.note || ''}`);
