/* Signaturer målt et andet sted.
 *
 * Hubben kan ikke selv nå Enity herindefra — egress-proxyen afviser værten.
 * Det betyder ikke, at analysen skal køre på modellerede tal: målingen kan
 * laves dér, hvor data er, og diagnosen stilles her, hvor kataloget er.
 *
 * Det er en fornuftig arbejdsdeling og ikke kun en nødløsning. Målingen er
 * mekanisk og veldefineret — en regression, et skiftepunkt, en hældning. Det,
 * der kræver fagligheden, er at vide hvad formen BETYDER, og det ligger i
 * årsagskataloget.
 *
 * Men det stiller ét krav, som denne fil handler om: tal, der kommer udefra,
 * skal efterprøves, før de bruges. En signatur, der er målt forkert, giver en
 * diagnose, der lyder lige så overbevisende som en rigtig. Derfor afvises
 * rækker, der er indbyrdes modstridende, frem for at blive regnet på.
 */

import { diagnosticer } from './aarsag.js';
import { samtidighed, FG_FAGOMRAADER } from './korrelation.js';

/* ---- Efterprøvning -------------------------------------------------------- */

/**
 * Er de målte tal indbyrdes konsistente?
 *
 * Tjekkene er ikke formaliteter. Hver af dem svarer til en fejl, det er let at
 * begå, når signaturen regnes et andet sted end der, hvor den bruges.
 */
export function efterproev(m) {
  const fejl = [];
  const advarsler = [];

  const tal = (x) => Number.isFinite(x);

  if (!tal(m.medianResidual) || !tal(m.medianForudsagt)) fejl.push('mangler median residual eller forudsagt');
  if (tal(m.medianForudsagt) && m.medianForudsagt <= 0) fejl.push('forudsagt forbrug er nul eller negativt — modellen kan ikke være tilpasset');

  /* Procenten skal kunne genberegnes af de to tal, den er lavet af. Gør den
   * ikke det, er mindst ét af dem fra en anden periode end de andre — og det
   * er den hyppigste fejl, når tal samles fra flere kørsler. */
  if (tal(m.afvigPct) && tal(m.medianResidual) && tal(m.medianForudsagt) && m.medianForudsagt > 0) {
    const regnet = 100 * m.medianResidual / m.medianForudsagt;
    if (Math.abs(regnet - m.afvigPct) > Math.max(2, Math.abs(m.afvigPct) * 0.15)) {
      fejl.push(`afvigelsen på ${m.afvigPct} % passer ikke med ${m.medianResidual} / ${m.medianForudsagt} = ${Math.round(regnet)} %`);
    }
  }

  /* Restniveau og afvigelse måler det samme fra hver sin ende: restniveau er
   * faktisk/forudsagt, afvigelsen er (faktisk−forudsagt)/forudsagt. De skal
   * summere til 1. */
  if (tal(m.restniveau) && tal(m.afvigPct)) {
    const forventet = 1 + m.afvigPct / 100;
    if (Math.abs(m.restniveau - forventet) > 0.08) {
      fejl.push(`restniveau ${m.restniveau} og afvigelse ${m.afvigPct} % er uforenelige — de burde summere til 1`);
    }
  }

  if (tal(m.restniveau) && m.restniveau < 0) fejl.push('negativt restniveau');

  // En temperaturkoefficient på nul gør vejrbeviset meningsløst frem for falsk.
  if (tal(m.b) && Math.abs(m.b) < 1e-6) advarsler.push('temperaturkoefficienten er nul — vejrafhængigheden kan ikke vurderes');

  if (tal(m.overgangsdoegn) && m.overgangsdoegn < 0) fejl.push('negativ overgangsbredde');
  if (tal(m.segmentdoegn) && m.segmentdoegn < 10) {
    advarsler.push(`kun ${m.segmentdoegn} døgn efter bruddet — afvigelsen har ikke holdt længe nok til at være sikker`);
  }
  if (tal(m.referencedoegn) && m.referencedoegn < 60) {
    advarsler.push(`kun ${m.referencedoegn} referencedøgn — normalen er tynd`);
  }

  return { ok: !fejl.length, fejl, advarsler };
}

/* ---- Fra måling til signatur ---------------------------------------------- */

/**
 * Bygger den signatur, `diagnosticer` forventer, ud af målte tal.
 *
 * Grænserne herinde er de samme som i `maalSignatur`, og det er med vilje: to
 * sæt tærskler for det samme ville før eller siden komme til at pege hver sin
 * vej, og så ville ingen kunne se hvorfor.
 */
