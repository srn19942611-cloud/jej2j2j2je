import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  Herkomst, datapunkt, hentet, bekraeftet, beregnet, antagelse, mangler,
  vaerdi, vaerdiEller, erPaalideligt, erMangel, samlKilder, kildeStatistik,
} from "../server/lib/kilde.js";

describe("kilde- og herkomstsporing", () => {
  test("datapunkter baerer kilde, enhed og dato", () => {
    const dp = hentet(42, "BBR via Datafordeleren", { enhed: "m2" });
    assert.equal(dp.vaerdi, 42);
    assert.equal(dp.herkomst, Herkomst.HENTET);
    assert.equal(dp.enhed, "m2");
    assert.match(dp.dato, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("vaerdi() kaster paa et manglende datapunkt", () => {
    assert.throws(() => vaerdi(mangler("WebLager", "ingen tegning"), "baereevne"),
      /baereevne mangler/);
  });

  test("vaerdiEller() giver fallback i stedet for at kaste", () => {
    assert.equal(vaerdiEller(mangler("x", "y"), 7), 7);
    assert.equal(vaerdiEller(beregnet(3, "test"), 7), 3);
  });

  test("kun hentede og brugerbekraeftede vaerdier er paalidelige", () => {
    assert.ok(erPaalideligt(hentet(1, "k")));
    assert.ok(erPaalideligt(bekraeftet(1, "k")));
    assert.ok(!erPaalideligt(beregnet(1, "k")), "beregnede tal er ikke et kildegrundlag");
    assert.ok(!erPaalideligt(antagelse(1, "k")), "antagelser er ikke et kildegrundlag");
    assert.ok(!erPaalideligt(mangler("k", "n")));
  });

  test("et datapunkt uden vaerdi er en mangel, uanset herkomst", () => {
    assert.ok(erMangel(hentet(null, "k")));
  });

  test("samlKilder finder datapunkter rekursivt med sti", () => {
    const objekt = {
      m1: { areal: hentet(100, "GeoDanmark", { enhed: "m2" }) },
      m3: { resultat: { last: beregnet(0.5, "Modul 3") } },
      liste: [antagelse(1, "config")],
    };
    const k = samlKilder(objekt);
    assert.equal(k.length, 3);
    assert.ok(k.some((x) => x.sti === "m1.areal"));
    assert.ok(k.some((x) => x.sti === "m3.resultat.last"));
    assert.ok(k.some((x) => x.sti === "liste[0]"));
  });

  test("kildeStatistik taeller herkomster og samler mangler", () => {
    const s = kildeStatistik({
      a: hentet(1, "k"), b: mangler("k", "mangler her"), c: mangler("k", "og her"),
    });
    assert.equal(s.antal, 3);
    assert.equal(s.fordeling.hentet, 1);
    assert.equal(s.fordeling.mangler, 2);
    assert.equal(s.mangler.length, 2);
  });

  test("ukendt herkomst afvises", () => {
    assert.throws(() => datapunkt(1, { herkomst: "opfundet", kilde: "k" }),
      /Ukendt herkomst/);
  });
});

/**
 * Invariant: interne enum-værdier skal være rene ASCII.
 *
 * Værdierne bruges som nøgler på tværs af moduler, i JSON mod browseren og i
 * CSS-klassenavne. Bliver én af dem oversat til æøå uden at alle
 * sammenligninger følger med, fejler koden lydløst - så det fanges her.
 */
import { Konklusion } from "../server/modules/m05-struktur.js";
import { ORIENTERINGER } from "../server/modules/m02-layout.js";
import { Status } from "../server/modules/m10-brand.js";
import { Sikkerhed } from "../server/config/kommuner.js";
import { BRANDREGLER } from "../server/config/brandregler.js";

describe("enum-værdier er ASCII", () => {
  const kunAscii = /^[a-z0-9-]+$/;
  for (const [navn, samling] of Object.entries({
    Herkomst, Konklusion, ORIENTERINGER, Status, Sikkerhed,
  })) {
    test(`${navn}`, () => {
      for (const v of Object.values(samling)) {
        assert.match(v, kunAscii, `${navn}-værdien "${v}" er ikke ren ASCII`);
      }
    });
  }

  test("brandreglernes id'er", () => {
    for (const r of BRANDREGLER.regler) {
      assert.match(r.id, kunAscii, `regel-id "${r.id}" er ikke ren ASCII`);
    }
  });
});
