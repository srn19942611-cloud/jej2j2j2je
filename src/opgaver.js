/* Opgavelaget — fagområder, klassificering af Dalux-opgaver og gentagne fejl.
 *
 * Hentet fra Lovable-projektet "Remix of Shop Sentinel - DALUX API", hvor
 * 23.040 rigtige Dalux-opgaver allerede er kørt igennem. Det, der skaber værdi
 * for medarbejderne, og som energidata alene ikke kan give:
 *
 *  · En opgave kan læses og henføres til et fagområde uden at nogen taster.
 *  · Den samme fejl igen og igen i samme butik er ikke mange serviceopgaver —
 *    det er én sag om et anlæg, der skal skiftes, eller en garanti, der skal
 *    påberåbes. Det er præcis "gentagen alarm"-mønsteret fra fagbogen, og det
 *    kan bygges i dag, uden AK-centralen.
 *  · Butikker, der melder fejl ind hele tiden, er dem, der skal opdateres først.
 *
 * Klassificeringen er bevidst regelbaseret og ikke en sprogmodel: den skal
 * give samme svar hver gang, kunne testes, og køre på alle opgaver dagligt.
 */

/* ---- Fagområder -----------------------------------------------------------
 * Opgavernes inddeling. Bredere end energiregnskabets faggrupper, fordi en
 * butik melder alt ind — ikke kun det, der bruger strøm. `fg` kobler de
 * fagområder, der HAR en energiside, til faggruppen, så en køleopgave og et
 * kølemerforbrug ender samme sted.
 */
/* `planlagt: true` markerer fagområder, hvor opgaverne i forvejen er
 * tilbagevendende: lovpligtige eftersyn, serviceabonnementer og planlagte
 * tilsyn. Tyve skadedyrsbesøg på et år er ikke et anlæg, der fejler — det er
 * en serviceaftale, der kører som den skal. At foreslå udskiftning dér ville
 * være larm, og tillid er den knappeste ressource i det her. */
export const FAGOMRAADER = [
  { navn: 'Køl/Frost',            farve: '#3b82f6', fg: 'koel_frys',   fag: 'Køletekniker' },
  { navn: 'Ventilation/Klima',    farve: '#06b6d4', fg: 'ventilation', fag: 'Ventilationstekniker' },
  { navn: 'Lys/El',               farve: '#facc15', fg: 'lys_inde',    fag: 'Elektriker' },
  { navn: 'El tavler',            farve: '#eab308', fg: 'oevrigt',     fag: 'Elektriker' },
  { navn: 'Solceller',            farve: '#f59e0b', fg: 'solceller',   fag: 'Elektriker' },
  { navn: 'Flaskeautomat',        farve: '#22c55e', fg: null,          fag: 'Serviceleverandør' },
  { navn: 'Port/Dør',             farve: '#f97316', fg: null,          fag: 'Portmontør' },
  { navn: 'Rengøring',            farve: '#a855f7', fg: null,          fag: 'Rengøring',            planlagt: true },
  { navn: 'Mug/Kondens/Fugt',     farve: '#10b981', fg: 'ventilation', fag: 'Bygning' },
  { navn: 'VVS/Sanitet',          farve: '#0ea5e9', fg: null,          fag: 'VVS' },
  { navn: 'Bygning/Tag',          farve: '#78716c', fg: null,          fag: 'Tømrer/Bygning' },
  { navn: 'IT/Kasse',             farve: '#ec4899', fg: null,          fag: 'IT' },
  { navn: 'Udenomsarealer',       farve: '#84cc16', fg: null,          fag: 'Anlægsgartner' },
  { navn: 'Sikkerhed/Alarm',      farve: '#ef4444', fg: null,          fag: 'Sikringstekniker',     planlagt: true },
  { navn: 'Elevator/Rulletrappe', farve: '#8b5cf6', fg: null,          fag: 'Elevatormontør',       planlagt: true },
  { navn: 'Affald',               farve: '#b45309', fg: null,          fag: 'Renovation',           planlagt: true },
  { navn: 'Ballepresser',         farve: '#92400e', fg: null,          fag: 'Serviceleverandør' },
  { navn: 'Skadedyr',             farve: '#7c2d12', fg: null,          fag: 'Skadedyrsbekæmper',    planlagt: true },
  { navn: 'Inventar/Vogne/Kurve', farve: '#d97706', fg: null,          fag: 'Serviceleverandør' },
  { navn: 'Benzin og diesel',     farve: '#0e7490', fg: null,          fag: 'Serviceleverandør' },
  { navn: 'Andet',                farve: '#94a3b8', fg: 'oevrigt',     fag: '—' },
];

