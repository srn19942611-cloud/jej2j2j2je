/**
 * Simpelt JSON-lager på disk.
 *
 * Bruges til to ting, der begge skal overleve en genstart:
 *   - bekræftede kommune-opslag (modul 4 og 9), så tabellen bliver bedre,
 *     hver gang en bruger bekræfter et arkiv eller et netselskab
 *   - gemte sager, så en analyse kan hentes frem igen
 *
 * Der er ingen database med vilje: værktøjet skal kunne køres af en
 * rådgiver på en enkelt maskine uden opsætning.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROD = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

export async function laes(fil, standard = {}) {
  try {
    const tekst = await readFile(resolve(ROD, fil), "utf8");
    return JSON.parse(tekst);
  } catch (fejl) {
    if (fejl.code === "ENOENT") return standard;
    throw new Error(`Kunne ikke læse ${fil}: ${fejl.message}`);
  }
}

export async function skriv(fil, data) {
  const sti = resolve(ROD, fil);
  await mkdir(dirname(sti), { recursive: true });
  await writeFile(sti, JSON.stringify(data, null, 2), "utf8");
  return sti;
}

export async function opdater(fil, aendring, standard = {}) {
  const nuvaerende = await laes(fil, standard);
  const ny = aendring(nuvaerende);
  await skriv(fil, ny);
  return ny;
}
