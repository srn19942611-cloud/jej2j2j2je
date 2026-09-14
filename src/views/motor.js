import { h, tabel, badge, swatch, kpi, felt, modal, dkTal, pct, tom } from '../ui.js';
import { state, skriv, opdater } from '../state.js';
import { byggAnlaegsindeks, analyserOpgave, koerMotor, gennemgangskoe } from '../motor.js';
import { fgNavn, fgFarve } from '../taxonomy.js';
import { foFarve } from '../opgaver.js';
import { TRIN, koerSynkronisering, byggHenter, naesteKoersel, opsummer, NATLIG_STANDARD, MANUEL_STANDARD } from '../sync.js';

/* To ting på én side: motoren, der læser opgaverne, og synkroniseringen,
 * der fodrer den. De hører sammen — en motor uden friske data er en motor,
 * der læser i går. */
export function motor(gaaTil) {
  const el = h('div', {});
  el.append(
    h('h1', {}, 'Motor og synkronisering'),
    h('p', { class: 'sub' },
      'Motoren læser hver Dalux-opgave og finder ud af, hvilket anlæg den handler om — '
      + 'og derfra hvilken faggruppe. Står det i opgaven, bruges det. Gør det ikke, læses teksten '
      + 'mod butikkens eget anlægsregister. Kan det ikke afgøres, siger motoren det.'),
  );

  el.append(motorAfsnit());
  el.append(h('hr', { class: 'rule' }));
  el.append(syncAfsnit());
  return el;
}

/* ---- Motoren -------------------------------------------------------------- */