export const FO = Object.fromEntries(FAGOMRAADER.map((f) => [f.navn, f]));
export const foFarve = (n) => (FO[n] ? FO[n].farve : '#94a3b8');

/* ---- Klassificering -------------------------------------------------------
 * Tre trin, i den rækkefølge. Et anlægsopslag er sikkert; en tekstmatch er
 * det ikke, og får derfor en lavere konfidens, der følger med ind i sagen.
 */

const ANLAEG_ORD = [
  ['kølemaskine', 'Køl/Frost'], ['centralt køleanlæg', 'Køl/Frost'], ['køleanlæg', 'Køl/Frost'],
  ['køle-/frost', 'Køl/Frost'], ['køle/frost', 'Køl/Frost'], ['konsumkøl', 'Køl/Frost'],
  ['koldlager', 'Køl/Frost'], ['kølelager', 'Køl/Frost'], ['vinkøler', 'Køl/Frost'],
  ['impulsboks', 'Køl/Frost'], ['impulskøler', 'Køl/Frost'], ['frostrum', 'Køl/Frost'],
  ['frostreol', 'Køl/Frost'], ['frostgondol', 'Køl/Frost'], ['kølerum', 'Køl/Frost'],
  ['kølegondol', 'Køl/Frost'], ['kølereol', 'Køl/Frost'], ['kølemøbel', 'Køl/Frost'],
  ['køler', 'Køl/Frost'], ['fryser', 'Køl/Frost'],
  // Chillere og varmepumper er klima, ikke konsumkøl — den skelnen er vigtig,
  // fordi de to har hver sin fagansvarlige og hver sin servicepartner.
  ['chillere (komfortkøl)', 'Ventilation/Klima'], ['varmepumpeanlæg (luft/vand)', 'Ventilation/Klima'],
  ['varmepumpeanlæg (luft/luft)', 'Ventilation/Klima'], ['ventilationsanlæg', 'Ventilation/Klima'],
  ['varmegenvindingsanlæg', 'Ventilation/Klima'], ['ventilation', 'Ventilation/Klima'],
  ['varmepumpe', 'Ventilation/Klima'], ['chiller', 'Ventilation/Klima'], ['komfortkøl', 'Ventilation/Klima'],
  ['cts-anlæg', 'Ventilation/Klima'], ['bms-anlæg', 'Ventilation/Klima'], ['aircondition', 'Ventilation/Klima'],
  ['lufttæppe', 'Ventilation/Klima'], ['fancoli', 'Ventilation/Klima'],
  ['automatisk indbrudsalarm', 'Sikkerhed/Alarm'], ['automatisk branddørlukning', 'Sikkerhed/Alarm'],
  ['automatisk vandslukning', 'Sikkerhed/Alarm'], ['aia-anlæg', 'Sikkerhed/Alarm'],
  ['abdl-anlæg', 'Sikkerhed/Alarm'], ['aba-anlæg', 'Sikkerhed/Alarm'], ['avs-anlæg', 'Sikkerhed/Alarm'],
  ['itv-anlæg', 'Sikkerhed/Alarm'], ['var-anlæg', 'Sikkerhed/Alarm'], ['indbrudsalarm', 'Sikkerhed/Alarm'],
  ['tv-overvågning', 'Sikkerhed/Alarm'], ['adgangskontrol', 'Sikkerhed/Alarm'],
  ['brandslukning', 'Sikkerhed/Alarm'], ['brandalarm', 'Sikkerhed/Alarm'], ['branddør', 'Sikkerhed/Alarm'],
  ['sprinkler', 'Sikkerhed/Alarm'],
  ['anlæg for sikkerhedsbelysning', 'Lys/El'], ['anlæg for almen belysning', 'Lys/El'],
  ['sikkerhedsbelysning', 'Lys/El'], ['nødbelysning', 'Lys/El'], ['belysning', 'Lys/El'],
  ['belysningsarmatur', 'Lys/El'], ['varmekabelanlæg', 'Lys/El'],
  ['solcelleanlæg', 'Solceller'], ['solcelle', 'Solceller'],
  ['hovedtavle', 'El tavler'], ['el-tavle', 'El tavler'], ['eltavle', 'El tavler'],
  ['kabling-og x-felter', 'Lys/El'], ['x-felt', 'Lys/El'], ['elinstallation', 'Lys/El'],
  ['mekaniske porte', 'Port/Dør'], ['dørautomatik', 'Port/Dør'], ['automatisk dør', 'Port/Dør'],
  ['automatdør', 'Port/Dør'], ['skydedør', 'Port/Dør'], ['hurtigport', 'Port/Dør'],
  ['port', 'Port/Dør'], ['dør', 'Port/Dør'],
  ['tagværk', 'Bygning/Tag'], ['facade', 'Bygning/Tag'],
  ['vvs', 'VVS/Sanitet'], ['sanitet', 'VVS/Sanitet'], ['toilet', 'VVS/Sanitet'],
  ['kloak', 'VVS/Sanitet'], ['afløb', 'VVS/Sanitet'], ['varmtvandsbeholder', 'VVS/Sanitet'],
  ['prismærkningsanlæg', 'IT/Kasse'], ['kasseapparat', 'IT/Kasse'], ['scanner', 'IT/Kasse'],
  ['netværk', 'IT/Kasse'], ['server', 'IT/Kasse'],
  ['flaskeautomat', 'Flaskeautomat'], ['tomra', 'Flaskeautomat'], ['pantautomat', 'Flaskeautomat'],
  ['skadedyrssikring', 'Skadedyr'],
  ['personelevator', 'Elevator/Rulletrappe'], ['vareelevator', 'Elevator/Rulletrappe'],
  ['kundeelevator', 'Elevator/Rulletrappe'], ['elevator', 'Elevator/Rulletrappe'],
  ['rulletrappe', 'Elevator/Rulletrappe'], ['rullebånd', 'Elevator/Rulletrappe'],
  ['ballepresser', 'Ballepresser'], ['komprimator', 'Affald'], ['affaldscontainer', 'Affald'],
  ['indkøbsvogn', 'Inventar/Vogne/Kurve'], ['rullebur', 'Inventar/Vogne/Kurve'],
  ['palleløfter', 'Inventar/Vogne/Kurve'], ['reol', 'Inventar/Vogne/Kurve'],
  ['gondol', 'Inventar/Vogne/Kurve'], ['inventar', 'Inventar/Vogne/Kurve'],
  ['parkering', 'Udenomsarealer'], ['asfalt', 'Udenomsarealer'], ['beplantning', 'Udenomsarealer'],
  ['ovn', 'Andet'], ['stabler', 'Andet'], ['pakkemaskine', 'Andet'],
].sort((a, b) => b[0].length - a[0].length);

