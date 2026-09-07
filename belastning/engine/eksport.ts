/* Bygger Excel-arkene til leverandør og elektriker.
   Layoutet følger docs/04-excel-eksport.md og de eksisterende ark, modtagerne kender.
   Selve filskrivningen sker i xlsx.mjs (ingen afhængigheder). */

import type { Resultat, Stamdata, Tegningskalkule } from './typer.ts';
import { SAMTIDIGHEDSFAKTORER, BYGGEPROGRAMKRAV, KABEL_TABEL, KONSTANTER, REFERENCEMAALINGER } from './data.ts';
// @ts-ignore – ren JS-modul uden typer
import { byggeXlsx, XLSX_STIL as S } from './xlsx.mjs';

type Celle = string | number | null | { v: string | number | null; s: number };
interface Ark { navn: string; raekker: Celle[][]; bredder?: number[]; frysRaekke?: number }

const H = (tekst: string): Celle => ({ v: tekst, s: S.OVERSKRIFT });
const T1 = (v: number): Celle => ({ v: Math.round(v * 10) / 10, s: S.TAL1 });
const T2 = (v: number): Celle => ({ v: Math.round(v * 100) / 100, s: S.TAL2 });
const T0 = (v: number): Celle => ({ v: Math.round(v), s: S.TAL0 });
const FED = (v: string | number): Celle => ({ v, s: S.FED });
const dato = () => new Date().toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });

/* ---------- 1. Forside ---------- */

function forside(stam: Stamdata, r: Resultat, kalkule?: Tegningskalkule): Ark {
  const daekning = r.forbrug.filter((f) => ['Tegning', 'Datablad', 'Maskinliste'].includes(f.kilde)).length;
  const a = r.anbefaling;
  const raekker: Celle[][] = [
    [{ v: 'Effektoversigt og hovedtavlebestilling', s: S.TITEL }],
    [],
    [FED('Projekt'), stam.butiksNavn || '–'],
    [FED('Adresse'), stam.adresse || '–'],
    [FED('Sagsnr.'), stam.sagsnr || '–'],
    [FED('Butikstype'), stam.butiksType],
    [FED('Salgsareal'), T0(stam.salgsAreal), 'm²'],
    [FED('Lager + øvrigt areal'), T0((stam.lagerAreal || 0) + (stam.ovrigtAreal || 0)), 'm²'],
    [FED('Dokument dateret'), dato()],
    [],
    [FED('Netform'), 'TN-S 3F+N+PE, 400/230 V, 50 Hz'],
    [FED('Installationsmetode, kabler'), `Reference ${stam.metode || 'A'}`],
    [FED('Kortslutningsstrøm ved hovedtavle'), T1(stam.ikHoved ?? 10), 'kA (oplyses af netselskab)'],
    [],
    [{ v: 'Resultat af beregningen', s: S.FED }],
    ['Total installeret effekt', T1(r.instKw), 'kW'],
    ['Samtidig belastning', T1(r.belKw), 'kW'],
    ['Samlet samtidighedsfaktor', T2(r.noegletal.samletDf)],
    ['Installeret effekt pr. m² salgsareal', T0(r.noegletal.wPrM2Inst), 'W/m²'],
    ['Maks. fasestrøm (fasebalanceret)', T0(r.balance.maxA), 'A'],
    ['Faseskævhed', T1(r.balance.skaevhedPct), '%'],
    ['Antal grupper', T0(r.antalGrupper)],
    ['Moduler i tavle inkl. reserve', T0(r.modulerMedReserve)],
    [],
    [{ v: 'Valg af ampererettighed', s: S.FED }],
    ['Beregnet, inkl. buffer', T0(a.beregnetHovedsikring), 'A'],
    ['Reference, målte sammenlignelige butikker', `${Math.round(a.referenceA[0])}–${Math.round(a.referenceA[1])}`, 'A'],
    ['Beregning i forhold til reference', T2(a.afvigelse), '×'],
    [FED('Foreslået ampererettighed'), FED(a.foreslaaetRettighed), 'A'],
    [FED('Hovedkabel og tavle dimensioneres til'), FED(a.dimensionerKabelOgTavleTil), 'A'],
    ['Begrundelse', a.begrundelse],
    [],
    [{ v: 'Grundlagets kvalitet', s: S.FED }],
    ['Rækker i alt', T0(r.forbrug.length)],
    ['Heraf fra tegning, datablad eller maskinliste', `${daekning} (${Math.round(daekning / Math.max(1, r.forbrug.length) * 100)} %)`],
    ...(kalkule ? [
      ['Tegning: fundet skala', `${kalkule.skala.metode}, ${kalkule.skala.mmPrEnhed.toFixed(2)} mm/enhed (tillid ${kalkule.skala.tillid.toFixed(2)})`] as Celle[],
      ['Tegning: beregnet effekt', T1(kalkule.samletKwUdenFallback), 'kW'],
    ] : []),
    [],
    [{ v: 'Udfyldes af leverandør', s: S.FED }],
    ['Tavlefabrikat og type', ''],
    ['Tilbudsnr. og dato', ''],
    ['Leveringstid', ''],
    ['Kontaktperson', ''],
  ];
  return { navn: 'Forside', bredder: [42, 46, 12], raekker };
}

