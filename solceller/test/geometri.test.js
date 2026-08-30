import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  areal, centroide, punktIPolygon, afstandTilRand, rektangelInde,
  overlapper, rektangelHjoerner, lokaltPlan, normaliserRing, bbox,
} from "../server/lib/geometri.js";

const kvadrat = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

describe("geometri", () => {
  test("areal af kvadrat", () => {
    assert.equal(areal(kvadrat), 100);
  });

  test("areal er uafhaengigt af omloebsretning", () => {
    assert.equal(areal([...kvadrat].reverse()), 100);
  });

  test("normaliserRing fjerner gentaget slutpunkt og vender mod uret", () => {
    const lukket = [...kvadrat, { x: 0, y: 0 }];
    const n = normaliserRing(lukket);
    assert.equal(n.length, 4);
  });

  test("centroide af kvadrat", () => {
    const c = centroide(kvadrat);
    assert.ok(Math.abs(c.x - 5) < 1e-9 && Math.abs(c.y - 5) < 1e-9);
  });

  test("punktIPolygon", () => {
    assert.ok(punktIPolygon({ x: 5, y: 5 }, kvadrat));
    assert.ok(!punktIPolygon({ x: 15, y: 5 }, kvadrat));
    assert.ok(punktIPolygon({ x: 0, y: 5 }, kvadrat), "randen regnes som indenfor");
  });

  test("punktIPolygon virker paa konkav L-form", () => {
    const L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
               { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
    assert.ok(punktIPolygon({ x: 2, y: 8 }, L));
    assert.ok(!punktIPolygon({ x: 8, y: 8 }, L), "indhakket er udenfor");
  });

  test("afstandTilRand", () => {
    assert.equal(afstandTilRand({ x: 5, y: 5 }, kvadrat), 5);
    assert.equal(afstandTilRand({ x: 1, y: 5 }, kvadrat), 1);
  });

  test("rektangelInde respekterer margin", () => {
    const r = rektangelHjoerner({ x: 2, y: 2, bredde: 6, hoejde: 6 });
    assert.ok(rektangelInde(r, kvadrat, 1.9));
    assert.ok(!rektangelInde(r, kvadrat, 2.5), "margin paa 2,5 m kan ikke overholdes");
  });

  test("overlapper (SAT)", () => {
    const a = rektangelHjoerner({ x: 0, y: 0, bredde: 4, hoejde: 4 });
    const b = rektangelHjoerner({ x: 3, y: 3, bredde: 4, hoejde: 4 });
    const c = rektangelHjoerner({ x: 10, y: 10, bredde: 4, hoejde: 4 });
    assert.ok(overlapper(a, b));
    assert.ok(!overlapper(a, c));
  });

  test("lokaltPlan er konsistent frem og tilbage", () => {
    const plan = lokaltPlan(56.15, 10.21);
    const punkt = { lat: 56.1520, lon: 10.2130 };
    const tilbage = plan.tilGrad(plan.tilMeter(punkt));
    assert.ok(Math.abs(tilbage.lat - punkt.lat) < 1e-9);
    assert.ok(Math.abs(tilbage.lon - punkt.lon) < 1e-9);
  });

  test("lokaltPlan giver rigtige afstande i meter", () => {
    const plan = lokaltPlan(56.15, 10.21);
    // 0,001 grad breddegrad er ca. 111,3 m paa denne bredde
    const { y } = plan.tilMeter({ lat: 56.151, lon: 10.21 });
    assert.ok(Math.abs(y - 111.3) < 1.0, `fik ${y} m`);
  });

  test("bbox", () => {
    const b = bbox(kvadrat);
    assert.deepEqual(b, { minX: 0, maxX: 10, minY: 0, maxY: 10 });
  });
});