function motorAfsnit() {
  const el = h('div', {});
  const d = state.data;
  const indeks = state.anlaegsindeks || byggAnlaegsindeks(d.daluxAnlaeg || demoAnlaeg());
  state.anlaegsindeks = indeks;

  el.append(h('h2', {}, 'Sådan afgør motoren det'));
  el.append(tabel([
    { navn: 'Trin', celle: (t) => badge(t.trin) },
    { navn: 'Hvad den gør', celle: (t) => t.hvad, wrap: true },
    { navn: 'Konfidens', r: true, celle: (t) => t.konf },
    { navn: 'Hvorfor lige dét', celle: (t) => h('span', { class: 'muted' }, t.hvorfor), wrap: true },
  ], [
    { trin: '1', hvad: 'Anlægs-id står direkte i opgaven og findes i butikkens register', konf: '100 %',
      hvorfor: 'Der er intet at gætte på — id\'et peger på ét anlæg.' },
    { trin: '2', hvad: 'Positionskode, fx "Pos. 117A"', konf: '95 %',
      hvorfor: 'Dalux navngiver kølemøbler efter position. Koden er entydig i butikken.' },
    { trin: '3', hvad: 'Navnematch mod butikkens egne anlæg', konf: '50–85 %',
      hvorfor: 'Kandidatmængden er butikkens 20–200 anlæg, ikke porteføljens 50.000. Det gør et svagt match stærkt.' },
    { trin: '4', hvad: 'Teksten peger på en anlægstype, men ikke et konkret anlæg', konf: '70 %',
      hvorfor: '"Kølerummet er for varmt" giver anlægstypen, selv om vi ikke ved hvilket kølerum.' },
    { trin: '5', hvad: 'Kun fagområdet kan afgøres', konf: '30–60 %',
      hvorfor: 'Nok til at sende til den rigtige fagansvarlige, ikke nok til at oprette en opgave på et anlæg.' },
    { trin: '6', hvad: 'Kan ikke afgøres — sagen går til gennemgang', konf: '—',
      hvorfor: 'Et gyldigt svar. En motor, der altid har et svar, er ikke dygtig — den er bare selvsikker.' },
  ]));

  el.append(h('div', { class: 'note', style: { marginTop: '14px' } },
    h('strong', {}, 'Anlægget først, faggruppen bagefter.'), ' ',
    'Kan vi pege på et anlæg, kender vi dets klassifikation i Dalux — og faggruppen følger af klassifikationen. '
    + 'Det er langt mere pålideligt end at gætte ud fra ord i en fritekst.'));

  el.append(h('div', { class: 'note warn', style: { marginTop: '10px' } },
    h('strong', {}, 'Handlingsord må aldrig bestemme emnet.'), ' ',
    '"Ovnen kan ikke gøre sig selv ren" er en ovn, ikke rengøring. Ord som rens, vask, skift, service, '
    + 'eftersyn og tilbud beskriver, hvad der skal gøres — ikke hvad det handler om. Uden den regel bliver '
    + 'en bageriovn til en rengøringsopgave, og det sker i de data, vi har set.'));

  /* Prøv den. */
  el.append(h('h2', { style: { marginTop: '24px' } }, 'Prøv motoren'));
  const kardex = h('input', { type: 'text', value: '2020', placeholder: 'kardex' });
  const navn = h('input', { type: 'text', value: 'Nederste liste er gået fra i kølereol', placeholder: 'Opgavens overskrift' });
  const beskr = h('textarea', { rows: 3 });
  beskr.value = 'Pos. 117A i grøntafdelingen. Listen nederst er faldet af.';
  const anlaegsfelt = h('input', { type: 'text', value: 'Grøntafdeling', placeholder: 'Anlægsfelt (ofte et sted, ikke et anlæg)' });
  const ud = h('div', {});

  const koer = () => {
    const r = analyserOpgave({
      kardex: kardex.value.trim(), taskName: navn.value, description: beskr.value, asset: anlaegsfelt.value,
    }, indeks);
    ud.replaceChildren(resultatKort(r));
  };
  [kardex, navn, beskr, anlaegsfelt].forEach((f) => f.addEventListener('input', koer));

  el.append(h('div', { class: 'card' },
    h('div', { class: 'grid cols-2' }, felt('Kardex', kardex), felt('Anlægsfelt', anlaegsfelt)),
    felt('Overskrift', navn),
    felt('Beskrivelse', beskr),
    h('div', { style: { marginTop: '12px' } }, ud)));
  koer();

  /* Eksempler fra de rigtige data — inkl. dem der er svære. */
  el.append(h('h2', { style: { marginTop: '24px' } }, 'Kørt på rigtige opgaver'));
  const eksempler = EKSEMPLER.map((e) => ({ ...e, r: analyserOpgave(e.opgave, indeks) }));
  const k = koerMotor(EKSEMPLER.map((e) => e.opgave), indeks);

  el.append(h('div', { class: 'grid cards', style: { marginBottom: '14px' } },
    kpi('Anlæg fundet', pct(k.anlaegPct), `${k.optaelling.anlaegFundet} af ${k.optaelling.total} opgaver`),
    kpi('Via klassifikation', dkTal(k.optaelling.viaKlassifikation + k.optaelling.udenEnergiside), 'anlæggets egen klasse afgjorde det'),
    kpi('Kun fagområde', dkTal(k.optaelling.viaTekst + k.optaelling.viaAnlaegstype), 'teksten rakte, anlægget ikke'),
    kpi('Kan ikke afgøres', pct(k.uafklaretPct), 'går til gennemgang')));

  el.append(tabel([
    { navn: 'Opgave', celle: (e) => h('span', {}, h('strong', {}, e.opgave.taskName)), wrap: true },
    { navn: 'Anlæg', celle: (e) => (e.r.anlaeg
        ? h('span', {}, h('strong', {}, e.r.anlaeg.navn), h('span', { class: 'muted' }, ` · ${e.r.anlaeg.klasse || '—'}`))
        : h('span', { class: 'muted' }, 'ikke fundet')), wrap: true },
    { navn: 'Trin', r: true, celle: (e) => (e.r.anlaegTrin || '—') },
    { navn: 'Faggruppe', celle: (e) => (e.r.faggruppe
        ? h('span', {}, swatch(fgFarve(e.r.faggruppe)), fgNavn(e.r.faggruppe))
        : h('span', { class: 'muted' }, 'ingen energiside')) },
    { navn: 'Fagområde', celle: (e) => (e.r.fagomraade
        ? h('span', {}, swatch(foFarve(e.r.fagomraade)), e.r.fagomraade) : '—') },
    { navn: 'Konfidens', r: true, celle: (e) => h('span', { title: e.r.metode },
        pct(e.r.konfidens * 100), ' ',
        badge(kort(e.r.metode), e.r.kanIkkeAfgoeres ? 'p2' : e.r.konfidens >= 0.8 ? 'ok' : '')) },
    { navn: 'Værd at bemærke', celle: (e) => (e.note ? h('span', { style: { color: 'var(--p2)' } }, e.note) : h('span', { class: 'muted' }, '—')), wrap: true },
  ], eksempler, { onRow: (e) => modal({ titel: e.opgave.taskName, krop: resultatKort(e.r, e.opgave), bredde: 760 }) }));

  /* Gennemgangskøen. */
  const koe = gennemgangskoe(k.resultater);
  if (koe.length) {
    el.append(h('h2', { style: { marginTop: '24px' } }, `Til gennemgang (${koe.length})`));
    el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '82ch' } },
      'De opgaver, motoren ikke kunne afgøre. Listen er ikke en fejlliste — den er den prioriterede ønskeseddel '
      + 'til, hvad der ville løfte motoren mest. Er andelen nul, gætter motoren bare. Er den halvtreds procent, '
      + 'mangler vi data. Den bør ligge et sted midt imellem.'));
    el.append(tabel([
      { navn: 'Hvorfor', celle: (r) => r.hvorfor, wrap: true },
      { navn: 'Konfidens', r: true, celle: (r) => pct(r.konfidens * 100) },
      { navn: 'Fagområde', celle: (r) => r.fagomraade || h('span', { class: 'muted' }, 'ukendt') },
    ], koe));
  }

  return el;
}

