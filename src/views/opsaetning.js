import { h, tabel, badge, felt, dkTal, tom } from '../ui.js';
import { state, gem, indlaesData, koerDetektorer, opdater, skriv } from '../state.js';
import { FAGGRUPPER, fgNavn, fgFarve } from '../taxonomy.js';
import { PERSONER } from '../personer.js';
import { DEFAULTS } from '../mcp.js';

export function opsaetning() {
  const el = h('div', {});
  el.append(
    h('h1', {}, 'Opsætning'),
    h('p', { class: 'sub' },
      'Forudsætninger, datakilder og ansvar. Alt herunder kan ses, forklares og rulles tilbage — '
      + 'det er meningen. En model, der "bare lærte", kunne ingen af delene.'),
  );

  /* ---- Datakilder ---- */
  const enityUrl = h('input', { type: 'text', value: state.cfg.enityUrl });
  const daluxUrl = h('input', { type: 'text', value: state.cfg.daluxUrl });
  const proxy = h('input', { type: 'text', value: state.cfg.proxy, placeholder: 'fx https://min-proxy.dk/mcp — lad stå tom hvis ikke nødvendig' });
  const live = h('input', { type: 'checkbox' });
  live.checked = state.cfg.liveData;
  const autoSync = h('input', { type: 'checkbox' });
  autoSync.checked = state.cfg.autoSync;
  const syncTid = h('input', { type: 'text', value: state.cfg.syncTidspunkt || '03:15', placeholder: '03:15' });

  const status = h('div', { class: 'grid', style: { gap: '8px' } });
  const tegnStatus = () => {
    status.replaceChildren(...['enity', 'dalux'].map((k) => {
      const c = state.klienter[k];
      return h('div', { class: 'row', style: { display: 'flex', gap: '10px', alignItems: 'baseline' } },
        h('span', { class: `dot ${c.status === 'forbundet' ? 'live' : c.status === 'fejl' ? 'err' : 'off'}` }),
        h('strong', {}, c.name),
        h('span', { class: 'muted', style: { fontSize: '12px' } },
          c.status === 'forbundet' ? `${c.tools.length} værktøjer tilgængelige` : c.error || 'ikke prøvet endnu'));
    }));
  };
  tegnStatus();

  const test = h('button', { class: 'btn' }, 'Test forbindelsen');
  test.addEventListener('click', async () => {
    test.disabled = true;
    gemCfg();
    for (const k of ['enity', 'dalux']) {
      try { await state.klienter[k].connect(); skriv(`${state.klienter[k].name}: forbundet.`, 'ok'); }
      catch (err) { skriv(`${state.klienter[k].name}: ${err.message}`, 'fejl'); }
      tegnStatus();
    }
    test.disabled = false;
    opdater();
  });

  function gemCfg() {
    state.cfg.enityUrl = enityUrl.value.trim() || DEFAULTS.enity;
    state.cfg.daluxUrl = daluxUrl.value.trim() || DEFAULTS.dalux;
    state.cfg.proxy = proxy.value.trim();
    state.cfg.liveData = live.checked;
    state.cfg.autoSync = autoSync.checked;
    state.cfg.syncTidspunkt = (syncTid.value || '03:15').trim();
    for (const k of ['enity', 'dalux']) {
      const c = state.klienter[k];
      c.url = k === 'enity' ? state.cfg.enityUrl : state.cfg.daluxUrl;
      c.proxy = state.cfg.proxy;
      c.ready = null; c.sessionId = null; c.status = 'ukendt';
    }
    gem();
  }

  el.append(h('div', { class: 'card' },
    h('h2', {}, 'Datakilder'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0 } },
      'Begge servere taler MCP over HTTP uden login. Hubben kalder dem direkte fra browseren, '
      + 'så den kan køre som en statisk side. Kan browseren ikke nå dem — typisk fordi serveren '
      + 'ikke sender CORS-headere til dette domæne — så peg proxy-feltet på en videresender, der gør.'),
    h('div', { class: 'grid', style: { gap: '10px' } },
      felt('Enity (forbrug og produktion)', enityUrl),
      felt('Dalux FM (bygning, anlæg, opgaver)', daluxUrl),
      felt('Proxy foran begge (valgfri)', proxy),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' } },
        live, 'Hent porteføljedata live fra Enity i stedet for det seedede udtræk'),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' } },
        autoSync, 'Kør den natlige synkronisering fra denne browser'),
      felt('Tidspunkt for natlig kørsel', syncTid,
        'Browseren er ikke en pålidelig cron — fanen kan være lukket kl. 03. Den rigtige kørsel sker fra sync/run.mjs.'),
      status,
      h('div', { class: 'btnrow' }, test,
        knap('Gem og genindlæs', async () => {
          gemCfg();
          const { armNatligKoersel } = await import('../app.js');
          armNatligKoersel();
          await indlaesData();
          skriv('Data genindlæst.');
        })))));

  /* ---- Forudsætninger ---- */
  el.append(h('hr', { class: 'rule' }));
  const f = state.forudsaetninger;
  const felter = [
    ['elpris', 'Elpris', 'kr/kWh', 0.01, 'Bruges i alle beløbsberegninger. Metoden står i hver sag, så tallet kan efterprøves.'],
    ['varmepris', 'Varmepris', 'kr/kWh', 0.01, 'Foreløbigt skøn — ret den, når den rigtige gennemsnitspris er kendt.'],
    ['restpostGraense', 'Restpost der udløser sag', '%', 1, 'Over denne andel uforklaret forbrug oprettes en sag om manglende bimåling.'],
    ['natandelGraense', 'Natandel der udløser sag', '%', 1, 'Andel af døgnforbruget, der falder i lukketimerne.'],
    ['benchmarkGraense', 'Benchmark-faktor', '× median', 0.05, 'Hvor højt over kædens median en butik skal ligge, før den bliver en kandidat.'],
    ['springGraense', 'År-til-år-spring', '%', 1, 'Stigning mod samme måneder sidste år, der udløser sag om ny konstant last.'],
    ['daekningForbehold', 'Dækning under dette giver forbehold', '%', 1, 'Sagen oprettes, men får et forbehold og lavere konfidens.'],
    ['daekningMinimum', 'Dækning under dette opretter ikke sag', '%', 1, 'Undtaget er sagerne, der netop handler om manglende måling.'],
  ];
  const inputs = {};
  el.append(h('div', { class: 'card' },
    h('h2', {}, 'Forudsætninger og tærskler'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0 } },
      'Ændringer slår igennem på alle sager med det samme. I drift er forslaget til en ny tærskel automatisk — '
      + 'selve ændringen er det ikke, og den noteres med hvem og hvorfor.'),
    h('div', { class: 'grid cols-2' }, felter.map(([k, navn, enhed, trin, hjaelp]) => {
      const i = h('input', { type: 'number', step: trin, value: f[k] });
      inputs[k] = i;
      return felt(`${navn} (${enhed})`, i, hjaelp);
    })),
    h('div', { class: 'btnrow', style: { marginTop: '12px' } },
      knap('Anvend', () => {
        for (const [k, i] of Object.entries(inputs)) {
          const v = parseFloat(i.value);
          if (!Number.isNaN(v)) state.forudsaetninger[k] = v;
        }
        gem(); koerDetektorer(); opdater();
        skriv('Tærskler ændret — alle sager er regnet om.');
      }, 'primary'))));

  /* ---- Ansvarlige ---- */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', {},
    h('h2', {}, 'Fagansvarlige'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0, maxWidth: '78ch' } },
      'Ingen sag må stå uden en navngiven modtager. Er en fagansvarlig fraværende, går sagen til stedfortræderen '
      + 'efter det aftalte antal dage — og det kræver et navn. Klik på en række for at sætte det.'),
    tabel([
      { navn: 'Fagansvarlig', celle: (r) => h('strong', {}, r.navn) },
      { navn: 'Område', celle: (r) => r.omraade, wrap: true },
      { navn: 'Faggrupper', celle: (r) => (r.faggrupper.length
          ? h('span', { class: 'pill-row' }, r.faggrupper.map((f) =>
              h('span', {}, h('span', { class: 'swatch', style: { background: fgFarve(f) } }), fgNavn(f))))
          : h('span', { class: 'muted' }, 'ingen energiside')), wrap: true },
      { navn: 'Fag på stedet', celle: (r) => r.fag },
      { navn: 'Stedfortræder', celle: (r) => (state.ansvarlige[r.id]?.stedfortraeder
          ? badge(state.ansvarlige[r.id].stedfortraeder, 'ok') : badge('mangler', 'p1')) },
    ], PERSONER, { onRow: (r) => redigerAnsvarlig(r) })));

  const udaekket = FAGGRUPPER.filter((f) => f.key !== 'lejere'
    && !PERSONER.some((p) => p.faggrupper.includes(f.key)));
  if (udaekket.length) {
    el.append(h('div', { class: 'note stop', style: { marginTop: '12px' } },
      h('strong', {}, 'Faggrupper uden en navngiven ejer: '), udaekket.map((f) => f.navn).join(', '), '.', h('br'),
      '"Øvrigt/uspecificeret" er den, der betyder noget: det er dér restpost, benchmark og målerfejl lander, '
      + 'fordi de netop handler om forbrug, der endnu ikke kan henføres til et anlæg. '
      + 'Opsætningen mangler en energiansvarlig, der visiterer de sager videre.'));
  }

  /* ---- Undertrykkelser ---- */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', {},
    h('h2', {}, `Undertrykkelser (${state.undertrykkelser.length})`),
    state.undertrykkelser.length
      ? tabel([
          { navn: 'Butik', celle: (u) => u.butik },
          { navn: 'Detektor', celle: (u) => u.detektor },
          { navn: 'Ejer', celle: (u) => u.ejer || badge('mangler', 'p1') },
          { navn: 'Udløber', celle: (u) => (u.udloeb ? u.udloeb : badge('ingen udløbsdato', 'p1')) },
          { navn: 'Begrundelse', celle: (u) => u.begrundelse || '—', wrap: true },
        ], state.undertrykkelser)
      : h('p', { class: 'muted' }, 'Ingen undertrykkelser. Antallet uden udløbsdato skal være nul — det er sådan, systemet ikke langsomt bliver blindt.')));

  /* ---- Log ---- */
  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', {},
    h('h2', {}, 'Hændelseslog'),
    state.log.length
      ? h('div', { class: 'evidence card' }, state.log.slice(0, 20).map((l) =>
          h('div', { class: 'row' },
            h('span', { class: 'k mono' }, l.tid.toLocaleTimeString('da-DK')),
            h('span', { style: l.niveau === 'fejl' ? { color: 'var(--p1)' } : l.niveau === 'ok' ? { color: 'var(--ok)' } : null }, l.besked))))
      : h('p', { class: 'muted' }, 'Ingen hændelser endnu.')));

  return el;

  function redigerAnsvarlig(r) {
    const nuv = state.ansvarlige[r.id] || {};
    const sted = h('input', { type: 'text', value: nuv.stedfortraeder || '' });
    const email = h('input', { type: 'text', value: nuv.email || '', placeholder: 'til besked om P1-sager' });
    import('../ui.js').then(({ modal, lukModal }) => {
      modal({
        titel: `${r.navn} · ${r.omraade}`,
        krop: h('div', { class: 'grid', style: { gap: '12px' } },
          h('p', { class: 'note', style: { margin: 0 } }, r.beskrivelse),
          felt('Stedfortræder', sted,
            'To-personers-reglen: en sag må aldrig kunne stå og vente på én person.'),
          felt('E-mail', email),
          r.uafklaret ? h('div', { class: 'note warn' }, r.uafklaret) : null),
        knapper: [h('button', { class: 'btn primary', onclick: () => {
          state.ansvarlige[r.id] = { navn: r.navn, stedfortraeder: sted.value.trim(), email: email.value.trim() };
          gem(); opdater(); lukModal();
        } }, 'Gem')],
      });
    });
  }
}

function knap(tekst, fn, klasse = '') {
  const b = h('button', { class: `btn ${klasse}`.trim() }, tekst);
  b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } finally { b.disabled = false; } });
  return b;
}