export function signaturFraMaaling(m) {
  const k = efterproev(m);
  if (!k.ok) return { brugbar: false, grund: k.fejl.join('; '), fejl: k.fejl };

  const afvig = m.medianResidual;
  const forventet = m.medianForudsagt;
  const pct = m.afvigPct ?? (100 * afvig / forventet);

  // Form: samme rækkefølge som i maalSignatur — nul først, så ingen, så form.
  let form;
  if (m.restniveau != null && m.restniveau <= 0.02) form = 'nul';
  else if (Math.abs(pct) < 3) form = 'ingen';
  else if (m.overgangsdoegn != null && m.overgangsdoegn <= 14 && m.brudDato) form = 'spring';
  else form = 'glidende';

  // Vejrafhængighed: hældningen af de detrendede residualer, målt i anlæggets
  // egen temperaturkoefficient. Over en fjerdedel regnes som afhængig.
  const forhold = m.vejrforhold;
  const vejrafhaengig = forhold == null ? 'ukendt'
    : Math.abs(forhold) > 0.25 ? (forhold > 0 ? 'ja' : 'omvendt') : 'nej';

  let vejrrespons = 'ukendt';
  if (Number.isFinite(m.koefFoer) && Number.isFinite(m.koefEfter) && Math.abs(m.koefFoer) > 1e-6) {
    const r = m.koefEfter / m.koefFoer;
    vejrrespons = r < 0.25 ? 'brudt' : r > 1.6 ? 'forstærket' : 'uændret';
  }

  return {
    brugbar: true,
    form,
    retning: afvig > 0 ? 'op' : afvig < 0 ? 'ned' : 'flad',
    afvigKwhPrDoegn: Math.round(afvig),
    afvigPct: Math.round(pct * 10) / 10,
    forventetKwhPrDoegn: Math.round(forventet),
    normalKwhPrDoegn: Math.round(forventet),
    restniveau: m.restniveau ?? null,
    vejrafhaengig,
    vejrkobling: forhold == null ? null : { variabel: 'temperatur', andel: forhold, anlaegKoef: m.b ?? null },
    vejrrespons,
    koefFoer: m.koefFoer ?? null,
    koefEfter: m.koefEfter ?? null,
    overgangsdoegn: m.overgangsdoegn ?? null,
    brud: m.brudDato ? { dato: m.brudDato } : null,
    segmentStart: m.brudDato || m.segmentStart || null,
    doegn: m.segmentdoegn ?? null,
    vurderingsdoegn: m.vurderingsdoegn ?? null,
    referencedoegn: m.referencedoegn ?? null,
    // Målt et andet sted — det skal følge med, så det kan ses i forbeholdene.
    modelleret: false,
    maaltEksternt: true,
    mangler: [
      m.vejrforhold == null ? 'vejrafhængighed er ikke målt' : null,
      'timedata — døgnprofil og natandel kan ikke ses',
    ].filter(Boolean),
    advarsler: k.advarsler,
  };
}

/**
 * Hele vejen: målte tal ind, diagnose ud.
 *
 * `opgaver` er valgfri. Uden Dalux-opgaver på anlægget bliver koblingen
 * "uledsaget", og det er et ærligt svar — ikke en mangel, der skal skjules.
 */
export function diagnosticerMaaling(m, { faggruppe, opgaver = [], priors = null, gentagneOpgaver = 0 } = {}) {
  const signatur = signaturFraMaaling(m);
  if (!signatur.brugbar) return { brugbar: false, grund: signatur.grund, fejl: signatur.fejl };

  const kobling = signatur.segmentStart
    ? samtidighed({ dato: signatur.segmentStart }, opgaver, { faggruppe, relevante: FG_FAGOMRAADER[faggruppe] })
    : null;

  const diagnose = diagnosticer(signatur, { faggruppe, kobling, priors, gentagneOpgaver });
  return { brugbar: true, signatur, kobling, diagnose };
}

/**
 * Kører en hel tabel igennem og holder regnskab med, hvad der ikke kunne bruges.
 * Rækker, der ikke består efterprøvningen, forsvinder ikke — de står som
 * afviste med en grund, så en fejl i målingen kan findes og rettes i stedet for
 * bare at mangle.
 */
export function diagnosticerTabel(raekker, { priors = {}, opgaverPrEnhed = {} } = {}) {
  const fund = [];
  const afvist = [];
  for (const m of raekker) {
    const r = diagnosticerMaaling(m, {
      faggruppe: m.faggruppe,
      opgaver: opgaverPrEnhed[m.maalerId] || [],
      priors: priors[m.faggruppe] || null,
    });
    if (!r.brugbar) { afvist.push({ ...m, grund: r.grund }); continue; }
    fund.push({
      ...m,
      signatur: r.signatur,
      kobling: r.kobling,
      aarsagId: r.diagnose.bedste.id,
      aarsag: r.diagnose.bedste.navn,
      konfidens: r.diagnose.konfidens,
      entydig: r.diagnose.entydig,
      naest: r.diagnose.naest ? { id: r.diagnose.naest.id, navn: r.diagnose.naest.navn, andel: Math.round(r.diagnose.naest.andel * 100) } : null,
      beviser: r.diagnose.bedste.beviser,
      forbehold: r.diagnose.forbehold,
      klasse: r.diagnose.bedste.klasse,
      hastende: !!r.diagnose.bedste.hastende,
    });
  }
  return { fund, afvist };
}
