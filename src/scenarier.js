/* Scenariebibliotek — kendte fejl med kendt facit.
 *
 * Hvorfor det her findes: en detektor, der aldrig er prøvet af på noget, hvor
 * man kender svaret, er ikke en detektor. Den er et gæt med et konfidenstal på.
 *
 * Hvert scenarie bygger en døgnserie, hvor fejlen, dens starttidspunkt og dens
 * størrelse er lagt ind med vilje — og hvor det står skrevet ned i `sandhed`,
 * hvad der faktisk skete. Så kan agenten køres på serien og få karakter: fandt
 * den fejlen, fandt den den rigtige dag, og gav den den rigtige årsag?
 *
 * Fire af scenarierne er med vilje IKKE fejl (setpunkt, ombygning, død måler,
 * ren serie). En detektor, der finder fejl i dem, er værre end ingen detektor:
 * den sender en tekniker ud til noget, der virker.
 *
 * Tallene er modellerede. De er bygget over Kvickly Aarhus C's rigtige
 * køleforbrug på 355.765 kWh/år og en realistisk temperaturrespons, så
 * størrelsesordenen holder. Men de er ikke aflæsninger, og et enkelt døgn her
 * må aldrig læses som en måling.
 */

/** Deterministisk støj — samme frø giver samme serie, så en test er en test. */
function terning(froe) {
  let s = froe >>> 0;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

/** Dansk årstemperatur: middel ~8,8 °C, amplitude ~8,2 °C, koldest i februar. */
function vejrserie(dage, rnd, slut) {
  const ud = [];
  const start = new Date(slut.getTime() - (dage - 1) * 864e5);
  for (let i = 0; i < dage; i++) {
    const d = new Date(start.getTime() + i * 864e5);
    const aarsdag = d.getMonth() * 30.4 + d.getDate();
    const temp = 8.8 + 8.2 * Math.sin((aarsdag - 115) / 365 * 2 * Math.PI) + (rnd() - 0.5) * 6;
    ud.push({
      dato: d.toISOString().slice(0, 10),
      ugedag: d.getDay(),
      aaben: true,
      temperatur: Math.round(temp * 10) / 10,
      hdd: Math.max(0, 17 - temp),
      cdd: Math.max(0, temp - 20),
      indstraaling: Math.max(0, 2 + 9 * Math.sin((aarsdag - 80) / 365 * 2 * Math.PI) + (rnd() - 0.5)),
    });
  }
  return ud;
}

/* ---- Fejlmodellerne -------------------------------------------------------
 * Hver model tager dagens nummer, dagens vejr og en basisværdi og lægger sit
 * bidrag oveni. Formen er det vigtige — ikke størrelsen. Det er formen, der
 * adskiller en tilsmudset kondensator fra et fastlåst afrimningsvarmelegeme:
 * den første vokser med udetemperaturen, den anden er den samme hele året.
 */

export const FEJLMODELLER = {

  /* Kondensatoren sander til over uger. Kondenseringstrykket stiger, og
   * kompressoren skal arbejde mere for det samme. Effekten vokser med
   * udetemperaturen — derfor ses den næsten ikke om vinteren. */
  kondensator_tilsmudset: {
    navn: 'Tilsmudset kondensator',
    form: 'glidende, vejrafhængig',
    byg: (i, v, basis, p) => {
      const t = Math.min(1, Math.max(0, (i - p.start) / p.optrapning));
      return t * basis * p.styrke * Math.max(0.25, (v.temperatur + 5) / 20);
    },
    std: { optrapning: 55, styrke: 0.14 },
  },

  /* Et afrimningsvarmelegeme, der ikke slukker, eller en afrimning der kører
   * på tid i stedet for på temperatur. Et fast antal kWh i døgnet, uanset
   * vejret. Det er netop fraværet af vejrrespons, der udpeger den. */
  afrimning_haenger: {
    navn: 'Afrimning afsluttes ikke',
    form: 'spring, vejruafhængig',
    byg: (i, v, basis, p) => (i >= p.start ? p.kwh : 0),
    std: { kwh: 95 },
  },

  /* Kølemiddel siver ud. Anlægget holder temperaturen ved at køre længere, så
   * forbruget kryber op — indtil det ikke kan holde den længere. Langsommere
   * og mindre end en tilsmudset kondensator, og uden dens vejrafhængighed. */
  koelemiddel_laekage: {
    navn: 'Kølemiddelmangel (lækage)',
    form: 'glidende, svag',
    byg: (i, v, basis, p) => {
      const t = Math.min(1, Math.max(0, (i - p.start) / p.optrapning));
      return t * basis * p.styrke;
    },
    std: { optrapning: 70, styrke: 0.075 },
  },

  /* Anlægget står. Tilbage er ventilatorer og styring. Det er ikke en
   * besparelse — det er varer i fare, og det skal aldrig kunne bogføres som
   * en gevinst. */
  kompressor_nedbrud: {
    navn: 'Anlægget står',
    form: 'fald til standby',
    byg: (i, v, basis, p) => (i >= p.start ? -basis * (1 - p.standby) : 0),
    std: { standby: 0.11 },
  },

  /* Én af flere kompressorer falder ud. Kapaciteten ryger, men de øvrige
   * kører mere, så nettotrækket falder kun lidt. Den sværeste af dem alle:
   * den ligner en besparelse på måleren og er en fejl på anlægget. */
  kompressor_delvist: {
    navn: 'Én kompressor ude af flere',
    form: 'lille fald, fastlåst loft',
    byg: (i, v, basis, p) => (i >= p.start ? -basis * p.fald : 0),
    std: { fald: 0.13 },
  },

  /* Setpunktet er skruet ned i hånden. Et spring som alle andre spring — og
   * ikke en fejl. Uden en samtidig opgave i Dalux kan de to ikke skelnes på
   * måleren alene, og det skal agenten sige højt frem for at gætte. */
  setpunkt_aendret: {
    navn: 'Setpunkt ændret manuelt',
    form: 'spring, vejruafhængig',
    byg: (i, v, basis, p) => (i >= p.start ? basis * p.styrke : 0),
    std: { styrke: 0.09 },
  },

  /* Ny kølemøbelsektion sat i drift. Et ægte, varigt løft — og en helt
   * legitim grund til at forbruget er steget. */
  ombygning: {
    navn: 'Ombygning — ny kapacitet i drift',
    form: 'spring, vejrafhængig',
    byg: (i, v, basis, p) => (i >= p.start ? basis * p.styrke * Math.max(0.5, (v.temperatur + 8) / 20) : 0),
    std: { styrke: 0.16 },
  },

  /* Måleren holder op med at tælle. Anlægget kører videre. Det her er den
   * dyreste forveksling i hele hubben, hvis den bogføres som en besparelse. */
  maaler_doed: {
    navn: 'Måleren er holdt op med at levere',
    form: 'nul',
    // Bruger p.start som alle de andre. Var hårdkodet til dag 300, hvilket i
    // en toårsserie lægger målerens død inde i referenceperioden — og så er
    // der ingen normal at afvige fra.
    byg: (i, v, basis, p) => (i >= p.start ? -basis : 0),
    std: {},
  },

  /* Ingenting. Kontrolprøven. Finder agenten noget her, er tærsklerne for løse. */
  ingen: { navn: 'Ingen fejl', form: 'ren', byg: () => 0, std: {} },
};

/* ---- Scenarierne ----------------------------------------------------------
 * Ud over serien bærer hvert scenarie de Dalux-opgaver, det ville udløse i
 * virkeligheden — med den forsinkelse, de reelt har. Det er dét, der gør det
 * muligt at måle varslingstiden: hvor mange dage før butikken selv melder,
 * kunne måleren have sagt det?
 */

export const SCENARIER = [
  { id: 'S1', fejl: 'kondensator_tilsmudset', start: 250,
    navn: 'Kondensatoren sander til hen over sommeren',
    opgaver: [], // Ingen melder noget. Anlægget holder temperaturen — det koster bare mere.
    forventet: { fund: true, aarsag: 'kondensator_tilsmudset', klasse: 'besparelse' } },

  { id: 'S2', fejl: 'afrimning_haenger', start: 292,
    navn: 'Afrimningen afsluttes ikke',
    opgaver: [{ forsinkelse: 24, fagomraade: 'Køl/Frost', tekst: 'Kraftig rim på fordamper i frostrum, låge kan ikke lukke' }],
    forventet: { fund: true, aarsag: 'afrimning_haenger', klasse: 'besparelse' } },

  { id: 'S3', fejl: 'kompressor_nedbrud', start: 340,
    navn: 'Kompressorsvigt — butikken melder samme dag',
    opgaver: [{ forsinkelse: 0, fagomraade: 'Køl/Frost', tekst: 'Køleanlæg Pos. 2A står, temperatur stiger i køledisk, haster' }],
    forventet: { fund: true, aarsag: 'kompressor_nedbrud', klasse: 'ingen' } },

  { id: 'S4', fejl: 'koelemiddel_laekage', start: 245,
    navn: 'Langsom kølemiddellækage',
    opgaver: [{ forsinkelse: 82, fagomraade: 'Køl/Frost', tekst: 'Kan ikke holde temperatur i køl, kompressor kører konstant' }],
    forventet: { fund: true, aarsag: 'koelemiddel_laekage', klasse: 'besparelse' } },

  { id: 'S5', fejl: 'kompressor_delvist', start: 300,
    navn: 'Én kompressor ude — ligner en besparelse',
    opgaver: [{ forsinkelse: 41, fagomraade: 'Køl/Frost', tekst: 'Alarm på kompressor 2, anlægget kan ikke følge med i varmen' }],
    forventet: { fund: true, aarsag: 'kompressor_delvist', klasse: 'ingen' } },

  { id: 'S6', fejl: 'setpunkt_aendret', start: 310,
    navn: 'Setpunkt skruet ned i hånden — ikke en fejl',
    opgaver: [{ forsinkelse: -2, fagomraade: 'Køl/Frost', tekst: 'Justering af setpunkt på Pos. 3A efter klage over varme varer' }],
    forventet: { fund: true, aarsag: 'setpunkt_aendret', klasse: 'potentiale' } },

  { id: 'S7', fejl: 'ombygning', start: 285,
    navn: 'Ombygning — nye kølemøbler i drift',
    opgaver: [{ forsinkelse: -6, fagomraade: 'Køl/Frost', tekst: 'Idriftsættelse af ny frostsektion, tilslutning til Pos. 2A' }],
    forventet: { fund: true, aarsag: 'ombygning', klasse: 'ingen' } },

  { id: 'S8', fejl: 'maaler_doed', start: 300,
    navn: 'Måleren er død — anlægget kører',
    opgaver: [],
    forventet: { fund: true, aarsag: 'maaler_doed', klasse: 'blindt' } },

  { id: 'S9', fejl: 'ingen', start: 0,
    navn: 'Ren serie — kontrolprøve',
    opgaver: [],
    forventet: { fund: false } },
];

/**
 * Bygger ét scenarie: døgnserie, de opgaver det ville udløse, og facit.
 *
 * `basis` og `tempkoef` svarer til Kvickly Aarhus C's køleanlæg. `slut` gør
 * serien deterministisk i test — uden den flytter datoerne sig hver dag.
 */
export function byggScenarie(scenarie, {
  dage = 365, froe = 20260915, basis = 780, tempkoef = 14, stoej = 60,
  slut = new Date('2026-09-15T00:00:00Z'),
} = {}) {
  const rnd = terning(froe);
  const vejr = vejrserie(dage, rnd, slut);
  const model = FEJLMODELLER[scenarie.fejl];
  const p = { ...model.std, start: scenarie.start };

  const raekker = vejr.map((v, i) => {
    let kwh = basis + tempkoef * v.temperatur + (rnd() - 0.5) * stoej;
    if (v.ugedag === 0) kwh *= 0.93;
    const rent = kwh;
    kwh += model.byg(i, v, rent, p);
    return { ...v, kwh: Math.max(0, Math.round(kwh)), modelleret: true };
  });

  // Opgaverne dateres i forhold til den dag, fejlen faktisk starter.
  const opgaver = scenarie.opgaver.map((o, n) => ({
    id: `${scenarie.id}-OP${n + 1}`,
    dato: raekker[Math.min(dage - 1, Math.max(0, scenarie.start + o.forsinkelse))].dato,
    fagomraade: o.fagomraade,
    tekst: o.tekst,
    anlaeg: 'Pos. 2A',
  }));

  return {
    ...scenarie,
    raekker,
    opgaver,
    sandhed: {
      aarsag: scenarie.fejl,
      navn: model.navn,
      form: model.form,
      startDato: scenarie.fejl === 'ingen' ? null : raekker[scenarie.start].dato,
      startIndex: scenarie.fejl === 'ingen' ? null : scenarie.start,
      opgaveforsinkelse: scenarie.opgaver.length ? scenarie.opgaver[0].forsinkelse : null,
    },
  };
}

/** Alle scenarier bygget og klar. */
export function alleScenarier(opt = {}) {
  return SCENARIER.map((s) => byggScenarie(s, opt));
}
