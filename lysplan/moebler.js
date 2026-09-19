/* Møbelbibliotek: butiksinventar med de mål, der er gængse i dansk detail.
   Målene er typetal - fagbredde 1000 mm på reoler, 1250 mm moduler på køl,
   sokkel 120 mm og så videre - og kan rettes pr. møbel, når leverandørens
   egne mål kendes. Hvert møbel bygges op af flader, så 3D-billedet viser
   hylder, sokkel, låger og bånd i stedet for en kasse. */

const MØBLER = {
  gondol1800: {
    navn: 'Gondolareol 1800, dobbeltsidet', type: 'reol', dobbelt: true,
    hoejde: 1.8, dybde: 1.0, modul: 1.0, hylder: 5, sokkel: 0.12,
    hyldedybde: 0.47, bunddybde: 0.57, skiltehoejde: 0.12
  },
  gondol2100: {
    navn: 'Gondolareol 2100, dobbeltsidet', type: 'reol', dobbelt: true,
    hoejde: 2.1, dybde: 1.0, modul: 1.0, hylder: 6, sokkel: 0.12,
    hyldedybde: 0.47, bunddybde: 0.57, skiltehoejde: 0.12
  },
  gondol2200lav: {
    navn: 'Gondolareol 1400, lav gennemsigt', type: 'reol', dobbelt: true,
    hoejde: 1.4, dybde: 1.0, modul: 1.0, hylder: 4, sokkel: 0.12,
    hyldedybde: 0.47, bunddybde: 0.57, skiltehoejde: 0.1
  },
  vaegreol2200: {
    navn: 'Vægreol 2200, enkeltsidet', type: 'vaegreol', dobbelt: false,
    hoejde: 2.2, dybde: 0.6, modul: 1.0, hylder: 6, sokkel: 0.12,
    hyldedybde: 0.47, bunddybde: 0.57, skiltehoejde: 0.12
  },
  broedreol: {
    navn: 'Brødreol med skrå hylder', type: 'reol', dobbelt: false,
    hoejde: 1.6, dybde: 0.7, modul: 1.0, hylder: 4, sokkel: 0.12,
    hyldedybde: 0.5, bunddybde: 0.6, skraa: true, skiltehoejde: 0.1
  },
  koelLaage: {
    navn: 'Kølereol med glaslåger 2100', type: 'koel', dobbelt: false,
    hoejde: 2.1, dybde: 0.9, modul: 1.25, hylder: 5, sokkel: 0.15,
    hyldedybde: 0.62, bunddybde: 0.7, laager: true, laagebredde: 0.625,
    kappe: 0.25, skiltehoejde: 0.12
  },
  koelGondol: {
    navn: 'Kølegondol med glaslåger, dobbeltsidet', type: 'koel', dobbelt: true,
    hoejde: 2.0, dybde: 1.9, modul: 1.25, hylder: 5, sokkel: 0.15,
    hyldedybde: 0.6, bunddybde: 0.7, laager: true, laagebredde: 0.625,
    kappe: 0.25, skiltehoejde: 0.12
  },
  frostGondol: {
    navn: 'Frostgondol med glaslåger, dobbeltsidet', type: 'frost', dobbelt: true,
    hoejde: 2.0, dybde: 1.9, modul: 0.75, hylder: 5, sokkel: 0.15,
    hyldedybde: 0.55, bunddybde: 0.62, laager: true, laagebredde: 0.75,
    kappe: 0.22, skiltehoejde: 0.12
  },
  koelAaben: {
    navn: 'Åben kølereol (multideck) 2000', type: 'koel', dobbelt: false,
    hoejde: 2.0, dybde: 0.9, modul: 1.25, hylder: 4, sokkel: 0.15,
    hyldedybde: 0.6, bunddybde: 0.72, laager: false, kappe: 0.3, skiltehoejde: 0.12
  },
  frostSkab: {
    navn: 'Frostreol med glaslåger 2000', type: 'frost', dobbelt: false,
    hoejde: 2.0, dybde: 0.8, modul: 0.75, hylder: 5, sokkel: 0.15,
    hyldedybde: 0.55, bunddybde: 0.62, laager: true, laagebredde: 0.75,
    kappe: 0.22, skiltehoejde: 0.12
  },
  frostOe: {
    navn: 'Frostø med glaslåg 1100', type: 'frostoe', dobbelt: false,
    hoejde: 1.1, dybde: 1.35, modul: 1.25, sokkel: 0.12, laag: true, kurve: true
  },
  disk: {
    navn: 'Betjeningsdisk med skråt glas', type: 'betjening', dobbelt: false,
    hoejde: 1.25, dybde: 1.2, modul: 1.25, sokkel: 0.12, skraaglas: true, kappe: 0.2
  },
  kassebaand: {
    navn: 'Kassebånd med scanner og terminal', type: 'kasse', dobbelt: false,
    hoejde: 0.95, dybde: 0.9, modul: 3.0, baand: true, skaerm: true
  },
  selvkasse: {
    navn: 'Selvbetjeningskasse', type: 'kasse', dobbelt: false,
    hoejde: 1.45, dybde: 0.7, modul: 0.7, skaerm: true, pose: true
  },
  podie: {
    navn: 'Frugt & grønt-podie med skrå kasser', type: 'bord', dobbelt: false,
    hoejde: 0.95, dybde: 1.2, modul: 1.25, sokkel: 0.1, skraakasser: true
  },
  pallereol: {
    navn: 'Lagerreol til paller, 2 niveauer', type: 'pallereol', dobbelt: false,
    hoejde: 2.5, dybde: 1.1, modul: 2.7, hylder: 2, sokkel: 0.1,
    hyldedybde: 1.0, bunddybde: 1.05, skiltehoejde: 0
  },
  palleplads: {
    navn: 'Pallefelt / spotvare', type: 'andet', dobbelt: false,
    hoejde: 1.2, dybde: 1.2, modul: 1.2, palle: true
  }
};

