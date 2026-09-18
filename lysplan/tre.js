/* 3D-kig ind i butikken.
   Lyset regnes direkte fra armaturerne (direkte komponent, uden reflekser),
   så man kan se lysfordelingen på gulv, reoler og kølemøbler og se forskellen
   med det samme, når armaturer eller inventar ændres. */

const Tre = (() => {

  /* Lysfordelingen ligger i en tabel slået op på cos(vinklen fra sigteretningen),
     så der hverken bruges acos eller pow under beregningen.

     - "symmetrisk" er den klassiske I(θ) = I0·cos^n(θ)
     - "batwing" har sit maksimum ude i siden, som et skinnearmatur der skal
       lyse på varerne i reolen frem for ned i gulvet
     Tabellen normeres, så den samlede lysstrøm passer med armaturets lumen. */
  const TABEL = 128;

  function byggTabel(f) {
    const grader = f.spredning || (f.symbol === 'spot' ? 36 : (f.symbol === 'bricks' ? 100 : 110));
    const halv = Math.max(5, Math.min(85, grader / 2)) * Math.PI / 180;
    const n = Math.log(0.5) / Math.log(Math.max(0.02, Math.cos(halv)));
    const batwing = f.fordeling === 'batwing';
    const top = (f.batwingVinkel || 58) * Math.PI / 180;
    const bredde = (f.batwingBredde || 26) * Math.PI / 180;
    const vægt = f.batwingVaegt != null ? f.batwingVaegt : 1.6;

    const form = new Float64Array(TABEL + 1);
    for (let i = 0; i <= TABEL; i++) {
      const u = i / TABEL;                       // u = cos(θ)
      let v = Math.pow(u, n);
      if (batwing) {
        const θ = Math.acos(Math.min(1, u));
        v += vægt * Math.exp(-Math.pow((θ - top) / bredde, 2)) * u;
      }
      form[i] = v;
    }
    // Φ = 2π ∫ I(u) du over u fra 0 til 1
    let integral = 0;
    for (let i = 0; i < TABEL; i++) integral += (form[i] + form[i + 1]) / 2 / TABEL;
    const skala = f.lm / Math.max(1e-6, 2 * Math.PI * integral);
    for (let i = 0; i <= TABEL; i++) form[i] *= skala;
    return form;
  }

  /* Tabellerne caches pr. armaturtype, men nulstilles hvis kataloget rettes. */
  const cache = new Map();
  function armaturLys(type) {
    const f = FIXTURES[type] || { lm: 1000 };
    const nøgle = [type, f.lm, f.spredning, f.fordeling, f.batwingVaegt, f.batwingVinkel, f.batwingBredde].join('|');
    let t = cache.get(nøgle);
    if (!t) { t = byggTabel(f); cache.set(nøgle, t); }
    return t;
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
      if (cosTheta <= 0.004) continue;
      const cosInd = -(dx * normal[0] + dy * normal[1] + dz * normal[2]) / d;
      if (cosInd <= 0) continue;
      const t = cosTheta * TABEL;
      const i0 = t | 0;
      const rest = t - i0;
      const I = l.tabel[i0] + (l.tabel[Math.min(TABEL, i0 + 1)] - l.tabel[i0]) * rest;
      sum += (I * cosInd) / d2;
    }
    return sum * vedligehold;
  }

  /* Armaturerne omsat til lyspunkter i meter. */
  function lamper(state) {
    const m = state.pxPerMeter || 100;
    const h = state.indst.monteringshoejde || Math.max(2.2, (state.indst.loftshoejde || 3.2) - 0.35);
    return state.armaturer.map(a => {
      const f = FIXTURES[a.type];
      const s = a.sigte || [0, 0, -1];
      const sl = Math.hypot(s[0], s[1], s[2]) || 1;
      return {
        x: a.x / m, y: a.y / m, z: h, tabel: armaturLys(a.type), type: a.type, lm: f ? f.lm : 0,
        vinkel: a.vinkel || 0, sx: s[0] / sl, sy: s[1] / sl, sz: s[2] / sl
      };
    });
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

  /* Det reflekterede lys. Rummets flader kaster lyset tilbage, og bidraget
     regnes med den klassiske interrefleksionsformel:
        E = Φ · MF · ρ / (A_flader · (1 − ρ))
     hvor ρ er den arealvægtede middelrefleksion. SJOC's DIALux-rapporter
     regner med loft 70 %, vægge 50 % og gulv 20 %. */
  /* Rummets samlede flader. Interrefleksionen hører til rummet som helhed -
     ikke til den enkelte zone - så alle zoner får det samme bidrag. */
  function rumFlader(state) {
    const m = state.pxPerMeter || 100;
    const zoner = (state.zoner || []).filter(z => z.pts && z.pts.length > 2 && z.type !== 'ude');
    if (!zoner.length) return null;
    let areal = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const z of zoner) {
      const poly = z.pts.map(p => [p[0] / m, p[1] / m]);
      areal += Geom.polygonArea(poly);
      for (const p of poly) {
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
    }
    // ydervæggene tilnærmes med omkredsen af det samlede areal
    return { areal, omkreds: 2 * ((x1 - x0) + (y1 - y0)) };
  }

  function rumRefleks(state, lysListe) {
    const rum = rumFlader(state);
    if (!rum) return 0;
    return reflekteret(state, rum.areal, rum.omkreds, lysListe || lamper(state));
  }

  function reflekteret(state, arealM2, omkredsM, lys) {
    const i = state.indst || {};
    const r = { loft: i.refleksLoft || 0.7, vaeg: i.refleksVaeg || 0.5, gulv: i.refleksGulv || 0.2 };
    const h = i.loftshoejde || 3.2;
    const mf = i.mf || 0.8;
    if (!(arealM2 > 0)) return 0;
    const vægareal = Math.max(1, omkredsM * h);
    const flader = arealM2 * 2 + vægareal;
    const ρ = (r.loft * arealM2 + r.gulv * arealM2 + r.vaeg * vægareal) / flader;
    const flux = lys.reduce((a, l) => a + (l.lm || 0), 0) * mf;
    return (flux * ρ) / (flader * Math.max(0.05, 1 - ρ));
  }

  function omkreds(poly) {
    let l = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      l += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return l;
  }

  /* Lodret belysningsstyrke, adaptiv: den retning der giver mest lys,
     som DIALux regner den i salgsområder. */
  function lodretAdaptiv(p, lys, mf) {
    let maks = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      maks = Math.max(maks, lux(p, [Math.cos(a), Math.sin(a), 0], lys, mf));
    }
    return maks;
  }

  /* Måltal for en flade, som lysberegningerne opgiver dem:
     gennemsnit, mindste, største, Uo = Emin/Ē og g2 = Emin/Emaks. */
  function planTal(state, polyM, valg) {
    const lys = lamper(state);
    const mf = (state.indst && state.indst.mf) || 0.8;
    const højde = valg.hoejde != null ? valg.hoejde : 0.8;
    const celle = valg.celle || 0.5;
    const xs = polyM.map(p => p[0]), ys = polyM.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const felter = valg.medMøbler === false ? [] : inventarFelter(state);
    const indirekte = valg.udenRefleks ? 0 : rumRefleks(state);
    let sum = 0, n = 0, min = Infinity, maks = 0;
    for (let y = y0 + celle / 2; y < y1; y += celle) {
      for (let x = x0 + celle / 2; x < x1; x += celle) {
        if (!Geom.pointInPolygon([x, y], polyM)) continue;
        if (underMøbel([x, y], felter)) continue;
        const p = [x, y, højde];
        // det reflekterede lys er nogenlunde ens uanset fladens retning,
        // fordi rummets flader lyser fra alle sider
        const e = (valg.metrik === 'lodret' ? lodretAdaptiv(p, lys, mf) : lux(p, [0, 0, 1], lys, mf)) + indirekte;
        sum += e; n++;
        if (e < min) min = e;
        if (e > maks) maks = e;
      }
    }
    if (!n) return { snit: 0, min: 0, maks: 0, uo: 0, g2: 0, celler: 0, indirekte };
    const snit = sum / n;
    return { snit, min, maks, uo: snit > 0 ? min / snit : 0, g2: maks > 0 ? min / maks : 0, celler: n, indirekte };
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
    const omgivende = rumRefleks(state);
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

    // møblerne bygges op af flader (sokkel, hylder, varer, låger), så
    // lyset kan beregnes på den enkelte flade
    const fladeLys = (midt, n) => {
      const gulvForan = lux([midt[0] + n[0] * 1.1, midt[1] + n[1] * 1.1, 0], [0, 0, 1], lys, vedligehold);
      return lux(midt, n, lys, vedligehold) + omgivende + gulvForan * 0.22 * (1 - Math.abs(n[2]));
    };

    const kasser = state.inventar.map(i => {
      const t = Inventar.INVENTAR_TYPER[i.type] || Inventar.INVENTAR_TYPER.andet;
      const iMeter = {
        ...i,
        centrum: [i.centrum[0] / m, i.centrum[1] / m],
        laengde: i.laengde, dybde: i.dybde, hoejde: i.hoejde
      };
      const flader = Moebler.byg(iMeter).map(f => {
        const normal = fladeNormal(f.punkter);
        const midt = midtpunkt(f.punkter);
        // Fladens forside kendes ikke af tegnerækkefølgen, så lyset regnes fra
        // begge sider, og den lyse side vises. Oven i det direkte lys lægges
        // det, gulvet foran fladen kaster tilbage - ellers står gavle helt sorte.
        const e = Math.max(fladeLys(midt, normal), fladeLys(midt, [-normal[0], -normal[1], -normal[2]]));
        return { punkter: f.punkter, farve: f.farve, glas: f.glas, slags: f.slags, lux: e };
      });
      return {
        id: i.id, type: i.type, navn: i.kategori || t.navn, sider: flader,
        højde: i.hoejde || 1.8, centrum: iMeter.centrum
      };
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
        const midtVæg = [midt[0], midt[1], loft * 0.45];
        vægge.push({
          punkter: [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], loft], [a[0], a[1], loft]],
          lux: Math.max(fladeLys(midtVæg, normal), fladeLys(midtVæg, [-normal[0], -normal[1], 0]))
        });
      }
    });

    return { ramme, gulv, kasser, vægge, lys, celle, vedligehold, omgivende, loft };
  }

  /* Hurtig gennemsnitsberegning for én zone - bruges når planen dimensioneres. */
  function zoneSnit(state, pts, celle, kunRolle) {
    const m = state.pxPerMeter || 100;
    const k = state.indst.mf || 0.8;
    let lys = lamper(state);
    if (kunRolle) lys = lys.filter(l => (FIXTURES[l.type] || {}).rolle === kunRolle);
    const poly = pts.map(p => [p[0] / m, p[1] / m]);
    // når der kun regnes på grundbelysningen, tæller kun dens eget reflekterede lys med
    const indirekte = rumRefleks(state, lys);
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    celle = celle || 0.6;
    const felter = inventarFelter(state);
    let sum = 0, n = 0, min = Infinity;
    for (let y = y0 + celle / 2; y < y1; y += celle) {
      for (let x = x0 + celle / 2; x < x1; x += celle) {
        if (!Geom.pointInPolygon([x, y], poly)) continue;
        if (underMøbel([x, y], felter)) continue;
        const e = lux([x, y, 0], [0, 0, 1], lys, k) + indirekte;
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

  function midtpunkt(punkter) {
    const n = punkter.length;
    return [
      punkter.reduce((a, p) => a + p[0], 0) / n,
      punkter.reduce((a, p) => a + p[1], 0) / n,
      punkter.reduce((a, p) => a + p[2], 0) / n
    ];
  }

  /* Fladens normal, vendt opad eller udad efter hvor lyset kommer fra. */
  function fladeNormal(p) {
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (nz < -0.001) { nx = -nx; ny = -ny; nz = -nz; }   // vandrette flader vender opad
    return [nx, ny, nz];
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
  /* Farverne regnes som [r,g,b], så lysriggen kan lægges oven på uden
     strengfusk, og først sættes sammen til en css-farve når fladen tegnes. */
  function tilRgb(farve) {
    if (Array.isArray(farve)) return farve;
    if (farve[0] === '#') {
      return [parseInt(farve.slice(1, 3), 16), parseInt(farve.slice(3, 5), 16), parseInt(farve.slice(5, 7), 16)];
    }
    const t = (farve.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
    if (farve.startsWith('rgb')) return [t[0], t[1], t[2]];
    // hsl(h, s%, l%)
    const h = t[0] / 360, sa = t[1] / 100, li = t[2] / 100;
    const a = sa * Math.min(li, 1 - li);
    const k = n => {
      const q = (n + h * 12) % 12;
      return Math.round(255 * (li - a * Math.max(-1, Math.min(q - 3, 9 - q, 1))));
    };
    return [k(0), k(8), k(4)];
  }

  const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const spænd = v => v < 0 ? 0 : v > 255 ? 255 : v;

  function luxFarve(l, maks, tilstand) {
    const t = Math.max(0, Math.min(1, l / Math.max(1, maks)));
    if (tilstand === 'falsk') {
      // blå → grøn → gul → rød, som et lysberegningsprogram
      const trin = [[26, 43, 92], [24, 110, 140], [40, 160, 110], [190, 190, 60], [225, 120, 45], [220, 60, 45]];
      const p = t * (trin.length - 1);
      const i = Math.min(trin.length - 2, Math.floor(p));
      const f = p - i;
      return trin[i].map((v, k) => Math.round(v + (trin[i + 1][k] - v) * f));
    }
    // realistisk: varmt lys på en lys grå flade
    const b = 0.12 + 0.88 * Math.pow(t, 0.65);
    return [Math.round(232 * b), Math.round(226 * b), Math.round(212 * b)];
  }

  function fladeFarve(hex, l, maks, tilstand) {
    if (tilstand === 'falsk') return luxFarve(l, maks, 'falsk');
    const c = tilRgb(hex);
    // varernes farve tones op og ned med lyset
    const b = 0.18 + 0.82 * Math.pow(Math.max(0, Math.min(1, l / Math.max(1, maks))), 0.6);
    return [c[0] * b, c[1] * b, c[2] * b];
  }

  /* ---- lysrig ----
     Lysberegningen alene giver en flad tegning: to sider af samme reol har
     samme lux og dermed samme farve, så kanten forsvinder. Derfor lægges et
     lille rig oven på billedet - et hovedlys, et udfyldningslys, et ambient
     niveau og en svag spejling, som et CAD-program gør det. Det ændrer kun
     billedet, aldrig lux-tallene, og i falske farver er det slået fra, fordi
     farven dér ER måleresultatet. */
  const enhed = v => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const RIG = {
    ambient: 0.34,
    lys: [
      { retning: enhed([0.45, 0.35, 0.82]), styrke: 0.68 },
      { retning: enhed([-0.55, -0.45, 0.30]), styrke: 0.28 }
    ],
    spejl: 0.20, haardhed: 18
  };

  function fladeNormal(p) {
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    return enhed([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  }

  /* To-sidet belysning: fladernes omløbsretning er ikke ensrettet, så
     der regnes på den numeriske vinkel, ikke på fortegnet. */
  function rigSkygge(n, modØje) {
    let d = RIG.ambient;
    for (const l of RIG.lys) {
      d += l.styrke * Math.abs(n[0] * l.retning[0] + n[1] * l.retning[1] + n[2] * l.retning[2]);
    }
    const l0 = RIG.lys[0].retning;
    const h = enhed([l0[0] + modØje[0], l0[1] + modØje[1], l0[2] + modØje[2]]);
    const nh = Math.abs(n[0] * h[0] + n[1] * h[1] + n[2] * h[2]);
    return { diffus: Math.min(1.25, d), spejl: RIG.spejl * Math.pow(nh, RIG.haardhed) };
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

    // loftrummet får en svag overgang, så rummet får en top og ikke en flad væg
    const himmel = ctx.createLinearGradient(0, 0, 0, højde);
    if (tilstand === 'falsk') {
      himmel.addColorStop(0, '#080C16'); himmel.addColorStop(1, '#131B2C');
    } else {
      himmel.addColorStop(0, '#171A21'); himmel.addColorStop(1, '#2A2F38');
    }
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, bredde, højde);

    const rig = tilstand !== 'falsk';
    const flader = [];
    const tilføj = (punkter, farve, slags, ekstra) => {
      const syn = punkter.map(tilSyn);
      if (!syn.some(q => q[2] > naer)) return;
      const klippet = klipModNaerplan(syn, naer);
      if (klippet.length < 3) return;
      const skærm = klippet.map(tilSkærm);
      const dybde = klippet.reduce((a, q) => a + q[2], 0) / klippet.length;
      let c = tilRgb(farve);
      if (rig && slags !== 'lampe' && punkter.length >= 3) {
        const n = fladeNormal(punkter);
        const midt = punkter.reduce((a, q) => [a[0] + q[0], a[1] + q[1], a[2] + q[2]], [0, 0, 0])
          .map(v => v / punkter.length);
        const modØje = enhed([øje[0] - midt[0], øje[1] - midt[1], øje[2] - midt[2]]);
        const sk = rigSkygge(n, modØje);
        const glans = 255 * sk.spejl;
        c = [spænd(c[0] * sk.diffus + glans), spænd(c[1] * sk.diffus + glans), spænd(c[2] * sk.diffus + glans)];
      }
      flader.push({ skærm, farve: css(c), kant: css([c[0] * 0.68, c[1] * 0.68, c[2] * 0.68]), dybde, slags, ekstra });
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
        tilføj(side.punkter, fladeFarve(side.farve, side.lux, maks, tilstand),
          side.glas ? 'glas' : 'kasse', { kasse: k, side });
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
      if (fl.slags === 'glas') {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = fl.farve;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = fl.farve;
      ctx.fill();
      if (fl.slags === 'kasse' || fl.slags === 'væg') {
        // kanten tegnes i fladens egen tone, så to sider af samme møbel
        // skiller sig ad uden at billedet bliver et trådnet
        ctx.strokeStyle = fl.kant;
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

  return { byggScene, gulvNet, zoneTal, zoneSnit, planTal, lodretAdaptiv, reflekteret, rumRefleks, tegn, gulvTal, lux, lamper, luxFarve };
})();
