/* 3D-kig ind i butikken.
   Lyset regnes direkte fra armaturerne (direkte komponent, uden reflekser),
   så man kan se lysfordelingen på gulv, reoler og kølemøbler og se forskellen
   med det samme, når armaturer eller inventar ændres. */

const Tre = (() => {

  /* Lysfordeling: I(θ) = I0 · cos^n(θ). n følger af spredningsvinklen,
     og I0 skalerer, så den samlede lysstrøm passer med armaturets lumen. */
  function fordeling(f) {
    const grader = f.spredning || (f.symbol === 'spot' ? 36 : (f.symbol === 'bricks' ? 80 : 110));
    const halv = Math.max(5, Math.min(85, grader / 2)) * Math.PI / 180;
    const n = Math.log(0.5) / Math.log(Math.max(0.02, Math.cos(halv)));
    return { n, i0: (f.lm * (n + 1)) / (2 * Math.PI) };
  }

  /* Gulvet under et møbel måles ikke - det er hylder og sokkel, ikke gangareal. */
  function inventarFelter(state) {
    const m = state.pxPerMeter || 100;
    return (state.inventar || []).map(i => {
      const poly = i.hjørner.map(p => [p[0] / m, p[1] / m]);
      const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
      return { poly, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    });
  }

  function underMøbel(p, felter) {
    for (const f of felter) {
      if (p[0] < f.x0 || p[0] > f.x1 || p[1] < f.y0 || p[1] > f.y1) continue;
      if (Geom.pointInPolygon(p, f.poly)) return true;
    }
    return false;
  }

  const cache = new Map();
  function armaturLys(type) {
    if (!cache.has(type)) cache.set(type, fordeling(FIXTURES[type] || { lm: 1000 }));
    return cache.get(type);
  }

  /* Belysningsstyrke i et punkt på en flade med normalen n. */
  function lux(p, normal, lamper, vedligehold) {
    let sum = 0;
    for (const l of lamper) {
      const dx = p[0] - l.x, dy = p[1] - l.y, dz = p[2] - l.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 0.0025 || d2 > 900) continue;
      const d = Math.sqrt(d2);
      // vinklen måles fra armaturets sigteretning (nedad, eller drejet mod en reol)
      const cosTheta = (dx * l.sx + dy * l.sy + dz * l.sz) / d;
      if (cosTheta <= 0.01) continue;
      const cosInd = -(dx * normal[0] + dy * normal[1] + dz * normal[2]) / d;
      if (cosInd <= 0) continue;
      sum += (l.i0 * Math.pow(cosTheta, l.n) * cosInd) / d2;
    }
    return sum * vedligehold;
  }

  /* Armaturerne omsat til lyspunkter i meter. */
  function lamper(state) {
    const m = state.pxPerMeter || 100;
    const h = state.indst.monteringshoejde || Math.max(2.2, (state.indst.loftshoejde || 3.2) - 0.35);
    return state.armaturer.map(a => {
      const f = FIXTURES[a.type];
      const l = armaturLys(a.type);
      const s = a.sigte || [0, 0, -1];
      const sl = Math.hypot(s[0], s[1], s[2]) || 1;
      return {
        x: a.x / m, y: a.y / m, z: h, n: l.n, i0: l.i0, type: a.type, lm: f ? f.lm : 0,
        vinkel: a.vinkel || 0, sx: s[0] / sl, sy: s[1] / sl, sz: s[2] / sl
      };
    });
  }

  /* Gulvnet med beregnet belysningsstyrke. Samme beregning bruges til
     nøgletal, kravkontrol, varmekort i planen og 3D-billedet. */
  function gulvNet(state, celle) {
    const m = state.pxPerMeter || 100;
    const lys = lamper(state);
    const vedligehold = state.indst.mf || 0.8;
    const zoner = state.zoner.filter(z => z.pts.length > 2);
    celle = celle || 0.5;

    let ramme = null;
    const tag = (x, y) => {
      if (!ramme) ramme = { x0: x, y0: y, x1: x, y1: y };
      ramme.x0 = Math.min(ramme.x0, x); ramme.y0 = Math.min(ramme.y0, y);
      ramme.x1 = Math.max(ramme.x1, x); ramme.y1 = Math.max(ramme.y1, y);
    };
    for (const z of zoner) for (const p of z.pts) tag(p[0] / m, p[1] / m);
    for (const i of state.inventar) for (const p of i.hjørner) tag(p[0] / m, p[1] / m);
    for (const l of lys) tag(l.x, l.y);
    if (!ramme) return null;

    const polygoner = zoner.map(z => ({ id: z.id, poly: z.pts.map(p => [p[0] / m, p[1] / m]) }));
    const felter = inventarFelter(state);
    const gulv = [];
    for (let y = ramme.y0; y < ramme.y1; y += celle) {
      for (let x = ramme.x0; x < ramme.x1; x += celle) {
        const c = [x + celle / 2, y + celle / 2];
        let zoneId = null;
        for (const z of polygoner) if (Geom.pointInPolygon(c, z.poly)) { zoneId = z.id; break; }
        if (!zoneId && polygoner.length) continue;
        if (underMøbel(c, felter)) continue;
        gulv.push({ x, y, celle, zoneId, direkte: lux([c[0], c[1], 0], [0, 0, 1], lys, vedligehold) });
      }
    }
    // reflekteret lys fra loft, vægge og varer lægges til som en jævn baggrund
    const snitDirekte = gulv.length ? gulv.reduce((a, g) => a + g.direkte, 0) / gulv.length : 0;
    const omgivende = snitDirekte * Math.max(0, (state.indst.refleks || 1) - 1);
    for (const g of gulv) g.lux = g.direkte + omgivende;
    return { ramme, gulv, lys, celle, vedligehold, omgivende };
  }

  /* Scene: gulvnet, kasser for inventar og markeringer for armaturer. */
  function byggScene(state, valg) {
    const m = state.pxPerMeter || 100;
    const net = (valg && valg.net) || gulvNet(state, valg && valg.celle);
    if (!net) return null;
    const { ramme, gulv, lys, celle, vedligehold } = net;
    const omgivende = net.omgivende || 0;
    const zoner = state.zoner.filter(z => z.pts.length > 2);

    const kasser = state.inventar.map(i => {
      const hj = i.hjørner.map(p => [p[0] / m, p[1] / m]);
      const højde = i.hoejde || 1.8;
      const t = Inventar.INVENTAR_TYPER[i.type] || Inventar.INVENTAR_TYPER.andet;
      const sider = [];
      for (let k = 0; k < 4; k++) {
        const a = hj[k], b = hj[(k + 1) % 4];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        const normal = [dy / l, -dx / l, 0];
        const midt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, højde * 0.55];
        sider.push({
          punkter: [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], højde], [a[0], a[1], højde]],
          lux: lux(midt, normal, lys, vedligehold) + omgivende, farve: t.farve, normal
        });
      }
      const midtTop = [(hj[0][0] + hj[2][0]) / 2, (hj[0][1] + hj[2][1]) / 2, højde];
      sider.push({
        punkter: hj.map(p => [p[0], p[1], højde]),
        lux: lux(midtTop, [0, 0, 1], lys, vedligehold) + omgivende, farve: t.farve, top: true
      });
      return { id: i.id, type: i.type, navn: i.kategori || t.navn, sider, højde, centrum: [midtTop[0], midtTop[1]] };
    });

    const loft = state.indst.loftshoejde || 3.2;
    const vægge = [];
    const zonePolys = zoner.map(z => z.pts.map(p => [p[0] / m, p[1] / m]));
    zonePolys.forEach((poly, zi) => {
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        const ud = [dy / l, -dx / l];
        const midt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // kanter mellem to zoner er ikke vægge
        const prøv = [[midt[0] + ud[0] * 0.2, midt[1] + ud[1] * 0.2], [midt[0] - ud[0] * 0.2, midt[1] - ud[1] * 0.2]];
        const nabo = zonePolys.some((p2, j) => j !== zi && prøv.some(q => Geom.pointInPolygon(q, p2)));
        if (nabo) continue;
        const indad = Geom.pointInPolygon([midt[0] - ud[0] * 0.2, midt[1] - ud[1] * 0.2], poly) ? -1 : 1;
        const normal = [ud[0] * indad, ud[1] * indad, 0];
        vægge.push({
          punkter: [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], loft], [a[0], a[1], loft]],
          lux: lux([midt[0], midt[1], loft * 0.45], normal, lys, vedligehold) + omgivende
        });
      }
    });

    return { ramme, gulv, kasser, vægge, lys, celle, vedligehold, omgivende, loft };
  }

  /* Hurtig gennemsnitsberegning for én zone - bruges når planen dimensioneres. */
  function zoneSnit(state, pts, celle, kunRolle) {
    const m = state.pxPerMeter || 100;
    const k = (state.indst.mf || 0.8) * (state.indst.refleks || 1);
    let lys = lamper(state);
    if (kunRolle) lys = lys.filter(l => (FIXTURES[l.type] || {}).rolle === kunRolle);
    const poly = pts.map(p => [p[0] / m, p[1] / m]);
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    celle = celle || 0.6;
    const felter = inventarFelter(state);
    let sum = 0, n = 0, min = Infinity;
    for (let y = y0 + celle / 2; y < y1; y += celle) {
      for (let x = x0 + celle / 2; x < x1; x += celle) {
        if (!Geom.pointInPolygon([x, y], poly)) continue;
        if (underMøbel([x, y], felter)) continue;
        const e = lux([x, y, 0], [0, 0, 1], lys, k);
        sum += e; n++; min = Math.min(min, e);
      }
    }
    return n ? { snit: sum / n, min, celler: n } : { snit: 0, min: 0, celler: 0 };
  }

  /* Nøgletal for én zone ud fra gulvnettet. */
  function zoneTal(net, zoneId) {
    if (!net) return { snit: 0, min: 0, maks: 0, jaevnhed: 0, celler: 0 };
    let sum = 0, min = Infinity, maks = 0, n = 0;
    for (const g of net.gulv) {
      if (zoneId && g.zoneId !== zoneId) continue;
      sum += g.lux; min = Math.min(min, g.lux); maks = Math.max(maks, g.lux); n++;
    }
    if (!n) return { snit: 0, min: 0, maks: 0, jaevnhed: 0, celler: 0 };
    const snit = sum / n;
    return { snit, min, maks, jaevnhed: snit > 0 ? min / snit : 0, celler: n };
  }

  /* ---- kamera og projektion ---- */
  function basis(kamera) {
    const cy = Math.cos(kamera.retning), sy = Math.sin(kamera.retning);
    const cp = Math.cos(kamera.tilt), sp = Math.sin(kamera.tilt);
    return {
      frem: [cy * cp, sy * cp, sp],
      højre: [-sy, cy, 0],
      op: [-cy * sp, -sy * sp, cp]
    };
  }

  function klipModNaerplan(punkter, naer) {
    const ud = [];
    for (let i = 0; i < punkter.length; i++) {
      const a = punkter[i], b = punkter[(i + 1) % punkter.length];
      const ina = a[2] >= naer, inb = b[2] >= naer;
      if (ina) ud.push(a);
      if (ina !== inb) {
        const t = (naer - a[2]) / (b[2] - a[2]);
        ud.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, naer]);
      }
    }
    return ud;
  }

  /* ---- farver ---- */
  function luxFarve(l, maks, tilstand) {
    const t = Math.max(0, Math.min(1, l / Math.max(1, maks)));
    if (tilstand === 'falsk') {
      // blå → grøn → gul → rød, som et lysberegningsprogram
      const trin = [[26, 43, 92], [24, 110, 140], [40, 160, 110], [190, 190, 60], [225, 120, 45], [220, 60, 45]];
      const p = t * (trin.length - 1);
      const i = Math.min(trin.length - 2, Math.floor(p));
      const f = p - i;
      const c = trin[i].map((v, k) => Math.round(v + (trin[i + 1][k] - v) * f));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    // realistisk: varmt lys på en lys grå flade
    const b = 0.12 + 0.88 * Math.pow(t, 0.65);
    return `rgb(${Math.round(232 * b)},${Math.round(226 * b)},${Math.round(212 * b)})`;
  }

  function fladeFarve(hex, l, maks, tilstand) {
    if (tilstand === 'falsk') return luxFarve(l, maks, 'falsk');
    const b = 0.18 + 0.82 * Math.pow(Math.max(0, Math.min(1, l / Math.max(1, maks))), 0.6);
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), bl = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * b)},${Math.round(g * b)},${Math.round(bl * b)})`;
  }

  /* ---- tegning ---- */
  function tegn(ctx, bredde, højde, kamera, scene, valg) {
    const { frem, højre, op } = basis(kamera);
    const f = (højde / 2) / Math.tan(((valg.fov || 70) * Math.PI / 180) / 2);
    const øje = [kamera.x, kamera.y, kamera.h];
    const naer = 0.12;
    const tilstand = valg.farvetilstand || 'realistisk';
    const maks = valg.maksLux || 1200;

    const tilSyn = p => {
      const dx = p[0] - øje[0], dy = p[1] - øje[1], dz = p[2] - øje[2];
      return [
        dx * højre[0] + dy * højre[1] + dz * højre[2],
        dx * op[0] + dy * op[1] + dz * op[2],
        dx * frem[0] + dy * frem[1] + dz * frem[2]
      ];
    };
    const tilSkærm = q => [bredde / 2 + (f * q[0]) / q[2], højde / 2 - (f * q[1]) / q[2]];

    // himmel/loft og gulvtone
    ctx.fillStyle = tilstand === 'falsk' ? '#0C1220' : '#20242C';
    ctx.fillRect(0, 0, bredde, højde);

    const flader = [];
    const tilføj = (punkter, farve, slags, ekstra) => {
      const syn = punkter.map(tilSyn);
      if (!syn.some(q => q[2] > naer)) return;
      const klippet = klipModNaerplan(syn, naer);
      if (klippet.length < 3) return;
      const skærm = klippet.map(tilSkærm);
      const dybde = klippet.reduce((a, q) => a + q[2], 0) / klippet.length;
      flader.push({ skærm, farve, dybde, slags, ekstra });
    };

    for (const g of scene.gulv) {
      tilføj([
        [g.x, g.y, 0], [g.x + g.celle, g.y, 0],
        [g.x + g.celle, g.y + g.celle, 0], [g.x, g.y + g.celle, 0]
      ], luxFarve(g.lux, maks, tilstand), 'gulv', g);
    }
    for (const v of scene.vægge || []) {
      tilføj(v.punkter, fladeFarve('#D8D4CA', v.lux, maks, tilstand), 'væg', v);
    }
    for (const k of scene.kasser) {
      for (const side of k.sider) {
        tilføj(side.punkter, fladeFarve(side.farve, side.lux, maks, tilstand), 'kasse', { kasse: k, side });
      }
    }
    const h = scene.lys.length ? scene.lys[0].z : 3;
    for (const l of scene.lys) {
      const fx = FIXTURES[l.type] || { laengde: 0.3 };
      const halv = Math.max(0.12, (fx.laengde || 0.3) / 2);
      const c = Math.cos(l.vinkel), s = Math.sin(l.vinkel);
      const b = 0.09;
      tilføj([
        [l.x - c * halv - s * b, l.y - s * halv + c * b, l.z],
        [l.x + c * halv - s * b, l.y + s * halv + c * b, l.z],
        [l.x + c * halv + s * b, l.y + s * halv - c * b, l.z],
        [l.x - c * halv + s * b, l.y - s * halv - c * b, l.z]
      ], tilstand === 'falsk' ? '#FFFFFF' : '#FFF6D8', 'lampe', l);
    }

    flader.sort((a, b) => b.dybde - a.dybde);
    for (const fl of flader) {
      ctx.beginPath();
      ctx.moveTo(fl.skærm[0][0], fl.skærm[0][1]);
      for (const p of fl.skærm.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fillStyle = fl.farve;
      ctx.fill();
      if (fl.slags === 'kasse') {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      } else if (fl.slags === 'lampe') {
        ctx.shadowColor = 'rgba(255,240,200,0.9)';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    return flader.length;
  }

  /* Lux-tal til indbliksfeltet: gennemsnit, mindste og største på gulvet. */
  function gulvTal(scene) {
    if (!scene || !scene.gulv.length) return { snit: 0, min: 0, maks: 0, jaevnhed: 0 };
    let sum = 0, min = Infinity, maks = 0;
    for (const g of scene.gulv) { sum += g.lux; min = Math.min(min, g.lux); maks = Math.max(maks, g.lux); }
    const snit = sum / scene.gulv.length;
    return { snit, min, maks, jaevnhed: snit > 0 ? min / snit : 0 };
  }

  return { byggScene, gulvNet, zoneTal, zoneSnit, tegn, gulvTal, lux, lamper, luxFarve };
})();
