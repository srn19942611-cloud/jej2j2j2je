/**
 * HTTP-klient til de eksterne datakilder.
 *
 * Fællestræk for alle kald i værktøjet: de skal kunne fejle uden at
 * vælte en analyse, og en fejl skal kunne skelnes fra et tomt svar. Derfor
 * returnerer hentJson/hentTekst aldrig `null` for en fejl - de kaster en
 * KildeFejl med nok kontekst til at modulet kan skrive en ærlig mangel-
 * besked i rapporten.
 */

export class KildeFejl extends Error {
  constructor(kilde, besked, { status = null, url = null, aarsag = null } = {}) {
    super(`${kilde}: ${besked}`);
    this.name = "KildeFejl";
    this.kilde = kilde;
    this.status = status;
    this.url = url;
    this.aarsag = aarsag;
  }
}

const cache = new Map();
const STANDARD_TTL_MS = 6 * 60 * 60 * 1000;

export function ryddCache() {
  cache.clear();
}

function cacheHent(noegle) {
  const post = cache.get(noegle);
  if (!post) return undefined;
  if (Date.now() > post.udloeber) {
    cache.delete(noegle);
    return undefined;
  }
  return post.vaerdi;
}

function cacheSaet(noegle, vaerdi, ttl) {
  cache.set(noegle, { vaerdi, udloeber: Date.now() + ttl });
}

/**
 * @param {string} url
 * @param {object} [opt]
 * @param {string} opt.kilde        navn til fejlbeskeder og kildeliste
 * @param {number} [opt.timeoutMs]
 * @param {number} [opt.forsøg]    antal forsøg ved netværksfejl/5xx
 * @param {number} [opt.cacheTtlMs] 0 slår caching fra
 */
export async function hentRaa(url, opt = {}) {
  const {
    kilde = "ekstern kilde",
    timeoutMs = 20000,
    forsoeg = 3,
    headers = {},
    cacheTtlMs = STANDARD_TTL_MS,
    metode = "GET",
    body = null,
  } = opt;

  const noegle = `${metode} ${url} ${JSON.stringify(headers.Authorization ? "auth" : "")}`;
  if (metode === "GET" && cacheTtlMs > 0) {
    const truffet = cacheHent(noegle);
    if (truffet !== undefined) return truffet;
  }

  let sidsteFejl = null;
  for (let n = 0; n < forsoeg; n++) {
    if (n > 0) await pause(500 * 2 ** (n - 1));
    const ctrl = new AbortController();
    const ur = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const svar = await fetch(url, {
        method: metode,
        headers: { "User-Agent": "solceller-dimensionering/0.1", ...headers },
        body,
        signal: ctrl.signal,
      });
      const tekst = await svar.text();
      if (!svar.ok) {
        // 4xx er ikke forbigående - prøv ikke igen
        if (svar.status >= 400 && svar.status < 500 && svar.status !== 429) {
          throw new KildeFejl(kilde, beskrivStatus(svar.status), {
            status: svar.status, url, aarsag: tekst.slice(0, 400),
          });
        }
        sidsteFejl = new KildeFejl(kilde, `serverfejl ${svar.status}`, {
          status: svar.status, url, aarsag: tekst.slice(0, 400),
        });
        continue;
      }
      const resultat = { tekst, status: svar.status, headers: svar.headers };
      if (metode === "GET" && cacheTtlMs > 0) cacheSaet(noegle, resultat, cacheTtlMs);
      return resultat;
    } catch (fejl) {
      if (fejl instanceof KildeFejl) throw fejl;
      sidsteFejl = new KildeFejl(
        kilde,
        fejl.name === "AbortError" ? `svarede ikke inden ${timeoutMs} ms` : "kunne ikke kontaktes",
        { url, aarsag: fejl.message }
      );
    } finally {
      clearTimeout(ur);
    }
  }
  throw sidsteFejl;
}

export async function hentJson(url, opt = {}) {
  const { tekst } = await hentRaa(url, opt);
  try {
    return JSON.parse(tekst);
  } catch {
    throw new KildeFejl(opt.kilde || "ekstern kilde", "svarede ikke med gyldig JSON", {
      url, aarsag: tekst.slice(0, 400),
    });
  }
}

export async function hentTekst(url, opt = {}) {
  const { tekst } = await hentRaa(url, opt);
  return tekst;
}

function beskrivStatus(status) {
  switch (status) {
    case 401: return "afviste adgang (401) - tjek brugernavn/adgangskode eller token";
    case 403: return "afviste adgang (403) - tjek at tjenestebrugeren har adgang til tjenesten";
    case 404: return "fandt ingen data på opslaget (404)";
    case 429: return "afviste kaldet pga. for mange forespørgsler (429)";
    default: return `afviste kaldet (${status})`;
  }
}

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bygger en query-streng og springer tomme værdier over. */
export function query(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.append(k, String(v));
  }
  return u.toString();
}
