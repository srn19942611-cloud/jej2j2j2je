import { h, tabel, badge, swatch, kpi, modal, lukModal, felt, vaelger, prioritetBadge, dkTal, dkKr, pct, tom, stack, legend } from '../ui.js';
import { state, noegletal, visiter, gem, opdater, traefBeslutning } from '../state.js';
import { PERSONER, PERSON, VISITATOR, sagerFor, visitationskoe, udaekkedeFaggrupper, ejerAfSag } from '../personer.js';
import { FAGGRUPPER, FG, fgNavn, fgFarve, DETEKTORER, FALSK_ALARM_AARSAGER } from '../taxonomy.js';
import { GRUNDE, grundFor, foreslaaModtager, moenstreKlarTilRegel, koeAlder, hvadVilleToemmeKoeen, regelnoegle } from '../visitation.js';
import { UKLASSIFICEREDE, UDAEKKEDE_OMRAADER, FAGOMRAADER_UDEN_ANSVARLIG } from '../seed.js';
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
  const vis = state.visitationer || {};
  const reg = state.routingregler || {};
  for (const p of PERSONER) {
    const antal = sagerFor(p, state.sager, vis, reg).filter(aaben).length;
    const tilVisitation = p.visitator ? visitationskoe(state.sager, vis, reg).filter(aaben).length : 0;
    const knap = h('button', {
      class: 'btn' + (p.id === person.id ? ' primary' : ''),
      onclick: () => gaaTil('mitomraade', { person: p.id }),
    }, p.navn,
      antal ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, String(antal)) : null,
      tilVisitation ? h('span', { class: 'badge p2', style: { marginLeft: '4px' }, title: 'til visitation' }, `+${tilVisitation}`) : null);
    vaelger.append(knap);
  }
  el.append(vaelger);

  el.append(dashboard(person, gaaTil));

  /* Sager uden ejer — den vigtigste liste i hele opsætningen. */
  el.append(h('hr', { class: 'rule' }));
  el.append(herreloese(gaaTil));
  el.append(udaekkedeAfsnit());

  return el;
}

const aaben = (s) => s.status === 'ny' || s.status === 'vurderet';

