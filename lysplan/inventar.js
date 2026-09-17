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
  display: { navn: 'Kampagne/display', hoejde: 1.4, farve: '#8E5B1F', maaler: 'stk' },
  endegavl: { navn: 'Endegavl/endeboks', hoejde: 1.8, farve: '#5D6D7E', maaler: 'stk' },
  broed: { navn: 'Brødreol/brødskab', hoejde: 1.6, farve: '#8A6D3B', maaler: 'fag' },
  pallereol: { navn: 'Lagerreol til paller', hoejde: 2.5, farve: '#616A6B', maaler: 'fag' },
  palle: { navn: 'Palleplads', hoejde: 1.2, farve: '#B08A5A', maaler: 'stk' },
  automat: { navn: 'Pant-/møntautomat', hoejde: 1.8, farve: '#4D5656', maaler: 'stk' },
  andet: { navn: 'Øvrigt inventar', hoejde: 1.4, farve: '#808B96', maaler: 'stk' }
};

/* Ord på tegningen der afslører hvad et møbel er. Rækkefølgen betyder noget:
   første træffer vinder, så "frostrum" fanges før "frost".
   Betegnelserne er samlet fra rigtige Coop-planer (365discount Kalundborg og
   Kvickly Hvidovre): CLS-reoler, Endeboks, Mega 200, Katapult, Dumper,
   LISBONA/SANTIAGO-kølemøbler, papirpaller og Euro-paller. */
const ORDBOG = [
  [/frost\s*ø|ø\s*frost|frostoe/i, 'frostoe'],
  [/frost/i, 'frost'],
  [/lisbona|santiago|multideck/i, 'koel'],
  [/bærkøl|baerkoel/i, 'koel'],
  [/køl|koel|kol\b|chill/i, 'koel'],
  [/pantautomat|tomra|møntmarked|moentmarked/i, 'automat'],
  [/safe.?pay|kassebånd|kassebaand|kasselinje|checkout|selfscan|self.?check|svinglåge|svinglaage/i, 'kasse'],
  [/kasse/i, 'kasse'],
  [/slagter|delikatesse|bager|bake.?off|disk|betjen/i, 'betjening'],
  [/endeboks|endegavl|gavlplads/i, 'endegavl'],
  [/lagerreol|pallereol|reol\s*2\s*paller/i, 'pallereol'],
  [/1\/1\s*papirpalle|1\/4\s*pl|euro\s*800|palleplads|papirpalle|\bpalle\b|paller\b/i, 'palle'],
  [/brødskab|broedskab|brød|broed/i, 'broed'],
  [/tobaksreol|tobak/i, 'reol'],
  [/mega\s*\d+|kampagne|katapult|dumper|styrtkurv|fletkurv|byggebord|t-rack|rack\s*\d+|spotvare/i, 'display'],
  [/f&g.?bord|f\s*&\s*g|frugt|grønt|gront|podie|banantrappe/i, 'bord'],
  [/posestativ|poser|trille.?kurv|garderobe|affaldscontainer|gulvvasker/i, 'andet'],
  [/cls[_\s]*\d{3,4}|følgefag|foelgefag|startfag|gondol/i, 'reol'],
  [/væg|vaeg|wall/i, 'vaegreol'],
  [/bord|display/i, 'bord']
];

/* Mål skrevet i teksten: "H:1605", "h:1680 d:900 b:1267", "CLS2100",
   "B1400 x D1100 x H1400" og "600x1245x1482" (bredde x dybde x højde). */
function maalFraTekst(tekst) {
  const ud = {};
  const t = String(tekst || '');
  const cls = /cls[_\s]*(\d{4})/i.exec(t);
  if (cls) ud.hoejde = +cls[1] / 1000;
  const h = /(?:^|[^a-zæøå])h\s*[:=]?\s*(\d{3,4})(?!\d)/i.exec(t);
  if (h) ud.hoejde = +h[1] / 1000;
  const d = /(?:^|[^a-zæøå])d\s*[:=]?\s*(\d{3,4})(?!\d)/i.exec(t);
  if (d) ud.dybde = +d[1] / 1000;
  const b = /(?:^|[^a-zæøå])b\s*[:=]?\s*(\d{3,4})(?!\d)/i.exec(t);
  if (b) ud.bredde = +b[1] / 1000;
  const tre = /(\d{3,4})\s*[x×]\s*(\d{3,4})\s*[x×]\s*(\d{3,4})/i.exec(t);
  if (tre) { ud.bredde = +tre[1] / 1000; ud.dybde = +tre[2] / 1000; ud.hoejde = +tre[3] / 1000; }
  // kølemøbler som "LISBONA LF 95 3750 G" - 3750 er længden, G betyder glaslåger
  const køl = /(lisbona|santiago)[^\d]*(?:lf\s*\d+\s*)?(\d{4})\s*([GN])?/i.exec(t);
  if (køl) { ud.laengde = +køl[2] / 1000; ud.laager = /g/i.test(køl[3] || ''); }
  if (ud.hoejde && (ud.hoejde < 0.3 || ud.hoejde > 3)) delete ud.hoejde;
  if (ud.dybde && (ud.dybde < 0.2 || ud.dybde > 3)) delete ud.dybde;
  return ud;
}