/* Hvilken model der bruges, når tegningen kun siger "reol" eller "køl". */
const STANDARDMODEL = {
  reol: 'gondol1800', vaegreol: 'vaegreol2200', koel: 'koelLaage',
  frost: 'frostSkab', frostoe: 'frostOe', betjening: 'disk',
  kasse: 'kassebaand', bord: 'podie', display: 'palleplads',
  endegavl: 'gondol1800', broed: 'broedreol', pallereol: 'pallereol',
  palle: 'palleplads', automat: 'selvkasse', andet: 'palleplads'
};

const MATERIALER = {
  stel: '#D9D6CF',        // lakeret stål, lys
  sokkel: '#3B4049',
  bagvaeg: '#C9C6BE',
  hylde: '#E6E3DC',
  kold: '#5A6672',        // kølemøblers stel
  glas: '#BBD7E8',
  skilt: '#F2F0EA',
  baand: '#2E3238',
  skaerm: '#1C2026',
  trae: '#9C6B3F',
  palle: '#B08A5A'
};

const Moebler = (() => {

  /* Farve på varerne: samme varegruppe giver samme farve hver gang. */
  function vareFarve(navn, nr) {
    let h = 0;
    const tekst = (navn || 'vare') + ':' + nr;
    for (let i = 0; i < tekst.length; i++) h = (h * 31 + tekst.charCodeAt(i)) % 360;
    const s = 14 + (h % 13);
    const l = 48 + ((h >> 3) % 17);
    return `hsl(${h} ${s}% ${l}%)`;
  }

  function model(item) {
    return MØBLER[item.model] || MØBLER[STANDARDMODEL[item.type]] || MØBLER.gondol1800;
  }

  /* Materialerne følger kæden, når der er valgt en. */
  function materialer(valg) {
    const k = valg && valg.kaede && typeof KAEDER !== 'undefined' ? KAEDER[valg.kaede] : null;
    if (!k) return MATERIALER;
    return { ...MATERIALER, stel: k.stel, sokkel: k.sokkel, hylde: k.hylde, bagvaeg: k.bagvaeg, kold: k.kold, skilt: k.accent, skiltTekst: k.skiltTekst };
  }

  /* Hvordan varerne i en varegruppe ser ud. */
  function vareUdseende(kategori, type) {
    const navn = (kategori || '') + ' ' + (type || '');
    if (typeof VARER !== 'undefined') for (const [m, v] of VARER) if (m.test(navn)) return v;
    if (/koel/.test(type)) return { form: 'pakke', farver: ['#FFFFFF', '#F1E8C8', '#D94E4E', '#4E7FD9'], hoejde: [0.12, 0.24], bredde: 0.1 };
    if (/frost/.test(type)) return { form: 'pakke', farver: ['#EAF3F7', '#BFD9E6', '#E8E0F0', '#FFFFFF'], hoejde: [0.12, 0.2], bredde: 0.16 };
    return typeof VARE_STANDARD !== 'undefined' ? VARE_STANDARD : { form: 'pakke', farver: ['#D8CFC0', '#B8C4CC'], hoejde: [0.14, 0.24], bredde: 0.14 };
  }

  /* Deterministisk "tilfældighed", så samme hylde ser ens ud hver gang. */
  function frø(...dele) {
    let h = 2166136261;
    const t = dele.join(':');
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }

  /* Varerne på én hylde i ét fag: en række facings som kasser, flasker
     eller dåser med lidt variation i højde - det er sådan en fyldt hylde ser
     ud. Som "detalje", så 3D-kigget kan nøjes med en samlet vareflade langt
     væk og bruge de enkelte varer tæt på. */
  function byggVarer(quad, P, a, b, frontV, retning, z, dybde, udseende, nr, farveFald) {
    const r = frø(nr, a.toFixed(2), z.toFixed(2));
    const bredde = udseende.bredde;
    const antal = Math.max(1, Math.floor((b - a) / (bredde + 0.015)));
    const brugt = antal * bredde + (antal - 1) * 0.015;
    let u = a + ((b - a) - brugt) / 2;
    const dyb = Math.min(dybde * 0.9, 0.5);
    const rækker = udseende.form === 'flaske' || udseende.form === 'daase' ? 3 : 2;
    for (let k = 0; k < antal; k++) {
      const farve = udseende.farver[Math.floor(r() * udseende.farver.length)];
      const h = udseende.hoejde[0] + r() * (udseende.hoejde[1] - udseende.hoejde[0]);
      const top = z + 0.04 + h;
      const u0 = u, u1 = u + bredde;
      const v0 = frontV + retning * 0.03;
      if (udseende.form === 'loes') {
        // løs frugt og grønt: en bunke, ikke facings
        quad([P(u0, v0, z + 0.04), P(u1, v0, z + 0.04), P(u1, v0, top), P(u0, v0, top)], farve, 'vare', false, true);
        quad([P(u0, v0, top), P(u1, v0, top), P(u1, frontV + retning * dyb, top), P(u0, frontV + retning * dyb, top)], farve, 'vare', false, true);
      } else {
        // forside
        quad([P(u0, v0, z + 0.04), P(u1, v0, z + 0.04), P(u1, v0, top), P(u0, v0, top)], farve, 'vare', false, true);
        // flasker og dåser har en hals/lågkant i mørkere tone; kasser en top
        const topFarve = udseende.form === 'pakke' ? farve : farveFald(farve, 0.7);
        const v1 = frontV + retning * Math.min(dyb, rækker * (bredde + 0.01));
        quad([P(u0, v0, top), P(u1, v0, top), P(u1, v1, top), P(u0, v1, top)], topFarve, 'vare', false, true);
        // en lille side, så rækken får dybde set skråt fra
        quad([P(u1, v0, z + 0.04), P(u1, v1, z + 0.04), P(u1, v1, top), P(u1, v0, top)], farveFald(farve, 0.82), 'vare', false, true);
      }
      u += bredde + 0.015;
    }
  }

  /* Bygger møblet som flader i verdenskoordinater (meter).
     u løber langs møblet, v på tværs, z opad. */
  function farveFald(hex, f) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    if (isNaN(n)) return hex;
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function byg(item, valg) {
    const m = model(item);
    const MAT = materialer(valg);
    const c = Math.cos(item.vinkel), s = Math.sin(item.vinkel);
    const cx = item.centrum[0], cy = item.centrum[1];
    const L = item.laengde;
    const D = Math.min(item.dybde || m.dybde, m.dybde * 1.6) || m.dybde;
    const H = item.hoejde || m.hoejde;
    const flader = [];

    // enkeltsidede møbler vendes, så fronten peger ind mod butikken
    const vend = item.vendt === -1 ? -1 : 1;
    const P = (u, v, z) => [cx + u * c - (v * vend) * s, cy + u * s + (v * vend) * c, z];
    const quad = (punkter, farve, slags, glas, detalje, tekst) => flader.push({ punkter, farve, slags, glas: !!glas, detalje: !!detalje, tekst: tekst || null });
    // lodret flade langs møblet (front eller bagside)
    const langsFlade = (u0, u1, v, z0, z1, farve, slags, glas) =>
      quad([P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)], farve, slags, glas);
    // vandret flade (hyldeplan, top)
    const vandret = (u0, u1, v0, v1, z, farve, slags, glas) =>
      quad([P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], farve, slags, glas);
    // gavl i enden af møblet
    const gavl = (u, v0, v1, z0, z1, farve, slags) =>
      quad([P(u, v0, z0), P(u, v1, z0), P(u, v1, z1), P(u, v0, z1)], farve, slags);

    const u0 = -L / 2, u1 = L / 2;
    const v0 = -D / 2, v1 = D / 2;
    const moduler = Math.max(1, Math.round(L / m.modul));
    const modulBredde = L / moduler;

    // sokkel hele vejen rundt
    if (m.sokkel) {
      langsFlade(u0, u1, v0, 0, m.sokkel, MAT.sokkel, 'sokkel');
      langsFlade(u0, u1, v1, 0, m.sokkel, MAT.sokkel, 'sokkel');
      gavl(u0, v0, v1, 0, m.sokkel, MAT.sokkel, 'sokkel');
      gavl(u1, v0, v1, 0, m.sokkel, MAT.sokkel, 'sokkel');
    }

    if (m.hylder) byggReol(m, item, { L, D, H, u0, u1, v0, v1, moduler, modulBredde, MAT }, { langsFlade, vandret, gavl, quad, P }, valg);
    else if (m.laag) byggFrostoe(m, item, { L, D, H, u0, u1, v0, v1, moduler, modulBredde, MAT }, { langsFlade, vandret, gavl, quad, P });
    else if (m.skraaglas) byggDisk(m, item, { L, D, H, u0, u1, v0, v1, MAT }, { langsFlade, vandret, gavl, quad, P });
    else if (m.baand) byggKassebaand(m, item, { L, D, H, u0, u1, v0, v1 }, { langsFlade, vandret, gavl, quad, P });
    else if (m.skaerm) byggSelvkasse(m, item, { L, D, H, u0, u1, v0, v1 }, { langsFlade, vandret, gavl, quad, P });
    else if (m.skraakasser) byggPodie(m, item, { L, D, H, u0, u1, v0, v1, moduler, modulBredde }, { langsFlade, vandret, gavl, quad, P });
    else {
      // enkel kasse som sidste udvej
      langsFlade(u0, u1, v0, 0, H, MAT.stel, 'krop');
      langsFlade(u0, u1, v1, 0, H, MAT.stel, 'krop');
      gavl(u0, v0, v1, 0, H, MAT.stel, 'krop');
      gavl(u1, v0, v1, 0, H, MAT.stel, 'krop');
      vandret(u0, u1, v0, v1, H, MAT.stel, 'top');
    }
    return flader;
  }

  /* Reoler, kølereoler og frostreoler: sokkel, bagvæg, gavle, hylder med
     varer, skiltefrise og eventuelle glaslåger. */
  function byggReol(m, item, g, t, valg) {
    const { L, D, H, u0, u1, v0, v1, moduler, modulBredde } = g;
    const MAT = g.MAT || MATERIALER;
    const { langsFlade, vandret, gavl, quad, P } = t;
    const kold = m.type === 'koel' || m.type === 'frost';
    const stel = kold ? MAT.kold : MAT.stel;
    const sider = m.dobbelt ? [1, -1] : [1];
    const bagvægV = m.dobbelt ? 0 : v0 + 0.02;
    const udseende = vareUdseende(item.kategori, item.type);
    // kølemøblets indre er lyst og køligt - det er der, lyset sidder
    const bagFarve = kold ? '#E9EEF2' : MAT.bagvaeg;

    // bagvæg (midt i en dobbeltsidet gondol, bagerst i en enkeltsidet)
    langsFlade(u0, u1, bagvægV, m.sokkel || 0, H, bagFarve, 'bagvaeg');
    if (!m.dobbelt) langsFlade(u0, u1, bagvægV + 0.01, m.sokkel || 0, H, bagFarve, 'bagvaeg');

    // gavle
    gavl(u0, v0, v1, m.sokkel || 0, H, stel, 'gavl');
    gavl(u1, v0, v1, m.sokkel || 0, H, stel, 'gavl');

    const bund = (m.sokkel || 0);
    const frise = m.skiltehoejde || 0;
    const nyttehøjde = H - bund - frise;
    const antal = m.hylder;
    const varehøjde = Math.min(0.33, (nyttehøjde / antal) * 0.62);

    for (const side of sider) {
      const frontV = side > 0 ? v1 : v0;
      const retning = side > 0 ? -1 : 1;                     // ind mod midten
      for (let h = 0; h < antal; h++) {
        const z = bund + (nyttehøjde / antal) * h;
        const dybde = h === 0 ? (m.bunddybde || 0.55) : (m.hyldedybde || 0.45);
        const hyldeV0 = frontV;
        const hyldeV1 = frontV + retning * Math.min(dybde, D / (m.dobbelt ? 2 : 1));
        // hyldeplan og forkant med prisskinne
        vandret(u0, u1, hyldeV0, hyldeV1, z, kold ? '#DDE3E8' : MAT.hylde, 'hylde');
        langsFlade(u0, u1, frontV, z, z + 0.035, kold ? '#F4F6F8' : stel, 'forkant');
        // i et kølemøbel sidder der en lysliste under hver hylde
        if (kold && h > 0) langsFlade(u0, u1, frontV + retning * 0.02, z - 0.012, z, '#FFFFFF', 'lys');
        // varer pr. fag: langt væk én samlet flade, tæt på de enkelte varer
        for (let k = 0; k < moduler; k++) {
          const a = u0 + k * modulBredde + 0.03;
          const b = a + modulBredde - 0.06;
          const grov = udseende.farver[(h * 7 + k) % udseende.farver.length];
          const top = z + 0.04 + Math.min(varehøjde, udseende.hoejde[1]);
          const varV = frontV + retning * Math.min(dybde * 0.9, 0.5);
          quad([P(a, frontV + retning * 0.03, z + 0.04), P(b, frontV + retning * 0.03, z + 0.04),
                P(b, frontV + retning * 0.03, top), P(a, frontV + retning * 0.03, top)], grov, 'vare-grov');
          quad([P(a, frontV + retning * 0.03, top), P(b, frontV + retning * 0.03, top),
                P(b, varV, top), P(a, varV, top)], grov, 'vare-grov');
          byggVarer(quad, P, a, b, frontV, retning, z, Math.min(dybde, (nyttehøjde / antal) * 1.2), udseende, h * 7 + k + (side > 0 ? 0 : 3), farveFald);
        }
      }
      // skiltefrise øverst i kædens farve, med varegruppen skrevet på
      if (frise) {
        const tekst = item.kategori && !/^\d+$/.test(item.kategori) ? item.kategori : null;
        quad([P(u0, frontV, H - frise), P(u1, frontV, H - frise), P(u1, frontV, H), P(u0, frontV, H)],
          MAT.skilt, 'skilt', false, false, tekst ? { tekst, farve: MAT.skiltTekst || '#FFFFFF' } : null);
      }

      // glaslåger foran kølemøbler
      if (m.laager) {
        const bredde = m.laagebredde || 0.625;
        const antalLåger = Math.max(1, Math.round(L / bredde));
        for (let k = 0; k < antalLåger; k++) {
          const a = u0 + (L / antalLåger) * k;
          const b = a + L / antalLåger;
          langsFlade(a + 0.015, b - 0.015, frontV + retning * -0.02, bund, H - frise, MATERIALER.glas, 'glas', true);
          // lågens ramme: en lodret sprosse pr. låge og et håndtag
          gavl(a + 0.015, frontV, frontV + retning * -0.02, bund, H - frise, stel, 'karm');
          langsFlade(a + 0.02, a + 0.05, frontV + retning * -0.03, bund, H - frise, farveFald(stel, 0.75), 'karm');
          langsFlade(b - 0.09, b - 0.06, frontV + retning * -0.04, bund + 0.5, bund + 1.1, '#9AA0A6', 'karm');
        }
      }
      // kappe over åbne kølemøbler
      if (m.kappe && !m.laager) {
        langsFlade(u0, u1, frontV, H - frise - m.kappe, H - frise, stel, 'kappe');
        vandret(u0, u1, frontV, frontV + retning * 0.35, H - frise, stel, 'kappe');
      }
    }
    vandret(u0, u1, v0, v1, H, stel, 'top');
  }

  function byggFrostoe(m, item, g, t) {
    const { L, D, H, u0, u1, v0, v1, moduler, modulBredde } = g;
    const { langsFlade, vandret, gavl, quad, P } = t;
    const krop = (g.MAT || MATERIALER).kold;
    langsFlade(u0, u1, v0, m.sokkel, H, krop, 'krop');
    langsFlade(u0, u1, v1, m.sokkel, H, krop, 'krop');
    gavl(u0, v0, v1, m.sokkel, H, krop, 'krop');
    gavl(u1, v0, v1, m.sokkel, H, krop, 'krop');
    // kurve med varer nede i øen - hvide og lyseblå pakker
    const ud = vareUdseende(item.kategori, 'frost');
    for (let k = 0; k < moduler; k++) {
      const a = u0 + k * modulBredde + 0.04, b = a + modulBredde - 0.08;
      vandret(a, b, v0 + 0.08, v1 - 0.08, H - 0.28, ud.farver[k % ud.farver.length], 'vare');
      gavl(b, v0 + 0.08, v1 - 0.08, H - 0.28, H - 0.04, krop, 'kurv');
    }
    // glaslåg
    vandret(u0, u1, v0 + 0.03, v1 - 0.03, H, MATERIALER.glas, 'glas', true);
  }

  function byggDisk(m, item, g, t) {
    const { L, D, H, u0, u1, v0, v1 } = g;
    const { langsFlade, vandret, gavl, quad, P } = t;
    const krop = (g.MAT || MATERIALER).kold;
    langsFlade(u0, u1, v0, m.sokkel, H * 0.72, krop, 'krop');
    langsFlade(u0, u1, v1, m.sokkel, H * 0.72, krop, 'krop');
    gavl(u0, v0, v1, m.sokkel, H, krop, 'krop');
    gavl(u1, v0, v1, m.sokkel, H, krop, 'krop');
    // varer i disken: kød og pålæg i røde og lyse toner
    vandret(u0 + 0.05, u1 - 0.05, v0 + 0.1, v1 - 0.25, H * 0.72, vareUdseende(item.kategori || 'kød', 'betjening').farver[0], 'vare');
    // skråt glas fra forkant op mod bagkant
    quad([P(u0, v1, H * 0.72), P(u1, v1, H * 0.72), P(u1, v0 + 0.2, H), P(u0, v0 + 0.2, H)], MATERIALER.glas, 'glas', true);
    if (m.kappe) langsFlade(u0, u1, v0, H, H + m.kappe, krop, 'kappe');
  }

  function byggKassebaand(m, item, g, t) {
    const { L, D, H, u0, u1, v0, v1 } = g;
    const { langsFlade, vandret, gavl, quad, P } = t;
    langsFlade(u0, u1, v0, 0, H, MATERIALER.stel, 'krop');
    langsFlade(u0, u1, v1, 0, H, MATERIALER.stel, 'krop');
    gavl(u0, v0, v1, 0, H, MATERIALER.stel, 'krop');
    gavl(u1, v0, v1, 0, H, MATERIALER.stel, 'krop');
    vandret(u0, u1, v0, v1, H, MATERIALER.stel, 'top');
    // transportbånd i den ene ende
    const båndSlut = u0 + Math.min(L * 0.45, 1.6);
    vandret(u0 + 0.05, båndSlut, v0 + 0.08, v1 - 0.08, H + 0.02, MATERIALER.baand, 'baand');
    // terminal og skærm ved kassen
    const kx = båndSlut + 0.35;
    langsFlade(kx, kx + 0.45, v0 + 0.15, H, H + 0.35, MATERIALER.skaerm, 'skaerm');
    vandret(kx, kx + 0.45, v0 + 0.15, v0 + 0.3, H + 0.35, MATERIALER.skaerm, 'skaerm');
    // pakkeplads i den anden ende
    vandret(kx + 0.6, u1 - 0.05, v0 + 0.08, v1 - 0.08, H + 0.02, MATERIALER.trae, 'pakke');
  }

  function byggSelvkasse(m, item, g, t) {
    const { L, D, H, u0, u1, v0, v1 } = g;
    const { langsFlade, vandret, gavl } = t;
    const krop = '#4A5058';
    langsFlade(u0, u1, v0, 0, H * 0.62, krop, 'krop');
    langsFlade(u0, u1, v1, 0, H * 0.62, krop, 'krop');
    gavl(u0, v0, v1, 0, H * 0.62, krop, 'krop');
    gavl(u1, v0, v1, 0, H * 0.62, krop, 'krop');
    vandret(u0, u1, v0, v1, H * 0.62, MATERIALER.stel, 'top');
    langsFlade(u0 + 0.08, u1 - 0.08, v0 + 0.12, H * 0.62, H, MATERIALER.skaerm, 'skaerm');
    vandret(u0 + 0.08, u1 - 0.08, v0 + 0.12, v0 + 0.2, H, MATERIALER.skaerm, 'skaerm');
  }

  function byggPodie(m, item, g, t) {
    const { L, D, H, u0, u1, v0, v1, moduler, modulBredde } = g;
    const { langsFlade, vandret, gavl, quad, P } = t;
    langsFlade(u0, u1, v0, m.sokkel, H * 0.65, MATERIALER.trae, 'krop');
    langsFlade(u0, u1, v1, m.sokkel, H * 0.65, MATERIALER.trae, 'krop');
    gavl(u0, v0, v1, m.sokkel, H * 0.65, MATERIALER.trae, 'krop');
    gavl(u1, v0, v1, m.sokkel, H * 0.65, MATERIALER.trae, 'krop');
    // skrå kasser med frugt og grønt i deres egne farver
    const ud = vareUdseende('frugt ' + (item.kategori || ''), 'bord');
    for (let k = 0; k < moduler; k++) {
      const a = u0 + k * modulBredde + 0.03, b = a + modulBredde - 0.06;
      const farve = ud.farver[k % ud.farver.length];
      quad([P(a, v0 + 0.05, H * 0.65), P(b, v0 + 0.05, H * 0.65), P(b, v1 - 0.05, H), P(a, v1 - 0.05, H)], farve, 'vare');
    }
  }

  /* Opgørelse pr. møbel: fag, hylder, låger og løbende meter. */
  function opgør(item) {
    const m = model(item);
    const moduler = Math.max(1, Math.round(item.laengde / m.modul));
    const sider = m.dobbelt ? 2 : 1;
    return {
      model: m,
      modelNavn: m.navn,
      moduler,
      modulBredde: m.modul,
      hylder: m.hylder ? moduler * m.hylder * sider : 0,
      laager: m.laager ? Math.max(1, Math.round(item.laengde / (m.laagebredde || m.modul))) : 0,
      laag: m.laag ? moduler : 0,
      meter: item.laengde,
      hyldemeter: m.hylder ? item.laengde * m.hylder * sider : 0
    };
  }

  return { MØBLER, STANDARDMODEL, MATERIALER, byg, opgør, model, vareFarve, vareUdseende, materialer };
})();
