/* Natlig synkronisering af de tre kilder.
 *
 * Dalux, Enity og solcelleplatformen hentes én gang i døgnet om natten, og
 * derefter køres motoren og detektorerne, så morgenens sagsliste er klar,
 * inden nogen møder ind.
 *
 * Opbygningen følger det samme princip som resten: hvert trin er en lille,
 * testbar enhed med en ejer og en status. Et trin, der fejler, stopper ikke
 * de andre — det markeres, og de øvrige kører videre. Alternativet er en
 * kørsel, der vælter, fordi én leverandørs API var nede kl. 03.
 *
 * Vandmærker (watermarks) gør kørslen inkrementel: vi henter kun det, der er
 * ændret siden sidst. Første kørsel er fuld, resten er små.
 */

import { skriv } from './state.js';

export const NATLIG_STANDARD = {
  tidspunkt: '03:15',      // lokal tid — efter midnat, før nogen møder ind
  tidszone: 'Europe/Copenhagen',
  forsoeg: 4,              // pr. trin
  ventMs: 2000,            // fordobles pr. forsøg: 2s, 4s, 8s, 16s
  sideStoerrelse: 200,
};

/* En kørsel, nogen sidder og venter på, må ikke bruge nattens tålmodighed.
 * Fejler forbindelsen, skal det siges med det samme — ikke efter to minutter. */
export const MANUEL_STANDARD = { ...NATLIG_STANDARD, forsoeg: 2, ventMs: 700 };

/* ---- Trin ----------------------------------------------------------------
 * Rækkefølgen er ikke tilfældig. Stamdata før bevægelsesdata, og motoren
 * efter begge — den kan ikke matche en opgave mod et anlægsregister, der
 * ikke er hentet endnu.
 */
export const TRIN = [
  { id: 'dalux-bygninger', navn: 'Dalux · bygninger',       kilde: 'dalux', slags: 'stamdata',
    beskrivelse: 'Butikker med kardex, salgsareal, kæde og adresse. Nøglen til alt andet.' },
  { id: 'dalux-anlaeg',    navn: 'Dalux · anlæg',           kilde: 'dalux', slags: 'stamdata',
    beskrivelse: 'Anlægsregistret pr. butik med klassifikation. Motorens kandidatmængde.' },
  { id: 'dalux-opgaver',   navn: 'Dalux · opgaver',         kilde: 'dalux', slags: 'bevaegelse',
    beskrivelse: 'Arbejdsordrer ændret siden sidste kørsel.' },
  { id: 'dalux-historik',  navn: 'Dalux · opgavehistorik',  kilde: 'dalux', slags: 'bevaegelse',
    beskrivelse: 'Hvad servicepartneren fandt og gjorde. Det stærkeste facit vi har.' },
  { id: 'enity-bygninger', navn: 'Enity · bygninger',       kilde: 'enity', slags: 'stamdata',
    beskrivelse: 'Bygningshierarki og butiksnumre.' },
  { id: 'enity-maalere',   navn: 'Enity · målepunkter',     kilde: 'enity', slags: 'stamdata',
    beskrivelse: 'Målere med L0/1–L4-tags. Grundlaget for faggruppefordelingen.' },
  { id: 'enity-forbrug',   navn: 'Enity · forbrug',         kilde: 'enity', slags: 'bevaegelse',
    beskrivelse: 'Døgn- og timeværdier for perioder, der ikke er afsluttet endnu.' },
  { id: 'sol-anlaeg',      navn: 'Solceller · anlæg',       kilde: 'sol',   slags: 'stamdata',
    beskrivelse: 'Anlæg, invertere og kapacitet fra de fire dataveje.' },
  { id: 'sol-produktion',  navn: 'Solceller · produktion',  kilde: 'sol',   slags: 'bevaegelse',
    beskrivelse: 'Timeproduktion og forventet produktion for det seneste døgn.' },
  { id: 'sol-alarmer',     navn: 'Solceller · alarmer',     kilde: 'sol',   slags: 'bevaegelse',
    beskrivelse: 'Nye og lukkede alarmer. Kører i skyggedrift.' },
  { id: 'vejr',            navn: 'Vejr · ti zoner',         kilde: 'vejr',  slags: 'bevaegelse',
    beskrivelse: 'Temperatur, vind, skydække og indstråling. Uden dem er halvdelen af alle kølesager falske om sommeren.' },
  { id: 'kobling',         navn: 'Kobling · anlæg mod målepunkt', kilde: 'lokal', slags: 'beregning',
    beskrivelse: 'Binder Dalux-anlæg til Enity-målepunkter og afgør, hvad der kan analyseres hver for sig.' },
  { id: 'anlaegsanalyse',  navn: 'Normallast og mønsterbrud', kilde: 'lokal', slags: 'beregning',
    beskrivelse: 'Bygger normallasten pr. anlæg og finder niveauskift, drift og brudt vejrrespons.' },
  { id: 'motor',           navn: 'Motor · anlæg og faggruppe', kilde: 'lokal', slags: 'beregning',
    beskrivelse: 'Læser nye opgaver, finder anlægget og placerer dem i en faggruppe.' },
  { id: 'detektorer',      navn: 'Detektorer og sagsbygger', kilde: 'lokal', slags: 'beregning',
    beskrivelse: 'Kører hele detektorkataloget og bygger sagerne op igen.' },
];

