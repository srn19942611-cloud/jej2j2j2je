/* Domænetyper for belastningsoversigten. */

export type Kategori = 'koel' | 'lys' | 'it' | 'maskine' | 'stik' | 'hvac' | 'pv';
export type Rum = 'salg' | 'slagter' | 'lager' | 'personale' | 'teknik' | 'udv' | 'tag';
export type Karakteristik = 'B' | 'C' | 'D';
export type Metode = 'A' | 'B' | 'C';
export type Kilde = 'Tegning' | 'Datablad' | 'Maskinliste' | 'Byggeprogram' | 'Referencetavle' | 'Skaleret erfaring' | 'Manuel';

export interface Skalering {
  /** fast | m2salg | m2lager | kasser | sco | wm2salg | wm2lager | kwm2salg | ladestander | pv */
  type: string;
  vaerdi: number | null;
  forklaring?: string;
}

export interface KatalogPost {
  id: string;
  navn: string;
  afdeling: string;
  rum: Rum;
  kategori: Kategori;
  kw: number;
  spaending: 230 | 400;
  cosphi: number;
  df: number;
  karakteristik: Karakteristik;
  rcd: string;
  noedforsyning: boolean;
  bimaaler: boolean;
  varmeAfgivelse: number;
  tavle: string;
  tilvalg: string | null;
  skalering: Skalering;
  ampDatablad?: number | null;
  leverandoer?: string | null;
  plankoder?: string[];
  kilde: string;
  note?: string;
}

export interface Stamdata {
  butiksType: string;
  butiksNavn?: string;
  adresse?: string;
  sagsnr?: string;
  salgsAreal: number;
  lagerAreal: number;
  ovrigtAreal: number;
  kasser: number;
  sco: number;
  ladestandere?: number;
  pvKwp?: number;
  tilvalg: string[];
  /** Tekniske forudsætninger */
  metode?: Metode;              // referenceinstallationsmetode for kabler
  motorFaktor?: number;         // gangefaktor på I_b ved valg af MCB for motor-/varmelast
  maxFaldPct?: number;          // maks. spændingsfald i %
  ikHoved?: number;             // kortslutningsstrøm ved hovedtavle i kA
  bufferPct?: number;           // buffer oven på maks. fasestrøm ved valg af hovedsikring
  tavleReservePct?: number;     // krævet reserveplads i tavlen
  valgtHoved?: number | null;   // brugerens valgte hovedsikring
  /** Komfortkøl */
  ventilationKoelKw?: number;
  m2PrPerson?: number;
  wPrPerson?: number;
  solWm2?: number;
  copKoel?: number;
}

export interface Forbruger {
  raekkeId: string;
  katalogId: string | null;
  aktiv: boolean;
  tavle: string;
  afdeling: string;
  rum: Rum;
  gruppe: string;
  navn: string;
  antal: number;
  kw: number;
  spaending: 230 | 400;
  cosphi: number;
  df: number;
  karakteristik: Karakteristik;
  rcd: string;
  noedforsyning: boolean;
  bimaaler: boolean;
  varmeAfgivelse: number;
  kategori: Kategori;
  laengde: number;
  grupper: number | null;   // null = beregnes automatisk
  mcb: number | null;       // null = beregnes automatisk
  mm2: number | null;       // null = beregnes automatisk
  kilde: string;
  note: string;
}

export interface BeregnetForbruger extends Forbruger {
  treFaset: boolean;
  instKw: number;
  belKw: number;
  antalGrupper: number;
  kwPrGruppe: number;
  ibGruppe: number;
  ibRaekke: number;
  valgtMcb: number;
  autoMcb: number;
  valgtMm2: number;
  iz: number;
  faldPct: number;
  ik3: number;
  ik1: number;
  ikMin: number;
  ia: number;
  kabel: string;
  udnyttelse: number;
  okKabel: boolean;
  okFald: boolean;
  okUdloesning: boolean;
  moduler: number;
}

export interface Fasebalance {
  faseKva: number[];
  faseA: number[];
  maxA: number;
  gnsA: number;
  skaevhedPct: number;
}

export interface Komfortkoel {
  udstyr: number; lys: number; personer: number; sol: number; total: number;
  ventKoel: number; underskud: number; anbefalet: number; tommelfinger: number;
  enheder: number; installeretKoelKw: number; daekning: number;
}

export type Niveau = 'krav' | 'advarsel' | 'info';
export interface Tjek { ok: boolean; niveau: Niveau; krav: string; faktisk: string; note: string }

/** Valg af ampererettighed: beregningen mod målte referencebutikker. */
export interface Anbefaling {
  beregnetA: number;              // maks. fasestrøm af beregningen
  beregnetHovedsikring: number;   // beregning + buffer, rundet op til standardstørrelse
  referenceA: [number, number];   // interval fra målte butikker, skaleret på salgsareal
  referenceHovedsikring: number;
  afvigelse: number;              // beregnet / reference-max
  foreslaaetRettighed: number;    // det, der bestilles hos netselskabet
  dimensionerKabelOgTavleTil: number;
  begrundelse: string;
}

export interface Resultat {
  raekker: BeregnetForbruger[];
  forbrug: BeregnetForbruger[];
  instKw: number;
  belKw: number;
  kva: number;
  cosphiSamlet: number;
  balance: Fasebalance;
  bufferPct: number;
  dimA: number;
  anbefaletHovedsikring: number;
  valgtHovedsikring: number;
  hovedkabelKravA: number;
  hovedkabelMm2: number;
  antalGrupper: number;
  moduler: number;
  modulerMedReserve: number;
  noedKw: number;
  noedA: number;
  komfortkoel: Komfortkoel;
  noegletal: { wPrM2Inst: number; wPrM2Bel: number; aPrM2: number; samletDf: number; referenceA: [number, number] };
  tjek: Tjek[];
  anbefaling: Anbefaling;
  pvKw: number;
}
