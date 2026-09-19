#!/usr/bin/env node
/* Års-screening af hele porteføljen på månedsdata.
 *
 *   node sync/aarskoersel.mjs --fra data/ [--ud data/]
 *
 * data/aar_afvig.json     én række pr. afvigende elmåler (b, bn, sc, m, n, t, f, s, sn, k)
 * data/butiksfald.json    butikker, hvor mindst 60 % af målerne faldt samtidig
 * data/anlaegPrMaaler.json (valgfri) kobling måler -> anlæg
 *
 * Rækkerne kommer af én SQL mod consumption_monthly — se LÆSMIG i sync/.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { storkoersel, rapportTekst, signaturFraAarsforhold, aarsudvalg } from '../src/storkoersel.js';
import { normButik } from '../src/korrelation.js';

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const fra = String(flag('fra') || 'data');
const ud = flag('ud');
const laes = async (n, d) => { try { return JSON.parse(await readFile(join(fra, `${n}.json`), 'utf8')); } catch { return d; } };

const rows = await laes('aar_afvig', []);
const butiksfald = new Set((await laes('butiksfald', [])).map((x) => normButik(x.b)));
const anlaegPrMaaler = await laes('anlaegPrMaaler', {});
const { brugbare, regnskab } = aarsudvalg(rows, { butiksfald });
console.error('[aarskoersel] udvalg', JSON.stringify(regnskab));

const r = storkoersel({ signaturer: brugbare.map((x) => signaturFraAarsforhold(x, { koerselId: 'AAR' })), anlaegPrMaaler });
console.log(rapportTekst(r));
const direkte = r.varsler.filter((v) => v.diagnose.bedste.direkte)
  .sort((a, b) => b.signatur.forventetKwhPrDoegn - a.signatur.forventetKwhPrDoegn);
console.log(`\nDIREKTE AFLÆSNINGER: ${direkte.length}`);
if (ud) {
  await mkdir(String(ud), { recursive: true });
  await writeFile(join(String(ud), 'aar_rapport.json'), JSON.stringify({
    udvalg: regnskab, regnskab: r.regnskab,
    prFaggruppe: r.prFaggruppe.map((g) => ({ navn: g.navn, antal: g.antal, hastende: g.hastende, butikker: g.butikker, aarsager: g.aarsager })),
    direkte: direkte.map((v) => ({ b: v.butiksnummer, navn: v.enhed.navn, m: v.enhed.meterId, aarsag: v.aarsagNavn, konf: v.konfidens, rest: v.signatur.restniveau, kwhAar: Math.round(v.signatur.forventetKwhPrDoegn * 365), ejer: v.ejerNavn, fg: v.faggruppe })),
    systematiske: r.sigtet.systematiske,
  }, null, 1));
}
