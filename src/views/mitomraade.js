import { h, tabel, badge, swatch, kpi, modal, prioritetBadge, dkTal, dkKr, pct, tom, stack, legend } from '../ui.js';
import { state, noegletal } from '../state.js';
import { PERSONER, PERSON, sagerFor, herreloeseSager, udaekkedeFaggrupper, ejerAfSag } from '../personer.js';
import { FAGGRUPPER, FG, fgNavn, fgFarve, DETEKTORER } from '../taxonomy.js';
import { FO, foFarve, HANDLINGER, vurderGentagelse, vurderButik } from '../opgaver.js';
import { ANLAEGSKLASSER, ANLAEG_UDEN_ENERGI } from '../anlaeg.js';
import { visSag } from './sager.js';

let valgt = 'henrik';

/* Ét dashboard pr. person. Ikke en filtreret udgave af overblikket, men det
 * billede, netop den fagansvarlige har brug for: mine sager, mine anlæg, mit
 * forbrug, mine detektorer — og hvad jeg endnu ikke kan se. */
export function mitOmraade(gaaTil, args = {}) {
  if (args.person && PERSON[args.person]) valgt = args.person;
  const el = h('div', {});
  const person = PERSON[valgt] || PERSONER[0];

  el.append(
    h('h1', {}, 'Mit område'),
    h('p', { class: 'sub' },
      'Ingen sag må stå uden en navngiven modtager. Her er billedet, som det ser ud for den enkelte fagansvarlige — '
      + 'og nederst de sager, ingen endnu ejer.'),
  );

  /* Personvælger. */
  const vaelger = h('div', { class: 'pill-row', style: { marginBottom: '20px' } });
  for (const p of PERSONER) {
    const antal = sagerFor(p, state.sager).filter(aaben).length;
    const knap = h('button', {
      class: 'btn' + (p.id === person.id ? ' primary' : ''),
      onclick: () => gaaTil('mitomraade', { person: p.id }),
    }, p.navn, antal ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, String(antal)) : null);
    vaelger.append(knap);
  }
  el.append(vaelger);

  el.append(dashboard(person, gaaTil));

  /* Sager uden ejer — den vigtigste liste i hele opsætningen. */
  el.append(h('hr', { class: 'rule' }));
  el.append(herreloese(gaaTil));

  return el;
}

const aaben = (s) => s.status === 'ny' || s.status === 'vurderet';

