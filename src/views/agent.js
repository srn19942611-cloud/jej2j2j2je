/* Agentens side: varslerne, pop-up'en og feedbacken.
 *
 * Pop-up'en er stedet, hvor hele kæden bliver til en beslutning, og den er
 * bygget efter ét princip: den fagansvarlige skal kunne sige ja eller nej
 * uden at åbne noget andet. Derfor står hele grundlaget i den — hvad måleren
 * så, hvad vi tror, hvad der taler for og imod, hvad andre muligheder er, og
 * hvad der skal tjekkes i hvilken rækkefølge.
 *
 * To knapper, og de er ikke lige store:
 *
 *   Opret opgave i Dalux   sender teksten med over, som den står. Ingen
 *                          skal skrive den igen, og ingen skal gætte, hvad
 *                          hubben mente.
 *
 *   Afvis                  spørger hvorfor. Ikke af høflighed — det er den
 *                          eneste kilde til at vide, om diagnoserne rammer.
 *                          Seks grunde, og hver af dem ændrer noget konkret.
 */

import { h, tabel, badge, kpi, modal, lukModal, felt, vaelger, prioritetBadge, dkTal, dkKr, tom } from '../ui.js';
import { state, gem, opdater, skriv } from '../state.js';
import { AFVIS_GRUNDE, AFVIS_GRUND, varselTilOpgavetekst, registrerSvar, bekraeftFraOpgave, traefsikkerhed, agentnoegletal, justeredePriors, erfaringsvaegt } from '../agent.js';
import { AARSAGER, AARSAG } from '../aarsag.js';
import { SAMTIDIGHED } from '../korrelation.js';
import { PERSONER, PERSON } from '../personer.js';
import { fgNavn } from '../taxonomy.js';
import { opretOpgave } from '../dalux.js';

export function agentside(gaaTil, args = {}) {
  const el = h('div', {});
  const varsler = state.varsler || [];
  const laering = state.laering;
  const n = agentnoegletal(varsler, laering);

  el.append(
    h('h1', {}, 'Agenten'),
    h('p', { class: 'sub' },
      'Agenten læser hvert anlægs egen normal, sammenholder afvigelser med opgaverne i Dalux, '
      + 'stiller en diagnose og spørger den fagansvarlige. Svaret — også et nej — er det, der gør den bedre.'),
  );

  el.append(h('div', { class: 'kpi-row' },
    kpi('ÅBNE VARSLER', dkTal(n.aabne), `${n.p1} haster`),
    kpi('BESPARELSE I SPIL', dkKr(n.besparelse), 'kun det, der holder op med at løbe'),
    kpi('VARSLINGSTID', n.varsling.medianDage != null ? `${n.varsling.medianDage} dage` : '—',
      n.varsling.varsler ? `median over ${n.varsling.varsler} sager, måleren så først` : 'ingen sager med forspring endnu'),
    kpi('TRÆFSIKKERHED', n.praecision != null ? `${n.praecision} %` : '—',
      n.praecision != null ? `af ${n.besvarede} besvarede` : `${n.besvarede} svar — der skal 5 til`),
  ));

  if (!varsler.length) {
    el.append(tom('Ingen varsler. Kør agenten fra Opsætning, eller vent på den natlige synkronisering.'));
    return el;
  }

  /* Hvad kobling til Dalux gør ved billedet. Det er tallet, der viser, hvorfor
   * de to kilder skal ses sammen og ikke hver for sig. */
  el.append(h('h3', {}, 'Hvad Dalux siger om de samme anlæg'));
  el.append(h('div', { class: 'pill-row' },
    ...Object.entries(SAMTIDIGHED).map(([k, v]) => {
      const antal = varsler.filter((x) => x.kobling?.klasse === k).length;
      return h('span', { class: `badge ${v.farve}`, title: v.betydning }, `${v.navn}: ${antal}`);
    })));
  el.append(h('p', { class: 'note' },
    n.varsling.varsler
      ? `På ${n.varsling.varsler} af varslerne så måleren ændringen, før butikken meldte den ind — `
        + `mellem ${n.varsling.mindstDage} og ${n.varsling.mestDage} dage før, median ${n.varsling.medianDage}. `
        + 'De dage er, hvad overvågningen er værd.'
      : 'Ingen af varslerne har endnu en opgave i Dalux at holde sig op mod.'));

  el.append(h('h3', { style: { marginTop: '20px' } }, `Varsler (${varsler.length})`));
  el.append(tabel([
    { navn: '', celle: (v) => prioritetBadge(v.prioritet) },
    { navn: 'Anlæg', celle: (v) => h('strong', {}, v.enhed.navn), wrap: true },
    { navn: 'Butik', celle: (v) => v.butik, wrap: true },
    { navn: 'Hvad agenten tror', wrap: true, celle: (v) => h('span', {}, v.aarsagNavn,
      v.underGraense ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, 'under din grænse') : null) },
    { navn: 'Konfidens', r: true, celle: (v) => `${v.konfidens} %` },
    { navn: 'Dalux', celle: (v) => (v.kobling
      ? h('span', { class: `badge ${SAMTIDIGHED[v.kobling.klasse].farve}` }, SAMTIDIGHED[v.kobling.klasse].navn) : '—') },
    { navn: 'Beløb', r: true, celle: (v) => (v.krKlasse === 'besparelse' || v.krKlasse === 'potentiale'
      ? dkKr(v.kr) : h('span', { class: 'note' }, beloebsord(v.krKlasse))) },
    { navn: 'Til', celle: (v) => v.ejerNavn },
  ], varsler, { onRow: (v) => visVarsel(v, gaaTil) }));

  el.append(laeringsafsnit(laering));
  return el;
}