const TEKST_ORD = [
  ['køleanlæg', 'Køl/Frost'], ['kølekompressor', 'Køl/Frost'], ['kølemontør', 'Køl/Frost'],
  ['køletekniker', 'Køl/Frost'], ['kølemøbel', 'Køl/Frost'], ['køledisk', 'Køl/Frost'],
  ['kølerum', 'Køl/Frost'], ['kølelager', 'Køl/Frost'], ['vinkøler', 'Køl/Frost'],
  ['impulsboks', 'Køl/Frost'], ['høj temp', 'Køl/Frost'], ['lav temp', 'Køl/Frost'],
  ['temperatur afviger', 'Køl/Frost'], ['temperatur', 'Køl/Frost'], ['køler ikke', 'Køl/Frost'],
  ['køl er nede', 'Køl/Frost'], ['for varm i køl', 'Køl/Frost'], ['køling', 'Køl/Frost'],
  ['kompressor', 'Køl/Frost'], ['kondensator', 'Køl/Frost'], ['afrim', 'Køl/Frost'],
  ['frostrum', 'Køl/Frost'], ['fryser', 'Køl/Frost'], ['frost', 'Køl/Frost'],
  ['kølelåge', 'Køl/Frost'], ['frostlåge', 'Køl/Frost'], ['køler', 'Køl/Frost'], ['køle', 'Køl/Frost'],
  ['overskudsvarme', 'Ventilation/Klima'], ['højt varmeforbrug', 'Ventilation/Klima'],
  ['varmeforbrug', 'Ventilation/Klima'], ['manglende varme', 'Ventilation/Klima'],
  ['ventilation', 'Ventilation/Klima'], ['ventilator', 'Ventilation/Klima'],
  ['aircondition', 'Ventilation/Klima'], ['klimaanlæg', 'Ventilation/Klima'],
  ['varmepumpe', 'Ventilation/Klima'], ['varmt i butik', 'Ventilation/Klima'],
  ['for varmt', 'Ventilation/Klima'], ['udsugning', 'Ventilation/Klima'],
  ['aftræk', 'Ventilation/Klima'], ['lufttæppe', 'Ventilation/Klima'],
  ['chiller', 'Ventilation/Klima'], ['cts', 'Ventilation/Klima'], ['bms', 'Ventilation/Klima'],
  ['elektriker', 'Lys/El'], ['lysstofrør', 'Lys/El'], ['nødbelysning', 'Lys/El'],
  ['belysning', 'Lys/El'], ['lyset virker ikke', 'Lys/El'], ['udendørsbelysning', 'Lys/El'],
  ['stikkontakt', 'Lys/El'], ['ingen strøm', 'Lys/El'], ['strømsvigt', 'Lys/El'],
  ['fejlstrøm', 'Lys/El'], ['sikring', 'Lys/El'], ['hpfi', 'Lys/El'], ['lampe', 'Lys/El'],
  ['pære', 'Lys/El'], ['spot', 'Lys/El'], ['mørkt', 'Lys/El'], ['strøm', 'Lys/El'],
  ['gruppetavle', 'El tavler'], ['undertavle', 'El tavler'], ['hovedtavle', 'El tavler'],
  ['eltavle', 'El tavler'], ['el-tavle', 'El tavler'],
  ['solcelle', 'Solceller'], ['solpanel', 'Solceller'], ['inverter', 'Solceller'],
  ['automatdør', 'Port/Dør'], ['automatisk dør', 'Port/Dør'], ['skydedør', 'Port/Dør'],
  ['dørautomatik', 'Port/Dør'], ['dør virker ikke', 'Port/Dør'], ['døren lukker ikke', 'Port/Dør'],
  ['hurtigport', 'Port/Dør'], ['porten', 'Port/Dør'], ['indgangsdør', 'Port/Dør'], ['låge', 'Port/Dør'],
  ['vandskade', 'VVS/Sanitet'], ['vandlækage', 'VVS/Sanitet'], ['tilstoppet', 'VVS/Sanitet'],
  ['cisterne', 'VVS/Sanitet'], ['vandhane', 'VVS/Sanitet'], ['håndvask', 'VVS/Sanitet'],
  ['varmt vand', 'VVS/Sanitet'], ['vandtryk', 'VVS/Sanitet'], ['toilet', 'VVS/Sanitet'],
  ['kloak', 'VVS/Sanitet'], ['afløb', 'VVS/Sanitet'], ['vvs', 'VVS/Sanitet'], ['dryp', 'VVS/Sanitet'],
  ['kondens', 'Mug/Kondens/Fugt'], ['skimmel', 'Mug/Kondens/Fugt'], ['fugt', 'Mug/Kondens/Fugt'],
  ['utæt tag', 'Bygning/Tag'], ['regn ind', 'Bygning/Tag'], ['lækage', 'Bygning/Tag'],
  ['tagværk', 'Bygning/Tag'], ['facade', 'Bygning/Tag'], ['tømrer', 'Bygning/Tag'],
  ['håndværker', 'Bygning/Tag'], ['maling', 'Bygning/Tag'], ['flise', 'Bygning/Tag'],
  ['kasseapparat', 'IT/Kasse'], ['kasselinje', 'IT/Kasse'], ['prismærkning', 'IT/Kasse'],
  ['scanner', 'IT/Kasse'], ['printer', 'IT/Kasse'], ['netværk', 'IT/Kasse'],
  ['internet', 'IT/Kasse'], ['terminal', 'IT/Kasse'], ['betaling', 'IT/Kasse'], ['etiket', 'IT/Kasse'],
  ['indbrudsalarm', 'Sikkerhed/Alarm'], ['videoovervågning', 'Sikkerhed/Alarm'],
  ['overvågningskamera', 'Sikkerhed/Alarm'], ['adgangskontrol', 'Sikkerhed/Alarm'],
  ['brandalarm', 'Sikkerhed/Alarm'], ['branddør', 'Sikkerhed/Alarm'], ['sprinkler', 'Sikkerhed/Alarm'],
  ['tyveri', 'Sikkerhed/Alarm'], ['indbrud', 'Sikkerhed/Alarm'], ['alarm', 'Sikkerhed/Alarm'],
  ['brand', 'Sikkerhed/Alarm'],
  ['flaskeautomat', 'Flaskeautomat'], ['pantautomat', 'Flaskeautomat'], ['tomra', 'Flaskeautomat'],
  ['skadedyrsbekæmpelse', 'Skadedyr'], ['skadedyr', 'Skadedyr'], ['rotter', 'Skadedyr'],
  ['kakerlak', 'Skadedyr'], ['sølvfisk', 'Skadedyr'], ['gnavere', 'Skadedyr'],
  ['anticimex', 'Skadedyr'], ['rentokil', 'Skadedyr'], ['insekter', 'Skadedyr'],
  ['rengøring', 'Rengøring'], ['rensning', 'Rengøring'],
  ['personelevator', 'Elevator/Rulletrappe'], ['vareelevator', 'Elevator/Rulletrappe'],
  ['rulletrappe', 'Elevator/Rulletrappe'], ['elevator', 'Elevator/Rulletrappe'],
  ['ballepresser', 'Ballepresser'], ['pap presser', 'Ballepresser'],
  ['komprimator', 'Affald'], ['affaldscontainer', 'Affald'], ['renovation', 'Affald'],
  ['affald', 'Affald'], ['skrald', 'Affald'],
  ['indkøbsvogn', 'Inventar/Vogne/Kurve'], ['indkøbskurv', 'Inventar/Vogne/Kurve'],
  ['rullebur', 'Inventar/Vogne/Kurve'], ['palleløfter', 'Inventar/Vogne/Kurve'],
  ['mønttårn', 'Inventar/Vogne/Kurve'], ['reoler', 'Inventar/Vogne/Kurve'],
  ['parkering', 'Udenomsarealer'], ['asfalt', 'Udenomsarealer'], ['ukrudt', 'Udenomsarealer'],
  ['varegård', 'Udenomsarealer'], ['container', 'Udenomsarealer'],
].sort((a, b) => b[0].length - a[0].length);