function dashboard(person, gaaTil) {
  const el = h('div', {});
  const d = state.data;
  const vis = state.visitationer || {};
  const reg = state.routingregler || {};
  const mine = sagerFor(person, state.sager, vis, reg);
  const aabne = mine.filter(aaben);
  const koe = person.visitator ? visitationskoe(state.sager, vis, reg).filter(aaben) : [];

  /* Hoved. */
  el.append(h('div', { class: 'card', style: { marginBottom: '14px' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-start' } },
      h('div', {},
        h('h2', { style: { margin: 0, fontSize: '17px' } }, person.navn),
        h('div', { style: { color: 'var(--ink-2)', fontSize: '13px', marginTop: '3px' } }, person.omraade),
        h('p', { class: 'muted', style: { fontSize: '12.5px', margin: '6px 0 0', maxWidth: '70ch' } }, person.beskrivelse)),
      h('div', { class: 'pill-row' },
        // Et fagområde kan hedde det samme som en faggruppe (Solceller findes
        // begge steder). Vis navnet én gang — det er samme område for personen.
        ...(() => {
          const set = new Set();
          const ud = [];
          // Vis det, personen faktisk dækker — inklusive de flader, der hører
          // til et aggregat frem for til faggruppen som helhed.
          for (const k of (person.daekker || person.faggrupper.map((f) => ({ fg: f })))) {
            const navn = k.note || fgNavn(k.fg);
            if (set.has(navn)) continue;
            set.add(navn);
            ud.push(badge(h('span', { title: k.note || '' }, swatch(fgFarve(k.fg)), navn),
              k.roller ? 'ok' : ''));
          }
          for (const f of person.fagomraader) {
            if (set.has(f)) continue;
            set.add(f); ud.push(badge(h('span', {}, swatch(foFarve(f)), f)));
          }
          return ud;
        })(),
        badge(person.fag),
        person.visitator ? badge('visitator', 'p2') : null)),
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
    person.visitator
      ? kpi('Til visitation', dkTal(koe.length), 'sager uden fagansvarlig — skal sendes videre, ikke løses')
      : kpi('Opgaver i Dalux', opgaver ? dkTal(opgaver.antal) : '—',
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

  /* Visitationskøen — en anden slags arbejde end min egen kø. */
  if (person.visitator) el.append(visitationsafsnit(koe, gaaTil));

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

/* ---- Visitationskøen ------------------------------------------------------ */

/* Visitation er triage, ikke ejerskab. Tre ting afgøres: hører sagen til hos
 * nogen, er den værd at bruge tid på, og burde afgørelsen have været truffet
 * automatisk? Det sidste er det vigtigste — en visitator, der sender den samme
 * slags sag samme sted hen hver uge, udfører et arbejde, en regel burde gøre. */
function visitationsafsnit(koe, gaaTil) {
  const el = h('div', {});
  const regler = state.routingregler || {};
  const vis = state.visitationer || {};

  el.append(h('h2', { style: { marginTop: '24px' } }, `Til visitation (${koe.length})`));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Opgaven er ikke at løse sagerne, men at afgøre hvor de hører til — eller at lukke dem. '
    + 'En sag i denne kø er ubehandlet, uanset hvor hurtigt der bliver kigget på den.'));

  if (!koe.length) {
    el.append(h('div', { class: 'note' }, 'Køen er tom. Alle åbne sager har en fagansvarlig.'));
    return el;
  }

  /* Køens alder — nøgletallet, der måler bemandingen frem for detektorerne. */
  const alder = koeAlder(koe);
  el.append(h('div', { class: 'grid cards', style: { marginBottom: '14px' } },
    kpi('I køen', dkTal(alder.antal), 'sager uden fagansvarlig'),
    kpi('Median alder', alder.median != null ? `${alder.median} dage` : '—',
      `målet er under ${alder.maal} arbejdsdage`),
    kpi('Ældste', alder.aeldste != null ? `${alder.aeldste} dage` : '—',
      alder.overMaal ? `${alder.overMaal} sager er over målet` : 'ingen over målet'),
    kpi('Med forslag', dkTal(koe.filter((s) => foreslaaModtager(s, { regler, visitationer: vis })).length),
      'hubben kan pege på en modtager')));

  if (alder.overMaal > 0) {
    el.append(h('div', { class: 'note warn', style: { marginBottom: '12px' } },
      h('strong', {}, `${alder.overMaal} sager har ligget over ${alder.maal} dage.`), ' ',
      'Køens alder måler, om funktionen er bemandet — ikke om detektorerne er gode. '
      + 'En lang kø, der tømmes hurtigt, er sundere end en kort, der står stille.'));
  }

  /* Hvad der ville tømme køen — det mest nyttige, visitationen kan producere. */
  const grunde = hvadVilleToemmeKoeen(koe);
  el.append(h('h3', {}, 'Hvorfor sagerne står her'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'De fem grunde kræver hver sin handling. At slå dem sammen til "uden ejer" skjuler, at nogle er et '
    + 'bemandingsspørgsmål og andre er et datahul — og datahullerne lukker sig selv, når målepunkterne kommer på plads.'));
  el.append(tabel([
    { navn: 'Grund', celle: (g) => h('span', {}, h('strong', {}, g.navn)), wrap: true },
    { navn: 'Slags', celle: (g) => badge(g.slags, g.slags === 'datahul' ? 'p3' : 'p2') },
    { navn: 'Sager', r: true, celle: (g) => dkTal(g.antal) },
    { navn: 'Beløb/år', r: true, celle: (g) => dkTal(g.kr) },
    { navn: 'Hvad der skal til', celle: (g) => h('span', { class: 'muted' }, g.handling), wrap: true },
  ], grunde));

  /* Selve køen, grupperet pr. sagstype, med et begrundet forslag. */
  const perType = {};
  for (const s of koe) {
    (perType[s.sagsnavn] ||= { navn: s.sagsnavn, antal: 0, kr: 0, klasse: s.krKlasse, fg: s.faggruppe, sager: [] });
    perType[s.sagsnavn].antal++; perType[s.sagsnavn].kr += s.krAar; perType[s.sagsnavn].sager.push(s);
  }
  const raekker = Object.values(perType)
    .map((t) => ({ ...t, forslag: foreslaaModtager(t.sager[0], { regler, visitationer: vis }) }))
    .sort((a, b) => b.antal - a.antal);

  el.append(h('h3', { style: { marginTop: '20px' } }, 'Køen'));
  el.append(tabel([
    { navn: 'Sagstype', celle: (r) => h('span', {}, swatch(fgFarve(r.fg)), r.navn), wrap: true },
    { navn: 'Antal', r: true, celle: (r) => dkTal(r.antal) },
    { navn: 'Beløb/år', r: true, celle: (r) => h('span', { class: r.klasse === 'blindt' ? 'muted' : '' }, dkTal(r.kr)) },
    { navn: 'Slags', celle: (r) => badge(r.klasse, r.klasse === 'besparelse' ? 'ok' : r.klasse === 'potentiale' ? 'p3' : '') },
    { navn: 'Forslag', celle: (r) => (r.forslag
        ? h('span', { title: r.forslag.grund },
            h('strong', {}, r.forslag.person.navn), ' ', badge(r.forslag.sikkerhed, r.forslag.sikkerhed === 'regel' ? 'ok' : ''))
        : h('span', { class: 'muted' }, 'intet forslag')), wrap: true },
    { navn: 'Hvorfor', celle: (r) => h('span', { class: 'muted' }, r.forslag ? r.forslag.grund : '—'), wrap: true },
    { navn: '', celle: (r) => h('div', { class: 'btnrow' },
        r.forslag ? h('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); godkendForslag(r); } }, 'Godkend') : null,
        h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); dialogVisitering(r.sager, r.navn, r.forslag); } }, 'Vælg …')) },
  ], raekker, { onRow: (r) => visSag(r.sager[0], gaaTil) }));

  /* Mønstre, der er modne til at blive en regel. */
  const moenstre = moenstreKlarTilRegel(vis, state.sager).filter((m) => !regler[m.noegle]);
  if (moenstre.length) {
    el.append(h('div', { class: 'card', style: { marginTop: '14px' } },
      h('h3', { style: { marginTop: 0 } }, 'Klar til at blive en fast regel'),
      h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0, maxWidth: '84ch' } },
        'Den samme slags sag er sendt samme sted hen nok gange til, at det ikke længere er en vurdering. '
        + 'Gøres det til en regel, forsvinder sagerne fra køen af sig selv — og visitatoren slipper for at '
        + 'tage den samme beslutning igen.'),
      h('div', { class: 'evidence' }, moenstre.map((m) => h('div', { class: 'row' },
        h('span', { class: 'k' }, m.eksempel ? m.eksempel.sagsnavn : m.noegle),
        h('span', {},
          `${m.antal} af ${m.ialt} er sendt til ${PERSON[m.personId] ? PERSON[m.personId].navn : m.personId}. `,
          h('button', { class: 'btn', style: { marginLeft: '8px' },
            onclick: () => opretRegel(m) }, 'Gør til regel')))))));
  }

  /* Gældende regler. */
  const gaeldende = Object.entries(regler);
  if (gaeldende.length) {
    el.append(h('details', { style: { marginTop: '12px' } },
      h('summary', {}, `Faste routingregler (${gaeldende.length})`),
      h('div', { style: { marginTop: '8px' } }, tabel([
        { navn: 'Regel', celle: (r) => h('span', { class: 'mono' }, r[0]), wrap: true },
        { navn: 'Går til', celle: (r) => (PERSON[r[1].personId] ? PERSON[r[1].personId].navn : r[1].personId) },
        { navn: 'Oprettet', celle: (r) => h('span', { class: 'muted mono' }, String(r[1].tid).slice(0, 10)) },
        { navn: '', celle: (r) => h('button', { class: 'btn danger', onclick: () => { delete state.routingregler[r[0]]; gem(); opdater(); } }, 'Fjern') },
      ], gaeldende))));
  }

  return el;
}