/* Metoden i to ord, så kolonnen ikke æder bredden fra det, der skal læses. */
const kort = (metode) => ({
  'anlægsklassifikation': 'klasse',
  'anlæg uden energiside': 'klasse',
  'anlægstype fra tekst': 'type',
  'fagområde fra tekst': 'tekst',
  'kan ikke afgøres': 'uafklaret',
}[metode] || metode);

function resultatKort(r, opgave) {
  return h('div', { class: 'card' },
    h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: '10px' } },
      r.anlaeg
        ? h('strong', {}, r.anlaeg.navn, h('span', { class: 'muted' }, ` · ${r.anlaeg.klasse || 'uden klasse'}`))
        : h('strong', { class: 'muted' }, 'Intet anlæg fundet'),
      badge(`trin ${r.anlaegTrin}`),
      badge(r.metode, r.kanIkkeAfgoeres ? 'p2' : r.konfidens >= 0.8 ? 'ok' : ''),
      badge(`konfidens ${Math.round(r.konfidens * 100)} %`)),

    h('div', { class: 'kv' },
      h('dt', {}, 'Faggruppe'), h('dd', {}, r.faggruppe
        ? h('span', {}, swatch(fgFarve(r.faggruppe)), fgNavn(r.faggruppe))
        : h('span', { class: 'muted' }, 'ingen energiside — anlægget hører til på opgavesiden')),
      h('dt', {}, 'Fagområde'), h('dd', {}, r.fagomraade || '—'),
      h('dt', {}, 'Anlægsklasse'), h('dd', {}, r.anlaegsklasse || '—')),

    h('details', { style: { marginTop: '10px' } },
      h('summary', {}, 'Sådan nåede motoren frem til det'),
      h('ol', { style: { fontSize: '12.5px', paddingLeft: '20px', margin: '8px 0 0' } },
        r.spor.map((s) => h('li', { style: { marginBottom: '3px' } }, s))),
      h('p', { class: 'muted', style: { fontSize: '12px', margin: '8px 0 0' } }, r.anlaegBegrundelse),
      r.kandidater && r.kandidater.length > 1
        ? h('p', { class: 'muted', style: { fontSize: '12px', margin: '6px 0 0' } },
            'Kandidater der var i spil: ' + r.kandidater.map((k) => k.navn).join(', '))
        : null),

    r.tilGennemgang
      ? h('div', { class: 'note warn', style: { marginTop: '10px' } },
          h('strong', {}, 'Går til gennemgang.'), ' ', r.hvorfor)
      : null);
}

