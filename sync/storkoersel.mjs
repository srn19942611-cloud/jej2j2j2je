#!/usr/bin/env node
/* Den store kørsel som indgang — til cron, og til i dag.
 *
 *   node sync/storkoersel.mjs --fra data/           læs signatur_koersel.json,
 *                                                   dalux_opgaver.json,
 *                                                   kvarter_detektorer.json,
 *                                                   locations.json fra mappen
 *   node sync/storkoersel.mjs                       læs tabellerne fra databasen
 *                                                   (SUPABASE_URL + SUPABASE_KEY)
 *   node sync/storkoersel.mjs --ud data/            skriv rapport.json + rapport.txt
 *   node sync/storkoersel.mjs --koersel BOELGE-1    kun rækker med det koersel_id
 *
 * Kæden selv ligger i src/storkoersel.js. Det her er kun transporten — og
 * transporten skal være kedelig. Én kilde ad gangen, sidevis, og et
 * regnskab for hvor mange rækker der kom ind fra hver.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  storkoersel, rapportTekst, signaturFraDb, opgaveFraDb, butiksnummerFraBygning,
} from '../src/storkoersel.js';

const argv = process.argv.slice(2);
const flag = (navn, standard = null) => {
  const i = argv.indexOf(`--${navn}`);
  return i === -1 ? standard : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};
const fraMappe = flag('fra');
const udMappe = flag('ud');
const koerselId = flag('koersel');

const log = (...a) => console.error(`[storkoersel ${new Date().toISOString().slice(11, 19)}]`, ...a);

/* ---- Kilder -------------------------------------------------------------- */

async function fraFiler(mappe) {
  const laes = async (navn) => {
    try { return JSON.parse(await readFile(join(mappe, `${navn}.json`), 'utf8')); }
    catch (e) { log(`${navn}.json mangler eller kan ikke læses — kører uden`); return []; }
  };
  return {
    signaturer: await laes('signatur_koersel'),
    opgaver: await laes('dalux_opgaver'),
    kvarter: await laes('kvarter_detektorer'),
    locations: await laes('locations'),
  };
}

/* Supabase REST, sidevis. 1.000 rækker pr. side er grænsen; 340.000 opgaver
 * er 340 sider, og det er fint kl. 03. */
async function fraDatabase(url, key) {
  const hent = async (tabel, { vaelg = '*', filter = '' } = {}) => {
    const ud = [];
    const side = 1000;
    for (let fra = 0; ; fra += side) {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${tabel}?select=${encodeURIComponent(vaelg)}${filter}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${fra}-${fra + side - 1}`, Prefer: 'count=exact' },
      });
      if (!res.ok) throw new Error(`${tabel}: HTTP ${res.status} ${await res.text()}`);
      const rows = await res.json();
      ud.push(...rows);
      if (rows.length < side) break;
    }
    log(`${tabel}: ${ud.length} rækker`);
    return ud;
  };
  const kf = koerselId ? `&koersel_id=eq.${encodeURIComponent(koerselId)}` : '';
  return {
    signaturer: await hent('signatur_koersel', { filter: kf }),
    opgaver: await hent('dalux_opgaver'),
    kvarter: await hent('kvarter_detektorer', { filter: kf }),
    locations: await hent('locations', { vaelg: 'butiksnummer,dalux_building_id,enity_building_id,navn' }),
  };
}

/* ---- Kørsel -------------------------------------------------------------- */

const kilde = fraMappe
  ? await fraFiler(String(fraMappe))
  : process.env.SUPABASE_URL && process.env.SUPABASE_KEY
    ? await fraDatabase(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    : null;

if (!kilde) {
  log('ingen kilde: angiv --fra <mappe> eller sæt SUPABASE_URL og SUPABASE_KEY');
  process.exit(2);
}

let signaturer = kilde.signaturer.map(signaturFraDb);
if (koerselId) signaturer = signaturer.filter((s) => s.koerselId === koerselId);
const opgaverRaa = kilde.opgaver.map(opgaveFraDb);
const { opgaver, koblet, udenButik } = butiksnummerFraBygning(opgaverRaa, kilde.locations);
log(`signaturer ${signaturer.length} · opgaver ${opgaver.length} (bygning→butik: ${koblet}, uden butik: ${udenButik}) · kvarter ${kilde.kvarter.length}`);

const rapport = storkoersel({ signaturer, opgaver, kvarter: kilde.kvarter });
const tekst = rapportTekst(rapport);
console.log(tekst);

if (udMappe) {
  await mkdir(String(udMappe), { recursive: true });
  /* Varslerne skrives med det, en person skal bruge — ikke hele signaturen. */
  const slank = (v) => ({
    id: v.id, butiksnummer: v.butiksnummer, butik: v.butik, faggruppe: v.faggruppe,
    enhed: { id: v.enhed.id, navn: v.enhed.navn, meterId: v.enhed.meterId, tags: v.enhed.tags },
    aarsagId: v.aarsagId, aarsagNavn: v.aarsagNavn, konfidens: v.konfidens, prioritet: v.prioritet, hastende: v.hastende,
    kr: v.kr, kwhAar: v.kwhAar, krKlasse: v.krKlasse, ejerId: v.ejerId, ejerNavn: v.ejerNavn,
    afvigPct: v.signatur.afvigPct, restniveau: v.signatur.restniveau, brud: v.signatur.brud?.dato || null, doegn: v.signatur.doegn,
    kobling: v.kobling ? { klasse: v.kobling.klasse, dage: v.kobling.dage, opgave: v.kobling.opgave?.opgavenr || null } : null,
    tilbagefald: v.historik?.tilbagefald || false, afvistTidligere: v.historik?.afvistTidligere || false,
    kvarter: v.kvarter ? { detektor: v.kvarter.detektor, vaerdier: v.kvarter.vaerdier } : null,
    forbehold: v.forbehold, tjekpunkter: v.tjekpunkter, p: v.p ?? null,
  });
  const ud = {
    tidspunkt: rapport.tidspunkt, koerselId: rapport.koerselId, regnskab: rapport.regnskab,
    sendt: rapport.sigtet.sendt.map(slank), venter: rapport.sigtet.venter.map(slank),
    systematiske: rapport.sigtet.systematiske, foerste: rapport.foerste.opgoerelse,
    prFaggruppe: rapport.prFaggruppe.map((g) => ({ ...g, varsler: g.varsler.map(slank) })),
    prEjer: rapport.prEjer.map((g) => ({ ...g, varsler: g.varsler.map(slank) })),
    ikkeDiagnoserbare: rapport.ikkeDiagnoserbare.map((v) => ({ enhed: v.enhed.id, navn: v.enhed.navn, butiksnummer: v.enhed.butiksnummer, grund: v.grund })),
    ikkeModelleret: rapport.ikkeModelleret.map((x) => ({ enhed: x.enhed.id, navn: x.enhed.navn, butiksnummer: x.enhed.butiksnummer, status: x.status })),
    ufordelteOpgaver: rapport.ufordelteOpgaver.length,
  };
  await writeFile(join(String(udMappe), 'rapport.json'), JSON.stringify(ud, null, 1));
  await writeFile(join(String(udMappe), 'rapport.txt'), tekst);
  log(`skrevet til ${udMappe}/rapport.json og rapport.txt`);
}
process.exit(rapport.regnskab.varsler > 0 || signaturer.length === 0 ? 0 : 1);
