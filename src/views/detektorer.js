import { h, tabel, badge, swatch, modal, dkTal, tom } from '../ui.js';
import { state, noegletal } from '../state.js';
import { DETEKTORER, FEJLKORT, fgNavn, fgFarve, PRIORITETER } from '../taxonomy.js';

export function detektorer() {
  const el = h('div', {});
  const n = noegletal();

  el.append(
    h('h1', {}, 'Detektorer'),
    h('p', { class: 'sub' },
      'En detektor finder et symptom. Den stiller ikke diagnoser. '
      + '"Kondenstrykket er 4 grader højere, end udetemperaturen tilsiger" er et symptom — '
      + '"kondensatoren er snavset" er en diagnose, og den må først stilles, når signaler fra flere systemer er lagt sammen.'),
  );

  const antalPrDetektor = {};
  for (const s of state.sager) for (const sig of s.signaler) antalPrDetektor[sig.detektor] = (antalPrDetektor[sig.detektor] || 0) + 1;

  const boelger = [1, 2, 3, 4];
  const boelgeNavn = {
    1: 'Bølge 1 · data vi allerede har',
    2: 'Bølge 2 · køl',
    3: 'Bølge 3 · tidsplaner og luft',
    4: 'Bølge 4 · tværgående',
  };
  const boelgeHvorfor = {
    1: 'Kan bygges uden at vente på en eneste ny integration. Giver de første bekræftede kroner og lærer os mønsteret. '
       + 'D-19 og D-20 kører på Dalux’ egen opgavehistorik og fanger dermed "gentagen alarm"-mønsteret fra fagbogen i dag — '
       + 'uden at vente på AK-centralen.',
    2: 'Køl er porteføljens største energipost og den eneste med fødevaresikkerhed. Højeste faglige værdi — forudsat at AK-adgangen er løst.',
    3: 'Kræver CTS og Unikair. Billige fejl at rette, når de først er fundet.',
    4: 'Størst beløb pr. sag, men kræver flest kilder på plads samtidig. Skal bygges sidst, ikke først.',
  };

  for (const b of boelger) {
    const liste = DETEKTORER.filter((d) => d.boelge === b);
    if (!liste.length) continue;
    el.append(h('h2', { style: { marginTop: '22px' } }, boelgeNavn[b]));
    el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px' } }, boelgeHvorfor[b]));
    el.append(tabel([
      { navn: 'Id', celle: (d) => h('span', { class: 'mono' }, d.id) },
      { navn: 'Detektor', celle: (d) => h('span', {}, swatch(fgFarve(d.fg)), d.navn), wrap: true },
      { navn: 'Kilde', celle: (d) => d.kilde },
      { navn: 'Status', celle: (d) => badge(d.status, d.status === 'drift' ? 'ok' : d.status === 'skygge' ? 'p3' : '') },
      { navn: 'Signaler nu', r: true, celle: (d) => dkTal(antalPrDetektor[d.id] || 0) },
      { navn: 'Mangler', celle: (d) => (d.mangler.length ? h('span', { class: 'muted' }, d.mangler.join(', ')) : h('span', { style: { color: 'var(--ok)' } }, 'intet')), wrap: true },
    ], liste, { onRow: visDetektor }));
  }

  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', { class: 'grid cols-2' },
    h('div', { class: 'card' },
      h('h2', {}, 'Nøgletal for agentdriften'),
      h('div', { class: 'evidence' },
        raekke('Præcision', n.praecision == null ? 'Ikke målt endnu' : `${n.praecision} %`, 'Andel behandlede sager, der blev til en opgave. Det egentlige facit kommer først fra Dalux. Mål: over 70 % efter seks måneder.'),
        raekke('Behandlede sager', dkTal(n.behandlet), 'Følges, ingen fast grænse.'),
        raekke('Undertrykkelser', dkTal(n.undertrykkelser), 'Alle skal have ejer og udløbsdato.'),
        raekke('Uden udløbsdato', dkTal(n.undertrykkelserUdenUdloeb),
          n.undertrykkelserUdenUdloeb ? 'Skal være nul — ellers gøres systemet langsomt blindt.' : 'Nul, som det skal være.'),
        raekke('Dækning', `${Math.round(100 * DETEKTORER.filter((d) => d.status === 'drift').length / DETEKTORER.length)} %`,
          `${DETEKTORER.filter((d) => d.status === 'drift').length} af ${DETEKTORER.length} detektorer er i drift.`))),

    h('div', { class: 'card' },
      h('h2', {}, 'Prioritering'),
      h('div', { class: 'evidence' }, Object.values(PRIORITETER).map((p) =>
        h('div', { class: 'row' },
          h('span', { class: 'k' }, badge(p.navn, p.navn.toLowerCase()), ' ', p.kriterium),
          h('span', { class: 'muted' }, p.handling)))))));

  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', { class: 'card' },
    h('h2', {}, 'Sådan sættes en ny detektor i drift'),
    h('div', { class: 'evidence' }, [
      ['1 · Skrivebord', 'Hvilken fejl fanger den, hvad koster fejlen, hvilke data kræver den, hvem ejer sagerne.', 'En fagansvarlig har sagt god for, at fejlen er værd at fange.'],
      ['2 · Testtilfælde', 'Mindst fem kendte historiske hændelser, den skal fange, og fem normale perioder, den ikke må reagere på.', 'Alle ti kører automatisk ved hver ændring.'],
      ['3 · Skyggedrift', 'Fire til seks uger, hvor sager oprettes, men kun platformteamet ser dem.', 'Målt præcision over den aftalte grænse.'],
      ['4 · Pilot', 'Ti butikker og én fagansvarlig, der giver løbende tilbagemelding.', 'Den fagansvarlige vil have den udbredt.'],
      ['5 · Drift', 'Hele porteføljen. Ejer, kørselsplan og alarm ved fejl som ethvert andet job.', '—'],
      ['6 · Kvartalsgennemgang', 'Præcision, bekræftede kroner og larm gøres op.', 'Justér, sæt i skygge igen eller pensionér.'],
    ].map(([trin, hvad, krav]) =>
      h('div', { class: 'row' },
        h('span', { class: 'k' }, h('strong', {}, trin)),
        h('span', {}, hvad, h('div', { class: 'muted', style: { fontSize: '11.5px' } }, krav)))))));

  return el;
}

