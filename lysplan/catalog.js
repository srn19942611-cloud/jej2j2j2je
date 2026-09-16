/* Armatur- og tilbehørskatalog.
   Data er trukket fra SJOC retail lysplaner (Coop-koncepter).
   Lysstrøm (lm) og effekt (W) bruges til overslagsberegning af lux og W/m2. */

const FIXTURES = {
  bricks: {
    key: 'bricks', rolle: 'grund', cct: 3500, ra: 85, ugr: 19, navn: 'Bricks Track Line, montering på skinner',
    detalje: 'Længde 120cm', lyskilde: '70W LED 8800 Lm, 3500 K',
    w: 70, lm: 8800, farve: 'Hvid', fase: 'bricks', laengde: 1.2, symbol: 'bricks'
  },
  bricksscan: {
    key: 'bricksscan', rolle: 'grund', cct: 3500, ra: 85, ugr: 19, navn: 'Bricks scan, montering på skinner',
    detalje: 'Længde 30cm', lyskilde: '40W LED 3500 K',
    w: 40, lm: 5000, farve: 'Hvid', fase: 'bricks', laengde: 0.3, symbol: 'bricks'
  },
  sirius: {
    key: 'sirius', rolle: 'accent', cct: 3500, ra: 85, ugr: 19, navn: 'Sirius spot, monteres på skinne',
    detalje: '', lyskilde: '28W LED 36 gr. 3500K',
    w: 28, lm: 2800, farve: 'Hvid', fase: 'spot', laengde: 0.2, symbol: 'spot'
  },
  pendel: {
    key: 'pendel', rolle: 'accent', cct: 3000, ra: 85, ugr: null, navn: 'Coop pendel, monteres på skinne',
    detalje: '', lyskilde: '12W LED',
    w: 12, lm: 1250, farve: 'Natur', fase: 'spot', laengde: 0.35, symbol: 'pendel'
  },
  panel30: {
    key: 'panel30', rolle: 'grund', cct: 3500, ra: 85, ugr: 19, navn: 'LED Panel Premium m. Philips driver, mont. i ramme',
    detalje: 'Mål 30x120cm', lyskilde: '30W LED, 3500K 4500 Lm',
    w: 30, lm: 4500, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'panel'
  },
  panel22: {
    key: 'panel22', rolle: 'grund', cct: 3500, ra: 85, ugr: 19, navn: 'LED Panel Premium m. Philips driver',
    detalje: 'Mål 30x120cm, Udskiftes 1:1', lyskilde: '22W LED, 3500K 3300 Lm',
    w: 22, lm: 3300, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'panel'
  },
  triproof: {
    key: 'triproof', rolle: 'grund', cct: 3500, ra: 85, ugr: null, navn: 'Tri-proof Light deluxe med Lifud driver',
    detalje: 'Længde 120cm', lyskilde: '33-40W LED, 3500K',
    w: 40, lm: 5200, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'triproof'
  },
  panmax: {
    key: 'panmax', rolle: 'grund', cct: 3500, ra: 90, ugr: 19, navn: 'Pan Max downlight',
    detalje: '', lyskilde: '28W LED, 3500K 930PC',
    w: 28, lm: 3000, farve: 'Hvid', fase: 'fast', laengde: 0.25, symbol: 'downlight'
  },
  gobo: {
    key: 'gobo', rolle: 'særlig', cct: null, ra: null, ugr: null, navn: 'Gobo projektor med logo indbygges i loftet',
    detalje: '', lyskilde: 'LED',
    w: 20, lm: 0, farve: 'Hvid', fase: 'fast', laengde: 0.3, symbol: 'gobo'
  },
  park2: {
    key: 'park2', rolle: 'ude', cct: 4000, ra: 80, ugr: null, navn: 'SJOC, Park 2, Monteres på eksisterende master',
    detalje: '', lyskilde: '23W LED, 4000K',
    w: 23, lm: 2900, farve: 'Grå', fase: 'fast', laengde: 0.4, symbol: 'park'
  },
  tiltspot: {
    key: 'tiltspot', rolle: 'accent', cct: 3500, ra: 90, ugr: 19,
    navn: 'Tilt-spot til indbygning i systemloft',
    detalje: 'Farvetilpasset loftets overflade', lyskilde: '20W LED, 3500K',
    w: 20, lm: 2200, farve: 'Hvid/Sort', fase: 'spot', laengde: 0.2, symbol: 'spot'
  },
  ferskspot: {
    key: 'ferskspot', rolle: 'accent', cct: 3500, ra: 90, ugr: 19, r9: 90,
    navn: 'Spot til slagter, delikatesse og kølemøbler til kød og pålæg',
    detalje: 'Ra ≥ 90 og R9 ≥ 90', lyskilde: '28W LED, 3500K, Ra 90',
    w: 28, lm: 2800, farve: 'Hvid', fase: 'spot', laengde: 0.2, symbol: 'spot'
  },
  parkone: {
    key: 'parkone', rolle: 'ude', cct: 3000, ra: 80, ugr: null,
    navn: 'Lysmast/væglampe Park One (SJOC)',
    detalje: 'Komplet mast, vingefundament, sikringselement og lampehoved',
    lyskilde: '35W LED, 3000K', w: 35, lm: 4500, farve: 'Grå', fase: 'fast', laengde: 0.5, symbol: 'park'
  },
  floodlight: {
    key: 'floodlight', rolle: 'ude', cct: 3000, ra: 80, ugr: null,
    navn: 'Projektørspot i varegård, Floodlight IP65',
    detalje: '', lyskilde: '50W LED, 3000K', w: 50, lm: 6000, farve: 'Sort', fase: 'fast', laengde: 0.3, symbol: 'downlight'
  },
  xooline: {
    key: 'xooline', rolle: 'ude', cct: 3000, ra: 80, ugr: null,
    navn: 'LED LINEAR XOOLINE High Efficiency LD IP67, facade og udhæng',
    detalje: 'Regnes pr. meter, monteres i hele længden', lyskilde: '15W/m LED, 3000K',
    w: 15, lm: 1900, farve: 'Hvid', fase: 'fast', laengde: 1, symbol: 'triproof'
  },
  wallwasher: {
    key: 'wallwasher', rolle: 'accent', cct: 3000, ra: 80, ugr: null,
    navn: 'Wallwasher til bannerbelysning',
    detalje: 'I bannerets fulde længde', lyskilde: '24W LED, 3000K',
    w: 24, lm: 2600, farve: 'Sort', fase: 'spot', laengde: 0.3, symbol: 'spot'
  },
  effektudtag: {
    key: 'effektudtag', rolle: 'særlig', cct: null, ra: null, ugr: null, navn: 'Udtag til effektlys',
    detalje: '', lyskilde: '', w: 0, lm: 0, farve: '', fase: 'fast', laengde: 0.2, symbol: 'udtag'
  }
};

