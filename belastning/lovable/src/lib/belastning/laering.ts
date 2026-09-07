/* Feedbackloop: rettelser fra brugerne gør modellen bedre til næste sag.
   Fire kredsløb, fra hurtigst til langsomst:
     1. Kodeordbog     – bekræftet tolkning af en tegningskode genbruges straks.
     2. Katalogforslag – gentagne rettelser af samme felt foreslås som ny standardværdi.
     3. Skalering      – rettede antal giver nye m²-nøgletal.
     4. Kalibrering    – målt forbrug i idriftsatte butikker retter forholdet
                         mellem beregning og virkelighed.
   Intet ændres automatisk i dimensioneringsdata: forslag skal godkendes. */

import type {
  Aarsag, Forbruger, Forslag, Kalibrering, Kalibreringspunkt, KatalogPost,
  Rettelse, Stamdata, Udtraeksstatistik,
} from './typer';

/** Felter, hvor en rettelse er interessant for modellen. */
export const LAERTE_FELTER = ['antal', 'kw', 'spaending', 'cosphi', 'df', 'karakteristik', 'rcd', 'varmeAfgivelse', 'noedforsyning', 'mcb', 'grupper', 'laengde'] as const;
const NUMERISKE = new Set(['antal', 'kw', 'spaending', 'cosphi', 'df', 'varmeAfgivelse', 'mcb', 'grupper', 'laengde']);
/** Felter, der er projektspecifikke af natur. De fanges som rettelser (til statistik og
    skaleringsregler), men bliver aldrig til forslag om nye katalogværdier. */
export const PROJEKTSPECIFIKKE_FELTER = new Set(['antal', 'laengde', 'grupper']);

