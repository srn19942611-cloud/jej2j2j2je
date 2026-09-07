/* Indlæsning af filer: maskinlister, effektoversigter, gruppeskemaer og datablade.
   Trin: genkend filtype → match kolonner → parse værdier → bind til katalog →
   find konflikter. Ingen række skrives til projektet, før brugeren har set bindingen. */

import type {
  Binding, Filtype, Forbruger, Indlaesningsresultat, Karakteristik, KatalogPost,
  Kolonnemapping, Konflikt, RaaPost, Stamdata,
} from './typer';
import { KOLONNEORDBOG } from './data';
import { postTilForbruger } from './beregning';

const ORD = KOLONNEORDBOG as unknown as {
  filtyper: { id: string; endelser: string[]; kendetegn: string[] }[];
  kolonner: { felt: string; synonymer: string[]; paakraevet: boolean }[];
  ignorerKolonner: string[];
  vaerdimoenstre: {
    spaending: { regex: string; volt: number; faser: number; tillid: number; flag?: string; note?: string }[];
    tal: { decimalKomma: boolean; fjernEnheder: string[] };
    ja: string[]; nej: string[]; ukendt: string[];
  };
  gruppekolonner: { regex: string };
  fodnoter: { tegn: string[]; betydning: string };
  advarsler: { id: string; tekst: string }[];
};

export const normaliser = (s: unknown): string =>
  String(s ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[.:;]+$/, '').trim();

/* ---------- 1. Filtype ---------- */

export function genkendFiltype(filnavn: string, overskrifter: string[] = []): Filtype {
  const endelse = ('.' + filnavn.split('.').pop()).toLowerCase();
  const tekst = overskrifter.map(normaliser).join(' ');
  let bedste: { id: string; score: number } = { id: 'ukendt', score: 0 };
  for (const f of ORD.filtyper) {
    if (!f.endelser.includes(endelse)) continue;
    const traef = f.kendetegn.filter((k) => tekst.includes(k)).length;
    const score = traef / Math.max(1, f.kendetegn.length) + (traef ? 0.1 : 0);
    if (score > bedste.score) bedste = { id: f.id, score };
  }
  if (bedste.score === 0) {
    if (['.pdf', '.png', '.jpg', '.dwg'].includes(endelse)) return 'plantegning';
    return 'ukendt';
  }
  return bedste.id as Filtype;
}

/* ---------- 2. Kolonner ---------- */

/** Finder overskriftsrækken (den række med flest genkendte kolonner) og binder felterne. */
export function matchKolonner(raekker: unknown[][], maksSoeg = 12): Kolonnemapping {
  let bedst: Kolonnemapping = { felter: {}, gruppekolonner: [], uafklarede: [], overskriftsraekke: 0 };
  let bedstAntal = -1;

  for (let r = 0; r < Math.min(maksSoeg, raekker.length); r++) {
    const felter: Record<string, number> = {};
    const gruppekolonner: Kolonnemapping['gruppekolonner'] = [];
    const uafklarede: string[] = [];

    raekker[r].forEach((celle, i) => {
      const tekst = normaliser(celle);
      if (!tekst) return;
      if (ORD.ignorerKolonner.some((ig) => tekst.includes(ig))) return;

      const gruppe = new RegExp(ORD.gruppekolonner.regex, 'i').exec(tekst.replace(/\s+/g, ''));
      if (gruppe) {
        gruppekolonner.push({
          indeks: i, faser: Number(gruppe[1]),
          karakteristik: ((gruppe[2] || 'C').toUpperCase() as Karakteristik), mcb: Number(gruppe[3]),
        });
        return;
      }
      const traef = ORD.kolonner.find((k) => k.synonymer.some((s) => tekst === s || tekst.startsWith(s + ' ') || tekst === s + '.'))
        ?? ORD.kolonner.find((k) => k.synonymer.some((s) => s.length > 2 && tekst.includes(s)));
      if (traef && felter[traef.felt] === undefined) felter[traef.felt] = i;
      else if (!traef) uafklarede.push(String(celle));
    });

    const antal = Object.keys(felter).length + gruppekolonner.length;
    if (antal > bedstAntal) { bedstAntal = antal; bedst = { felter, gruppekolonner, uafklarede, overskriftsraekke: r }; }
  }
  return bedst;
}

/* ---------- 3. Værdier ---------- */

