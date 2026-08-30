/**
 * UI for solcelle-dimensioneringsvaerktoejet.
 *
 * Al kommunikation gaar gennem serverens /api - browseren kalder ikke selv
 * PVGIS eller Datafordeleren, dels fordi PVGIS ikke saetter CORS-headere,
 * dels fordi legitimationsoplysninger ikke hoerer hjemme i en browser.
 */

const $ = (id) => document.getElementById(id);
const el = (tag, klasse, tekst) => {
  const n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (tekst != null) n.textContent = tekst;
  return n;
};

let konfiguration = null;
let sidsteSag = null;
let dokumentTaeller = 0;

/* ------------------------------------------------------------------ */
/* Opstart                                                             */
/* ------------------------------------------------------------------ */

init().catch((f) => visStatus(`Kunne ikke starte: ${f.message}`, true));

async function init() {
  const [status, konf] = await Promise.all([
    hent("/api/status"),
    hent("/api/konfiguration"),
  ]);
  konfiguration = konf;

  visKildestatus(status.datakilder);
  udfyldKommuner(konf.kommuner);
  udfyldValg("paneltype", konf.paneltyper, (p) => `${p.navn} (${p.effektWp} Wp)`);
  udfyldValg("montagesystem", konf.montagesystemer, (m) => m.navn);

  bindHaendelser();
}

function visKildestatus(kilder) {
  const boks = $("kildestatus");
  boks.replaceChildren(...kilder.map((k) => {
    const n = el("span", `kilde ${k.konfigureret ? "til" : "fra"}`,
      `${k.konfigureret ? "✓" : "✗"} ${k.navn}`);
    n.title = `${k.daekker}${k.vejledning ? `\n\n${k.vejledning}` : ""}`;
    return n;
  }));
}

function udfyldKommuner(kommuner) {
  const s = $("kommunekode");
  for (const [kode, navn] of Object.entries(kommuner).sort((a, b) => a[1].localeCompare(b[1], "da"))) {
    s.append(new Option(`${navn} (${kode})`, kode));
  }
}

function udfyldValg(id, liste, tekst) {
  const s = $(id);
  s.replaceChildren(...liste.map((p) => new Option(tekst(p), p.noegle)));
}

/* ------------------------------------------------------------------ */
/* Haendelser                                                          */
/* ------------------------------------------------------------------ */

function bindHaendelser() {
  $("adresse").addEventListener("input", debounce(soegAdresse, 300));
  $("adresse").addEventListener("blur", () => setTimeout(() => ($("adresseforslag").hidden = true), 180));

  $("tagtype").addEventListener("change", () => {
    const skraat = $("tagtype").value === "skraat";
    $("haeldningFelt").hidden = !skraat;
    $("azimutFelt").hidden = !skraat;
    $("montagesystem").value = skraat ? "skraatag" : "ballast";
  });

  $("kommunekode").addEventListener("change", opdaterArkiv);
  $("eksempelknap").addEventListener("click", indsaetEksempel);
  $("tilfoejdok").addEventListener("click", () => tilfoejDokument());
  $("koerknap").addEventListener("click", koerAnalyse);
  $("rapportknap").addEventListener("click", aabnRapport);
  $("jsonknap").addEventListener("click", hentJson);
}

async function soegAdresse() {
  const q = $("adresse").value.trim();
  const liste = $("adresseforslag");
  if (q.length < 3) { liste.hidden = true; return; }

  const svar = await hent(`/api/adresseforslag?q=${encodeURIComponent(q)}`).catch((f) => ({ fejl: f.message }));
  const forslag = svar.forslag ?? [];

  if (svar.fejl && !forslag.length) {
    liste.replaceChildren(el("li", "fejl",
      `Adressevælgeren svarede ikke (${svar.fejl}). Indtast koordinater og tagpolygon manuelt.`));
    liste.hidden = false;
    return;
  }
  if (!forslag.length) { liste.hidden = true; return; }

  liste.replaceChildren(...forslag.map((f) => {
    const n = el("li", null, f.tekst);
    n.addEventListener("mousedown", () => {
      $("adresse").value = f.tekst;
      if (f.lat != null) $("lat").value = f.lat;
      if (f.lon != null) $("lon").value = f.lon;
      if (f.kommunekode) { $("kommunekode").value = String(Number(f.kommunekode)); opdaterArkiv(); }
      liste.hidden = true;
    });
    return n;
  }));
  liste.hidden = false;
}