const beloebsord = (k) => ({ ingen: 'ingen elbesparelse', blindt: 'blindt punkt' }[k] || '—');

/* ---- Pop-up'en ------------------------------------------------------------ */

export function visVarsel(v, gaaTil) {
  const krop = h('div', {});

  // 1 · Hvad der er set. Tallene først, påstanden bagefter.
  krop.append(
    h('div', { class: 'pill-row' },
      prioritetBadge(v.prioritet),
      v.hastende ? h('span', { class: 'badge p1' }, 'Haster') : null,
      h('span', { class: 'badge' }, fgNavn(v.faggruppe)),
      v.enhed.dedikeret === false ? h('span', { class: 'badge p3' }, 'delt måler') : null,
    ),
    h('h3', { style: { marginTop: '10px' } }, v.overskrift),
  );

  krop.append(h('div', { class: 'kpi-row' },
    kpi(v.signatur.retning === 'ned' ? 'MINDREFORBRUG' : 'MERFORBRUG',
      `${dkTal(Math.abs(v.signatur.afvigKwhPrDoegn))} kWh/døgn`,
      v.signatur.afvigPct != null ? `${v.signatur.afvigPct} % mod det vejrkorrigerede normale` : ''),
    kpi('SIDEN', dansk(v.signatur.segmentStart),
      v.signatur.overgangsdoegn != null
        ? (v.signatur.overgangsdoegn <= 14 ? `ændringen skete på ${v.signatur.overgangsdoegn} døgn` : `gradvist over ${v.signatur.overgangsdoegn} døgn`)
        : ''),
    kpi('KONFIDENS', `${v.konfidens} %`, v.diagnose.entydig ? 'entydig diagnose' : 'to årsager ligger tæt'),
    kpi(v.krKlasse === 'besparelse' ? 'BESPARELSE/ÅR' : v.krKlasse === 'potentiale' ? 'POTENTIALE/ÅR' : 'BELØB',
      v.krKlasse === 'besparelse' || v.krKlasse === 'potentiale' ? dkKr(v.kr) : '—',
      beloebsord(v.krKlasse)),
  ));

  // 2 · Diagnosen og hvad der bærer den.
  krop.append(
    h('h4', { style: { marginTop: '18px' } }, 'Hvad agenten tror, det er'),
    h('p', {}, h('strong', {}, v.aarsagNavn), ' — ', v.forklaring),
  );

  krop.append(h('h4', {}, 'Hvad der peger på det'));
  const bevisliste = h('ul', { class: 'bevis' });
  for (const b of v.beviser) {
    bevisliste.append(h('li', { class: b.for ? 'for' : 'imod' },
      h('span', { class: 'tegn' }, b.for ? '+' : '−'), b.tekst));
  }
  krop.append(bevisliste);

  if (v.kobling) {
    const s = SAMTIDIGHED[v.kobling.klasse];
    krop.append(h('div', { class: `note ${v.kobling.klasse === 'forklaret' ? 'warn' : ''}` },
      h('strong', {}, `Dalux · ${s.navn}. `), v.kobling.tekst || s.betydning));
  }

  if (v.alternativer.length) {
    krop.append(h('h4', {}, 'Andre muligheder, der ikke kan udelukkes'),
      h('div', { class: 'pill-row' }, ...v.alternativer.map((a) => h('span', { class: 'badge' }, `${a.navn} · ${a.andel} %`))));
  }

  // 3 · Hvad der skal gøres.
  krop.append(h('h4', { style: { marginTop: '16px' } }, 'Hvad der skal tjekkes — i denne rækkefølge'));
  const liste = h('ol', {});
  for (const t of v.tjekpunkter) liste.append(h('li', {}, t));
  krop.append(liste);
  krop.append(h('p', { class: 'note' }, h('strong', {}, 'Forventet fund: '), v.typiskFund));

  krop.append(h('details', {},
    h('summary', {}, 'Sådan er beløbet regnet'),
    h('p', { class: 'note' }, v.krMetode)));

  if (v.forbehold.length) {
    krop.append(h('div', { class: 'note warn' },
      h('strong', {}, 'Forbehold. '),
      h('ul', {}, ...v.forbehold.map((f) => h('li', {}, f)))));
  }

  krop.append(h('details', {},
    h('summary', {}, 'Se teksten, der følger med til Dalux'),
    h('pre', { class: 'udkast' }, varselTilOpgavetekst(v))));

  // 4 · De to knapper.
  modal({
    titel: `${v.id} · ${v.enhed.navn}`,
    krop,
    bredde: 860,
    knapper: [
      h('span', { class: 'note', style: { marginRight: 'auto' } },
        v.ejerHvorfor || `Til ${v.ejerNavn}.`),
      h('button', { class: 'btn', onclick: () => afvisDialog(v) }, 'Afvis'),
      h('button', { class: 'btn primary', onclick: () => opretDialog(v) }, 'Opret opgave i Dalux'),
    ],
  });
}