const raekke = (k, v, note) => h('div', { class: 'row' },
  h('span', { class: 'k' }, k),
  h('span', {}, h('strong', { class: 'num' }, v), note ? h('div', { class: 'muted', style: { fontSize: '11.5px' } }, note) : null));

function visDetektor(d) {
  modal({
    titel: `${d.id} · ${d.navn}`,
    krop: h('div', { class: 'grid', style: { gap: '12px' } },
      h('div', { class: 'pill-row' },
        badge(d.kilde), badge(fgNavn(d.fg)), badge(d.status, d.status === 'drift' ? 'ok' : ''), badge(`Bølge ${d.boelge}`)),
      h('div', { class: 'kv' },
        h('dt', {}, 'Symptom'), h('dd', {}, d.symptom),
        h('dt', {}, 'Typisk sag'), h('dd', {}, d.sagstype),
        h('dt', {}, 'Kræver'), h('dd', {}, d.kraever.join(' · ')),
        h('dt', {}, 'Mangler endnu'), h('dd', {}, d.mangler.length ? d.mangler.join(' · ') : 'intet')),
      d.p1 ? h('div', { class: 'note stop' }, 'Fødevaresikkerhed. Sagen bliver altid P1, uanset beløb — ingen tærskel gælder her.') : null,
      d.status !== 'drift'
        ? h('div', { class: 'note warn' },
            d.status === 'skygge'
              ? 'Detektoren kører i skyggedrift: sager oprettes, men når ikke frem til en fagansvarlig, før præcisionen er målt over den aftalte grænse.'
              : 'Detektoren er planlagt. Den kan ikke køre, før kilderne ovenfor er koblet på.')
        : null),
  });
}