function indsaetEksempel() {
  $("lat").value = 56.15;
  $("lon").value = 10.21;
  $("tagpolygon").value = JSON.stringify(
    [[10.21, 56.15], [10.2108, 56.15], [10.2108, 56.1504], [10.21, 56.1504]]);
  if (!$("adresse").value) $("adresse").value = "Eksempeltag, 8000 Aarhus C";
  if (!$("kommunekode").value) { $("kommunekode").value = "751"; opdaterArkiv(); }
}

/* ------------------------------------------------------------------ */
/* Modul 4 - assisteret arkivsoegning                                  */
/* ------------------------------------------------------------------ */

async function opdaterArkiv() {
  const kode = $("kommunekode").value;
  const boks = $("arkivboks");
  if (!kode) {
    boks.replaceChildren(el("p", "hjaelp", "Vælg kommune ovenfor for at få det rigtige byggesagsarkiv."));
    return;
  }

  const valg = await hent(`/api/arkiv?kommunekode=${kode}`).catch(() => null);
  if (!valg) return;

  boks.replaceChildren();
  const overskrift = el("h4", null, "Byggesagsarkiv");
  boks.append(overskrift);
  boks.append(el("p", "hjaelp", valg.begrundelse));

  const arkiver = valg.begge || !valg.platform
    ? [["filarkiv", "FilArkiv", "https://public.filarkiv.dk/"],
       ["weblager", "WebLager", "https://www.weblager.dk/"]]
    : [[valg.platform, valg.platform === "filarkiv" ? "FilArkiv" : "WebLager",
        valg.platform === "filarkiv" ? "https://public.filarkiv.dk/" : "https://www.weblager.dk/"]];

  const knapper = el("p");
  for (const [noegle, navn, url] of arkiver) {
    const a = el("a", null, `Åbn ${navn} →`);
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    a.style.marginRight = "16px";
    knapper.append(a);

    const b = el("button", "link", `${navn} var det rigtige`);
    b.addEventListener("click", async () => {
      await send("/api/arkiv/bekraeft", { kommunekode: Number(kode), platform: noegle });
      opdaterArkiv();
    });
    knapper.append(b, document.createTextNode("  "));
  }
  boks.append(knapper);

  const ol = el("ol");
  for (const t of [
    "Søg på adressen – eller på matrikelnummeret, hvis adressen ikke giver noget.",
    "Find byggesagen for den rigtige bygning. En ejendom kan have flere bygninger og flere sager.",
    "Led efter statiske beregninger, konstruktionstegninger eller spærplaner.",
    "Kontrollér at tegningen er den gældende revision og dækker netop det tag, panelerne skal ligge på.",
    "Aflæs den dokumenterede nyttelast eller reservekapacitet, og registrér dokumentet herunder.",
  ]) ol.append(el("li", null, t));
  boks.append(ol);

  boks.append(el("p", "hjaelp advarsel",
    "Arkiverne viser kun afsluttede, offentligt tilgængelige sager. En tom søgning betyder " +
    "ikke, at der ikke findes dokumentation – spørg kommunen om aktindsigt, eller spørg ejeren. " +
    "weblager.dk afviser automatiseret adgang, så værktøjet søger ikke selv."));
}

