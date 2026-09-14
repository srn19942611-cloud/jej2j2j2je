import { h, tabel, badge, swatch, modal, kpi, dkTal, dkKr, pct, tom } from '../ui.js';
import { state } from '../state.js';
import { fgFarve } from '../taxonomy.js';

/* Solcellerne har deres egen platform med indstråling, forventet produktion,
 * PR og degradering — alt det, detektorerne D-07 og D-08 manglede.
 *
 * Men tallene skal læses med den forsigtighed, de fortjener: en PR over 1 er
 * fysisk urealistisk for et solcelleanlæg, og den findes på over halvdelen af
 * anlæggene. Det betyder, at forventningsmodellen er for lav — ikke at
 * anlæggene overpræsterer. Derfor vises afvigelserne, men de bliver ikke til
 * sager med kroner på, før modellen er kalibreret.
 */
export function solceller(gaaTil) {
  const d = state.data;
  if (!d || !d.sol) return tom('Indlæser …');
  const s = d.sol;
  const el = h('div', {});

  el.append(
    h('h1', {}, 'Solceller'),
    h('p', { class: 'sub' },
      `${s.portefolje.anlaeg} anlæg, ${dkTal(s.portefolje.kwp)} kWp og ${s.portefolje.invertere} invertere `
      + 'fordelt på fire dataveje. Platformen har indstrålingsdata, forventet produktion og degradering — '
      + 'det, der manglede, før en underproduktion kunne skelnes fra en grå uge.'),
  );

  const p = s.portefolje;
  el.append(h('div', { class: 'grid cards' },
    kpi('Installeret', `${dkTal(p.kwp)} kWp`, `${p.anlaeg} anlæg · ${p.invertere} invertere`),
    kpi('Alarmer i alt', dkTal(p.alarmer), `alle ${dkTal(p.alarmerISkyggedrift)} kører i skyggedrift`),
    kpi('Åbne kritiske', dkTal(p.aabneKritiske), 'ingen produktion i 24 timer'),
    kpi('Målte døgn', dkTal(p.performanceDage), `${dkTal(p.produktionstimer)} produktionstimer`)));

  /* Det vigtigste fund, og det skal stå først. */
  el.append(h('div', { class: 'note stop', style: { marginTop: '16px' } },
    h('strong', {}, 'Alle 14 åbne kritiske alarmer ligger på Solax-anlæg. Det er ikke fjorten anlæg, der er gået i stå samme uge.'), h('br'),
    'Nabosammenligningen er det stærkeste værktøj, vi har: viser ét anlæg mønsteret, er det anlægget — '
    + 'viser alle anlæg fra samme datakilde det, er det integrationen. Her peger alle fjorten på Solax, '
    + 'og de fire dårligst ydende anlæg i porteføljen er også Solax. '
    + 'Det skal derfor behandles som en fejl i dataopsamlingen, indtil andet er bevist — ikke som fjorten serviceopgaver.'));

  /* Kalibreringen — grunden til at afvigelserne ikke bliver til kroner. */
  el.append(h('div', { class: 'note warn', style: { marginTop: '10px' } },
    h('strong', {}, 'Forventningsmodellen er ikke kalibreret.'), ' ',
    'Over halvdelen af anlæggene har en performance ratio over 1,0 — det er fysisk urealistisk og betyder, '
    + 'at den forventede produktion er sat for lavt, ikke at anlæggene yder over evne. '
    + `Medianafvigelsen ligger på ~20 %, og ingen af de ${s.kalibrering.reduce((a, k) => a + k.anlaeg, 0)} kalibreringer er statistisk sikre endnu. `
    + 'Afvigelser vises derfor som de er, men de bliver ikke til sager med beløb, før modellen holder.'));

  /* Dataveje. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Dataveje'));
  el.append(tabel([
    { navn: 'Kilde', celle: (k) => h('strong', {}, k.kilde) },
    { navn: 'Anlæg', r: true, celle: (k) => dkTal(k.anlaeg) },
    { navn: 'kWp', r: true, celle: (k) => (k.kwp ? dkTal(k.kwp) : h('span', { class: 'muted' }, '—')) },
    { navn: 'Kalibrering', celle: (k) => {
        const kal = s.kalibrering.find((x) => k.kilde.toLowerCase().includes(x.kilde));
        if (!kal) return h('span', { class: 'muted' }, 'ikke beregnet');
        return h('span', {}, `faktor ${kal.faktor}`,
          kal.medianAfvigelse != null ? h('span', { class: 'muted' }, ` · median ${kal.medianAfvigelse} %`) : null,
          ' ', badge('ikke sikker', 'p2'));
      } },
    { navn: 'Note', celle: (k) => (k.note ? h('span', { class: 'muted' }, k.note) : '—'), wrap: true },
  ], s.kilder));

  /* Ydelse pr. anlæg. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Ydelse pr. anlæg'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Specifikt udbytte (kWh pr. installeret kWp pr. dag) er det tal, der bedst kan sammenlignes på tværs, '
    + 'fordi det er uafhængigt af anlæggets størrelse. Et dansk anlæg ligger typisk omkring 2,3–2,8 over et år. '
    + 'Ligger et anlæg under 1,0, er der noget galt — enten med anlægget eller med dataopsamlingen.'));

  el.append(tabel([
    { navn: 'Anlæg', celle: (a) => h('span', {}, h('strong', {}, a.navn)), wrap: true },
    { navn: 'Kæde', celle: (a) => a.kaede },
    { navn: 'Kilde', celle: (a) => badge(a.kilde, a.kilde === 'solax' ? 'p2' : '') },
    { navn: 'kWp', r: true, celle: (a) => dkTal(a.kwp) },
    { navn: 'Udbytte', r: true, celle: (a) => udbytteCelle(a.udbytte) },
    { navn: 'PR', r: true, celle: (a) => prCelle(a.pr) },
    { navn: 'Afvigelse', r: true, celle: (a) => afvigCelle(a.afvigelse) },
    { navn: 'Målt', r: true, celle: (a) => `${a.dage} d` },
  ], s.anlaeg, { onRow: (a) => visAnlaeg(a, s) }));

  el.append(h('div', { class: 'legend', style: { marginTop: '10px' } },
    h('span', {}, badge('under 1,0', 'p1'), ' specifikt udbytte — anlæg eller data svigter'),
    h('span', {}, badge('PR > 1,0', 'p2'), ' fysisk urealistisk — modellen er for lav'),
    h('span', {}, badge('solax', 'p2'), ' datakilde med mistanke om integrationsfejl')));

  /* Alarmer. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Alarmtyper'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px' } },
    'Alle alarmer kører i skyggedrift: de oprettes, men når ikke frem til en fagansvarlig, før præcisionen er målt. '
    + 'Det er den rigtige disciplin — tillid er den knappeste ressource, og den bruges kun én gang.'));
  el.append(tabel([
    { navn: 'Type', celle: (a) => a.type.replace(/_/g, ' ') },
    { navn: 'Alvor', celle: (a) => badge(a.alvor, a.alvor === 'kritisk' ? 'p1' : a.alvor === 'høj' ? 'p2' : 'p3') },
    { navn: 'I alt', r: true, celle: (a) => dkTal(a.antal) },
    { navn: 'Åbne', r: true, celle: (a) => (a.aabne ? h('strong', { style: { color: 'var(--p1)' } }, dkTal(a.aabne)) : '0') },
    { navn: 'Estimeret tab', r: true, celle: (a) => `${dkTal(a.tabKwh)} kWh` },
    { navn: 'Estimeret tab', r: true, celle: (a) => dkKr(a.tabDkk) },
  ], s.alarmer));

  el.append(h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px' } },
    'Tabstallene hviler på den samme forventningsmodel, der endnu ikke er kalibreret. '
    + 'De er retningsgivende for at prioritere mellem alarmer — de er ikke en gevinstopgørelse.'));

  /* Åbne kritiske. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Åbne kritiske alarmer'));
  el.append(tabel([
    { navn: 'Anlæg', celle: (a) => h('strong', {}, a.anlaeg) },
    { navn: 'Kilde', celle: (a) => badge(a.kilde, 'p2') },
    { navn: 'kWp', r: true, celle: (a) => dkTal(a.kwp) },
    { navn: 'Detekteret', celle: (a) => h('span', { class: 'mono' }, a.dato) },
    { navn: 'Tab', r: true, celle: (a) => `${dkTal(a.tabKwh)} kWh` },
    { navn: 'Tab', r: true, celle: (a) => dkKr(a.tabDkk) },
  ], s.aabneKritiske));

  el.append(h('div', { class: 'note', style: { marginTop: '12px' } },
    h('strong', {}, 'Første handling er ikke en serviceopgave.'), ' ',
    'Dronningensvej 1 har seks separate alarmer på syv dage, og alle fjorten alarmer kommer fra samme integration. '
    + 'Tjek Solax-forbindelsen først: virker den, er alarmerne rigtige, og så er der tale om anlæg, der reelt står stille. '
    + 'Virker den ikke, ville fjorten opgaver til en servicepartner have kostet fjorten kørsler og en portion troværdighed.'));

  /* Degradering. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', { class: 'card' },
    h('h2', {}, 'Degradering'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0 } },
      `${dkTal(s.degradering.beregninger)} degraderingsberegninger er kørt, men `
      + `${s.degradering.statistiskSikre} af dem er statistisk sikre. `
      + 'Degradering kræver flere års data, før den kan skelnes fra vejr og nedsmudsning — '
      + 'tallet er derfor ikke noget, der skal handles på endnu. '
      + 'Det er nævnt her, fordi et tal, der ikke kan bruges, er værd at vide, at man ikke kan bruge.')));

  return el;
}

function udbytteCelle(v) {
  if (v == null) return '—';
  const farve = v >= 2.0 ? 'var(--ok)' : v >= 1.0 ? 'var(--p3)' : 'var(--p1)';
  return h('span', { style: { color: farve } }, v.toFixed(2));
}
function prCelle(v) {
  if (v == null) return '—';
  if (v > 1.0) return h('span', { style: { color: 'var(--p2)' }, title: 'Over 1,0 er fysisk urealistisk — modellen er for lav' }, v.toFixed(2) + ' ⚑');
  const farve = v >= 0.75 ? 'var(--ok)' : v >= 0.5 ? 'var(--p3)' : 'var(--p1)';
  return h('span', { style: { color: farve } }, v.toFixed(2));
}
function afvigCelle(v) {
  if (v == null) return '—';
  const farve = v <= -50 ? 'var(--p1)' : v <= -10 ? 'var(--p3)' : v >= 40 ? 'var(--p2)' : 'var(--ink-2)';
  return h('span', { style: { color: farve } }, (v > 0 ? '+' : '') + v.toFixed(1) + ' %');
}

function visAnlaeg(a, s) {
  const mistanke = a.kilde === 'solax' && a.udbytte < 1.0;
  modal({
    titel: a.navn,
    krop: h('div', { class: 'grid', style: { gap: '14px' } },
      h('div', { class: 'kv' },
        h('dt', {}, 'Kæde'), h('dd', {}, a.kaede),
        h('dt', {}, 'Datakilde'), h('dd', {}, a.kilde),
        h('dt', {}, 'Kapacitet'), h('dd', {}, `${dkTal(a.kwp)} kWp`),
        h('dt', {}, 'Målt produktion'), h('dd', {}, `${dkTal(a.kwh)} kWh over ${a.dage} døgn`),
        h('dt', {}, 'Specifikt udbytte'), h('dd', {}, `${a.udbytte.toFixed(2)} kWh/kWp/døgn`),
        h('dt', {}, 'Performance ratio'), h('dd', {}, a.pr.toFixed(3)),
        h('dt', {}, 'Afvigelse fra model'), h('dd', {}, (a.afvigelse > 0 ? '+' : '') + a.afvigelse + ' %')),

      a.pr > 1.0
        ? h('div', { class: 'note warn' },
            'PR på ' + a.pr.toFixed(2) + ' er fysisk urealistisk. Anlægget yder ikke over evne — '
            + 'den forventede produktion er sat for lavt for netop denne datakilde. '
            + 'Afvigelsen kan derfor ikke bruges som et fund, før modellen er kalibreret.')
        : null,

      mistanke
        ? h('div', { class: 'note stop' },
            h('strong', {}, 'Kan ikke afgøres uden at tjekke integrationen først.'), h('br'),
            'Et specifikt udbytte på ' + a.udbytte.toFixed(2) + ' kWh/kWp/døgn svarer til, at anlægget stort set ikke producerer. '
            + 'Det kan være reelt — et nedbrud, en afbrudt streng, en inverter der er død. '
            + 'Men alle anlæg med samme billede kommer fra samme datakilde, og det gør en fejl i dataopsamlingen '
            + 'til den mest sandsynlige forklaring. Rækkefølgen er: tjek forbindelsen, og først derefter anlægget.')
        : null,

      h('div', { class: 'note' },
        h('strong', {}, 'Hvad der ville afgøre det.'), h('br'),
        '· Rå inverterdata direkte fra anlægget, sammenholdt med det, integrationen leverer.', h('br'),
        '· Strengniveau: ligger én streng under sine søskende, er det anlægget — ligger alle på nul, er det data eller inverter.', h('br'),
        '· Nabosammenligning: et anlæg af samme størrelse og orientering i samme prisområde samme dag.'),
    ),
    bredde: 780,
  });
}
