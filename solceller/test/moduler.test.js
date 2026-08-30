import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as m02 from "../server/modules/m02-layout.js";
import * as m03 from "../server/modules/m03-last.js";
import * as m05 from "../server/modules/m05-struktur.js";
import * as m07 from "../server/modules/m07-produktion.js";
import * as m08 from "../server/modules/m08-skygge.js";
import * as m09 from "../server/modules/m09-nettilslutning.js";
import * as m10 from "../server/modules/m10-brand.js";
import * as m11 from "../server/modules/m11-tagtilstand.js";
import * as m12 from "../server/modules/m12-oekonomi.js";
import * as m14 from "../server/modules/m14-drift.js";
import { bekraeftet, hentet, mangler, Herkomst } from "../server/lib/kilde.js";

const TAG = [{ x: -25, y: -22 }, { x: 25, y: -22 }, { x: 25, y: 22 }, { x: -25, y: 22 }];
const layout = () => m02.saetOestVestAzimut(
  m02.koer({ tagpolygonMeter: TAG, tagtype: "fladt", lat: 56.15 }));

describe("modul 2 - layout", () => {
  test("placerer paneler paa et fladt tag", () => {
    const l = layout();
    assert.equal(l.status, "ok");
    assert.ok(l.paneler.length > 100);
    assert.ok(l.resultat.installeretEffektKWp.vaerdi > 0);
  });

  test("alle paneler holder afstanden til tagkanten", () => {
    const l = layout();
    const krav = l.forudsaetninger.minAfstandTagkantM.vaerdi;
    for (const p of l.paneler) {
      for (const h of p.hjoerner) {
        assert.ok(h.x >= -25 + krav - 1e-6 && h.x <= 25 - krav + 1e-6, "x inden for kanten");
        assert.ok(h.y >= -22 + krav - 1e-6 && h.y <= 22 - krav + 1e-6, "y inden for kanten");
      }
    }
  });

  test("forhindringer holdes fri", () => {
    const forhindring = [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }];
    const l = m02.koer({
      tagpolygonMeter: TAG, tagtype: "fladt", lat: 56.15,
      forhindringer: [{ type: "ovenlys", polygonMeter: forhindring }],
    });
    const uden = layout();
    assert.ok(l.paneler.length < uden.paneler.length);
    for (const p of l.paneler) {
      const iVejen = p.hjoerner.some((h) =>
        h.x > -5.8 && h.x < 5.8 && h.y > -5.8 && h.y < 5.8);
      assert.ok(!iVejen, `panel ${p.id} ligger i forhindringen`);
    }
  });

  test("udelukkelseszoner fra modul 8 og 10 respekteres", () => {
    const zone = [{ x: -2, y: -22 }, { x: 2, y: -22 }, { x: 2, y: 22 }, { x: -2, y: 22 }];
    const l = m02.koer({
      tagpolygonMeter: TAG, tagtype: "fladt", lat: 56.15,
      udelukkelseszoner: [{ polygonMeter: zone, aarsag: "brandvej" }],
    });
    assert.ok(l.paneler.every((p) => p.hjoerner.every((h) => h.x < -2 || h.x > 2)));
  });

  test("oest/vest giver paneler i begge orienteringer", () => {
    const l = m02.saetOestVestAzimut(m02.koer({
      tagpolygonMeter: TAG, tagtype: "fladt", lat: 56.15, orientering: "oest-vest" }));
    const azimutter = new Set(l.paneler.map((p) => p.azimutGrader));
    assert.deepEqual([...azimutter].sort((a, b) => a - b), [-90, 90]);
  });

  test("skraat tag uden haeldning afvises frem for at gaette", () => {
    const l = m02.koer({ tagpolygonMeter: TAG, tagtype: "skraat", lat: 56.15 });
    assert.equal(l.status, "ufuldstaendig");
    assert.match(l.blokerende[0], /Taghældning mangler/);
  });
});

