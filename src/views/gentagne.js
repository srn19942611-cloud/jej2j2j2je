import { h, tabel, badge, swatch, modal, kpi, dkTal, tom, prioritetBadge } from '../ui.js';
import { state } from '../state.js';
import { FAGOMRAADER, FO, foFarve, HANDLINGER, porteføljemønstre, vurderGentagelse, vurderButik } from '../opgaver.js';
import { fgNavn, fgFarve } from '../taxonomy.js';
import { visSag } from './sager.js';

/* Gentagne fejl er den enkeltting, energidata alene ikke kan give, og som
 * medarbejderne mærker hver dag: den samme fejl, der kommer igen, efter at
 * opgaven er lukket. Fagbogens linje gælder alt: gentagen tilsmudsning er et
 * placeringsproblem, ikke et rengøringsproblem. */
export function gentagne(gaaTil) {
  const d = state.data;
  if (!d || !d.gentagneButik) return tom('Indlæser …');
  const el = h('div', {});

  el.append(
    h('h1', {}, 'Gentagne fejl'),
    h('p', { class: 'sub' },
      'Den samme fejl igen og igen i samme butik er ikke mange serviceopgaver. Det er én sag om et anlæg, '
      + 'der skal skiftes, en garanti, der skal påberåbes, eller en portefølje, der skal budgetteres. '
      + 'Data kommer fra Dalux alene — den her del kan køre i dag, uden AK-centralen.'),
  );

  const o = d.opgaver || {};
  const gAnlaeg = d.gentagneAnlaeg || [];
  const gButik = d.gentagneButik || [];
  const fund = d.fund || [];

  el.append(h('div', { class: 'grid cards' },
    kpi('Opgaver læst', dkTal(o.opgaver), `henført til ${FAGOMRAADER.length} fagområder automatisk`),
    kpi('Butikker med gentagelser', dkTal(gButik.length), 'mindst 12 opgaver i samme fagområde'),
    kpi('Anlæg med gentagelser', dkTal(gAnlaeg.length), 'samme anlæg meldt ind igen og igen'),
    kpi('Vurderede fund', dkTal(fund.length), 'færdige vurderinger med anbefalet handling')));

  /* Butikker, der skal gøres noget ved nu. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Butikker, der skal gøres noget ved nu'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '82ch' } },
    'Kolonnen "anlæg" er den vigtigste. Samler opgaverne sig på få anlæg, er der en systematisk fejl eller en garantisag. '
    + 'Spreder de sig over mange anlæg, er det butikkens anlægsportefølje, der er ved at være udtjent — og den samtale '
    + 'hører til i budgettet, ikke i endnu en serviceopgave.'));
  el.append(h('div', { class: 'note', style: { marginBottom: '12px' } },
    h('strong', {}, 'Skadedyr, rengøring, affald, alarm og elevator er markeret "planlagt".'), ' ',
    'De fagområder kører i forvejen på serviceaftale eller lovpligtigt eftersyn, så mange opgaver er forventet. '
    + 'Der foreslås aldrig udskiftning på dem — spørgsmålet er, om antallet svarer til det aftalte.'));

  el.append(tabel([
    { navn: 'Butik', celle: (g) => h('span', {}, h('strong', {}, g.butik), h('span', { class: 'muted mono' }, ` · ${g.kardex}`)), wrap: true },
    { navn: 'Fagområde', celle: (g) => h('span', {}, swatch(foFarve(g.fagomraade)), g.fagomraade) },
    { navn: 'Opgaver', r: true, celle: (g) => h('strong', {}, dkTal(g.antal)) },
    { navn: 'Anlæg', r: true, celle: (g) => dkTal(g.anlaegAntal) },
    { navn: 'Pr. anlæg', r: true, celle: (g) => (g.anlaegAntal ? (g.antal / g.anlaegAntal).toFixed(1) : '—') },
    { navn: 'Tolkning', celle: (g) => tolkning(g), wrap: true },
    { navn: 'Periode', celle: (g) => h('span', { class: 'muted mono' }, `${g.foerste} → ${g.seneste}`) },
  ], gButik, { onRow: (g) => visGentagelse(g, gaaTil) }));

  /* Anlæg med gentagelser. */
  if (gAnlaeg.length) {
    el.append(h('hr', { class: 'rule' }));
    el.append(h('h2', {}, 'Anlæg, hvor fejlen kommer igen'));
    el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px' } },
      'Her er det samme fysiske anlæg meldt ind flere gange. Hver opgave er lukket — og fejlen kom igen. '
      + 'Det er kendetegnet på symptombehandling: den egentlige årsag er aldrig fundet.'));
    el.append(tabel([
      { navn: 'Anlæg', celle: (g) => h('strong', {}, g.anlaeg) },
      { navn: 'Butik', celle: (g) => g.butik, wrap: true },
      { navn: 'Fagområde', celle: (g) => h('span', {}, swatch(foFarve(g.fagomraade)), g.fagomraade) },
      { navn: 'Opgaver', r: true, celle: (g) => h('strong', {}, dkTal(g.antal)) },
      { navn: 'Anbefaling', celle: (g) => {
          const v = vurderGentagelse(g.fagomraade, g.antal);
          return badge(HANDLINGER[v.handling].navn,
            v.handling === 'replace' ? 'p1' : v.handling === 'warranty_claim' ? 'p2' : v.planlagtService ? '' : '');
        } },
      { navn: 'Seneste', celle: (g) => h('span', { class: 'muted mono' }, g.seneste) },
    ], gAnlaeg, { onRow: (g) => visGentagelse(g, gaaTil) }));
  }

  /* Porteføljeblikket. */
  const alle = [...gAnlaeg.map((g) => ({ ...g })), ...gButik.map((g) => ({ ...g, anlaeg: null }))];
  const mønstre = porteføljemønstre(
    gAnlaeg.flatMap((g) => Array.from({ length: g.antal }, () => ({ anlaeg: g.anlaeg, fagomraade: g.fagomraade, kardex: g.kardex }))),
    { minButikker: 3 });

  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', { class: 'card' },
    h('h2', {}, 'Porteføljeblikket'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0, maxWidth: '82ch' } },
      'Den samme fejl på den samme anlægstype i mange butikker er ikke mange serviceopgaver. Det er ét indkøbs-, '
      + 'garanti- eller designproblem — og det går til den energiansvarlige og indkøb, ikke til servicepartneren. '
      + 'Det er det, ingen enkelt tekniker på et enkelt anlæg nogensinde får øje på.'),
    mønstre.length
      ? tabel([
          { navn: 'Anlægstype', celle: (m) => h('strong', {}, m.anlaeg) },
          { navn: 'Fagområde', celle: (m) => h('span', {}, swatch(foFarve(m.fagomraade)), m.fagomraade) },
          { navn: 'Butikker', r: true, celle: (m) => dkTal(m.butikker) },
          { navn: 'Opgaver', r: true, celle: (m) => dkTal(m.antal) },
          { navn: 'Snit pr. butik', r: true, celle: (m) => m.snit },
          { navn: 'Går til', celle: (m) => m.gaarTil, wrap: true },
        ], mønstre)
      : h('p', { class: 'muted' }, 'Ingen mønstre på tværs endnu — der skal flere butikker til, før et tværgående mønster er troværdigt.'),
    h('p', { class: 'note', style: { marginTop: '12px' } },
      'Porteføljeblikket kører som en selvstændig gennemgang — ikke hver time, men en gang om måneden på alle lukkede sager. '
      + 'Den skal ikke lave opgaver. Den skal lave beslutningsoplæg.')));

  /* Vurderede fund. */
  if (fund.length) {
    el.append(h('hr', { class: 'rule' }));
    el.append(h('h2', {}, 'Færdige vurderinger'));
    el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px' } },
      'Sådan ser en færdig vurdering ud, når fagområde-agenten har læst opgaverne igennem og foreslået en handling. '
      + 'Den skal stadig godkendes af et menneske, før der skrives til Dalux.'));
    for (const f of fund) el.append(fundKort(f));
  }

  return el;
}

