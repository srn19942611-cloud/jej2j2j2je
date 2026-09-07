/* Genererer engine/data.ts ud fra JSON-kilderne i data/.
   Kør efter ændringer i data/*.json:  node belastning/scripts-generer-data.mjs */
import { readFileSync, writeFileSync } from 'node:fs';

const laes = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));
const tabeller = laes('tabeller.json');
const katalog = laes('katalog.json');
const butikstyper = laes('butikstyper.json');
const referencer = laes('referencer.json');
const plansymboler = laes('plansymboler.json');
const kolonneordbog = laes('kolonneordbog.json');

const aPrM2 = referencer.maalinger.map((m) => m.peakA / m.m2);
const ref = { min: Math.min(...aPrM2), max: Math.max(...aPrM2) };

const ud = `/* GENERERET FIL – rediger data/*.json og kør scripts-generer-data.mjs i stedet. */
import type { KatalogPost } from './typer.ts';

export const MCB_RAEKKE: number[] = ${JSON.stringify(tabeller.mcbRaekke)};
export const HOVEDAFBRYDER_RAEKKE: number[] = ${JSON.stringify(tabeller.hovedafbryderRaekke)};
export const KABEL_TABEL = ${JSON.stringify(tabeller.kabelTabel)} as const;
export const KONSTANTER = ${JSON.stringify(tabeller.konstanter)} as {
  rhoCu: number; cMin: number; udloesningsfaktor: { B: number; C: number; D: number };
  maksSpaendingsfaldPct: number; maksHovedkabelBelastningPct: number; motorfaktorMcb: number; stikPrGruppe: number;
};
export const SAMTIDIGHEDSFAKTORER = ${JSON.stringify(tabeller.samtidighedsfaktorer, null, 2)};
export const BYGGEPROGRAMKRAV = ${JSON.stringify(tabeller.byggeprogramkrav, null, 2)};
export const REFERENCEMAALINGER = ${JSON.stringify(referencer.maalinger, null, 2)};
export const REFERENCESAGER = ${JSON.stringify(referencer.sager, null, 2)};
/* A pr. m² salgsareal, målt 15-min. peak i sammenlignelige butikker. */
export const REFERENCE_A_PR_M2 = { min: ${ref.min.toFixed(4)}, max: ${ref.max.toFixed(4)} };
export const BUTIKSTYPER = ${JSON.stringify(butikstyper.butikstyper, null, 2)};
export const TILVALG = ${JSON.stringify(butikstyper.tilvalg, null, 2)};
export const PLANSYMBOLER = ${JSON.stringify(plansymboler, null, 2)};
export const KOLONNEORDBOG = ${JSON.stringify(kolonneordbog, null, 2)};
export const KATALOG: KatalogPost[] = ${JSON.stringify(katalog, null, 2)};
`;
writeFileSync(new URL('./engine/data.ts', import.meta.url), ud);
console.log(`engine/data.ts skrevet – ${katalog.length} katalogposter, reference ${ref.min.toFixed(3)}–${ref.max.toFixed(3)} A/m²`);