function dashboard(person, gaaTil) {
  const el = h('div', {});
  const d = state.data;
  const mine = sagerFor(person, state.sager);
  const aabne = mine.filter(aaben);

  /* Hoved. */
  el.append(h('div', { class: 'card', style: { marginBottom: '14px' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' } },
      h('div', {},
        h('h2', { style: { margin: 0, fontSize: '17px' } }, person.navn),
        h('div', { style: { color: 'var(--ink-2)', fontSize: '13px', marginTop: '3px' } }, person.omraade),
        h('p', { class: 'muted', style: { fontSize: '12.5px', margin: '6px 0 0', maxWidth: '70ch' } }, person.beskrivelse)),
      h('div', { class: 'pill-row' },
        ...person.faggrupper.map((f) => badge(h('span', {}, swatch(fgFarve(f)), fgNavn(f)))),
        ...person.fagomraader.map((f) => badge(h('span', {}, swatch(foFarve(f)), f))),
        badge(person.fag))),
    person.uafklaret ? h('div', { class: 'note warn', style: { marginTop: '12px' } },
      h('strong', {}, 'Området er ikke afgrænset endnu.'), ' ', person.uafklaret) : null,
    person.deler ? h('div', { class: 'note', style: { marginTop: '10px' } },
      h('strong', {}, 'Delt anlæg.'), ' ',
      person.deler.map((x) => `${x.hvad} (${PERSON[x.med] ? PERSON[x.med].navn : x.med})`).join(' ')) : null));

  /* Nøgletal. */
  const kwh = energiFor(person, d);
  const opgaver = opgaverFor(person, d);
  el.append(h('div', { class: 'grid cards' },
    kpi('Mine åbne sager', dkTal(aabne.length),
      `${aabne.filter((s) => s.prioritet === 'P1').length} P1 · ${aabne.filter((s) => s.prioritet === 'P2').length} P2 · `
      + `${aabne.filter((s) => s.prioritet === 'P3').length} P3`),
    kpi('Besparelse i spil', dkKr(aabne.filter((s) => s.krKlasse === 'besparelse').reduce((a, s) => a + s.krAar, 0)),
      'kun realistiske gevinster — potentiale og blindt forbrug tælles ikke med'),
    person.udenEnergiside
      ? kpi('Energiside', 'ingen', 'området måles ikke separat i Enity')
      : kpi('Mit forbrug', kwh ? `${(kwh.gwh).toFixed(1)} GWh` : '—',
          kwh ? `${pct(kwh.andel)} af porteføljens el · ${dkKr(kwh.kr)}/år` : 'ingen submåling på området'),
    kpi('Opgaver i Dalux', opgaver ? dkTal(opgaver.antal) : '—',
      opgaver ? `på ${dkTal(opgaver.butikker)} butikker` : 'ingen fagområder på opgavesiden')));

  /* Køen. P1 først — fødevaresikkerhed venter ikke på et beløb. */
  el.append(h('h2', { style: { marginTop: '24px' } }, `Min kø (${aabne.length})`));
  if (!aabne.length) {
    el.append(tomKoe(person));
  } else {
    el.append(tabel([
      { navn: '', celle: (s) => prioritetBadge(s.prioritet) },
      { navn: 'Butik', celle: (s) => h('span', {}, h('strong', {}, s.butik), h('span', { class: 'muted' }, ` · ${s.kaede}`)), wrap: true },
      { navn: 'Sag', celle: (s) => s.sagsnavn, wrap: true },
      { navn: 'Anlæg', celle: (s) => s.anlaeg || '—', wrap: true },
      { navn: 'Konfidens', r: true, celle: (s) => pct(s.konfidens.samlet) },
      { navn: 'Beløb/år', r: true, celle: (s) => h('span', { class: s.krKlasse === 'blindt' ? 'muted' : '' },
          s.krAar ? dkTal(s.krAar) : (s.gentagelser ? `${s.gentagelser}×` : '—')) },
    ], aabne, { onRow: (s) => visSag(s, gaaTil) }));
  }

  /* Mine anlæg. */
  const klasser = ANLAEGSKLASSER.filter((a) => person.faggrupper.includes(a.fg));
  const udenEnergi = ANLAEG_UDEN_ENERGI.filter((a) =>
    (a.fagomraade && person.fagomraader.includes(a.fagomraade)) || (a.fg && person.faggrupper.includes(a.fg)));
  if (klasser.length || udenEnergi.length) {
    el.append(h('h2', { style: { marginTop: '24px' } }, 'Mine anlæg i Dalux'));
    el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px' } },
      'Anlægsklasserne her er dem, opgaver på området bliver oprettet på.'));
    el.append(tabel([
      { navn: 'Kode', celle: (a) => h('span', { class: a.udenforDalux ? 'muted' : 'mono' }, a.kode || '—') },
      { navn: 'Anlægsklasse', celle: (a) => a.navn, wrap: true },
      { navn: 'Hører til', celle: (a) => (a.fg
          ? h('span', {}, swatch(fgFarve(a.fg)), fgNavn(a.fg))
          : h('span', {}, swatch(foFarve(a.fagomraade)), a.fagomraade)) },
      { navn: 'Registreret', r: true, celle: (a) => (a.antal ? dkTal(a.antal) : h('span', { class: 'muted' }, 'ikke talt')) },
    ], [...klasser, ...udenEnergi]));
  }

  /* Forbrugsfordeling for dem, der har en energiside. */
  if (!person.udenEnergiside && d.faggruppeAar) {
    const dele = person.faggrupper
      .map((f) => ({ navn: fgNavn(f), vaerdi: (d.faggruppeAar.find((x) => x.fg === f) || {}).gwh || 0, farve: fgFarve(f) }))
      .filter((x) => x.vaerdi > 0);
    if (dele.length) {
      const sum = dele.reduce((a, x) => a + x.vaerdi, 0);
      el.append(h('h2', { style: { marginTop: '24px' } }, 'Mit forbrug'));
      el.append(h('div', { class: 'card' },
        stack(dele, sum), legend(dele, sum, (v) => v.toFixed(2) + ' GWh'),
        h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px', marginBottom: 0 } },
          `Målt på ${dkTal(Math.max(...person.faggrupper.map((f) => (d.faggruppeAar.find((x) => x.fg === f) || {}).butikker || 0)))} butikker. `
          + 'Resten af porteføljen har ikke bimåling på området — se datadækningen under Overblik.')));
    }
  }

  /* Gentagne fejl på mine fagområder. */
  const gentagne = (d.gentagneButik || []).filter((g) => person.fagomraader.includes(g.fagomraade));
  const gentagneAnlaeg = (d.gentagneAnlaeg || []).filter((g) => person.fagomraader.includes(g.fagomraade));
  if (gentagne.length || gentagneAnlaeg.length) {
    el.append(h('h2', { style: { marginTop: '24px' } }, 'Gentagne fejl på mit område'));
    if (gentagne.length) el.append(tabel([
      { navn: 'Butik', celle: (g) => h('span', {}, h('strong', {}, g.butik), h('span', { class: 'muted mono' }, ` · ${g.kardex}`)), wrap: true },
      { navn: 'Opgaver', r: true, celle: (g) => dkTal(g.antal) },
      { navn: 'Anlæg', r: true, celle: (g) => dkTal(g.anlaegAntal) },
      { navn: 'Anbefaling', celle: (g) => {
          const v = vurderButik(g.fagomraade, g.antal, g.anlaegAntal);
          return h('span', { title: v.tolkning }, badge(HANDLINGER[v.handling].navn,
            v.handling === 'warranty_claim' ? 'p2' : ''));
        } },
      { navn: 'Tolkning', celle: (g) => h('span', { class: 'muted' }, vurderButik(g.fagomraade, g.antal, g.anlaegAntal).tolkning), wrap: true },
    ], gentagne));
    if (gentagneAnlaeg.length) el.append(h('div', { style: { marginTop: '10px' } }, tabel([
      { navn: 'Anlæg', celle: (g) => h('strong', {}, g.anlaeg) },
      { navn: 'Butik', celle: (g) => g.butik, wrap: true },
      { navn: 'Opgaver', r: true, celle: (g) => dkTal(g.antal) },
      { navn: 'Anbefaling', celle: (g) => {
          const v = vurderGentagelse(g.fagomraade, g.antal);
          return badge(HANDLINGER[v.handling].navn, v.handling === 'replace' ? 'p1' : v.handling === 'warranty_claim' ? 'p2' : '');
        } },
    ], gentagneAnlaeg)));
  }

  /* Mine detektorer — og hvad der blokerer dem. */
  const mine_det = DETEKTORER.filter((x) => person.detektorer.includes(x.id));
  el.append(h('h2', { style: { marginTop: '24px' } }, 'Mine detektorer'));
  el.append(tabel([
    { navn: 'Id', celle: (x) => h('span', { class: 'mono' }, x.id) },
    { navn: 'Detektor', celle: (x) => x.navn, wrap: true },
    { navn: 'Status', celle: (x) => badge(x.status, x.status === 'drift' ? 'ok' : x.status === 'skygge' ? 'p3' : '') },
    { navn: 'Symptom', celle: (x) => h('span', { class: 'muted' }, x.symptom), wrap: true },
    { navn: 'Mangler', celle: (x) => (x.mangler.length
        ? h('span', { style: { color: 'var(--p2)' } }, x.mangler.join(', '))
        : h('span', { style: { color: 'var(--ok)' } }, 'intet')), wrap: true },
  ], mine_det));

  /* Hvad jeg endnu ikke kan se. */
  const blokerende = [...new Set(mine_det.filter((x) => x.status !== 'drift').flatMap((x) => x.mangler))];
  const idrift = mine_det.filter((x) => x.status === 'drift').length;
  el.append(h('div', { class: blokerende.length ? 'note warn' : 'note', style: { marginTop: '16px' } },
    h('strong', {}, `${idrift} af ${mine_det.length} detektorer er i drift på mit område.`), ' ',
    blokerende.length
      ? `De øvrige venter på: ${blokerende.join(' · ')}. Indtil de er på plads, er en tom kø ikke det samme som et anlæg uden fejl.`
      : 'Alle detektorer på området kører.'));

  if (person.noegleKilder && person.noegleKilder.length) {
    el.append(h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px' } },
      'Kilder, området hviler på: ' + person.noegleKilder.join(' · ')));
  }

  /* To-personers-reglen. */
  const stedfortraeder = state.ansvarlige[person.id] && state.ansvarlige[person.id].stedfortraeder;
  el.append(h('div', { class: stedfortraeder ? 'note' : 'note stop', style: { marginTop: '14px' } },
    h('strong', {}, 'Stedfortræder: '),
    stedfortraeder || 'ikke sat.',
    stedfortraeder
      ? ''
      : ' En sag må aldrig kunne stå og vente på én person. Er den fagansvarlige fraværende, skal sagen automatisk '
        + 'gå videre efter det aftalte antal dage — og det kræver et navn. Sættes under Opsætning.'));

  return el;
}