describe("modul 3 - last", () => {
  test("vindtrykket vokser med hoejden", () => {
    const lav = m03.beregnVindlast({ hoejdeM: 5, vb0: 24 });
    const hoej = m03.beregnVindlast({ hoejdeM: 20, vb0: 24 });
    assert.ok(hoej.qp > lav.qp);
  });

  test("peakhastighedstrykket ligger i en realistisk stoerrelsesorden", () => {
    const v = m03.beregnVindlast({ hoejdeM: 10, vb0: 24, terraenkategori: "III" });
    assert.ok(v.qp > 0.3 && v.qp < 1.2, `qp = ${v.qp} kN/m2`);
  });

  test("ballasten er stoerst i hjoernezonen", () => {
    const r = m03.koer({ layout: layout(), bygningshoejdeM: 8, kommunekode: 751 });
    assert.ok(r.ballast.hjoernezoneKgPrPanel.vaerdi > r.ballast.kantzoneKgPrPanel.vaerdi);
    assert.ok(r.ballast.kantzoneKgPrPanel.vaerdi > r.ballast.indreZoneKgPrPanel.vaerdi);
  });

  test("ballasten ligger i en realistisk stoerrelsesorden", () => {
    const r = m03.koer({ layout: layout(), bygningshoejdeM: 8, kommunekode: 751 });
    const kgPrM2 = r.resultat.fordeltOverPanelfeltKgPrM2.vaerdi;
    assert.ok(kgPrM2 > 15 && kgPrM2 < 120, `${kgPrM2} kg/m2 er uden for det forventede`);
  });

  test("uden bygningshoejde beregnes vindlasten ikke - og det siges", () => {
    const r = m03.koer({ layout: layout(), kommunekode: 751 });
    assert.equal(r.status, "delvis");
    assert.equal(r.vindlast.herkomst, Herkomst.MANGLER);
    assert.ok(r.advarsler.some((a) => a.includes("Bygningshøjden")));
  });

  test("den vestjyske vindzone giver hoejere last", () => {
    const aarhus = m03.koer({ layout: layout(), bygningshoejdeM: 8, kommunekode: 751 });
    const varde = m03.koer({ layout: layout(), bygningshoejdeM: 8, kommunekode: 573 });
    assert.ok(varde.vindlast.peakhastighedstrykQpKNPrM2.vaerdi >
              aarhus.vindlast.peakhastighedstrykQpKNPrM2.vaerdi);
  });

  test("snelastens formfaktor aftager over 30 grader", () => {
    assert.equal(m03.beregnSnelast({ haeldning: 20, fladt: false }).mu, 0.8);
    assert.ok(m03.beregnSnelast({ haeldning: 45, fladt: false }).mu < 0.8);
    assert.equal(m03.beregnSnelast({ haeldning: 60, fladt: false }).mu, 0);
  });
});