/* Tekst i felter der ikke er møbler: tegningshoved, signaturfelter,
   bygningsdele og installationer der tilfældigvis er tegnet som rektangler. */
const IKKE_MOEBEL_TEKST = new RegExp([
  '●|www\\.|tlf\\.?\\s*:|@|\\bcvr\\b|\\bmål\\s*:|\\bsag\\b|\\bdato\\b|\\brev\\.',
  'brt\\.\\s*m|\\bbr\\.\\s*areal|\\bm2\\b|\\bm²',
  'vindue|vindfang|d[øo]r\\b|skydedør|port\\b|baldakin|trappe|elevator|s[øo]jle',
  'n[øo]glekontakt|kontakt\\b|tavle\\b|m[åa]ler\\b|stikkontakt|ventilation|sprinkler',
  'pris\\s*scanner|pristjekker|skilt\\b|forberedt for|\\binfo\\s*:|\\bsignatur\\b|\\bnote\\b'
].join('|'), 'i');

/* Rum og bygningsdele der ikke er inventar. */
const IKKE_INVENTAR = /rum$|rum\b|lager|teknik|kontor|personale|gang|wc|toilet|garderobe|vindfang|salgsareal|areal|omklædning|rampe|varegård|p-plads/i;


/* Rumnavne på danske butiksplaner, og hvilken zonetype de svarer til.
   Rækkefølgen betyder noget: "kølerum" er et rum, ikke et kølemøbel. */
const RUMNAVNE = [
  [/^\s*(salgsareal|salgsomr|salgslokale|butiksareal)/i, 'salg'],
  [/^\s*(vindfang|indgangsparti|forrum)/i, 'vindfang'],
  [/^\s*(kasseomr|kasselinje|kasseområde|bageri|slagter|delikatesse|kiosk|pakkepost|information)/i, 'betjent'],
  [/^\s*(lager|bagbutik|flaskerum|frostrum|kølerum|koelerum|varegård|varegaard|rampe|depot|emballage)/i, 'lager'],
  [/^\s*(personale|kontor|omklædning|omklaedning|frokost|garderobe|wc|toilet|teknikrum|rengøring|rengoering)/i, 'personale'],
  [/^\s*(p-plads|parkering|foromr|overdækket|overdaekket|terræn|terraen)/i, 'ude']
];

/* Ord der afslører at teksten er en bygningsdel, ikke et rum - fx
   "Indgang Skydedør" er en dør, ikke et vindfang. */
const IKKE_RUMTEKST = /dør|doer|port\b|skab|automat|vindue|luge|gitter|trappe|elevator|skilt|reol|hylde|kasse\s*\d/i;

/* Mindste rimelige areal pr. zonetype, så en dørkarm ikke bliver til en zone. */
const MINDSTE_ZONEAREAL = { salg: 50, betjent: 8, vindfang: 6, lager: 8, personale: 5, ude: 20 };

/* Zoner fundet i tegningen: et lukket omrids med et rumnavn indeni.
   Står arealet i teksten ("SALGSAREAL 779,6 M2"), tages det med til kontrol. */
