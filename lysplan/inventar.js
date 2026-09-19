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
  [/lisbona|santiago|multideck|toronto|malm[öo]/i, 'koel'],
  [/bærkøl|baerkoel/i, 'koel'],
  [/køl|koel|kol\b|chill/i, 'koel'],
  [/pantautomat|tomra|møntmarked|moentmarked/i, 'automat'],
  [/safe.?pay|kassebånd|kassebaand|kasselinje|checkout|selfscan|self.?check|svinglåge|svinglaage/i, 'kasse'],
  [/kasse/i, 'kasse'],
  [/slagter|delikatesse|bager|bake.?off|disk|betjen/i, 'betjening'],
  [/endeboks|endegavl|gavlplads/i, 'endegavl'],
  [/lagerreol|pallereol|reol\s*2\s*paller/i, 'pallereol'],
  [/1\/1\s*papirpalle|1\/4\s*pl|euro\s*800|palleplads|papirpalle|kvartpalle|halvpalle|helpalle|europalle|\bpalle\b|paller\b/i, 'palle'],
  [/brødskab|broedskab|brød|broed/i, 'broed'],
  [/tobaksreol|tobak/i, 'reol'],
  [/mega\s*\d+|kampagne|katapult|dumper|styrtkurv|fletkurv|byggebord|t-rack|rack\s*\d+|spotvare/i, 'display'],
  [/f&g.?bord|frugt.?bord|podie|banantrappe|akt-?bord|aktivitet/i, 'bord'],
  [/posestativ|poser|trille.?kurv|garderobe|affaldscontainer|gulvvasker/i, 'andet'],
  [/cls[_\s]*\d{3,4}|følgefag|foelgefag|startfag|gondol/i, 'reol'],
  [/væg|vaeg|wall/i, 'vaegreol'],
  [/reol|hylde|impuls|vej-?selv|nonfood|non-food|bazar|sæson|saeson/i, 'reol'],
  [/bord|display/i, 'bord']
];

/* Lagnavnet fortæller, hvad der står på laget. "Kølereoler", "Kølegondol
   Toronto - Malmö", "Inventar - Frugt og Grønt", "Inventar - Bake Off" er
   tegnerens egen ordning, og den vinder over form og tekst. */
const LAGORDBOG = [
  [/frost/i, 'frost'],
  [/køl|koel|\bkol\b|lisbona|santiago|toronto|malm[öo]/i, 'koel'],
  [/frugt|grønt|groent|f&g/i, 'bord'],
  [/bake.?off|brød|broed/i, 'broed'],
  [/kasse|checkout|kasselinje/i, 'kasse'],
  [/inventar|reol|gondol|bazar|nonfood|non-food/i, 'reol']
];

/* Lag der ligner inventar, men ikke er det: respektafstande omkring
   kølemøbler, kondensafløb, hjælpepunkter og målsætning. De tegnes som
   rektangler i samme størrelse som møblerne og forurener genkendelsen.
   bips-koderne A3x er konstruktioner (A321 er søjler - 0,84 m kvadrater,
   der ellers bliver til reoler) og A5x-A9x installationer. */
const IKKE_INVENTAR_LAG = /respekt|kondens|afløb|afloeb|defpoints|^a29|^a[3-9]\d|målsæt|maalsaet|dimension|skraver|hatch|sanitet|viewport|tegningshoved|tegningsramme|signatur|legend|- tegning$|^aoff/i;

/* Blokke der aldrig er møbler: døre, vinduer, nordpile, trapper, sanitet,
   skilte og målsætningsblokke (*D...). Anonyme *U-blokke beholdes: det er
   dem, AutoCAD laver af en kopieret reolrække, og på Fakta-tegningen er de
   selve reolmodulerne - navnet siger intet, men laget gør. */
