import { h, tabel, badge, swatch, stack, legend, modal, dkTal, dkKr, pct, tom, doegnprofil, prioritetBadge } from '../ui.js';
import { state, skriv } from '../state.js';
import { fgNavn, fgFarve } from '../taxonomy.js';
import { klassificerMaalepunkt } from '../anlaeg.js';
import { hentAnlaeg, hentOpgaver } from '../dalux.js';
import { visSag } from './sager.js';

let sorter = 'kwh';
let soegning = '';

export function butikker(gaaTil) {
  const d = state.data;
  if (!d) return tom('Indlæser …');
  const el = h('div', {});
  el.append(
    h('h1', {}, 'Butikker'),
    h('p', { class: 'sub' },
      'Nabosammenligningen er det stærkeste enkeltværktøj, vi har: viser én butik mønsteret i dag, er det anlægget — '
      + 'viser alle butikker med samme anlægstype det, er det vejret, elprisen eller vores egen dataindsamling.'),
  );

  const soeg = h('input', { type: 'text', placeholder: 'Søg butik, kæde eller by …', value: soegning });
  const sorterVaelger = h('select', {},
    h('option', { value: 'kwh' }, 'Forbrug'),
    h('option', { value: 'm2' }, 'kWh pr. m²'),
    h('option', { value: 'daek' }, 'Datadækning (lavest først)'),
    h('option', { value: 'sager' }, 'Antal åbne sager'));
  sorterVaelger.value = sorter;

  const boks = h('div', {});
  const tegn = () => {
    const sagerPr = {};
    for (const s of state.sager) if (s.status === 'ny' || s.status === 'vurderet') (sagerPr[s.butiksnummer] ||= []).push(s);

    let r = d.butikker.filter((b) => !soegning || `${b.navn} ${b.kaede} ${b.by}`.toLowerCase().includes(soegning.toLowerCase()));
    r = r.map((b) => ({ ...b, sager: sagerPr[b.butiksnummer] || [] }));
    r.sort((a, b) => {
      if (sorter === 'm2') return (b.kwhPrM2 || 0) - (a.kwhPrM2 || 0);
      if (sorter === 'daek') return (a.daekningPct ?? 999) - (b.daekningPct ?? 999);
      if (sorter === 'sager') return b.sager.length - a.sager.length || b.kwhAar - a.kwhAar;
      return (b.kwhAar || 0) - (a.kwhAar || 0);
    });

    boks.replaceChildren(tabel([
      { navn: 'Butik', celle: (b) => h('span', {}, h('strong', {}, b.navn)), wrap: true },
      { navn: 'Kæde', celle: (b) => b.kaede },
      { navn: 'm²', r: true, celle: (b) => dkTal(b.salgsareal_m2) },
      { navn: 'kWh/år', r: true, celle: (b) => dkTal(b.kwhAar) },
      { navn: 'kWh/m²', r: true, celle: (b) => dkTal(b.kwhPrM2) },
      { navn: 'Dækning', r: true, celle: (b) => daekningCelle(b.daekningPct) },
      { navn: 'Solprod.', r: true, celle: (b) => (b.solAar ? dkTal(b.solAar) : '—') },
      { navn: 'Sager', celle: (b) => (b.sager.length ? h('span', { class: 'pill-row' }, b.sager.map((s) => prioritetBadge(s.prioritet))) : h('span', { class: 'muted' }, '—')) },
      { navn: 'Dalux', celle: (b) => (b.daluxBuildingId ? badge('koblet', 'ok') : badge('ikke koblet', 'p2')) },
    ], r, { onRow: (b) => visButik(b, gaaTil) }));
  };

  soeg.addEventListener('input', () => { soegning = soeg.value; tegn(); });
  sorterVaelger.addEventListener('change', () => { sorter = sorterVaelger.value; tegn(); });

  el.append(h('div', { class: 'toolbar' }, soeg,
    h('label', { class: 'muted', style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' } }, 'Sortér', sorterVaelger)));
  el.append(boks);
  tegn();
  return el;
}

function daekningCelle(v) {
  if (v == null) return '—';
  const farve = v >= 70 ? 'var(--ok)' : v >= 45 ? 'var(--p3)' : 'var(--p1)';
  return h('span', {}, h('span', { style: { color: farve } }, pct(v)));
}

/* ---- Butiksvisning -------------------------------------------------------- */

export function visButik(b, gaaTil) {
  const d = state.data;
  const splits = (d.splits || []).filter((s) => s.butiksnummer === b.butiksnummer);
  const submaalt = splits.reduce((s, x) => s + x.kwh, 0);
  const rest = Math.max(0, (b.kwhAar || 0) - submaalt);
  const dele = splits.map((s) => ({ navn: fgNavn(s.fg), vaerdi: s.kwh, farve: fgFarve(s.fg) }))
    .sort((x, y) => y.vaerdi - x.vaerdi)
    .concat(rest ? [{ navn: 'Restpost', vaerdi: rest, farve: fgFarve('oevrigt') }] : []);

  const krop = h('div', { class: 'grid', style: { gap: '16px' } });

  krop.append(h('div', { class: 'kv' },
    h('dt', {}, 'Kæde'), h('dd', {}, b.kaede),
    h('dt', {}, 'By'), h('dd', {}, b.by || '—'),
    h('dt', {}, 'Salgsareal'), h('dd', {}, b.salgsareal_m2 ? `${dkTal(b.salgsareal_m2)} m²` : 'ikke registreret'),
    h('dt', {}, 'Forbrug'), h('dd', {}, `${dkTal(b.kwhAar)} kWh/år · ${dkKr((b.kwhAar || 0) * state.forudsaetninger.elpris)}/år`),
    h('dt', {}, 'Nøgletal'), h('dd', {}, b.kwhPrM2 ? `${dkTal(b.kwhPrM2)} kWh/m²` : '—'),
    h('dt', {}, 'Enity'), h('dd', { class: 'mono' }, b.enityBuildingId || '—'),
    h('dt', {}, 'Dalux'), h('dd', { class: 'mono' }, b.daluxBuildingId || 'ikke koblet')));

  if (dele.length) {
    krop.append(h('div', { class: 'card' },
      h('h3', {}, 'Fordeling på faggrupper'),
      stack(dele, b.kwhAar), legend(dele, b.kwhAar, (v) => dkTal(v) + ' kWh')));
  } else {
    krop.append(h('div', { class: 'note warn' },
      'Der er ingen bimåling på butikken i perioden. Alt forbrug ligger i restposten, '
      + 'og ingen af de anlægsnære detektorer kan sige noget om butikken.'));
  }

  /* Åbne sager på butikken. */
  const sager = state.sager.filter((s) => s.butiksnummer === b.butiksnummer);
  krop.append(h('div', {},
    h('h3', {}, `Sager (${sager.length})`),
    sager.length
      ? tabel([
          { navn: '', celle: (s) => prioritetBadge(s.prioritet) },
          { navn: 'Sag', celle: (s) => s.sagsnavn, wrap: true },
          { navn: 'Kr./år', r: true, celle: (s) => dkTal(s.krAar) },
          { navn: 'Status', celle: (s) => badge(s.status) },
        ], sager, { onRow: (s) => visSag(s, gaaTil) })
      : h('p', { class: 'muted' }, 'Ingen sager på butikken.')));

  /* Målepunkter — kun for eksempelbutikken i seed-tilstand, ellers hentes de live. */
  const maalerBoks = h('div', {});
  krop.append(maalerBoks);
  visMaalere(maalerBoks, b);

  /* Dalux: anlæg og opgaver hentes ved klik, så dialogen åbner med det samme. */
  const daluxBoks = h('div', { class: 'card' },
    h('h3', {}, 'Dalux'),
    b.daluxBuildingId
      ? h('div', { class: 'btnrow' },
          knapHent('Hent anlæg', () => hentAnlaeg(b.daluxBuildingId), daluxListe, 'anlæg'),
          knapHent('Hent opgaver', () => hentOpgaver(b.daluxBuildingId), daluxListe, 'opgaver'))
      : h('p', { class: 'muted', style: { margin: 0 } },
          'Butikken er ikke koblet til en Dalux-bygning. Koblingen sker på butiksnummer — '
          + '865 af 1.171 butikker er koblet i dag.'));
  krop.append(daluxBoks);

  function knapHent(tekst, fn, render, hvad) {
    const ud = h('div', { style: { marginTop: '10px' } });
    const knap = h('button', { class: 'btn' }, tekst);
    knap.addEventListener('click', async () => {
      knap.disabled = true; ud.replaceChildren(h('span', { class: 'muted' }, 'Henter …'));
      try {
        const r = await fn();
        ud.replaceChildren(render(r, hvad));
      } catch (err) {
        ud.replaceChildren(h('div', { class: 'note stop' }, `Kunne ikke hente ${hvad}: ${err.message}`));
      }
      knap.disabled = false;
    });
    daluxBoks.append(ud);
    return knap;
  }

  modal({ titel: b.navn, krop, bredde: 880 });
}

function daluxListe(r, hvad) {
  const liste = Array.isArray(r) ? r : [];
  if (!liste.length) return h('p', { class: 'muted' }, `Ingen ${hvad} fundet.`);
  return tabel([
    { navn: 'Id', celle: (x) => String(x.id ?? x.assetId ?? x.workOrderId ?? '—') },
    { navn: 'Navn', celle: (x) => String(x.name ?? x.subject ?? x.description ?? '—').slice(0, 90), wrap: true },
    { navn: 'Status', celle: (x) => String(x.status?.name ?? x.status ?? x.classification?.name ?? '—') },
  ], liste.slice(0, 40));
}

function visMaalere(boks, b) {
  const m = state.data.maalere || [];
  if (!m.length) return;
  boks.replaceChildren(h('div', {},
    h('h3', {}, 'Målepunkter og deres klassifikation'),
    h('p', { class: 'muted', style: { fontSize: '12.5px', marginTop: 0 } },
      'Faggruppen læses af Enitys egne tags efter opsætningen fra Coop Energi Einsight — ikke af målernavnet. '
      + 'Det dybeste niveau vinder: L4 slår L2, som slår L0/1.'),
    tabel([
      { navn: 'Målepunkt', celle: (x) => x.name, wrap: true },
      { navn: 'Faggruppe', celle: (x) => {
          const k = klassificerMaalepunkt(x);
          return h('span', { title: k.afventer || '' },
            swatch(fgFarve(k.faggruppe)), fgNavn(k.faggruppe),
            k.afventer ? h('span', { style: { color: 'var(--p2)' } }, ' ⚑') : null);
        } },
      { navn: 'Rolle', celle: (x) => klassificerMaalepunkt(x).rolle },
      { navn: 'Kilde', celle: (x) => { const k = klassificerMaalepunkt(x);
          return badge(k.kilde, k.kilde === 'mangler-underniveau' ? 'p2' : k.kilde.startsWith('tag-L4') || k.kilde.startsWith('tag-L2') ? 'ok' : ''); } },
      { navn: 'Konfidens', r: true, celle: (x) => { const k = klassificerMaalepunkt(x); return k.konfidens ? Math.round(k.konfidens * 100) + ' %' : '—'; } },
      { navn: 'kWh/30 d', r: true, celle: (x) => (x.kwh30d === 0 ? h('span', { style: { color: 'var(--p1)' } }, '0') : dkTal(x.kwh30d)) },
    ], m),
    h('p', { class: 'muted', style: { fontSize: '11.5px' } },
      'Eksemplet er 07360 SB Aalborg. Bemærk at både hovedmåleren "El total" og bimåleren "Konsum køl" står på nul, '
      + 'mens datahub-måleren kører — det er præcis det, detektor D-04 findes for. '
      + 'Et ⚑ betyder, at målepunktet kun har et bredt L0/1-tag og mangler et L2- eller L4-niveau, '
      + 'før faggruppen kan afgøres.')));
}