/* Rækkefølge i styklisten - følger opbygningen på de tegnede lysplaner. */
const FIXTURE_ORDER = ['sirius', 'tiltspot', 'ferskspot', 'bricks', 'bricksscan', 'pendel', 'triproof', 'panel30', 'panel22', 'panmax', 'wallwasher', 'gobo', 'park2', 'parkone', 'floodlight', 'xooline', 'effektudtag'];

/* Skinnelængder der kan bestilles (mm). */
const TRACK_PIECES = [4000, 3000, 2000];

/* Tilbehør der beregnes automatisk ud fra skinnegeometrien. */
const ACCESSORIES = [
  { key: 'start', kode: 'S.', navn: 'Start/tilslutning', farve: 'Hvid' },
  { key: 'ende', kode: 'E.', navn: 'Endestykke', farve: '' },
  { key: 'lige', kode: 'S.S.', navn: 'Lige samling', farve: '' },
  { key: 'hjoerne', kode: 'H.S.', navn: 'Hjørne samling', farve: '' },
  { key: 'flex', kode: 'F.S.', navn: 'Flex samling', farve: '' },
  { key: 'tee', kode: 'T.S.', navn: 'T-samling', farve: '' },
  { key: 'wire', kode: '', navn: 'Wireophæng + 1,5m wire', farve: '' },
  { key: 'bracket', kode: '', navn: 'Wire bracket', farve: '' }
];

/* Butikskoncepter. Tætheder er aflæst af eksisterende SJOC-lysplaner
   og bruges som udgangspunkt, ikke som facit. */
const PRESETS = {
  dagli: {
    navn: "Dagli'Brugsen / Mini (skinner + Bricks)",
    mode: 'track', lofttype: 'skinne', ccSkinner: 2.6, margin: 1.2,
    primaer: 'bricks', accent: 'sirius', accentRatio: 0.65, wireCC: 1.5
  },
  superbrugsen: {
    navn: 'SuperBrugsen / Kvickly (skinner + Bricks)',
    mode: 'track', lofttype: 'skinne', ccSkinner: 2.5, margin: 1.0,
    primaer: 'bricks', accent: 'sirius', accentRatio: 0.35, wireCC: 1.4
  },
  discount: {
    navn: '365discount (LED-paneler i loft)',
    mode: 'panel', lofttype: 'system', ccX: 2.4, ccY: 2.4, margin: 1.0,
    primaer: 'panel22', accent: null, accentRatio: 0, wireCC: 1.5
  },
  lager: {
    navn: 'Lager / bagbutik (Tri-proof)',
    mode: 'panel', lofttype: 'skinne', ccX: 3.5, ccY: 4.0, margin: 1.0,
    primaer: 'triproof', accent: null, accentRatio: 0, wireCC: 1.5
  }
};


