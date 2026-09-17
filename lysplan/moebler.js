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

  /* Bygger møblet som flader i verdenskoordinater (meter).
     u løber langs møblet, v på tværs, z opad. */
  function byg(item, valg) {
    const m = model(item);
    const c = Math.cos(item.vinkel), s = Math.sin(item.vinkel);
    const cx = item.centrum[0], cy = item.centrum[1];
    const L = item.laengde;
    const D = Math.min(item.dybde || m.dybde, m.dybde * 1.6) || m.dybde;
    const H = item.hoejde || m.hoejde;
    const flader = [];

    // enkeltsidede møbler vendes, så fronten peger ind mod butikken
    const vend = item.vendt === -1 ? -1 : 1;
    const P = (u, v, z) => [cx + u * c - (v * vend) * s, cy + u * s + (v * vend) * c, z];
    const quad = (punkter, farve, slags, glas) => flader.push({ punkter, farve, slags, glas: !!glas });
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
      langsFlade(u0, u1, v0, 0, m.sokkel, MATERIALER.sokkel, 'sokkel');
      langsFlade(u0, u1, v1, 0, m.sokkel, MATERIALER.sokkel, 'sokkel');
      gavl(u0, v0, v1, 0, m.sokkel, MATERIALER.sokkel, 'sokkel');
      gavl(u1, v0, v1, 0, m.sokkel, MATERIALER.sokkel, 'sokkel');
    }

    if (m.hylder) byggReol(m, item, { L, D, H, u0, u1, v0, v1, moduler, modulBredde }, { langsFlade, vandret, gavl, quad, P }, valg);
    else if (m.laag) byggFrostoe(m, item, { L, D, H, u0, u1, v0, v1, moduler, modulBredde }, { langsFlade, vandret, gavl, quad, P });
    else if (m.skraaglas) byggDisk(m, item, { L, D, H, u0, u1, v0, v1 }, { langsFlade, vandret, gavl, quad, P });
    else if (m.baand) byggKassebaand(m, item, { L, D, H, u0, u1, v0, v1 }, { langsFlade, vandret, gavl, quad, P });
    else if (m.skaerm) byggSelvkasse(m, item, { L, D, H, u0, u1, v0, v1 }, { langsFlade, vandret, gavl, quad, P });
    else if (m.skraakasser) byggPodie(m, item, { L, D, H, u0, u1, v0, v1, moduler, modulBredde }, { langsFlade, vandret, gavl, quad, P });
    else {
      // enkel kasse som sidste udvej
      langsFlade(u0, u1, v0, 0, H, MATERIALER.stel, 'krop');
      langsFlade(u0, u1, v1, 0, H, MATERIALER.stel, 'krop');
      gavl(u0, v0, v1, 0, H, MATERIALER.stel, 'krop');
      gavl(u1, v0, v1, 0, H, MATERIALER.stel, 'krop');
      vandret(u0, u1, v0, v1, H, MATERIALER.stel, 'top');
    }
    return flader;
  }

  /* Reoler, kølereoler og frostreoler: sokkel, bagvæg, gavle, hylder med
     varer, skiltefrise og eventuelle glaslåger. */
  function byggReol(m, item, g, t, valg) {
    const { L, D, H, u0, u1, v0, v1, moduler, modulBredde } = g;
    const { langsFlade, vandret, gavl, quad, P } = t;
    const kold = m.type === 'koel' || m.type === 'frost';
    const stel = kold ? MATERIALER.kold : MATERIALER.stel;
    const sider = m.dobbelt ? [1, -1] : [1];
    const bagvægV = m.dobbelt ? 0 : v0 + 0.02;

    // bagvæg (midt i en dobbeltsidet gondol, bagerst i en enkeltsidet)
    langsFlade(u0, u1, bagvægV, m.sokkel || 0, H, kold ? '#46515C' : MATERIALER.bagvaeg, 'bagvaeg');
    if (!m.dobbelt) langsFlade(u0, u1, bagvægV + 0.01, m.sokkel || 0, H, kold ? '#46515C' : MATERIALER.bagvaeg, 'bagvaeg');

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
        // hyldeplan og forkant
        vandret(u0, u1, hyldeV0, hyldeV1, z, MATERIALER.hylde, 'hylde');
        langsFlade(u0, u1, frontV, z, z + 0.035, stel, 'forkant');
        // varer pr. fag
        for (let k = 0; k < moduler; k++) {
          const a = u0 + k * modulBredde + 0.03;
          const b = a + modulBredde - 0.06;
          const farve = vareFarve(item.kategori || item.type, h * 7 + k + (side > 0 ? 0 : 3));
          const top = z + 0.04 + varehøjde;
          const varV = frontV + retning * Math.min(dybde * 0.9, 0.5);
          // forside og top af varerækken
          quad([P(a, frontV + retning * 0.03, z + 0.04), P(b, frontV + retning * 0.03, z + 0.04),
                P(b, frontV + retning * 0.03, top), P(a, frontV + retning * 0.03, top)], farve, 'vare');
          quad([P(a, frontV + retning * 0.03, top), P(b, frontV + retning * 0.03, top),
                P(b, varV, top), P(a, varV, top)], farve, 'vare');
        }
      }
      // skiltefrise øverst
      if (frise) langsFlade(u0, u1, frontV, H - frise, H, MATERIALER.skilt, 'skilt');

      // glaslåger foran kølemøbler
      if (m.laager) {
        const bredde = m.laagebredde || 0.625;
        const antalLåger = Math.max(1, Math.round(L / bredde));
        for (let k = 0; k < antalLåger; k++) {
          const a = u0 + (L / antalLåger) * k;
          const b = a + L / antalLåger;
          langsFlade(a + 0.015, b - 0.015, frontV + retning * -0.02, bund, H - frise, MATERIALER.glas, 'glas', true);
          gavl(a + 0.015, frontV, frontV + retning * -0.02, bund, H - frise, stel, 'karm');
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
    const krop = MATERIALER.kold;
    langsFlade(u0, u1, v0, m.sokkel, H, krop, 'krop');
    langsFlade(u0, u1, v1, m.sokkel, H, krop, 'krop');
    gavl(u0, v0, v1, m.sokkel, H, krop, 'krop');
    gavl(u1, v0, v1, m.sokkel, H, krop, 'krop');
    // kurve med varer nede i øen
    for (let k = 0; k < moduler; k++) {
      const a = u0 + k * modulBredde + 0.04, b = a + modulBredde - 0.08;
      vandret(a, b, v0 + 0.08, v1 - 0.08, H - 0.28, vareFarve(item.kategori || 'frost', k), 'vare');
      gavl(b, v0 + 0.08, v1 - 0.08, H - 0.28, H - 0.04, krop, 'kurv');
    }
    // glaslåg
    vandret(u0, u1, v0 + 0.03, v1 - 0.03, H, MATERIALER.glas, 'glas', true);
  }

  function byggDisk(m, item, g, t) {
    const { L, D, H, u0, u1, v0, v1 } = g;
    const { langsFlade, vandret, gavl, quad, P } = t;
    const krop = MATERIALER.kold;
    langsFlade(u0, u1, v0, m.sokkel, H * 0.72, krop, 'krop');
    langsFlade(u0, u1, v1, m.sokkel, H * 0.72, krop, 'krop');
    gavl(u0, v0, v1, m.sokkel, H, krop, 'krop');
    gavl(u1, v0, v1, m.sokkel, H, krop, 'krop');
    // varer i disken
    vandret(u0 + 0.05, u1 - 0.05, v0 + 0.1, v1 - 0.25, H * 0.72, vareFarve(item.kategori || 'disk', 1), 'vare');
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
    // skrå kasser med frugt og grønt
    for (let k = 0; k < moduler; k++) {
      const a = u0 + k * modulBredde + 0.03, b = a + modulBredde - 0.06;
      const farve = vareFarve('frugt' + (item.kategori || ''), k);
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

  return { MØBLER, STANDARDMODEL, MATERIALER, byg, opgør, model, vareFarve };
})();