/* En tom kø er ikke en god nyhed i sig selv. Den kan betyde tre vidt
 * forskellige ting, og den fagansvarlige skal kunne se hvilken. */
function tomKoe(person) {
  const mine = DETEKTORER.filter((x) => person.detektorer.includes(x.id));
  const drift = mine.filter((x) => x.status === 'drift');
  const venter = mine.filter((x) => x.status !== 'drift');
  const blokerende = [...new Set(venter.flatMap((x) => x.mangler))];

  const kort = h('div', { class: 'card' });
  kort.append(h('p', { style: { margin: '0 0 10px', fontSize: '13px' } },
    h('strong', {}, 'Ingen åbne sager på området lige nu.'), ' Der er tre grunde, det kan skyldes:'));

  const linje = (mærke, tekst, stil) => h('div', { class: 'row', style: { display: 'flex', gap: '10px', padding: '6px 0', borderBottom: '1px dashed var(--line-2)' } },
    h('span', { style: { minWidth: '18px', color: stil } }, mærke),
    h('span', { style: { fontSize: '12.5px' } }, tekst));

  kort.append(h('div', {},
    linje(drift.length ? '✓' : '—',
      drift.length
        ? `${drift.length} af områdets detektorer kører og har ikke fundet noget over tærsklen: ${drift.map((d) => d.navn).join(', ')}.`
        : 'Ingen af områdets detektorer er i drift — der bliver ikke kigget efter noget endnu.',
      drift.length ? 'var(--ok)' : 'var(--p1)'),

    venter.length
      ? linje('⚑',
          `${venter.length} detektorer venter stadig: ${venter.map((d) => `${d.id} ${d.navn}`).join(', ')}.`
          + (blokerende.length ? ` De mangler: ${blokerende.join(' · ')}.` : ''),
          'var(--p2)')
      : null,

    person.udenEnergiside
      ? linje('i',
          'Området har ingen energiside, så en sag kan kun opstå af gentagne opgaver i Dalux — '
          + 'ikke af et merforbrug. Det gør køen tyndere, men ikke mindre vigtig.',
          'var(--ink-3)')
      : null,
  ));

  kort.append(h('p', { class: 'muted', style: { fontSize: '12px', margin: '12px 0 0' } },
    'En tom kø er kun en god nyhed, når alle detektorer på området kører. '
    + 'Ellers betyder den, at der ikke bliver kigget — ikke at der ikke er noget at finde.'));
  return kort;
}