/* ---------- 2. Effektliste ---------- */

function effektliste(r: Resultat): Ark {
  const raekker: Celle[][] = [[
    H('Mærkat'), H('Tavle'), H('Afdeling'), H('Gr.'), H('Forbruger'), H('Antal'), H('kW/stk'), H('V'),
    H('cos φ'), H('DF'), H('Inst. kW'), H('Belast. kW'), H('Grupper'), H('A/gruppe'), H('Sikring'),
    H('Kabel'), H('L [m]'), H('ΔU %'), H('RCD'), H('Bimåler'), H('Nød'), H('Kilde'), H('Noter'),
  ]];
  const taeller: Record<string, number> = {};
  r.raekker.filter((f) => f.aktiv).forEach((f) => {
    taeller[f.tavle] = (taeller[f.tavle] || 0) + 1;
    raekker.push([
      `${f.tavle}-F${String(taeller[f.tavle]).padStart(2, '0')}`, f.tavle, f.afdeling, f.gruppe, f.navn,
      T0(f.antal), T2(f.kw), f.spaending, T2(f.cosphi), T2(f.df), T2(f.instKw), T2(f.belKw),
      T0(f.antalGrupper), T1(f.ibGruppe), T0(f.valgtMcb), f.kabel, T0(f.laengde), T1(f.faldPct),
      f.rcd, f.bimaaler ? 'Ja' : '–', f.noedforsyning ? 'Ja' : '–', f.kilde, f.note || '',
    ]);
  });
  raekker.push([]);
  raekker.push([FED('SUM (ekskl. solceller)'), null, null, null, null, null, null, null, null, null,
    { v: Math.round(r.instKw * 10) / 10, s: S.FED }, { v: Math.round(r.belKw * 10) / 10, s: S.FED }]);
  raekker.push([FED('Maks. fasestrøm'), T0(r.balance.maxA), 'A', FED('Foreslået ampererettighed'), r.anbefaling.foreslaaetRettighed, 'A',
    FED('Kabel og tavle til'), r.anbefaling.dimensionerKabelOgTavleTil, 'A']);
  if (r.pvKw) raekker.push([FED('Solceller (produktion, ikke medregnet)'), T1(r.pvKw), 'kW']);
  return { navn: 'Effektliste', frysRaekke: 1, raekker, bredder: [11, 12, 20, 8, 40, 7, 9, 7, 8, 7, 10, 11, 9, 10, 9, 10, 8, 8, 12, 9, 7, 18, 46] };
}

/* ---------- 3. Gruppeskema ---------- */

function gruppeskema(r: Resultat): Ark {
  const kombinationer = new Map<string, { faser: number; kar: string; mcb: number }>();
  r.forbrug.forEach((f) => {
    const n = `${f.treFaset ? 3 : 1}P+N ${f.karakteristik}${f.valgtMcb}`;
    kombinationer.set(n, { faser: f.treFaset ? 3 : 1, kar: f.karakteristik, mcb: f.valgtMcb });
  });
  const kolonner = [...kombinationer.entries()].sort((a, b) => a[1].faser - b[1].faser || a[1].mcb - b[1].mcb).map(([n]) => n);
  const raekker: Celle[][] = [[H('Gr.'), H('Forbruger'), H('Antal'), H('V'), ...kolonner.map(H), H('Bemærkning')]];
  const sum = kolonner.map(() => 0);
  r.forbrug.forEach((f) => {
    const n = `${f.treFaset ? 3 : 1}P+N ${f.karakteristik}${f.valgtMcb}`;
    const i = kolonner.indexOf(n);
    sum[i] += f.antalGrupper;
    raekker.push([f.gruppe, f.navn, T0(f.antal), f.spaending,
      ...kolonner.map((_, j) => (j === i ? f.antalGrupper : null)),
      [f.noedforsyning ? 'Nødforsyning' : '', f.bimaaler ? 'Bimåler' : '', f.rcd].filter(Boolean).join(' · ')]);
  });
  raekker.push([]);
  raekker.push([FED('I alt'), null, null, null, ...sum.map((s) => FED(s)), FED(`${r.antalGrupper} grupper · ${r.moduler} moduler · ${r.modulerMedReserve} inkl. ${r.reservePct} % reserve`)]);
  return { navn: 'Gruppeskema', frysRaekke: 1, raekker, bredder: [9, 40, 7, 7, ...kolonner.map(() => 11), 48] };
}

