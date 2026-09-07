/* Genererer et komplet eksempel-ark ud fra referencesagen, så formatet kan vurderes.
   Kør: node --experimental-strip-types belastning/scripts-eksempel-eksport.mjs */
import { writeFileSync, mkdirSync } from 'node:fs';
import { beregn, genererForbrugerliste } from './engine/beregning.ts';
import { byggExcel, filnavn } from './engine/eksport.ts';
import { KATALOG, BUTIKSTYPER } from './engine/data.ts';

const type = BUTIKSTYPER.find((b) => b.navn === 'Dagli’Brugsen');
const stam = {
  butiksType: type.navn,
  butiksNavn: 'Dagli’Brugsen Rask Mølle',
  adresse: 'Rask Mølle',
  sagsnr: '2251110',
  salgsAreal: 688, lagerAreal: 97, ovrigtAreal: 60,
  kasser: 2, sco: 1,
  tilvalg: [...type.tilvalg, 'slagter'],
  ventilationKoelKw: 27, metode: 'A', ikHoved: 10,
};

const liste = genererForbrugerliste(stam, KATALOG);
const resultat = beregn(stam, liste);
const bytes = byggExcel(stam, resultat);

mkdirSync(new URL('./eksempel/', import.meta.url), { recursive: true });
const sti = new URL(`./eksempel/${filnavn(stam)}`, import.meta.url);
writeFileSync(sti, bytes);
console.log(`${sti.pathname}  (${(bytes.length / 1024).toFixed(0)} kB)`);
console.log(`${liste.length} forbrugere · ${resultat.instKw.toFixed(1)} kW installeret · ${resultat.balance.maxA.toFixed(0)} A maks. fase`);
console.log(resultat.anbefaling.begrundelse);