/* Rigtige opgavemønstre fra Dalux, inkl. dem der er svære at læse. */
const EKSEMPLER = [
  { opgave: { kardex: '2020', taskName: 'Nederste liste er gået fra i kølereol', description: 'Pos. 117A grøntafdeling', asset: 'Grøntafdeling' } },
  { opgave: { kardex: '2020', taskName: 'Kunde dør virker ikke', description: '205769-01 klikker og åbner halvdelen af gangene ikke', asset: 'Kunde ydre dør' } },
  { opgave: { kardex: '2020', taskName: 'Ventilationsanlæg i butikken larmer', description: 'Kraftig støj fra aggregatet på taget' } },
  { opgave: { kardex: '2020', taskName: 'Ovn kan ikke gøre sig selv ren', description: 'Vi har en ovn i bageren som ikke kan gøre sig selv ren. Den trækker ikke sæbe ind.' },
    note: 'Handlingsordet "ren" ville ellers gøre den til en rengøringsopgave.' },
  { opgave: { kardex: '2020', taskName: 'Elhest har et fladt stykke på hjulet', description: 'El palleløfter har også problemer med batteriet', asset: 'Lager' },
    note: 'Butikkens ord ("elhest") er ikke registrets ord ("El palleløfter").' },
  { opgave: { kardex: '2020', taskName: 'Kæde til nødalarm mangler', description: 'Frost rum, Pos. 10A', asset: 'Frost rum' } },
  { opgave: { kardex: '9999', taskName: 'Kølerum holder ikke temperatur', description: 'Frostrummet er for varmt om eftermiddagen' },
    note: 'Butikken har intet anlægsregister — kun anlægstypen kan afgøres.' },
  { opgave: { kardex: '9999', taskName: 'Der er for varmt i butikken', description: 'ventilationen kører ikke som den skal' } },
  { opgave: { kardex: '9999', taskName: 'Diverse' }, note: 'Ingen beskrivelse, ingen anlægsreference.' },
];

function demoAnlaeg() {
  return [
    { asset_id: 'a1', kardex: '2020', name: 'Pos. 117A', classification_name: 'Køle-/frostreoler', classification_code: '739.031' },
    { asset_id: 'a2', kardex: '2020', name: 'Pos. 10A', classification_name: 'Køle-/frostrum', classification_code: '739.033' },
    { asset_id: 'a3', kardex: '2020', name: 'Pos. 14A', classification_name: 'Mekaniske porte' },
    { asset_id: 'a4', kardex: '2020', name: '205769-01', classification_name: 'Dørautomatik' },
    { asset_id: 'a5', kardex: '2020', name: 'Ventilationsanlæg butik', classification_name: 'Ventilationsanlæg', classification_code: '572.01' },
    { asset_id: 'a6', kardex: '2020', name: 'Ovn bageri', classification_name: 'Ovne' },
    { asset_id: 'a7', kardex: '2020', name: 'El palleløfter', classification_name: 'Stablere' },
    { asset_id: 'a8', kardex: '2020', name: 'Centralt køleanlæg', classification_name: 'Centralt køleanlæg (konsumkøl)', classification_code: '633.021' },
    { asset_id: 'a9', kardex: '2020', name: 'Lysanlæg butik', classification_name: 'Anlæg for almen belysning', classification_code: '635.01' },
  ];
}

