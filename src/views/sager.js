import { h, tabel, badge, prioritetBadge, swatch, modal, lukModal, felt, vaelger, dkTal, dkKr, pct, tom, doegnprofil } from '../ui.js';
import { state, traefBeslutning, genaabn, skriv, opdater } from '../state.js';
import { fgNavn, fgFarve, FALSK_ALARM_AARSAGER, PRIORITETER, FEJLKORT } from '../taxonomy.js';
import { fmtKr, fmtKwh } from '../engine.js';
import { hentMetadata, byggWorkOrder, opgavetekst, opretOpgave, foreslaaPrioritet, idAf, navnAf } from '../dalux.js';

let filter = { prioritet: '', faggruppe: '', status: 'åbne', soeg: '', klasse: '' };

/* Tre slags beløb, som aldrig må læses som det samme tal. */
const KLASSE_KORT = { besparelse: 'sparet', potentiale: 'potentiale', blindt: 'blindt' };

export function sager(gaaTil, args = {}) {
  const el = h('div', {});
  el.append(
    h('h1', {}, 'Sager'),
    h('p', { class: 'sub' },
      'Én fysisk fejl giver én sag. Nye signaler, der matcher en åben sag, hænges på som evidens — de bliver ikke til en ny sag. '
      + 'En sag dør aldrig i stilhed: den bliver til en opgave, til en undertrykkelsesregel, eller den lukkes med en begrundelse.'),
  );

  const opdaterListe = () => { const ny = liste(gaaTil); gammel.replaceWith(ny); gammel = ny; };
  const vaelg = (navn, muligheder, key) => {
    const s = vaelger(muligheder, { vaerdi: filter[key] });
    s.addEventListener('change', () => { filter[key] = s.value; opdaterListe(); });
    return h('label', { class: 'muted', style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' } }, navn, s);
  };

  const soeg = h('input', { type: 'text', placeholder: 'Søg butik eller sagstype …', value: filter.soeg });
  soeg.addEventListener('input', () => { filter.soeg = soeg.value; opdaterListe(); });

  el.append(h('div', { class: 'toolbar' },
    soeg,
    vaelg('Status', [
      { vaerdi: 'åbne', navn: 'Åbne' }, { vaerdi: '', navn: 'Alle' },
      { vaerdi: 'sendt til Dalux', navn: 'Sendt til Dalux' },
      { vaerdi: 'lukket', navn: 'Lukkede' },
    ], 'status'),
    vaelg('Prioritet', [{ vaerdi: '', navn: 'Alle' }, ...Object.keys(PRIORITETER).map((p) => ({ vaerdi: p, navn: p }))], 'prioritet'),
    vaelg('Fagområde', [{ vaerdi: '', navn: 'Alle' },
      ...[...new Set(state.sager.map((s) => s.faggruppe))].map((f) => ({ vaerdi: f, navn: fgNavn(f) }))], 'faggruppe'),
    vaelg('Beløbstype', [
      { vaerdi: '', navn: 'Alle' },
      { vaerdi: 'besparelse', navn: 'Besparelse' },
      { vaerdi: 'potentiale', navn: 'Potentiale' },
      { vaerdi: 'blindt', navn: 'Blindt forbrug' },
    ], 'klasse'),
  ));
  el.append(h('p', { class: 'muted', style: { fontSize: '12px', marginTop: '-6px' } },
    'Beløbene er af tre slags og lægges aldrig sammen: en besparelse er en gevinst, '
    + 'et potentiale er et øvre skøn, og et blindt beløb er forbrug, ingen kan se — ikke penge, der kan hentes hjem.'));

  let gammel = liste(gaaTil);
  el.append(gammel);

  if (args.sag) {
    const s = state.sager.find((x) => x.id === args.sag || `${x.butiksnummer}|${x.sagstype}` === args.sag);
    if (s) queueMicrotask(() => visSag(s, gaaTil));
  }
  return el;
}

function filtrerede() {
  return state.sager.filter((s) => {
    if (filter.prioritet && s.prioritet !== filter.prioritet) return false;
    if (filter.faggruppe && s.faggruppe !== filter.faggruppe) return false;
    if (filter.klasse && s.krKlasse !== filter.klasse) return false;
    if (filter.status === 'åbne' && !(s.status === 'ny' || s.status === 'vurderet')) return false;
    if (filter.status === 'lukket' && !String(s.status).startsWith('lukket')) return false;
    if (filter.status === 'sendt til Dalux' && s.status !== 'sendt til Dalux') return false;
    if (filter.soeg) {
      const q = filter.soeg.toLowerCase();
      if (!(`${s.butik} ${s.sagsnavn} ${s.by} ${s.kaede}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

function liste(gaaTil) {
  const r = filtrerede();
  if (!r.length) return tom('Ingen sager matcher filteret.');
  return tabel([
    { navn: '', celle: (s) => prioritetBadge(s.prioritet) },
    { navn: 'Butik', celle: (s) => h('span', {}, h('strong', {}, s.butik), h('span', { class: 'muted' }, ` · ${s.kaede}`)), wrap: true },
    { navn: 'Sag', celle: (s) => h('span', {}, swatch(fgFarve(s.faggruppe)), s.sagsnavn), wrap: true },
    { navn: 'Ansvarlig', celle: (s) => s.ansvarlig },
    { navn: 'Konfidens', r: true, celle: (s) => pct(s.konfidens.samlet) },
    { navn: 'Beløb/år', r: true, celle: (s) => h('span', {},
        h('span', { class: s.krKlasse === 'blindt' ? 'muted' : '' }, dkTal(s.krAar)), ' ',
        badge(KLASSE_KORT[s.krKlasse], `klasse ${s.krKlasse}`)) },
    { navn: 'Status', celle: (s) => badge(s.status, s.status === 'sendt til Dalux' ? 'ok' : String(s.status).startsWith('lukket') ? '' : 'solid') },
  ], r, { onRow: (s) => visSag(s, gaaTil) });
}

/* ---- Sagsvisning ---------------------------------------------------------- */

export function visSag(sag, gaaTil) {
  const krop = h('div', { class: 'grid', style: { gap: '16px' } });

  krop.append(h('div', { class: 'case-head' },
    h('div', {},
      h('h2', { style: { marginBottom: '2px' } }, sag.sagsnavn),
      h('div', { class: 'muted', style: { fontSize: '12.5px' } },
        `${sag.butik} · ${sag.kaede} · ${sag.by || ''} · ${sag.anlaeg}`)),
    h('div', { class: 'pill-row' },
      prioritetBadge(sag.prioritet), badge(fgNavn(sag.faggruppe)), badge(sag.status))));

  /* Hvad vi tror, og hvor sikre vi er. */
  krop.append(h('div', { class: 'card' },
    h('h3', {}, 'Hvad vi tror'),
    h('p', { style: { margin: '0 0 12px' } }, sag.hypotese),
    h('div', { class: 'conf' },
      h('strong', {}, `Konfidens ${sag.konfidens.samlet} %`),
      h('span', { class: 'muted', style: { fontSize: '12px' } }, 'bygger på fire ting'),
      ...sag.konfidens.dele.flatMap((d) => [
        h('span', { class: 'muted' }, `${d.navn}: ${d.vaerdi}`),
        h('span', { class: 'bar', style: { width: '90px' } },
          h('span', { style: { width: Math.round(d.score * 100) + '%', background: 'var(--accent)' } })),
      ]))));

  /* Hvorfor — evidensen fra hvert signal. */
  const evidens = h('div', { class: 'card' }, h('h3', {}, 'Hvorfor'));
  for (const s of sag.signaler) {
    evidens.append(h('div', { style: { marginTop: '10px' } },
      h('div', { style: { fontSize: '12.5px', marginBottom: '6px' } },
        badge(`${s.detektor} v${s.version}`), ' ', h('span', {}, s.symptom)),
      h('div', { class: 'evidence' }, s.evidens.map(([k, v]) =>
        h('div', { class: 'row' }, h('span', { class: 'k' }, k), h('span', { class: 'num' }, v)))),
      h('div', { class: 'muted', style: { fontSize: '11.5px', marginTop: '4px' } }, `Periode: ${s.periode}`)));
  }
  if (sag.sagstype === 'natlast') {
    const p = state.data.profiler[0];
    if (p) evidens.append(h('div', { style: { marginTop: '14px' } },
      h('div', { class: 'muted', style: { fontSize: '12px', marginBottom: '4px' } },
        `Døgnprofil, ${p.periode} — mørke søjler er lukketimer`),
      doegnprofil(p.timer)));
  }
  krop.append(evidens);

  /* Hvad det koster. */
  krop.append(h('div', { class: 'card' },
    h('h3', {}, 'Hvad det koster at lade stå'),
    h('div', { style: { fontFamily: 'var(--mono)', fontSize: '21px', margin: '2px 0 6px' } },
      `${dkKr(sag.krAar)}/år `, badge(KLASSE_KORT[sag.krKlasse], `klasse ${sag.krKlasse}`)),
    h('p', { class: 'muted', style: { fontSize: '12.5px', margin: 0 } }, sag.krMetode)));

  /* Tjekpunkter og forventning. */
  krop.append(h('div', { class: 'card' },
    h('h3', {}, 'Hvad servicepartneren skal tjekke'),
    h('ol', { style: { margin: '0 0 10px', paddingLeft: '20px', fontSize: '13px' } },
      sag.tjekpunkter.map((t) => h('li', { style: { marginBottom: '4px' } }, t))),
    h('div', { class: 'kv' },
      h('dt', {}, 'Fag'), h('dd', {}, sag.fag),
      h('dt', {}, 'Ansvarlig'), h('dd', {}, sag.ansvarlig),
      h('dt', {}, 'Forventet fund'), h('dd', {}, sag.forventetFund || '—'))));

  /* Forbehold — det, der gør sagen ærlig. */
  if (sag.forbehold.length || sag.manglerKilder.length) {
    krop.append(h('div', { class: 'note warn' },
      h('strong', {}, 'Det, vi ikke kan afgøre'), h('br'),
      ...sag.forbehold.map((f) => h('div', { style: { marginTop: '5px' } }, '· ' + f)),
      sag.manglerKilder.length
        ? h('div', { style: { marginTop: '5px' } }, `· Målepunkter, der ville løfte diagnosen, mangler stadig: ${sag.manglerKilder.join(', ')}.`)
        : null));
  }

  /* Relevante fejlkort fra fagbogen. */
  const kort = FEJLKORT.filter((k) => k.fg === sag.faggruppe || (sag.sagstype === 'restpost' && k.nr === 'M-01') || (sag.sagstype === 'spring' && k.nr === 'E-01'));
  if (kort.length) {
    krop.append(h('details', {},
      h('summary', {}, `Fejlkort fra fagbogen (${kort.length})`),
      h('div', { style: { marginTop: '10px' } }, kort.map((k) => fejlkortBoks(k)))));
  }

  /* Tidligere beslutning. */
  if (sag.beslutning) {
    const b = sag.beslutning;
    krop.append(h('div', { class: 'note' },
      h('strong', {}, 'Afgjort'), ` ${new Date(b.tid).toLocaleString('da-DK')} af ${b.bruger}: `,
      b.valg === 'opgave' ? `opgave oprettet i Dalux${b.daluxWorkOrderId ? ` (id ${b.daluxWorkOrderId})` : ''}.`
      : b.valg === 'falsk' ? `falsk alarm — ${b.aarsag}.`
      : b.valg === 'undertryk' ? `undertrykt til ${b.udloeb || 'uden udløbsdato'} af ${b.ejer || 'ukendt ejer'}.`
      : 'holdes åben med hævet tærskel.',
      b.note ? h('div', { style: { marginTop: '4px' } }, b.note) : null));
  }

  const knapper = sag.beslutning
    ? [h('button', { class: 'btn', onclick: () => { genaabn(sag); lukModal(); } }, 'Genåbn sagen')]
    : [
        h('button', { class: 'btn', onclick: () => dialogOvervaag(sag) }, 'Overvåg videre'),
        h('button', { class: 'btn', onclick: () => dialogUndertryk(sag) }, 'Kendt — undertryk'),
        h('button', { class: 'btn danger', onclick: () => dialogFalsk(sag) }, 'Falsk alarm'),
        h('button', { class: 'btn primary', onclick: () => dialogDalux(sag) }, 'Opret opgave i Dalux'),
      ];

  modal({ titel: `Sag ${sag.id}`, krop, knapper, bredde: 860 });
}

function fejlkortBoks(k) {
  return h('div', { class: 'card', style: { marginBottom: '10px' } },
    h('h3', {}, `${k.nr} · ${k.navn}`, ' ', badge(k.status), ' ', badge(`v${k.version}`)),
    h('div', { class: 'kv' },
      h('dt', {}, 'Anlægstype'), h('dd', {}, k.anlaegstype),
      h('dt', {}, 'Symptomer'), h('dd', {}, k.symptomer),
      h('dt', {}, 'Ligner'), h('dd', {}, k.ligner),
      h('dt', {}, 'Skelnes ved'), h('dd', {}, k.skelnes),
      h('dt', {}, 'Bekræftes af'), h('dd', {}, k.bekraeftes),
      h('dt', {}, 'Koster'), h('dd', {}, k.koster),
      h('dt', {}, 'Ved gentagelse'), h('dd', {}, k.gentagelse),
      h('dt', {}, 'Ejer'), h('dd', {}, k.ejer)));
}

/* ---- De fire knapper ------------------------------------------------------ */

function dialogFalsk(sag) {
  const aarsag = vaelger(FALSK_ALARM_AARSAGER.map((a) => ({ vaerdi: a, navn: a })), { tom: 'Vælg årsag …' });
  const note = h('textarea', { rows: 3, placeholder: 'Uddybning (valgfri)' });
  const knap = h('button', { class: 'btn primary', disabled: true }, 'Luk sagen som falsk alarm');
  aarsag.addEventListener('change', () => { knap.disabled = !aarsag.value; });
  knap.addEventListener('click', () => {
    traefBeslutning(sag, 'falsk', { aarsag: aarsag.value, note: note.value });
    skriv(`Sag på ${sag.butik} lukket som falsk alarm: ${aarsag.value}.`);
    lukModal();
  });
  modal({
    titel: 'Falsk alarm',
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      h('p', { class: 'note', style: { margin: 0 } },
        'Årsagen er hele værdien. Et bart klik på "falsk" lærer os ingenting — '
        + 'med årsagen ved vi præcis, hvad der skal rettes: tærsklen, dataen eller fejlkortets felt "Ligner".'),
      felt('Årsag', aarsag), felt('Note', note)),
    knapper: [h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'), knap],
  });
}

function dialogUndertryk(sag) {
  const om3mdr = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const ejer = h('input', { type: 'text', placeholder: 'Navn på den, der ejer undtagelsen' });
  const udloeb = h('input', { type: 'date', value: om3mdr });
  const note = h('textarea', { rows: 3, placeholder: 'Hvorfor er mønsteret accepteret netop her?' });
  const knap = h('button', { class: 'btn primary' }, 'Opret undertrykkelsesregel');
  knap.addEventListener('click', () => {
    traefBeslutning(sag, 'undertryk', { ejer: ejer.value, udloeb: udloeb.value, note: note.value });
    skriv(`Undertrykkelse oprettet på ${sag.butik}, udløber ${udloeb.value || 'aldrig'}.`, udloeb.value ? 'info' : 'fejl');
    lukModal();
  });
  modal({
    titel: 'Kendt — undertryk',
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      h('p', { class: 'note', style: { margin: 0 } },
        'Mønsteret er reelt, men accepteret her. Reglen får en ejer og en udløbsdato, '
        + 'så undtagelsen bliver taget op igen. Undertrykkelser uden udløbsdato er det nøgletal, der skal være nul.'),
      felt('Ejer', ejer), felt('Udløber', udloeb, 'Lad feltet stå tomt kun hvis undtagelsen er permanent — den tæller så med i nøgletallet.'),
      felt('Begrundelse', note)),
    knapper: [h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'), knap],
  });
}

function dialogOvervaag(sag) {
  const note = h('textarea', { rows: 3, placeholder: 'Hvad skal der til, før sagen skal frem igen?' });
  const knap = h('button', { class: 'btn primary' }, 'Hold sagen åben');
  knap.addEventListener('click', () => {
    traefBeslutning(sag, 'overvaag', { note: note.value });
    skriv(`Sag på ${sag.butik} holdes åben med hævet tærskel.`);
    lukModal();
  });
  modal({
    titel: 'Overvåg videre',
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      h('p', { class: 'note', style: { margin: 0 } },
        'Sagen holdes åben med hævet tærskel og genåbnes, hvis den vokser. '
        + 'Valget betyder, at vi var for tidligt ude — ikke at vi tog fejl.'),
      felt('Note', note)),
    knapper: [h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'), knap],
  });
}

/* ---- Opret opgave i Dalux ------------------------------------------------- */

async function dialogDalux(sag) {
  const tekst = h('textarea', { rows: 16 });
  tekst.value = opgavetekst(sag);

  const emne = h('input', { type: 'text', value: `${sag.sagsnavn} — ${sag.butik}` });
  const bygning = h('input', { type: 'text', value: sag.daluxBuildingId || '', placeholder: 'Dalux buildingId' });
  const deadline = h('input', { type: 'date', value: new Date(Date.now() + (sag.prioritet === 'P1' ? 1 : sag.prioritet === 'P2' ? 7 : 30) * 864e5).toISOString().slice(0, 10) });

  const skabelonBoks = h('div', {}, h('span', { class: 'muted' }, 'Henter fra Dalux …'));
  const prioritetBoks = h('div', {});
  const teamBoks = h('div', {});
  const status = h('div', { class: 'muted', style: { fontSize: '12px' } });

  let valgte = { templateId: '', priorityId: '', teamId: '' };

  const forhaandsvis = h('details', {}, h('summary', {}, 'Vis den præcise payload, der sendes'),
    h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', margin: '8px 0 0' } }, ''));
  const opdaterPayload = () => {
    forhaandsvis.querySelector('pre').textContent = JSON.stringify({
      tool: 'dalux_create_workorder',
      arguments: { workOrder: { ...byggWorkOrder(sag, { ...valgte, buildingId: bygning.value, deadline: deadline.value }), subject: emne.value, description: tekst.value } },
    }, null, 2);
  };
  [emne, bygning, deadline, tekst].forEach((f) => f.addEventListener('input', opdaterPayload));
  opdaterPayload();

  const knap = h('button', { class: 'btn primary' }, 'Opret opgaven i Dalux');
  knap.addEventListener('click', async () => {
    knap.disabled = true; status.textContent = 'Sender til Dalux …';
    try {
      const { id } = await opretOpgave(
        { ...sag, sagsnavn: emne.value },
        { ...valgte, buildingId: bygning.value, deadline: deadline.value },
      );
      traefBeslutning(sag, 'opgave', { daluxWorkOrderId: id, note: `Opgave oprettet: ${emne.value}` });
      lukModal();
    } catch (err) {
      status.textContent = `Kunne ikke oprette opgaven: ${err.message}`;
      status.className = 'note stop';
      knap.disabled = false;
      // Sagen forbliver åben — vi markerer aldrig noget som sendt, der ikke kom frem.
      const gem = h('button', { class: 'btn', style: { marginTop: '8px' } }, 'Notér i stedet at opgaven er oprettet manuelt');
      gem.addEventListener('click', () => {
        traefBeslutning(sag, 'opgave', { daluxWorkOrderId: null, note: 'Oprettet manuelt i Dalux — MCP-kaldet kunne ikke gennemføres.' });
        lukModal();
      });
      status.after(gem);
    }
  });

  modal({
    titel: 'Opret opgave i Dalux',
    bredde: 860,
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      h('p', { class: 'note', style: { margin: 0 } },
        'Der skrives til Dalux FM. Læs teksten igennem — den går videre til servicepartneren, som den står. '
        + 'Spørgsmålet til sidst om årsagen er det, der gør overvågningen bedre næste gang.'),
      felt('Emne', emne),
      h('div', { class: 'grid cols-2' }, felt('Dalux bygnings-id', bygning, sag.daluxBuildingId ? 'Fra koblingen mellem Enity og Dalux.' : 'Butikken er endnu ikke koblet til Dalux — udfyld manuelt.'), felt('Deadline', deadline)),
      h('div', { class: 'grid cols-2' }, felt('Skabelon', skabelonBoks), felt('Prioritet i Dalux', prioritetBoks)),
      felt('Team', teamBoks),
      felt('Beskrivelse til servicepartneren', tekst),
      forhaandsvis,
      status),
    knapper: [h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'), knap],
  });

  /* Metadata hentes efter dialogen er åben, så den ikke blokerer. */
  try {
    const md = await hentMetadata();
    const fyld = (boks, liste, key, forvalgt) => {
      boks.replaceChildren();
      if (!liste.length) { boks.append(h('span', { class: 'muted' }, 'Ingen værdier fra Dalux')); return; }
      const s = vaelger(liste.map((x) => ({ vaerdi: idAf(x), navn: navnAf(x) })), { vaerdi: forvalgt, tom: 'Ikke sat' });
      s.addEventListener('change', () => { valgte[key] = s.value; opdaterPayload(); });
      valgte[key] = forvalgt || '';
      boks.append(s);
    };
    fyld(skabelonBoks, md.templates, 'templateId', '');
    fyld(prioritetBoks, md.priorities, 'priorityId', foreslaaPrioritet(sag, md.priorities));
    fyld(teamBoks, md.teams, 'teamId', '');
    opdaterPayload();
  } catch (err) {
    const besked = h('span', { class: 'muted' }, `Kunne ikke hente skabeloner: ${err.message}`);
    skabelonBoks.replaceChildren(besked);
    prioritetBoks.replaceChildren(h('span', { class: 'muted' }, '—'));
    teamBoks.replaceChildren(h('span', { class: 'muted' }, '—'));
  }
}