/* Krav fra Coops byggeprogram, EL - Belysningsanlæg (rev. 1.3).
   Tallene bruges til kontrollen i fanen "Krav" og til udskriften. */
const KRAV = {
  kilde: 'Coop byggeprogram – EL/Belysningsanlæg 1.3',
  tolerance: 0.10,                 // lux måles med ±10 % tolerance
  maalehoejde: '0 m og/eller 0,85 m over gulv',
  inde: { cct: 3500, ra: 85, ugr: 19, sdcm: 3, levetid: 'L70/B10 100.000 t (Ta 25 °C)', thd: 15, pf: 0.95 },
  ude: { cct: 3000, sdcm: 5, thd: 15, pf: 0.95 },
  fersk: { ra: 90, r9: 90 },       // slagter, delikatesse og kølemøbler til kød og pålæg
  lmwGrund: 130,                   // systemeffektivitet inkl. driver
  lmwSpot: 100,
  spotOmraader: ['Vindfang', 'Frugt og grønt frontreol', 'Vægnavigation og skilte',
    'Endegavle', 'Folie-branding over kølere', 'Vinområde', 'Spotvareområde',
    'Pristjekker', 'Slagter', 'Delikatesse', 'Bager'],
  dokumentation: ['Beregnet LUX-niveau', 'Lysspredning', 'Blændingsniveauer (UGR)',
    'Monteringsmetode', 'Datablade og CE-dokumentation']
};

/* Zonetyper. Lux-kravene for salgsareal, betjente områder og vindfang står i
   byggeprogrammet; de øvrige er udgangspunkter, man selv kan rette. */
const ZONETYPER = {
  salg: { navn: 'Salgsareal', lux: 700, iProgram: true, farve: '#0B7BD4' },
  betjent: { navn: 'Betjent område', lux: 1000, iProgram: true, farve: '#C21FA8',
    note: 'kasse, bager, slagter, delikatesse, kiosk, pakkepost' },
  vindfang: { navn: 'Vindfang og indgang', lux: 1000, iProgram: true, farve: '#1E8E5A' },
  lager: { navn: 'Lager og bagbutik', lux: 300, iProgram: false, farve: '#A9670C' },
  personale: { navn: 'Personale og kontor', lux: 500, iProgram: false, farve: '#6B7385' },
  ude: { navn: 'Udvendigt areal', lux: 20, iProgram: false, farve: '#145DA0',
    note: 'dimensioneres efter DS/EN 12464-2, klasse E-1 ved bygning og E-3 på P-plads' }
};

/* Lofttyper afgør opbygningen: systemloft giver paneler og tilt-spots,
   øvrige lofter giver 3-fasede skinner med skinnespots og lysskinner. */
const LOFTTYPER = {
  skinne: { navn: 'Øvrige lofttyper – 3-faset skinnesystem', mode: 'track', grund: 'bricks', accent: 'sirius' },
  system: { navn: 'Nedsænket loft / systemloft – LED-paneler', mode: 'panel', grund: 'panel30', accent: 'tiltspot' }
};

function lmPrW(f) { return f && f.w > 0 ? f.lm / f.w : 0; }

/* Elregler fra lysplanernes noter:
   3-polede grupper - Fase 1: Bricks maks. 12 pr. fase.
   Fase 2: spot, bat lamper og wall washer maks. 30 pr. fase.
   Fase 3: fast strøm (nødbelysning). */
const FASE_REGLER = {
  bricks: { maks: 12, navn: 'Fase 1 - Bricks' },
  spot: { maks: 30, navn: 'Fase 2 - spot/pendel/wall washer' },
  fast: { maks: null, navn: 'Fase 3 - fast strøm' }
};

/* Minimalt antal skinnestykker der dækker en længde (m).
   Returnerer antal pr. standardlængde samt reel monteret længde. */
function segmenterSkinne(laengdeM) {
  const tom = { stykker: {}, antal: 0, monteret: 0, spild: 0 };
  if (!(laengdeM > 0.5)) return tom;
  const maal = Math.max(2, Math.ceil(laengdeM - 0.001));
  const dp = new Array(maal + 1).fill(Infinity);
  const valg = new Array(maal + 1).fill(0);
  dp[0] = 0;
  for (let n = 1; n <= maal; n++) {
    for (const p of [4, 3, 2]) {
      if (n - p >= 0 && dp[n - p] + 1 < dp[n]) { dp[n] = dp[n - p] + 1; valg[n] = p; }
    }
  }
  let n = maal;
  if (!isFinite(dp[n])) return tom;
  const stykker = {};
  while (n > 0) {
    const p = valg[n];
    stykker[p * 1000] = (stykker[p * 1000] || 0) + 1;
    n -= p;
  }
  const antal = Object.values(stykker).reduce((a, b) => a + b, 0);
  return { stykker, antal, monteret: maal, spild: maal - laengdeM };
}
