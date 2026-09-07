/* Beregningskerne for belastningsoversigten.
   Ren funktion af (stamdata, forbrugerliste) → resultat. Ingen afhængigheder.
   Alle formler er dokumenteret i docs/02-beregningsregler.md. */

import type {
  Anbefaling, BeregnetForbruger, Fasebalance, Forbruger, Karakteristik, KatalogPost,
  Komfortkoel, Metode, Niveau, Resultat, Stamdata, Tjek,
} from './typer';
import { KABEL_TABEL, KONSTANTER, MCB_RAEKKE, HOVEDAFBRYDER_RAEKKE, REFERENCE_A_PR_M2 } from './data';

const UDLOESNING: Record<Karakteristik, number> = KONSTANTER.udloesningsfaktor;

export const afrund = (v: number, dec = 1): number => {
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
};

export const naeste = (v: number, raekke: number[]): number =>
  raekke.find((x) => x >= v - 1e-9) ?? raekke[raekke.length - 1];

/* ---------- 1. Stamdata → forbrugerliste ---------- */

export function skalerPost(post: KatalogPost, stam: Stamdata): { antal: number; kw: number } {
  const { type, vaerdi } = post.skalering;
  const v = vaerdi ?? 1;
  const lager = (stam.lagerAreal || 0) + (stam.ovrigtAreal || 0);
  switch (type) {
    case 'fast': return { antal: v, kw: post.kw };
    case 'm2salg': return { antal: Math.max(1, Math.round((stam.salgsAreal || 0) / v)), kw: post.kw };
    case 'm2lager': return { antal: Math.max(1, Math.round(lager / v)), kw: post.kw };
    case 'kasser': return { antal: Math.max(1, (stam.kasser || 0) + (stam.sco || 0)), kw: post.kw };
    case 'sco': return { antal: Math.max(1, stam.sco || 0), kw: post.kw };
    case 'wm2salg': return { antal: 1, kw: afrund((stam.salgsAreal || 0) * v / 1000) };
    case 'wm2lager': return { antal: 1, kw: Math.max(0.5, afrund(lager * v / 1000)) };
    case 'kwm2salg': return { antal: 1, kw: afrund((stam.salgsAreal || 0) * v) };
    case 'ladestander': return { antal: Math.max(1, stam.ladestandere || 1), kw: post.kw };
    case 'pv': return { antal: 1, kw: -Math.abs(afrund((stam.pvKwp || 0) * 0.8)) };
    default: return { antal: 1, kw: post.kw };
  }
}

export function postTilForbruger(post: KatalogPost, stam: Stamdata, kilde?: string): Forbruger {
  const { antal, kw } = skalerPost(post, stam);
  return {
    raekkeId: post.id,
    katalogId: post.id,
    aktiv: true,
    tavle: post.tavle,
    afdeling: post.afdeling,
    rum: post.rum,
    gruppe: post.id,
    navn: post.navn,
    antal, kw,
    spaending: post.spaending,
    cosphi: post.cosphi,
    df: post.df,
    karakteristik: post.karakteristik,
    rcd: post.rcd,
    noedforsyning: post.noedforsyning,
    bimaaler: post.bimaaler,
    varmeAfgivelse: post.varmeAfgivelse,
    kategori: post.kategori,
    laengde: 25,
    grupper: null,
    mcb: null,
    mm2: null,
    kilde: kilde || post.kilde || 'Skaleret erfaring',
    note: post.note || '',
  };
}

export function genererForbrugerliste(stam: Stamdata, katalog: KatalogPost[]): Forbruger[] {
  const valgte = new Set(stam.tilvalg || []);
  return katalog
    .filter((p) => !p.tilvalg || valgte.has(p.tilvalg))
    .map((p) => postTilForbruger(p, stam))
    .filter((f) => f.antal > 0 && f.kw !== 0);
}

/* ---------- 2. Strøm, gruppedannelse, kabel ---------- */

export function stroem(kw: number, spaending: number, cosphi: number): number {
  const p = Math.abs(kw) * 1000;
  if (!p) return 0;
  return spaending >= 400 ? p / (Math.sqrt(3) * 400 * cosphi) : p / (230 * cosphi);
}

