/**
 * MODUL 6 - Rapportgenerator (bilag til byggetilladelsesansøgning)
 *
 * Automatiseringsgrad: fuld (templating ud fra de øvrige modulers output).
 *
 * Rapporten er bygget op om ét princip: læseren skal kunne se, hvor hvert
 * eneste tal kommer fra. Derfor
 *   - bærer forsiden og konklusionen forbeholdet om statiker-godkendelse,
 *   - er hvert nøgletal mærket med herkomst (hentet / bekræftet / beregnet /
 *     antaget), og
 *   - slutter rapporten med en kildeliste over samtlige anvendte datapunkter
 *     med kilde og dato.
 *
 * Output er selvstændig HTML med print-styling. Den udskrives til PDF fra
 * browseren (Ctrl/Cmd+P -> Gem som PDF). Vi genererer ikke PDF server-side,
 * fordi det ville kræve en tung afhængighed for et resultat, browseren
 * allerede laver bedre - og fordi rapporten så kan læses direkte i UI'et.
 */

import { samlKilder, kildeStatistik, Herkomst, vaerdiEller, erMangel } from "../lib/kilde.js";
import { tegnTag, undslip } from "../lib/tegning.js";
import { Konklusion } from "./m05-struktur.js";

const HERKOMSTTEKST = {
  [Herkomst.HENTET]: "Hentet",
  [Herkomst.BRUGERBEKRAEFTET]: "Bekræftet af bruger",
  [Herkomst.BEREGNET]: "Beregnet",
  [Herkomst.ANTAGELSE]: "Antagelse",
  [Herkomst.MANGLER]: "Mangler",
};

export const FORBEHOLD_OVERSKRIFT = "Udkast - kræver godkendelse af certificeret statiker";

export const FORBEHOLD_TEKST =
  "Denne rapport er et fagligt underlag, ikke en juridisk gyldig statisk dokumentation. " +
  "Efter dansk praksis (BR18) skal statisk dokumentation for højere konsekvensklasser " +
  "underskrives af en certificeret statiker, og erhvervsbygninger som butikker ligger " +
  "typisk i konsekvensklasse CC2-CC3. Ingen bæreevne-, nettilslutnings- eller " +
  "økonomivurdering i rapporten er endelig eller bindende.";

/**
 * @param {object} sag  samlet resultat fra orchestrator
 * @returns {{html:string, kildeliste:Array, statistik:object}}
 */
export function koer(sag) {
  const m = sag.moduler ?? {};
  const kilder = samlKilder(m).filter((k) => k.kilde !== "ukendt");
  const statistik = kildeStatistik(m);

  const html = byggHtml(sag, m, kilder, statistik);
  return {
    modul: 6,
    navn: "Rapport",
    status: "ok",
    html,
    kildeliste: kilder.map(({ sti, ...k }) => ({ sti, ...k })),
    statistik,
    filnavn: foreslaaFilnavn(m),
  };
}