/* ---- Opret opgave ---------------------------------------------------------
 * Teksten er skrevet. Den fagansvarlige skal kunne rette i den, men skal
 * aldrig skulle skrive den.
 */
function opretDialog(v) {
  const tekst = h('textarea', { rows: 16, class: 'udkast-felt' }, varselTilOpgavetekst(v));
  const md = state.daluxMetadata;
  const prioritet = vaelger(
    (md?.priorities || [{ id: 'p2', navn: 'Normal' }]).map((p) => ({ vaerdi: String(p.id ?? p.priorityId), navn: String(p.name ?? p.navn) })),
    { vaerdi: v.prioritet === 'P1' ? '1' : '2' });
  const team = vaelger((md?.teams || []).map((t) => ({ vaerdi: String(t.id ?? t.teamId), navn: String(t.name ?? t.navn) })),
    { tom: 'Vælg team' });

  modal({
    titel: 'Opret opgave i Dalux',
    bredde: 780,
    krop: h('div', {},
      h('p', { class: 'sub' }, `${v.butik} · ${v.enhed.navn}. Teksten følger med, som den står her — ret den gerne først.`),
      felt('Prioritet i Dalux', prioritet),
      felt('Team', team, md?.teams?.length ? null : 'Dalux-metadata er ikke hentet endnu. Opgaven oprettes uden team.'),
      felt('Opgavetekst', tekst, 'Hele grundlaget følger med, så modtageren kan se, hvorfor opgaven findes.'),
      h('div', { class: 'note' },
        'Nederst i teksten står et spørgsmål om, hvad årsagen viste sig at være. '
        + 'Svaret derfra er det eneste, der kan fortælle, om diagnoserne rammer — og det er dét, der justerer agenten.'),
    ),
    knapper: [
      h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'),
      h('button', {
        class: 'btn primary',
        onclick: async (e) => {
          const knap = e.target;
          knap.disabled = true; knap.textContent = 'Opretter…';
          try {
            const svar = await opretOpgave(
              { ...v, id: v.id, butik: v.butik, butiksnummer: v.butiksnummer, anlaeg: v.enhed.navn },
              { prioritet: prioritet.value, team: team.value, tekst: tekst.value });
            gemSvar(v, { valg: 'opgave', daluxId: svar?.id || null, tekst: tekst.value });
            skriv(`${v.id} sendt til Dalux${svar?.id ? ` som opgave ${svar.id}` : ''}.`, 'ok');
          } catch (fejl) {
            /* Oprettelsen fejlede. Beslutningen gemmes alligevel — den er
             * truffet, og den skal ikke gå tabt, fordi et kald fejlede. Men
             * det skal stå tydeligt, at opgaven IKKE ligger i Dalux. */
            gemSvar(v, { valg: 'opgave', daluxFejl: String(fejl.message || fejl), tekst: tekst.value });
            skriv(`${v.id}: kunne ikke oprettes i Dalux — ${fejl.message || fejl}. Beslutningen er gemt, opgaven er ikke.`, 'fejl');
          }
          lukModal();
          opdater();
        },
      }, 'Opret opgave'),
    ],
  });
}

