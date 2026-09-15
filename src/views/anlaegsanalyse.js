import { h, tabel, badge, swatch, kpi, modal, dkTal, dkKr, pct, tom, vaelger, felt } from '../ui.js';
import { state } from '../state.js';
import { fgNavn, fgFarve } from '../taxonomy.js';
import { koblButik } from '../kobling.js';
import { analyserEnhed, VEJRFOELSOMHED } from '../anlaegsanalyse.js';
import { VEJRZONER, zoneFor, GRADDAGE } from '../vejr.js';
import * as seed from '../seed.js';

let fejlvariant = 'niveauskift';

/* Koblingen og analysen hører sammen på én side: hvad modellen KAN sige om et
 * anlæg afhænger helt af, om anlægget har sin egen måler. */
export function anlaegsanalyse(gaaTil) {
  const el = h('div', {});
  el.append(
    h('h1', {}, 'Anlægsanalyse'),
    h('p', { class: 'sub' },
      'Spørgsmålet er ikke, om anlægget bruger meget — men om det bruger mere, end det plejer '
      + 'under de samme forhold. Vejr, ugedag og åbningstid regnes fra, før der siges noget.'),
  );

  const k = koblButik(seed.DEMO_ANLAEG, seed.DEMO_MAALERE);
  el.append(koblingsafsnit(k));
  el.append(h('hr', { class: 'rule' }));
  el.append(analyseafsnit(k));
  el.append(h('hr', { class: 'rule' }));
  el.append(vejrafsnit());
  return el;
}

/* ---- Koblingen ------------------------------------------------------------ */

function koblingsafsnit(k) {
  const el = h('div', {});
  el.append(h('h2', {}, 'Anlæg mod målepunkt'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Den vigtigste kobling i hele hubben. Uden den kan vi sige "køl i denne butik bruger 340.000 kWh" — '
    + 'men ikke "dette køleanlæg bruger for meget". Eksemplet er Kvickly Aarhus C med butikkens rigtige '
    + 'anlægs- og målernavne.'));

  el.append(h('div', { class: 'grid cards' },
    kpi('Anlæg koblet', pct(k.daekning), `${k.koblinger.length} koblinger på ${seed.DEMO_ANLAEG.length} anlæg`),
    kpi('Egen måler', pct(k.dedikeretDaekning), 'kun disse kan analyseres hver for sig'),
    kpi('Analyseenheder', dkTal(k.enheder.length), `${k.enheder.filter((e) => e.slags === 'gruppe').length} er grupper, der deler en måler`),
    kpi('Uden måler', dkTal(k.anlaegUdenMaaler.length), 'kan ikke energianalyseres')));

  el.append(h('div', { class: 'note', style: { marginTop: '14px' } },
    h('strong', {}, 'Fundet, der bærer det hele: anlægskoden står i målernavnet.'), ' ',
    'Enity-måleren "VE.02 Slagter" hører til Dalux-anlægget "VE02.1". Det er ikke et gæt — det er den samme kode. ',
    h('br'),
    'Men det gælder kun ', h('strong', {}, '3,3 % af målerne'), '. Resten må kobles på klasse og tag, og dér '
    + 'findes typisk én måler til flere anlæg. Modellen er bygget om det, frem for om det, vi kunne ønske os.'));

  el.append(h('h3', { style: { marginTop: '18px' } }, 'Koblinger'));
  el.append(tabel([
    { navn: 'Trin', celle: (x) => badge(String(x.trin), x.trin === 1 ? 'ok' : x.trin === 2 ? '' : 'p3') },
    { navn: 'Anlæg', celle: (x) => h('strong', {}, x.anlaegNavn), wrap: true },
    { navn: 'Målepunkt', celle: (x) => x.meterNavn, wrap: true },
    { navn: 'Strøm', celle: (x) => badge(x.energistroem) },
    { navn: 'Rolle', celle: (x) => x.energirolle },
    { navn: 'Kobling', celle: (x) => (x.delt ? badge('delt', 'p2') : badge('1:1', 'ok')) },
    { navn: 'Konfidens', r: true, celle: (x) => pct(x.konfidens * 100) },
    { navn: 'Hvorfor', celle: (x) => h('span', { class: 'muted' }, x.begrundelse), wrap: true },
  ], k.koblinger.slice(0, 14)));

  /* Ét anlæg, tre energistrømme — og tre ansvarlige. */
  const ve02 = k.koblinger.filter((x) => x.anlaegNavn === 'VE02.1');
  if (ve02.length >= 2) {
    el.append(h('div', { class: 'note', style: { marginTop: '14px' } },
      h('strong', {}, 'Ét aggregat, tre energistrømme, tre ansvarlige.'), ' ',
      `VE02.1 har ${ve02.length} målepunkter: `,
      ve02.map((x) => `${x.energirolle} (${x.energistroem})`).join(', '), '. ',
      'Ventilatordriften er Mads’, kølefladen er Mortens, og varmefladen er Emils — på det samme fysiske anlæg. '
      + 'Den opdeling kan kun holdes, fordi L4-tagget skiller strømmene ad.'));
  }

  if (k.manglendeAnlaeg.length) {
    el.append(h('div', { class: 'note stop', style: { marginTop: '14px' } },
      h('strong', {}, `${k.manglendeAnlaeg.length} målepunkt${k.manglendeAnlaeg.length > 1 ? 'er' : ''} peger på et anlæg, der ikke findes i Dalux.`), h('br'),
      ...k.manglendeAnlaeg.map((x) => h('div', { style: { marginTop: '4px' } }, '· ' + x.hvorfor)),
      h('div', { style: { marginTop: '8px' } },
        'Det er ikke en koblingsfejl — det er et hul i anlægsregistret. Et anlæg, der ikke er oprettet i Dalux, '
        + 'kan ingen opgave hænges på, og ingen serviceaftale dækker. Koblingen finder hullet, fordi målingen '
        + 'er der, og anlægget ikke er.')));
  }

  el.append(h('details', { style: { marginTop: '12px' } },
    h('summary', {}, 'Hvorfor en delt måler ikke fordeles ud på anlæggene'),
    h('p', { style: { fontSize: '12.5px', maxWidth: '84ch' } },
      'Det ville være let at dele en fælles måler ud på fire anlæg efter installeret effekt. Det ville give '
      + 'fire pæne tal, som ingen kan efterprøve — og en fejl på ét anlæg ville forsvinde i gennemsnittet af fire. '
      + 'Derfor er analysenheden gruppen, når måleren er delt, og sagen siger det: afvigelsen peger på gruppen, '
      + 'og servicebesøget skal starte med at finde ud af hvilket anlæg.')));

  return el;
}