/* ---- Synkroniseringen ----------------------------------------------------- */

/* Beregningstrinnene: motoren læser de nyhentede opgaver, og detektorerne
 * bygger sagerne op igen bagefter. De hører til i kørslen — ikke som noget,
 * nogen skal huske at trykke på bagefter. */
function beregningstrin() {
  return {
    async motor({ gem }) {
      const anlaeg = await gem('daluxAnlaeg');
      const opgaver = await gem('daluxOpgaver');
      if (!Array.isArray(anlaeg) || !Array.isArray(opgaver)) {
        const f = new Error('Springer over: anlæg eller opgaver blev ikke hentet.');
        f.springOver = true; throw f;
      }
      const indeks = byggAnlaegsindeks(anlaeg);
      state.anlaegsindeks = indeks;
      const k = koerMotor(opgaver.map(tilOpgave), indeks);
      state.motorResultat = k;
      skriv(`Motoren læste ${k.optaelling.total} opgaver — anlæg fundet i ${k.anlaegPct} %, ${k.uafklaretPct} % til gennemgang.`, 'ok');
      return { behandlede: k.optaelling.total };
    },
    async detektorer() {
      const { koerDetektorer } = await import('../state.js');
      koerDetektorer();
      return { sager: state.sager.length };
    },
  };
}

/** Dalux' feltnavne oversat til motorens. */
const tilOpgave = (o) => ({
  id: o.workOrderId ?? o.id ?? o.task_nr,
  kardex: o.kardex ?? null,
  building: o.building ?? o.buildingName ?? null,
  taskName: o.subject ?? o.taskName ?? o.name ?? null,
  description: o.description ?? null,
  workDescription: o.workDescription ?? null,
  asset: o.asset ?? o.assetName ?? null,
  taskTemplate: o.template ?? o.taskTemplate ?? null,
  team: o.team ?? null,
  supplier: o.supplier ?? o.company ?? null,
});