const IKKE_MOEBEL_BLOK = /^\*D|dør|door|vindue|window|nordpil|north|trappe|stair|\bwc\b|toilet|håndvask|haandvask|sink|skilt|sign|logo|tegningshoved|titleblock|ramme|frame|symbol|sprinkler|lampe|armatur|stik|el-|søjle|soejle|column/i;

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
  /* Længden står tit i teksten, og så er den tegnerens egen specifikation:
       "LISBONA LF 95 3750 G"       3750 mm, G betyder glaslåger
       "TORONTO / MALMÖ 2500 + HC"  2500 mm
       "250+ende - Frost"           250 cm plus endemodul
       "437cm To-heat", "1125cm Ost & Pålæg", "375cm F&G-køl"
     Et tal med cm eller m er entydigt; et firecifret tal efter et modelnavn
     er millimeter; et trecifret tal foran "+ende" er centimeter. */
  const køl = /(lisbona|santiago|toronto|malm[öo])[^\d]*(?:lf\s*\d+\s*)?(\d{4})\s*([GN])?/i.exec(t);
  if (køl) { ud.laengde = +køl[2] / 1000; ud.laager = /g/i.test(køl[3] || ''); }
  const cm = /(?:^|[^\d,.])(\d{2,4})\s*cm\b/i.exec(t);
  if (cm) ud.laengde = +cm[1] / 100;
  const ende = /(?:^|[^\d,.])(\d{2,3})\s*\+\s*ende/i.exec(t);
  if (ende) { ud.laengde = +ende[1] / 100; ud.medEnde = true; }
  const meter = /(?:^|[^\d,.])(\d{1,2}[,.]\d{1,2})\s*m\b/i.exec(t);
  if (meter && !ud.laengde) ud.laengde = parseFloat(meter[1].replace(',', '.'));
  if (ud.laengde && (ud.laengde < 0.3 || ud.laengde > 30)) delete ud.laengde;
  if (ud.hoejde && (ud.hoejde < 0.3 || ud.hoejde > 3)) delete ud.hoejde;
  if (ud.dybde && (ud.dybde < 0.2 || ud.dybde > 3)) delete ud.dybde;
  return ud;
}

/* Tekst i felter der ikke er møbler: tegningshoved, signaturfelter,
   bygningsdele og installationer der tilfældigvis er tegnet som rektangler. */
