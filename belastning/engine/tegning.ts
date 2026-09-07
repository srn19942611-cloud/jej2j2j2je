/* Fra plantegning til forbrugerliste.
   Trin: vision-udtræk (JSON) → opslag i symbolordbogen → optælling → forbrugerliste,
   der flettes med butikstypens skabelon. Alt, der ikke kunne læses, bliver i skabelonen
   og markeres med kilde "Skaleret erfaring". */

import type { Forbruger, KatalogPost, Stamdata } from './typer.ts';
import { PLANSYMBOLER } from './data.ts';
import { genererForbrugerliste, postTilForbruger } from './beregning.ts';

export interface RumFund { navn: string; areal_m2: number | null; tillid: number }
export interface MoebelFund { kode: string; antal: number; placering?: string; usikkerhed?: string; tillid: number }
export interface MaskinFund { nummer: string; antal: number; placering?: string; tillid: number }

export interface Optaelling {
  tegning?: { titel?: string; tegningsnr?: string; maalestok?: string; dato?: string };
  rum: RumFund[];
  moebler: MoebelFund[];
  maskinnumre: MaskinFund[];
  kasser?: { kasseborde: number; sco: number; tillid: number };
  bemaerkninger?: string[];
}

/** Brugerbekræftede eller projektspecifikke mappinger: rå kode → katalog-id. */
export type KodeMapping = Record<string, { katalogId: string | null; antalPrForekomst: number }>;

export interface Uafklaret {
  kode: string; antal: number; grund: 'ukendt' | 'forslag'; forslag?: string; tillid: number;
}

const normaliser = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

/* ---------- 1. Rumetiketter → stamdata ---------- */

export function stamdataFraRum(rum: RumFund[]): { patch: Partial<Stamdata>; ekstraForbrugere: { katalogId: string; antal: number }[] } {
  const patch: Record<string, number> = {};
  const ekstra: Record<string, number> = {};
  const tilvalg = new Set<string>();
  let ovrigt = 0;

  rum.forEach((r) => {
    const tekst = `${normaliser(r.navn)} ${r.areal_m2 ?? ''} M2`;
    for (const regel of PLANSYMBOLER.rumetiketter) {
      if (!new RegExp(regel.regex, 'i').test(tekst)) continue;
      const areal = r.areal_m2 ?? 0;
      if (regel.felt === 'salgsAreal' || regel.felt === 'lagerAreal') patch[regel.felt] = (patch[regel.felt] || 0) + areal;
      else ovrigt += areal;
      if ((regel as { aktiverTilvalg?: string }).aktiverTilvalg) tilvalg.add((regel as { aktiverTilvalg: string }).aktiverTilvalg);
      const katalogId = (regel as { katalogId?: string }).katalogId;
      const antal = (regel as { antalPrForekomst?: number }).antalPrForekomst ?? 0;
      if (katalogId && antal) ekstra[katalogId] = (ekstra[katalogId] || 0) + antal;
      break;
    }
  });

  return {
    patch: {
      ...(patch.salgsAreal ? { salgsAreal: patch.salgsAreal } : {}),
      ...(patch.lagerAreal ? { lagerAreal: patch.lagerAreal } : {}),
      ...(ovrigt ? { ovrigtAreal: Math.round(ovrigt) } : {}),
      ...(tilvalg.size ? { tilvalg: [...tilvalg] } : {}),
    },
    ekstraForbrugere: Object.entries(ekstra).map(([katalogId, antal]) => ({ katalogId, antal })),
  };
}

/* ---------- 2. Koder → katalogposter ---------- */

export function slaaOpKode(raaKode: string, mappinger: KodeMapping = {}) {
  const kode = normaliser(raaKode);
  if (mappinger[kode]) return { ...mappinger[kode], tillid: 'sikker' as const, kilde: 'bruger' as const };
  for (const m of PLANSYMBOLER.moebelkoder) {
    const traeffer = new RegExp(m.monster, 'i').test(raaKode) || kode.startsWith(m.kode);
    if (!traeffer) continue;
    return { katalogId: m.katalogId, antalPrForekomst: m.antalPrForekomst, tillid: m.tillid as 'sikker' | 'forslag', kilde: 'ordbog' as const };
  }
  return null;
}