const normaliser = (dele) => ` ${dele.filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ').trim()} `;

/** Fagområde ud fra anlægsfeltet. Læser den dybeste parentes først — Dalux
 *  skriver typisk "Kode (Anlægstype)", og anlægstypen er den sikre kilde. */
export function fraAnlaeg(anlaeg) {
  if (!anlaeg) return null;
  const s = String(anlaeg).toLowerCase();
  const parenteser = [...s.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
  for (const kandidat of parenteser.length ? [...parenteser, s] : [s]) {
    for (const [ord, fo] of ANLAEG_ORD) if (kandidat.includes(ord)) return fo;
  }
  return null;
}

function scorTekst(dele) {
  const hø = normaliser(dele);
  const score = new Map();
  if (!hø.trim()) return score;
  for (const [ord, fo] of TEKST_ORD) {
    if (hø.includes(ord)) score.set(fo, (score.get(fo) || 0) + Math.max(ord.length, 4));
  }
  return score;
}

const bedste = (score) => {
  let navn = null, vaerdi = 0;
  for (const [k, v] of score) if (v > vaerdi) { navn = k; vaerdi = v; }
  return navn ? { fagomraade: navn, score: vaerdi } : null;
};

/**
 * Klassificerer én Dalux-opgave. Rækkefølgen er anlæg → skabelon/team → tekst,
 * og konfidensen falder for hvert trin, så den fagansvarlige kan se, hvor
 * sikkert henføringen er.
 */
export function klassificerOpgave(opgave) {
  const fraAnl = fraAnlaeg(opgave.asset) || fraAnlaeg(opgave.matchedAssetName);
  if (fraAnl && fraAnl !== 'Andet') {
    return { fagomraade: fraAnl, konfidens: 1, kilde: 'anlæg' };
  }

  const score = scorTekst([
    opgave.taskName, opgave.description, opgave.workDescription,
    opgave.asset, opgave.matchedAssetName, opgave.taskTemplate, opgave.team, opgave.supplier,
  ]);

  // Skabelon og team er stærke signaler, når teksten er tvetydig.
  const skabelon = normaliser([opgave.taskTemplate]);
  const team = normaliser([opgave.team]);
  let boostet = false;
  const loeft = (fo, v) => { boostet = true; score.set(fo, (score.get(fo) || 0) + v); };
  if (skabelon.includes('køleopgaver')) loeft('Køl/Frost', 55);
  if (skabelon.includes('energidata') || team.includes(' enity ') || team.includes(' energi ')) loeft('Ventilation/Klima', 28);
  if (team.includes(' skadedyr ')) loeft('Skadedyr', 45);
  if (team.includes('bygningsvedligehold') || team.includes(' byg ')) loeft('Bygning/Tag', 28);
  if (team.includes('ltech')) loeft('Lys/El', 20);

  const b = bedste(score);
  if (!b) return fraAnl === 'Andet'
    ? { fagomraade: 'Andet', konfidens: 0.35, kilde: 'anlæg' }
    : { fagomraade: 'Andet', konfidens: 0.1, kilde: 'ingen' };

  return {
    fagomraade: b.fagomraade,
    konfidens: Math.min(0.95, Math.max(0.55, b.score / 80)),
    // Kilden siger, hvad henføringen hviler på — ikke bare hvor høj scoren blev.
    kilde: boostet ? 'skabelon/team' : b.score >= 40 ? 'tekst (flere træf)' : 'tekst',
  };
}

/** Butiksfelt "COOP Superbr Øster Bordingvej (2868)" → navn og kardex. */
export function laesButik(felt) {
  if (!felt) return { navn: null, kardex: null };
  const m = String(felt).match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? { navn: m[1].trim(), kardex: m[2] } : { navn: String(felt).trim(), kardex: null };
}

/* ---- Gentagne fejl --------------------------------------------------------
 * Fagbogens vigtigste linje: "gentagen tilsmudsning er et placeringsproblem,
 * ikke et rengøringsproblem". Det samme gælder alt andet. Kommer den samme
 * fejl igen på samme anlæg, er sagen en anden end første gang.
 */

export const HANDLINGER = {
  service_visit:  { navn: 'Servicebesøg',   forklaring: 'Fejlen retten på stedet. Normal serviceopgave.' },
  warranty_claim: { navn: 'Garantisag',     forklaring: 'Mønsteret peger på en produktions- eller monteringsfejl. Går til indkøb og leverandør, ikke til servicepartneren.' },
  replace:        { navn: 'Udskiftning',    forklaring: 'Anlægget er ved vejs ende. Reparationerne koster mere end en udskiftning.' },
  survey:         { navn: 'Gennemgang',     forklaring: 'Mønsteret er reelt, men årsagen kendes ikke. En gennemgang skal afgøre det, før der bestilles arbejde.' },
  kontroller_aftale: { navn: 'Tjek aftalen', forklaring: 'Fagområdet kører på serviceaftale eller lovpligtigt eftersyn — mange opgaver er forventet. Spørgsmålet er, om antallet svarer til det aftalte, ikke om anlægget er defekt.' },
};

/**
 * Finder anlæg, hvor den samme fejl er meldt ind gentagne gange.
 * Ét anlæg med mange opgaver er en sag — ikke mange opgaver.
 */
/**
 * Afgør hvad et antal gentagelser betyder. Nøglen er, om fagområdet i
 * forvejen er planlagt service: er det det, er mange opgaver forventet, og
 * anbefalingen er at kontrollere aftalen — ikke at skifte anlægget ud.
 */
export function vurderGentagelse(fagomraade, antal) {
  const planlagt = FO[fagomraade] && FO[fagomraade].planlagt;
  if (planlagt) {
    return {
      planlagtService: true,
      handling: 'kontroller_aftale',
      symptom: `${antal} opgaver på samme anlæg. Fagområdet kører på serviceaftale eller lovpligtigt eftersyn, `
        + 'så et højt antal er forventet — det skal kontrolleres mod aftalen, ikke behandles som en fejl.',
    };
  }
  return {
    planlagtService: false,
    handling: antal >= 10 ? 'replace' : antal >= 7 ? 'warranty_claim' : 'service_visit',
    symptom: `${antal} opgaver på samme anlæg inden for perioden. Fejlen kommer igen efter hver lukning.`,
  };
}

export function detektorGentagneAnlaeg(opgaver, { minAntal = 5, vinduDage = 365 } = {}) {
  const graense = Date.now() - vinduDage * 864e5;
  const grupper = new Map();
  for (const o of opgaver) {
    if (!o.anlaeg || !o.kardex) continue;
    if (o.oprettet && new Date(o.oprettet).getTime() < graense) continue;
    const n = `${o.kardex}|${o.anlaeg}|${o.fagomraade}`;
    if (!grupper.has(n)) grupper.set(n, []);
    grupper.get(n).push(o);
  }
  const ud = [];
  for (const [, liste] of grupper) {
    if (liste.length < minAntal) continue;
    const f = liste[0];
    const datoer = liste.map((o) => o.oprettet).filter(Boolean).sort();
    ud.push({ type: 'gentagne_anlaeg',
      kardex: f.kardex, butik: f.butik, anlaeg: f.anlaeg, fagomraade: f.fagomraade,
      antal: liste.length, foerste: datoer[0], seneste: datoer[datoer.length - 1],
      opgaver: liste,
      ...vurderGentagelse(f.fagomraade, liste.length),
    });
  }
  return ud.sort((a, b) => b.antal - a.antal);
}

/**
 * Finder butikker, der melder den samme type fejl ind igen og igen — også
 * når opgaverne rammer forskellige anlæg. Det er butikker, hvis anlæg
 * samlet set er ved at være udtjente.
 */
export function detektorGentagneButik(opgaver, { minAntal = 12 } = {}) {
  const grupper = new Map();
  for (const o of opgaver) {
    if (!o.kardex || !o.fagomraade || o.fagomraade === 'Andet') continue;
    const n = `${o.kardex}|${o.fagomraade}`;
    if (!grupper.has(n)) grupper.set(n, []);
    grupper.get(n).push(o);
  }
  const ud = [];
  for (const [, liste] of grupper) {
    if (liste.length < minAntal) continue;
    const f = liste[0];
    const anlaeg = new Set(liste.map((o) => o.anlaeg).filter(Boolean));
    const datoer = liste.map((o) => o.oprettet).filter(Boolean).sort();
    ud.push({
      type: 'gentagne_butik',
      kardex: f.kardex, butik: f.butik, fagomraade: f.fagomraade,
      antal: liste.length, anlaegAntal: anlaeg.size || null,
      foerste: datoer[0], seneste: datoer[datoer.length - 1],
      opgaver: liste,
      planlagtService: !!(FO[f.fagomraade] && FO[f.fagomraade].planlagt),
      // Mange opgaver fordelt på mange anlæg er ikke ét defekt anlæg — det er
      // en butik, hvis anlægsportefølje er ved at være udtjent.
      handling: (FO[f.fagomraade] && FO[f.fagomraade].planlagt) ? 'kontroller_aftale'
        : anlaeg.size >= 4 ? 'survey' : 'warranty_claim',
      symptom: anlaeg.size
        ? `${liste.length} opgaver inden for ${f.fagomraade} fordelt på ${anlaeg.size} forskellige anlæg.`
        : `${liste.length} opgaver inden for ${f.fagomraade}.`,
    });
  }
  return ud.sort((a, b) => b.antal - a.antal);
}

/**
 * Porteføljeblikket: den samme fejl på den samme anlægstype i mange butikker
 * er ikke mange serviceopgaver — det er ét indkøbs-, garanti- eller
 * designproblem, og det går til indkøb, ikke til servicepartneren.
 */
export function porteføljemønstre(opgaver, { minButikker = 8 } = {}) {
  const grupper = new Map();
  for (const o of opgaver) {
    if (!o.anlaeg || !o.kardex) continue;
    const n = `${o.anlaeg}|${o.fagomraade}`;
    if (!grupper.has(n)) grupper.set(n, { butikker: new Set(), antal: 0, f: o });
    const g = grupper.get(n);
    g.butikker.add(o.kardex); g.antal++;
  }
  return [...grupper.entries()]
    // Planlagt service på tværs af butikker er ikke et indkøbsproblem — det er
    // en serviceaftale, der dækker mange butikker. Den hører ikke til her.
    .filter(([, g]) => g.butikker.size >= minButikker && !(FO[g.f.fagomraade] && FO[g.f.fagomraade].planlagt))
    .map(([, g]) => ({
      anlaeg: g.f.anlaeg, fagomraade: g.f.fagomraade,
      butikker: g.butikker.size, antal: g.antal,
      snit: +(g.antal / g.butikker.size).toFixed(1),
      gaarTil: 'Energiansvarlig og indkøb — ikke servicepartneren',
      tolkning: 'Samme fejl på samme anlægstype i mange butikker er en garantisag eller en systematisk installationsfejl.',
    }))
    .sort((a, b) => b.antal - a.antal);
}
