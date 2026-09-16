/* Armatur- og tilbehørskatalog.
   Data er trukket fra SJOC retail lysplaner (Coop-koncepter).
   Lysstrøm (lm) og effekt (W) bruges til overslagsberegning af lux og W/m2. */

const FIXTURES = {
  bricks: {
    key: 'bricks', navn: 'Bricks Track Line, montering på skinner',
    detalje: 'Længde 120cm', lyskilde: '70W LED 8800 Lm, 3500 K',
    w: 70, lm: 8800, farve: 'Hvid', fase: 'bricks', laengde: 1.2, symbol: 'bricks'
  },
  bricksscan: {
    key: 'bricksscan', navn: 'Bricks scan, montering på skinner',
    detalje: 'Længde 30cm', lyskilde: '40W LED 3500 K',
    w: 40, lm: 5000, farve: 'Hvid', fase: 'bricks', laengde: 0.3, symbol: 'bricks'
  },
  sirius: {
    key: 'sirius', navn: 'Sirius spot, monteres på skinne',
    detalje: '', lyskilde: '28W LED 36 gr. 3500K',
    w: 28, lm: 2800, farve: 'Hvid', fase: 'spot', laengde: 0.2, symbol: 'spot'
  },
  pendel: {
    key: 'pendel', navn: 'Coop pendel, monteres på skinne',
    detalje: '', lyskilde: '12W LED',
    w: 12, lm: 1250, farve: 'Natur', fase: 'spot', laengde: 0.35, symbol: 'pendel'
  },
  panel30: {
    key: 'panel30', navn: 'LED Panel Premium m. Philips driver, mont. i ramme',
    detalje: 'Mål 30x120cm', lyskilde: '30W LED, 3500K 4500 Lm',
    w: 30, lm: 4500, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'panel'
  },
  panel22: {
    key: 'panel22', navn: 'LED Panel Premium m. Philips driver',
    detalje: 'Mål 30x120cm, Udskiftes 1:1', lyskilde: '22W LED, 3500K 3300 Lm',
    w: 22, lm: 3300, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'panel'
  },
  triproof: {
    key: 'triproof', navn: 'Tri-proof Light deluxe med Lifud driver',
    detalje: 'Længde 120cm', lyskilde: '33-40W LED, 3500K',
    w: 40, lm: 5200, farve: 'Hvid', fase: 'fast', laengde: 1.2, symbol: 'triproof'
  },
  panmax: {
    key: 'panmax', navn: 'Pan Max downlight',
    detalje: '', lyskilde: '28W LED, 3500K 930PC',
    w: 28, lm: 3000, farve: 'Hvid', fase: 'fast', laengde: 0.25, symbol: 'downlight'
  },
  gobo: {
    key: 'gobo', navn: 'Gobo projektor med logo indbygges i loftet',
    detalje: '', lyskilde: 'LED',
    w: 20, lm: 0, farve: 'Hvid', fase: 'fast', laengde: 0.3, symbol: 'gobo'
  },
  park2: {
    key: 'park2', navn: 'SJOC, Park 2, Monteres på eksisterende master',
    detalje: '', lyskilde: '23W LED, 4000K',
    w: 23, lm: 2900, farve: 'Grå', fase: 'fast', laengde: 0.4, symbol: 'park'
  },
  effektudtag: {
    key: 'effektudtag', navn: 'Udtag til effektlys',
    detalje: '', lyskilde: '', w: 0, lm: 0, farve: '', fase: 'fast', laengde: 0.2, symbol: 'udtag'
  }
};

/* Rækkefølge i styklisten - følger opbygningen på de tegnede lysplaner. */
const FIXTURE_ORDER = ['sirius', 'bricks', 'bricksscan', 'pendel', 'triproof', 'panel30', 'panel22', 'panmax', 'gobo', 'park2', 'effektudtag'];

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
    mode: 'track', ccSkinner: 2.6, margin: 1.2, maalLux: 750,
    primaer: 'bricks', accent: 'sirius', accentRatio: 0.65, wireCC: 1.5
  },
  superbrugsen: {
    navn: 'SuperBrugsen / Kvickly (skinner + Bricks)',
    mode: 'track', ccSkinner: 2.5, margin: 1.0, maalLux: 800,
    primaer: 'bricks', accent: 'sirius', accentRatio: 0.35, wireCC: 1.4
  },
  discount: {
    navn: '365discount (LED-paneler i loft)',
    mode: 'panel', ccX: 2.4, ccY: 2.4, margin: 1.0, maalLux: 600,
    primaer: 'panel22', accent: null, accentRatio: 0, wireCC: 1.5
  },
  lager: {
    navn: 'Lager / bagbutik (Tri-proof)',
    mode: 'panel', ccX: 3.5, ccY: 4.0, margin: 1.0, maalLux: 300,
    primaer: 'triproof', accent: null, accentRatio: 0, wireCC: 1.5
  }
};

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
