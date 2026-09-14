import { h, tabel, badge, swatch, modal, kpi, dkTal, pct, tom } from '../ui.js';
import { state } from '../state.js';
import { FAGGRUPPER, FG, fgNavn, fgFarve } from '../taxonomy.js';
import { TAGMAPPING, ANLAEGSKLASSER, ANLAEG_UDEN_ENERGI, ANLAEG_I_ALT, anlaegPrFaggruppe, tagsForFaggruppe, klassificerMaalepunkt } from '../anlaeg.js';
import { FAGOMRAADER, FO, foFarve } from '../opgaver.js';

/* Anlægsregistret binder de tre lag sammen: faggruppe → anlægsklasse →
 * målepunkt. Det er her, en medarbejder kan se, hvad et anlæg hedder i Dalux,
 * hvad det måles som i Enity, og hvem der har det. */
export function anlaeg(gaaTil) {
  const el = h('div', {});
  const d = state.data;

  el.append(
    h('h1', {}, 'Anlæg'),
    h('p', { class: 'sub' },
      'Det tekniske anlægsregister. Faggruppen er den, økonomien rapporteres på. '
      + 'Anlægsklassen er den, en tekniker arbejder på, og den Dalux opretter opgaver på. '
      + 'Målepunktet er det, detektorerne kigger på. Uden alle tre kan en sag hverken prissættes, forklares eller sendes det rigtige sted hen.'),
  );

  const opgaver = (d && d.opgaver) || {};
  el.append(h('div', { class: 'grid cards' },
    kpi('Anlæg i Dalux', dkTal(ANLAEG_I_ALT), `fordelt på ${dkTal(opgaver.bygninger || 0)} bygninger`),
    kpi('Energirelevante klasser', dkTal(ANLAEGSKLASSER.length), 'klasser der kan give en energisag'),
    kpi('Målepunkt-regler', dkTal(TAGMAPPING.length), 'fire niveauer — L0/1, L2, L3, L4'),
    kpi('Opgaver klassificeret', dkTal(opgaver.opgaver || 0), `på ${FAGOMRAADER.length} fagområder`)));

  el.append(h('hr', { class: 'rule' }));

  /* Pr. faggruppe: anlægsklasser + tags + opgavetryk. */
  const klasser = anlaegPrFaggruppe();
  const opgavePrFo = Object.fromEntries((d && d.opgaveFagomraade || []).map((o) => [o.fagomraade, o]));

  el.append(h('h2', {}, 'Faggruppe → anlægsklasse → målepunkt'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px' } },
    'Opsætningen er hentet fra Coop Energi Einsight og lagt sammen med Dalux’ egen anlægsklassifikation. '
    + 'Klik på en faggruppe for at se hele kæden.'));

  for (const fg of FAGGRUPPER) {
    const liste = klasser[fg.key] || [];
    const tags = tagsForFaggruppe(fg.key);
    // Solceller og overskudsvarme har målepunkter, men endnu ingen egen
    // klassifikation i Dalux. De skal stadig vises — hullet er selv en pointe.
    const foListe = FAGOMRAADER.filter((f) => f.fg === fg.key);
    const opg = foListe.map((f) => opgavePrFo[f.navn]).filter(Boolean);
    const opgAntal = opg.reduce((a, x) => a + x.antal, 0);
    if (!liste.length && !tags.length && !opgAntal && fg.key !== 'solceller') continue;

    el.append(h('div', { class: 'card', style: { marginBottom: '10px', cursor: 'pointer' },
      onclick: () => visFaggruppe(fg, liste, tags, opg) },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'baseline' } },
        h('div', {},
          h('h3', { style: { margin: 0 } }, swatch(fg.farve), fg.navn),
          h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '2px' } }, fg.def)),
        h('div', { class: 'pill-row' },
          badge(`${liste.length} anlægsklasser`, liste.length ? '' : 'p2'),
          badge(`${tags.length} målepunkt-tags`),
          opgAntal ? badge(`${dkTal(opgAntal)} opgaver · ${foListe.map((f) => f.navn).join(', ')}`, 'p3') : null,
          badge(fg.rolle))),
      !liste.length ? h('div', { style: { fontSize: '11.5px', marginTop: '6px', color: 'var(--p2)' } },
        'Ingen anlægsklasse i Dalux endnu — sager på faggruppen kan ikke hænges på et komponent.') : null,
      liste.some((a) => a.udenforDalux) ? h('div', { style: { fontSize: '11.5px', marginTop: '6px', color: 'var(--p2)' } },
        'Anlægsregistret ligger uden for Dalux — en sag kan derfor ikke hænges på et Dalux-komponent, før anlæggene er oprettet der.') : null,
    ));
  }

  /* Anlæg uden energiside — de skaber stadig opgaver. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Anlæg uden energiside'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '80ch' } },
    'De her anlæg bruger ikke strøm, vi måler — men de fylder i driften, og gentagne fejl på dem koster '
    + 'lige så meget som et merforbrug. De hører til på opgavesiden, ikke i energiregnskabet.'));
  el.append(tabel([
    { navn: 'Anlægstype', celle: (a) => a.navn, wrap: true },
    { navn: 'Fagområde', celle: (a) => (a.fagomraade ? h('span', {}, swatch(foFarve(a.fagomraade)), a.fagomraade) : h('span', {}, swatch(fgFarve(a.fg)), fgNavn(a.fg))) },
    { navn: 'Registreret', r: true, celle: (a) => dkTal(a.antal) },
    { navn: 'Note', celle: (a) => (a.note ? h('span', { class: 'muted' }, a.note) : '—'), wrap: true },
  ], ANLAEG_UDEN_ENERGI));

  /* Fagområder — opgavesidens inddeling. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h2', {}, 'Fagområder på opgavesiden'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '80ch' } },
    'En butik melder alt ind — ikke kun det, der bruger strøm. Opgaverne henføres automatisk ud fra anlægsfeltet, '
    + 'skabelonen og teksten, i den rækkefølge. Konfidensen siger, hvor sikker henføringen er: '
    + 'et anlægsopslag er sikkert, en tekstmatch er det ikke.'));
  el.append(tabel([
    { navn: 'Fagområde', celle: (f) => h('span', {}, swatch(f.farve), f.navn) },
    { navn: 'Opgaver', r: true, celle: (f) => dkTal((opgavePrFo[f.navn] || {}).antal) },
    { navn: 'Butikker', r: true, celle: (f) => dkTal((opgavePrFo[f.navn] || {}).butikker) },
    { navn: 'Konfidens', r: true, celle: (f) => {
        const k = (opgavePrFo[f.navn] || {}).konfidens;
        if (k == null) return '—';
        return h('span', { style: { color: k >= 0.8 ? 'var(--ok)' : k >= 0.6 ? 'var(--p3)' : 'var(--p1)' } }, pct(k * 100));
      } },
    { navn: 'Energiside', celle: (f) => (f.fg ? h('span', {}, swatch(fgFarve(f.fg)), fgNavn(f.fg)) : h('span', { class: 'muted' }, 'ingen')) },
    { navn: 'Fag på stedet', celle: (f) => f.fag },
  ], FAGOMRAADER.filter((f) => opgavePrFo[f.navn]).sort((a, b) => (opgavePrFo[b.navn].antal) - (opgavePrFo[a.navn].antal))));

  el.append(h('div', { class: 'note warn', style: { marginTop: '14px' } },
    h('strong', {}, 'Bygning/Tag og Ventilation/Klima ligger på 58 % konfidens.'), ' ',
    'De to er de mest tvetydige at læse ud af en fritekst — "der er varmt i butikken" kan være ventilation, køl eller solindfald. '
    + 'De skal derfor gennemgås manuelt, før en sag på dem sendes videre. Det er også dér, et fejlkorts felt "Ligner" ville betale sig hurtigst.'));

  return el;
}

function visFaggruppe(fg, klasser, tags, opg) {
  const krop = h('div', { class: 'grid', style: { gap: '16px' } });

  krop.append(h('div', { class: 'kv' },
    h('dt', {}, 'Definition'), h('dd', {}, fg.def),
    h('dt', {}, 'Enhed'), h('dd', {}, fg.enhed),
    h('dt', {}, 'Fagansvarlig'), h('dd', {}, fg.rolle),
    h('dt', {}, 'Fag på stedet'), h('dd', {}, fg.fag),
    opg && opg.length ? h('dt', {}, 'Opgaver i Dalux') : null,
    opg && opg.length ? h('dd', {}, opg.map((o) => `${o.fagomraade}: ${dkTal(o.antal)} opgaver på ${dkTal(o.butikker)} butikker`).join(' · ')) : null));

  if (klasser.length) {
    krop.append(h('div', {},
      h('h3', {}, `Anlægsklasser i Dalux (${klasser.length})`),
      h('p', { class: 'muted', style: { fontSize: '12px', marginTop: 0 } },
        'Koden er Dalux’ egen klassifikation. Det er den, en opgave bliver oprettet på.'),
      tabel([
        { navn: 'Kode', celle: (a) => h('span', { class: a.udenforDalux ? 'muted' : 'mono' }, a.kode) },
        { navn: 'Anlægsklasse', celle: (a) => a.navn, wrap: true },
        { navn: 'Registreret', r: true, celle: (a) => (a.antal ? dkTal(a.antal) : h('span', { class: 'muted' }, '—')) },
      ], klasser)));
  }

  if (tags.length) {
    krop.append(h('div', {},
      h('h3', {}, `Målepunkt-tags i Enity (${tags.length})`),
      h('p', { class: 'muted', style: { fontSize: '12px', marginTop: 0 } },
        'Det dybeste niveau vinder: L4 slår L2, som slår L0/1. Konfidensen følger med ind i sagen.'),
      tabel([
        { navn: 'Niveau', celle: (t) => badge(`L${t.niveau}`) },
        { navn: 'Tag', celle: (t) => h('span', { class: 'mono' }, t.tag), wrap: true },
        { navn: 'Konfidens', r: true, celle: (t) => pct(t.konfidens * 100) },
        { navn: 'Note', celle: (t) => (t.note ? h('span', { class: 'muted' }, t.note) : '—'), wrap: true },
      ], tags)));
  }

  const uafklarede = TAGMAPPING.filter((t) => t.kraeverUnderniveau || (t.konfidens === 0 && t.note));
  krop.append(h('details', {},
    h('summary', {}, `Tags der ikke kan afgøre en faggruppe alene (${uafklarede.length})`),
    h('div', { class: 'note warn', style: { marginTop: '8px' } },
      '"L0/1 HVAC" dækker både ventilation, køleflade og varmeflade. Den må derfor aldrig auto-mappes alene — '
      + 'målepunktet skal have et L2- eller L4-tag med. Det er den regel, der forhindrer, at en køleflade bliver '
      + 'talt som ventilation i energiregnskabet.'),
    h('div', { style: { marginTop: '8px' } }, tabel([
      { navn: 'Tag', celle: (t) => h('span', { class: 'mono' }, t.tag), wrap: true },
      { navn: 'Hvorfor', celle: (t) => t.note || 'Kræver underniveau', wrap: true },
    ], uafklarede))));

  modal({ titel: fg.navn, krop, bredde: 820 });
}