describe("modul 5 - strukturel vurdering", () => {
  const last = () => m03.koer({ layout: layout(), bygningshoejdeM: 8, kommunekode: 751 });
  const dok = (kNPrM2) => ({
    dokumenteretBaereevne: kNPrM2 == null
      ? mangler("Arkiv", "ingen dokumentation")
      : bekraeftet(kNPrM2, "Byggesagsarkiv, bekraeftet af bruger", { enhed: "kN/m2" }),
  });

  test("uden dokumentation konkluderes utilstraekkelig dokumentation", () => {
    const r = m05.koer({ modul3: last(), modul4: dok(null) });
    assert.equal(r.konklusion, m05.Konklusion.UTILSTRAEKKELIG_DOK);
    assert.ok(r.naesteSkridt.length > 0);
  });

  test("en beregnet vaerdi taeller ikke som dokumentation", () => {
    const r = m05.koer({
      modul3: last(),
      modul4: { dokumenteretBaereevne: { vaerdi: 5, herkomst: Herkomst.BEREGNET, kilde: "gaet" } },
    });
    assert.equal(r.konklusion, m05.Konklusion.UTILSTRAEKKELIG_DOK,
      "kun hentede og bekraeftede vaerdier maa baere konklusionen");
  });

  test("rigelig kapacitet giver inden for dokumenteret kapacitet", () => {
    const r = m05.koer({ modul3: last(), modul4: dok(2.0) });
    assert.equal(r.konklusion, m05.Konklusion.INDEN_FOR_KAPACITET);
    assert.ok(r.udnyttelsesgrad.vaerdi < 80);
  });

  test("knap kapacitet kraever yderligere vurdering", () => {
    const l = last();
    const knap = l.resultat.egenlastKNPrM2.vaerdi / 0.9; // 90 % udnyttelse
    const r = m05.koer({ modul3: l, modul4: dok(knap) });
    assert.equal(r.konklusion, m05.Konklusion.KRAEVER_VURDERING);
  });

  test("overskredet kapacitet siges direkte", () => {
    const l = last();
    const r = m05.koer({ modul3: l, modul4: dok(l.resultat.egenlastKNPrM2.vaerdi * 0.5) });
    assert.equal(r.konklusion, m05.Konklusion.KRAEVER_VURDERING);
    assert.match(r.begrundelse, /OVERSTIGER/);
    assert.ok(r.handlemuligheder.length > 0);
  });

  test("forbeholdet om certificeret statiker er altid med", () => {
    for (const k of [null, 2.0, 0.1]) {
      const r = m05.koer({ modul3: last(), modul4: dok(k) });
      assert.ok(r.forbehold.some((f) => f.includes("certificeret statiker")));
    }
  });

  test("grundlagsoversigten viser herkomst for hvert tal", () => {
    const r = m05.koer({ modul3: last(), modul4: dok(2.0) });
    const baereevne = r.grundlagsoversigt.find((g) => g.navn === "Dokumenteret bæreevne");
    assert.equal(baereevne.herkomst, Herkomst.BRUGERBEKRAEFTET);
    assert.ok(baereevne.kritisk);
  });
});

describe("modul 7 - produktion", () => {
  test("den interne model giver realistiske danske ydelser", () => {
    const syd = m07.internEstimat({ lat: 56, lon: 10, kWp: 1, haeldning: 35, azimut: 0, tabPct: 10 });
    assert.ok(syd.aarsproduktionKWh > 750 && syd.aarsproduktionKWh < 1150,
      `${syd.aarsproduktionKWh} kWh/kWp`);
  });

  test("syd giver mere end nord", () => {
    const syd = m07.internEstimat({ lat: 56, lon: 10, kWp: 1, haeldning: 35, azimut: 0, tabPct: 10 });
    const nord = m07.internEstimat({ lat: 56, lon: 10, kWp: 1, haeldning: 35, azimut: 180, tabPct: 10 });
    assert.ok(syd.aarsproduktionKWh > nord.aarsproduktionKWh * 1.3);
  });

  test("oest og vest giver det samme", () => {
    const o = m07.internEstimat({ lat: 56, lon: 10, kWp: 1, haeldning: 10, azimut: -90, tabPct: 10 });
    const v = m07.internEstimat({ lat: 56, lon: 10, kWp: 1, haeldning: 10, azimut: 90, tabPct: 10 });
    assert.ok(Math.abs(o.aarsproduktionKWh - v.aarsproduktionKWh) < 1);
  });

  test("produktionen topper om sommeren", () => {
    const r = m07.internEstimat({ lat: 56, lon: 10, kWp: 100, haeldning: 15, azimut: 0, tabPct: 10 });
    const max = Math.max(...r.maanedligKWh);
    assert.ok([4, 5, 6].includes(r.maanedligKWh.indexOf(max)), "toppen ligger i maj-juli");
    assert.ok(r.maanedligKWh[11] < r.maanedligKWh[5] / 5, "december er langt under juni");
  });

  test("systemtabet lægges sammen af de enkelte poster", () => {
    assert.ok(m07.systemtabPct() > 5 && m07.systemtabPct() < 12);
    assert.equal(m07.systemtabPct(5), m07.systemtabPct() + 5);
  });
});