/* ---------- 4. Mærkatliste ---------- */

function maerkatliste(stam: Stamdata, r: Resultat): Ark {
  const raekker: Celle[][] = [[H('Mærkat'), H('Tavle'), H('Gruppe'), H('Forbruger/beskrivelse'), H('Karakteristik'),
    H('Sikring'), H('Tværsnit'), H('L [m]'), H('Ref. installationsmetode'), H('Beskyttelse')]];
  const taeller: Record<string, number> = {};
  r.forbrug.forEach((f) => {
    taeller[f.tavle] = (taeller[f.tavle] || 0) + 1;
    raekker.push([`${f.tavle}-F${String(taeller[f.tavle]).padStart(2, '0')}`, f.tavle, f.gruppe, f.navn,
      f.karakteristik, `${f.valgtMcb} A`, f.kabel, T0(f.laengde), `${stam.metode || 'A'} – worst case`, f.rcd]);
  });
  return { navn: 'Mærkatliste', frysRaekke: 1, raekker, bredder: [12, 12, 9, 42, 13, 9, 11, 8, 24, 14] };
}

/* ---------- 5. Fasebalance ---------- */

function fasebalance(r: Resultat): Ark {
  const raekker: Celle[][] = [
    [{ v: 'Fordeling af 1-fasede grupper på L1, L2 og L3', s: S.FED }],
    [],
    [H('Fase'), H('kVA'), H('A'), H('Afvigelse fra gennemsnit %')],
    ...r.balance.faseA.map((a, i) => [`L${i + 1}`, T1(r.balance.faseKva[i]), T0(a), T1((a - r.balance.gnsA) / r.balance.gnsA * 100)] as Celle[]),
    [],
    [FED('Maks. fasestrøm'), T0(r.balance.maxA), 'A'],
    [FED('Gennemsnit'), T0(r.balance.gnsA), 'A'],
    [FED('Skævhed'), T1(r.balance.skaevhedPct), '%'],
    [],
    [{ v: 'Største 1-fasede grupper — kan flyttes ved skæv belastning', s: S.FED }],
    [H('Gr.'), H('Forbruger'), H('Belast. kW'), H('Grupper'), H('A/gruppe')],
    ...r.forbrug.filter((f) => !f.treFaset && f.belKw > 0).sort((a, b) => b.belKw - a.belKw).slice(0, 15)
      .map((f) => [f.gruppe, f.navn, T2(f.belKw), T0(f.antalGrupper), T1(f.ibGruppe)] as Celle[]),
  ];
  return { navn: 'Fasebalance', raekker, bredder: [12, 42, 12, 11, 26] };
}

/* ---------- 6. Nødforsyning ---------- */

function noedforsyning(r: Resultat): Ark {
  const noed = r.forbrug.filter((f) => f.noedforsyning);
  const raekker: Celle[][] = [
    [{ v: 'Kritiske komponenter, der skal kunne forsynes fra 125 A CEE-generatortilslutning', s: S.FED }],
    [],
    [H('Gr.'), H('Forbruger'), H('Belast. kW'), H('A/fase'), H('Sikring'), H('Bemærkning')],
    ...noed.map((f) => [f.gruppe, f.navn, T2(f.belKw), T1(f.ibRaekke), T0(f.valgtMcb), f.note || ''] as Celle[]),
    [],
    [FED('I alt'), null, T1(r.noedKw), T0(r.noedA), null, r.noedA <= 125 ? 'Inden for 125 A CEE' : 'OVER 125 A — skær ned i kritiske laster'],
  ];
  return { navn: 'Nødforsyning', frysRaekke: 3, raekker, bredder: [9, 42, 12, 11, 10, 48] };
}

/* ---------- 7. Komfortkøl ---------- */