function tilfoejDokument() {
  const nr = ++dokumentTaeller;
  const boks = el("div", "dok");
  boks.dataset.nr = String(nr);

  const fjern = el("button", "sekundaer fjern", "Fjern");
  fjern.addEventListener("click", () => boks.remove());
  boks.append(fjern, el("h4", null, `Dokument ${nr}`));

  const raekke = el("div", "raekke");
  for (const [navn, etiket, type, pladsholder] of [
    ["titel", "Titel", "text", "Statisk beregning, tagkonstruktion"],
    ["sagsnummer", "Sagsnummer", "text", "B-2003-441"],
    ["tegningsnummer", "Tegningsnummer", "text", "K-201"],
    ["revision", "Revision", "text", "C"],
    ["dokumentdato", "Dokumentdato", "date", ""],
    ["aflaestBaereevne", "Aflæst bæreevne", "number", "100"],
  ]) {
    const f = el("div", "felt");
    const l = el("label", null, etiket);
    const i = document.createElement("input");
    i.type = type; i.dataset.felt = navn; i.placeholder = pladsholder;
    if (type === "number") i.step = "any";
    f.append(l, i);
    raekke.append(f);
  }
  const enhedFelt = el("div", "felt");
  enhedFelt.append(el("label", null, "Enhed"));
  const enhed = document.createElement("select");
  enhed.dataset.felt = "aflaestEnhed";
  enhed.append(new Option("kg/m²", "kg/m2"), new Option("kN/m²", "kN/m2"));
  enhedFelt.append(enhed);
  raekke.append(enhedFelt);
  boks.append(raekke);

  boks.append(el("p", "hjaelp advarsel",
    "Alle tre bekræftelser skal sættes. Uden dem indgår dokumentet ikke i den " +
    "strukturelle vurdering – et auto-match må aldrig antages korrekt."));

  for (const [navn, tekst] of [
    ["bekraeftetRigtigBygning", "Jeg bekræfter, at dokumentet gælder netop denne bygning på denne adresse."],
    ["bekraeftetGaeldendeRevision", "Jeg bekræfter, at det er den gældende revision – ikke en ældre udgave eller en senere tilbygning."],
    ["bekraeftetAflaesning", "Jeg bekræfter, at den aflæste bæreevne er læst korrekt af dokumentet."],
  ]) {
    const l = el("label", "afkryds");
    const i = document.createElement("input");
    i.type = "checkbox"; i.dataset.felt = navn;
    l.append(i, document.createTextNode(tekst));
    boks.append(l);
  }

  $("dokumenter").append(boks);
}

function laesDokumenter() {
  return [...document.querySelectorAll(".dok")].map((boks) => {
    const d = { bekraeftetDato: new Date().toISOString().slice(0, 10) };
    for (const felt of boks.querySelectorAll("[data-felt]")) {
      const navn = felt.dataset.felt;
      d[navn] = felt.type === "checkbox" ? felt.checked
        : felt.type === "number" ? (felt.value === "" ? null : Number(felt.value))
        : felt.value || null;
    }
    return d;
  }).filter((d) => d.titel || d.aflaestBaereevne != null);
}

/* ------------------------------------------------------------------ */
/* Analyse                                                             */
/* ------------------------------------------------------------------ */

