/* Genkendelse af butiksinventar i den importerede tegning.
   Rektangler fra CAD-tegningen samles til reol-, køle- og frostrækker,
   og teksterne på tegningen ("6 Baby", "4,37 m Drikkevare køl", "FROST")
   bruges til at bestemme type, varegruppe og antal fag. */

const INVENTAR_TYPER = {
  reol: { navn: 'Reol', hoejde: 1.8, farve: '#6B7385', maaler: 'fag' },
  vaegreol: { navn: 'Vægreol', hoejde: 2.0, farve: '#55606F', maaler: 'fag' },
  koel: { navn: 'Kølemøbel', hoejde: 2.0, farve: '#2E86C1', maaler: 'meter' },
  frost: { navn: 'Frostmøbel', hoejde: 2.0, farve: '#5DADE2', maaler: 'meter' },
  frostoe: { navn: 'Frostø', hoejde: 1.1, farve: '#85C1E9', maaler: 'meter' },
  kasse: { navn: 'Kasse', hoejde: 1.1, farve: '#A9670C', maaler: 'stk' },
  betjening: { navn: 'Betjent disk', hoejde: 1.3, farve: '#C0392B', maaler: 'meter' },
  bord: { navn: 'Podie/bord', hoejde: 0.9, farve: '#7D6608', maaler: 'stk' },
  andet: { navn: 'Øvrigt inventar', hoejde: 1.4, farve: '#808B96', maaler: 'stk' }
};

/* Ord på tegningen der afslører hvad et møbel er. Rækkefølgen betyder noget:
   første træffer vinder, så "frostrum" fanges før "frost". */
const ORDBOG = [
  [/frost\s*ø|ø\s*frost|frostoe/i, 'frostoe'],
  [/frost/i, 'frost'],
  [/køl|koel|kol\b|chill/i, 'koel'],
  [/kasse|kassebånd|checkout|selfscan|self\s*check/i, 'kasse'],
  [/slagter|delikatesse|bager|bake\s*off|disk|betjen/i, 'betjening'],
  [/podie|bord|pallet|paller|display/i, 'bord'],
  [/væg|vaeg|wall/i, 'vaegreol']
];

/* Rum og bygningsdele der ikke er inventar. */
const IKKE_INVENTAR = /rum$|rum\b|lager|teknik|kontor|personale|gang|wc|toilet|garderobe|vindfang|salgsareal|areal|omklædning|rampe|varegård|p-plads/i;