describe("modul 8 - skygge", () => {
  test("uden hoejdedata regnes kun selvskygning, og det flages", () => {
    const r = m08.koer({ layout: layout(), lat: 56.15, lon: 10.21 });
    assert.equal(r.status, "delvis");
    assert.equal(r.daekning.herkomst, Herkomst.MANGLER);
    assert.ok(r.advarsler.some((a) => a.includes("KUN selvskygning")));
  });

  test("foerste raekke er aldrig selvskygget", () => {
    const r = m08.koer({ layout: layout(), lat: 56.15, lon: 10.21 });
    const foerste = r.panelTab.filter((t) => t.raekke === 1);
    assert.ok(foerste.every((t) => t.selvskygningPct === 0));
  });

  test("en hoej nabobygning mod syd rammer den naermeste raekke haardest", () => {
    const r = m08.koer({
      layout: layout(), lat: 56.15, lon: 10.21,
      nabobygninger: [{ polygonMeter: [{ x: -30, y: -40 }, { x: 30, y: -40 },
                                       { x: 30, y: -26 }, { x: -30, y: -26 }], hoejdeM: 18 }],
    });
    assert.equal(r.status, "ok");
    const foerste = r.raekketab[0].gennemsnitPct;
    const sidste = r.raekketab[r.raekketab.length - 1].gennemsnitPct;
    assert.ok(foerste > sidste * 3, `raekke 1: ${foerste} %, sidste raekke: ${sidste} %`);
  });

  test("stort skyggetab udloeser justeringsforslag til modul 2", () => {
    const r = m08.koer({
      layout: layout(), lat: 56.15, lon: 10.21,
      nabobygninger: [{ polygonMeter: [{ x: -30, y: -40 }, { x: 30, y: -40 },
                                       { x: 30, y: -26 }, { x: -30, y: -26 }], hoejdeM: 18 }],
    });
    assert.ok(r.overTaerskel);
    const fjern = r.justeringsforslag.find((f) => f.type === "fjern-paneler");
    assert.ok(fjern && fjern.udelukkelseszoner.length > 0);
  });
});

describe("modul 10 - brandsikkerhed", () => {
  test("et stort panelfelt kraever gennemgaaende brandveje", () => {
    const r = m10.koer({ layout: layout() });
    assert.ok(r.brandveje.length > 0);
    assert.ok(r.udelukkelseszoner.length > 0);
  });

  test("brandventilation udloeser en afstandskonflikt", () => {
    const r = m10.koer({
      layout: layout(),
      forhindringer: [{ type: "brandventilation",
        polygonMeter: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }] }],
    });
    const k = r.konstateringer.find((x) => x.regel === "afstand-brandventilation");
    assert.equal(k.status, m10.Status.IKKE_OPFYLDT);
  });

  test("ukendt brandsektionsvaeg flages som skal afklares - ikke som opfyldt", () => {
    const r = m10.koer({ layout: layout() });
    const k = r.konstateringer.find((x) => x.regel === "afstand-brandsektionsvaeg");
    assert.equal(k.status, m10.Status.SKAL_AFKLARES);
  });

  test("noedafbryder og maerkning kan ikke kontrolleres geometrisk", () => {
    const r = m10.koer({ layout: layout() });
    for (const id of ["noedafbryder", "maerkning"]) {
      assert.equal(r.konstateringer.find((x) => x.regel === id).status, m10.Status.SKAL_AFKLARES);
    }
  });

  test("regelgrundlaget baerer sit eget forbehold", () => {
    const r = m10.koer({ layout: layout() });
    assert.equal(r.regelgrundlag.herkomst, Herkomst.ANTAGELSE);
    assert.match(r.regelgrundlag.note, /verificeres/i);
  });
});