export const median = (tal: number[]): number => {
  if (!tal.length) return NaN;
  const s = [...tal].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const hyppigste = <T>(vaerdier: T[]): T => {
  const t = new Map<T, number>();
  vaerdier.forEach((v) => t.set(v, (t.get(v) || 0) + 1));
  return [...t.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

/* ---------- 1. Fang rettelser ---------- */

/** Sammenligner det, modellen foreslog, med det brugeren gemte. */
export function registrerRettelser(
  foreslaaet: Forbruger[],
  gemt: Forbruger[],
  stam: Stamdata,
  projektId: string,
  aarsager: Record<string, Aarsag> = {},
): Rettelse[] {
  const foerPrRaekke = new Map(foreslaaet.map((f) => [f.raekkeId, f]));
  const ud: Rettelse[] = [];

  gemt.forEach((efter) => {
    const foer = foerPrRaekke.get(efter.raekkeId);
    if (!foer || !efter.katalogId) return;
    LAERTE_FELTER.forEach((felt) => {
      const a = (foer as unknown as Record<string, unknown>)[felt];
      const b = (efter as unknown as Record<string, unknown>)[felt];
      if (a === b || b === null || b === undefined) return;
      if (NUMERISKE.has(felt) && typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9) return;
      const aarsag = aarsager[`${efter.raekkeId}.${felt}`] ?? (efter.kilde === 'Datablad' ? 'datablad' : efter.kilde === 'Tegning' ? 'tegning' : efter.kilde === 'Maskinliste' ? 'maskinliste' : 'ukendt');
      ud.push({
        projektId, katalogId: efter.katalogId, butikstype: stam.butiksType, salgsAreal: stam.salgsAreal,
        felt, foer: a as number | string | boolean | null, efter: b as number | string | boolean | null,
        aarsag, kunDenneSag: aarsag === 'projektspecifikt',
        tidspunkt: new Date().toISOString(),
      });
    });
  });
  return ud;
}

/* ---------- 2. Forslag til nye katalogværdier ---------- */

export interface Taerskler { minObservationer: number; minProjekter: number; minAfvigelsePct: number; maksSpredningPct: number }
export const STANDARD_TAERSKLER: Taerskler = { minObservationer: 3, minProjekter: 2, minAfvigelsePct: 10, maksSpredningPct: 20 };

export function aggregerRettelser(rettelser: Rettelse[], katalog: KatalogPost[], t: Taerskler = STANDARD_TAERSKLER): Forslag[] {
  const grupper = new Map<string, Rettelse[]>();
  rettelser.filter((r) => !r.kunDenneSag && !PROJEKTSPECIFIKKE_FELTER.has(r.felt)).forEach((r) => {
    const noegle = `${r.katalogId}|${r.felt}`;
    grupper.set(noegle, [...(grupper.get(noegle) || []), r]);
  });

  const forslag: Forslag[] = [];
  grupper.forEach((raekke, noegle) => {
    const [katalogId, felt] = noegle.split('|');
    const post = katalog.find((k) => k.id === katalogId);
    const nuvaerende = post ? ((post as unknown as Record<string, unknown>)[felt] ?? null) as number | string | null : null;
    const projekter = new Set(raekke.map((r) => r.projektId)).size;
    const aarsager: Record<string, number> = {};
    raekke.forEach((r) => { aarsager[r.aarsag] = (aarsager[r.aarsag] || 0) + 1; });

    let foreslaaet: number | string;
    let spredningPct: number | null = null;
    let afvigelsePct: number | null = null;

    if (NUMERISKE.has(felt)) {
      const tal = raekke.map((r) => Number(r.efter)).filter((n) => isFinite(n));
      if (!tal.length) return;
      const med = median(tal);
      foreslaaet = Math.round(med * 1000) / 1000;
      const afvigelser = tal.map((v) => Math.abs(v - med));
      spredningPct = med ? median(afvigelser) / Math.abs(med) * 100 : null;
      afvigelsePct = typeof nuvaerende === 'number' && nuvaerende ? (med - nuvaerende) / nuvaerende * 100 : null;
    } else {
      foreslaaet = hyppigste(raekke.map((r) => String(r.efter)));
      afvigelsePct = foreslaaet === String(nuvaerende) ? 0 : null;
    }

    const nokData = raekke.length >= t.minObservationer && projekter >= t.minProjekter;
    const stabil = spredningPct === null || spredningPct <= t.maksSpredningPct;
    const stortNok = afvigelsePct === null || Math.abs(afvigelsePct) >= t.minAfvigelsePct;
    const projektspecifik = (aarsager.projektspecifikt || 0) > raekke.length / 2;

    let anbefaling: Forslag['anbefaling'] = 'afvent';
    let begrundelse = `${raekke.length} rettelse(r) fra ${projekter} projekt(er) — der mangler data, før værdien bør ændres.`;
    if (nokData && stabil && stortNok && !projektspecifik) {
      anbefaling = 'godkend';
      begrundelse = `${raekke.length} rettelser fra ${projekter} projekter peger samstemmende på ${foreslaaet}`
        + (afvigelsePct !== null ? ` (${afvigelsePct > 0 ? '+' : ''}${afvigelsePct.toFixed(0)} % i forhold til katalogets ${nuvaerende}).` : '.')
        + (aarsager.datablad ? ` ${aarsager.datablad} af dem stammer fra datablade.` : '');
    } else if (nokData && !stabil) {
      anbefaling = 'undersøg';
      begrundelse = `${raekke.length} rettelser, men de spreder sig ${spredningPct?.toFixed(0)} % omkring medianen. Posten dækker formentlig flere forskellige apparater og bør deles op.`;
    } else if (nokData && projektspecifik) {
      anbefaling = 'undersøg';
      begrundelse = 'Rettelserne er markeret som projektspecifikke. Overvej en variant pr. butikstype i stedet for en ny standardværdi.';
    }

    forslag.push({ katalogId, felt, nuvaerende, foreslaaet, observationer: raekke.length, projekter, spredningPct, afvigelsePct, aarsager, anbefaling, begrundelse });
  });

  return forslag.sort((a, b) => (b.anbefaling === 'godkend' ? 1 : 0) - (a.anbefaling === 'godkend' ? 1 : 0) || b.observationer - a.observationer);
}

/** Anvender et godkendt forslag og returnerer både nyt katalog og en historikpost. */
export function anvendForslag(katalog: KatalogPost[], forslag: Forslag, godkendtAf: string) {
  const historik = { katalogId: forslag.katalogId, felt: forslag.felt, foer: forslag.nuvaerende, efter: forslag.foreslaaet, godkendtAf, tidspunkt: new Date().toISOString(), begrundelse: forslag.begrundelse };
  const nyt = katalog.map((k) => (k.id === forslag.katalogId ? { ...k, [forslag.felt]: forslag.foreslaaet } : k));
  return { katalog: nyt, historik };
}

/* ---------- 3. Skaleringsregler ---------- */

/** Rettede antal fortæller, hvor mange m² der reelt går pr. enhed. */
export function skaleringsforslag(rettelser: Rettelse[], katalog: KatalogPost[], minObservationer = 4): Forslag[] {
  const antalRettelser = rettelser.filter((r) => r.felt === 'antal' && !r.kunDenneSag && Number(r.efter) > 0);
  const grupper = new Map<string, Rettelse[]>();
  antalRettelser.forEach((r) => grupper.set(r.katalogId, [...(grupper.get(r.katalogId) || []), r]));

  const ud: Forslag[] = [];
  grupper.forEach((raekke, katalogId) => {
    const post = katalog.find((k) => k.id === katalogId);
    if (!post || !['m2salg', 'm2lager'].includes(post.skalering.type)) return;
    if (raekke.length < minObservationer) return;
    const m2PrEnhed = raekke.map((r) => r.salgsAreal / Number(r.efter)).filter((n) => isFinite(n) && n > 0);
    const med = Math.round(median(m2PrEnhed));
    const nu = post.skalering.vaerdi ?? 0;
    const afvigelsePct = nu ? (med - nu) / nu * 100 : null;
    const spredningPct = med ? median(m2PrEnhed.map((v) => Math.abs(v - med))) / med * 100 : null;
    ud.push({
      katalogId, felt: 'skalering.vaerdi', nuvaerende: nu, foreslaaet: med,
      observationer: raekke.length, projekter: new Set(raekke.map((r) => r.projektId)).size,
      spredningPct, afvigelsePct, aarsager: {},
      anbefaling: afvigelsePct !== null && Math.abs(afvigelsePct) >= 15 && (spredningPct ?? 0) <= 25 ? 'godkend' : 'afvent',
      begrundelse: `Målt på ${raekke.length} sager svarer det til ét stk. pr. ${med} m² salgsareal (katalog: ${nu} m²).`,
    });
  });
  return ud;
}

/* ---------- 4. Kalibrering mod målt forbrug ---------- */

export function kalibrer(punkter: Kalibreringspunkt[]): Kalibrering {
  if (!punkter.length) {
    return { antal: 0, faktor: null, aPrM2: null, prButikstype: {}, anbefaling: 'Ingen målinger endnu. Registrér målt 15-minutters peak, når butikkerne er i drift — det er den eneste vej til at gøre beregningen skarpere.' };
  }
  const faktorer = punkter.map((p) => p.maaltPeakA / p.beregnetA).filter((n) => isFinite(n) && n > 0);
  const aPrM2 = punkter.map((p) => p.maaltPeakA / p.salgsAreal).filter((n) => isFinite(n) && n > 0).sort((a, b) => a - b);
  const prButikstype: Kalibrering['prButikstype'] = {};
  const typer = new Set(punkter.map((p) => p.butikstype));
  typer.forEach((type) => {
    const delm = punkter.filter((p) => p.butikstype === type);
    prButikstype[type] = {
      antal: delm.length,
      faktor: Math.round(median(delm.map((p) => p.maaltPeakA / p.beregnetA)) * 100) / 100,
      aPrM2Median: Math.round(median(delm.map((p) => p.maaltPeakA / p.salgsAreal)) * 1000) / 1000,
    };
  });
  const faktor = Math.round(median(faktorer) * 100) / 100;
  return {
    antal: punkter.length, faktor,
    aPrM2: { min: aPrM2[0], median: median(aPrM2), max: aPrM2[aPrM2.length - 1] },
    prButikstype,
    anbefaling: punkter.length < 5
      ? `${punkter.length} måling(er): brug faktoren ${faktor} som pejlemærke, men vælg fortsat ampererettighed konservativt.`
      : `${punkter.length} målinger: beregningen rammer i gennemsnit ${(1 / faktor).toFixed(2)} × det målte peak. Referenceintervallet i modellen kan opdateres til ${aPrM2[0].toFixed(3)}–${aPrM2[aPrM2.length - 1].toFixed(3)} A/m².`,
  };
}

/* ---------- 5. Kvalitet i tegningsudtrækket ---------- */

export function udtraeksstatistik(par: { kode: string; laest: number; bekraeftet: number }[]): Udtraeksstatistik[] {
  const grupper = new Map<string, { laest: number; bekraeftet: number }[]>();
  par.forEach((p) => grupper.set(p.kode, [...(grupper.get(p.kode) || []), p]));
  const ud: Udtraeksstatistik[] = [];
  grupper.forEach((raekke, kode) => {
    const afvigelser = raekke.map((r) => (r.bekraeftet - r.laest) / Math.max(1, r.laest));
    const gns = afvigelser.reduce((a, b) => a + b, 0) / afvigelser.length;
    const raet = raekke.filter((r) => r.laest === r.bekraeftet).length / raekke.length;
    let faldgrube: string | null = null;
    if (gns <= -0.25) faldgrube = `${kode} tælles systematisk for højt (${(gns * 100).toFixed(0)} %) — sandsynligvis tolkes tal på tegningen som styktal.`;
    else if (gns >= 0.25) faldgrube = `${kode} overses ofte (${(gns * 100).toFixed(0)} %) — symbolet er formentlig tegnet i flere lag.`;
    ud.push({ kode, forekomster: raekke.length, gennemsnitligAfvigelse: gns, raetForstePutte: raet, faldgrube });
  });
  return ud.sort((a, b) => Math.abs(b.gennemsnitligAfvigelse) - Math.abs(a.gennemsnitligAfvigelse));
}

/** Genererer de linjer, der lægges ind i vision-prompten som "kendte faldgruber". */
export function faldgruberTilPrompt(stat: Udtraeksstatistik[], minForekomster = 3): string[] {
  return stat.filter((s) => s.forekomster >= minForekomster && s.faldgrube).map((s) => `- ${s.faldgrube}`);
}

/* ---------- 6. Status til brugerfladen ---------- */

export function laeringsstatus(rettelser: Rettelse[], forslag: Forslag[], kalibrering: Kalibrering) {
  return {
    rettelser: rettelser.length,
    projekterMedRettelser: new Set(rettelser.map((r) => r.projektId)).size,
    forslagKlar: forslag.filter((f) => f.anbefaling === 'godkend').length,
    forslagTilUndersoegelse: forslag.filter((f) => f.anbefaling === 'undersøg').length,
    maalinger: kalibrering.antal,
    kalibreringsfaktor: kalibrering.faktor,
  };
}