/* ---- Beregninger pr. person ----------------------------------------------- */

function energiFor(person, d) {
  if (!d || !d.faggruppeAar || !person.faggrupper.length) return null;
  const gwh = person.faggrupper.reduce((a, f) => a + ((d.faggruppeAar.find((x) => x.fg === f) || {}).gwh || 0), 0);
  if (!gwh) return null;
  const total = d.portefolje ? d.portefolje.elBruttoGWh : null;
  return {
    gwh,
    andel: total ? (100 * gwh / total) : null,
    kr: gwh * 1e6 * state.forudsaetninger.elpris,
  };
}

function opgaverFor(person, d) {
  if (!d || !d.opgaveFagomraade || !person.fagomraader.length) return null;
  const raekker = d.opgaveFagomraade.filter((o) => person.fagomraader.includes(o.fagomraade));
  if (!raekker.length) return null;
  return {
    antal: raekker.reduce((a, x) => a + x.antal, 0),
    butikker: Math.max(...raekker.map((x) => x.butikker)),
  };
}

/* ---- Sager uden ejer ------------------------------------------------------ */

function herreloese(gaaTil) {
  const el = h('div', {});
  const uden = herreloeseSager(state.sager).filter(aaben);
  const udaekkede = udaekkedeFaggrupper(FAGGRUPPER).filter((f) => f.key !== 'lejere');

  el.append(h('h2', {}, `Sager uden ejer (${uden.length})`));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Det her er den vigtigste liste i hele opsætningen. En sag uden modtager bliver aldrig behandlet, '
    + 'og den fejl er tavs — der kommer ingen fejlmeddelelse, når noget lander i et hul.'));

  if (!uden.length) {
    el.append(h('div', { class: 'note' }, 'Alle åbne sager har en ejer.'));
    return el;
  }

  const prType = {};
  for (const s of uden) {
    const n = s.sagsnavn;
    (prType[n] ||= { antal: 0, kr: 0, fg: s.faggruppe, eksempel: s });
    prType[n].antal++; prType[n].kr += s.krAar;
  }

  el.append(tabel([
    { navn: 'Sagstype', celle: (r) => h('span', {}, swatch(fgFarve(r[1].fg)), r[0]), wrap: true },
    { navn: 'Antal', r: true, celle: (r) => dkTal(r[1].antal) },
    { navn: 'Beløb/år', r: true, celle: (r) => h('span', { class: r[1].eksempel.krKlasse === 'blindt' ? 'muted' : '' }, dkTal(r[1].kr)) },
    { navn: 'Falder på', celle: (r) => fgNavn(r[1].fg) },
  ], Object.entries(prType).sort((a, b) => b[1].antal - a[1].antal), { onRow: (r) => visSag(r[1].eksempel, gaaTil) }));

  el.append(h('div', { class: 'note stop', style: { marginTop: '14px' } },
    h('strong', {}, 'Hullet er "Øvrigt/uspecificeret", og det er ikke en tilfældighed.'), h('br'),
    'De fleste sager om restpost, benchmark, målerfejl og ny konstant last hører til dér, fordi de netop '
    + 'handler om forbrug, der endnu ikke kan henføres til et anlæg. De syv fagansvarlige dækker hver sin '
    + 'anlægstype — men ingen dækker det, der ikke er placeret endnu.', h('br'), h('br'),
    'Opsætningen mangler derfor én rolle: en energiansvarlig, der visiterer de tværgående og uplacerede sager '
    + 'videre. Indtil den er navngivet, står ', h('strong', {}, `${uden.length} åbne sager`), ' uden modtager.'));

  if (udaekkede.length) {
    el.append(h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px' } },
      'Faggrupper uden en navngiven ejer: ' + udaekkede.map((f) => f.navn).join(', ') + '.'));
  }

  return el;
}