describe("modul 9 - nettilslutning", () => {
  test("netselskabet er kun indikativt uden bekraeftelse", () => {
    const r = m09.koer({ layout: layout(), kommunekode: 751 });
    assert.equal(r.netselskab.herkomst, Herkomst.ANTAGELSE);
    assert.equal(r.status, "kraever-bekraeftelse");
  });

  test("et bekraeftet netselskab loeftes til brugerbekraeftet", () => {
    const r = m09.koer({ layout: layout(), kommunekode: 751, bekraeftetNetselskab: "N1" });
    assert.equal(r.netselskab.herkomst, Herkomst.BRUGERBEKRAEFTET);
    assert.equal(r.status, "ok");
  });

  test("kapacitet meldes altid som en mangel - vaerktoejet kan ikke afgoere den", () => {
    const r = m09.koer({ layout: layout(), kommunekode: 751, bekraeftetNetselskab: "N1" });
    assert.equal(r.kapacitet.herkomst, Herkomst.MANGLER);
  });

  test("en ukortlagt kommune giver ingen paastand", () => {
    const r = m09.koer({ layout: layout(), kommunekode: 492 });
    assert.ok([Herkomst.MANGLER, Herkomst.ANTAGELSE].includes(r.netselskab.herkomst));
  });

  test("strengene deles efter raekke og orientering", () => {
    const r = m09.koer({ layout: layout(), kommunekode: 751 });
    assert.ok(r.strengdesign.antalStrenge.vaerdi > 0);
    for (const s of r.strengdesign.strenge) assert.ok(s.antalPaneler <= 22);
  });
});

describe("modul 11 - tagets tilstand", () => {
  test("et gammelt papptag flages foer montage", () => {
    const r = m11.koer({
      modul1: {
        tagdaekningsmateriale: hentet("Tagpap med lille hældning", "BBR"),
        opfoerelsesaar: hentet(1985, "BBR"),
        ombygningsaar: mangler("BBR", "ikke udfyldt"),
      },
    });
    assert.ok(r.restlevetidAar.vaerdi < 25);
    assert.match(r.vurdering.vaerdi, /fornyes|holder sandsynligvis ikke/);
  });

  test("et nyt tegltag holder anlaeggets levetid", () => {
    const r = m11.koer({
      modul1: {
        tagdaekningsmateriale: hentet("Tegl", "BBR"),
        opfoerelsesaar: hentet(2015, "BBR"),
        ombygningsaar: mangler("BBR", "ikke udfyldt"),
      },
    });
    assert.match(r.vurdering.vaerdi, /holde hele/);
  });

  test("den fysiske tilstand meldes altid som en mangel", () => {
    const r = m11.koer({ modul1: {} });
    assert.equal(r.fysiskTilstand.herkomst, Herkomst.MANGLER);
  });

  test("asbest udloeser en saerskilt advarsel", () => {
    const r = m11.koer({
      modul1: {
        tagdaekningsmateriale: hentet("Fibercement, herunder asbest (bølgeplader)", "BBR"),
        opfoerelsesaar: hentet(1975, "BBR"),
      },
    });
    assert.ok(r.advarsler.some((a) => a.toLowerCase().includes("asbest")));
  });

  test("ballast og gennemboring beskrives forskelligt om garantien", () => {
    const b = m11.koer({ modul1: {}, montagesystem: "ballast" });
    const g = m11.koer({ modul1: {}, montagesystem: "gennemboret" });
    assert.equal(b.montageOgGaranti.montagetype, "Ballasteret");
    assert.match(g.montageOgGaranti.paavirkning, /garanti/i);
  });
});

