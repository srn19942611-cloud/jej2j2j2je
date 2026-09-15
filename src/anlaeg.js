/* Teknisk anlægsregister — opsætningen hentet fra Lovable-projektet
 * "Coop Energi Einsight" og lagt sammen med Dalux' egen anlægsklassifikation.
 *
 * Tre niveauer, der hænger sammen:
 *
 *   FAGGRUPPE          Køl & frys, Ventilation, Lys inde …   (energiregnskabets linjer)
 *      └─ ANLÆGSKLASSE Dalux-klassifikation med kode          (det fysiske anlæg)
 *           └─ MÅLEPUNKT  Enity-tag L0/1 → L2 → L3 → L4       (det, der måles)
 *
 * Faggruppen er den, økonomien rapporteres på. Anlægsklassen er den, en
 * tekniker arbejder på, og den Dalux opretter opgaver på. Målepunktet er
 * det, detektorerne kigger på. Uden alle tre kan en sag ikke både prissættes,
 * forklares og sendes det rigtige sted hen.
 */

/* ---- Målepunkt-tags -------------------------------------------------------
 * Den fulde tagmapping fra Coop Energi Einsight: 61 regler over fire niveauer.
 *
 * Bemærk `kraeverUnderniveau`: "L0/1 HVAC" må IKKE auto-mappes alene — den
 * dækker både ventilation, køleflade og varmeflade, og skal have et L2- eller
 * L4-tag med, før faggruppen er afgjort. Det er den regel, der forhindrer, at
 * en køleflade bliver talt som ventilation i energiregnskabet.
 */