function komfortkoel(stam: Stamdata, r: Resultat): Ark {
  const k = r.komfortkoel;
  return {
    navn: 'Komfortkøl', bredder: [46, 14, 46],
    raekker: [
      [{ v: 'Varmebalance for salgslokalet (sommer)', s: S.FED }],
      [],
      [H('Post'), H('kW'), H('Grundlag')],
      ['Udstyr i salgslokalet', T1(k.udstyr), 'Belastet effekt × varmeafgivelse pr. post'],
      ['Belysning', T1(k.lys), 'Lysgrupper × varmeafgivelse'],
      ['Personer', T1(k.personer), `1 person pr. ${stam.m2PrPerson || 10} m² à ${stam.wPrPerson || 100} W`],
      ['Sol og transmission', T1(k.sol), `${stam.solWm2 ?? 15} W/m² salgsareal`],
      [FED('Samlet varmelast'), FED(Math.round(k.total * 10) / 10), ''],
      ['Køleydelse i ventilationsaggregat', T1(-k.ventKoel), 'Indtastet på stamdata'],
      [FED('Underskud'), FED(Math.round(k.underskud * 10) / 10), ''],
      [],
      [FED('Anbefalet komfortkøl'), FED(k.anbefalet), 'Underskud + 10 %, rundet til nærmeste 0,5 kW'],
      ['Antal split-enheder', T0(k.enheder), 'Ved 8 kW pr. enhed'],
      ['Installeret køleeffekt i projektet', T1(k.installeretKoelKw), `Varmepumper × COP ${stam.copKoel || 2.8}`],
      ['Dækning', T2(k.daekning), k.daekning >= 1 ? 'Tilstrækkelig' : 'Utilstrækkelig — vælg større enheder'],
      [],
      ['Tommelfingerregel til kontrol', T1(k.tommelfinger), 'Salgsareal × 0,03 + 0,8 × plug-in-varme − ventilationskøl'],
    ],
  };
}

/* ---------- 8. Byggeprogram-tjek ---------- */

function byggeprogramtjek(r: Resultat): Ark {
  const raekker: Celle[][] = [
    [H('Status'), H('Krav'), H('Faktisk'), H('Bemærkning')],
    ...r.tjek.map((t) => [
      t.ok ? 'OK' : t.niveau === 'advarsel' ? 'Vurdér' : 'MANGLER',
      t.krav, t.faktisk, t.note,
    ] as Celle[]),
    [],
    [{ v: 'Byggeprogrammets krav til tavlen', s: S.FED }],
    [H('Område'), H('Krav'), H('Værdi'), null],
    ...BYGGEPROGRAMKRAV.map((k) => [k.omraade, k.krav, k.vaerdi, ''] as Celle[]),
  ];
  return { navn: 'Byggeprogram-tjek', frysRaekke: 1, raekker, bredder: [11, 56, 42, 60] };
}

/* ---------- 9. Tegningskalkule ---------- */

function tegningskalkule(k: Tegningskalkule): Ark {
  const raekker: Celle[][] = [
    [{ v: 'Effekt beregnet ud fra indretningstegningen', s: S.FED }],
    [],
    [FED('Skala'), `${k.skala.metode}: 1 enhed = ${k.skala.mmPrEnhed.toFixed(2)} mm`, FED('Tillid'), T2(k.skala.tillid)],
    ...k.skala.kontrol.map((c) => ['Kontrol', c.metode, `${c.mmPrEnhed.toFixed(2)} mm/enhed`, `${c.afvigelsePct.toFixed(1)} %`] as Celle[]),
    [],
    [{ v: 'Rum aflæst på tegningen', s: S.FED }],
    [H('Rum'), H('Type'), H('Areal m²'), H('Tillid')],
    ...k.rum.map((r) => [r.navn, r.rumtype, r.arealM2 ? T0(r.arealM2) : '–', T2(r.tillid)] as Celle[]),
    [],
    [{ v: 'Møbelløb målt på tegningen', s: S.FED }],
    [H('Kode'), H('Antal'), H('Længde m'), H('Tegning / målt'), H('Forklaring')],
    ...k.loeb.map((l) => [l.kode, T0(l.antal), T2(l.laengdeM),
      `${l.antalFraTal ?? '–'} / ${l.antalFraGeometri ?? '–'}`, l.forklaring] as Celle[]),
    [],
    [{ v: 'Beregnede poster', s: S.FED }],
    [H('Grundlag'), H('Beskrivelse'), H('Mål'), H('Nøgletal'), H('kW'), H('Antal'), H('Tillid'), H('Kilde'), H('Forklaring')],
    ...k.linjer.slice().sort((a, b) => b.kw - a.kw).map((l) => [
      l.grundlag, l.beskrivelse + (l.fallback ? ' (groft afdelingstal)' : ''), l.maal, l.noegletal,
      T2(l.kw), l.antal ?? '–', T2(l.tillid), l.kilde, l.forklaring,
    ] as Celle[]),
    [],
    [FED('Samlet effekt fra tegning'), T1(k.samletKw), 'kW'],
    [FED('Heraf uden grove afdelingstal'), T1(k.samletKwUdenFallback), 'kW'],
    [FED('Vægtet tillid'), T2(k.gennemsnitligTillid)],
    ...k.advarsler.map((a) => ['Advarsel', a] as Celle[]),
  ];
  return { navn: 'Tegningskalkule', raekker, bredder: [16, 52, 28, 14, 10, 9, 9, 40, 70] };
}