export function parseTal(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v ?? '').trim();
  if (!s || ORD.vaerdimoenstre.ukendt.includes(s.toLowerCase())) return null;
  ORD.vaerdimoenstre.tal.fjernEnheder.forEach((e) => { s = s.replace(new RegExp(`\\b${e}\\b`, 'gi'), ''); });
  s = s.replace(/[^\d.,\-]/g, '').trim();
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) || []).length === 1 && /\.\d{3}$/.test(s)) s = s.replace('.', '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

export function parseSpaending(v: unknown): { volt: number; faser: number; tillid: number; note?: string } | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  for (const m of ORD.vaerdimoenstre.spaending) {
    if (new RegExp(m.regex, 'i').test(s)) return { volt: m.volt, faser: m.faser, tillid: m.tillid, note: m.note };
  }
  const n = parseTal(s);
  if (n && n >= 380) return { volt: 400, faser: 3, tillid: 0.6 };
  if (n && n >= 200) return { volt: 230, faser: 1, tillid: 0.6 };
  return null;
}

export const parseJa = (v: unknown): boolean | null => {
  const s = normaliser(v);
  if (!s) return null;
  if (ORD.vaerdimoenstre.ja.includes(s)) return true;
  if (ORD.vaerdimoenstre.nej.includes(s)) return false;
  return null;
};

/* ---------- 4. Rækker ---------- */

const OVERSKRIFTSORD = ['hovedtavle', 'terminaltavle', 'sum', 'i alt', 'total', 'slagter', 'lager', 'brødcooperativet', 'salgslokale', 'belysning?'];

export function laesRaekker(raekker: unknown[][], mapping: Kolonnemapping): RaaPost[] {
  const ud: RaaPost[] = [];
  const f = mapping.felter;
  const hent = (r: unknown[], felt: string) => (f[felt] === undefined ? undefined : r[f[felt]]);

  for (let i = mapping.overskriftsraekke + 1; i < raekker.length; i++) {
    const r = raekker[i];
    const navn = String(hent(r, 'navn') ?? '').trim();
    if (!navn) continue;

    const advarsler: string[] = [];
    const antal = parseTal(hent(r, 'antal'));
    const harTal = ['kw', 'ampere', 'antal', 'spaending'].some((k) => parseTal(hent(r, k)) !== null || parseSpaending(hent(r, k)));
    if (!harTal && OVERSKRIFTSORD.some((o) => normaliser(navn).startsWith(o))) continue;

    const sp = parseSpaending(hent(r, 'spaending'));
    const kw = parseTal(hent(r, 'kw'));
    const ampere = parseTal(hent(r, 'ampere'));
    const raaNote = String(hent(r, 'note') ?? '').trim();
    const fodnote = ORD.fodnoter.tegn.find((t) => String(hent(r, 'antal') ?? '').includes(t)
      || mapping.gruppekolonner.some((g) => String(r[g.indeks] ?? '').includes(t)));

    const grupperFraSkema = mapping.gruppekolonner
      .map((g) => ({ faser: g.faser, karakteristik: g.karakteristik, mcb: g.mcb, antal: parseTal(r[g.indeks]) ?? 0 }))
      .filter((g) => g.antal > 0);

    let tillid = 0.5;
    if (kw !== null) tillid += 0.25;
    if (sp) tillid += 0.15 * sp.tillid;
    if (antal !== null) tillid += 0.1;

    if (kw === null && ampere === null) advarsler.push('kw_mangler');
    if (kw !== null && ampere !== null && sp) {
      const beregnet = sp.faser === 3 ? kw * 1000 / (Math.sqrt(3) * sp.volt * 0.9) : kw * 1000 / (230 * 0.9);
      if (Math.abs(beregnet - ampere) / Math.max(ampere, 1) > 0.2) advarsler.push('amp_vs_kw');
    }
    if (sp?.note) advarsler.push(sp.note);

    ud.push({
      raekke: i + 1,
      gruppe: String(hent(r, 'gruppe') ?? '').trim() || undefined,
      navn,
      leverandoer: String(hent(r, 'leverandoer') ?? '').trim() || undefined,
      model: String(hent(r, 'model') ?? '').trim() || undefined,
      antal: antal ?? undefined,
      volt: sp?.volt,
      faser: sp?.faser,
      kw: kw ?? undefined,
      ampere: ampere ?? undefined,
      cosphi: parseTal(hent(r, 'cosphi')) ?? undefined,
      df: parseTal(hent(r, 'df')) ?? undefined,
      mcb: parseTal(hent(r, 'mcb')) ?? undefined,
      kabel: String(hent(r, 'kabel') ?? '').trim() || undefined,
      rcd: String(hent(r, 'rcd') ?? '').trim() || undefined,
      tavle: String(hent(r, 'tavle') ?? '').trim() || undefined,
      afdeling: String(hent(r, 'afdeling') ?? '').trim() || undefined,
      note: raaNote || undefined,
      fodnote,
      grupperFraSkema: grupperFraSkema.length ? grupperFraSkema : undefined,
      tillid: Math.min(1, tillid),
      advarsler,
    });
  }
  return ud;
}

/* ---------- 5. Binding til katalog ---------- */