/* ---- Analysen ------------------------------------------------------------- */

function analyseafsnit(k) {
  const el = h('div', {});
  el.append(h('h2', {}, 'Normallast og mønsterbrud'));

  const enhed = k.enheder.find((e) => e.faggruppe === 'koel_frys') || k.enheder[0];
  const boks = h('div', {});

  const vaelg = vaelger([
    { vaerdi: 'niveauskift', navn: 'Niveauskift — noget blev tændt og aldrig slukket' },
    { vaerdi: 'drift', navn: 'Drift — langsom forværring uden fejlkode' },
    { vaerdi: 'ok', navn: 'Normal drift — intet galt' },
  ], { vaerdi: fejlvariant });
  vaelg.addEventListener('change', () => { fejlvariant = vaelg.value; tegn(); });

  const tegn = () => {
    const raekker = seed.demoDoegnserie({ fejl: fejlvariant === 'ok' ? null : fejlvariant });
    const r = analyserEnhed(enhed, raekker, {
      elpris: state.forudsaetninger.elpris, varmepris: state.forudsaetninger.varmepris,
    });
    boks.replaceChildren(resultat(r, raekker));
  };

  el.append(h('div', { class: 'toolbar' },
    h('label', { class: 'muted', style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' } },
      'Afprøv mønster', vaelg)));
  el.append(boks);
  tegn();
  return el;
}

function resultat(r, raekker) {
  const el = h('div', {});
  const n = r.normal;

  el.append(h('div', { class: 'card', style: { marginBottom: '14px' } },
    h('h3', { style: { marginTop: 0 } }, r.enhed.navn),
    h('div', { class: 'kv' },
      h('dt', {}, 'Analyseenhed'), h('dd', {}, r.enhed.slags === 'anlæg'
        ? 'Ét anlæg med egen måler — afvigelser kan henføres til anlægget'
        : r.enhed.slags === 'gruppe'
          ? `${r.enhed.anlaeg.length} anlæg deler måleren "${r.enhed.meterNavn}" — afvigelser peger på gruppen`
          : 'Målepunkt uden kobling til et anlæg'),
      h('dt', {}, 'Normallast'), h('dd', {}, n.brugbar
        ? (n.variable.length ? `Vejrmodel på ${n.variable.map((v) => VNAVN[v] || v).join(' og ')}` : 'Median pr. dagtype')
        : n.grund),
      n.brugbar ? h('dt', {}, 'Referenceperiode') : null,
      n.brugbar ? h('dd', {}, `${n.reference.fra} → ${n.reference.til} (${n.reference.doegn} døgn)`) : null,
      n.brugbar && n.modeller.hverdag && n.modeller.hverdag.regression ? h('dt', {}, 'Modelkvalitet') : null,
      n.brugbar && n.modeller.hverdag && n.modeller.hverdag.regression
        ? h('dd', {}, `R² ${n.modeller.hverdag.regression.r2.toFixed(2)} — `
            + `${n.modeller.hverdag.regression.koefficienter[n.variable[0]].toFixed(1)} kWh pr. ${VNAVN[n.variable[0]] || n.variable[0]}`) : null,
      h('dt', {}, 'Datadækning'), h('dd', {}, pct(n.daekning))),

    n.brugbar ? h('p', { class: 'muted', style: { fontSize: '12px', margin: '10px 0 0' } }, n.reference.note) : null));

  if (raekker && raekker[0] && raekker[0].modelleret) {
    el.append(h('div', { class: 'note warn', style: { marginBottom: '14px' } },
      h('strong', {}, 'Døgnværdierne her er modellerede, ikke aflæste.'), ' '
      + 'Enity har timedata, men de er ikke trukket med i udtrækket. Serien er bygget ud fra butikkens '
      + 'rigtige årsforbrug og en realistisk temperaturrespons, så modellen kan afprøves på noget, der '
      + 'opfører sig som virkeligheden. Med live-data slået til erstattes den af rigtige målinger.'));
  }

  if (!r.fund.length) {
    el.append(h('div', { class: 'note' },
      h('strong', {}, 'Ingen mønsterbrud.'), ' Anlægget følger sin normallast. '
      + 'At modellen ikke finder noget på en ren serie er lige så vigtigt som at den finder noget på en beskidt — '
      + 'en detektor, der altid siger noget, kan ingen bruge.'));
  }

  for (const f of r.fund) el.append(fundkort(f));

  if (r.fravalgt && r.fravalgt.length) {
    el.append(h('details', { style: { marginTop: '10px' } },
      h('summary', {}, `Forklaringer, modellen valgte fra (${r.fravalgt.length})`),
      h('div', { class: 'evidence', style: { marginTop: '8px' } }, r.fravalgt.map((f) =>
        h('div', { class: 'row' },
          h('span', { class: 'k' }, f.moenster),
          h('span', { class: 'muted' }, f.hvorfor))))));
  }

  if (r.afvigelse) el.append(afvigelsesgraf(r.afvigelse.serie));
  return el;
}

const VNAVN = { temperatur: 'grad udetemperatur', cdd: 'kølegraddag', hdd: 'varmegraddag', indstraaling: 'indstråling' };

function fundkort(f) {
  const stil = { hoej: 'p1', middel: 'p2', lav: 'p3' }[f.alvor] || '';
  return h('div', { class: 'card', style: { marginBottom: '10px' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' } },
      h('h3', { style: { margin: 0 } }, f.moenster.replace(/_/g, ' ')),
      h('div', { class: 'pill-row' },
        badge(f.alvor, stil),
        f.krAar ? badge(`${dkTal(f.krAar)} kr./år`) : badge('beløb kan ikke regnes', 'p3'))),
    h('p', { style: { margin: '8px 0 10px', fontSize: '13px' } }, f.symptom),
    h('div', { class: 'evidence' }, f.evidens.map(([k, v]) =>
      h('div', { class: 'row' }, h('span', { class: 'k' }, k), h('span', { class: 'num' }, v)))),
    f.note ? h('p', { class: 'note', style: { marginTop: '10px', marginBottom: 0 } }, f.note) : null);
}

/** Afvigelsen fra normallasten, døgn for døgn. Nul-linjen er det forventede. */
function afvigelsesgraf(serie) {
  if (!serie || serie.length < 10) return h('div', {});
  const W = 720, H = 150, pad = { t: 10, r: 8, b: 18, l: 42 };
  const ns = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('preserveAspectRatio', 'none');

  const v = serie.map((s) => s.rest);
  const maks = Math.max(...v.map(Math.abs)) * 1.15 || 1;
  const x = (i) => pad.l + (W - pad.l - pad.r) * i / (serie.length - 1);
  const y = (val) => pad.t + (H - pad.t - pad.b) * (1 - (val + maks) / (2 * maks));

  svg.append(mk('line', { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: 'axis' }));
  for (const lbl of [maks, 0, -maks]) {
    const t = mk('text', { x: 4, y: y(lbl) + 3, class: 'lbl' });
    t.textContent = Math.round(lbl);
    svg.append(t);
  }
  const bredde = Math.max(1, (W - pad.l - pad.r) / serie.length - 0.5);
  serie.forEach((s, i) => {
    const h0 = Math.abs(y(s.rest) - y(0));
    svg.append(mk('rect', {
      x: x(i) - bredde / 2, y: s.rest > 0 ? y(s.rest) : y(0),
      width: bredde, height: Math.max(h0, 0.6),
      fill: s.rest > 0 ? 'var(--p1)' : 'var(--ok)', opacity: 0.75,
    }));
  });
  return h('div', { class: 'card', style: { marginTop: '12px' } },
    h('h3', { style: { marginTop: 0 } }, 'Afvigelse fra normallasten, seneste 90 døgn'),
    h('p', { class: 'muted', style: { fontSize: '12px', marginTop: 0 } },
      'Nul-linjen er det forventede forbrug ved dagens vejr og ugedag. Rødt er merforbrug, grønt er mindre.'),
    svg);
}

/* ---- Vejret --------------------------------------------------------------- */

function vejrafsnit() {
  const el = h('div', {});
  el.append(h('h2', {}, 'Vejrdata'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Uden vejret er halvdelen af alle kølesager falske om sommeren. Fire størrelser hentes, og hver har sin rolle.'));

  el.append(tabel([
    { navn: 'Størrelse', celle: (r) => h('strong', {}, r[0]) },
    { navn: 'Bruges til', celle: (r) => r[1], wrap: true },
  ], [
    ['Temperatur', 'Skiller sæson fra fejl på køl, varme og køleflader. Køleanlæg måles mod temperaturen selv, ikke mod kølegraddage — en kondensator følger luften hele året, ikke kun over 20 grader.'],
    ['Solindstråling', 'Forventet produktion på solceller, og dagslysstyring på udendørs belysning.'],
    ['Skydække', 'Forklarer en grå dag, uden at anlægget fejler.'],
    ['Vind', 'Påvirker infiltration og kondensatorydelse.'],
  ]));

  el.append(h('h3', { style: { marginTop: '18px' } }, 'Ti vejrzoner frem for 1.171 adresser'));
  el.append(h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: '-4px', maxWidth: '84ch' } },
    'Danmark er lille, og temperaturen varierer langt mindre end forbruget. Butikkerne grupperes efter '
    + 'postnummer i ti zoner med ét vejrpunkt hver. Det er en bevidst afvejning: til graddage er fejlen '
    + 'typisk under én grad og slår ens igennem på alle butikker i zonen, så en nabosammenligning er upåvirket. '
    + 'Til solindstråling er fejlen større — skydække er lokalt — og derfor bruger solcelleanalysen anlæggets '
    + 'egne koordinater, når de findes.'));

  el.append(tabel([
    { navn: 'Zone', celle: (z) => h('strong', {}, z.navn) },
    { navn: 'Postnumre', celle: (z) => z.postnr.map(([a, b]) => `${a}–${b}`).join(', ') },
    { navn: 'Vejrpunkt', celle: (z) => h('span', { class: 'mono' }, `${z.lat.toFixed(2)}, ${z.lon.toFixed(2)}`) },
  ], VEJRZONER));

  el.append(h('h3', { style: { marginTop: '18px' } }, 'Vejrfølsomhed pr. faggruppe'));
  el.append(tabel([
    { navn: 'Faggruppe', celle: (r) => h('span', {}, swatch(fgFarve(r[0])), fgNavn(r[0])) },
    { navn: 'Regnes mod', celle: (r) => (r[1].variable.length
        ? r[1].variable.map((v) => VNAVN[v] || v).join(', ')
        : h('span', { class: 'muted' }, 'ingen vejrvariabel')) },
    { navn: 'Hvorfor', celle: (r) => h('span', { class: 'muted' }, r[1].note), wrap: true },
  ], Object.entries(VEJRFOELSOMHED)));

  el.append(h('div', { class: 'note', style: { marginTop: '14px' } },
    h('strong', {}, 'Graddage regnes dansk: '), `varme mod ${GRADDAGE.varmebasis} °C, køl mod ${GRADDAGE.koelebasis} °C. `,
    'Varmebasen er 17, fordi bygningen selv bidrager med de sidste grader op til en indetemperatur omkring 20. '
    + 'Kølebasen er sat højere for butikker, hvor belysning, køl og mennesker giver et betydeligt varmetilskud. '
    + 'Begge er forudsætninger, ikke naturlove, og kan rettes under Opsætning.'));

  return el;
}
