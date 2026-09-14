import { h, kpi, tabel, stack, legend, badge, swatch, dkTal, dkKr, pct, tom } from '../ui.js';
import { state, noegletal } from '../state.js';
import { FAGGRUPPER, FG, fgNavn, fgFarve } from '../taxonomy.js';
import { fmtKr } from '../engine.js';

export function overblik(gaaTil) {
  const d = state.data;
  if (!d) return tom('Indlæser …');
  const n = noegletal();
  const p = d.portefoelje;
  const el = h('div', {});

  el.append(
    h('h1', {}, 'Overblik'),
    h('p', { class: 'sub' },
      `${dkTal(p.butikker)} butikker, ${dkTal(p.maalere)} målepunkter. `
      + `Tallene dækker ${p.periode.fra} til ${p.periode.til} og er `
      + (d.kilde === 'live' ? 'hentet live fra Enity.' : `et udtræk fra ${d.hentet}. Slå live-data til under Opsætning for at hente friske tal.`)),
  );

  const aarKr = p.elBruttoGWh * 1e6 * state.forudsaetninger.elpris;
  el.append(h('div', { class: 'grid cards' },
    kpi('El, portefølje', `${p.elBruttoGWh} GWh`, `${fmtKr(aarKr / 1e6)} mio. kr./år ved ${state.forudsaetninger.elpris.toFixed(2)} kr/kWh`),
    kpi('Åbne sager', dkTal(n.aabne), `${n.p1} P1 · ${n.p2} P2 · ${n.p3} P3 · ${n.p4} P4`),
    kpi('Besparelse i spil', dkKr(n.krAabne),
      n.krPotentiale ? `+ ${dkKr(n.krPotentiale)} i potentiale, der først holder efter en gennemgang` : 'Realistisk skøn — metoden står i hver sag'),
    kpi('Blindt forbrug', dkKr(n.krBlindt), 'Ikke et spild — den mængde forbrug, ingen kan se'),
  ));
  el.append(h('p', { class: 'muted', style: { fontSize: '12px', margin: '10px 0 0' } },
    'De tre beløb lægges aldrig sammen. En besparelse er en gevinst, et potentiale er et øvre skøn, '
    + 'og et blindt beløb er en risiko — ikke penge, der kan hentes hjem.'));

  /* Datadækning er hubbens vigtigste sundhedstegn: den afgør, hvor mange af
     detektorerne der overhovedet kan sige noget. */
  el.append(h('hr', { class: 'rule' }));
  const submaalt = d.faggruppeAar.reduce((s, f) => s + f.gwh, 0);
  const rest = p.elBruttoGWh - submaalt;
  const dele = d.faggruppeAar
    .filter((f) => f.gwh > 0)
    .map((f) => ({ navn: fgNavn(f.fg), vaerdi: f.gwh, farve: fgFarve(f.fg) }))
    .concat([{ navn: 'Restpost — ikke målt', vaerdi: rest, farve: fgFarve('oevrigt') }]);

  el.append(h('div', { class: 'split' },
    h('div', { class: 'card' },
      h('h2', {}, 'Hvor el\'en går hen'),
      stack(dele, p.elBruttoGWh),
      legend(dele, p.elBruttoGWh, (v) => v.toFixed(1) + ' GWh'),
      h('p', { class: 'note', style: { marginTop: '14px' } },
        `Restposten er ${Math.round(100 * rest / p.elBruttoGWh)} % af porteføljens el — `
        + `${fmtKr(rest * 1e6 * state.forudsaetninger.elpris / 1e6)} mio. kr./år, der ikke kan henføres til et anlæg. `
        + 'Det er ikke spild i sig selv, men alt derunder er usynligt for de anlægsnære detektorer.')),

    h('div', { class: 'card' },
      h('h2', {}, 'Datadækning pr. kæde'),
      h('div', { class: 'grid', style: { gap: '11px' } }, d.kaeder.map((k) =>
        h('div', {},
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' } },
            h('span', {}, k.kaede, h('span', { class: 'muted' }, ` · ${k.butikker} butikker`)),
            h('span', { class: 'num' }, pct(k.daekning))),
          h('div', { class: 'bar' },
            h('span', { style: { width: k.daekning + '%', background: k.daekning >= 70 ? 'var(--ok)' : k.daekning >= 45 ? 'var(--p3)' : 'var(--p1)' } })))))),
  ));

  /* Sagerne, som de fordeler sig. */
  el.append(h('hr', { class: 'rule' }));
  const åbne = state.sager.filter((s) => s.status === 'ny' || s.status === 'vurderet');
  const prType = {};
  for (const s of åbne) (prType[s.sagsnavn] ||= { antal: 0, kr: 0, fg: s.faggruppe, p: s.prioritet })
    , prType[s.sagsnavn].antal++, prType[s.sagsnavn].kr += s.krAar;

  el.append(h('div', { class: 'split' },
    h('div', {},
      h('h2', {}, 'Åbne sager efter type'),
      Object.keys(prType).length === 0
        ? tom('Ingen åbne sager. Kør detektorerne igen, eller genåbn en lukket sag.')
        : tabel([
            { navn: 'Sagstype', celle: (r) => h('span', {}, swatch(fgFarve(r[1].fg)), r[0]), wrap: true },
            { navn: 'Antal', r: true, celle: (r) => dkTal(r[1].antal) },
            { navn: 'Kr./år', r: true, celle: (r) => dkTal(r[1].kr) },
          ], Object.entries(prType).sort((a, b) => b[1].kr - a[1].kr),
          { onRow: () => gaaTil('sager') })),

    h('div', { class: 'card' },
      h('h2', {}, 'Sambesøg frem for mange kørsler'),
      h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0 } },
        'Fire små fund i samme butik skal ikke blive til fire kørsler. Her er de butikker, hvor åbne P3- og P4-sager kan lægges på én tur.'),
      state.sambesoeg.length === 0
        ? h('p', { class: 'muted' }, 'Ingen butikker har flere små sager lige nu.')
        : h('div', { class: 'evidence' }, state.sambesoeg.slice(0, 6).map((g) =>
            h('div', { class: 'row' },
              h('span', { class: 'k' }, g.butik),
              h('span', {}, `${g.antal} sager · ${dkKr(g.krAar)} i sagerne · ${g.fag.join(', ')}`))))),
  ));

  /* Hvad der ikke kan ses endnu — ærlighed om dataadgangen er en del af produktet. */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', { class: 'card' },
    h('h2', {}, 'Hvad hubben endnu ikke kan se'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0, maxWidth: '80ch' } },
      'Rækkefølgen i udrulningen følger dataadgangen, ikke den faglige interesse. '
      + 'Bølge 2 er den vigtigste, men bølge 1 er den, der kan køre nu.'),
    h('div', { class: 'grid cols-2' }, [
      ['AK-centralen · køl', 'Ikke etableret', 'Møbeltemperatur, kondenstryk, afrimning og gentagne alarmer. Den største enkeltbeslutning i hele planen: lokal Modbus/XML pr. butik, eller Danfoss\' cloudtjeneste.'],
      ['CTS Ltech · klima', 'Skal afklares', 'Setpunktsdrift, natsænkning og samtidig køl og varme. Kræver en officiel API eller en skriftlig aftale — ikke et personligt login.'],
      ['Leanheat · overskudsvarme', 'API findes', 'Varme afvist og købt samtidig er det dyreste enkeltmønster, vi har. Mangler feltvalg, opløsning og en servicekonto ejet af Coop.'],
      ['Unikair · ventilation', 'Ukendt', 'Filtertryk, vekslervirkningsgrad og SFP. Første skridt er at spørge leverandøren, om der findes en API.'],
    ].map(([navn, status, tekst]) =>
      h('div', { style: { padding: '2px 0' } },
        h('h3', {}, navn, ' ', badge(status, status === 'API findes' ? 'ok' : status === 'Ikke etableret' ? 'p1' : 'p2')),
        h('p', { class: 'muted', style: { fontSize: '12.5px', margin: 0 } }, tekst))))));

  return el;
}