function syncAfsnit() {
  const el = h('div', {});
  el.append(h('h2', {}, 'Natlig synkronisering'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Dalux, Enity og solcelleplatformen hentes én gang i døgnet, og derefter kører motoren og detektorerne, '
    + 'så morgenens sagsliste er klar, inden nogen møder ind. Hvert trin er en lille enhed med sin egen status: '
    + 'et trin, der fejler, stopper ikke de andre.'));

  const naeste = naesteKoersel(state.cfg.syncTidspunkt || NATLIG_STANDARD.tidspunkt);
  const k = state.sidsteKoersel;

  el.append(h('div', { class: 'grid cards' },
    kpi('Planlagt', state.cfg.syncTidspunkt || NATLIG_STANDARD.tidspunkt, `næste: ${naeste.toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}`),
    kpi('Sidste kørsel', k ? k.status : 'ikke kørt', k ? opsummer(k) : 'kør den manuelt for at afprøve'),
    kpi('Trin', String(TRIN.length), '10 hentetrin + motor + detektorer'),
    kpi('Data i hubben', state.data ? (state.data.kilde === 'live' ? 'live' : 'udtræk') : '—',
      state.data ? `fra ${state.data.hentet}` : '')));

  const tabelBoks = h('div', { style: { marginTop: '14px' } });
  const tegnTabel = () => {
    const kk = state.sidsteKoersel;
    tabelBoks.replaceChildren(tabel([
      { navn: 'Trin', celle: (t) => h('span', { class: 'mono' }, t.id) },
      { navn: 'Hvad', celle: (t) => t.navn },
      { navn: 'Slags', celle: (t) => badge(t.slags) },
      { navn: 'Status', celle: (t) => {
          const s = kk && kk.trin[t.id];
          if (!s) return h('span', { class: 'muted' }, 'ikke kørt');
          const stil = s.status === 'ok' ? 'ok' : s.status === 'fejl' ? 'p1'
            : s.status.startsWith('prøver') ? 'p2' : s.status === 'kører' ? 'solid' : '';
          return badge(s.status, stil);
        } },
      { navn: 'Rækker', r: true, celle: (t) => { const s = kk && kk.trin[t.id]; return s && s.raekker ? dkTal(s.raekker) : '—'; } },
      { navn: 'Forsøg', r: true, celle: (t) => { const s = kk && kk.trin[t.id]; return s && s.forsoeg > 1 ? s.forsoeg : '—'; } },
      { navn: 'Beskrivelse', celle: (t) => {
          const s = kk && kk.trin[t.id];
          if (s && s.fejl) return h('span', { style: { color: 'var(--p1)' } }, s.fejl);
          return h('span', { class: 'muted' }, t.beskrivelse);
        }, wrap: true },
    ], TRIN));
  };
  tegnTabel();
  el.append(tabelBoks);

  const knap = h('button', { class: 'btn primary' }, 'Kør synkronisering nu');
  knap.addEventListener('click', async () => {
    knap.disabled = true; knap.textContent = 'Kører …';
    const henter = byggHenter({
      klienter: state.klienter,
      sol: null,
      gem: async (n, v) => { if (v === undefined) return (state.raadata || {})[n]; (state.raadata ||= {})[n] = v; return v; },
      vandmaerker: state.vandmaerker || {},
      beregn: beregningstrin(),
    });
    const k2 = await koerSynkronisering(henter, {
      ...MANUEL_STANDARD,
      udloest: 'manuelt',
      onOpdatering: (kk) => { state.sidsteKoersel = kk; tegnTabel(); },
    });
    state.sidsteKoersel = k2;
    state.vandmaerker = { ...(state.vandmaerker || {}), ...k2.vandmaerker };
    skriv(`Synkronisering: ${opsummer(k2)}`, k2.status === 'ok' ? 'ok' : k2.status === 'delvis' ? 'info' : 'fejl');
    tegnTabel();
    knap.disabled = false; knap.textContent = 'Kør synkronisering nu';
    opdater();
  });

  el.append(h('div', { class: 'btnrow', style: { marginTop: '14px' } }, knap));

  el.append(h('div', { class: 'note warn', style: { marginTop: '14px' } },
    h('strong', {}, 'En browserfane er ikke en pålidelig cron.'), ' ',
    'Fanen kan være lukket kl. 03. Knappen her og timeren i hubben er en bekvemmelighed — '
    + 'den rigtige natlige kørsel sker fra ', h('code', {}, 'sync/run.mjs'),
    ', der kører den samme kode fra Node via cron eller en scheduled workflow. '
    + 'Hubben viser derfor altid, hvornår der sidst kom data ind, så en manglende kørsel ikke kan '
    + 'forveksles med en rolig nat.'));

  el.append(h('details', { style: { marginTop: '12px' } },
    h('summary', {}, 'Sådan sættes den natlige kørsel op'),
    h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', fontSize: '11.5px', background: 'var(--panel-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)' } },
      `# cron — kl. 03.15 hver nat
15 3 * * *  cd /sti/til/hubben && node sync/run.mjs --ud data/ >> sync.log 2>&1

# afprøv planen uden at hente noget
node sync/run.mjs --toer

# kun én kilde
node sync/run.mjs --kun dalux

# GitHub Actions ligger klar i .github/workflows/natlig-sync.yml

# miljøvariabler
ENITY_MCP_URL   standard: ${'https://entity-love-helper.lovable.app/mcp'}
DALUX_MCP_URL   standard: ${'https://mcp-dalux-connect.lovable.app/mcp'}
SOL_API_URL     solcelleplatformen — uden den springes solcelletrinnene over
SOL_API_KEY     nøgle til samme
MCP_PROXY       valgfri videresender, hvis CORS blokerer`)));

  return el;
}