export function autoGrupper(f: Forbruger): number {
  if (f.kategori === 'stik' && f.antal > 1) return Math.ceil(f.antal / KONSTANTER.stikPrGruppe);
  if (f.kategori === 'lys' && f.antal === 1) return Math.max(1, Math.ceil(stroem(f.kw, f.spaending, f.cosphi) / 13));
  if (f.antal > 1 && f.kw >= 3) return f.antal;
  if (f.antal > 1 && f.kategori === 'koel') return Math.ceil(f.antal / 4);
  return 1;
}

export function kabelIz(mm2: number, metode: Metode, treFaset: boolean): number {
  const r = KABEL_TABEL.find((k) => k.mm2 === mm2);
  if (!r) return 0;
  return (r as unknown as Record<string, number>)[metode + (treFaset ? '3' : '1')] ?? 0;
}

export function spaendingsfaldPct(ib: number, laengde: number, mm2: number, treFaset: boolean, cosphi: number): number {
  if (!mm2 || !laengde) return 0;
  const r = KONSTANTER.rhoCu * laengde / mm2;
  const du = treFaset ? Math.sqrt(3) * ib * r * cosphi : 2 * ib * r * cosphi;
  return du / (treFaset ? 400 : 230) * 100;
}

export function vaelgKabel(ib: number, mcb: number, metode: Metode, treFaset: boolean, laengde: number, cosphi: number, maxFald: number): number {
  for (const k of KABEL_TABEL) {
    if (kabelIz(k.mm2, metode, treFaset) < mcb) continue;
    if (spaendingsfaldPct(ib, laengde, k.mm2, treFaset, cosphi) > maxFald) continue;
    return k.mm2;
  }
  return KABEL_TABEL[KABEL_TABEL.length - 1].mm2;
}

export function kortslutning(ikHovedKa: number, laengde: number, mm2: number) {
  const zForsyning = KONSTANTER.cMin * 400 / (Math.sqrt(3) * ikHovedKa * 1000);
  const rKabel = KONSTANTER.rhoCu * laengde / (mm2 || 1.5);
  const ik3 = KONSTANTER.cMin * 400 / (Math.sqrt(3) * (zForsyning + rKabel));
  const ik1 = KONSTANTER.cMin * 230 / (zForsyning + 2 * rKabel);
  return { ik3, ik1 };
}

export function beregnForbruger(f: Forbruger, stam: Stamdata): BeregnetForbruger {
  const metode = (stam.metode || 'A') as Metode;
  const motorFaktor = stam.motorFaktor ?? KONSTANTER.motorfaktorMcb;
  const maxFald = stam.maxFaldPct ?? KONSTANTER.maksSpaendingsfaldPct;
  const ikHoved = stam.ikHoved ?? 10;

  const treFaset = f.spaending >= 400;
  const instKw = f.antal * f.kw;
  const belKw = instKw * f.df;
  const antalGrupper = Math.max(1, f.grupper || autoGrupper(f));
  const kwPrGruppe = Math.abs(instKw) / antalGrupper;
  const ibGruppe = stroem(kwPrGruppe, f.spaending, f.cosphi);
  const ibRaekke = stroem(Math.abs(belKw), f.spaending, f.cosphi);
  const faktor = ['maskine', 'koel', 'hvac'].includes(f.kategori) ? motorFaktor : 1;
  const autoMcb = Math.max(10, naeste(ibGruppe * faktor, MCB_RAEKKE));
  const valgtMcb = f.mcb || autoMcb;
  const valgtMm2 = f.mm2 || vaelgKabel(ibGruppe, valgtMcb, metode, treFaset, f.laengde, f.cosphi, maxFald);
  const iz = kabelIz(valgtMm2, metode, treFaset);
  const faldPct = spaendingsfaldPct(ibGruppe, f.laengde, valgtMm2, treFaset, f.cosphi);
  const { ik3, ik1 } = kortslutning(ikHoved, f.laengde, valgtMm2);
  const ikMin = treFaset ? Math.min(ik3, ik1) : ik1;
  const ia = UDLOESNING[f.karakteristik] * valgtMcb;

  return {
    ...f, treFaset, instKw, belKw, antalGrupper, kwPrGruppe, ibGruppe, ibRaekke,
    valgtMcb, autoMcb, valgtMm2, iz, faldPct, ik3, ik1, ikMin, ia,
    kabel: (treFaset ? '5G' : '3G') + String(valgtMm2).replace('.', ','),
    udnyttelse: valgtMcb ? ibGruppe / valgtMcb : 0,
    okKabel: iz >= valgtMcb,
    okFald: faldPct <= maxFald + 1e-9,
    okUdloesning: ikMin >= ia,
    moduler: treFaset ? 4 : 2,
  };
}

