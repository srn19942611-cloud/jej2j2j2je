#!/usr/bin/env node
/**
 * HTTP-server for solcelle-dimensioneringsværktøjet.
 *
 * Serveren har to opgaver:
 *   1. Servere UI'et (web/)
 *   2. Være det sted, de eksterne kald foretages fra
 *
 * Punkt 2 er ikke til forhandling: PVGIS sætter ikke CORS-headere, og
 * Datafordelerens og Eloverbliks legitimationsoplysninger må ikke ligge i
 * en browser. Derfor går alle opslag gennem serveren.
 *
 * Ingen afhængigheder ud over Node selv.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import * as orchestrator from "./modules/orchestrator.js";
import * as m01 from "./modules/m01-adresse.js";
import * as m04 from "./modules/m04-dokumentation.js";
import * as m12 from "./modules/m12-oekonomi.js";
import { datakildeStatus } from "./config/datakilder.js";
import { PANELTYPER, MONTAGESYSTEMER, LAYOUT, OEKONOMI } from "./config/antagelser.js";
import { BRANDREGLER } from "./config/brandregler.js";
import { KOMMUNER } from "./config/kommuner.js";
import { laes, skriv } from "./lib/lager.js";

const ROD = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(ROD, "../web");
const PORT = Number(process.env.PORT ?? 8080);
const VAERT = process.env.VAERT ?? "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, svar) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await haandterApi(url, req, svar);
    } else {
      await serverStatiskFil(url, svar);
    }
  } catch (fejl) {
    console.error(`Fejl på ${url.pathname}:`, fejl);
    sendJson(svar, 500, { fejl: fejl.message, sti: url.pathname });
  }
});

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function haandterApi(url, req, svar) {
  const rute = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");

  switch (`${req.method} ${rute}`) {
    /* --- Opsætning og opslagsdata --------------------------------- */
    case "GET status":
      return sendJson(svar, 200, {
        navn: "Solceller dimensionering",
        version: "0.1",
        datakilder: datakildeStatus(),
        forbehold:
          "Værktøjet leverer et fagligt underlag, ikke en juridisk gyldig statisk " +
          "dokumentation. Statisk dokumentation for højere konsekvensklasser skal " +
          "underskrives af en certificeret statiker.",
      });

    case "GET konfiguration":
      return sendJson(svar, 200, {
        paneltyper: Object.entries(PANELTYPER).map(([n, p]) => ({ noegle: n, ...p })),
        montagesystemer: Object.entries(MONTAGESYSTEMER).map(([n, p]) => ({ noegle: n, ...p })),
        layout: LAYOUT,
        oekonomi: OEKONOMI,
        brandregler: BRANDREGLER,
        kommuner: KOMMUNER,
      });

    /* --- Modul 1: adresse ------------------------------------------ */
    case "GET adresseforslag": {
      const q = url.searchParams.get("q") ?? "";
      const forslag = await m01.adresseforslag(q);
      return sendJson(svar, 200, Array.isArray(forslag) ? { forslag } : forslag);
    }

    /* --- Modul 4: arkivopslag -------------------------------------- */
    case "GET arkiv": {
      const kode = url.searchParams.get("kommunekode");
      if (!kode) return sendJson(svar, 400, { fejl: "kommunekode mangler" });
      return sendJson(svar, 200, await m04.arkivForKommune(kode));
    }

    case "POST arkiv/bekræft": {
      const krop = await laesKrop(req);
      if (!krop.kommunekode || !krop.platform) {
        return sendJson(svar, 400, { fejl: "kommunekode og platform skal angives" });
      }
      return sendJson(svar, 200, await m04.bekraeftArkiv(krop.kommunekode, krop.platform));
    }

    case "POST netselskab/bekræft": {
      const krop = await laesKrop(req);
      if (!krop.kommunekode || !krop.navn) {
        return sendJson(svar, 400, { fejl: "kommunekode og navn skal angives" });
      }
      return sendJson(svar, 200, await m04.bekraeftNetselskab(krop.kommunekode, krop.navn));
    }

    /* --- Modul 12: Eloverblik -------------------------------------- */
    case "GET målepunkter": {
      try {
        return sendJson(svar, 200, { maalepunkter: await m12.hentMaalepunkter() });
      } catch (fejl) {
        return sendJson(svar, 200, { maalepunkter: [], fejl: fejl.message });
      }
    }

    /* --- Hele analysen --------------------------------------------- */
    case "POST analyse": {
      const input = await laesKrop(req);
      const log = [];
      const sag = await orchestrator.koerAlt(input, (b) => log.push(b));
      sag.log = log;
      if (input.gem !== false) await gemSag(sag);
      // Rapportens HTML er stor; UI'et henter den for sig.
      const { rapport, ...restSag } = sag;
      return sendJson(svar, 200, {
        ...restSag,
        rapport: { kildeliste: rapport.kildeliste, statistik: rapport.statistik, filnavn: rapport.filnavn },
        sagsId: sag.sagsId,
      });
    }

    /* --- Rapport ---------------------------------------------------- */
    case "POST rapport": {
      const sag = await laesKrop(req);
      const rapport = orchestrator.byggRapport(sag);
      svar.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${rapport.filnavn}"`,
      });
      return svar.end(rapport.html);
    }

    case "GET sager":
      return sendJson(svar, 200, { sager: await laes("sager/index.json", { sager: [] }).then((d) => d.sager ?? []) });
  }

  /* --- Rapport for en gemt sag: GET rapport/<id> ------------------- */
  if (req.method === "GET" && rute.startsWith("rapport/")) {
    const id = rute.slice("rapport/".length);
    const sag = await laes(`sager/${sikkerId(id)}.json`, null);
    if (!sag) return sendJson(svar, 404, { fejl: "sagen findes ikke" });
    const rapport = orchestrator.byggRapport(sag);
    svar.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return svar.end(rapport.html);
  }

  if (req.method === "GET" && rute.startsWith("sag/")) {
    const id = rute.slice("sag/".length);
    const sag = await laes(`sager/${sikkerId(id)}.json`, null);
    if (!sag) return sendJson(svar, 404, { fejl: "sagen findes ikke" });
    return sendJson(svar, 200, sag);
  }

  return sendJson(svar, 404, { fejl: `ukendt endepunkt: ${req.method} /api/${rute}` });
}