function tolkning(g) {
  const v = vurderButik(g.fagomraade, g.antal, g.anlaegAntal);
  const maerke = v.planlagtService ? ['Planlagt', '']
    : !g.anlaegAntal || g.anlaegAntal === 1 ? ['Ét anlæg', 'p1']
    : g.antal / g.anlaegAntal >= 3 ? ['Få anlæg', 'p2']
    : ['Spredt', 'p3'];
  return h('span', {}, badge(maerke[0], maerke[1]), ' ', h('span', { class: 'muted' }, v.tolkning));
}

function fundKort(f) {
  const alvor = { high: 'p1', medium: 'p2', low: 'p3' }[f.alvor] || '';
  return h('div', { class: 'card', style: { marginBottom: '10px' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' } },
      h('div', {},
        h('h3', { style: { margin: 0 } }, f.butik, h('span', { class: 'muted mono' }, ` · ${f.kardex}`)),
        h('div', { class: 'muted', style: { fontSize: '12px' } }, `${f.anlaeg} · ${f.fagomraade}`)),
      h('div', { class: 'pill-row' },
        badge(HANDLINGER[f.handling] ? HANDLINGER[f.handling].navn : f.handling, f.handling === 'replace' ? 'p1' : f.handling === 'warranty_claim' ? 'p2' : ''),
        badge(`${f.gentagelser} gentagelser`, alvor),
        badge(f.status, f.status === 'godkendt' ? 'ok' : ''))),
    h('p', { style: { margin: '10px 0 6px', fontSize: '13px' } }, f.resume),
    h('p', { class: 'muted', style: { margin: 0, fontSize: '12px' } },
      HANDLINGER[f.handling] ? HANDLINGER[f.handling].forklaring : ''));
}

function visGentagelse(g, gaaTil) {
  const sag = state.sager.find((s) => s.butiksnummer === g.kardex
    && (g.anlaeg ? s.sagstype === 'gentagne_anlaeg' : s.sagstype === 'gentagne_butik'));
  if (sag) return visSag(sag, gaaTil);

  modal({
    titel: g.butik,
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      h('div', { class: 'kv' },
        h('dt', {}, 'Kardex'), h('dd', { class: 'mono' }, g.kardex),
        h('dt', {}, 'Fagområde'), h('dd', {}, g.fagomraade),
        h('dt', {}, 'Opgaver'), h('dd', {}, String(g.antal)),
        g.anlaegAntal ? h('dt', {}, 'Berørte anlæg') : null,
        g.anlaegAntal ? h('dd', {}, String(g.anlaegAntal)) : null,
        h('dt', {}, 'Periode'), h('dd', {}, `${g.foerste || '—'} → ${g.seneste || '—'}`)),
      h('div', { class: 'note' },
        'Der er ikke bygget en sag på denne endnu — den ligger under tærsklen, eller butikken kendes kun fra Dalux. '
        + 'Slå live-data til for at hente de enkelte opgaver og deres beskrivelser.')),
  });
}