/* ---------- 3. Fasebalance ---------- */

export function fasebalance(raekker: BeregnetForbruger[]): Fasebalance {
  const faser = [0, 0, 0];
  const enFasede: { kva: number }[] = [];
  raekker.forEach((r) => {
    if (r.belKw <= 0) return;
    const kvaPrGruppe = (r.belKw / r.cosphi) / r.antalGrupper;
    for (let i = 0; i < r.antalGrupper; i++) {
      if (r.treFaset) { faser[0] += kvaPrGruppe / 3; faser[1] += kvaPrGruppe / 3; faser[2] += kvaPrGruppe / 3; }
      else enFasede.push({ kva: kvaPrGruppe });
    }
  });
  enFasede.sort((a, b) => b.kva - a.kva).forEach((e) => {
    const i = faser.indexOf(Math.min(...faser));
    faser[i] += e.kva;
  });
  const faseA = faser.map((kva) => kva * 1000 / 230);
  const maxA = Math.max(...faseA);
  const gnsA = faseA.reduce((a, b) => a + b, 0) / 3;
  return { faseKva: faser, faseA, maxA, gnsA, skaevhedPct: gnsA ? (maxA - gnsA) / gnsA * 100 : 0 };
}

/* ---------- 4. Komfortkøl ---------- */

export function komfortkoel(raekker: BeregnetForbruger[], stam: Stamdata): Komfortkoel {
  const salg = stam.salgsAreal || 0;
  const iSalg = raekker.filter((r) => r.belKw > 0 && r.rum === 'salg');
  const udstyr = iSalg.filter((r) => r.kategori !== 'lys' && r.kategori !== 'hvac')
    .reduce((s, r) => s + r.belKw * r.varmeAfgivelse, 0);
  const lys = raekker.filter((r) => r.kategori === 'lys').reduce((s, r) => s + r.belKw * r.varmeAfgivelse, 0);
  const personer = Math.ceil(salg / (stam.m2PrPerson || 10)) * (stam.wPrPerson || 100) / 1000;
  const sol = salg * (stam.solWm2 ?? 15) / 1000;
  const total = udstyr + lys + personer + sol;
  const ventKoel = stam.ventilationKoelKw || 0;
  const underskud = Math.max(0, total - ventKoel);
  const anbefalet = afrund(Math.ceil(underskud * 1.1 * 2) / 2);
  const plugin = iSalg.filter((r) => r.kategori === 'koel').reduce((s, r) => s + r.belKw * r.varmeAfgivelse, 0);
  const tommelfinger = afrund(Math.max(0, salg * 0.03 + 0.8 * plugin - ventKoel));
  const installeretKoelKw = afrund(raekker.filter((r) => /varmepumpe|komfortk/i.test(r.navn))
    .reduce((s, r) => s + r.instKw * (stam.copKoel || 2.8), 0));
  return {
    udstyr, lys, personer, sol, total, ventKoel, underskud, anbefalet, tommelfinger,
    enheder: Math.max(1, Math.ceil(anbefalet / 8)), installeretKoelKw,
    daekning: anbefalet ? installeretKoelKw / anbefalet : 1,
  };
}

/* ---------- 5. Ampererettighed: beregning mod målte referencebutikker ----------
   Beregnede lister ligger typisk 40–70 % over målt 15-minutters peak, fordi datablade
   angiver mærkeeffekt og ikke driftseffekt. Kabler og tavle dimensioneres efter
   beregningen, mens ampererettigheden købes efter et vægtet skøn. */