/* ---- Kørselstilstand ------------------------------------------------------ */

const TOM_KOERSEL = () => ({
  id: null, startet: null, afsluttet: null, status: 'ikke kørt',
  trin: Object.fromEntries(TRIN.map((t) => [t.id, { status: 'afventer', raekker: 0, ms: 0, fejl: null, forsoeg: 0 }])),
  vandmaerker: {},
  fejl: [],
});

export function nyKoersel(udloest = 'manuelt') {
  return { ...TOM_KOERSEL(), id: `SYNC-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`, udloest };
}

/* ---- Udførsel ------------------------------------------------------------- */

const vent = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Kører ét trin med genforsøg og eksponentiel ventetid. Netværksfejl er
 * værd at prøve igen; en afvist forespørgsel er ikke, og gentagne forsøg
 * på den gør kun skade.
 */
async function koerTrin(trin, udfoer, koersel, opt, onOpdatering) {
  const t = koersel.trin[trin.id];
  const start = performance.now();
  t.status = 'kører';
  // Meld ind, når trinnet starter og mellem hvert genforsøg. Ellers står
  // skærmen stille i op til et par minutter, mens et trin prøver igen, og
  // det ligner, at hubben er gået i stå.
  onOpdatering && onOpdatering(koersel);

  for (let forsoeg = 1; forsoeg <= opt.forsoeg; forsoeg++) {
    t.forsoeg = forsoeg;
    if (forsoeg > 1) { t.status = `prøver igen (${forsoeg}/${opt.forsoeg})`; onOpdatering && onOpdatering(koersel); }
    try {
      const resultat = await udfoer(trin, koersel);
      t.status = 'ok';
      t.raekker = (resultat && resultat.raekker) || 0;
      t.ms = Math.round(performance.now() - start);
      if (resultat && resultat.vandmaerke) koersel.vandmaerker[trin.id] = resultat.vandmaerke;
      return resultat;
    } catch (err) {
      const besked = String(err && err.message || err);
      if (err && err.springOver) {
        t.status = 'sprunget over';
        t.fejl = besked;
        t.ms = Math.round(performance.now() - start);
        return null;
      }
      const kanGentages = /Failed to fetch|NetworkError|timeout|ECONN|503|502|504|429/i.test(besked);
      if (!kanGentages || forsoeg === opt.forsoeg) {
        t.status = 'fejl';
        t.fejl = besked;
        t.ms = Math.round(performance.now() - start);
        koersel.fejl.push({ trin: trin.id, besked, gentagelig: kanGentages });
        return null;
      }
      await vent(opt.ventMs * 2 ** (forsoeg - 1));
    }
  }
  return null;
}