/* ------------------------------------------------------------------ */
/* Sager                                                               */
/* ------------------------------------------------------------------ */

async function gemSag(sag) {
  const id = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  sag.sagsId = id;
  const { rapport, ...udenRapport } = sag;
  await skriv(`sager/${id}.json`, udenRapport);
  const indeks = await laes("sager/index.json", { sager: [] });
  indeks.sager.unshift({
    id,
    adresse: sag.moduler?.m1?.adresse?.vaerdi ?? null,
    genereret: sag.genereret,
    effektKWp: sag.moduler?.m2?.resultat?.installeretEffektKWp?.vaerdi ?? null,
    status: sag.samletStatus?.status ?? null,
  });
  indeks.sager = indeks.sager.slice(0, 100);
  await skriv("sager/index.json", indeks);
  return id;
}

const sikkerId = (id) => String(id).replace(/[^\w-]/g, "");

/* ------------------------------------------------------------------ */
/* Statiske filer                                                      */
/* ------------------------------------------------------------------ */

async function serverStatiskFil(url, svar) {
  const sti = url.pathname === "/" ? "/index.html" : url.pathname;
  const fuld = resolve(WEB, `.${normalize(sti)}`);
  if (!fuld.startsWith(WEB)) return sendJson(svar, 403, { fejl: "adgang nægtet" });

  try {
    const indhold = await readFile(fuld);
    svar.writeHead(200, {
      "Content-Type": MIME[extname(fuld)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    svar.end(indhold);
  } catch (fejl) {
    if (fejl.code === "ENOENT") return sendJson(svar, 404, { fejl: "filen findes ikke" });
    throw fejl;
  }
}

/* ------------------------------------------------------------------ */
/* Hjælpere                                                           */
/* ------------------------------------------------------------------ */

function sendJson(svar, kode, data) {
  const krop = JSON.stringify(data);
  svar.writeHead(kode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(krop),
  });
  svar.end(krop);
}

async function laesKrop(req, maxBytes = 8 * 1024 * 1024) {
  const dele = [];
  let stoerrelse = 0;
  for await (const del of req) {
    stoerrelse += del.length;
    if (stoerrelse > maxBytes) throw new Error("foresporgslen er for stor");
    dele.push(del);
  }
  const tekst = Buffer.concat(dele).toString("utf8");
  if (!tekst) return {};
  try {
    return JSON.parse(tekst);
  } catch {
    throw new Error("kroppen er ikke gyldig JSON");
  }
}

server.listen(PORT, VAERT, () => {
  const kilder = datakildeStatus();
  console.log(`\n  Solceller dimensionering kører på http://${VAERT}:${PORT}\n`);
  console.log("  Datakilder:");
  for (const k of kilder) {
    console.log(`   ${k.konfigureret ? "✓" : "✗"} ${k.navn}`);
    if (!k.konfigureret && k.vejledning) console.log(`      ${k.vejledning}`);
  }
  console.log("\n  Uden en konfigureret kilde kører værktøjet videre i reduceret");
  console.log("  tilstand: de berørte tal markeres MANGLER og skal indtastes\n");
});

export { server };