/* ---- Fagbogen ------------------------------------------------------------- */

export function fagbog() {
  const el = h('div', {});
  el.append(
    h('h1', {}, 'Fagbogen'),
    h('p', { class: 'sub' },
      'En sprogmodel kan køleteknik i almindelighed. Den kan ikke Coops anlæg. '
      + 'Fagbogen er vores egen viden, skrevet ned som fejlkort — ét kort pr. kendt fejl, ejet af den fagansvarlige for anlægstypen. '
      + 'Tal og grænser i kantede parenteser udfyldes af fagpersonen; de er med vilje ikke gættet.'),
  );

  el.append(h('div', { class: 'grid cards', style: { marginBottom: '20px' } },
    kort('Skrevet', `${FEJLKORT.length}`, 'fejlkort i kodelageret'),
    kort('Planlagt', '29', 'kort dækker det, vi ved går galt i dag'),
    kort('Arbejde', '~40 timer', 'fordelt på seks fagpersoner'),
    kort('Pr. kort', '1–2 timer', 'sammen med den, der kender anlægget')));

  for (const k of FEJLKORT) {
    el.append(h('div', { class: 'card', style: { marginBottom: '12px' } },
      h('h2', {}, `${k.nr} · ${k.navn}`, ' ', badge(fgNavn(k.fg)), ' ', badge(`v${k.version}`), ' ', badge(k.status, 'p3')),
      h('div', { class: 'kv' },
        h('dt', {}, 'Anlægstype'), h('dd', {}, k.anlaegstype),
        h('dt', {}, 'Ejer'), h('dd', {}, `${k.ejer} · fag: ${k.fag}`),
        h('dt', {}, 'Symptomer'), h('dd', {}, k.symptomer),
        h('dt', {}, 'Ligner'), h('dd', {}, k.ligner),
        h('dt', {}, 'Skelnes ved'), h('dd', {}, k.skelnes),
        h('dt', {}, 'Bekræftes af'), h('dd', {}, k.bekraeftes),
        h('dt', {}, 'Koster'), h('dd', {}, k.koster),
        h('dt', {}, 'Ved gentagelse'), h('dd', {}, k.gentagelse))));
  }

  el.append(h('div', { class: 'note' },
    h('strong', {}, '"Ligner" er feltet, der betaler sig.'), ' ',
    'Uden det gætter agenten på den første forklaring, der passer. '
    + 'Det er også her, hver falsk alarm med årsagen "kendt drift" hører hjemme som en ny linje.'));

  el.append(h('hr', { class: 'rule' }));
  el.append(h('div', { class: 'card' },
    h('h2', {}, 'De første kort, der skal skrives'),
    tabel([
      { navn: 'Fagområde', celle: (r) => r[0] },
      { navn: 'De første fejlkort', celle: (r) => r[1], wrap: true },
      { navn: 'Antal', r: true, celle: (r) => r[2] },
    ], [
      ['Køl', 'Møbeltemperatur holder ikke · snavset kondensator · kondensatorventilator · kølemiddelforhold · afrimning fejlindstillet · kompressorcykling · gentagen alarm', 7],
      ['Ventilation', 'Filter tilstoppet · veksler snavset · spjæld hænger · rem eller ventilator · tidsplan forkert', 5],
      ['Klima og CTS', 'Setpunktsdrift · samtidig køl og varme · natsænkning virker ikke · override glemt · tidsplan mod åbningstid', 5],
      ['Overskudsvarme', 'Genvinding ude af drift · varme afvist og købt samtidig · veksler tilkalket · pumpe eller regulering', 4],
      ['Solceller', 'Streng ude · inverterfejl · nedsmudsning · ny skygge', 4],
      ['El og målere', 'Ny konstant last · målerfejl · manglende bimåler · effektspids', 4],
    ])));

  return el;
}

const kort = (label, vaerdi, note) => h('div', { class: 'card kpi' },
  h('div', { class: 'label' }, label), h('div', { class: 'value' }, vaerdi), h('div', { class: 'note' }, note));
