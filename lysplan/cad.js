/* Indlæsning af CAD-tegninger.
   DXF læses direkte her i browseren. DWG læses med LibreDWG (WebAssembly),
   der hentes fra nettet første gang – se DWG_KILDER nedenfor.
   Begge formater ender i den samme normaliserede database, som fladgøres
   til polylinjer og tekst i tegningens egne mål. */

const CAD = (() => {

  /* ---- enheder ---- */
  // $INSUNITS fra DXF-headeren. Værdien angiver tegningens enhed.
  const ENHEDER = {
    0: null, 1: 0.0254, 2: 0.3048, 3: 1609.344, 4: 0.001, 5: 0.01, 6: 1,
    7: 1000, 8: 2.54e-5, 9: 2.54e-8, 10: 0.9144, 11: 1e-10, 12: 1e-9,
    13: 1e-6, 14: 0.1, 15: 10, 16: 100, 17: 1e12, 18: 1.496e11, 19: 9.461e15, 20: 3.086e16
  };

  /* ACI-farver. 1-9 og 250-255 er de faste værdier fra AutoCAD-paletten,
     resten tilnærmes med paletten's opbygning i 24 kulører. */
  const ACI_FAST = {
    0: '#000000', 1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
    5: '#0000FF', 6: '#FF00FF', 7: '#000000', 8: '#808080', 9: '#C0C0C0',
    250: '#333333', 251: '#505050', 252: '#696969', 253: '#828282', 254: '#BEBEBE', 255: '#FFFFFF'
  };

  function aciFarve(i) {
    if (ACI_FAST[i]) return ACI_FAST[i];
    if (i < 10 || i > 249) return '#000000';
    const n = i - 10;
    const kulør = Math.floor(n / 10) * 15;          // 24 kulører a 15 grader
    const trin = n % 10;
    const lys = [1, .65, .5, .3, 1, .65, .5, .3, .5, .3][trin];
    const mæt = trin < 4 ? 1 : (trin < 8 ? .65 : .4);
    return hsvTilHex(kulør, mæt, lys);
  }

  function hsvTilHex(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + t.map(k => Math.round((k + m) * 255).toString(16).padStart(2, '0')).join('');
  }

  /* ---- DXF-læser ---- */
  function parseDxf(tekst) {
    if (/^\s*AutoCAD Binary DXF/.test(tekst.slice(0, 40))) {
      throw new Error('Binær DXF understøttes ikke. Gem som ASCII-DXF.');
    }
    const par = [];
    // Manuel linjescanner – split() på meget store filer koster for meget hukommelse.
    let i = 0;
    const n = tekst.length;
    const næsteLinje = () => {
      if (i >= n) return null;
      let j = tekst.indexOf('\n', i);
      if (j < 0) j = n;
      let s = tekst.slice(i, j);
      i = j + 1;
      if (s.endsWith('\r')) s = s.slice(0, -1);
      return s;
    };
    for (;;) {
      const k = næsteLinje();
      if (k === null) break;
      const v = næsteLinje();
      if (v === null) break;
      const kode = parseInt(k, 10);
      if (isNaN(kode)) continue;
      par.push([kode, v]);
    }

    const db = {
      header: {},
      tables: { LAYER: { entries: [] } },
      blocks: {},
      entities: []
    };

    let p = 0;
    while (p < par.length) {
      const [kode, værdi] = par[p];
      if (kode === 0 && værdi === 'SECTION') {
        const navn = par[p + 1] && par[p + 1][0] === 2 ? par[p + 1][1] : '';
        p += 2;
        if (navn === 'HEADER') p = læsHeader(par, p, db);
        else if (navn === 'TABLES') p = læsTabeller(par, p, db);
        else if (navn === 'BLOCKS') p = læsBlokke(par, p, db);
        else if (navn === 'ENTITIES') p = læsEntiteter(par, p, db.entities);
        else p = spolTilEndsec(par, p);
      } else p++;
    }
    return db;
  }

  const erSlut = (kode, værdi) => kode === 0 && (værdi === 'ENDSEC' || værdi === 'EOF');

  function spolTilEndsec(par, p) {
    while (p < par.length && !erSlut(par[p][0], par[p][1])) p++;
    return p + 1;
  }

  function læsHeader(par, p, db) {
    while (p < par.length && !erSlut(par[p][0], par[p][1])) {
      if (par[p][0] === 9) {
        const navn = par[p][1].replace(/^\$/, '');
        const næste = par[p + 1];
        if (næste) {
          if (næste[0] === 10) {
            db.header[navn] = { x: +næste[1], y: par[p + 2] && par[p + 2][0] === 20 ? +par[p + 2][1] : 0 };
          } else db.header[navn] = isNaN(+næste[1]) ? næste[1] : +næste[1];
        }
      }
      p++;
    }
    return p + 1;
  }

  function læsTabeller(par, p, db) {
    let iLayer = false, nu = null;
    while (p < par.length && !erSlut(par[p][0], par[p][1])) {
      const [kode, værdi] = par[p];
      if (kode === 0 && værdi === 'TABLE') {
        iLayer = par[p + 1] && par[p + 1][1] === 'LAYER';
      } else if (kode === 0 && værdi === 'ENDTAB') {
        if (nu) db.tables.LAYER.entries.push(nu);
        nu = null; iLayer = false;
      } else if (kode === 0 && værdi === 'LAYER' && iLayer) {
        if (nu) db.tables.LAYER.entries.push(nu);
        nu = { name: '', colorIndex: 7, off: false, frozen: false };
      } else if (nu && iLayer) {
        if (kode === 2) nu.name = værdi;
        else if (kode === 62) { nu.colorIndex = Math.abs(+værdi); nu.off = +værdi < 0; }
        else if (kode === 70) nu.frozen = (+værdi & 1) === 1;
      }
      p++;
    }
    if (nu) db.tables.LAYER.entries.push(nu);
    return p + 1;
  }

  function læsBlokke(par, p, db) {
    while (p < par.length && !erSlut(par[p][0], par[p][1])) {
      if (par[p][0] === 0 && par[p][1] === 'BLOCK') {
        const blok = { name: '', basePoint: { x: 0, y: 0 }, entities: [] };
        p++;
        while (p < par.length && !(par[p][0] === 0)) {
          const [kode, værdi] = par[p];
          if (kode === 2) blok.name = værdi;
          else if (kode === 10) blok.basePoint.x = +værdi;
          else if (kode === 20) blok.basePoint.y = +værdi;
          p++;
        }
        p = læsEntiteter(par, p, blok.entities, 'ENDBLK');
        db.blocks[blok.name] = blok;
      } else p++;
    }
    return p + 1;
  }

  /* Samler grupperne for én entitet og bygger et objekt med samme feltnavne
     som LibreDWG's database, så begge formater kan tegnes af samme kode. */
  function læsEntiteter(par, p, ud, stop) {
    let polylinje = null;
    while (p < par.length) {
      const [kode, værdi] = par[p];
      if (kode !== 0) { p++; continue; }
      if (erSlut(kode, værdi) || (stop && værdi === stop)) return p + 1;
      const type = værdi;
      const g = {};
      let q = p + 1;
      while (q < par.length && par[q][0] !== 0) {
        const [k, v] = par[q];
        (g[k] = g[k] || []).push(v);
        q++;
      }
      if (type === 'HATCH') g.__par = par.slice(p + 1, q);
      const e = byggEntitet(type, g);
      if (type === 'POLYLINE') {
        polylinje = e; ud.push(e);
      } else if (type === 'VERTEX' && polylinje) {
        polylinje.vertices.push({ x: +(g[10] || [0])[0], y: +(g[20] || [0])[0], bulge: +(g[42] || [0])[0] });
      } else if (type === 'SEQEND') {
        polylinje = null;
      } else if (e) ud.push(e);
      p = q;
    }
    return p;
  }

  const t1 = (g, k, d = 0) => (g[k] ? +g[k][0] : d);
  const s1 = (g, k, d = '') => (g[k] ? g[k][0] : d);

  function byggEntitet(type, g) {
    const fælles = {
      type, layer: s1(g, 8, '0'),
      colorIndex: g[62] ? Math.abs(+g[62][0]) : 256
    };
    const pt = (kx, ky) => ({ x: t1(g, kx), y: t1(g, ky) });
    switch (type) {
      case 'LINE': return { ...fælles, startPoint: pt(10, 20), endPoint: pt(11, 21) };
      case 'CIRCLE': return { ...fælles, center: pt(10, 20), radius: t1(g, 40) };
      case 'ARC': return {
        ...fælles, center: pt(10, 20), radius: t1(g, 40),
        startAngle: t1(g, 50) * Math.PI / 180, endAngle: t1(g, 51) * Math.PI / 180
      };
      case 'ELLIPSE': return {
        ...fælles, center: pt(10, 20), majorAxisEndPoint: pt(11, 21),
        axisRatio: t1(g, 40, 1), startAngle: t1(g, 41), endAngle: t1(g, 42, Math.PI * 2)
      };
      case 'POINT': return { ...fælles, position: pt(10, 20) };
      case 'LWPOLYLINE': {
        const xs = g[10] || [], ys = g[20] || [], bu = g[42] || [];
        // bulge-koder hører til den foregående knude; DXF skriver dem i rækkefølge
        const vertices = xs.map((x, k) => ({ x: +x, y: +(ys[k] || 0), bulge: 0 }));
        if (bu.length === xs.length) vertices.forEach((v, k) => { v.bulge = +bu[k]; });
        return { ...fælles, vertices, flag: t1(g, 70) };
      }
      case 'POLYLINE': return { ...fælles, vertices: [], flag: t1(g, 70) };
      case 'VERTEX': case 'SEQEND': return null;
      case 'SOLID': case '3DFACE': return {
        ...fælles, corners: [pt(10, 20), pt(11, 21), pt(12, 22), pt(13, 23)]
      };
      case 'TEXT': case 'ATTRIB': return {
        ...fælles, text: s1(g, 1), startPoint: pt(10, 20), endPoint: pt(11, 21),
        textHeight: t1(g, 40, 2.5), rotation: t1(g, 50) * Math.PI / 180,
        halign: t1(g, 72), valign: t1(g, 73)
      };
      case 'MTEXT': return {
        ...fælles, text: (g[3] ? g[3].join('') : '') + s1(g, 1),
        insertionPoint: pt(10, 20), height: t1(g, 40, 2.5),
        rotation: t1(g, 50) * Math.PI / 180, attachmentPoint: t1(g, 71, 1)
      };
      case 'INSERT': return {
        ...fælles, name: s1(g, 2), insertionPoint: pt(10, 20),
        xScale: t1(g, 41, 1), yScale: t1(g, 42, 1), rotation: t1(g, 50) * Math.PI / 180,
        columnCount: t1(g, 70, 1), rowCount: t1(g, 71, 1),
        columnSpacing: t1(g, 44), rowSpacing: t1(g, 45)
      };
      case 'DIMENSION': return { ...fælles, name: s1(g, 2) };
      case 'HATCH': return { ...fælles, boundaryPaths: læsHatchStier(g.__par || []), fraDxf: true };
      case 'MLINE': {
        const xs = g[11] || [], ys = g[21] || [];
        return { ...fælles, vertices: xs.map((x, k) => ({ vertex: { x: +x, y: +(ys[k] || 0) } })), flags: t1(g, 71) };
      }
      case 'SPLINE': {
        const cx = g[10] || [], cy = g[20] || [], fx = g[11] || [], fy = g[21] || [];
        return {
          ...fælles,
          controlPoints: cx.map((x, k) => ({ x: +x, y: +(cy[k] || 0) })),
          fitPoints: fx.map((x, k) => ({ x: +x, y: +(fy[k] || 0) })),
          degree: t1(g, 71, 3), flag: t1(g, 70)
        };
      }
      case 'LEADER': {
        const xs = g[10] || [], ys = g[20] || [];
        return { ...fælles, vertices: xs.map((x, k) => ({ x: +x, y: +(ys[k] || 0), bulge: 0 })) };
      }
      default: return null;   // HATCH, MLINE, 3DSOLID m.fl. springes over
    }
  }

  /* Grænsekurverne i en HATCH står som en sekvens af grupper, så de skal
     læses i rækkefølge - ikke som opsamlede lister. */
  function læsHatchStier(par) {
    const stier = [];
    let sti = null, kant = null;
    const lukKant = () => { if (sti && kant) { sti.edges.push(kant); kant = null; } };
    for (const [kode, værdi] of par) {
      const v = +værdi;
      if (kode === 92) {
        lukKant();
        sti = { boundaryPathTypeFlag: v, polylinje: (v & 2) === 2, vertices: [], edges: [], isClosed: false };
        stier.push(sti);
      } else if (!sti) continue;
      else if (sti.polylinje) {
        if (kode === 73) sti.isClosed = v === 1;
        else if (kode === 10) sti.vertices.push({ x: v, y: 0, bulge: 0 });
        else if (kode === 20 && sti.vertices.length) sti.vertices[sti.vertices.length - 1].y = v;
        else if (kode === 42 && sti.vertices.length) sti.vertices[sti.vertices.length - 1].bulge = v;
      } else {
        if (kode === 72) { lukKant(); kant = { type: v }; }
        else if (!kant) continue;
        else if (kant.type === 1) {
          if (kode === 10) kant.start = { x: v, y: 0 };
          else if (kode === 20 && kant.start) kant.start.y = v;
          else if (kode === 11) kant.end = { x: v, y: 0 };
          else if (kode === 21 && kant.end) kant.end.y = v;
        } else if (kant.type === 2) {
          if (kode === 10) kant.center = { x: v, y: 0 };
          else if (kode === 20 && kant.center) kant.center.y = v;
          else if (kode === 40) kant.radius = v;
          else if (kode === 50) kant.startAngle = (v * Math.PI) / 180;
          else if (kode === 51) kant.endAngle = (v * Math.PI) / 180;
        }
      }
    }
    lukKant();
    return stier.filter(s => s.vertices.length > 1 || s.edges.length);
  }

  /* ---- matrix: (x,y) -> (a*x + c*y + e, b*x + d*y + f) ---- */
  const enhedsM = [1, 0, 0, 1, 0, 0];
  const gang = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  const anvend = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  function indsætM(p, sx, sy, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return [c * sx, s * sx, -s * sy, c * sy, p.x || 0, p.y || 0];
  }

  /* ---- tessellering ---- */
  function bueTilPunkter(cx, cy, r, a0, a1, ud, m) {
    let sweep = a1 - a0;
    while (sweep <= 0) sweep += Math.PI * 2;
    const n = Math.min(240, Math.max(6, Math.ceil(Math.abs(sweep) / (Math.PI / 18))));
    for (let k = 0; k <= n; k++) {
      const a = a0 + (sweep * k) / n;
      const [x, y] = anvend(m, cx + r * Math.cos(a), cy + r * Math.sin(a));
      ud.push(x, y);
    }
  }

  function bulgeTilPunkter(x0, y0, x1, y1, bulge, ud, m) {
    const theta = 4 * Math.atan(bulge);
    const korde = Math.hypot(x1 - x0, y1 - y0);
    if (!korde) return;
    const r = korde / (2 * Math.sin(Math.abs(theta) / 2));
    const retning = theta > 0 ? 1 : -1;
    const midtX = (x0 + x1) / 2, midtY = (y0 + y1) / 2;
    const h = Math.sqrt(Math.max(0, r * r - (korde / 2) ** 2)) * (Math.abs(theta) > Math.PI ? -1 : 1);
    const nx = -(y1 - y0) / korde, ny = (x1 - x0) / korde;
    const cx = midtX + nx * h * retning, cy = midtY + ny * h * retning;
    let a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(y1 - cy, x1 - cx);
    if (retning < 0) { const t = a0; a0 = a1; a1 = t; }
    const før = ud.length;
    bueTilPunkter(cx, cy, r, a0, a1, ud, m);
    if (retning < 0) {
      const del = ud.slice(før);
      ud.length = før;
      for (let k = del.length - 2; k >= 0; k -= 2) ud.push(del[k], del[k + 1]);
    }
  }

  /* Clamped uniform B-spline (de Boor). Bruges når en SPLINE kun har styrepunkter. */
  function splinePunkter(cp, grad, ud, m) {
    const n = cp.length - 1;
    const p = Math.min(Math.max(2, grad), n);
    if (n < 1) return;
    if (n < p) { for (const q of cp) { const [x, y] = anvend(m, q.x, q.y); ud.push(x, y); } return; }
    const knuder = [];
    for (let k = 0; k <= n + p + 1; k++) {
      knuder.push(k < p + 1 ? 0 : (k > n ? n - p + 1 : k - p));
    }
    const trin = Math.min(400, Math.max(40, (n + 1) * 12));
    const umax = knuder[n + 1];
    for (let s = 0; s <= trin; s++) {
      const u = (umax * s) / trin;
      let k = p;
      while (k < n && u >= knuder[k + 1]) k++;
      const d = [];
      for (let j = 0; j <= p; j++) d.push({ x: cp[k - p + j].x, y: cp[k - p + j].y });
      for (let r = 1; r <= p; r++) {
        for (let j = p; j >= r; j--) {
          const i = k - p + j;
          const næv = knuder[i + p - r + 1] - knuder[i];
          const a = næv === 0 ? 0 : (u - knuder[i]) / næv;
          d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y };
        }
      }
      const [x, y] = anvend(m, d[p].x, d[p].y);
      ud.push(x, y);
    }
  }

  /* ---- fladgørelse ---- */
  function fladgør(db, valg = {}) {
    const lagInfo = {};
    for (const l of (db.tables && db.tables.LAYER ? db.tables.LAYER.entries : [])) {
      lagInfo[l.name] = { navn: l.name, aci: l.colorIndex == null ? 7 : l.colorIndex, slukket: !!l.off || !!l.frozen, synlig: !(l.off || l.frozen) };
    }
    const streger = [], tekster = [];
    const springOver = {};
    const blokke = db.blocks || {};

    const tilføjStreg = (e, p, lukket) => {
      if (p.length < 4) return;
      const lag = e.layer || '0';
      if (!lagInfo[lag]) lagInfo[lag] = { navn: lag, aci: 7, slukket: false, synlig: true };
      const aci = (e.colorIndex == null || e.colorIndex === 256) ? lagInfo[lag].aci : (e.colorIndex === 0 ? 7 : e.colorIndex);
      streger.push({ lag, aci, p, lukket: !!lukket });
    };

    function gåEntiteter(liste, m, dybde) {
      if (dybde > 8) return;
      for (const e of liste || []) {
        if (!e || e.isVisible === false) continue;
        const p = [];
        switch (e.type) {
          case 'LINE': {
            const a = anvend(m, e.startPoint.x, e.startPoint.y);
            const b = anvend(m, e.endPoint.x, e.endPoint.y);
            tilføjStreg(e, [a[0], a[1], b[0], b[1]]);
            break;
          }
          case 'CIRCLE':
            bueTilPunkter(e.center.x, e.center.y, e.radius, 0, Math.PI * 2, p, m);
            tilføjStreg(e, p, true);
            break;
          case 'ARC':
            bueTilPunkter(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle, p, m);
            tilføjStreg(e, p);
            break;
          case 'ELLIPSE': {
            const ax = e.majorAxisEndPoint.x, ay = e.majorAxisEndPoint.y;
            const stor = Math.hypot(ax, ay), lille = stor * (e.axisRatio || 1);
            const v = Math.atan2(ay, ax);
            const a0 = e.startAngle || 0;
            let a1 = e.endAngle == null ? Math.PI * 2 : e.endAngle;
            if (a1 <= a0) a1 += Math.PI * 2;
            const n = 120;
            for (let k = 0; k <= n; k++) {
              const t = a0 + ((a1 - a0) * k) / n;
              const x = stor * Math.cos(t), y = lille * Math.sin(t);
              const [wx, wy] = anvend(m,
                e.center.x + x * Math.cos(v) - y * Math.sin(v),
                e.center.y + x * Math.sin(v) + y * Math.cos(v));
              p.push(wx, wy);
            }
            tilføjStreg(e, p);
            break;
          }
          case 'LWPOLYLINE': case 'POLYLINE': case 'LEADER': {
            const v = e.vertices || [];
            for (let k = 0; k < v.length; k++) {
              const a = v[k];
              const [x, y] = anvend(m, a.x, a.y);
              p.push(x, y);
              const næste = v[k + 1] || ((e.flag & 1) && k === v.length - 1 ? v[0] : null);
              if (næste && a.bulge) bulgeTilPunkter(a.x, a.y, næste.x, næste.y, a.bulge, p, m);
            }
            if ((e.flag & 1) && v.length > 2) {
              const [x, y] = anvend(m, v[0].x, v[0].y);
              p.push(x, y);
            }
            tilføjStreg(e, p, e.flag & 1);
            break;
          }
          case 'SPLINE':
            if (e.fitPoints && e.fitPoints.length > 1) {
              for (const q of e.fitPoints) { const [x, y] = anvend(m, q.x, q.y); p.push(x, y); }
            } else if (e.controlPoints && e.controlPoints.length > 1) {
              splinePunkter(e.controlPoints, e.degree || 3, p, m);
            }
            tilføjStreg(e, p);
            break;
          case 'SOLID': case '3DFACE': {
            const h = e.corners || [];
            for (const q of h) { if (!q) continue; const [x, y] = anvend(m, q.x, q.y); p.push(x, y); }
            if (p.length >= 4) { p.push(p[0], p[1]); tilføjStreg(e, p, true); }
            break;
          }
          case 'POINT': {
            const q = e.position || e.startPoint;
            if (!q) break;
            const [x, y] = anvend(m, q.x, q.y);
            tilføjStreg(e, [x - 1, y, x + 1, y]);
            break;
          }
          case 'TEXT': case 'ATTRIB': case 'MTEXT': {
            const q = e.insertionPoint || e.startPoint;
            if (!q || !e.text) break;
            const h = e.textHeight || e.height || 2.5;
            const [x, y] = anvend(m, q.x, q.y);
            const skala = Math.hypot(m[0], m[1]) || 1;
            const lag = e.layer || '0';
            if (!lagInfo[lag]) lagInfo[lag] = { navn: lag, aci: 7, slukket: false, synlig: true };
            const aci = (e.colorIndex == null || e.colorIndex === 256) ? lagInfo[lag].aci : (e.colorIndex === 0 ? 7 : e.colorIndex);
            tekster.push({
              lag, aci, x, y, h: h * skala,
              v: (e.rotation || 0) + Math.atan2(m[1], m[0]),
              t: renTekst(e.text)
            });
            break;
          }
          case 'HATCH': {
            // selve skraveringen tegnes ikke, men grænsekurven viser væg, felt eller møbel
            for (const sti of e.boundaryPaths || []) {
              const q = [];
              const knuder = sti.vertices || [];
              if (knuder.length > 1) {
                for (let k = 0; k < knuder.length; k++) {
                  const a = knuder[k];
                  const [x, y] = anvend(m, a.x, a.y);
                  q.push(x, y);
                  const næste = knuder[k + 1] || (sti.isClosed ? knuder[0] : null);
                  if (næste && a.bulge) bulgeTilPunkter(a.x, a.y, næste.x, næste.y, a.bulge, q, m);
                }
                if (sti.isClosed) { const [x, y] = anvend(m, knuder[0].x, knuder[0].y); q.push(x, y); }
              } else {
                for (const kant of sti.edges || []) {
                  if (kant.type === 1 && kant.start && kant.end) {
                    const a = anvend(m, kant.start.x, kant.start.y);
                    const b = anvend(m, kant.end.x, kant.end.y);
                    if (!q.length) q.push(a[0], a[1]);
                    q.push(b[0], b[1]);
                  } else if (kant.type === 2 && kant.center) {
                    bueTilPunkter(kant.center.x, kant.center.y, kant.radius || 0,
                      kant.startAngle || 0, kant.endAngle == null ? Math.PI * 2 : kant.endAngle, q, m);
                  }
                }
              }
              tilføjStreg(e, q, true);
            }
            break;
          }
          case 'MLINE': {
            // dobbeltlinjer, typisk vægge - midterlinjen er nok til en lysplan
            for (const v of e.vertices || []) {
              const q = v.vertex || v;
              if (!q) continue;
              const [x, y] = anvend(m, q.x, q.y);
              p.push(x, y);
            }
            tilføjStreg(e, p, (e.flags & 2) === 2);
            break;
          }
          case 'MULTILEADER': {
            const q = e.contentBasePosition || e.textAnchor || e.blockContent;
            const tekst = e.textContent || (e.blockAttributes || []).map(a => a.text).filter(Boolean).join(' ');
            if (!q || !tekst) break;
            const [x, y] = anvend(m, q.x, q.y);
            const skala = Math.hypot(m[0], m[1]) || 1;
            const lag = e.layer || '0';
            if (!lagInfo[lag]) lagInfo[lag] = { navn: lag, aci: 7, slukket: false, synlig: true };
            const aci = (e.colorIndex == null || e.colorIndex === 256) ? lagInfo[lag].aci : (e.colorIndex === 0 ? 7 : e.colorIndex);
            tekster.push({
              lag, aci, x, y,
              h: (e.textHeight || 2.5) * (e.contentScale || 1) * skala,
              v: (e.textRotation || 0) + Math.atan2(m[1], m[0]),
              t: renTekst(tekst)
            });
            break;
          }
          case 'INSERT': {
            const blok = blokke[e.name];
            if (!blok) break;
            const kolonner = Math.max(1, e.columnCount || 1), rækker = Math.max(1, e.rowCount || 1);
            for (let c = 0; c < kolonner; c++) {
              for (let r = 0; r < rækker; r++) {
                const punkt = {
                  x: (e.insertionPoint.x || 0) + c * (e.columnSpacing || 0),
                  y: (e.insertionPoint.y || 0) + r * (e.rowSpacing || 0)
                };
                let lokal = gang(m, indsætM(punkt, e.xScale || 1, e.yScale || 1, e.rotation || 0));
                lokal = gang(lokal, [1, 0, 0, 1, -(blok.basePoint ? blok.basePoint.x : 0), -(blok.basePoint ? blok.basePoint.y : 0)]);
                gåEntiteter(blok.entities, lokal, dybde + 1);
              }
            }
            break;
          }
          case 'DIMENSION': {
            const blok = blokke[e.name];
            if (blok) gåEntiteter(blok.entities, m, dybde + 1);
            break;
          }
          default:
            // HATCH, proxy-objekter fra AutoCAD Architecture m.fl. kan ikke tegnes
            springOver[e.type] = (springOver[e.type] || 0) + 1;
            break;
        }
      }
    }

    gåEntiteter(db.entities, enhedsM, 0);

    // omregning fra tegningens enhed til meter
    let meterPerEnhed = ENHEDER[db.header && db.header.INSUNITS] || null;
    const ramme = beregnRamme(streger, tekster);
    if (!meterPerEnhed) {
      const størst = Math.max(ramme.x1 - ramme.x0, ramme.y1 - ramme.y0);
      meterPerEnhed = størst > 400 ? 0.001 : 1;   // store tal betyder næsten altid millimeter
      ramme.gættetEnhed = true;
    }
    return {
      streger, tekster, lagInfo, ramme, meterPerEnhed,
      gættetEnhed: !!ramme.gættetEnhed, springOver,
      antalEntiteter: (db.entities || []).length,
      blokke: Object.keys(blokke).length
    };
  }

  function renTekst(t) {
    return String(t)
      .replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;/g, '')
      .replace(/[{}]/g, '').replace(/%%[dDcCpP]/g, m => ({ d: '°', c: 'Ø', p: '±' }[m[2].toLowerCase()] || ''))
      .trim();
  }

  function beregnRamme(streger, tekster) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of streger) {
      for (let k = 0; k < s.p.length; k += 2) {
        if (s.p[k] < x0) x0 = s.p[k];
        if (s.p[k] > x1) x1 = s.p[k];
        if (s.p[k + 1] < y0) y0 = s.p[k + 1];
        if (s.p[k + 1] > y1) y1 = s.p[k + 1];
      }
    }
    for (const t of tekster) {
      if (t.x < x0) x0 = t.x; if (t.x > x1) x1 = t.x;
      if (t.y < y0) y0 = t.y; if (t.y > y1) y1 = t.y;
    }
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 };
    return { x0, y0, x1, y1 };
  }

  /* ---- DWG via LibreDWG (WebAssembly, hentes fra nettet) ---- */
  const DWG_KILDER = [
    'vendor/libredwg-web/',          // lokal kopi, hvis hent-motorer er kørt
    'https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.10/',
    'https://unpkg.com/@mlightcad/libredwg-web@0.7.10/'
  ];
  let motor = null;

  const forsøg = [];          // hvad der er prøvet, så fejl kan forklares

  async function hentMotor(egenKilde, status, kunLokal) {
    if (motor) return motor;
    let kilder = (egenKilde ? [egenKilde.endsWith('/') ? egenKilde : egenKilde + '/'] : []).concat(DWG_KILDER);
    // i en sandkasse nytter det ikke at prøve nettet - kun filer på siden selv
    if (kunLokal) kilder = kilder.filter(k => !/^https?:/i.test(k));
    forsøg.length = 0;
    for (const kilde of kilder) {
      const lokal = !/^https?:/i.test(kilde);
      try {
        if (status) status(lokal ? `leder efter motoren i ${kilde}` : `henter motoren fra ${new URL(kilde).hostname} (ca. 10 MB)`);
        // relative stier skal gøres absolutte, ellers læses de som modulnavne
        const base = new URL(kilde, document.baseURI).href;
        const mod = await import(/* @vite-ignore */ base + 'dist/libredwg-web.js');
        const lib = await mod.LibreDwg.create(base + 'wasm/');
        motor = { lib, typer: mod.Dwg_File_Type, kilde: base };
        return motor;
      } catch (e) {
        forsøg.push(kilde + ': ' + (e && e.message ? e.message.slice(0, 80) : 'ukendt fejl'));
      }
    }
    console.error('DWG-motoren kunne ikke hentes:\n' + forsøg.join('\n'));
    if (kunLokal) {
      throw new Error('DWG-motoren på siden kunne ikke startes. Prøvet: ' + forsøg.join(' | ') +
        '. Gem tegningen som DXF, eller brug den lokale udgave.');
    }
    const påNettet = kilder.some(k => /^https?:/i.test(k));
    throw new Error(
      'DWG-motoren kunne ikke hentes' +
      (påNettet ? '. Netværket blokerer måske cdn.jsdelivr.net og unpkg.com – kør hent-motorer.cmd/.sh én gang, eller gem tegningen som DXF.' :
        '. Kør hent-motorer.cmd/.sh, eller gem tegningen som DXF.') +
      ' Prøvet: ' + forsøg.join(' | '));
  }

  async function læsDwg(buffer, egenKilde, status, valg) {
    const { lib, typer } = await hentMotor(egenKilde, status, valg && valg.kunLokal);
    if (status) status('læser tegningen …');
    let dwg;
    try {
      dwg = lib.dwg_read_data(buffer, typer.DWG);
    } catch (e) {
      throw new Error('Filen kunne ikke læses som DWG (' + (e && e.message ? e.message.slice(0, 120) : 'ukendt fejl') + '). Er det en rigtig DWG, eller er den gemt i et meget nyt format?');
    }
    if (!dwg) throw new Error('Filen kunne ikke læses som DWG. Prøv at gemme den som DXF eller i et ældre DWG-format.');
    if (status) status('omsætter geometrien …');
    const rå = lib.convert(dwg);
    try { lib.dwg_free(dwg); } catch (e) { /* hukommelsen frigives af motoren selv */ }
    return normaliser(rå);
  }

  /* LibreDWG's database har blokkene i BLOCK_RECORD-tabellen. */
  function normaliser(rå) {
    const blocks = {};
    const poster = (rå.tables && rå.tables.BLOCK_RECORD && rå.tables.BLOCK_RECORD.entries) || [];
    let xref = 0;
    for (const b of poster) {
      if (!b || !b.name) continue;
      if ((b.flags & 4) || (b.flags & 8)) xref++;     // eksterne referencer
      blocks[b.name] = { name: b.name, basePoint: b.basePoint || { x: 0, y: 0 }, entities: b.entities || [] };
    }
    let entities = rå.entities || [];
    let kilde = 'modelrum';
    if (!entities.length) {
      const model = poster.find(b => /^\*model_space$/i.test(b.name || ''));
      if (model && model.entities && model.entities.length) { entities = model.entities; kilde = 'modelrum (blok)'; }
    }
    if (!entities.length) {
      // nogle tegninger har alt i papirrummet
      const papir = poster.filter(b => /^\*paper_space/i.test(b.name || '') && b.entities && b.entities.length)
        .sort((a, b) => b.entities.length - a.entities.length)[0];
      if (papir) { entities = papir.entities; kilde = 'papirrum'; }
    }
    return {
      header: rå.header || {}, tables: rå.tables || { LAYER: { entries: [] } },
      blocks, entities, xref, kilde
    };
  }

  return { parseDxf, fladgør, læsDwg, hentMotor, aciFarve, ENHEDER, DWG_KILDER, forsøg };
})();