/* ---------- 10. Tavlebestilling ---------- */

function tavlebestilling(stam: Stamdata, r: Resultat): Ark {
  const rcdTyper = [...new Set(r.forbrug.map((f) => f.rcd))];
  const stoersteAfgang = Math.max(0, ...r.forbrug.map((f) => f.valgtMcb));
  return {
    navn: 'Tavlebestilling', bredder: [44, 44, 52],
    raekker: [
      [{ v: 'Specifikation til tavlebygger', s: S.TITEL }],
      [FED('Projekt'), stam.butiksNavn || '–', stam.adresse || ''],
      [],
      [H('Emne'), H('Krav'), H('Bemærkning')],
      ['Netform', 'TN-S 3F+N+PE, 400/230 V, 50 Hz', ''],
      ['Ampererettighed hos netselskab', `${r.anbefaling.foreslaaetRettighed} A`, r.anbefaling.afvigelse > 1.5 ? 'Valgt efter målte referencebutikker' : 'Følger beregningen'],
      ['Hovedafbryder', `${r.anbefaling.dimensionerKabelOgTavleTil} A`, 'Tavlen dimensioneres efter beregningen, så rettigheden kan skrives op'],
      ['Hovedkabel', `5G${r.hovedkabelMm2}`, `Belastes maks. 70 % — kræver I_z ≥ ${Math.round(r.hovedkabelKravA)} A`],
      ['Tavleform', r.anbefaling.dimensionerKabelOgTavleTil > 63 ? 'Form 4A' : 'Form 2B', 'Byggeprogram'],
      ['Antal afgange', `${r.antalGrupper} i brug + ${Math.ceil(r.antalGrupper * 0.1)} disponible`, 'Min. 10 % disponible afgange'],
      ['Moduler', `${r.moduler} i brug — bestil mindst ${r.modulerMedReserve}`, `Min. ${r.reservePct} % reserveplads`],
      ['Største gruppeafbryder', `${stoersteAfgang} A`, 'Maks. 100 A foran RCD/RCBO'],
      ['Fejlbeskyttelse', rcdTyper.join(' · '), 'Type B hvor der er DC-lækstrøm'],
      ['Måling', 'Multi-instrument i hovedtavle + bimåler på afgange > 63 A', 'Schneider PM8000 / ABB B23, M-Bus'],
      ['Bimålere på', r.forbrug.filter((f) => f.bimaaler).map((f) => f.gruppe).join(', ') || '–', 'Ventilation, varmepumper, udv. stik, PV'],
      ['Overspændingsbeskyttelse', 'SPD type 1 i hovedtavle med melding + lampe', 'Type 2 i undertavler'],
      ['Nødforsyning', `125 A CEE-indtag i front + omskifter 1-0-2`, `Kritisk last ${Math.round(r.noedA)} A`],
      ['Harmonisk filter', 'Disponibel 100 A afgang reserveres', 'Ca. 60 A filter'],
      ['IP-klasse', '≥ IP 44 efter kabelindføring', ''],
      ['Mærkning', 'HT01-Fxx / UTxx-Fxx, lamineret mærkebjælke + dymo', 'Se Mærkatliste-arket'],
      ['Dokumentation', 'Enstregsdiagram, gruppeskema, komponentliste, målerskema + 1 × as-built', ''],
      [],
      [{ v: 'Undertavler', s: S.FED }],
      [H('Tavle'), H('Afgange'), H('Belastet kW')],
      ...[...new Set(r.forbrug.map((f) => f.tavle))].map((t) => {
        const del = r.forbrug.filter((f) => f.tavle === t);
        return [t, T0(del.reduce((s, f) => s + f.antalGrupper, 0)), T1(del.reduce((s, f) => s + f.belKw, 0))] as Celle[];
      }),
    ],
  };
}