/**
 * Kører hele synkroniseringen. `udfoer` er den funktion, der faktisk henter
 * data for ét trin — den er skilt ud, så motoren kan testes uden netværk og
 * køres både i browseren og fra et cron-job.
 */
export async function koerSynkronisering(udfoer, { udloest = 'manuelt', onOpdatering, ...opt } = {}) {
  const indstillinger = { ...NATLIG_STANDARD, ...opt };
  const koersel = nyKoersel(udloest);
  koersel.startet = new Date().toISOString();
  koersel.status = 'kører';
  onOpdatering && onOpdatering(koersel);

  for (const trin of TRIN) {
    // Beregningstrinnene giver kun mening, hvis noget blev hentet.
    if (trin.slags === 'beregning') {
      // Kun hentetrin tæller. Et andet beregningstrin, der gik godt, betyder
      // ikke, at der er kommet nye data ind.
      const hentetrin = new Set(TRIN.filter((t) => t.slags !== 'beregning').map((t) => t.id));
      const hentetNoget = Object.entries(koersel.trin)
        .some(([id, t]) => hentetrin.has(id) && t.status === 'ok' && t.raekker > 0);
      if (!hentetNoget) {
        koersel.trin[trin.id].status = 'sprunget over';
        koersel.trin[trin.id].fejl = 'Intet blev hentet, så der er intet nyt at regne på.';
        onOpdatering && onOpdatering(koersel);
        continue;
      }
    }
    await koerTrin(trin, udfoer, koersel, indstillinger, onOpdatering);
    onOpdatering && onOpdatering(koersel);
  }

  koersel.afsluttet = new Date().toISOString();
  const fejlede = Object.values(koersel.trin).filter((t) => t.status === 'fejl').length;
  const ok = Object.values(koersel.trin).filter((t) => t.status === 'ok').length;
  koersel.sprungetOver = Object.values(koersel.trin).filter((t) => t.status === 'sprunget over').length;
  // En delvis kørsel er ikke en fejlet kørsel. Den skal bare kunne ses som
  // delvis, så ingen tror, at dagens tal dækker hele porteføljen.
  koersel.status = fejlede === 0 ? 'ok' : ok > 0 ? 'delvis' : 'fejlet';
  koersel.raekkerIAlt = Object.values(koersel.trin).reduce((a, t) => a + (t.raekker || 0), 0);
  koersel.varighedMs = new Date(koersel.afsluttet) - new Date(koersel.startet);
  onOpdatering && onOpdatering(koersel);
  return koersel;
}

/* ---- Planlægning ---------------------------------------------------------
 * En browserfane er ikke en pålidelig cron: den kan være lukket kl. 03.
 * Timeren her er derfor en bekvemmelighed, ikke en garanti — den rigtige
 * kørsel sker fra `sync/run.mjs` via cron eller en scheduled workflow.
 * Hubben viser tydeligt, hvornår der sidst KOM data ind, så en manglende
 * kørsel ikke kan forveksles med en rolig nat.
 */

export function naesteKoersel(tidspunkt = NATLIG_STANDARD.tidspunkt, nu = new Date()) {
  const [t, m] = String(tidspunkt).split(':').map(Number);
  const naeste = new Date(nu);
  naeste.setHours(t, m || 0, 0, 0);
  if (naeste <= nu) naeste.setDate(naeste.getDate() + 1);
  return naeste;
}

export function planlaegNatligKoersel(udfoer, { tidspunkt = NATLIG_STANDARD.tidspunkt, onKoersel, ...opt } = {}) {
  let timer = null;
  let stoppet = false;

  const planlaeg = () => {
    if (stoppet) return;
    const naeste = naesteKoersel(tidspunkt);
    const om = naeste - Date.now();
    // setTimeout kan ikke holde til mere end ~24,8 døgn, men kan også drive
    // over lange perioder. Vi vågner derfor hver time og tjekker i stedet.
    const vaagnOm = Math.min(om, 60 * 60 * 1000);
    timer = setTimeout(async () => {
      if (stoppet) return;
      if (Date.now() >= naeste.getTime() - 60000) {
        const k = await koerSynkronisering(udfoer, { udloest: 'natlig', ...opt });
        onKoersel && onKoersel(k);
      }
      planlaeg();
    }, Math.max(vaagnOm, 1000));
  };

  planlaeg();
  return {
    naeste: () => naesteKoersel(tidspunkt),
    stop: () => { stoppet = true; if (timer) clearTimeout(timer); },
  };
}