function findZoner(lag, valg) {
  const pxPerM = valg.pxPerMeter;
  const tekster = (lag.tegning.tekster || []).filter(t => t.t && (!valg.lagFilter || valg.lagFilter[t.lag] !== false));

  // lukkede omrids der er store nok til at være et rum
  const omrids = [];
  for (const s of lag.tegning.streger) {
    if (!s.lukket || s.p.length < 8) continue;
    const pts = [];
    for (let i = 0; i < s.p.length; i += 2) pts.push([s.p[i], s.p[i + 1]]);
    const areal = Geom.polygonArea(pts) / (pxPerM * pxPerM);
    if (areal < (valg.minAreal || 15)) continue;
    omrids.push({ pts, areal });
  }
  omrids.sort((a, b) => a.areal - b.areal);

  const fundne = [];
  const brugt = new Set();
  for (const t of tekster) {
    const m2 = /(\d+[.,]?\d*)\s*m2|(\d+[.,]?\d*)\s*m²/i.exec(t.t);
    const angivetAreal = m2 ? parseFloat((m2[1] || m2[2]).replace(',', '.')) : null;
    const navn = t.t.replace(/\s*\d+[.,]?\d*\s*m[²2]\s*$/i, '').trim();
    // et rumnavn er kort og handler ikke om en bygningsdel
    if (!navn || navn.split(/\s+/).length > 3 || IKKE_RUMTEKST.test(navn)) continue;
    let type = null;
    for (const [mønster, ty] of RUMNAVNE) if (mønster.test(navn)) { type = ty; break; }
    if (!type) continue;
    // det mindste omrids der indeholder teksten, er rummet
    const rum = omrids.find(o => !brugt.has(o) &&
      o.areal >= (MINDSTE_ZONEAREAL[type] || 8) &&
      Geom.pointInPolygon([t.x, t.y], o.pts) &&
      // står arealet på tegningen, skal omridset passe nogenlunde
      (!angivetAreal || Math.abs(o.areal - angivetAreal) / angivetAreal < 0.25));
    if (!rum) continue;
    brugt.add(rum);
    fundne.push({ type, navn: navn || type, pts: rum.pts, areal: rum.areal, angivetAreal });
  }
  return fundne;
}

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
    return [].concat(...rækker.map((r, i) => beskriv(r, tilhør[i], pxPerM, grænser))).filter(Boolean);
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
    // et felt med tegningshoved- eller bygningstekst er ikke et møbel
    if (tekst && IKKE_MOEBEL_TEKST.test(tekst)) return null;

    const maal = maalFraTekst(tekst);
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
    const model = vælgModel(type, maal.dybde || dybde, laengde, tekst);
    const modelHøjde = (typeof MØBLER !== 'undefined' && MØBLER[model] ? MØBLER[model].hoejde : INVENTAR_TYPER[type].hoejde);
    return {
      type, kategori, tekst, fag, model,
      laengde, dybde,
      // mål skrevet på tegningen vinder over modellens standardmål
      hoejde: maal.hoejde || modelHøjde,
      vinkel: r.vinkel,
      centrum,
      hjørner: [hjørne(-hl, -hd), hjørne(hl, -hd), hjørne(hl, hd), hjørne(-hl, hd)],
      dele: r.dele || 1,
      lag: r.lag,
      kilde: 'cad'
    };
  }

  /* Møbelmodel ud fra type og de mål, der står på tegningen. */
  function vælgModel(type, dybde, laengde, tekst) {
    if (typeof MØBLER === 'undefined') return null;
    const t = (tekst || '').toLowerCase();
    switch (type) {
      case 'reol':
        if (/brød|broed|bake/.test(t)) return 'broedreol';
        if (dybde < 0.75) return 'vaegreol2200';
        return dybde > 1.15 ? 'gondol2100' : 'gondol1800';
      case 'vaegreol': return 'vaegreol2200';
      case 'koel': {
        // "LISBONA LF 95 3750 G" - G står for glaslåger, N for åbent møbel
        const m = /(lisbona|santiago)[^\d]*(?:lf\s*\d+\s*)?\d{4}\s*([gn])/i.exec(t);
        if (m) return m[2].toLowerCase() === 'g' ? 'koelLaage' : 'koelAaben';
        return /åben|aaben|multideck|frugt|grønt|gront/.test(t) ? 'koelAaben' : 'koelLaage';
      }
      case 'frost': return dybde > 1.2 ? 'frostOe' : 'frostSkab';
      case 'frostoe': return 'frostOe';
      case 'betjening': return 'disk';
      case 'kasse': return laengde < 1.4 ? 'selvkasse' : 'kassebaand';
      case 'bord': return 'podie';
      case 'display': return 'palleplads';
      case 'endegavl': return dybde > 0.75 ? 'gondol1800' : 'vaegreol2200';
      case 'broed': return 'broedreol';
      case 'pallereol': return 'pallereol';
      case 'palle': return 'palleplads';
      case 'automat': return 'selvkasse';
      default: return STANDARDMODEL[type] || 'palleplads';
    }
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

  return { find, findZoner, stykliste, erRektangel, vælgModel, INVENTAR_TYPER, RUMNAVNE };
})();