async function koerAnalyse() {
  const knap = $("koerknap");
  let input;
  try {
    input = samlInput();
  } catch (fejl) {
    visStatus(fejl.message, true);
    return;
  }

  knap.disabled = true;
  visStatus("Kører modulerne …");
  try {
    const sag = await send("/api/analyse", input);
    sidsteSag = sag;
    visResultat(sag);
    visStatus(`Færdig på ${(sag.varighedMs / 1000).toFixed(1)} s`);
    $("resultat").hidden = false;
    $("resultat").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (fejl) {
    visStatus(`Analysen fejlede: ${fejl.message}`, true);
  } finally {
    knap.disabled = false;
  }
}

function samlInput() {
  const tal = (id) => ($(id).value === "" ? null : Number($(id).value));
  let polygon = null, forhindringer = [];

  const raaPolygon = $("tagpolygon").value.trim();
  if (raaPolygon) {
    try { polygon = JSON.parse(raaPolygon); }
    catch { throw new Error("Tagpolygonen er ikke gyldig JSON."); }
    if (!Array.isArray(polygon) || polygon.length < 3) {
      throw new Error("Tagpolygonen skal have mindst 3 hjørner.");
    }
  }

  const raaForhindringer = $("forhindringer").value.trim();
  if (raaForhindringer) {
    try { forhindringer = JSON.parse(raaForhindringer); }
    catch { throw new Error("Tagopbygningerne er ikke gyldig JSON."); }
  }

  if (tal("lat") == null && !$("adresse").value.trim()) {
    throw new Error("Angiv enten en adresse eller et koordinat.");
  }

  const tagtype = $("tagtype").value;
  return {
    adresse: $("adresse").value.trim() || null,
    lat: tal("lat"), lon: tal("lon"),
    kommunekode: tal("kommunekode"),
    bygningshoejdeM: tal("bygningshoejde"),
    paneltype: $("paneltype").value,
    montagesystem: $("montagesystem").value,
    orientering: $("orientering").value || undefined,
    aarsforbrugKWh: tal("aarsforbrug"),
    maalepunktId: $("maalepunkt").value.trim() || null,
    eksisterendeHovedsikringA: tal("hovedsikring"),
    bekraeftedeDokumenter: laesDokumenter(),
    manueltTag: polygon ? {
      polygon, tagtype,
      haeldningGrader: tagtype === "skraat" ? tal("taghaeldning") : 0,
      tagAzimutGrader: tagtype === "skraat" ? tal("tagazimut") : 0,
      forhindringer,
    } : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Visning                                                             */
/* ------------------------------------------------------------------ */

function visResultat(sag) {
  const m = sag.moduler;
  visOpsummering(sag, m);
  visTegning(sag, m);
  visModuler(m);
}

function visOpsummering(sag, m) {
  const boks = $("opsummering");
  boks.replaceChildren(el("h2", null, "Resultat"));

  const m5 = m.m5;
  if (m5) {
    const klasse = m5.konklusion === "inden-for-dokumenteret-kapacitet" ? "god"
      : m5.konklusion === "kraever-yderligere-teknisk-vurdering" ? "advarsel" : "kritisk";
    const k = el("div", `konklusion ${klasse}`);
    k.append(el("h3", null, `Statisk vurdering: ${m5.konklusionstekst}`));
    k.append(el("p", null, m5.begrundelse ?? ""));
    k.append(el("p", null,
      "Udkast – kræver godkendelse af certificeret statiker. Vurderingen er en " +
      "sammenligning af to tal og erstatter ikke statisk dokumentation."));
    boks.append(k);
  }

  const noegletal = el("div", "noegletal");
  for (const [navn, dp] of [
    ["Installeret effekt", m.m2?.resultat?.installeretEffektKWp],
    ["Antal paneler", m.m2?.resultat?.antalPaneler],
    ["Årsproduktion", m.m7?.resultat?.aarsproduktionKWh],
    ["Specifik ydelse", m.m7?.resultat?.specifikYdelseKWhPrKWp],
    ["Skyggetab", m.m8?.resultat?.samletSkyggetabPct],
    ["Last på panelfelt", m.m3?.resultat?.fordeltOverPanelfeltKgPrM2],
    ["Egetforbrugsandel", m.m12?.egetforbrug?.egetforbrugsandelPct],
    ["Tilbagebetaling", m.m12?.resultat?.tilbagebetalingstidAar],
    ["CO₂ pr. år", m.m14?.co2?.aarligReduktionTon],
  ]) {
    if (!dp) continue;
    const kort = el("div", "tal-kort");
    const v = el("div", "v");
    v.append(document.createTextNode(formatTal(dp.vaerdi)));
    if (dp.enhed) v.append(el("span", "e", ` ${dp.enhed}`));
    kort.append(v, el("div", "n", navn), maerke(dp.herkomst));
    noegletal.append(kort);
  }
  boks.append(noegletal);

  if (sag.forloeb?.length > 1) {
    boks.append(el("h4", null, "Iterativ dimensionering"));
    const t = el("table", "forloeb");
    t.innerHTML = "<tr><th>Gennemløb</th><th>Paneler</th><th>kWp</th><th>Skyggetab</th><th>Brandkonflikter</th></tr>" +
      sag.forloeb.map((f) => `<tr><td>${f.gennemloeb}</td><td>${f.antalPaneler}</td>` +
        `<td>${f.effektKWp}</td><td>${f.skyggetabPct ?? "-"} %</td><td>${f.brandKonflikter}</td></tr>`).join("");
    boks.append(t);
    boks.append(el("p", "hjaelp",
      "Modul 8 (skygge) og modul 10 (brandveje) sender justeringer tilbage til modul 2, " +
      "som genberegner layoutet indtil det er stabilt."));
  }

  const advarsler = [];
  for (const mod of Object.values(m)) {
    for (const a of mod?.advarsler ?? []) advarsler.push({ modul: mod.navn, tekst: a });
    for (const b of mod?.blokerende ?? []) advarsler.push({ modul: mod.navn, tekst: b, blokerende: true });
  }
  if (advarsler.length) {
    boks.append(el("h4", null, `Forhold der skal afklares (${advarsler.length})`));
    const ul = el("ul", "advarselsliste");
    for (const a of advarsler) {
      const li = el("li", a.blokerende ? "blokerende" : null);
      li.append(el("span", "modulnavn", a.modul ?? ""), document.createTextNode(a.tekst));
      ul.append(li);
    }
    boks.append(ul);
  }

  const f = sag.statistik?.fordeling;
  if (f) {
    boks.append(el("h4", null, "Datagrundlag"));
    const p = el("p", "hjaelp");
    p.append(document.createTextNode("Fordeling af de "), el("strong", null, String(sag.statistik.antal)),
      document.createTextNode(" datapunkter i analysen: "));
    for (const [h, antal] of Object.entries(f)) {
      if (!antal) continue;
      p.append(maerke(h), document.createTextNode(` ${antal}  `));
    }
    boks.append(p);
  }
}

function visTegning(sag, m) {
  const boks = $("tegningkort");
  boks.replaceChildren(el("h2", null, "Tagtegning"));
  if (!m.m2?.paneler?.length) {
    boks.append(el("p", "hjaelp", "Der er ikke placeret paneler."));
    return;
  }
  const svg = tegn(m);
  const holder = el("div", "tegning");
  holder.innerHTML = svg;
  boks.append(holder);
  boks.append(el("p", "hjaelp",
    "Nord opad. Farvede felter er tagopbygninger; stiplede felter er brandveje, " +
    "som modul 10 kræver friholdt. Panelfarven viser skyggetab, når modul 8 har " +
    "haft højdedata at regne på."));
}

/** Tegner samme SVG som rapporten, men i browseren. */
function tegn(m) {
  const tag = m.m2.geometri.tagpolygonMeter;
  const xs = tag.map((p) => p.x), ys = tag.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const B = 860, margin = 40;
  const skala = (B - 2 * margin) / (maxX - minX);
  const H = (maxY - minY) * skala + 2 * margin;
  const X = (x) => margin + (x - minX) * skala;
  const Y = (y) => H - margin - (y - minY) * skala;
  const sti = (r) => r.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ") + " Z";

  const tabKort = new Map((m.m8?.panelTab ?? []).map((t) => [t.id, t.skyggetabPct]));
  const dele = [`<path d="${sti(tag)}" fill="#f4f1ea" stroke="#3d4451" stroke-width="2"/>`];

  for (const v of m.m10?.brandveje ?? []) {
    dele.push(`<path d="${sti(v.polygonMeter)}" fill="#d99a2b" fill-opacity="0.18" stroke="#d99a2b" stroke-width="1" stroke-dasharray="6 4"/>`);
  }
  for (const f of m.m1?.tag?.forhindringer ?? []) {
    if (f.polygonMeter?.length) {
      dele.push(`<path d="${sti(f.polygonMeter)}" fill="#b8532f" fill-opacity="0.35" stroke="#b8532f" stroke-width="1.5"/>`);
    }
  }
  for (const p of m.m2.paneler) {
    let fyld = "#1d3f6e";
    if (tabKort.has(p.id)) {
      const t = tabKort.get(p.id);
      fyld = t > 20 ? "#8a2f2f" : t > 10 ? "#b06a3b" : t > 3 ? "#7a8a5e" : "#1d3f6e";
    } else if (p.orientering === "oest") fyld = "#2f6ea8";
    else if (p.orientering === "vest") fyld = "#7aa5cc";
    dele.push(`<path d="${sti(p.hjoerner)}" fill="${fyld}" fill-opacity="0.9" stroke="#fff" stroke-width="0.4"/>`);
  }
  dele.push(`<text x="${B / 2}" y="${H - 12}" font-size="12" fill="#6b7385" text-anchor="middle">${(maxX - minX).toFixed(1)} m</text>`);
  dele.push(`<text x="${B - 20}" y="${28}" font-size="12" fill="#1b2130" text-anchor="middle">N ↑</text>`);

  return `<svg viewBox="0 0 ${B} ${H.toFixed(0)}" width="${B}" height="${H.toFixed(0)}" font-family="system-ui,sans-serif">${dele.join("")}</svg>`;
}

function visModuler(m) {
  const boks = $("modulkort");
  boks.replaceChildren(el("h2", null, "Moduler"));

  const raekkefoelge = [
    ["m1", "Modul 1 · Adresse og tagdata"],
    ["m2", "Modul 2 · Layout"],
    ["m3", "Modul 3 · Vægt og last"],
    ["m4", "Modul 4 · Dokumentationssøgning"],
    ["m5", "Modul 5 · Strukturel vurdering"],
    ["m7", "Modul 7 · Produktion"],
    ["m8", "Modul 8 · Skygge"],
    ["m9", "Modul 9 · Nettilslutning"],
    ["m10", "Modul 10 · Brandsikkerhed"],
    ["m11", "Modul 11 · Tagets tilstand"],
    ["m12", "Modul 12 · Økonomi"],
    ["m13", "Modul 13 · Myndighed"],
    ["m14", "Modul 14 · Drift og CO₂"],
  ];

  for (const [noegle, titel] of raekkefoelge) {
    const mod = m[noegle];
    if (!mod) continue;
    const d = el("details", "modul");
    const s = el("summary");
    s.append(document.createTextNode(titel), el("span", `statusprik ${mod.status}`, mod.status ?? ""));
    d.append(s);

    const indhold = el("div", "modulindhold");
    const punkter = samlDatapunkter(mod);
    if (punkter.length) {
      const t = el("table", "data");
      const tbody = document.createElement("tbody");
      for (const [navn, dp] of punkter) {
        const tr = document.createElement("tr");
        const th = el("th", null, navn);
        const td = el("td", "tal", `${formatTal(dp.vaerdi)} ${dp.enhed ?? ""}`);
        const tdm = document.createElement("td");
        tdm.append(maerke(dp.herkomst));
        const tdk = el("td", "lille", dp.kilde + (dp.note ? ` — ${dp.note}` : ""));
        tr.append(th, td, tdm, tdk);
        tbody.append(tr);
      }
      t.append(tbody);
      indhold.append(t);
    }

    if (noegle === "m10" && mod.konstateringer) {
      const t = el("table", "data");
      t.innerHTML = "<thead><tr><th>Forhold</th><th>Krav</th><th>Status</th><th>Bemærkning</th></tr></thead><tbody>" +
        mod.konstateringer.map((k) => `<tr><td>${undslip(k.navn)}</td>` +
          `<td class="tal">${k.kravM != null ? k.kravM + " m" : "–"}</td>` +
          `<td><span class="maerke ${k.status === "opfyldt" ? "brugerbekraeftet" : k.status === "ikke-opfyldt" ? "mangler" : "antagelse"}">${k.status}</span></td>` +
          `<td class="lille">${undslip(k.bemaerkning)}</td></tr>`).join("") + "</tbody>";
      indhold.append(t);
    }

    if (noegle === "m4" && mod.soegninger?.length) {
      const p = el("p", "hjaelp");
      for (const s2 of mod.soegninger) {
        const a = el("a", null, `Åbn ${s2.navn} →`);
        a.href = s2.url; a.target = "_blank"; a.rel = "noopener";
        a.style.marginRight = "14px";
        p.append(a);
      }
      indhold.append(p);
    }

    for (const felt of ["forbehold", "naesteSkridt", "handlemuligheder", "tjekliste", "tjeklisteMyndighed"]) {
      const v = mod[felt];
      if (Array.isArray(v) && v.length) {
        indhold.append(el("h4", null, etiketFor(felt)));
        const ul = document.createElement("ul");
        for (const x of v) ul.append(el("li", null, x));
        indhold.append(ul);
      } else if (typeof v === "string" && v) {
        indhold.append(el("p", "hjaelp advarsel", v));
      }
    }

    d.append(indhold);
    boks.append(d);
  }
}

const etiketFor = (f) => ({
  forbehold: "Forbehold", naesteSkridt: "Næste skridt",
  handlemuligheder: "Handlemuligheder", tjekliste: "Tjekliste",
  tjeklisteMyndighed: "Tjekliste",
}[f] ?? f);

/** Finder datapunkter (objekter med herkomst+kilde) én til to niveauer nede. */
function samlDatapunkter(mod, maxDybde = 2) {
  const ud = [];
  const gaa = (o, sti, dybde) => {
    if (dybde > maxDybde || o == null || typeof o !== "object" || Array.isArray(o)) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "paneler" || k === "panelTab" || k === "kontantstroem" || k === "aarsserie") continue;
      if (erDatapunkt(v)) ud.push([sti ? `${sti} · ${pen(k)}` : pen(k), v]);
      else gaa(v, sti ? `${sti} · ${pen(k)}` : pen(k), dybde + 1);
    }
  };
  for (const gren of ["resultat", "forudsaetninger", "egenlast", "vindlast", "ballast",
                      "snelast", "egetforbrug", "forbrug", "co2", "tilslutningsform"]) {
    if (mod[gren]) gaa(mod[gren], "", 1);
  }
  for (const [k, v] of Object.entries(mod)) {
    if (erDatapunkt(v)) ud.push([pen(k), v]);
  }
  return ud;
}

const erDatapunkt = (v) => v != null && typeof v === "object" && !Array.isArray(v)
  && "herkomst" in v && "kilde" in v;

const pen = (n) => n
  .replace(/([a-zæøå])([A-ZÆØÅ])/g, "$1 $2")
  .replace(/^./, (c) => c.toUpperCase())
  .replace(/Pct\b/, "(%)").replace(/K W h/g, "kWh").replace(/K Wp/g, "kWp");

function maerke(herkomst) {
  const tekst = {
    hentet: "Hentet", brugerbekraeftet: "Bekræftet", beregnet: "Beregnet",
    antagelse: "Antagelse", mangler: "Mangler",
  }[herkomst] ?? herkomst;
  return el("span", `maerke ${herkomst}`, tekst);
}

function formatTal(v) {
  if (v == null) return "–";
  if (typeof v === "number") return v.toLocaleString("da-DK", { maximumFractionDigits: 2 });
  if (typeof v === "object") {
    if ("x" in v && "y" in v) return `x ${v.x}, y ${v.y}`;
    if ("lat" in v) return `${v.lat}, ${v.lon}`;
    if (Array.isArray(v)) return `${v.length} post(er)`;
    return "…";
  }
  return String(v);
}

const undslip = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/* Eksport                                                             */
/* ------------------------------------------------------------------ */

async function aabnRapport() {
  if (!sidsteSag) return;
  const vindue = window.open("", "_blank");
  const svar = await fetch("/api/rapport", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sidsteSag),
  });
  const html = await svar.text();
  vindue.document.write(html);
  vindue.document.close();
}

function hentJson() {
  if (!sidsteSag) return;
  const blob = new Blob([JSON.stringify(sidsteSag, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `solcelleanalyse-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------------------------------------------ */
/* Hjaelpere                                                           */
/* ------------------------------------------------------------------ */

function visStatus(tekst, fejl = false) {
  const s = $("koerstatus");
  s.textContent = tekst;
  s.style.color = fejl ? "var(--kritisk)" : "var(--muted)";
}

async function hent(sti) {
  const svar = await fetch(sti);
  if (!svar.ok) throw new Error(`${svar.status} ${svar.statusText}`);
  return svar.json();
}

async function send(sti, krop) {
  const svar = await fetch(sti, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(krop),
  });
  const data = await svar.json();
  if (!svar.ok) throw new Error(data.fejl ?? `${svar.status}`);
  return data;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