function godkendForslag(r) {
  for (const s of r.sager) visiter(s, r.forslag.person.id, r.forslag.grund);
}

function opretRegel(m) {
  state.routingregler = { ...(state.routingregler || {}),
    [m.noegle]: { personId: m.personId, begrundelse: `${m.antal} af ${m.ialt} sager sendt derhen`, tid: new Date().toISOString() } };
  gem(); opdater();
}

/** Vælg modtager — eller luk sagen. Ikke alt skal routes videre. */
function dialogVisitering(sager, sagstype, forslag) {
  const modtager = vaelger(
    PERSONER.map((p) => ({ vaerdi: p.id, navn: `${p.navn} — ${p.omraade}` })),
    { vaerdi: forslag ? forslag.person.id : '', tom: 'Vælg fagansvarlig …' });
  const note = h('textarea', { rows: 2, placeholder: 'Hvorfor netop dem? (valgfri)' });
  const alle = h('input', { type: 'checkbox' });
  alle.checked = true;
  const somRegel = h('input', { type: 'checkbox' });

  const knap = h('button', { class: 'btn primary', disabled: !forslag }, 'Send videre');
  modtager.addEventListener('change', () => { knap.disabled = !modtager.value; });
  knap.addEventListener('click', () => {
    const maal = alle.checked ? sager : [sager[0]];
    for (const s of maal) visiter(s, modtager.value, note.value);
    if (somRegel.checked) {
      opretRegel({ noegle: regelnoegle(sager[0]), personId: modtager.value, antal: maal.length, ialt: maal.length });
    }
    lukModal();
  });

  /* At lukke en sag er et gyldigt udfald af visitationen. Ikke alt, en
     detektor finder, er værd at sende videre — men årsagen skal med. */
  const aarsag = vaelger(FALSK_ALARM_AARSAGER.map((a) => ({ vaerdi: a, navn: a })), { tom: 'Vælg årsag …' });
  const lukKnap = h('button', { class: 'btn danger', disabled: true }, 'Luk uden at sende videre');
  aarsag.addEventListener('change', () => { lukKnap.disabled = !aarsag.value; });
  lukKnap.addEventListener('click', () => {
    for (const s of (alle.checked ? sager : [sager[0]])) {
      traefBeslutning(s, 'falsk', { aarsag: aarsag.value, note: note.value, bruger: VISITATOR ? VISITATOR.navn : 'Visitator' });
    }
    lukModal();
  });

  modal({
    titel: `Visitér · ${sagstype}`,
    bredde: 700,
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      forslag
        ? h('div', { class: 'note' }, h('strong', {}, `Forslag: ${forslag.person.navn}. `), forslag.grund)
        : h('div', { class: 'note warn' },
            'Hubben kan ikke foreslå en modtager. Sagen hører hverken til en faggruppe eller et fagområde, '
            + 'nogen dækker — så enten skal den lukkes, eller også mangler der en ansvarlig.'),
      felt('Fagansvarlig', modtager),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' } },
        alle, `Gælder alle ${sager.length} sager af denne type`),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' } },
        somRegel, 'Gør det til en fast regel, så fremtidige sager af denne type routes automatisk'),
      felt('Note', note),
      h('hr', { class: 'rule', style: { margin: '4px 0' } }),
      felt('… eller luk sagen', aarsag,
        'Ikke alt, en detektor finder, er værd at sende videre. Men årsagen skal med — et bart klik lærer os intet.')),
    knapper: [h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'), lukKnap, knap],
  });
}