/* ---- Afvis ----------------------------------------------------------------
 * Knappen alene ville være en skraldespand. Det er spørgsmålet bagefter, der
 * gør den til en kilde.
 */
function afvisDialog(v) {
  let valgtGrund = null;
  const felter = h('div', {});
  const note = h('textarea', { rows: 3, placeholder: 'Skriv det med dine egne ord — det er den del, en kollega kan læse om et halvt år.' });

  const knapper = h('div', { class: 'grundvalg' });
  for (const g of AFVIS_GRUNDE) {
    const b = h('button', { class: 'btn grund', onclick: () => { valgtGrund = g.id; vaelg(g); } },
      h('strong', {}, g.navn), h('span', { class: 'note' }, g.laerer));
    b.dataset.grund = g.id;
    knapper.append(b);
  }

  let ekstra = null;
  function vaelg(g) {
    for (const b of knapper.children) b.classList.toggle('primary', b.dataset.grund === g.id);
    felter.textContent = '';
    ekstra = null;

    if (g.kraeverValg) {
      // Hvad var det så? Kun årsager, der giver mening for faggruppen.
      ekstra = vaelger(
        AARSAGER.filter((a) => a.id !== v.aarsagId && (!a.faggrupper || a.faggrupper.includes(v.faggruppe)))
          .map((a) => ({ vaerdi: a.id, navn: a.navn })),
        { tom: 'Vælg den rigtige årsag' });
      felter.append(felt(g.spoerg, ekstra,
        'Det er dette valg, der flytter agenten: den forkerte årsag foreslås sjældnere, den rigtige oftere.'));
    } else if (g.kraeverUdloeb) {
      const idag = new Date();
      const om = new Date(idag.getTime() + 180 * 864e5).toISOString().slice(0, 10);
      ekstra = h('input', { type: 'date', value: om });
      felter.append(felt(g.spoerg, ekstra,
        'Der sættes altid en dato. En accept uden udløb bliver til et blindt punkt, ingen kan huske grunden til.'));
    } else if (g.id === 'ikke_mit') {
      ekstra = vaelger(PERSONER.map((p) => ({ vaerdi: p.id, navn: `${p.navn} — ${p.omraade}` })), { tom: 'Vælg modtager' });
      felter.append(felt(g.spoerg, ekstra, 'Rammer den samme rute tre gange, foreslås den som fast regel.'));
    } else if (g.id === 'for_lille') {
      ekstra = h('input', { type: 'number', value: '15000', min: '0', step: '1000' });
      felter.append(felt(`${g.spoerg} (kr./år)`, ekstra,
        'Varsler under grænsen forsvinder ikke — de samles i en liste i stedet for at afbryde nogen.'));
    } else if (g.spoerg) {
      felter.append(h('p', { class: 'note' }, g.spoerg));
    }
  }

  modal({
    titel: `Afvis ${v.id}`,
    bredde: 720,
    krop: h('div', {},
      h('p', { class: 'sub' },
        'Hvorfor er varslet forkert? Svaret ændrer noget konkret — det er ikke en formalitet, og det er ikke en '
        + 'fritekstboks, der ender i en log, ingen læser.'),
      h('div', { class: 'note' },
        h('strong', {}, 'Agenten sagde: '), v.aarsagNavn, ` (${v.konfidens} % konfidens) på `, h('strong', {}, v.enhed.navn), '.'),
      knapper,
      felter,
      felt('Bemærkning', note),
    ),
    knapper: [
      h('button', { class: 'btn', onclick: lukModal }, 'Fortryd'),
      h('button', {
        class: 'btn primary',
        onclick: () => {
          if (!valgtGrund) { skriv('Vælg en grund — det er selve pointen med at afvise.', 'fejl'); return; }
          const g = AFVIS_GRUND[valgtGrund];
          if (g.kraeverValg && !ekstra?.value) { skriv('Vælg den rigtige årsag, ellers lærer agenten intet af afvisningen.', 'fejl'); return; }
          gemSvar(v, {
            valg: 'afvis', grund: valgtGrund, note: note.value,
            rigtigAarsag: g.kraeverValg ? ekstra.value : null,
            udloeb: g.kraeverUdloeb ? ekstra.value : null,
            tilPerson: valgtGrund === 'ikke_mit' ? ekstra?.value : null,
            graense: valgtGrund === 'for_lille' ? Number(ekstra?.value || 0) : null,
            bruger: v.ejerNavn,
          });
          skriv(`${v.id} afvist: ${g.navn.toLowerCase()}. ${g.laerer}`, 'ok');
          lukModal();
          opdater();
        },
      }, 'Afvis og lær af det'),
    ],
  });
  if (AFVIS_GRUNDE.length) { /* ingen grund forvalgt — valget skal være aktivt */ }
}