const tokens = (s: string) => normaliser(s).replace(/[^\wæøå ]/g, ' ').split(' ').filter((t) => t.length > 2);

export function bindTilKatalog(raa: RaaPost, katalog: KatalogPost[]): { post: KatalogPost | null; score: number; begrundelse: string } {
  if (raa.gruppe) {
    const idTraef = katalog.find((k) => normaliser(k.id) === normaliser(raa.gruppe));
    if (idTraef) return { post: idTraef, score: 1, begrundelse: `Maskinnummer ${raa.gruppe}` };
  }
  const navnTraef = katalog.find((k) => normaliser(k.navn) === normaliser(raa.navn));
  if (navnTraef) return { post: navnTraef, score: 0.95, begrundelse: 'Navnet er identisk' };

  const raaTokens = new Set(tokens(raa.navn));
  let bedst: { post: KatalogPost | null; score: number } = { post: null, score: 0 };
  katalog.forEach((k) => {
    const kt = new Set(tokens(k.navn));
    const faelles = [...raaTokens].filter((t) => kt.has(t) || [...kt].some((x) => x.startsWith(t) || t.startsWith(x)));
    const score = faelles.length / Math.max(1, Math.min(raaTokens.size, kt.size));
    if (score > bedst.score) bedst = { post: k, score: score * 0.9 };
  });
  if (bedst.score >= 0.5) return { post: bedst.post, score: bedst.score, begrundelse: `Navnelighed med ${bedst.post?.id}` };
  return { post: null, score: bedst.score, begrundelse: 'Ingen sikker binding — vælg katalogpost eller opret ny' };
}

/* ---------- 6. Samlet indlæsning ---------- */

export function indlaes(
  filnavn: string,
  raekker: unknown[][],
  katalog: KatalogPost[],
  stam: Stamdata,
  kilde = 'Datablad',
): Indlaesningsresultat {
  const mapping = matchKolonner(raekker);
  const filtype = genkendFiltype(filnavn, (raekker[mapping.overskriftsraekke] || []).map(String));
  const raaPoster = laesRaekker(raekker, mapping);
  const bindinger: Binding[] = [];
  const ubundne: RaaPost[] = [];
  const konflikter: Konflikt[] = [];

  raaPoster.forEach((raa) => {
    const { post, score, begrundelse } = bindTilKatalog(raa, katalog);
    if (!post) { ubundne.push(raa); bindinger.push({ raa, katalogId: null, score, begrundelse, forbruger: null }); return; }

    const f: Forbruger = postTilForbruger(post, stam, kilde);
    if (raa.antal !== undefined) f.antal = raa.antal;
    if (raa.kw !== undefined) f.kw = raa.kw;
    if (raa.volt) f.spaending = raa.volt as 230 | 400;
    if (raa.cosphi !== undefined) f.cosphi = raa.cosphi;
    if (raa.df !== undefined) f.df = raa.df;
    if (raa.mcb !== undefined) f.mcb = raa.mcb;
    if (raa.rcd) f.rcd = raa.rcd;
    if (raa.tavle) f.tavle = raa.tavle;
    if (raa.note) f.note = [f.note, raa.note].filter(Boolean).join('. ');
    if (raa.grupperFraSkema?.length) {
      f.grupper = raa.grupperFraSkema.reduce((s, g) => s + g.antal, 0);
      f.mcb = Math.max(...raa.grupperFraSkema.map((g) => g.mcb));
      f.karakteristik = raa.grupperFraSkema[0].karakteristik;
    }

    /* Konflikter mod katalogets standardværdier — det er dem, læringen lever af. */
    const sammenlign = (felt: string, nu: number | undefined, ny: number | undefined) => {
      if (nu === undefined || ny === undefined || nu === ny) return;
      const afv = nu ? (ny - nu) / nu * 100 : null;
      if (afv === null || Math.abs(afv) >= 5) konflikter.push({ katalogId: post.id, felt, nuvaerende: nu, foreslaaet: ny, kilde, afvigelsePct: afv });
    };
    sammenlign('kw', post.kw, raa.kw);
    sammenlign('cosphi', post.cosphi, raa.cosphi);
    sammenlign('df', post.df, raa.df);
    if (raa.volt && raa.volt !== post.spaending) {
      konflikter.push({ katalogId: post.id, felt: 'spaending', nuvaerende: post.spaending, foreslaaet: raa.volt, kilde, afvigelsePct: null });
    }

    bindinger.push({ raa, katalogId: post.id, score, begrundelse, forbruger: f });
  });

  const advarsler = [...new Set(raaPoster.flatMap((r) => r.advarsler))]
    .map((id) => ORD.advarsler.find((a) => a.id === id)?.tekst ?? id);

  return { filtype, mapping, bindinger, ubundne, konflikter, advarsler };
}