const IKKE_MOEBEL_TEKST = new RegExp([
  '●|www\\.|tlf\\.?\\s*:|@|\\bcvr\\b|\\bmål\\s*:|\\bsag\\b|\\bdato\\b|\\brev\\.|\\ba/s\\b|\\baps\\b|\\binfo\\s*:|\\bfag\\s*:',
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
  [/^\s*(personale|kontor|omklædning|omklaedning|frokost|garderobe|wc|toilet|teknikrum|teknik|rengøring|rengoering)/i, 'personale'],
  // en gang, en sluse eller en natboks er ikke butik - salgsarealet må ikke løbe derind
  [/^\s*(gang|korridor|passage|sluse|natboks|trappe|elevator|kølerum|koelerum|frostrum|varemodtag|affald)/i, 'lager'],
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
    grænser.ordbog = valg.ordbog || null;

    const lagOk = navn => !(valg.lagFilter && valg.lagFilter[navn] === false)
      && !IKKE_INVENTAR_LAG.test(navn)
      && !(IKKE_INVENTAR.test(navn) && !/inventar|reol|møbl|mobl|køl|koel|frost/i.test(navn));
    const passerMaal = r => {
      const d = iM(r.dybde), l = iM(r.laengde);
      return d >= grænser.minDybde && d <= grænser.maksDybde &&
        l >= grænser.minLaengde && l <= grænser.maksLaengde && l >= d * 0.9;
    };

    /* 1. Blokreferencerne. Tegneren indsatte blokken SANTIAGO_LF95_2500, ikke
          40 streger, og det navn er den mest pålidelige oplysning i filen.
          En blok, der rummer to eller flere andre møbelblokke, er en samling
          (en hel gondolrække, et helt inventarlag) og ikke selv et møbel. */
    const blokke = (lag.tegning.indsatser || [])
      .filter(i => lagOk(i.lag) && !IKKE_MOEBEL_BLOK.test(i.navn || '') && passerMaal(i));
    /* Samme møbel kan ligge i tre lag af blokke - pallen er en blok, der er
       sat ind i en blok, der er sat ind i en blok, alle på samme størrelse.
       Den yderste beholdes (det er den, tegneren satte ind), og de indre,
       der dækker det samme, tælles ikke igen. En blok med to eller flere
       rigtige dele i sig (mindre end den selv) er derimod en samling. */
    const areal = r => r.laengde * r.dybde;
    const ligger = (a, b) => afstandTilRektangel(b.centrum, a) === 0;
    const erDel = (a, b) => ligger(a, b) && areal(b) < areal(a) * 0.8;
    const erSamme = (a, b) => ligger(a, b) && areal(b) >= areal(a) * 0.8 && areal(b) <= areal(a) * 1.25;
    /* En samling er stor: en hel gondolrække eller et helt inventarlag som én
       blok. Et endegavlsmodul på 1,2 x 0,6 m med to kvartpaller i sig er
       derimod ét møbel, og kvartpallerne er dele af det - ikke møbler for sig. */
    const erSamling = a => (iM(a.laengde) >= 2.5 || iM(areal(a)) / pxPerM >= 2.0)
      && blokke.filter(b => b !== a && erDel(a, b)).length >= 2;
    const udenDubletter = blokke.filter(a => !blokke.some(b => b !== a && b.niveau < a.niveau && erSamme(b, a)));
    const beholdte = udenDubletter.filter(a => !erSamling(a));
    const blokMøbler = beholdte
      .filter(a => !beholdte.some(b => b !== a && erDel(b, a)))
      .map(i => ({ hjørner: i.hjørner, centrum: i.centrum, laengde: i.laengde, dybde: i.dybde,
                   vinkel: i.vinkel, lag: i.lag, navn: i.navn, blokTekst: (i.tekster || []).join(' '), kilde: 'blok' }));

    /* Et næsten kvadratisk modul (0,98 x 0,90 m) har ingen tydelig langside,
       og så bliver "langs" og "på tværs" et tilfælde af, hvordan blokken
       blev tegnet. Rækken går den vej, naboerne af samme blok ligger: står
       de i forlængelse af modulets normal, drejes modulet 90 grader. Uden
       det smelter rækken aldrig sammen, og hvert modul vender på tværs af
       gangen med bagpladen mod kunden. */
    for (const i of blokMøbler) {
      if (!i.navn || i.laengde / i.dybde > 1.3) continue;
      const c = Math.cos(i.vinkel), sn = Math.sin(i.vinkel);
      let langs = 0, tvaers = 0;
      for (const o of blokMøbler) {
        if (o === i || o.navn !== i.navn) continue;
        const dx = o.centrum[0] - i.centrum[0], dy = o.centrum[1] - i.centrum[1];
        const u = Math.abs(dx * c + dy * sn), v = Math.abs(-dx * sn + dy * c);
        if (u >= i.laengde * 0.8 && u <= i.laengde * 1.3 && v < i.dybde * 0.3) langs++;
        if (v >= i.dybde * 0.8 && v <= i.dybde * 1.3 && u < i.laengde * 0.3) tvaers++;
      }
      if (tvaers > langs) {
        i.vinkel += Math.PI / 2;
        [i.laengde, i.dybde] = [i.dybde, i.laengde];
        const c2 = Math.cos(i.vinkel), s2 = Math.sin(i.vinkel);
        const hl = i.laengde / 2, hd = i.dybde / 2;
        const h = (u, v) => [i.centrum[0] + u * c2 - v * s2, i.centrum[1] + u * s2 + v * c2];
        i.hjørner = [h(-hl, -hd), h(hl, -hd), h(hl, hd), h(-hl, hd)];
      }
    }

    /* 2. Rektangler i geometrien - for tegninger uden blokke, og for det der
          er tegnet løst. Et rektangel, der ligger inde i en møbelblok, er
          blokkens egen streg og tælles ikke igen. */
    const rå = blokMøbler.slice();
    const iBlok = r => blokMøbler.some(b => afstandTilRektangel(r.centrum, b) === 0);
    for (const s of lag.tegning.streger) {
      if (!lagOk(s.lag)) continue;
      let p = s.p;
      // fladgørelsen lukker polylinjen med et gentaget punkt
      if (p.length === 10 && Math.abs(p[0] - p[8]) < 1e-6 && Math.abs(p[1] - p[9]) < 1e-6) p = p.slice(0, 8);
      const r = erRektangel(p);
      if (r && passerMaal(r) && !iBlok(r)) rå.push({ ...r, lag: s.lag, kilde: 'form' });
    }
    if (grænser.fraLinjer) {
      for (const r of rektanglerFraLinjer(lag.tegning.streger.filter(s => lagOk(s.lag)), pxPerM * 0.02)) {
        if (passerMaal(r) && !iBlok(r)) rå.push({ ...r, lag: '(linjer)', kilde: 'form' });
      }
    }
    const kandidater = rå;

    // fjern dubletter (samme rektangel tegnet flere gange eller fundet to veje) - blokkene står først og vinder
    const unikke = [];
    const tol = pxPerM * 0.08;
    for (const r of kandidater) {
      if (unikke.some(u => Math.hypot(u.centrum[0] - r.centrum[0], u.centrum[1] - r.centrum[1]) < tol &&
        Math.abs(u.laengde - r.laengde) < tol && Math.abs(u.dybde - r.dybde) < tol)) continue;
      unikke.push(r);
    }

    const rækker = saml(unikke, pxPerM);
    // et rent tal er et mål fra målsætningen, ikke en varegruppe
    const tekster = (lag.tegning.tekster || []).filter(t =>
      t.t && !/^\s*\d+([.,]\d+)?\s*$/.test(t.t) && (!valg.lagFilter || valg.lagFilter[t.lag] !== false)
      && !IKKE_INVENTAR.test(t.t) && !IKKE_INVENTAR_LAG.test(t.lag || ''));

    /* Hver tekst hører til én række, så nabogondoler ikke stjæler hinandens
       varegrupper. Nærmest vinder - men siger teksten "7 Vin", hører den til
       en række, der har plads til 7 fag, ikke til det endestykke på ét
       modul, der tilfældigvis står tættest på. */
    const tilhør = rækker.map(() => []);
    for (const t of tekster) {
      const mFag = /^\s*(\d{1,2})\s+\D/.exec(t.t);
      const nFag = mFag ? +mFag[1] : null;
      let bedst = -1, bedstScore = Infinity, bedstAfstand = Infinity;
      for (let i = 0; i < rækker.length; i++) {
        const d = afstandTilRektangel([t.x, t.y], rækker[i]);
        if (d > Math.max(pxPerM * 1.6, rækker[i].dybde * 1.2)) continue;
        let score = d / pxPerM;
        if (nFag) {
          const plads = rækker[i].kilde === 'blok' ? rækker[i].dele : iM(rækker[i].laengde) / grænser.fagbredde;
          score += 0.4 * Math.max(0, nFag - plads - 0.5);
        }
        if (score < bedstScore) { bedstScore = score; bedst = i; bedstAfstand = d; }
      }
      if (bedst >= 0) tilhør[bedst].push(t);
    }
    return [].concat(...rækker.map((r, i) => beskriv(r, tilhør[i], pxPerM, grænser))).filter(Boolean);
  }

  function lagType(navn) {
    for (const [mønster, t] of LAGORDBOG) if (mønster.test(navn || '')) return t;
    return null;
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
    /* To forskellige blokke er to forskellige møbler, også når de står
       klods op ad hinanden - kølereolen LISBONA og reolen "Reol 90-80 F&G"
       ved siden af blev ellers til én række på 60 dele. Anonyme *U-blokke
       kan dog godt være samme modul under flere navne. */
    const navnA = a.navn && !/^\*/.test(a.navn) ? a.navn : null;
    const navnB = b.navn && !/^\*/.test(b.navn) ? b.navn : null;
    if (navnA && navnB && navnA !== navnB) return false;
    if ((a.kilde === 'blok') !== (b.kilde === 'blok')) return false;
    if (a.lag !== b.lag && (lagType(a.lag) || lagType(b.lag)) && lagType(a.lag) !== lagType(b.lag)) return false;
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
    const navne = Array.from(new Set(gruppe.map(g => g.navn).filter(Boolean)));
    const midtU = (langsMin + langsMaks) / 2;
    return {
      dele: gruppe.length,
      // delenes placering langs rækken, så et afsnit af rækken kan tælle sine egne
      deleU: gruppe.map(g => g.centrum[0] * c + g.centrum[1] * s - midtU),
      lag: gruppe[0].lag,
      navne,
      blokTekst: gruppe.map(g => g.blokTekst).filter(Boolean).join(' '),
      kilde: gruppe.every(g => g.kilde === 'blok') ? 'blok' : (gruppe.some(g => g.kilde === 'blok') ? 'blandet' : 'form'),
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
      // afsnittet tæller kun de moduler, der står i det - ikke hele rækkens
      const egne = (r.deleU || []).filter(du => du >= u && du < u + l).length;
      dele.push(enkeltMøbel({ ...r, dele: egne || 1 }, t.tekst, l, centrum, pxPerM, grænser));
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
    /* Typen bestemmes i den rækkefølge, oplysningerne er til at stole på:
       bloknavnet er tegnerens eget ord for møblet, lagnavnet hans ordning,
       teksten ved siden af hans varegruppe - og formen er det sidste gæt. */
    let type = null, bestemtAf = 'form', sikkerhed = 0.4;
    const slåOp = (ordbog, streng) => {
      if (!streng) return null;
      for (const [mønster, t] of ordbog) if (mønster.test(streng)) return t;
      return null;
    };
    // det, brugeren allerede har bekræftet om denne blok eller dette lag, vinder alt
    const lært = grænser.ordbog || { blok: {}, lag: {} };
    for (const n of (r.navne || [])) if (lært.blok[n]) { type = lært.blok[n]; bestemtAf = 'bekræftet'; sikkerhed = 1.0; break; }
    if (!type && lært.lag[r.lag]) { type = lært.lag[r.lag]; bestemtAf = 'bekræftet'; sikkerhed = 1.0; }
    const blokNavn = (r.navne || []).join(' ') + ' ' + (r.blokTekst || '');
    if (!type) type = slåOp(ORDBOG, r.navne && r.navne.length ? blokNavn : '');
    if (type && bestemtAf === 'form') { bestemtAf = 'blok'; sikkerhed = 1.0; }
    if (!type) { type = slåOp(LAGORDBOG, r.lag); if (type) { bestemtAf = 'lag'; sikkerhed = 0.9; } }
    if (!type && tekst && !IKKE_INVENTAR.test(tekst)) {
      type = slåOp(ORDBOG, tekst);
      if (type) { bestemtAf = 'tekst'; sikkerhed = 0.7; }
    }
    if (!type) {
      if (dybde > 1.6) type = 'frostoe';
      else if (dybde > 1.05) type = 'koel';
      else type = 'reol';
      // en blok uden genkendeligt navn er stadig et møbel, tegneren satte der
      if (r.kilde === 'blok') sikkerhed = 0.6;
    }
    /* Teksten ved møblet er mere præcis end blok- og lagnavn, når de er
       forenelige: "Bake-off" på laget "Inventar" er brød, ikke reol, og
       "250+ende - Frost" på en TORONTO/MALMÖ-gondol gør den til frost - det
       er samme kabinetfamilie i kold og frossen udgave. Men teksten må ikke
       flytte en køler over på reol-siden. */
    if ((bestemtAf === 'lag' || bestemtAf === 'blok') && tekst) {
      const fraTekst = slåOp(ORDBOG, tekst);
      const kolde = { koel: 1, frost: 1, frostoe: 1 };
      if (fraTekst && fraTekst !== type && !!kolde[fraTekst] === !!kolde[type]) {
        type = fraTekst; bestemtAf += '+tekst'; sikkerhed = Math.max(sikkerhed, 0.95);
      } else if (fraTekst && kolde[fraTekst] && !kolde[type]) {
        /* "375cm F&G-køl" på blokken "Reol 90-80 F&G": blokken siger reol,
           teksten siger køl. Kulde er en egenskab, tegneren skriver på med
           vilje - et generisk bloknavn er det ikke. Teksten vinder. */
        type = fraTekst; bestemtAf = 'tekst'; sikkerhed = 0.85;
      }
    }

    // "6 Baby" betyder 6 fag, "4,37 m Drikkevare køl" er en længde
    let fag = null, kategori = tekst;
    const mFag = /^\s*(\d{1,2})\s+(\D.*)$/.exec(tekst);
    const mMeter = /(\d+[.,]\d+|\d+)\s*m\b/i.exec(tekst);
    if (mFag) { fag = +mFag[1]; kategori = mFag[2].trim(); }
    /* Er rækken lagt af blokke, er modulerne fagene - tegneren satte ét
       modul pr. fag, og det er dét, hans egen stykliste tæller. "5 Konserves
       på 6 fag" står på 6 moduler, og "7 Vin" der er havnet ved ét modul,
       er ét fag her, uanset hvad tallet siger. */
    if (r.kilde === 'blok' && r.dele > 0 && INVENTAR_TYPER[type].maaler === 'fag') fag = r.dele;
    if (mMeter) kategori = tekst.replace(mMeter[0], '').trim();
    if (!fag && INVENTAR_TYPER[type].maaler === 'fag') {
      /* Er rækken lagt sammen af blokke, er antallet af blokke antallet af
         fag - tegneren satte ét modul pr. fag. Ellers regnes med fagbredden. */
      fag = r.kilde === 'blok' && r.dele > 0 ? r.dele : Math.max(1, Math.round(laengde / grænser.fagbredde));
    }
    /* Står længden i teksten, er den tegnerens specifikation, og den vinder
       over det, geometrien gav - kølemøbler er tit tegnet som mange små
       stykker (front, sokkel, respektafstand), så rektanglet er et fragment.
       Møblet lægges så med sin rigtige længde langs sin egen akse, om det
       punkt vi fandt. */
    let laengdeM = laengde, fraTekst = false;
    // en blok er et helt møbel med sine egne mål; kun løs geometri er fragmenter
    if (r.kilde !== 'blok' && maal.laengde && maal.laengde >= 0.5 && Math.abs(maal.laengde - laengde) / maal.laengde > 0.15) {
      laengdeM = maal.laengde + (maal.medEnde ? 0.6 : 0);
      fraTekst = true;
    }
    const laengdeBrugt = fraTekst ? laengdeM * pxPerM : laengdePx;
    // ligger det målte fragment på tværs af den længde teksten siger, vendes møblet
    let vinkel = r.vinkel;
    if (fraTekst && laengdeM > 1.5 && iM(r.dybde) > laengde * 1.3) vinkel = r.vinkel + Math.PI / 2;
    const c = Math.cos(vinkel), s = Math.sin(vinkel);
    const hl = laengdeBrugt / 2;
    const dybdeM = fraTekst ? (maal.dybde || (type === 'koel' || type === 'frost' ? 1.0 : Math.min(laengde, dybde))) : dybde;
    const hd = (fraTekst ? dybdeM * pxPerM : r.dybde) / 2;
    const hjørne = (u, v) => [centrum[0] + u * c - v * s, centrum[1] + u * s + v * c];
    const model = vælgModel(type, maal.dybde || dybdeM, laengdeM, tekst);
    const modelHøjde = (typeof MØBLER !== 'undefined' && MØBLER[model] ? MØBLER[model].hoejde : INVENTAR_TYPER[type].hoejde);
    return {
      type, kategori, tekst, fag, model,
      laengde: laengdeM, dybde: dybdeM, laengdeFraTekst: fraTekst,
      // mål skrevet på tegningen vinder over modellens standardmål
      hoejde: maal.hoejde || modelHøjde,
      vinkel,
      centrum,
      hjørner: [hjørne(-hl, -hd), hjørne(hl, -hd), hjørne(hl, hd), hjørne(-hl, hd)],
      dele: r.dele || 1,
      lag: r.lag,
      blok: r.navne && r.navne.length ? r.navne.join(', ') : null,
      bestemtAf, sikkerhed,
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
        // en køler på 1,5 m og derover i dybden er en gondol med front til begge sider
        if (dybde >= 1.5) return 'koelGondol';
        // "LISBONA LF 95 3750 G" - G står for glaslåger, N for åbent møbel
        const m = /(lisbona|santiago)[^\d]*(?:lf\s*\d+\s*)?\d{4}\s*([gn])/i.exec(t);
        if (m) return m[2].toLowerCase() === 'g' ? 'koelLaage' : 'koelAaben';
        return /åben|aaben|multideck|frugt|grønt|gront/.test(t) ? 'koelAaben' : 'koelLaage';
      }
      case 'frost': return dybde >= 1.5 ? (laengde > dybde * 1.6 ? 'frostGondol' : 'frostOe') : (dybde > 1.2 ? 'frostOe' : 'frostSkab');
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

  /* Tegningens egen opgørelse. Inventarplanen har tit sin stykliste stående
     i tegningshovedet - på Fakta-tegningen som én tekst:
       "Alm. fag: 152 (inkl BO) Bake-Off-fag: 3 Akt-borde: 12
        1/4-pl-pladser: 32 Endemoduler: 9 F&G-borde: 4 1/2-Pl-rammer: 4"
     Det er tegnerens facit, og det er dét, optællingen skal holdes op mod. */
  function tegningensOpgoerelse(lag) {
    const ud = {};
    const felter = [
      [/alm\.?\s*fag\s*:\s*(\d+)/i, 'fag'],
      [/bake.?off.?fag\s*:\s*(\d+)/i, 'bakeOffFag'],
      [/akt.?borde?\s*:\s*(\d+)/i, 'aktBorde'],
      [/1\/4.?pl.?pladser\s*:\s*(\d+)/i, 'kvartpallePladser'],
      [/1\/2.?pl.?rammer\s*:\s*(\d+)/i, 'halvpalleRammer'],
      [/endemoduler\s*:\s*(\d+)/i, 'endemoduler'],
      [/f&g.?borde?\s*:\s*(\d+)/i, 'fgBorde'],
      [/k[øo]l\s*:\s*(\d+[.,]?\d*)\s*m/i, 'meterKoel'],
      [/frost\s*:\s*(\d+[.,]?\d*)\s*m/i, 'meterFrost']
    ];
    for (const t of (lag.tegning.tekster || [])) {
      const tekst = (t.t || '').replace(/\s+/g, ' ');
      for (const [m, navn] of felter) {
        const r = m.exec(tekst);
        if (r && ud[navn] == null) ud[navn] = parseFloat(r[1].replace(',', '.'));
      }
    }
    return Object.keys(ud).length ? ud : null;
  }

  return { find, findZoner, stykliste, tegningensOpgoerelse, erRektangel, vælgModel, INVENTAR_TYPER, RUMNAVNE };
})();