const Inventar = (() => {

  /* ---- rektangler ---- */
  function erRektangel(p, tolGrader = 8) {
    // p er et fladt array [x0,y0,x1,y1,...] uden gentaget slutpunkt
    if (p.length !== 8) return null;
    const h = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]];
    const sider = h.map((q, i) => {
      const r = h[(i + 1) % 4];
      return [r[0] - q[0], r[1] - q[1]];
    });
    for (let i = 0; i < 4; i++) {
      const a = sider[i], b = sider[(i + 1) % 4];
      const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
      if (la < 1e-6 || lb < 1e-6) return null;
      const vinkel = Math.abs(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb)))) * 180 / Math.PI - 90);
      if (vinkel > tolGrader) return null;
    }
    const l1 = Math.hypot(sider[0][0], sider[0][1]);
    const l2 = Math.hypot(sider[1][0], sider[1][1]);
    const lang = Math.max(l1, l2), kort = Math.min(l1, l2);
    const langSide = l1 >= l2 ? sider[0] : sider[1];
    return {
      hjørner: h,
      centrum: [(h[0][0] + h[2][0]) / 2, (h[0][1] + h[2][1]) / 2],
      laengde: lang, dybde: kort,
      vinkel: Math.atan2(langSide[1], langSide[0])
    };
  }

  /* Rektangler tegnet med fire enkeltlinjer findes ved at lede efter
     4-kredse i et net af sammenfaldende endepunkter. */
  function rektanglerFraLinjer(streger, opløsning, maksKnuder = 20000) {
    const knuder = new Map();
    const naboer = new Map();
    const nøgle = (x, y) => Math.round(x / opløsning) + ':' + Math.round(y / opløsning);
    const tilføj = (x, y) => {
      const k = nøgle(x, y);
      if (!knuder.has(k)) { knuder.set(k, [x, y]); naboer.set(k, new Set()); }
      return k;
    };
    let kanter = 0;
    for (const s of streger) {
      if (s.p.length !== 4) continue;          // kun rene linjestykker
      if (knuder.size > maksKnuder) break;
      const a = tilføj(s.p[0], s.p[1]), b = tilføj(s.p[2], s.p[3]);
      if (a === b) continue;
      naboer.get(a).add(b); naboer.get(b).add(a);
      kanter++;
    }
    if (!kanter) return [];
    const fundet = [], set = new Set();
    for (const [k, nb] of naboer) {
      if (nb.size > 6) continue;
      const liste = Array.from(nb);
      for (let i = 0; i < liste.length; i++) {
        for (let j = i + 1; j < liste.length; j++) {
          const a = liste[i], b = liste[j];
          for (const d of naboer.get(a)) {
            if (d === k || !naboer.get(b).has(d)) continue;
            const id = [k, a, d, b].sort().join('|');
            if (set.has(id)) continue;
            set.add(id);
            const P = [knuder.get(k), knuder.get(a), knuder.get(d), knuder.get(b)];
            const r = erRektangel([].concat(...P));
            if (r) fundet.push(r);
          }
        }
      }
    }
    return fundet;
  }

  /* ---- hovedfunktion ---- */
  function find(lag, valg) {
    const pxPerM = valg.pxPerMeter;
    const iM = px => px / pxPerM;
    const grænser = Object.assign({
      minDybde: 0.35, maksDybde: 3.0, minLaengde: 0.5, maksLaengde: 25,
      fagbredde: 1.0, fraLinjer: true
    }, valg.graenser || {});

    const rå = [];
    for (const s of lag.tegning.streger) {
      if (valg.lagFilter && valg.lagFilter[s.lag] === false) continue;
      if (IKKE_INVENTAR.test(s.lag) && !/inventar|reol|møbl|mobl/i.test(s.lag)) continue;
      let p = s.p;
      // fladgørelsen lukker polylinjen med et gentaget punkt
      if (p.length === 10 && Math.abs(p[0] - p[8]) < 1e-6 && Math.abs(p[1] - p[9]) < 1e-6) p = p.slice(0, 8);
      const r = erRektangel(p);
      if (r) rå.push({ ...r, lag: s.lag });
    }
    if (grænser.fraLinjer) {
      for (const r of rektanglerFraLinjer(
        lag.tegning.streger.filter(s => !valg.lagFilter || valg.lagFilter[s.lag] !== false), pxPerM * 0.02)) {
        rå.push({ ...r, lag: '(linjer)' });
      }
    }

    // frasortering efter mål
    const kandidater = rå.filter(r => {
      const d = iM(r.dybde), l = iM(r.laengde);
      return d >= grænser.minDybde && d <= grænser.maksDybde &&
        l >= grænser.minLaengde && l <= grænser.maksLaengde && l >= d * 0.9;
    });

    // fjern dubletter (samme rektangel tegnet flere gange eller fundet to veje)
    const unikke = [];
    const tol = pxPerM * 0.08;
    for (const r of kandidater) {
      if (unikke.some(u => Math.hypot(u.centrum[0] - r.centrum[0], u.centrum[1] - r.centrum[1]) < tol &&
        Math.abs(u.laengde - r.laengde) < tol && Math.abs(u.dybde - r.dybde) < tol)) continue;
      unikke.push(r);
    }

    const rækker = saml(unikke, pxPerM);
    const tekster = (lag.tegning.tekster || []).filter(t =>
      t.t && (!valg.lagFilter || valg.lagFilter[t.lag] !== false) && !IKKE_INVENTAR.test(t.t));

    // hver tekst hører til den nærmeste række, så nabogondoler ikke stjæler hinandens varegrupper
    const tilhør = rækker.map(() => []);
    for (const t of tekster) {
      let bedst = -1, bedstAfstand = Infinity;
      for (let i = 0; i < rækker.length; i++) {
        const d = afstandTilRektangel([t.x, t.y], rækker[i]);
        if (d < bedstAfstand) { bedstAfstand = d; bedst = i; }
      }
      if (bedst >= 0 && bedstAfstand <= Math.max(pxPerM * 1.6, rækker[bedst].dybde * 1.2)) {
        tilhør[bedst].push(t);
      }
    }
    return [].concat(...rækker.map((r, i) => beskriv(r, tilhør[i], pxPerM, grænser)));
  }

  /* Naboelementer med samme retning og dybde lægges sammen til én række,
     så en gondol tegnet som 12 kasser bliver til ét møbel på 12 fag. */
  function saml(kasser, pxPerM) {
    const brugt = new Set();
    const rækker = [];
    const vinkelNær = (a, b) => {
      let d = Math.abs(a - b) % Math.PI;
      return Math.min(d, Math.PI - d) < 0.09;     // ca. 5 grader
    };
    for (let i = 0; i < kasser.length; i++) {
      if (brugt.has(i)) continue;
      const gruppe = [kasser[i]];
      brugt.add(i);
      let voksede = true;
      while (voksede) {
        voksede = false;
        for (let j = 0; j < kasser.length; j++) {
          if (brugt.has(j)) continue;
          const k = kasser[j];
          if (!gruppe.some(g => naboer(g, k, pxPerM, vinkelNær))) continue;
          gruppe.push(k); brugt.add(j); voksede = true;
        }
      }
      rækker.push(samlRække(gruppe));
    }
    return rækker;
  }

  function naboer(a, b, pxPerM, vinkelNær) {
    if (!vinkelNær(a.vinkel, b.vinkel)) return false;
    if (Math.abs(a.dybde - b.dybde) > Math.max(pxPerM * 0.15, a.dybde * 0.25)) return false;
    // afstand målt langs og på tværs af rækkens retning
    const dx = b.centrum[0] - a.centrum[0], dy = b.centrum[1] - a.centrum[1];
    const c = Math.cos(a.vinkel), s = Math.sin(a.vinkel);
    const langs = Math.abs(dx * c + dy * s);
    const tvaers = Math.abs(-dx * s + dy * c);
    return tvaers < Math.max(pxPerM * 0.12, a.dybde * 0.3) &&
      langs < (a.laengde + b.laengde) / 2 + pxPerM * 0.25;
  }

  function samlRække(gruppe) {
    const vinkel = gruppe[0].vinkel;
    const c = Math.cos(vinkel), s = Math.sin(vinkel);
    let langsMin = Infinity, langsMaks = -Infinity, tvaersMin = Infinity, tvaersMaks = -Infinity;
    const punkter = [].concat(...gruppe.map(g => g.hjørner));
    for (const [x, y] of punkter) {
      const u = x * c + y * s, v = -x * s + y * c;
      langsMin = Math.min(langsMin, u); langsMaks = Math.max(langsMaks, u);
      tvaersMin = Math.min(tvaersMin, v); tvaersMaks = Math.max(tvaersMaks, v);
    }
    const tilVerden = (u, v) => [u * c - v * s, u * s + v * c];
    return {
      dele: gruppe.length,
      lag: gruppe[0].lag,
      vinkel,
      laengde: langsMaks - langsMin,
      dybde: tvaersMaks - tvaersMin,
      centrum: tilVerden((langsMin + langsMaks) / 2, (tvaersMin + tvaersMaks) / 2),
      hjørner: [
        tilVerden(langsMin, tvaersMin), tilVerden(langsMaks, tvaersMin),
        tilVerden(langsMaks, tvaersMaks), tilVerden(langsMin, tvaersMaks)
      ]
    };
  }

  /* En gondolrække bærer tit flere varegruppetekster ("6 Baby", "5 Kiks & kager").
     Så deles rækken op i afsnit efter teksterne og deres antal fag. */
  function beskriv(r, tekster, pxPerM, grænser) {
    const c = Math.cos(r.vinkel), s = Math.sin(r.vinkel);
    const langsAksen = tekster
      .map(t => ({ tekst: t.t.trim(), u: (t.x - r.centrum[0]) * c + (t.y - r.centrum[1]) * s }))
      .sort((a, b) => a.u - b.u)
      .filter((t, i, liste) => i === 0 || t.tekst !== liste[i - 1].tekst || Math.abs(t.u - liste[i - 1].u) > pxPerM * 0.5);

    if (langsAksen.length < 2) {
      return [enkeltMøbel(r, langsAksen.length ? langsAksen[0].tekst : '', r.laengde, r.centrum, pxPerM, grænser)];
    }

    const fagTal = langsAksen.map(t => {
      const m = /^\s*(\d{1,2})\s+\D/.exec(t.tekst);
      return m ? +m[1] : null;
    });
    const alleHarFag = fagTal.every(f => f);
    const sum = alleHarFag ? fagTal.reduce((a, b) => a + b, 0) : langsAksen.length;
    let u = -r.laengde / 2;
    const dele = [];
    langsAksen.forEach((t, i) => {
      const andel = (alleHarFag ? fagTal[i] : 1) / sum;
      const l = r.laengde * andel;
      const midteU = u + l / 2;
      const centrum = [r.centrum[0] + c * midteU, r.centrum[1] + s * midteU];
      dele.push(enkeltMøbel(r, t.tekst, l, centrum, pxPerM, grænser));
      u += l;
    });
    return dele;
  }

  function enkeltMøbel(r, tekst, laengdePx, centrum, pxPerM, grænser) {
    const iM = px => px / pxPerM;
    const laengde = iM(laengdePx), dybde = iM(r.dybde);

    let type = null;
    if (tekst && !IKKE_INVENTAR.test(tekst)) {
      for (const [mønster, t] of ORDBOG) if (mønster.test(tekst)) { type = t; break; }
    }
    if (!type) {
      if (dybde > 1.6) type = 'frostoe';
      else if (dybde > 1.05) type = 'koel';
      else type = 'reol';
    }

    // "6 Baby" betyder 6 fag, "4,37 m Drikkevare køl" er en længde
    let fag = null, kategori = tekst;
    const mFag = /^\s*(\d{1,2})\s+(\D.*)$/.exec(tekst);
    const mMeter = /(\d+[.,]\d+|\d+)\s*m\b/i.exec(tekst);
    if (mFag) { fag = +mFag[1]; kategori = mFag[2].trim(); }
    if (mMeter) kategori = tekst.replace(mMeter[0], '').trim();
    if (!fag && INVENTAR_TYPER[type].maaler === 'fag') {
      fag = Math.max(1, Math.round(laengde / grænser.fagbredde));
    }
    const c = Math.cos(r.vinkel), s = Math.sin(r.vinkel);
    const hl = laengdePx / 2, hd = r.dybde / 2;
    const hjørne = (u, v) => [centrum[0] + u * c - v * s, centrum[1] + u * s + v * c];
    return {
      type, kategori, tekst, fag,
      laengde, dybde,
      hoejde: INVENTAR_TYPER[type].hoejde,
      vinkel: r.vinkel,
      centrum,
      hjørner: [hjørne(-hl, -hd), hjørne(hl, -hd), hjørne(hl, hd), hjørne(-hl, hd)],
      dele: r.dele || 1,
      lag: r.lag,
      kilde: 'cad'
    };
  }

  function afstandTilRektangel(p, r) {
    const c = Math.cos(r.vinkel), s = Math.sin(r.vinkel);
    const dx = p[0] - r.centrum[0], dy = p[1] - r.centrum[1];
    const u = Math.abs(dx * c + dy * s) - r.laengde / 2;
    const v = Math.abs(-dx * s + dy * c) - r.dybde / 2;
    return Math.hypot(Math.max(0, u), Math.max(0, v));
  }

  /* ---- stykliste ---- */
  function stykliste(inventar, fagbredde) {
    const grupper = {};
    for (const i of inventar) {
      const t = INVENTAR_TYPER[i.type] || INVENTAR_TYPER.andet;
      const g = grupper[i.type] || (grupper[i.type] = {
        type: i.type, navn: t.navn, maaler: t.maaler, antal: 0, meter: 0, fag: 0, varegrupper: {}
      });
      g.antal++;
      g.meter += i.laengde;
      g.fag += i.fag || 0;
      const navn = i.kategori || '(uden tekst)';
      const v = g.varegrupper[navn] || (g.varegrupper[navn] = { meter: 0, fag: 0, antal: 0 });
      v.meter += i.laengde; v.fag += i.fag || 0; v.antal++;
    }
    const liste = Object.values(grupper).sort((a, b) => b.meter - a.meter);
    return {
      grupper: liste,
      meterIAlt: liste.reduce((a, g) => a + g.meter, 0),
      meterKoel: (grupper.koel ? grupper.koel.meter : 0),
      meterFrost: (grupper.frost ? grupper.frost.meter : 0) + (grupper.frostoe ? grupper.frostoe.meter : 0),
      meterReol: (grupper.reol ? grupper.reol.meter : 0) + (grupper.vaegreol ? grupper.vaegreol.meter : 0),
      fagIAlt: liste.reduce((a, g) => a + g.fag, 0)
    };
  }

  return { find, stykliste, erRektangel, INVENTAR_TYPER };
})();
