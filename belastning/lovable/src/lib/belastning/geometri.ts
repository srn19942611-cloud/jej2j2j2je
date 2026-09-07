/* Læser en indretningstegning (PDF) geometrisk: finder målestok, rum, arealer og
   møbelløb — og regner effekten ud af løbende meter og kvadratmeter.

   Modulet kender ikke til PDF-formatet. Et PDF-lag (pdfjs-dist i browseren) leverer
   tekster med koordinater og streger; se docs/08. Alt herunder er ren geometri og
   kan derfor testes uden filer. */

import type {
  Forbruger, Kalkulationslinje, KatalogPost, Loeb, PdfSide, RumFundet, Skala,
  Stamdata, Streg, TekstElement, Tegningskalkule,
} from './typer';
import { NOEGLETAL } from './data';
import { postTilForbruger } from './beregning';

const NT = NOEGLETAL as unknown as {
  modulfamilier: { kode: string; navn: string; bredde_mm: number | null; dybde_mm: number | null; koelet: boolean; koeletype?: string }[];
  dimensionIKode: { regex: string; enkelttalRegex: string };
  prMeter: { id: string; navn: string; kwPrM: number; katalogId: string | null; gaelderKoder: string[]; kilde: string; tillid: number; koeletype: 'koel' | 'frost' | null }[];
  prM2Rum: { id: string; navn: string; wPrM2: number; rum: string[]; katalogId: string | null; kilde: string; tillid: number; fallback?: boolean }[];
  prEnhed: { id: string; navn: string; kw: number; katalogId: string | null; kilde: string; tillid: number }[];
  rumtypeordbog: { monster: string; rumtype: string }[];
};

