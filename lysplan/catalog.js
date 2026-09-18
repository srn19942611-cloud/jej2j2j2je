/* Armatur- og tilbehørskatalog.
   Data er trukket fra SJOC retail lysplaner (Coop-koncepter).
   Lysstrøm (lm) og effekt (W) bruges til overslagsberegning af lux og W/m2. */

const FIXTURES = {
  bricks: {
    key: 'bricks', rolle: 'grund', cct: 3500, ra: 85, ugr: 19,
    // fordelingen er tilpasset, så værktøjet rammer SJOC's egne DIALux-tal
    spredning: 110, fordeling: 'batwing', batwingVinkel: 78, batwingBredde: 24, batwingVaegt: 5,
    navn: 'Bricks Track Line, montering på skinner',
    detalje: 'Længde 120cm', lyskilde: '70W LED 8800 Lm, 3500 K',
    w: 70, lm: 8800, farve: 'Hvid', fase: 'bricks', laengde: 1.2, symbol: 'bricks'
  },
  bricksscan: {
    key: 'bricksscan', rolle: 'grund', cct: 3500, ra: 85, ugr: 19,
    spredning: 110, fordeling: 'batwing', batwingVinkel: 78, batwingBredde: 24, batwingVaegt: 5,
    navn: 'Bricks scan, montering på skinner',
    detalje: 'Længde 30cm', lyskilde: '40W LED 3500 K',
    w: 40, lm: 5000, farve: 'Hvid', fase: 'bricks', laengde: 0.3, symbol: 'bricks'
  },
  sirius: {
    key: 'sirius', rolle: 'accent', cct: 3500, ra: 85, ugr: 19, spredning: 36, navn: 'Sirius spot, monteres på skinne',
    detalje: '', lyskilde: '28W LED 36 gr. 3500K',
    w: 28, lm: 2800, farve: 'Hvid', fase: 'spot', laengde: 0.2, symbol: 'spot'
  },
  pendel: {
    key: 'pendel', rolle: 'accent', cct: 3000, ra: 85, ugr: null, navn: 'Coop pendel, monteres på skinne',
    detalje: '', lyskilde: '12W LED',
    w: 12, lm: 1250, farve: 'Natur', fase: 'spot', laengde: 0.35, symbol: 'pendel'
  },
  panel30: {
    key: 'panel30', rolle: 'grund', cct: 3500, ra: 85, ugr: 19, spredning: 110, navn: 'LED Panel Premium m. Philips driver, mont. i ramme',
    detalje: 'Mål 30x120cm', lyskilde: '30W LED, 3500K 4500 Lm',
    w: 30, lm: 4500, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'panel'
  },
  panel22: {
    key: 'panel22', rolle: 'grund', cct: 3500, ra: 85, ugr: 19, spredning: 110, navn: 'LED Panel Premium m. Philips driver',
    detalje: 'Mål 30x120cm, Udskiftes 1:1', lyskilde: '22W LED, 3500K 3300 Lm',
    w: 22, lm: 3300, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'panel'
  },
  triproof: {
    key: 'triproof', rolle: 'grund', cct: 3500, ra: 85, ugr: null, spredning: 110, navn: 'Tri-proof Light deluxe med Lifud driver',
    detalje: 'Længde 120cm', lyskilde: '33-40W LED, 3500K',
    w: 40, lm: 5200, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'triproof'
  },
  panmax: {
    key: 'panmax', rolle: 'grund', cct: 3500, ra: 90, ugr: 19, navn: 'Pan Max downlight',
    detalje: '', lyskilde: '20W LED, 3500K 930PC',
    w: 20, lm: 2000, farve: 'Hvid', fase: 'fast', laengde: 0.25, symbol: 'downlight',
    spredning: 70
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
/* Forudsætninger som SJOC's egne DIALux-rapporter regner med
   (SuperBrugsen Støvring 22-06-2026 og Kvickly Hvidovre 02-07-2026). */
const BEREGNING = {
  /* Bricks Track Line er et skinnearmatur, der kaster lyset ud på varerne.
     Uden producentens fotometri (IES/LDT) er fordelingen tilpasset, så
     værktøjet reproducerer de to DIALux-rapporter herunder. Læg den rigtige
     fotometri ind, hvis den kommer - så er kalibreringen overflødig. */
  vedligehold: 0.80,
  refleks: { loft: 0.70, vaeg: 0.50, gulv: 0.20 },
  beregningshoejde: 0.80,      // DIALux regner i 0,8 m over gulv
  montagehoejde: { standard: 2.8, kvickly: 3.2 },
  norm: { salgsomraade: 300, uo: 0.40 },   // DS/EN 12464-1, profil 5.27.1
  benchmark: [
    { navn: 'SuperBrugsen Støvring', dato: '22-06-2026', areal: 1196.22, montage: 2.8,
      armaturer: [['bricks', 135], ['panmax', 13]], lodret: 889, uo: 0.17, wPrM2: 8.21, wPr100lx: 0.92 },
    { navn: 'Kvickly Hvidovre', dato: '02-07-2026', areal: 2317.70, montage: 3.2,
      armaturer: [['bricks', 244]], lodret: 789, uo: 0.19, wPrM2: 7.43, wPr100lx: 0.94 }
  ],

  /* ---- Sådan er skinnerne faktisk placeret ----

     Tallene er aflæst af styklisterne på SJOC's egne lysplaner og målt i
     vektorerne/pixels i selve tegningerne. Intet af det er gættet.

     Butik                     salgsareal  skinne  Bricks  m/m²  m²/Bricks  m skinne/Bricks  spot/Bricks
     Brugsen Mønsted                343 m²   187 m     70  0,545     4,9          2,67          0,66
     365 Discount Kalundborg        812 m²   268 m     79  0,330    10,3          3,39          0,63
     SuperBrugsen Stenstalle             –   493 m    146      –        –          3,38          0,67
     Kvickly Skibhusvej           1.700 m²   794 m    266  0,467     6,4          2,98          0,33
     SuperBrugsen Støvring        1.196 m²       –    135      –      8,9             –             –
     Kvickly Hvidovre             2.318 m²       –    244      –      9,5             –             –

     Byggeprogrammets eget eksempel (Bilag 1, "Øvrige lofttyper"), målt i
     pixels med Bricks' 1,20 m som målestok:
       skinne-c/c 2,73 / 2,92 / 2,94 / 3,07 m  (måltekst 2800/3000/3000/3100)
       armaturafstand på skinnen 2,56-2,76 m
       skinnen ligger 35-63 % inde i gangen, gangbredde 1,77-2,46 m

     DET DER HOLDER PÅ TVÆRS AF ALLE PLANER er meter skinne pr. Bricks:
     2,56 - 3,39 m, median ca. 3,0. Det er den regel, værktøjet styrer efter.

     DET DER IKKE HOLDER er skinne pr. m² (0,33-0,545) og m² pr. Bricks
     (4,9-10,3). De svinger med en faktor 2, fordi en lille butik har
     forholdsvis meget vægring og mange smalle gange, mens et discountmarked
     har brede gange og lidt ring. Tætheden er en FØLGE af butikkens form,
     ikke et mål man kan sætte. En tidligere udgave af værktøjet låste den
     til Kalundborgs 0,33 m/m² og 10,3 m²/Bricks - det ville have afvist
     tre af de fem skinnebutikker her. */
  layout: {
    ccArmatur: 3.0,                // median m skinne pr. Bricks over alle planer
    baandArmatur: [2.4, 3.6],      // observeret 2,56-3,39; lidt slør i begge ender
    ccSkinne: [2.7, 3.4],          // skinne-c/c, sat af møbelafstanden
    andelIGang: [0.35, 0.63],      // hvor i gangen skinnen ligger
    spotPrGrund: [0.33, 0.67],     // Sirius pr. Bricks
    modul: [4000, 3000, 2000],
    iGang: true,
    // tæthed: kun til orientering, aldrig som mål
    observeret: { mSkinnePrM2: [0.33, 0.545], m2PrGrundarmatur: [4.9, 10.3] }
  }
};

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