/* ---- Bunden: hvad der stadig ikke kan placeres ---------------------------- */
/* ---- Sager uden ejer ------------------------------------------------------ */

/* Hvorfor står nogle faggrupper uhåndterede? Spørgsmålet fortjener tal, ikke
 * en påstand. Optællingen herunder er lavet på alle 11.817 el- og varmemålere. */
function udaekkedeAfsnit() {
  const el = h('div', {});
  el.append(h('h2', { style: { marginTop: '28px' } }, 'Hvorfor står nogle områder uhåndterede'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Gennemgangen af alle 11.817 el- og varmemålere gav fire forskellige grunde, og de kræver hver sin handling. '
    + 'To af dem var fejl i hubben selv og er rettet.'));

  el.append(tabel([
    { navn: 'Grund', celle: (r) => h('span', {}, h('strong', {}, r.grund)), wrap: true },
    { navn: 'Målepunkter', r: true, celle: (r) => dkTal(r.antal) },
    { navn: 'Tags', celle: (r) => h('span', { class: 'mono muted' }, r.tags), wrap: true },
    { navn: 'Slags', celle: (r) => badge(r.slags, r.slags === 'mapping' ? 'p1' : r.slags === 'manglende-faggruppe' ? 'p2' : '') },
    { navn: 'Status', celle: (r) => badge(r.status, r.status === 'rettet' ? 'ok' : 'p3') },
  ], UKLASSIFICEREDE, { onRow: (r) => modal({ titel: r.grund, krop:
      h('div', { class: 'grid', style: { gap: '10px' } },
        h('div', { class: 'kv' },
          h('dt', {}, 'Målepunkter'), h('dd', {}, dkTal(r.antal)),
          h('dt', {}, 'Tags'), h('dd', { class: 'mono' }, r.tags),
          h('dt', {}, 'Status'), h('dd', {}, r.status)),
        h('p', { style: { fontSize: '13px', margin: 0 } }, r.forklaring)) }) }));

  el.append(h('div', { class: 'note', style: { marginTop: '12px' } },
    h('strong', {}, 'To af grundene var fejl i hubben, ikke i data.'), h('br'),
    '· 198 OK Tank-målere lå i Øvrigt, fordi tagget satte rollen til lejer, men ingen faggruppe. '
    + 'De er lejerforbrug og skal ud af butikkens nøgletal. Rettet.', h('br'),
    '· 80 målepunkter på ovne, friture, kipsteger og komfurer lå i Øvrigt, fordi der ikke fandtes en '
    + 'faggruppe til dem. Produktion & køkken er nu oprettet — området er hverken køl eller ventilation, '
    + 'og det har sine egne leverandører.'));

  el.append(h('h3', { style: { marginTop: '20px' } }, 'Faggrupper uden en ansvarlig'));
  el.append(tabel([
    { navn: 'Faggruppe', celle: (r) => h('span', {}, swatch(fgFarve(r.fg)), r.navn) },
    { navn: 'Målepunkter', r: true, celle: (r) => dkTal(r.maalere) },
    { navn: 'Hvorfor ingen har den', celle: (r) => r.hvorfor, wrap: true },
    { navn: 'Hvor den hører hjemme', celle: (r) => h('span', { class: 'muted' }, r.hvem), wrap: true },
  ], UDAEKKEDE_OMRAADER));

  el.append(h('h3', { style: { marginTop: '20px' } }, 'Fagområder på opgavesiden uden en ansvarlig'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'De syv dækker de tekniske anlæg. Butikkerne melder betydeligt mere ind end det — og de opgaver '
    + 'har ingen af de syv. Det er ikke et hul i hubben, men et spørgsmål om, hvor grænsen for '
    + 'driftsorganisationen går.'));
  el.append(tabel([
    { navn: 'Fagområde', celle: (r) => h('span', {}, swatch(foFarve(r.navn)), r.navn) },
    { navn: 'Opgaver', r: true, celle: (r) => dkTal(r.opgaver) },
    { navn: 'Hvorfor', celle: (r) => h('span', { class: 'muted' }, r.hvorfor), wrap: true },
  ], FAGOMRAADER_UDEN_ANSVARLIG));

  return el;
}