/* ---------- 11. Forudsætninger ---------- */

function forudsaetninger(stam: Stamdata, r: Resultat): Ark {
  return {
    navn: 'Forudsætninger', bredder: [46, 22, 66],
    raekker: [
      [{ v: 'Forudsætninger og metode', s: S.FED }],
      [],
      [H('Parameter'), H('Værdi'), H('Bemærkning')],
      ['Spændingsfaktor c (min. kortslutning)', KONSTANTER.cMin, 'DS/HD 60364'],
      ['Ledningsresistivitet ρ (Cu, ca. 70 °C)', KONSTANTER.rhoCu, 'Ω·mm²/m'],
      ['Motorfaktor ved valg af afbryder', stam.motorFaktor ?? KONSTANTER.motorfaktorMcb, 'Gælder maskine, køl og HVAC'],
      ['Maks. spændingsfald', `${stam.maxFaldPct ?? KONSTANTER.maksSpaendingsfaldPct} %`, 'Fra tavle til forbrugssted'],
      ['Maks. belastning af hovedkabel', `${KONSTANTER.maksHovedkabelBelastningPct} %`, 'Byggeprogram'],
      ['Buffer på hovedsikring', `${r.bufferPct} %`, ''],
      ['Stik pr. gruppe', KONSTANTER.stikPrGruppe, 'Ved dispositionsstik'],
      ['Udløsningsfaktor B/C/D', '5 / 10 / 20 × I_n', 'Momentanudløsning'],
      [],
      [{ v: 'Formler', s: S.FED }],
      ['Strøm, 3-faset', 'I = P / (√3 · 400 · cos φ)', ''],
      ['Strøm, 1-faset', 'I = P / (230 · cos φ)', ''],
      ['Spændingsfald, 3-faset', 'ΔU = √3 · I · L · (ρ/S) · cos φ', ''],
      ['Kortslutning ved gruppe', 'I_k = c · U / (Z_forsyning + R_kabel)', 'Krav: I_k ≥ I_a = k · I_n'],
      ['Hovedstrøm', '1-fasede grupper fordeles på L1/L2/L3', 'Ikke summen af alle gruppestrømme'],
      [],
      [{ v: 'Samtidighedsfaktorer (erfaringstal)', s: S.FED }],
      [H('Kategori'), H('Interval'), H('Note')],
      ...SAMTIDIGHEDSFAKTORER.map((s) => [s.kategori, s.interval, s.note] as Celle[]),
      [],
      [{ v: 'Målte referencebutikker', s: S.FED }],
      [H('Butik'), H('Salgsareal m²'), H('Målt peak A')],
      ...REFERENCEMAALINGER.map((m) => [m.navn, m.m2, m.peakA] as Celle[]),
      [],
      [{ v: 'Kabeltabel (Cu, strømværdi i A pr. referencemetode)', s: S.FED }],
      [H('mm²'), H('A1'), H('A3'), H('B1'), H('B3'), H('C1'), H('C3')],
      ...KABEL_TABEL.map((k) => [k.mm2, k.A1, k.A3, k.B1, k.B3, k.C1, k.C3] as Celle[]),
    ],
  };
}

/* ---------- Samlet ---------- */

export function byggArk(stam: Stamdata, r: Resultat, kalkule?: Tegningskalkule): Ark[] {
  return [
    forside(stam, r, kalkule),
    effektliste(r),
    gruppeskema(r),
    maerkatliste(stam, r),
    fasebalance(r),
    noedforsyning(r),
    komfortkoel(stam, r),
    byggeprogramtjek(r),
    ...(kalkule ? [tegningskalkule(kalkule)] : []),
    tavlebestilling(stam, r),
    forudsaetninger(stam, r),
  ];
}

/** Returnerer den færdige .xlsx som bytes. I browseren: new Blob([bytes]) + saveAs. */
export function byggExcel(stam: Stamdata, r: Resultat, kalkule?: Tegningskalkule): Uint8Array {
  return byggeXlsx(byggArk(stam, r, kalkule));
}

export function filnavn(stam: Stamdata): string {
  const navn = (stam.butiksNavn || stam.butiksType || 'Butik').replace(/[^\wæøåÆØÅ -]/g, '').replace(/\s+/g, '-');
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `Effektoversigt-${navn}-${d}.xlsx`;
}