export function erMaskinnummer(nummer: string, katalog: KatalogPost[]): KatalogPost | null {
  const n = normaliser(nummer).replace(/\s/g, '');
  return katalog.find((k) => normaliser(k.id) === n)
    ?? katalog.find((k) => normaliser(k.id).replace(/[A-Z]$/, '') === n.replace(/[A-Z]$/, ''))
    ?? null;
}

/* ---------- 3. Optælling → forbrugerliste ---------- */

export function optaellingTilForbrugere(
  optaelling: Optaelling,
  katalog: KatalogPost[],
  stam: Stamdata,
  mappinger: KodeMapping = {},
): { forbrugere: Forbruger[]; uafklarede: Uafklaret[] } {
  const antalPrId = new Map<string, number>();
  const uafklarede: Uafklaret[] = [];
  const laegTil = (id: string, antal: number) => antalPrId.set(id, (antalPrId.get(id) || 0) + antal);

  (optaelling.maskinnumre || []).forEach((m) => {
    const post = erMaskinnummer(m.nummer, katalog);
    if (post) laegTil(post.id, m.antal);
    else uafklarede.push({ kode: m.nummer, antal: m.antal, grund: 'ukendt', tillid: m.tillid });
  });

  (optaelling.moebler || []).forEach((m) => {
    const opslag = slaaOpKode(m.kode, mappinger);
    if (!opslag) { uafklarede.push({ kode: m.kode, antal: m.antal, grund: 'ukendt', tillid: m.tillid }); return; }
    if (opslag.tillid === 'forslag' && !mappinger[normaliser(m.kode)]) {
      uafklarede.push({ kode: m.kode, antal: m.antal, grund: 'forslag', forslag: opslag.katalogId ?? 'ingen el', tillid: m.tillid });
    }
    if (!opslag.katalogId || !opslag.antalPrForekomst) return;
    laegTil(opslag.katalogId, Math.round(m.antal * opslag.antalPrForekomst));
  });

  if (optaelling.kasser) {
    const post = katalog.find((k) => k.id === 'BU15');
    if (post) laegTil(post.id, (optaelling.kasser.kasseborde || 0) + (optaelling.kasser.sco || 0));
  }

  const { ekstraForbrugere } = stamdataFraRum(optaelling.rum || []);
  ekstraForbrugere.forEach((e) => laegTil(e.katalogId, e.antal));

  const forbrugere: Forbruger[] = [];
  antalPrId.forEach((antal, id) => {
    const post = katalog.find((k) => k.id === id);
    if (!post || antal <= 0) return;
    const f = postTilForbruger(post, stam, 'Tegning');
    f.antal = antal;
    forbrugere.push(f);
  });

  return { forbrugere, uafklarede };
}

/* ---------- 4. Fletning med skabelon ---------- */

/** Tegningen vinder på antal; skabelonen udfylder alt det, tegningen ikke viser
    (køl, ventilation, IT, sikring, belysning). Kilde bevares pr. række. */
export function fletMedSkabelon(fraTegning: Forbruger[], stam: Stamdata, katalog: KatalogPost[]): Forbruger[] {
  const skabelon = genererForbrugerliste(stam, katalog);
  const fraTegningPrId = new Map(fraTegning.map((f) => [f.katalogId, f]));
  const resultat = skabelon.map((s) => {
    const t = fraTegningPrId.get(s.katalogId);
    if (!t) return s;
    fraTegningPrId.delete(s.katalogId);
    return { ...s, antal: t.antal, kilde: 'Tegning' };
  });
  fraTegningPrId.forEach((t) => resultat.push(t));
  return resultat;
}

/** Andel af posterne, der er dokumenteret fra tegning/datablad frem for erfaringstal. */
export function daekningsgrad(forbrugere: Forbruger[]): { tegning: number; total: number; pct: number } {
  const total = forbrugere.length;
  const tegning = forbrugere.filter((f) => f.kilde === 'Tegning').length;
  return { tegning, total, pct: total ? tegning / total * 100 : 0 };
}