export const TAGMAPPING = [
  // niveau 1 — L0/1
  { tag: 'L0/1 Andet',            niveau: 1, fg: null,             rolle: null,                konfidens: 0,    kraeverUnderniveau: false, note: 'Kræver gennemgang' },
  { tag: 'L0/1 Forsyningsmåler',  niveau: 1, fg: null,             rolle: 'forsyning',         konfidens: 1,    kraeverUnderniveau: false, note: 'Netkøb fra forsyning/Datahub' },
  { tag: 'L0/1 Hovedmåler',       niveau: 1, fg: null,             rolle: 'hovedmaaler_intern',konfidens: 1,    kraeverUnderniveau: false, note: 'Intern hovedmåler' },
  { tag: 'L0/1 HVAC',             niveau: 1, fg: null,             rolle: null,                konfidens: 0,    kraeverUnderniveau: true,  note: 'Må kun auto-mappes med L2/L4-underniveau' },
  { tag: 'L0/1 Konsumkøl',        niveau: 1, fg: 'koel_frys',      rolle: null,                konfidens: 0.85, kraeverUnderniveau: false },
  { tag: 'L0/1 Lejere',           niveau: 1, fg: null,             rolle: 'lejer',             konfidens: 1,    kraeverUnderniveau: false, note: 'Lejerforbrug trækkes ud af butikkens eget forbrug' },
  { tag: 'L0/1 Lys',              niveau: 1, fg: 'lys_inde',       rolle: null,                konfidens: 0.8,  kraeverUnderniveau: false },
  { tag: 'L0/1 Overskudsvarme',   niveau: 1, fg: 'overskudsvarme', rolle: null,                konfidens: 0.9,  kraeverUnderniveau: false },
  { tag: 'L0/1 Produktion',       niveau: 1, fg: 'produktion',     rolle: null,                konfidens: 0.7,  kraeverUnderniveau: false, note: 'Bageri-, slagter- og køkkenudstyr' },
  { tag: 'L0/1 Solceller',        niveau: 1, fg: null,             rolle: 'solceller',         konfidens: 1,    kraeverUnderniveau: false, note: 'Egenproduktion, ikke forbrug' },
  // niveau 2 — L2
  { tag: 'L2 Blandet belysning',                      niveau: 2, fg: 'lys_inde',       konfidens: 0.85 },
  { tag: 'L2 Blandet HVAC',                           niveau: 2, fg: null,             konfidens: 0,    note: 'Kræver gennemgang' },
  { tag: 'L2 Blandet produktion',                     niveau: 2, fg: 'produktion',     konfidens: 0.7 },
  { tag: 'L2 EDB / Terminal Tavle (Kun 1300+ m2)',    niveau: 2, fg: 'cts',            konfidens: 0.9 },
  { tag: 'L2 Eltracing - Beton fliser',               niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Eltracing - Varme på tag',               niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Elvarme / komfortvarme',                 niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Friture',                                niveau: 2, fg: 'produktion',     konfidens: 0.9 },
  { tag: 'L2 Grundbelysning',                         niveau: 2, fg: 'lys_inde',       konfidens: 0.9 },
  { tag: 'L2 Kipsteger',                              niveau: 2, fg: 'produktion',     konfidens: 0.9 },
  { tag: 'L2 Klimaanlæg',                             niveau: 2, fg: 'koeleflader',    konfidens: 0.85 },
  { tag: 'L2 Køle/frostmøbel med singlekomp.',        niveau: 2, fg: 'koel_frys',      konfidens: 0.95 },
  { tag: 'L2 Køle/frostrum med singlekomp.',          niveau: 2, fg: 'koel_frys',      konfidens: 0.95 },
  { tag: 'L2 Kølecontainer selvstændig',              niveau: 2, fg: 'koel_frys',      konfidens: 0.95 },
  { tag: 'L2 Kompressorer',                           niveau: 2, fg: 'koel_frys',      konfidens: 0.95 },
  { tag: 'L2 Møbler',                                 niveau: 2, fg: 'koel_frys',      konfidens: 0.9,  note: 'Kølemøbler' },
  { tag: 'L2 OK Tank',                                niveau: 2, fg: null, rolle: 'lejer', konfidens: 1, note: 'Ekstern forbruger på matriklen' },
  { tag: 'L2 Overskudsvarme - Eget forbrug',          niveau: 2, fg: 'overskudsvarme', konfidens: 0.95 },
  { tag: 'L2 Overskudsvarme - Total produktion',      niveau: 2, fg: 'overskudsvarme', konfidens: 0.95 },
  { tag: 'L2 Overskudsvarme - VGV blæser med kølemiddel', niveau: 2, fg: 'overskudsvarme', konfidens: 0.95 },
  { tag: 'L2 Overskudsvarme - Videresalg',            niveau: 2, fg: 'overskudsvarme', konfidens: 0.95 },
  { tag: 'L2 Ovn',                                    niveau: 2, fg: 'produktion',     konfidens: 0.9 },
  { tag: 'L2 Komfur',                                 niveau: 2, fg: 'produktion',     konfidens: 0.9 },
  { tag: 'L2 Plug in møbler',                         niveau: 2, fg: 'koel_frys',      konfidens: 0.9 },
  { tag: 'L2 Primær køleanlæg',                       niveau: 2, fg: 'koel_frys',      konfidens: 0.92 },
  { tag: 'L2 Særbelysning',                           niveau: 2, fg: 'lys_inde',       konfidens: 0.85 },
  { tag: 'L2 Solceller - Eget forbrug',               niveau: 2, fg: null, rolle: 'solceller', konfidens: 1 },
  { tag: 'L2 Solceller - Produktion',                 niveau: 2, fg: null, rolle: 'solceller', konfidens: 1 },
  { tag: 'L2 Solceller - Videresalg',                 niveau: 2, fg: null, rolle: 'solceller', konfidens: 1 },
  { tag: 'L2 Tavle uden specifikt indhold',           niveau: 2, fg: null,             konfidens: 0,    note: 'Kræver gennemgang' },
  { tag: 'L2 Uspecificeret lejemål',                  niveau: 2, fg: null, rolle: 'lejer', konfidens: 1 },
  { tag: 'L2 Vand VVB',                               niveau: 2, fg: 'oevrigt',        konfidens: 0.5 },
  { tag: 'L2 Varme VVB (EL skal ALTID måles)',        niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Varme VVB (Kun 1300+ m2)',               niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Varmepumpe',                             niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Varmetæppe (EL skal ALTID måles)',       niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Varmetæppe (Kun 1300+ m2)',              niveau: 2, fg: 'varme_el',       konfidens: 0.9 },
  { tag: 'L2 Ventilation',                            niveau: 2, fg: 'ventilation',    konfidens: 0.9 },
  // niveau 3 — L3
  { tag: 'L3 Alt i butikken blandet',                 niveau: 3, fg: null,             konfidens: 0,    note: 'Kræver gennemgang' },
  { tag: 'L3 Udvendigt',                              niveau: 3, fg: 'lys_ude',        konfidens: 0.9,  note: 'Kun sammen med belysning' },
  // niveau 4 — L4
  { tag: 'L4 El varmepumpe luft > luft (Nedkøling)',  niveau: 4, fg: 'koeleflader',    konfidens: 0.9 },
  { tag: 'L4 El varmepumpe luft > luft (Opvarmning)', niveau: 4, fg: 'varme_el',       konfidens: 0.97 },
  { tag: 'L4 El varmepumpe luft > vand',              niveau: 4, fg: 'varme_el',       konfidens: 0.97 },
  { tag: 'L4 Elpatron buffer-tank',                   niveau: 4, fg: 'varme_el',       konfidens: 0.95 },
  { tag: 'L4 Elpatron rørledning (elkassette)',       niveau: 4, fg: 'varme_el',       konfidens: 0.95 },
  { tag: 'L4 Elpatron VVB',                           niveau: 4, fg: 'varme_el',       konfidens: 0.95 },
  { tag: 'L4 Elvarme',                                niveau: 4, fg: 'varme_el',       konfidens: 0.95 },
  { tag: 'L4 Køleflade',                              niveau: 4, fg: 'koeleflader',    konfidens: 0.97 },
  { tag: 'L4 Kun ventilation',                        niveau: 4, fg: 'ventilation',    konfidens: 0.97 },
  { tag: 'L4 Samlet anlæg',                           niveau: 4, fg: null,             konfidens: 0,    note: 'Ventilation, køle- og varmeflade i ét — kræver gennemgang' },
  { tag: 'L4 Varme varmepumpe luft > vand',           niveau: 4, fg: 'varme_el',       konfidens: 0.97 },
  { tag: 'L4 Varmeflade',                             niveau: 4, fg: 'varme_fjern',    konfidens: 0.9,  note: 'Varmeflade i ventilation' },
];

const TAG_INDEX = new Map(TAGMAPPING.map((r) => [r.tag, r]));

/** Slår et tag op. Matcher på præfiks, så varianter med ekstra tekst også rammer. */
function slaaOp(tag) {
  if (TAG_INDEX.has(tag)) return TAG_INDEX.get(tag);
  let bedst = null;
  for (const r of TAGMAPPING) {
    if (tag.startsWith(r.tag) && (!bedst || r.tag.length > bedst.tag.length)) bedst = r;
  }
  return bedst;
}

/**
 * Klassificerer et Enity-målepunkt efter den rigtige tagmapping.
 * Det dybeste niveau vinder — L4 slår L2, som slår L0/1 — og et L0/1-tag,
 * der kræver underniveau, giver ikke en faggruppe alene.
 */
export function klassificerMaalepunkt(meter) {
  const tags = (meter.tags || []).map((t) => String(t).replace(/^custom:/, '').trim());
  let fg = null, rolle = null, konfidens = 0, kilde = null, venter = null, rolleKilde = null;

  for (const tag of tags) {
    const regel = slaaOp(tag);
    if (!regel) continue;
    if (regel.rolle && !rolle) { rolle = regel.rolle; rolleKilde = regel; }
    if (regel.kraeverUnderniveau) { venter = regel; continue; }
    if (!regel.fg) continue;
    // Dybere niveau vinder; ved samme niveau vinder højeste konfidens.
    const bedreNiveau = !kilde || regel.niveau > kilde.niveau
      || (regel.niveau === kilde.niveau && regel.konfidens > konfidens);
    if (bedreNiveau) { fg = regel.fg; konfidens = regel.konfidens; kilde = regel; }
  }

  // L3 "Udvendigt" flytter kun belysning — ikke alt andet.
  if (fg === 'lys_ude' && kilde && kilde.niveau === 3) {
    const harLys = tags.some((t) => /L0\/1 Lys|L2 .*belysning/i.test(t));
    if (!harLys) { fg = null; konfidens = 0; kilde = null; }
  }

  if (!rolle) rolle = 'bimaaler';

  /* Rollen kender faggruppen, selv når tagget ikke sætter den.
   *
   * "L2 OK Tank" og "L2 Uspecificeret lejemål" sætter rollen til lejer, men
   * ingen faggruppe — og målepunktet endte derfor i Øvrigt. Det ramte 198
   * OK Tank-målere, som hverken er øvrigt eller uforklaret: de er lejere, og
   * lejerforbrug trækkes ud af butikkens eget nøgletal. Samme gælder
   * solcellemålere, hvor rollen er produktion. */
  if (!fg && rolle === 'lejer') { fg = 'lejere'; konfidens = 1; }
  if (!fg && rolle === 'solceller') { fg = 'solceller'; konfidens = 1; }

  // Underniveauet er fundet — så er det brede tag ikke længere et problem.
  const uafklaret = venter && !kilde;

  return {
    faggruppe: fg || 'oevrigt',
    rolle,
    konfidens: fg ? konfidens : 0,
    kilde: kilde ? `tag-L${kilde.niveau}`
      : uafklaret ? 'mangler-underniveau'
      : rolleKilde ? `tag-L${rolleKilde.niveau}`
      : 'ingen-tag',
    afventer: uafklaret
      ? `${venter.tag} er for bred til at stå alene — målepunktet skal have et L2- eller L4-tag, før faggruppen er afgjort.`
      : null,
    tags,
  };
}

/* ---- Dalux anlægsklassifikation -------------------------------------------
 * Det tekniske anlægsregister, som opgaverne hænges på. `energirelevant`
 * markerer de klasser, der overhovedet kan give en energisag — resten er
 * drift og vedligehold, og hører til på opgavesiden, ikke i energiregnskabet.
 *
 * `antal` er antallet af registrerede anlæg i Dalux på tværs af porteføljen.
 */
export const ANLAEGSKLASSER = [
  // Køl & frys
  { id: '884', kode: '633.021', navn: 'Centralt køleanlæg (konsumkøl)', fg: 'koel_frys', energi: true, antal: 1222 },
  { id: '860', kode: '633.02',  navn: 'Køleanlæg (konsumkøl)',          fg: 'koel_frys', energi: true },
  { id: '862', kode: '633.022', navn: 'Single køleanlæg (konsumkøl)',   fg: 'koel_frys', energi: true },
  { id: '881', kode: '739.032', navn: 'Køle-/frostgondoler',            fg: 'koel_frys', energi: true, antal: 13090 },
  { id: '997', kode: '739.036', navn: 'Køle-/frostgondoler uden overvågning', fg: 'koel_frys', energi: true },
  { id: '880', kode: '739.031', navn: 'Køle-/frostreoler',              fg: 'koel_frys', energi: true, antal: 6589 },
  { id: '996', kode: '739.035', navn: 'Køle-/frostreoler uden overvågning',   fg: 'koel_frys', energi: true },
  { id: '882', kode: '739.033', navn: 'Køle-/frostrum',                 fg: 'koel_frys', energi: true, antal: 3651 },
  { id: '998', kode: '739.037', navn: 'Køle-/frostrum uden overvågning',fg: 'koel_frys', energi: true },
  { id: '781', kode: '(PT)',    navn: 'Tryk køleanlæg',                 fg: 'koel_frys', energi: true },
  // Køleflader / klima
  { id: '899', kode: '553.02',  navn: 'Chillere (komfortkøl)',          fg: 'koeleflader', energi: true, antal: 777 },
  { id: '950', kode: '552.03',  navn: 'Fancolis',                       fg: 'koeleflader', energi: true },
  { id: '991', kode: '572.011', navn: 'Integreret køl',                 fg: 'koeleflader', energi: true },
  { id: '932', kode: '562.06',  navn: 'Lufttæpper',                     fg: 'koeleflader', energi: true, antal: 483 },
  // Ventilation
  { id: '857', kode: '572.01',  navn: 'Ventilationsanlæg',              fg: 'ventilation', energi: true, antal: 1080 },
  { id: '890', kode: '563.08',  navn: 'Varmegenvindingsanlæg',          fg: 'ventilation', energi: true, antal: 283 },
  { id: '901', kode: '574.01',  navn: 'Ventilatorer/udsugning/indblæsning', fg: 'ventilation', energi: true, antal: 1220 },
  { id: '900', kode: '574',     navn: 'Ventilatorer',                   fg: 'ventilation', energi: true },
  { id: '834', kode: '5',       navn: 'VVS- og ventilationsanlæg',      fg: 'ventilation', energi: true },
  // Belysning
  { id: '865', kode: '635.01',  navn: 'Anlæg for almen belysning',      fg: 'lys_inde', energi: true, antal: 323 },
  { id: '867', kode: '636.04',  navn: 'Anlæg for særbelysning',         fg: 'lys_inde', energi: true },
  { id: '866', kode: '635.03',  navn: 'Anlæg for sikkerhedsbelysning',  fg: 'lys_inde', energi: true, antal: 722 },
  { id: '1000',kode: '363.01',  navn: 'Armatur – Almen belysning',      fg: 'lys_inde', energi: true },
  { id: '999', kode: '363',     navn: 'Belysningsarmaturer',            fg: 'lys_inde', energi: true },
  { id: '806', kode: '635',     navn: 'Installationer for belysning',   fg: 'lys_inde', energi: true },
  { id: '799', kode: '602',     navn: 'Belysningsinstallation (udvendig)', fg: 'lys_ude', energi: true },
  // Varme, el
  { id: '843', kode: '563.07',  navn: 'Varmepumpeanlæg (Luft/Luft)',    fg: 'varme_el', energi: true },
  { id: '842', kode: '563.06',  navn: 'Varmepumpeanlæg (Luft/Vand)',    fg: 'varme_el', energi: true },
  { id: '1019',kode: '603.05',  navn: 'Varmekabelanlæg',                fg: 'varme_el', energi: true, antal: 363 },
  { id: '775', kode: '(ET)',    navn: 'El-tracing regnvandsbrønd',      fg: 'varme_el', energi: true },
  // Varme, fjernvarme
  { id: '840', kode: '563.05',  navn: 'Fjernvarmeanlæg',                fg: 'varme_fjern', energi: true },
  { id: '935', kode: '561.05',  navn: 'Varmevekslere',                  fg: 'varme_fjern', energi: true },
  { id: '934', kode: '561.08',  navn: 'Varmtvandsbeholdere (VVB)',      fg: 'varme_fjern', energi: true },
  // CTS og styring
  { id: '819', kode: '662',     navn: 'Central tilstandsstyring (CTS)', fg: 'cts', energi: true },
  { id: '878', kode: '662.01',  navn: 'CTS-anlæg',                      fg: 'cts', energi: true, antal: 519 },
  { id: '877', kode: '661.01',  navn: 'BMS-anlæg',                      fg: 'cts', energi: true, antal: 674 },
  { id: '868', kode: '635.05',  navn: 'Lysstyringsanlæg',               fg: 'cts', energi: true },
  { id: '894', kode: '621.06',  navn: 'Frekvensomformeranlæg',          fg: 'cts', energi: true },
  { id: '779', kode: '(WB)',    navn: 'Brugsvandsstyring',              fg: 'cts', energi: true },
  // Solcellerne har ingen egen klassifikation i Dalux. Anlægsregistret for dem
  // ligger i solcelleplatformen, nøglet på plant_id — ikke på et Dalux-komponent.
  // Det betyder, at en solcellesag ikke kan hænges på et anlæg i Dalux i dag.
  { id: null, kode: '—', navn: 'Solcelleanlæg (findes kun i solcelleplatformen)', fg: 'solceller', energi: true, antal: 84, udenforDalux: true },
  { id: null, kode: '—', navn: 'Invertere (findes kun i solcelleplatformen)',     fg: 'solceller', energi: true, antal: 157, udenforDalux: true },
];

/* Anlæg, der findes i Dalux, men som ikke hører til energiregnskabet.
 * De skaber stadig opgaver — og gentagne fejl her er lige så dyre. */
export const ANLAEG_UDEN_ENERGI = [
  { navn: 'Impulskølere uden overvågning', fg: 'koel_frys', antal: 2375, note: 'Køl uden måling eller overvågning — usynlig for både AK og Enity' },
  { navn: 'Mekaniske porte',               fagomraade: 'Port/Dør', antal: 1953 },
  { navn: 'Ovne',                          fagomraade: 'Andet',    antal: 1755 },
  { navn: 'Dørautomatik',                  fagomraade: 'Port/Dør', antal: 1636 },
  { navn: 'Automatisk branddørlukningsanlæg (ABDL-anlæg)', fagomraade: 'Sikkerhed/Alarm', antal: 1207 },
  { navn: 'Kabling-og X-felter',           fagomraade: 'Lys/El',   antal: 996 },
  { navn: 'Brandslukningsudstyr',          fagomraade: 'Sikkerhed/Alarm', antal: 953 },
  { navn: 'Skadedyrssikring',              fagomraade: 'Skadedyr', antal: 935 },
  { navn: 'Automatisk indbrudsalarmanlæg (AIA-anlæg)', fagomraade: 'Sikkerhed/Alarm', antal: 881 },
  { navn: 'Internt TV-overvågningsanlæg (ITV-anlæg)',  fagomraade: 'Sikkerhed/Alarm', antal: 881 },
  { navn: 'Ballepresser',                  fagomraade: 'Ballepresser', antal: 504 },
  { navn: 'Stablere',                      fagomraade: 'Andet',    antal: 477 },
  { navn: 'Øvrigt, tagværker (tag)',       fagomraade: 'Bygning/Tag', antal: 427 },
  { navn: 'Varslingsanlæg (VAR-anlæg/AVA-anlæg)', fagomraade: 'Sikkerhed/Alarm', antal: 298 },
];

export const ANLAEG_I_ALT = 50000;

/** Anlægsklasser grupperet pr. faggruppe. */
export function anlaegPrFaggruppe() {
  const ud = {};
  for (const a of ANLAEGSKLASSER) (ud[a.fg] ||= []).push(a);
  return ud;
}

/** De målepunkt-tags, der kan lande på en given faggruppe. */
export function tagsForFaggruppe(fg) {
  return TAGMAPPING.filter((t) => t.fg === fg);
}