/* ---- Hentefunktionerne ---------------------------------------------------- */

/**
 * Bygger den `udfoer`-funktion, der henter rigtige data gennem MCP-klienterne.
 * Alle kald går gennem de samme værktøjer, hubben ellers bruger.
 */
export function byggHenter({ klienter, sol, gem, beregn, vandmaerker = {}, sideStoerrelse = NATLIG_STANDARD.sideStoerrelse }) {
  const siden = (id) => vandmaerker[id] || null;

  return async function udfoer(trin, koersel) {
    switch (trin.id) {
      case 'dalux-bygninger': {
        const data = await sideOpSide((b) => klienter.dalux.call('dalux_list_buildings', { limit: sideStoerrelse, bookmark: b }));
        await gem('daluxBygninger', data);
        return { raekker: data.length, vandmaerke: new Date().toISOString() };
      }
      case 'dalux-anlaeg': {
        const data = await sideOpSide((b) => klienter.dalux.call('dalux_list_assets', { limit: sideStoerrelse, bookmark: b }));
        await gem('daluxAnlaeg', data);
        return { raekker: data.length, vandmaerke: new Date().toISOString() };
      }
      case 'dalux-opgaver': {
        // Dalux leverer nyeste dataændring først, så vi kan stoppe, når vi
        // rammer noget, der er ældre end sidste kørsel.
        const graense = siden('dalux-opgaver');
        const data = await sideOpSide(
          (b) => klienter.dalux.call('dalux_list_workorders', { limit: sideStoerrelse, bookmark: b }),
          (raekke) => graense && raekke.latestChange && raekke.latestChange < graense,
        );
        await gem('daluxOpgaver', data);
        return { raekker: data.length, vandmaerke: new Date().toISOString() };
      }
      case 'dalux-historik': {
        const opgaver = await gem('daluxOpgaver');
        // Kunne opgaverne ikke hentes, er der ingen historik at hente — og så
        // skal trinnet sige det, ikke melde "ok" for nul rækker. Et trin, der
        // melder grønt uden at have gjort noget, er værre end et rødt.
        if (!Array.isArray(opgaver)) {
          const fejl = new Error('Springer over: opgaverne blev ikke hentet, så der er ingen historik at følge op på.');
          fejl.springOver = true;
          throw fejl;
        }
        let raekker = 0;
        const historik = {};
        // Kun for opgaver, der er lukket siden sidst — historikken på en åben
        // opgave fortæller os ikke, hvad der blev fundet.
        for (const o of opgaver.filter((x) => x.closedDate).slice(0, 200)) {
          const id = String(o.workOrderId ?? o.id);
          historik[id] = await klienter.dalux.call('dalux_list_workorder_history', { id, limit: 50 });
          raekker++;
        }
        await gem('daluxHistorik', historik);
        return { raekker, vandmaerke: new Date().toISOString() };
      }
      case 'enity-bygninger': {
        const data = await klienter.enity.call('list_buildings', {});
        await gem('enityBygninger', data);
        return { raekker: laengde(data), vandmaerke: new Date().toISOString() };
      }
      case 'enity-maalere': {
        const data = await klienter.enity.call('list_meters', {});
        await gem('enityMaalere', data);
        return { raekker: laengde(data), vandmaerke: new Date().toISOString() };
      }
      case 'enity-forbrug': {
        // Vi henter de seneste 45 døgn igen hver nat: målerdata efterreguleres,
        // og en aflæsning, der kom for sent, ville ellers aldrig blive hentet.
        const slut = new Date();
        const start = new Date(slut.getTime() - 45 * 864e5);
        const data = await klienter.enity.call('get_summarised_consumption', {
          energyType: 'Electricity',
          start: start.toISOString().slice(0, 10),
          end: slut.toISOString().slice(0, 10),
        });
        await gem('enityForbrug', data);
        return { raekker: laengde(data), vandmaerke: slut.toISOString() };
      }
      case 'vejr': {
        const { hentAlleZoner, VEJRZONER } = await import('./vejr.js');
        const slut = new Date();
        const start = new Date(slut.getTime() - 400 * 864e5);
        const { zoner, fejl } = await hentAlleZoner({
          fra: start.toISOString().slice(0, 10),
          til: slut.toISOString().slice(0, 10),
        });
        await gem('vejr', zoner);
        // Én zone, der fejler, må ikke vælte de ni andre — men det skal ses.
        if (fejl.length === VEJRZONER.length) throw new Error(`Alle vejrzoner fejlede: ${fejl[0].besked}`);
        return { raekker: Object.values(zoner).reduce((a, z) => a + z.length, 0), vandmaerke: slut.toISOString() };
      }
      case 'kobling':
      case 'anlaegsanalyse': {
        if (!beregn || !beregn[trin.id]) {
          const f = new Error('Beregningen er ikke koblet på denne kørsel.');
          f.springOver = true; throw f;
        }
        const r = await beregn[trin.id]({ gem });
        return { raekker: (r && r.raekker) || 0 };
      }
      case 'sol-anlaeg':
      case 'sol-produktion':
      case 'sol-alarmer': {
        if (!sol || !sol.hent) throw new Error('Solcelleplatformen er ikke konfigureret — sæt dens URL under Opsætning.');
        const data = await sol.hent(trin.id, { siden: siden(trin.id) });
        await gem(trin.id, data);
        return { raekker: laengde(data), vandmaerke: new Date().toISOString() };
      }
      case 'motor': {
        if (!beregn || !beregn.motor) throw new Error('Motoren er ikke koblet på synkroniseringen.');
        const r = await beregn.motor({ gem });
        return { raekker: (r && r.behandlede) || 0 };
      }
      case 'detektorer': {
        if (!beregn || !beregn.detektorer) throw new Error('Detektorerne er ikke koblet på synkroniseringen.');
        const r = await beregn.detektorer({ gem });
        return { raekker: (r && r.sager) || 0 };
      }
      default:
        throw new Error(`Trinnet "${trin.id}" har ingen hentefunktion.`);
    }
  };
}