export function anbefalRettighed(maxA: number, salgsAreal: number, bufferPct: number): Anbefaling {
  const refMin = salgsAreal * REFERENCE_A_PR_M2.min;
  const refMax = salgsAreal * REFERENCE_A_PR_M2.max;
  const beregnetHovedsikring = naeste(maxA * (1 + bufferPct / 100), HOVEDAFBRYDER_RAEKKE);
  const referenceHovedsikring = naeste(refMax * (1 + bufferPct / 100), HOVEDAFBRYDER_RAEKKE);
  const afvigelse = refMax ? maxA / refMax : 1;
  const stortSpring = afvigelse > 1.5;
  const foreslaaetRettighed = stortSpring
    ? naeste(Math.max(refMax * 1.3, maxA * 0.75), HOVEDAFBRYDER_RAEKKE)
    : beregnetHovedsikring;
  return {
    beregnetA: maxA, beregnetHovedsikring, referenceA: [refMin, refMax], referenceHovedsikring,
    afvigelse, foreslaaetRettighed, dimensionerKabelOgTavleTil: beregnetHovedsikring,
    begrundelse: stortSpring
      ? `Beregningen (${maxA.toFixed(0)} A) er ${((afvigelse - 1) * 100).toFixed(0)} % over målt peak i sammenlignelige butikker (${refMin.toFixed(0)}–${refMax.toFixed(0)} A). Køb ${foreslaaetRettighed} A ampererettighed, men dimensionér hovedkabel og tavle til ${beregnetHovedsikring} A, så rettigheden kan opskrives uden ombygning.`
      : `Beregningen ligger inden for referenceintervallet (${refMin.toFixed(0)}–${refMax.toFixed(0)} A). Bestil ${beregnetHovedsikring} A og dimensionér kabel og tavle til samme.`,
  };
}

/* ---------- 6. Samlet beregning ---------- */

export function beregn(stam: Stamdata, forbrugere: Forbruger[]): Resultat {
  const raekker = forbrugere.map((f) => beregnForbruger(f, stam));
  const aktive = raekker.filter((r) => r.aktiv);
  const forbrug = aktive.filter((r) => r.kategori !== 'pv');
  const pv = aktive.filter((r) => r.kategori === 'pv');

  const instKw = forbrug.reduce((s, r) => s + r.instKw, 0);
  const belKw = forbrug.reduce((s, r) => s + r.belKw, 0);
  const kva = forbrug.reduce((s, r) => s + r.belKw / r.cosphi, 0);
  const balance = fasebalance(forbrug);

  const bufferPct = stam.bufferPct ?? 15;
  const dimA = balance.maxA * (1 + bufferPct / 100);
  const anbefaletHovedsikring = naeste(dimA, HOVEDAFBRYDER_RAEKKE);
  const valgtHovedsikring = stam.valgtHoved || anbefaletHovedsikring;
  const hovedkabelKravA = balance.maxA / (KONSTANTER.maksHovedkabelBelastningPct / 100);
  const hovedkabelMm2 = KABEL_TABEL.find((k) => kabelIz(k.mm2, 'C', true) >= hovedkabelKravA)?.mm2
    ?? KABEL_TABEL[KABEL_TABEL.length - 1].mm2;

  const antalGrupper = forbrug.reduce((s, r) => s + r.antalGrupper, 0);
  const moduler = forbrug.reduce((s, r) => s + r.antalGrupper * r.moduler, 0);
  const tavleReservePct = stam.tavleReservePct ?? 30;
  const modulerMedReserve = Math.ceil(moduler * (1 + tavleReservePct / 100));

  const noed = forbrug.filter((r) => r.noedforsyning);
  const noedKw = noed.reduce((s, r) => s + r.belKw, 0);
  const noedA = noed.reduce((s, r) => s + r.belKw / r.cosphi, 0) * 1000 / (Math.sqrt(3) * 400);

  const kk = komfortkoel(forbrug, stam);
  const salg = stam.salgsAreal || 1;
  const noegletal = {
    wPrM2Inst: instKw * 1000 / salg,
    wPrM2Bel: belKw * 1000 / salg,
    aPrM2: balance.maxA / salg,
    samletDf: instKw ? belKw / instKw : 0,
    referenceA: [salg * REFERENCE_A_PR_M2.min, salg * REFERENCE_A_PR_M2.max] as [number, number],
  };

  const anbefaling = anbefalRettighed(balance.maxA, salg, bufferPct);
  const tjek = kvalitetstjek({
    balance, bufferPct, valgtHovedsikring, anbefaletHovedsikring, hovedkabelMm2,
    forbrug, noedA, tavleReservePct, moduler, antalGrupper, komfort: kk, stam, anbefaling,
  });

  return {
    raekker, forbrug, instKw, belKw, kva, cosphiSamlet: kva ? belKw / kva : 0.9, balance,
    bufferPct, dimA, anbefaletHovedsikring, valgtHovedsikring, hovedkabelKravA, hovedkabelMm2,
    antalGrupper, moduler, modulerMedReserve, noedKw, noedA, komfortkoel: kk, noegletal, tjek, anbefaling,
    pvKw: pv.reduce((s, r) => s + Math.abs(r.instKw), 0),
  };
}

