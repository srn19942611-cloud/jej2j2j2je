import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  solposition, solhoejdeVedTimevinkel, raekkeafstand,
  selvskyggetAndel, solvektor, cosIndfaldsvinkel, aarsSolpunkter,
} from "../server/lib/sol.js";

const KBH = { lat: 55.6761, lon: 12.5683 };

describe("solposition", () => {
  test("maksimal solhoejde ved sommersolhverv svarer til 90 - lat + 23,44", () => {
    const forventet = 90 - KBH.lat + 23.44;
    const faktisk = solhoejdeVedTimevinkel(KBH.lat, 23.44, 0);
    assert.ok(Math.abs(faktisk - forventet) < 0.01, `forventet ${forventet}, fik ${faktisk}`);
  });

  test("maksimal solhoejde ved vintersolhverv svarer til 90 - lat - 23,44", () => {
    const forventet = 90 - KBH.lat - 23.44;
    const faktisk = solhoejdeVedTimevinkel(KBH.lat, -23.44, 0);
    assert.ok(Math.abs(faktisk - forventet) < 0.01, `forventet ${forventet}, fik ${faktisk}`);
  });

  test("solen staar under horisonten ved midnat om vinteren", () => {
    const { hoejde } = solposition(new Date(Date.UTC(2026, 11, 21, 23, 0)), KBH.lat, KBH.lon);
    assert.ok(hoejde < 0, `fik ${hoejde}`);
  });

  test("solen staar i syd ved solmiddag", () => {
    // Solmiddag i UTC = 12:00 - lon/15
    const timer = 12 - KBH.lon / 15;
    const dato = new Date(Date.UTC(2026, 2, 20, Math.floor(timer), Math.round((timer % 1) * 60)));
    const { azimut } = solposition(dato, KBH.lat, KBH.lon);
    assert.ok(Math.abs(azimut) < 3, `azimut skulle vaere ca. 0 (syd), fik ${azimut}`);
  });

  test("solvektor peger mod syd ved azimut 0", () => {
    const v = solvektor(30, 0);
    assert.ok(Math.abs(v.x) < 1e-9, "ingen oest/vest-komposant");
    assert.ok(v.y < 0, "peger mod syd (negativ nord)");
    assert.ok(Math.abs(v.z - 0.5) < 1e-9, "sin(30) = 0,5");
  });

  test("solvektor peger mod vest ved azimut 90", () => {
    const v = solvektor(30, 90);
    assert.ok(v.x > 0.8, "peger mod vest");
    assert.ok(Math.abs(v.y) < 1e-9);
  });

  test("cosIndfaldsvinkel er 1 naar solen staar vinkelret paa panelet", () => {
    // Panel med 30 graders haeldning mod syd, sol i 60 graders hoejde i syd
    const c = cosIndfaldsvinkel(60, 0, 30, 0);
    assert.ok(Math.abs(c - 1) < 1e-9, `fik ${c}`);
  });

  test("cosIndfaldsvinkel er negativ naar solen staar bag panelet", () => {
    assert.ok(cosIndfaldsvinkel(20, 180, 30, 0) < 0);
  });
});

describe("raekkeafstand og selvskygning", () => {
  test("raekkeafstand vokser naar solhoejden falder", () => {
    const hoej = raekkeafstand({ panelLaengde: 1.134, haeldningGrader: 15, solhoejdeGrader: 25 });
    const lav = raekkeafstand({ panelLaengde: 1.134, haeldningGrader: 15, solhoejdeGrader: 12 });
    assert.ok(lav > hoej);
  });

  test("selvskygning er praecis 0 ved den dimensionerende solhoejde", () => {
    const pitch = raekkeafstand({ panelLaengde: 1.134, haeldningGrader: 15, solhoejdeGrader: 17 });
    const f = selvskyggetAndel({
      raekkeafstandM: pitch, panelLaengde: 1.134, haeldningGrader: 15,
      solhoejdeGrader: 17, azimutAfvigelseGrader: 0,
    });
    assert.ok(f < 1e-9, `fik ${f}`);
  });

  test("selvskygning er positiv under den dimensionerende solhoejde", () => {
    const pitch = raekkeafstand({ panelLaengde: 1.134, haeldningGrader: 15, solhoejdeGrader: 17 });
    const f = selvskyggetAndel({
      raekkeafstandM: pitch, panelLaengde: 1.134, haeldningGrader: 15,
      solhoejdeGrader: 10, azimutAfvigelseGrader: 0,
    });
    assert.ok(f > 0 && f < 1, `fik ${f}`);
  });

  test("ingen selvskygning naar solen staar bag raekken", () => {
    const f = selvskyggetAndel({
      raekkeafstandM: 2, panelLaengde: 1.134, haeldningGrader: 15,
      solhoejdeGrader: 20, azimutAfvigelseGrader: 120,
    });
    assert.equal(f, 0);
  });

  test("aarsSolpunkter har vaegte der summerer til 1", () => {
    const p = aarsSolpunkter(56, 10, { dageIntervalDage: 30 });
    const sum = p.reduce((s, x) => s + x.vaegt, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(p.every((x) => x.hoejde > 0), "kun punkter over horisonten");
  });
});