function herreloese(gaaTil) {
  const el = h('div', {});
  const vis = state.visitationer || {};
  const koe = visitationskoe(state.sager, vis, state.routingregler || {}).filter(aaben);
  const udaekkede = udaekkedeFaggrupper(FAGGRUPPER).filter((f) => f.key !== 'lejere');

  el.append(h('h2', {}, 'Sager uden fagansvarlig'));
  if (!koe.length) {
    el.append(h('div', { class: 'note' }, 'Alle åbne sager har en fagansvarlig.'));
    return el;
  }

  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    `${koe.length} åbne sager har ingen fagansvarlig og ligger derfor hos `,
    VISITATOR ? h('strong', {}, `${VISITATOR.navn} som visitator`) : 'ingen',
    '. De er ikke herreløse — men de er heller ikke placeret, og en sag i visitationskøen er ubehandlet, '
    + 'indtil den er sendt videre.'));

  const kr = { besparelse: 0, potentiale: 0, blindt: 0 };
  for (const s of koe) kr[s.krKlasse] = (kr[s.krKlasse] || 0) + s.krAar;

  el.append(h('div', { class: 'grid cards' },
    kpi('I visitationskøen', dkTal(koe.length), VISITATOR ? `hos ${VISITATOR.navn}` : 'ingen visitator'),
    kpi('Besparelse', dkKr(kr.besparelse), 'realistisk gevinst, der venter på en modtager'),
    kpi('Potentiale', dkKr(kr.potentiale), 'øvre skøn — holder først efter en gennemgang'),
    kpi('Blindt forbrug', dkKr(kr.blindt), 'ikke en gevinst, men det ingen kan se')));

  if (VISITATOR) {
    el.append(h('div', { class: 'note', style: { marginTop: '14px' } },
      h('strong', {}, `${VISITATOR.navn} har to køer, og de må ikke blandes.`), ' ',
      'Hans egen — solceller og belysning — er sager, han selv skal løse. Visitationskøen er sager, '
      + 'han skal sende videre. Slås de sammen, forsvinder netop det, man skal kunne se: om sagerne '
      + 'bliver placeret, eller om de bare ligger hos den, der fik dem sidst.'));
  }

  if (udaekkede.length) {
    el.append(h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px' } },
      'Faggrupper uden en fagansvarlig: ' + udaekkede.map((f) => f.navn).join(', ')
      + '. De går til visitation, indtil en anlægstype kan sættes på dem.'));
  }

  return el;
}