describe("modul 12 - oekonomi", () => {
  test("time-for-time-matchet tager minimum af produktion og forbrug", () => {
    const t = (h, kWh) => ({ tid: new Date(Date.UTC(2026, 0, 1, h)), kWh });
    const r = m12.matchTimer([t(10, 5), t(11, 5)], [t(10, 3), t(11, 8)]);
    assert.equal(r.egetforbrugKWh, 3 + 5);
    assert.equal(r.overskudKWh, 2);
  });

  test("CAPEX-kurven interpoleres og falder med stoerrelsen", () => {
    const kurve = [{ kWp: 10, krPrKWp: 11000 }, { kWp: 100, krPrKWp: 7000 }];
    assert.equal(m12.interpolérCapex(10, kurve), 11000);
    assert.equal(m12.interpolérCapex(100, kurve), 7000);
    assert.equal(m12.interpolérCapex(55, kurve), 9000);
    assert.equal(m12.interpolérCapex(500, kurve), 7000, "uden for kurven bruges yderpunktet");
  });

  test("den syntetiske profil rammer det oplyste aarsforbrug", () => {
    const p = m12.syntetiskButiksprofil(100000);
    const sum = p.reduce((s, t) => s + t.kWh, 0);
    assert.ok(Math.abs(sum - 100000) < 1);
    assert.equal(p.length, 365 * 24);
  });

  test("den syntetiske profil har lavere forbrug om natten", () => {
    const p = m12.syntetiskButiksprofil(100000);
    const nat = p.filter((t) => t.tid.getUTCHours() === 3).reduce((s, t) => s + t.kWh, 0);
    const dag = p.filter((t) => t.tid.getUTCHours() === 13).reduce((s, t) => s + t.kWh, 0);
    assert.ok(dag > nat * 2);
  });

  test("timeprofilen fra maanedstotaler bevarer maanedssummerne", () => {
    const maaneder = Array(12).fill(1000);
    const p = m12.timeprofilFraMaaneder(maaneder, 56, 10, 15, 0);
    for (let m = 0; m < 12; m++) {
      const sum = p.filter((t) => t.tid.getUTCMonth() === m).reduce((s, t) => s + t.kWh, 0);
      assert.ok(Math.abs(sum - 1000) < 1, `maaned ${m}: ${sum}`);
    }
  });

  test("der produceres ikke om natten", () => {
    const p = m12.timeprofilFraMaaneder(Array(12).fill(1000), 56, 10, 15, 0);
    const nat = p.filter((t) => t.tid.getUTCHours() === 1);
    assert.ok(nat.every((t) => t.kWh === 0));
  });
});

describe("modul 14 - CO2", () => {
  const m7 = {
    resultat: {
      aarsproduktionKWh: { vaerdi: 100000, herkomst: Herkomst.HENTET, kilde: "PVGIS" },
      samletProduktionOverLevetidKWh: { vaerdi: 2400000, herkomst: Herkomst.BEREGNET, kilde: "M7" },
      installeretEffektKWp: { vaerdi: 100, herkomst: Herkomst.BEREGNET, kilde: "M2" },
    },
    aarsserie: [],
    datakilde: { kilde: "PVGIS" },
  };

  test("CO2 beregnes af produktion og emissionsfaktor", () => {
    const r = m14.koer({ modul7: m7, emissionsfaktorGramPrKWh: 100 });
    assert.equal(r.co2.aarligReduktionTon.vaerdi, 10);
    assert.equal(r.co2.reduktionOverLevetidTon.vaerdi, 240);
  });

  test("emissionsfaktoren er markeret som en antagelse", () => {
    const r = m14.koer({ modul7: m7 });
    assert.equal(r.co2.emissionsfaktorGramPrKWh.herkomst, Herkomst.ANTAGELSE);
  });

  test("et modelleret produktionstal smitter af paa CO2-tallet", () => {
    const modelleret = structuredClone(m7);
    modelleret.resultat.aarsproduktionKWh.herkomst = Herkomst.ANTAGELSE;
    const r = m14.koer({ modul7: modelleret });
    assert.ok(r.advarsler.some((a) => a.includes("modelleret")));
  });

  test("eksportstrukturen indeholder referencetilstanden", () => {
    const r = m14.koer({ modul7: m7 });
    assert.equal(r.overvaagning.eksport.reference.aarsproduktionKWh, 100000);
    assert.ok(r.overvaagning.eksport.noegletalAtOvervaage.length > 0);
  });
});