function gemSvar(v, svar) {
  state.laering = registrerSvar(state.laering, v, svar);
  v.status = svar.valg === 'opgave' ? 'sendt til Dalux' : 'afvist';
  v.svar = svar;
  state.varsler = (state.varsler || []).filter((x) => x.id !== v.id);
  gem();
}

/* ---- Hvad agenten har lært ------------------------------------------------ */

function laeringsafsnit(laering) {
  const el = h('div', {});
  const svar = laering?.svar || [];
  el.append(h('hr', { class: 'rule' }));
  el.append(h('h3', {}, 'Hvad agenten har lært'));

  if (!svar.length) {
    el.append(h('p', { class: 'note' },
      'Ingen svar endnu. Agenten kan først blive bedre, når den har fået at vide, hvornår den tog fejl — '
      + 'og det sker, når varslerne bliver besvaret, og opgaverne lukkes med en årsag.'));
    return el;
  }

  const t = traefsikkerhed(laering);
  if (t.length) {
    el.append(h('h4', {}, 'Rammer diagnoserne?'));
    el.append(tabel([
      { navn: 'Årsag', wrap: true, celle: (x) => x.navn },
      { navn: 'Faggruppe', celle: (x) => fgNavn(x.faggruppe) },
      { navn: 'Bekræftet', r: true, celle: (x) => dkTal(x.rigtig) },
      { navn: 'Modbevist', r: true, celle: (x) => dkTal(x.forkert) },
      { navn: 'Sendt videre', r: true, celle: (x) => dkTal(x.sendt) },
      { navn: 'Træfsikkerhed', r: true, celle: (x) => (x.sikker
        ? `${Math.round(x.andel * 100)} %` : h('span', { class: 'note' }, `${x.bedoemt} bedømt — der skal 5 til`)) },
    ], t));
    el.append(h('p', { class: 'note' },
      'En årsag tæller først som bekræftet, når Dalux-opgaven er lukket med en årsag. '
      + 'At sende et varsel videre er ikke en bekræftelse — det betyder kun, at nogen tog det alvorligt nok til at se efter.'));
  }

  const fg = [...new Set(Object.keys(laering.priorJusteringer || {}))];
  for (const g of fg) {
    const e = erfaringsvaegt(laering, g);
    if (!e.bekraeftede) continue;
    const p = justeredePriors(laering, g);
    const flyttet = AARSAGER
      .filter((a) => !a.faggrupper || a.faggrupper.includes(g))
      .map((a) => ({ a, fra: a.prior, til: p[a.id] }))
      .filter((x) => Math.abs(x.til - x.fra) > 0.01)
      .sort((x, y) => Math.abs(y.til - y.fra) - Math.abs(x.til - x.fra));
    if (!flyttet.length) continue;
    el.append(h('h4', {}, `Justerede sandsynligheder · ${fgNavn(g)}`));
    el.append(h('p', { class: 'note' },
      `${e.bekraeftede} bekræftede årsager. Erfaringen vejer ${Math.round(e.vaegt * 100)} % mod fagfolks udgangspunkt — `
      + 'resten er stadig det, vi startede med.'));
    el.append(tabel([
      { navn: 'Årsag', wrap: true, celle: (x) => x.a.navn },
      { navn: 'Udgangspunkt', r: true, celle: (x) => `${Math.round(x.fra * 100)} %` },
      { navn: 'Nu', r: true, celle: (x) => `${Math.round(x.til * 100)} %` },
      { navn: '', celle: (x) => badge(x.til > x.fra ? 'foreslås oftere' : 'foreslås sjældnere', x.til > x.fra ? 'p2' : '') },
    ], flyttet));
  }

  if (laering.undertrykkelser?.length) {
    el.append(h('h4', {}, 'Accepteret — melder ikke igen før'));
    el.append(tabel([
      { navn: 'Anlæg', wrap: true, celle: (u) => u.enhedNavn },
      { navn: 'Butik', wrap: true, celle: (u) => u.butik },
      { navn: 'Grund', wrap: true, celle: (u) => u.note || '—' },
      { navn: 'Udløber', celle: (u) => u.udloeb || badge('uden udløb', 'p2') },
      { navn: 'Accepteret af', celle: (u) => u.bruger || '—' },
    ], laering.undertrykkelser));
  }

  if (laering.koblingsfejl?.length) {
    el.append(h('h4', {}, 'Målere, der ikke sidder, hvor vi tror'));
    el.append(h('p', { class: 'note' },
      'De her er vigtigere end de ser ud. En forkert kobling mellem måler og anlæg rammer ikke ét varsel — '
      + 'den rammer alt, hvad der nogensinde måles på den måler.'));
    el.append(tabel([
      { navn: 'Måler', wrap: true, celle: (k) => k.maaler },
      { navn: 'Agenten troede', wrap: true, celle: (k) => k.paastaaetAnlaeg },
      { navn: 'Rigtigt anlæg', wrap: true, celle: (k) => k.rigtigAnlaeg || h('span', { class: 'note' }, 'ikke oplyst') },
      { navn: 'Butik', wrap: true, celle: (k) => k.butik },
    ], laering.koblingsfejl));
  }

  if (Object.keys(laering.beloebsgraenser || {}).length) {
    el.append(h('h4', {}, 'Beløbsgrænser sat af de fagansvarlige'));
    el.append(tabel([
      { navn: 'Faggruppe', celle: (x) => fgNavn(x[0]) },
      { navn: 'Grænse', r: true, celle: (x) => dkKr(x[1]) },
    ], Object.entries(laering.beloebsgraenser)));
  }

  el.append(h('details', {},
    h('summary', {}, `Hele svarhistorikken (${svar.length})`),
    tabel([
      { navn: 'Tid', celle: (x) => (x.tid || '').slice(0, 16).replace('T', ' ') },
      { navn: 'Varsel', celle: (x) => x.varselId },
      { navn: 'Agenten sagde', wrap: true, celle: (x) => AARSAG[x.aarsagId]?.navn || x.aarsagId },
      { navn: 'Svar', celle: (x) => badge(
        x.valg === 'opgave' ? 'opgave' : x.valg === 'bekraeftet' ? (x.ramte ? 'ramte' : 'ramte ikke') : 'afvist',
        x.valg === 'opgave' ? 'ok' : x.valg === 'bekraeftet' ? (x.ramte ? 'ok' : 'p1') : '') },
      { navn: 'Grund', wrap: true, celle: (x) => (x.grund
        ? AFVIS_GRUND[x.grund]?.navn || x.grund : (x.faktiskAarsag ? AARSAG[x.faktiskAarsag]?.navn : '—')) },
      { navn: 'Bemærkning', wrap: true, celle: (x) => x.note || '—' },
    ], svar.slice(0, 60))));

  return el;
}

const dansk = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${Number(d)}. ${['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(m) - 1]}. ${a}`;
};