const PT_TIL_MM = 25.4 / 72;
const midte = (t: TekstElement) => ({ x: t.x + t.bredde / 2, y: t.y + t.hoejde / 2 });
const laengde = (s: Streg) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
const median = (t: number[]) => { const s = [...t].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/* ---------- 1. Målestok ---------- */

/** Læser et måltal: "2.149", "1 400", "800", "2,15 m". Returnerer mm. */
export function maaltalTilMm(tekst: string): number | null {
  const t = tekst.trim();
  if (/^\d{1,2}[.,]\d{2}\s*m$/i.test(t)) return parseFloat(t.replace(',', '.')) * 1000;
  const rent = t.replace(/[.\s]/g, '');
  if (!/^\d{3,5}$/.test(rent)) return null;
  const mm = parseInt(rent, 10);
  return mm >= 150 && mm <= 60000 ? mm : null;
}

/** Finder skalaen. Målkæderne er stærkest: de står på tegningen og er uafhængige af,
    hvordan filen er eksporteret. Målestok og rumareal bruges som kontrol. */
export function findSkala(side: PdfSide, forventetRumareal?: { navn: string; m2: number }): Skala {
  const kontrol: Skala['kontrol'] = [];
  const kandidater: number[] = [];

  /* a) Måltal ved en streg af tilsvarende længde. */
  side.tekster.forEach((t) => {
    const mm = maaltalTilMm(t.tekst);
    if (!mm) return;
    const c = midte(t);
    let bedst: { streg: Streg; afstand: number } | null = null;
    side.streger.forEach((s) => {
      const l = laengde(s);
      if (l < 5) return;
      const px = (s.x1 + s.x2) / 2, py = (s.y1 + s.y2) / 2;
      const afstand = Math.hypot(c.x - px, c.y - py);
      if (afstand > Math.max(30, l * 0.6)) return;
      if (!bedst || afstand < bedst.afstand) bedst = { streg: s, afstand };
    });
    if (bedst) kandidater.push(mm / laengde(bedst.streg));
  });

  let maalkaede: number | null = null;
  if (kandidater.length >= 3) {
    const m = median(kandidater);
    const enige = kandidater.filter((k) => Math.abs(k - m) / m <= 0.15);
    if (enige.length >= 3) {
      maalkaede = median(enige);
      kontrol.push({ metode: `målkæde (${enige.length} af ${kandidater.length} måltal)`, mmPrEnhed: maalkaede, afvigelsePct: 0 });
    }
  }

  /* b) Målestoksangivelse. */
  let maalestok: number | null = null;
  const mt = side.tekster.map((t) => /1\s*:\s*(\d{2,4})/.exec(t.tekst)).find(Boolean);
  if (mt) { maalestok = PT_TIL_MM * parseInt(mt[1], 10); kontrol.push({ metode: `målestok 1:${mt[1]}`, mmPrEnhed: maalestok, afvigelsePct: 0 }); }

  /* c) Kendt rumareal mod tegnet flade. */
  let fraAreal: number | null = null;
  if (forventetRumareal) {
    const flade = stoersteRektangel(side.streger);
    if (flade) {
      fraAreal = Math.sqrt(forventetRumareal.m2 * 1e6 / flade);
      kontrol.push({ metode: `rumareal ${forventetRumareal.navn}`, mmPrEnhed: fraAreal, afvigelsePct: 0 });
    }
  }

  const valgt = maalkaede ?? maalestok ?? fraAreal;
  if (!valgt) {
    return { mmPrEnhed: PT_TIL_MM * 100, metode: 'ukendt', tillid: 0.2, kontrol, forklaring: 'Hverken målkæde, målestok eller kendt rumareal kunne findes. Der regnes med 1:100, og alle længder skal bekræftes.' };
  }
  kontrol.forEach((k) => { k.afvigelsePct = (k.mmPrEnhed - valgt) / valgt * 100; });
  const enighed = kontrol.filter((k) => Math.abs(k.afvigelsePct) <= 5).length;
  const metode: Skala['metode'] = maalkaede ? 'målkæde' : maalestok ? 'målestok' : 'rumareal';
  const tillid = Math.min(0.98, (maalkaede ? 0.8 : maalestok ? 0.7 : 0.5) + (enighed >= 2 ? 0.15 : 0));
  return {
    mmPrEnhed: valgt, metode, tillid, kontrol,
    forklaring: `Skala bestemt ved ${metode}: 1 tegningsenhed = ${valgt.toFixed(2)} mm.`
      + (kontrol.length > 1 ? ` Kontrolleret mod ${kontrol.length - 1} anden metode med ${Math.max(...kontrol.map((k) => Math.abs(k.afvigelsePct))).toFixed(1)} % afvigelse.` : ' Ingen uafhængig kontrol — bekræft en enkelt længde manuelt.'),
  };
}

function stoersteRektangel(streger: Streg[]): number | null {
  if (!streger.length) return null;
  const xs = streger.flatMap((s) => [s.x1, s.x2]);
  const ys = streger.flatMap((s) => [s.y1, s.y2]);
  const b = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return b > 0 && h > 0 ? b * h : null;
}

/* ---------- 2. Rum ---------- */

export function rumtype(navn: string): string {
  const n = navn.toLowerCase().trim();
  const t = NT.rumtypeordbog.find((r) => new RegExp(r.monster, 'i').test(n));
  return t ? t.rumtype : 'ovrigt';
}

/** Finder rumetiketter: et navn og et areal, enten i samme tekst eller lige over/under. */
export function findRum(side: PdfSide): RumFundet[] {
  const ud: RumFundet[] = [];
  const arealTekster = side.tekster.filter((t) => /([\d.,]+)\s*m\s*2|m²/i.test(t.tekst));

  arealTekster.forEach((at) => {
    const m = /([\d.,]+)\s*(?:m\s*2|m²)/i.exec(at.tekst);
    const areal = m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
    const egetNavn = at.tekst.replace(/([\d.,]+)\s*(?:m\s*2|m²)/i, '').trim();
    let navn = egetNavn;
    if (!navn) {
      const c = midte(at);
      const kandidat = side.tekster
        .filter((t) => t !== at && /^[A-ZÆØÅ][A-ZÆØÅ.\-/ ]{2,}$/.test(t.tekst.trim()))
        .map((t) => ({ t, d: Math.hypot(midte(t).x - c.x, midte(t).y - c.y) }))
        .filter((k) => k.d < Math.max(40, at.hoejde * 6))
        .sort((a, b) => a.d - b.d)[0];
      navn = kandidat ? kandidat.t.tekst.trim() : 'Ukendt rum';
    }
    if (!areal || areal <= 0) return;
    const c = midte(at);
    ud.push({ navn, rumtype: rumtype(navn), arealM2: areal, kilde: 'etiket', tillid: navn === 'Ukendt rum' ? 0.4 : 0.9, x: c.x, y: c.y });
  });

  return ud;
}

/* ---------- 3. Møbelløb ---------- */

export function laesModulkode(tekst: string): { familie: string; breddeM: number | null; dybdeM: number | null; loebLaengdeM: number | null } | null {
  const t = tekst.trim();
  const familie = NT.modulfamilier.find((f) => new RegExp(`\\b${f.kode}`, 'i').test(t));
  if (!familie) return null;
  const dim = new RegExp(NT.dimensionIKode.regex).exec(t);
  if (dim) return { familie: familie.kode, breddeM: Number(dim[1]) / 1000, dybdeM: Number(dim[2]) / 1000, loebLaengdeM: null };
  const enkelt = new RegExp(NT.dimensionIKode.enkelttalRegex, 'i').exec(t.replace(/\s+/g, ''));
  if (enkelt) return { familie: familie.kode, breddeM: null, dybdeM: null, loebLaengdeM: Number(enkelt[1]) / 1000 };
  return {
    familie: familie.kode,
    breddeM: familie.bredde_mm ? familie.bredde_mm / 1000 : null,
    dybdeM: familie.dybde_mm ? familie.dybde_mm / 1000 : null,
    loebLaengdeM: null,
  };
}

/** Samler møbeletiketter i løb: samme familie, tæt på hinanden og på linje. */
export function findLoeb(side: PdfSide, skala: Skala, rum: RumFundet[] = [], maxAfstandM = 3): Loeb[] {
  type Punkt = { i: number; t: TekstElement; kode: ReturnType<typeof laesModulkode>; x: number; y: number };
  const rumnavne = new Set(rum.map((r) => r.navn.toLowerCase().trim()));
  const punkter: Punkt[] = [];
  side.tekster.forEach((t, i) => {
    const raa = t.tekst.trim();
    if (rumnavne.has(raa.toLowerCase()) || /m\s*2\b|m²/i.test(raa)) return;   // rumetiketter er ikke møbler
    const kode = laesModulkode(raa);
    if (kode) { const c = midte(t); punkter.push({ i, t, kode, x: c.x, y: c.y }); }
  });
  if (!punkter.length) return [];

  const maxAfstandEnheder = maxAfstandM * 1000 / skala.mmPrEnhed;
  const forael = punkter.map((_, i) => i);
  const find = (i: number): number => (forael[i] === i ? i : (forael[i] = find(forael[i])));
  for (let a = 0; a < punkter.length; a++) {
    for (let b = a + 1; b < punkter.length; b++) {
      if (punkter[a].kode!.familie !== punkter[b].kode!.familie) continue;
      const dx = Math.abs(punkter[a].x - punkter[b].x);
      const dy = Math.abs(punkter[a].y - punkter[b].y);
      const paaLinje = dx < maxAfstandEnheder * 0.35 || dy < maxAfstandEnheder * 0.35;
      if (paaLinje && Math.hypot(dx, dy) <= maxAfstandEnheder) forael[find(a)] = find(b);
    }
  }

  const klynger = new Map<number, Punkt[]>();
  punkter.forEach((p, i) => { const r = find(i); klynger.set(r, [...(klynger.get(r) || []), p]); });

  /* Frit stående heltal på tegningen tolkes som antal moduler i det nærmeste løb. */
  const taltekster = side.tekster
    .filter((t) => /^\d{1,3}$/.test(t.tekst.trim()) && maaltalTilMm(t.tekst) === null)
    .map((t) => ({ v: parseInt(t.tekst, 10), ...midte(t) }));

  const ud: Loeb[] = [];
  klynger.forEach((gruppe) => {
    const familie = gruppe[0].kode!.familie;
    const modulbredde = gruppe.map((g) => g.kode!.breddeM).find((b) => b != null) ?? null;
    const xs = gruppe.map((g) => g.x), ys = gruppe.map((g) => g.y);
    const spanX = (Math.max(...xs) - Math.min(...xs)) * skala.mmPrEnhed / 1000;
    const spanY = (Math.max(...ys) - Math.min(...ys)) * skala.mmPrEnhed / 1000;
    const eksplicit = gruppe.map((g) => g.kode!.loebLaengdeM).filter((l): l is number => l != null);

    let laengdeM = eksplicit.length ? eksplicit.reduce((a, b) => a + b, 0)
      : Math.max(spanX, spanY) + (modulbredde ?? 0.6);

    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    const naerTal = taltekster
      .map((t) => ({ ...t, d: Math.hypot(t.x - cx, t.y - cy) }))
      .filter((t) => t.d < maxAfstandEnheder * 1.2)
      .sort((a, b) => a.d - b.d)[0];

    const antalFraEtiketter = gruppe.length;
    const antalFraTal = naerTal ? naerTal.v : null;
    const antalFraGeometri = modulbredde ? Math.max(1, Math.round(laengdeM / modulbredde)) : null;

    let antal = antalFraEtiketter;
    let tillid = 0.5;
    let forklaring = `${antalFraEtiketter} etiket(ter) i løbet.`;
    if (antalFraGeometri && antalFraTal && Math.abs(antalFraTal - antalFraGeometri) / Math.max(antalFraTal, 1) <= 0.35) {
      antal = antalFraTal; tillid = 0.85;
      forklaring = `Tallet ${antalFraTal} på tegningen stemmer med den målte længde (${antalFraGeometri} moduler à ${modulbredde} m).`;
    } else if (antalFraGeometri && antalFraGeometri >= antalFraEtiketter) {
      antal = antalFraGeometri; tillid = 0.65;
      forklaring = `Målt løb på ${laengdeM.toFixed(2)} m ÷ modulbredde ${modulbredde} m = ${antalFraGeometri} moduler.`
        + (antalFraTal ? ` Tallet ${antalFraTal} på tegningen afviger og er ikke brugt.` : '');
    } else if (antalFraTal) {
      antal = antalFraTal; tillid = 0.5;
      forklaring = `Tallet ${antalFraTal} på tegningen er brugt; længden kunne ikke bekræfte det.`;
    }
    if (modulbredde && !eksplicit.length) laengdeM = antal * modulbredde;
    if (eksplicit.length > 1) {
      tillid *= 0.8;
      forklaring = `${eksplicit.length} etiketter med egen længdeangivelse er lagt sammen til ${komma(laengdeM)} m — bekræft, at de er selvstændige rækker.`;
    }

    const naermesteRum = rum
      .map((r) => ({ r, d: Math.hypot(r.x - cx, r.y - cy) }))
      .sort((a, b) => a.d - b.d)[0];

    const familieinfo = NT.modulfamilier.find((f) => f.kode === familie);
    const tekstHint = gruppe.map((g) => g.t.tekst.toLowerCase()).join(' ');
    const koeletype: 'koel' | 'frost' | null = !familieinfo?.koelet ? null
      : /frost|fryse/.test(tekstHint) || naermesteRum?.r.rumtype === 'frost' ? 'frost'
      : (familieinfo.koeletype as 'koel' | 'frost' | undefined) ?? 'koel';

    ud.push({
      kode: gruppe[0].t.tekst.trim(), familie, modulbreddeM: modulbredde,
      laengdeM: Math.round(laengdeM * 100) / 100, antal,
      antalFraEtiketter, antalFraTal, antalFraGeometri, koeletype,
      rum: naermesteRum ? naermesteRum.r.rumtype : null,
      tillid: tillid * skala.tillid,
      forklaring,
    });
  });

  return ud.sort((a, b) => b.laengdeM - a.laengdeM);
}

/* ---------- 4. Kalkuleret ark ---------- */

const komma = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

export function byggKalkule(side: PdfSide, forventetRumareal?: { navn: string; m2: number }): Tegningskalkule {
  const skala = findSkala(side, forventetRumareal);
  const rum = findRum(side);
  const loeb = findLoeb(side, skala, rum);
  const linjer: Kalkulationslinje[] = [];
  const advarsler: string[] = [];

  if (skala.tillid < 0.6) advarsler.push('Skalaen er usikker — alle længder og arealer bør bekræftes mod en kendt måltagning på tegningen.');

  /* a) Løbende meter møbel */
  loeb.forEach((l) => {
    const relevante = NT.prMeter.filter((n) => n.gaelderKoder.some((k) => k === l.familie || k === `${l.familie}_${(l.koeletype ?? '').toUpperCase()}` || k === `${l.familie}_KOELET`));
    relevante.forEach((n) => {
      if (n.koeletype && n.koeletype !== l.koeletype) return;      // et frostløb er ikke også et køleløb
      if (!l.koeletype && n.id !== 'inventarlys') return;
      const kw = Math.round(l.laengdeM * n.kwPrM * 100) / 100;
      if (kw <= 0) return;
      linjer.push({
        gruppe: n.katalogId ?? l.familie,
        beskrivelse: `${n.navn} — ${l.kode}`,
        grundlag: 'løbende meter',
        maal: `${l.antal} modul(er)${l.modulbreddeM ? ` à ${komma(l.modulbreddeM)} m` : ''} = ${komma(l.laengdeM)} m`,
        noegletal: `${komma(n.kwPrM)} kW/m`,
        kw, antal: l.antal, kwPrEnhed: Math.round(kw / Math.max(1, l.antal) * 1000) / 1000, fallback: false,
        katalogId: n.katalogId,
        tillid: Math.round(Math.min(l.tillid, n.tillid) * 100) / 100,
        kilde: n.kilde,
        forklaring: `${l.forklaring} ${komma(l.laengdeM)} m × ${komma(n.kwPrM)} kW/m = ${komma(kw)} kW.`,
      });
    });
  });

  /* b) Arealbaserede poster pr. rum */
  rum.forEach((r) => {
    if (!r.arealM2) return;
    NT.prM2Rum.filter((n) => n.rum.includes(r.rumtype)).forEach((n) => {
      const kw = Math.round(r.arealM2! * n.wPrM2 / 1000 * 100) / 100;
      if (kw <= 0) return;
      linjer.push({
        gruppe: n.katalogId ?? n.id,
        beskrivelse: `${n.navn} — ${r.navn}`,
        grundlag: 'areal',
        maal: `${komma(r.arealM2!, 0)} m²`,
        noegletal: `${komma(n.wPrM2, 1)} W/m²`,
        kw, antal: null, kwPrEnhed: null, fallback: !!n.fallback,
        katalogId: n.katalogId,
        tillid: Math.round(Math.min(r.tillid, n.tillid) * 100) / 100,
        kilde: n.kilde,
        forklaring: `${komma(r.arealM2!, 0)} m² × ${komma(n.wPrM2, 1)} W/m² = ${komma(kw)} kW.`
          + (n.fallback ? ' Groft afdelingsnøgletal — erstattes af maskinlisten, når den findes.' : ''),
      });
    });
  });

  /* c) Stykbaserede poster fundet som tekst på tegningen */
  const tekstFlade = side.tekster.map((t) => t.tekst.toLowerCase()).join(' | ');
  const taelTekst = (monster: RegExp) => side.tekster.filter((t) => monster.test(t.tekst.toLowerCase())).length;
  const stkKilder: { id: string; monster: RegExp }[] = [
    { id: 'kasse', monster: /kasse(bord|linje)?$|^kasse/ },
    { id: 'sco', monster: /sco|scan\s*&?\s*betal|selvbetjening/ },
    { id: 'skydedoer', monster: /skydedør|automatisk dør/ },
    { id: 'luftgardin', monster: /luftgardin|vindfang/ },
    { id: 'hurtigport', monster: /hurtigport/ },
    { id: 'flaskeautomat', monster: /flaskeautomat|pantautomat/ },
  ];
  stkKilder.forEach((s) => {
    const antal = taelTekst(s.monster);
    if (!antal) return;
    const n = NT.prEnhed.find((e) => e.id === s.id);
    if (!n) return;
    const kw = Math.round(antal * n.kw * 100) / 100;
    linjer.push({
      gruppe: n.katalogId ?? n.id, beskrivelse: n.navn, grundlag: 'stk',
      maal: `${antal} stk.`, noegletal: `${komma(n.kw)} kW/stk.`, kw,
      antal, kwPrEnhed: n.kw, fallback: false, katalogId: n.katalogId,
      tillid: Math.round(n.tillid * 0.9 * 100) / 100, kilde: n.kilde,
      forklaring: `${antal} forekomst(er) fundet som tekst på tegningen × ${komma(n.kw)} kW.`,
    });
  });
  if (!tekstFlade.includes('kasse')) advarsler.push('Ingen kasselinje fundet på tegningen — antal kasser skal indtastes manuelt.');

  const salg = rum.find((r) => r.rumtype === 'salgslokale');
  const lager = rum.filter((r) => ['lager', 'depot', 'flaskerum'].includes(r.rumtype)).reduce((s, r) => s + (r.arealM2 || 0), 0);
  const ovrigt = rum.filter((r) => ['personalerum', 'kontor', 'ovrigt', 'teknik', 'vindfang'].includes(r.rumtype)).reduce((s, r) => s + (r.arealM2 || 0), 0);
  const tilvalg: string[] = [];
  if (rum.some((r) => r.rumtype === 'deli')) tilvalg.push('deli', 'bakeoff');
  if (rum.some((r) => r.rumtype === 'slagter')) tilvalg.push('slagter');
  if (rum.some((r) => ['køl', 'frost', 'mejerikøl'].includes(r.rumtype))) tilvalg.push('centralkoel');
  if (/flaskeautomat|flaskerum/.test(tekstFlade)) tilvalg.push('flaskeautomat');

  const samletKw = Math.round(linjer.reduce((s, l) => s + l.kw, 0) * 10) / 10;
  const samletKwUdenFallback = Math.round(linjer.filter((l) => !l.fallback).reduce((s, l) => s + l.kw, 0) * 10) / 10;
  const gennemsnitligTillid = linjer.length
    ? Math.round(linjer.reduce((s, l) => s + l.tillid * l.kw, 0) / Math.max(samletKw, 0.001) * 100) / 100
    : 0;

  return {
    skala, rum, loeb, linjer, samletKw, samletKwUdenFallback, gennemsnitligTillid, advarsler,
    stamdataForslag: {
      ...(salg?.arealM2 ? { salgsAreal: Math.round(salg.arealM2) } : {}),
      ...(lager ? { lagerAreal: Math.round(lager) } : {}),
      ...(ovrigt ? { ovrigtAreal: Math.round(ovrigt) } : {}),
      ...(tilvalg.length ? { tilvalg: [...new Set(tilvalg)] } : {}),
    },
  };
}

/* ---------- 5. Kalkule → forbrugerliste ---------- */

/** Samler kalkulens linjer pr. katalogpost og laver rigtige forbrugerrækker af dem. */
export function kalkuleTilForbrugere(kalkule: Tegningskalkule, katalog: KatalogPost[], stam: Stamdata): Forbruger[] {
  const prKatalogId = new Map<string, Kalkulationslinje[]>();
  kalkule.linjer.filter((l) => l.katalogId).forEach((l) => {
    prKatalogId.set(l.katalogId!, [...(prKatalogId.get(l.katalogId!) || []), l]);
  });

  const ud: Forbruger[] = [];
  prKatalogId.forEach((linjer, katalogId) => {
    const post = katalog.find((k) => k.id === katalogId);
    if (!post) return;
    const kw = linjer.reduce((s, l) => s + l.kw, 0);
    const antal = linjer.every((l) => l.antal) ? linjer.reduce((s, l) => s + (l.antal || 0), 0) : null;
    const f = postTilForbruger(post, stam, 'Tegning');
    f.antal = antal ?? 1;
    f.kw = Math.round((antal ? kw / antal : kw) * 1000) / 1000;
    f.note = [f.note, linjer.map((l) => l.forklaring).join(' ')].filter(Boolean).join(' ').trim();
    ud.push(f);
  });
  return ud;
}