function foreslaaFilnavn(m) {
  const adr = vaerdiEller(m.m1?.adresse, "adresse")
    .toString().replace(/[^\wæøåÆØÅ]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `solcelleanlæg-${adr}-${new Date().toISOString().slice(0, 10)}.html`;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

function byggHtml(sag, m, kilder, statistik) {
  const adresse = vaerdiEller(m.m1?.adresse, "Adresse ikke oplyst");
  const idag = new Date().toLocaleDateString("da-DK", { year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8">
<title>Solcelleanlæg - ${undslip(adresse)}</title>
<style>${STIL}</style>
</head><body>

<header class="forside">
  <div class="stempel">${undslip(FORBEHOLD_OVERSKRIFT)}</div>
  <h1>Solcelleanlæg på tag</h1>
  <p class="undertitel">Fagligt underlag til ansøgning om byggetilladelse</p>
  <table class="ident">
    <tr><th>Adresse</th><td>${undslip(adresse)}</td></tr>
    <tr><th>Kommune</th><td>${undslip(vaerdiEller(m.m1?.kommune, "Ikke bestemt"))}</td></tr>
    <tr><th>Ansøger</th><td>${undslip(sag.ansoeger ?? "Ikke angivet")}</td></tr>
    <tr><th>Sagsnummer</th><td>${undslip(sag.sagsnummer ?? "Ikke angivet")}</td></tr>
    <tr><th>Udarbejdet</th><td>${idag}</td></tr>
    <tr><th>Værktøj</th><td>Solceller dimensionering v${sag.version ?? "0.1"}</td></tr>
  </table>
  <div class="forbehold">
    <h3>Forbehold</h3>
    <p>${undslip(FORBEHOLD_TEKST)}</p>
    <p>Værktøjet stopper og flager, hvor dokumentation mangler eller er usikker,
       frem for at gætte. Se afsnit 12 for en fuldstændig kildeliste med
       herkomst og dato for hvert anvendt datapunkt.</p>
  </div>
</header>

${afsnitKonklusion(m)}
${afsnitTegning(m)}
${afsnitAnlaeg(m)}
${afsnitProduktion(m)}
${afsnitLast(m)}
${afsnitStatik(m)}
${afsnitNet(m)}
${afsnitBrand(m)}
${afsnitTag(m)}
${afsnitOekonomi(m)}
${afsnitMyndighed(m)}
${afsnitCo2(m)}
${afsnitKilder(kilder, statistik)}
${afsnitTjekliste(m)}

<footer>
  <p><strong>${undslip(FORBEHOLD_OVERSKRIFT)}</strong></p>
  <p>Genereret ${idag}. Rapporten er maskinelt sammenstillet af de moduler, der er
     angivet ved hvert afsnit. Den erstatter ikke projektering, statisk dokumentation
     eller dialog med myndighed og netselskab.</p>
</footer>
</body></html>`;
}

/* --- Afsnit -------------------------------------------------------- */

function afsnitKonklusion(m) {
  const m5 = m.m5, m10 = m.m10;
  const k = m5?.konklusion;
  const klasse = k === Konklusion.INDEN_FOR_KAPACITET ? "god"
    : k === Konklusion.KRAEVER_VURDERING ? "advarsel" : "kritisk";

  const punkter = [];
  if (m.m2?.resultat) {
    punkter.push(`Der kan placeres <strong>${vaerdiEller(m.m2.resultat.antalPaneler, "?")} paneler</strong>
      svarende til <strong>${vaerdiEller(m.m2.resultat.installeretEffektKWp, "?")} kWp</strong>.`);
  }
  if (m.m7?.resultat) {
    punkter.push(`Forventet årsproduktion er <strong>${tal(vaerdiEller(m.m7.resultat.aarsproduktionKWh, 0))} kWh</strong>
      (${vaerdiEller(m.m7.resultat.specifikYdelseKWhPrKWp, "?")} kWh/kWp)
      ${m.m7.resultat.aarsproduktionKWh?.herkomst === Herkomst.ANTAGELSE
        ? '<span class="mærke antagelse">modelleret, ikke hentet fra PVGIS</span>' : ""}.`);
  }
  if (m.m3?.resultat) {
    punkter.push(`Anlægget tilfører <strong>${vaerdiEller(m.m3.resultat.fordeltOverPanelfeltKgPrM2, "?")} kg/m²</strong>
      over panelfeltet.`);
  }
  if (m10) {
    punkter.push(`Brandteknisk: ${undslip(vaerdiEller(m10.resultat?.samletVurdering, "ikke vurderet"))}.`);
  }

  return `<section><h2>1. Konklusion</h2>
  <div class="konklusion ${klasse}">
    <h3>Statisk vurdering: ${undslip(m5?.konklusionstekst ?? "Ikke gennemført")}</h3>
    <p>${undslip(m5?.begrundelse ?? "Den strukturelle vurdering kunne ikke gennemføres.")}</p>
    <p class="fed">${undslip(FORBEHOLD_OVERSKRIFT)}. ${undslip(FORBEHOLD_TEKST)}</p>
  </div>
  <ul class="hovedpunkter">${punkter.map((p) => `<li>${p}</li>`).join("")}</ul>
  ${afsnitAdvarsler(m)}
  </section>`;
}

function afsnitAdvarsler(m) {
  const alle = [];
  for (const [noegle, mod] of Object.entries(m)) {
    for (const a of mod?.advarsler ?? []) alle.push({ modul: mod.navn ?? noegle, tekst: a });
    for (const b of mod?.blokerende ?? []) alle.push({ modul: mod.navn ?? noegle, tekst: b, blokerende: true });
  }
  if (!alle.length) return "";
  return `<div class="advarsler"><h3>Forhold der skal afklares (${alle.length})</h3><ul>
    ${alle.map((a) => `<li${a.blokerende ? ' class="blokerende"' : ""}>
      <span class="modulnavn">${undslip(a.modul)}</span> ${undslip(a.tekst)}</li>`).join("")}
  </ul></div>`;
}

function afsnitTegning(m) {
  const m2 = m.m2;
  if (!m2?.paneler?.length) return "";
  const svg = tegnTag({
    tagpolygonMeter: m2.geometri.tagpolygonMeter,
    paneler: m2.paneler,
    forhindringer: m.m1?.tag?.forhindringer ?? [],
    brandveje: m.m10?.brandveje ?? [],
    panelTab: m.m8?.panelTab ?? [],
  }, { bredde: 760, visSkygge: Boolean(m.m8?.panelTab?.length) });

  return `<section class="brydside"><h2>2. Tagtegning med panelplacering</h2>
  <figure>${svg}
  <figcaption>Tagflade set ovenfra, nord opad. Målene er tagets ydre omrids.
    ${m.m8?.panelTab?.length ? "Panelerne er farvet efter skyggetab (modul 8): mørkeblå under 3 %, grøn 3-10 %, orange 10-20 %, rød over 20 %." : ""}
    ${m.m10?.brandveje?.length ? "Stiplede felter er de brandveje, modul 10 kræver friholdt." : ""}
    Tegningen er en principtegning til ansøgningen og erstatter ikke en montageplan.</figcaption>
  </figure></section>`;
}

function afsnitAnlaeg(m) {
  const m2 = m.m2;
  if (!m2?.resultat) return "";
  return `<section><h2>3. Anlæg og layout</h2>
  ${dpTabel([
    ["Antal paneler", m2.resultat.antalPaneler],
    ["Installeret effekt", m2.resultat.installeretEffektKWp],
    ["Panelareal", m2.resultat.panelArealM2],
    ["Tagareal", m2.resultat.tagarealM2],
    ["Udnyttelsesgrad af taget", m2.resultat.udnyttelsesgradPct],
    ["Antal rækker", m2.resultat.antalRaekker],
  ])}
  <h3>Forudsætninger for layoutet</h3>
  ${dpTabel([
    ["Paneltype", m2.forudsaetninger.paneltype],
    ["Montagesystem", m2.forudsaetninger.montagesystem],
    ["Orientering", m2.forudsaetninger.orientering],
    ["Hældning", m2.forudsaetninger.haeldningGrader],
    ["Mindste afstand til tagkant", m2.forudsaetninger.minAfstandTagkantM],
    ["Rækkeafstand", m2.forudsaetninger.raekkeafstandM],
  ])}</section>`;
}

function afsnitProduktion(m) {
  const m7 = m.m7, m8 = m.m8;
  if (!m7?.resultat) return "";
  const maaneder = vaerdiEller(m7.resultat.maanedligKWh, null);
  return `<section><h2>4. Produktion og skygge</h2>
  ${m7.datakilde?.herkomst === Herkomst.ANTAGELSE
    ? `<p class="note advarselnote">Produktionstallet er <strong>modelleret internt</strong>, ikke hentet fra PVGIS.
       ${undslip(m7.datakilde.note ?? "")} Det skal verificeres, før rapporten bruges i en ansøgning.</p>` : ""}
  ${dpTabel([
    ["Datakilde", m7.datakilde],
    ["Årsproduktion", m7.resultat.aarsproduktionKWh],
    ["Specifik ydelse", m7.resultat.specifikYdelseKWhPrKWp],
    ["Systemtab", m7.forudsaetninger.systemtabPct],
    ["Degradering", m7.forudsaetninger.degraderingPctPrAar],
    ["Produktion sidste år i levetiden", m7.resultat.produktionAarSidsteKWh],
  ])}
  ${maaneder ? maanedTabel(maaneder) : ""}
  ${m8 ? `<h3>Skyggeanalyse</h3>
    ${m8.daekning?.herkomst === Herkomst.MANGLER
      ? `<p class="note advarselnote">${undslip(m8.daekning.note ?? m8.daekning.kilde)}</p>` : ""}
    ${dpTabel([
      ["Samlet skyggetab", m8.resultat.samletSkyggetabPct],
      ["Værste panel", m8.resultat.vaersteePanelPct],
      ["Paneler over tærskel", m8.resultat.antalPanelerOverTaerskel],
    ])}
    ${m8.justeringsforslag?.length
      ? `<h4>Justeringsforslag sendt til layoutmodulet</h4><ul>${
          m8.justeringsforslag.map((f) => `<li>${undslip(f.beskrivelse)}</li>`).join("")}</ul>` : ""}` : ""}
  </section>`;
}

function afsnitLast(m) {
  const m3 = m.m3;
  if (!m3?.resultat) return "";
  return `<section class="brydside"><h2>5. Vægt- og lastberegning</h2>
  <h3>Egenlast</h3>
  ${dpTabel([
    ["Panelvægt i alt", m3.egenlast.panelvaegtKg],
    ["Montagesystem", m3.egenlast.montagevaegtKg],
    ["Egenlast uden ballast", m3.egenlast.egenlastUdenBallastKg],
  ])}
  ${m3.vindlast?.peakhastighedstrykQpKNPrM2 ? `<h3>Vindlast (EN 1991-1-4 med dansk anneks)</h3>
  ${dpTabel([
    ["Grundvindhastighed vb,0", m3.vindlast.grundvindhastighedVb0],
    ["Terrænkategori", m3.forudsaetninger.terraenkategori],
    ["Middelvind vm(z)", m3.vindlast.middelvindVmMPrS],
    ["Peakhastighedstryk qp(z)", m3.vindlast.peakhastighedstrykQpKNPrM2],
    ["Løftekoefficient cf", m3.vindlast.loeftekoefficientCf],
    ["Løft pr. panel", m3.vindlast.loeftPrPanelKN],
  ])}
  <p class="formel">qp(z) = [1 + 7·Iv(z)] · ½ · ρ · vm(z)²&nbsp;&nbsp;&nbsp;
     vm(z) = cr(z) · co(z) · vb&nbsp;&nbsp;&nbsp; cr(z) = kr · ln(z/z0)</p>` : ""}
  ${m3.ballast?.samletKg ? `<h3>Ballast</h3>
  ${dpTabel([
    ["Indre zone", m3.ballast.indreZoneKgPrPanel],
    ["Kantzone", m3.ballast.kantzoneKgPrPanel],
    ["Hjørnezone", m3.ballast.hjoernezoneKgPrPanel],
    ["Ballast i alt", m3.ballast.samletKg],
  ])}` : ""}
  <h3>Snelast (EN 1991-1-3)</h3>
  ${dpTabel([
    ["Karakteristisk terrænværdi sk", m3.snelast.karakteristiskTerraenvaerdiKNPrM2],
    ["Formfaktor μ", m3.snelast.formfaktorMu],
    ["Dimensionerende snelast", m3.snelast.dimensionerendeKNPrM2],
  ])}
  <h3>Resulterende last</h3>
  ${dpTabel([
    ["Samlet vægt", m3.resultat.samletVaegtKg],
    ["Fordelt over panelfeltet", m3.resultat.fordeltOverPanelfeltKgPrM2],
    ["Fordelt over hele taget", m3.resultat.fordeltOverHeleTagetKgPrM2],
    ["Egenlast", m3.resultat.egenlastKNPrM2],
    ["Punktlast pr. montagepunkt", m3.resultat.punktlastPrMontagepunktKg],
    ["Antal montagepunkter", m3.resultat.montagepunkterIAlt],
  ])}
  ${liste("Forbehold til lastberegningen", m3.forbehold)}
  </section>`;
}

function afsnitStatik(m) {
  const m5 = m.m5, m4 = m.m4;
  if (!m5) return "";
  return `<section class="brydside"><h2>6. Strukturel vurdering</h2>
  <div class="konklusion ${m5.konklusion === Konklusion.INDEN_FOR_KAPACITET ? "god"
    : m5.konklusion === Konklusion.KRAEVER_VURDERING ? "advarsel" : "kritisk"}">
    <h3>${undslip(m5.konklusionstekst ?? "")}</h3>
    <p>${undslip(m5.begrundelse ?? "")}</p>
  </div>
  ${m5.dokumenteretKapacitet ? dpTabel([
    ["Dokumenteret bæreevne", m5.dokumenteretKapacitet],
    ["Tilført last", m5.tilfoejetLast?.kNPrM2],
    ["Udnyttelsesgrad", m5.udnyttelsesgrad],
    ["Restkapacitet", m5.restkapacitet],
  ]) : ""}
  ${m5.grundlagsoversigt?.length ? `<h3>Grundlag for konklusionen</h3>
  <p class="note">Tabellen viser, hvilke tal i konklusionen der stammer fra en bekræftet
     kilde, og hvilke der er beregnet eller antaget.</p>
  <table class="data"><thead><tr><th>Stoerrelse</th><th>Vaerdi</th><th>Herkomst</th><th>Kilde</th></tr></thead><tbody>
  ${m5.grundlagsoversigt.map((g) => `<tr${g.kritisk ? ' class="kritisk-række"' : ""}>
    <td>${undslip(g.navn)}</td><td class="tal">${undslip(String(g.vaerdi ?? "-"))} ${undslip(paenEnhed(g.enhed))}</td>
    <td>${maerke(g.herkomst)}</td><td class="lille">${undslip(g.kilde)}${
      g.reference ? `<br><span class="lille">${undslip(g.reference)}</span>` : ""}</td></tr>`).join("")}
  </tbody></table>` : ""}
  ${m4?.dokumenter?.length ? `<h3>Anvendt dokumentation (modul 4)</h3>
  <table class="data"><thead><tr><th>Dokument</th><th>Sag/tegning</th><th>Dato</th><th>Bekræftet</th></tr></thead><tbody>
  ${m4.dokumenter.map((d) => `<tr><td>${undslip(d.titel)}</td>
    <td class="lille">${undslip([d.sagsnummer, d.tegningsnummer, d.revision && `rev. ${d.revision}`].filter(Boolean).join(" / ") || "-")}</td>
    <td>${undslip(d.dokumentdato ?? "-")}</td>
    <td>${d.bekraeftet ? '<span class="mærke bekræftet">Ja</span>' : '<span class="mærke mangler">Nej - indgår ikke</span>'}</td></tr>`).join("")}
  </tbody></table>` : ""}
  ${liste("Forbehold", m5.forbehold)}
  ${m5.naesteSkridt ? liste("Næste skridt", m5.naesteSkridt) : ""}
  ${m5.handlemuligheder?.length ? liste("Handlemuligheder hvis lasten skal ned", m5.handlemuligheder) : ""}
  </section>`;
}

function afsnitNet(m) {
  const m9 = m.m9;
  if (!m9) return "";
  return `<section><h2>7. Nettilslutning og elinstallation</h2>
  ${dpTabel([
    ["Netselskab", m9.netselskab],
    ["Kapacitet i nettet", m9.kapacitet],
    ["Forventet vekselstrøm", m9.tilslutningsform?.forventetVekselstroemA],
    ["Eksisterende hovedsikring", m9.tilslutningsform?.hovedsikringA],
    ["Vurdering", m9.tilslutningsform?.vurdering],
  ])}
  ${m9.strengdesign ? `<h3>Strengdesign (forslag)</h3>
  ${dpTabel([
    ["Antal strenge", m9.strengdesign.antalStrenge],
    ["Paneler pr. streng", m9.strengdesign.panelerPrStreng],
  ])}
  ${liste(null, m9.strengdesign.bemaerkninger)}` : ""}
  ${m9.teknikrum ? `<h3>Teknikrum</h3>
  ${dpTabel([
    ["Anbefalet placering (lokalt plan)", m9.teknikrum.anbefaletPlaceringMeter],
    ["Længste DC-træk", m9.teknikrum.laengsteDcTraekM],
  ])}
  ${liste("Krav til rummet", m9.teknikrum.krav)}` : ""}
  <h3>${undslip(m9.netkontekst.overskrift)}</h3>
  ${liste(null, m9.netkontekst.punkter)}
  <p class="note advarselnote">${undslip(m9.netkontekst.forbehold)}</p>
  ${liste("Næste skridt", m9.naesteSkridt)}
  </section>`;
}

function afsnitBrand(m) {
  const m10 = m.m10;
  if (!m10?.konstateringer) return "";
  return `<section class="brydside"><h2>8. Brandsikkerhed</h2>
  <p>${undslip(vaerdiEller(m10.resultat.samletVurdering, ""))}</p>
  <table class="data"><thead><tr><th>Forhold</th><th>Krav</th><th>Status</th><th>Bemærkning</th></tr></thead><tbody>
  ${m10.konstateringer.map((k) => `<tr>
    <td>${undslip(k.navn)}<br><span class="lille">${undslip(k.grundlag)}</span></td>
    <td class="tal">${k.kravM != null ? `${k.kravM} m` : "-"}</td>
    <td>${statusMaerke(k.status)}</td>
    <td class="lille">${undslip(k.bemaerkning)}</td></tr>`).join("")}
  </tbody></table>
  <p class="note advarselnote">${undslip(m10.regelgrundlag?.note ?? "")}</p>
  </section>`;
}

function afsnitTag(m) {
  const m11 = m.m11;
  if (!m11) return "";
  return `<section><h2>9. Tagets tilstand og montagetype</h2>
  ${dpTabel([
    ["Tagdækningsmateriale", m11.tagdaekningsmateriale],
    ["Opførelsesår", m11.opfoerelsesaar],
    ["Om-/tilbygningsår", m11.ombygningsaar],
    ["Tagets alder", m11.tagAlderAar],
    ["Forventet levetid", m11.forventetLevetidAar],
    ["Restlevetid", m11.restlevetidAar],
    ["Anlæggets levetid", m11.anlaegLevetidAar],
    ["Vurdering", m11.vurdering],
  ])}
  <h3>Montagetype: ${undslip(m11.montageOgGaranti.montagetype)}</h3>
  <p><strong>Påvirkning af tagmembranen:</strong> ${undslip(m11.montageOgGaranti.paavirkning)}</p>
  <p><strong>Anbefaling:</strong> ${undslip(m11.montageOgGaranti.anbefaling)}</p>
  <p class="note advarselnote">${undslip(m11.fysiskTilstand?.note ?? "")}</p>
  ${liste("Tjekliste inden montage", m11.tjekliste)}
  </section>`;
}

function afsnitOekonomi(m) {
  const m12 = m.m12;
  if (!m12?.resultat) return "";
  return `<section class="brydside"><h2>10. Økonomi og egetforbrug</h2>
  ${dpTabel([
    ["Årsforbrug", m12.forbrug.aarsforbrugKWh],
    ["Forbrugsprofil", m12.forbrug.profilkilde],
    ["Egetforbrug", m12.egetforbrug.egetforbrugKWh],
    ["Egetforbrugsandel af produktion", m12.egetforbrug.egetforbrugsandelPct],
    ["Dækning af eget elforbrug", m12.egetforbrug.daekningsgradPct],
    ["Overskud til nettet", m12.egetforbrug.overskudTilNettetKWh],
  ])}
  <h3>Overslag</h3>
  ${dpTabel([
    ["Investering", m12.resultat.investeringKr],
    ["Besparelse år 1", m12.resultat.aarligBesparelseAar1Kr],
    ["Drift pr. år", m12.resultat.driftPrAarKr],
    ["Tilbagebetalingstid", m12.resultat.tilbagebetalingstidAar],
    ["Nutidsværdi", m12.resultat.nutidsvaerdiKr],
    ["Intern rente", m12.resultat.internRentePct],
    ["LCOE", m12.resultat.lcoeKrPrKWh],
  ])}
  <h3>Prisantagelser (manuelt vedligeholdt)</h3>
  ${dpTabel([
    ["Elpris, køb", m12.forudsaetninger.elprisKoebKrPrKWh],
    ["Elpris, salg", m12.forudsaetninger.elprisSalgKrPrKWh],
    ["CAPEX", m12.forudsaetninger.capexKrPrKWp],
    ["Kalkulationsrente", m12.forudsaetninger.kalkulationsrentePct],
    ["Elprisstigning", m12.forudsaetninger.elprisstigningPctPrAar],
  ])}
  <p class="note advarselnote">${undslip(m12.forbehold)}</p>
  </section>`;
}

function afsnitMyndighed(m) {
  const m13 = m.m13;
  if (!m13) return "";
  return `<section><h2>11. Myndighed og omgivelser</h2>
  ${dpTabel([
    ["Lokalplan", m13.lokalplan],
    ["Solcelle-bestemmelser", m13.solcelleBestemmelser],
    ["Bevarings-/fredningsstatus", m13.bevaringsstatus],
    ["Afstand til skel", m13.naboorientering?.mindsteAfstandTilSkelM],
    ["Naboorientering", m13.naboorientering?.anbefaling],
  ])}
  ${m13.lokalplaner?.length ? `<table class="data"><thead><tr><th>Plan</th><th>Vedtaget</th><th>Anvendelse</th></tr></thead><tbody>
  ${m13.lokalplaner.map((p) => `<tr><td>${undslip(p.navn ?? p.plannummer ?? "-")}</td>
    <td>${undslip(p.vedtagetDato ?? "-")}</td><td>${undslip(p.anvendelse ?? "-")}</td></tr>`).join("")}
  </tbody></table>` : ""}
  ${liste("Tjekliste", m13.tjeklisteMyndighed)}
  </section>`;
}

function afsnitCo2(m) {
  const m14 = m.m14;
  if (!m14?.co2) return "";
  return `<section><h2>12. CO₂ og drift</h2>
  ${dpTabel([
    ["Emissionsfaktor", m14.co2.emissionsfaktorGramPrKWh],
    ["Årlig CO₂-reduktion", m14.co2.aarligReduktionTon],
    ["CO₂-reduktion over levetiden", m14.co2.reduktionOverLevetidTon],
  ])}
  <p class="note advarselnote">${undslip(m14.co2.forbehold)}</p>
  <h3>Nøgletal til driftsovervågning</h3>
  <table class="data"><thead><tr><th>Nøgletal</th><th>Enhed</th><th>Formål</th></tr></thead><tbody>
  ${m14.overvaagning.eksport.noegletalAtOvervaage.map((n) => `<tr><td>${undslip(n.navn)}</td>
    <td>${undslip(paenEnhed(n.enhed))}</td><td class="lille">${undslip(n.formaal)}</td></tr>`).join("")}
  </tbody></table></section>`;
}

function afsnitKilder(kilder, statistik) {
  const f = statistik.fordeling;
  const raekker = kilder
    .slice()
    .sort((a, b) => a.kilde.localeCompare(b.kilde, "da") || a.sti.localeCompare(b.sti));

  return `<section class="brydside"><h2>13. Kildeliste</h2>
  <p>Alle datapunkter i rapporten med kilde, herkomst og dato. Herkomsten er
     afgørende for, hvor meget vægt et tal kan bære:</p>
  <ul class="forklaring">
    <li>${maerke(Herkomst.HENTET)} hentet maskinelt fra en navngiven datakilde (${f.hentet})</li>
    <li>${maerke(Herkomst.BRUGERBEKRAEFTET)} læst af et dokument og udtrykkeligt bekræftet (${f.brugerbekraeftet})</li>
    <li>${maerke(Herkomst.BEREGNET)} udledt af andre datapunkter i værktøjet (${f.beregnet})</li>
    <li>${maerke(Herkomst.ANTAGELSE)} manuelt vedligeholdt konfiguration (${f.antagelse})</li>
    <li>${maerke(Herkomst.MANGLER)} kunne ikke fremskaffes - flaget frem for gættet (${f.mangler})</li>
  </ul>
  <table class="data kildeliste"><thead><tr><th>Størrelse</th><th>Værdi</th><th>Herkomst</th><th>Kilde</th><th>Dato</th></tr></thead><tbody>
  ${raekker.map((k) => `<tr><td class="lille">${undslip(k.sti)}</td>
    <td class="tal lille">${undslip(kortVaerdi(k.vaerdi))} ${undslip(paenEnhed(k.enhed))}</td>
    <td>${maerke(k.herkomst)}</td>
    <td class="lille">${undslip(k.kilde)}${k.reference ? `<br>${undslip(String(k.reference).slice(0, 120))}` : ""}${
      k.note ? `<br><em>${undslip(String(k.note).slice(0, 200))}</em>` : ""}</td>
    <td class="lille">${undslip(k.dato ?? "")}</td></tr>`).join("")}
  </tbody></table></section>`;
}

function afsnitTjekliste(m) {
  const punkter = [
    "Situationsplan med bygningens placering på grunden, målsat",
    "Facadetegninger, der viser anlæggets synlighed og højde over tagfladen",
    "Tagplan med panelfelter, brandveje, kabelføring og teknikrum",
    "Ejendomsoplysninger: matrikelnummer, ejerlav, ejerforhold",
    "Fuldmagt fra ejer, hvis ansøger ikke selv er ejer",
    "Statisk dokumentation underskrevet af certificeret statiker (konsekvensklasse afklaret)",
    "Redegørelse for brandforhold, herunder nødafbryder og markering til redningsberedskabet",
    "Erklæring om, at BR18's kapitel om konstruktioner er overholdt",
    "Eventuel dispensationsansøgning, hvis lokalplan eller bevaringsbestemmelser kræver det",
    "Dokumentation for netselskabets tilslutningsaftale, hvis den foreligger",
  ];
  const mangler = [];
  if (m.m5?.konklusion !== Konklusion.INDEN_FOR_KAPACITET) {
    mangler.push("Den strukturelle vurdering er ikke gået igennem - se afsnit 6.");
  }
  if (m.m4?.status !== "ok") {
    mangler.push("Der er ikke bekræftet statisk dokumentation - se afsnit 6.");
  }
  if (m.m9?.netselskab?.herkomst !== Herkomst.BRUGERBEKRAEFTET) {
    mangler.push("Netselskabet er ikke bekræftet - se afsnit 7.");
  }

  return `<section><h2>14. Checkliste til ansøgningen</h2>
  <p>Ud over denne rapport kræver en byggetilladelsesansøgning typisk:</p>
  <ul class="tjekliste">${punkter.map((p) => `<li>${undslip(p)}</li>`).join("")}</ul>
  ${mangler.length ? `<div class="advarsler"><h3>Udestående, før ansøgningen kan indsendes</h3>
    <ul>${mangler.map((x) => `<li>${undslip(x)}</li>`).join("")}</ul></div>` : ""}
  </section>`;
}

/* --- Byggeklodser --------------------------------------------------- */

function dpTabel(raekker) {
  const gyldige = raekker.filter(([, dp]) => dp != null);
  if (!gyldige.length) return "";
  return `<table class="data"><tbody>${gyldige.map(([navn, dp]) => `<tr>
    <th>${undslip(navn)}</th>
    <td class="tal">${undslip(kortVaerdi(dp.vaerdi))} ${undslip(paenEnhed(dp.enhed))}</td>
    <td>${maerke(dp.herkomst)}</td>
    <td class="lille">${undslip(dp.kilde)}${dp.reference ? `<br>${undslip(String(dp.reference).slice(0, 100))}` : ""}${
      dp.note ? `<br><em>${undslip(String(dp.note).slice(0, 260))}</em>` : ""}</td>
  </tr>`).join("")}</tbody></table>`;
}

function maanedTabel(maaneder) {
  const navne = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  const max = Math.max(...maaneder, 1);
  return `<h4>Månedsfordeling</h4><table class="data måned"><thead><tr>${
    navne.map((n) => `<th>${n}</th>`).join("")}</tr></thead><tbody><tr>${
    maaneder.map((v) => `<td class="tal">${tal(v)}</td>`).join("")}</tr><tr class="søjler">${
    maaneder.map((v) => `<td><span class="soejle" style="height:${Math.round((v / max) * 34) + 2}px"></span></td>`).join("")
  }</tr></tbody></table><p class="lille">kWh pr. måned</p>`;
}

function liste(overskrift, punkter) {
  if (!punkter?.length) return "";
  return `${overskrift ? `<h4>${undslip(overskrift)}</h4>` : ""}<ul>${
    punkter.map((p) => `<li>${undslip(p)}</li>`).join("")}</ul>`;
}

function maerke(herkomst) {
  return `<span class="mærke ${herkomst}">${undslip(HERKOMSTTEKST[herkomst] ?? herkomst)}</span>`;
}

function statusMaerke(status) {
  const klasse = status === "opfyldt" ? "bekraeftet" : status === "ikke-opfyldt" ? "mangler" : "antagelse";
  const tekst = status === "opfyldt" ? "Opfyldt" : status === "ikke-opfyldt" ? "Ikke opfyldt" : "Skal afklares";
  return `<span class="mærke ${klasse}">${tekst}</span>`;
}

function kortVaerdi(v) {
  if (v == null) return "-";
  if (typeof v === "number") return tal(v);
  if (typeof v === "object") {
    if ("x" in v && "y" in v) return `x ${v.x}, y ${v.y}`;
    if (Array.isArray(v)) return `${v.length} post(er)`;
    return Object.entries(v).slice(0, 3).map(([k, x]) => `${k}: ${x}`).join(", ");
  }
  return String(v);
}

/** m2 -> m\u00B2, CO2 -> CO\u2082 osv., så enheder ser rigtige ud i rapporten. */
export function paenEnhed(enhed) {
  if (!enhed) return "";
  return String(enhed)
    .replace(/m2\b/g, "m\u00B2").replace(/m3\b/g, "m\u00B3")
    .replace(/CO2/g, "CO\u2082");
}

const tal = (n) => typeof n === "number"
  ? n.toLocaleString("da-DK", { maximumFractionDigits: 2 })
  : String(n);

/* --- Styling --------------------------------------------------------- */

const STIL = `
:root{--ink:#1b2130;--muted:#5c6577;--linje:#d8d4c8;--bg:#ffffff;
  --god:#1e6f47;--godbg:#e6f2ea;--advarsel:#8a5a00;--advarselbg:#fbf0dc;
  --kritisk:#9c2d22;--kritiskbg:#fbe8e5;--blå:#1d3f6e;}
*{box-sizing:border-box}
body{font-family:"Source Serif 4",Georgia,serif;color:var(--ink);background:var(--bg);
  margin:0 auto;max-width:820px;padding:32px 28px 60px;line-height:1.55;font-size:14px}
h1{font-size:30px;margin:.2em 0 .1em;line-height:1.15}
h2{font-size:20px;margin:2.2em 0 .6em;padding-bottom:.25em;border-bottom:2px solid var(--ink)}
h3{font-size:16px;margin:1.5em 0 .4em}
h4{font-size:14px;margin:1.2em 0 .3em;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
p{margin:.5em 0}
.undertitel{font-size:16px;color:var(--muted);margin-top:0}
.forside{border-bottom:3px double var(--ink);padding-bottom:22px;margin-bottom:8px}
.stempel{display:inline-block;background:var(--kritiskbg);color:var(--kritisk);
  border:2px solid var(--kritisk);padding:6px 12px;font-weight:700;font-size:12px;
  text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;font-family:system-ui,sans-serif}
.ident{border-collapse:collapse;margin:16px 0;width:100%}
.ident th{text-align:left;width:150px;color:var(--muted);font-weight:600;padding:3px 10px 3px 0;vertical-align:top}
.ident td{padding:3px 0}
.forbehold{background:var(--kritiskbg);border-left:4px solid var(--kritisk);padding:12px 16px;margin-top:18px}
.forbehold h3{margin-top:0;color:var(--kritisk)}
.konklusion{padding:14px 18px;margin:14px 0;border-left:5px solid}
.konklusion h3{margin-top:0}
.konklusion.god{background:var(--godbg);border-color:var(--god)}
.konklusion.god h3{color:var(--god)}
.konklusion.advarsel{background:var(--advarselbg);border-color:var(--advarsel)}
.konklusion.advarsel h3{color:var(--advarsel)}
.konklusion.kritisk{background:var(--kritiskbg);border-color:var(--kritisk)}
.konklusion.kritisk h3{color:var(--kritisk)}
.fed{font-weight:600}
.hovedpunkter{padding-left:20px}
.hovedpunkter li{margin:.35em 0}
.advarsler{background:#fbf7ec;border:1px solid var(--linje);padding:10px 16px;margin:16px 0}
.advarsler h3{margin-top:.3em;font-size:14px}
.advarsler ul{padding-left:18px;margin:.4em 0}
.advarsler li{margin:.3em 0;font-size:13px}
.advarsler li.blokerende{color:var(--kritisk);font-weight:600}
.modulnavn{display:inline-block;background:#eee9dc;color:var(--muted);font-size:10px;
  padding:1px 6px;border-radius:3px;margin-right:6px;font-family:system-ui,sans-serif}
table.data{border-collapse:collapse;width:100%;margin:.6em 0;font-size:12.5px}
table.data th,table.data td{border-bottom:1px solid var(--linje);padding:5px 8px;
  text-align:left;vertical-align:top}
table.data thead th{background:#f4f1ea;font-size:11px;text-transform:uppercase;
  letter-spacing:.04em;color:var(--muted);font-family:system-ui,sans-serif}
table.data tbody th{width:34%;font-weight:600}
td.tal{font-variant-numeric:tabular-nums;white-space:nowrap}
.lille{font-size:11px;color:var(--muted);line-height:1.35}
.kritisk-række{background:var(--advarselbg)}
.mærke{display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;
  font-family:system-ui,sans-serif;font-weight:600;white-space:nowrap}
.mærke.hentet{background:#e3eef8;color:#1d4f7e}
.mærke.brugerbekræftet,.mærke.bekræftet{background:var(--godbg);color:var(--god)}
.mærke.beregnet{background:#eee9dc;color:#6b5b3a}
.mærke.antagelse{background:var(--advarselbg);color:var(--advarsel)}
.mærke.mangler{background:var(--kritiskbg);color:var(--kritisk)}
.note{font-size:12px;color:var(--muted);border-left:3px solid var(--linje);padding-left:10px}
.advarselnote{border-color:var(--advarsel);color:var(--advarsel)}
.formel{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:#f4f1ea;
  padding:8px 10px;color:var(--muted)}
figure{margin:12px 0}
figcaption{font-size:11.5px;color:var(--muted);margin-top:6px}
svg{max-width:100%;height:auto;border:1px solid var(--linje)}
.måned td,.måned th{text-align:center;padding:3px 2px;font-size:11px}
.søjler td{vertical-align:bottom;height:40px}
.søjle{display:block;width:60%;margin:0 auto;background:var(--blå)}
ul.forklaring{list-style:none;padding-left:0;font-size:12px}
ul.forklaring li{margin:.3em 0}
ul.tjekliste{list-style:none;padding-left:0}
ul.tjekliste li:before{content:"\\2610";margin-right:8px;color:var(--muted)}
ul.tjekliste li{margin:.3em 0}
footer{margin-top:40px;padding-top:14px;border-top:2px solid var(--ink);
  font-size:11.5px;color:var(--muted)}
@media print{
  body{max-width:none;padding:0;font-size:11pt}
  .brydside{break-before:page}
  section{break-inside:auto}
  table,figure,.konklusion{break-inside:avoid}
  h2{break-after:avoid}
  @page{margin:18mm 16mm}
}`;