interface TjekInput {
  balance: Fasebalance; bufferPct: number; valgtHovedsikring: number; anbefaletHovedsikring: number;
  hovedkabelMm2: number; forbrug: BeregnetForbruger[]; noedA: number; tavleReservePct: number;
  moduler: number; antalGrupper: number; komfort: Komfortkoel; stam: Stamdata; anbefaling: Anbefaling;
}

export function kvalitetstjek(d: TjekInput): Tjek[] {
  const t: Tjek[] = [];
  const put = (ok: boolean, krav: string, faktisk: string, note = '', niveau: Niveau = 'krav') =>
    t.push({ ok, niveau, krav, faktisk, note });

  put(d.balance.maxA * (1 + d.bufferPct / 100) <= d.valgtHovedsikring,
    `Belastning + ${d.bufferPct} % buffer ≤ valgt hovedsikring (${d.valgtHovedsikring} A)`,
    `${d.balance.maxA.toFixed(0)} A → ${(d.balance.maxA * (1 + d.bufferPct / 100)).toFixed(0)} A`,
    d.valgtHovedsikring < d.anbefaletHovedsikring ? `Beregningen peger på mindst ${d.anbefaletHovedsikring} A` : '');

  const iz = kabelIz(d.hovedkabelMm2, 'C', true);
  put(d.balance.maxA <= iz * 0.70, 'Hovedkabel belastes maks. 70 %',
    `${d.balance.maxA.toFixed(0)} A af ${iz} A (5G${d.hovedkabelMm2}) = ${iz ? (d.balance.maxA / iz * 100).toFixed(0) : '–'} %`);

  put(d.tavleReservePct >= 30, 'Min. 30 % reserveplads i tavlen',
    `${d.tavleReservePct} % oven på ${d.moduler} moduler i brug`);

  put(true, 'Min. 10 % disponible afgange',
    `${Math.ceil(d.antalGrupper * 0.1)} afgange ud over ${d.antalGrupper} i brug`, 'Reserveres i tavlebestillingen');

  const dcLast = d.forbrug.filter((r) => /varmepumpe|flaskeautomat|ladestander|kondensaggregat|frekvens|solcelle|komfortk/i.test(`${r.navn} ${r.note}`));
  const mangler = dcLast.filter((r) => !/B/.test(r.rcd));
  put(mangler.length === 0, 'Type B RCD på DC-lækkende laster',
    mangler.length ? `Mangler på: ${mangler.map((r) => r.gruppe).join(', ')}` : `${dcLast.length} grupper med type B`);

  put(d.forbrug.every((r) => r.valgtMcb <= 100), 'Maks. 100 A forsikring foran RCD/RCBO',
    `Største gruppeafbryder: ${Math.max(0, ...d.forbrug.map((r) => r.valgtMcb))} A`);

  put(d.noedA <= 125, 'Kritiske laster kan forsynes via 125 A CEE (nødgenerator)',
    `${d.noedA.toFixed(0)} A ved nøddrift`);

  const kabelfejl = d.forbrug.filter((r) => !r.okKabel || !r.okFald);
  put(kabelfejl.length === 0, 'Kabler overholder I_z ≥ I_n og spændingsfald',
    kabelfejl.length ? `${kabelfejl.length} grupper skal efterses: ${kabelfejl.slice(0, 5).map((r) => r.gruppe).join(', ')}` : 'Alle grupper OK');

  const udloes = d.forbrug.filter((r) => !r.okUdloesning);
  put(udloes.length === 0, 'Automatisk afbrydelse ved kortslutning (I_k ≥ I_a)',
    udloes.length ? `${udloes.length} grupper: for lang eller for tynd ledning` : 'Alle grupper OK');

  put(!d.stam.tilvalg.includes('varmepumpe') || d.komfort.daekning >= 1,
    'Komfortkøl dækker varmebalancen',
    `${d.komfort.installeretKoelKw} kW installeret mod ${d.komfort.anbefalet} kW behov`);

  const [refMin, refMax] = d.anbefaling.referenceA;
  put(d.anbefaling.afvigelse <= 1.5, 'Beregning er på niveau med målte referencebutikker',
    `Beregnet ${d.balance.maxA.toFixed(0)} A mod reference ${refMin.toFixed(0)}–${refMax.toFixed(0)} A`,
    d.anbefaling.begrundelse, 'advarsel');

  return t;
}