/** Henter alle sider via Dalux' bookmark-paginering. `stop` afslutter tidligt. */
async function sideOpSide(hent, stop, maxSider = 60) {
  const alle = [];
  let bookmark = undefined;
  for (let side = 0; side < maxSider; side++) {
    const svar = await hent(bookmark);
    const raekker = Array.isArray(svar) ? svar : (svar && (svar.items || svar.data)) || [];
    if (!raekker.length) break;
    for (const r of raekker) {
      if (stop && stop(r)) return alle;
      alle.push(r);
    }
    bookmark = svar && (svar.bookmark || svar.nextBookmark);
    if (!bookmark) break;
  }
  return alle;
}

const laengde = (d) => (Array.isArray(d) ? d.length : (d && (d.items || d.data) || []).length || (d ? 1 : 0));

/** Kort opsummering, der kan læses på en telefon. */
export function opsummer(koersel) {
  if (!koersel || !koersel.startet) return 'Ingen kørsel endnu.';
  const ok = Object.values(koersel.trin).filter((t) => t.status === 'ok').length;
  const fejl = Object.values(koersel.trin).filter((t) => t.status === 'fejl').length;
  const sek = Math.round((koersel.varighedMs || 0) / 1000);
  return `${koersel.status} · ${ok} af ${TRIN.length} trin · ${(koersel.raekkerIAlt || 0).toLocaleString('da-DK')} rækker`
    + (fejl ? ` · ${fejl} fejlede` : '') + (sek ? ` · ${sek} s` : '');
}
