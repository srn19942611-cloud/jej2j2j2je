/* Medvind — dropshipping-cockpit
   Alt kører lokalt i browseren. Ingen backend, ingen konto, ingen data ud af huset. */

/* ---------------------------------------------------------------- state */

const KEY = 'medvind.v1';
const LAUNCH_LENGTH = 14;

const DEFAULTS = {
  settings: {
    storeName: 'Min butik',
    storeTagline: 'Udvalgte ting, der gør en lille ting i hverdagen lettere.',
    storeDomain: 'minbutik.dk',
    shopFilter: 'live',
    vat: 25,
    feePct: 2.4,
    feeFix: 2.5,
    returnRate: 4,
    cpa: 80,
    usdRate: 6.9,
    targetMultiple: 3,
    goal: 5000,
    minutesPerWeek: 90,
    freeShipFrom: 299,
    shipPrice: 39,
    returnDays: 30,
    contactEmail: '',
    cvr: '',
    checkoutUrl: '',
    brandColor: '#0B7A5D'
  },
  products: [],
  log: [],
  done: {},
  routine: {},
  flow: { visitors: 400, atc: 7, checkout: 50, purchase: 60, cpc: 3.5, launch: {}, content: {} },
  hunt: { keyword: '', checks: {} }
};

let state = load();

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...saved,
      settings: { ...DEFAULTS.settings, ...(saved.settings||{}) },
      flow: { ...DEFAULTS.flow, ...(saved.flow||{}) },
      hunt: { ...DEFAULTS.hunt, ...(saved.hunt||{}) }
    };
  }catch(e){ return structuredClone(DEFAULTS); }
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){
    // Typisk fordi produktbillederne fylder for meget til browserens 5 MB
    toast(String(e).includes('uota')
      ? 'Der er ikke plads til mere — slet et produktbillede eller eksportér dine data'
      : 'Kunne ikke gemme — browseren blokerer lagring');
  }
}

/* ---------------------------------------------------------------- helpers */

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const uid = () => Math.random().toString(36).slice(2, 9);

const fmt = (n, d=0) => (isFinite(n) ? n : 0).toLocaleString('da-DK', {minimumFractionDigits:d, maximumFractionDigits:d});
const kr  = (n, d=0) => fmt(n, d) + ' kr.';
const pct = (n, d=0) => fmt(n*100, d) + ' %';
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setPath(obj, path, value){
  const parts = path.split('.');
  let o = obj;
  while(parts.length > 1) o = o[parts.shift()];
  o[parts[0]] = value;
}
function getPath(obj, path){
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

let toastTimer;
function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

const today = () => new Date().toISOString().slice(0, 10);
function isoWeek(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}
const weekLabel = w => 'Uge ' + w.split('-W')[1];

const EMOJI = ['🧴','🪑','🎧','🧦','🐾','🧘','🍳','🛏️','🚲','💡','🧰','🌿','📿','🪥','🧢','🎒','🕶️','⌚','🧩','🔌'];
function emojiFor(name){
  let h = 0;
  for(const ch of String(name||'x')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EMOJI[h % EMOJI.length];
}

/* ---------------------------------------------------------------- økonomi */

function economics(p){
  const s = state.settings;
  const vat   = num(s.vat) / 100;
  const price = num(p.price);
  const cogs  = num(p.cost) + num(p.ship);
  const net   = price / (1 + vat);
  const fee   = price * num(s.feePct) / 100 + num(s.feeFix);
  const r     = num(s.returnRate) / 100;
  const cpa   = (p.cpa === '' || p.cpa == null) ? num(s.cpa) : num(p.cpa);

  const dbOrder   = net - cogs - fee;              // pr. leveret ordre, før annoncer
  const dbReturns = dbOrder * (1 - r) - cogs * r;  // returer koster varen og fragten
  const profit    = dbReturns - cpa;               // det du reelt har tilbage
  const up        = upsell(p);
  const profitUp  = profit + up.perOrder;

  return {
    price, cogs, net, fee, cpa,
    dbOrder, dbReturns, profit, profitUp,
    up,
    beRoas:   dbOrder > 0 ? price / dbOrder : Infinity,
    maxCpa:   dbReturns,
    margin:   net > 0 ? profit / net : 0,
    multiple: cogs > 0 ? price / cogs : 0,
    aov:      price + up.grossPerOrder
  };
}

function upsell(p){
  const s = state.settings;
  const vat = num(s.vat) / 100;
  const u = p.upsell || {};
  const cogs = num(p.cost) + num(p.ship);
  const price = num(p.price);

  const bQty  = Math.max(0, num(u.bundleQty) - 1);
  const bRate = num(u.bundleRate) / 100;
  const bUnit = price * (1 - num(u.bundleDiscount) / 100);
  const bundle = bRate * bQty * (bUnit / (1 + vat) - cogs);
  const bundleGross = bRate * bQty * bUnit;

  const aRate = num(u.addonRate) / 100;
  const addon = aRate * (num(u.addonPrice) / (1 + vat) - num(u.addonCost));
  const addonGross = aRate * num(u.addonPrice);

  const pRate = num(u.postRate) / 100;
  const post = pRate * (num(u.postPrice) / (1 + vat) - num(u.postCost));
  const postGross = pRate * num(u.postPrice);

  const perOrder = bundle + addon + post;
  const grossPerOrder = bundleGross + addonGross + postGross;
  return { bundle, addon, post, perOrder, grossPerOrder, lift: price > 0 ? grossPerOrder / price : 0 };
}

function suggestedPrice(p){
  const cogs = num(p.cost) + num(p.ship);
  const raw = cogs * num(state.settings.targetMultiple);
  return prettyPrice(raw);
}
// Runder op til en pris, folk er vant til at se: 149, 199, 249, 299 …
function prettyPrice(raw){
  if(raw <= 0) return 0;
  const step = raw < 200 ? 10 : raw < 1000 ? 50 : 100;
  return Math.max(step, Math.ceil(raw / step) * step) - 1;
}

/* ---------------------------------------------------------------- scorekort */

const CRITERIA = [
  {key:'wow',      name:'Wow-effekt',                    why:'Stopper folk i scrollen inden for 3 sekunder.'},
  {key:'problem',  name:'Løser et konkret problem',      why:'Irritation sælger bedre end "pænt at have".'},
  {key:'local',    name:'Svær at få i Bilka i morgen',   why:'Kan den købes om hjørnet, taber du priskampen.'},
  {key:'audience', name:'Tydelig målgruppe',             why:'Du skal kunne sige hvem på én sætning.'},
  {key:'light',    name:'Let og lille',                  why:'Under 1 kg, ingen batterier, ingen væske = billig fragt.'},
  {key:'robust',   name:'Robust — få returer',           why:'Glas, tøj i størrelser og skrøbelig elektronik giver returer.'},
  {key:'upsell',   name:'Oplagt upsalg',                 why:'Tilbehør, 2-for-1 eller refill hæver ordren gratis.'},
  {key:'repeat',   name:'Sælger hele året',              why:'Slipper for at finde et nyt produkt hver måned.'}
];

function scoreOf(p){
  const sc = p.scores || {};
  const raw = CRITERIA.reduce((sum, c) => sum + clamp(num(sc[c.key]), 0, 5), 0);
  const quality = raw / (CRITERIA.length * 5) * 100;

  const e = economics(p);
  const mult   = clamp((e.multiple - 1.8) / (3.5 - 1.8), 0, 1) * 50;
  const profit = clamp(e.profitUp / 70, 0, 1) * 50;
  const money  = mult + profit;

  const total = Math.round(quality * 0.6 + money * 0.4);
  return { total, quality: Math.round(quality), money: Math.round(money) };
}

function verdictOf(total){
  if(total >= 70) return {cls:'go',    label:'Kør en test',              text:'Tallene og produktet hænger sammen. Sæt 300–500 kr. af til en test i 3–4 dage.'};
  if(total >= 50) return {cls:'maybe', label:'Kan testes — stram først', text:'Hæv prisen, find et upsalg eller en billigere leverandør, før du bruger annoncekroner.'};
  return            {cls:'no',    label:'Drop den',                 text:'Enten er marginen for tynd, eller produktet er for kedeligt til at stoppe en scroll. Find et nyt.'};
}

/* ---------------------------------------------------------------- link-parser */

const SOURCES = [
  {host:'aliexpress',      label:'AliExpress'},
  {host:'alibaba',         label:'Alibaba'},
  {host:'cjdropshipping',  label:'CJdropshipping'},
  {host:'temu',            label:'Temu'},
  {host:'amazon',          label:'Amazon'},
  {host:'etsy',            label:'Etsy'},
  {host:'banggood',        label:'Banggood'},
  {host:'dhgate',          label:'DHgate'},
  {host:'shein',           label:'Shein'},
  {host:'zendrop',         label:'Zendrop'},
  {host:'spocket',         label:'Spocket'},
  {host:'tiktok',          label:'TikTok Shop'}
];

function parseLink(text){
  const out = {url:'', source:'', name:'', cost:0, currency:'', note:[]};
  const m = String(text).match(/https?:\/\/[^\s"'<>)]+/);
  if(m){
    out.url = m[0];
    try{
      const u = new URL(out.url);
      const host = u.hostname.replace(/^www\./, '');
      out.source = (SOURCES.find(s => host.includes(s.host)) || {}).label || host;
      const slug = decodeURIComponent((u.pathname.split('/').filter(Boolean).pop() || ''))
        .replace(/\.(html?|php|aspx)$/i, '')
        .replace(/[-_+]+/g, ' ')
        .replace(/\b\d{5,}\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if(slug.length > 3 && /[a-zA-ZæøåÆØÅ]/.test(slug)){
        out.name = slug.charAt(0).toUpperCase() + slug.slice(1, 70);
      }
      out.note.push('Kilde: ' + out.source);
    }catch(e){ out.note.push('Linket kunne ikke læses — skriv navnet selv.'); }
  }
  if(!out.name){
    // Ingen brugbar tekst i selve linket — brug det, der står rundt om det
    const rest = String(text)
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/(?:US\s*\$|USD|DKK|kr\.?|\$)\s*[0-9]+(?:[.,][0-9]{1,2})?/ig, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if(rest.length > 2) out.name = rest.slice(0, 70);
  }

  const usd = String(text).match(/(?:US\s*\$|USD|\$)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  const dkk = String(text).match(/(?:DKK|kr\.?)\s*([0-9]+(?:[.,][0-9]{1,2})?)|([0-9]+(?:[.,][0-9]{2}))\s*(?:kr\.?|DKK)/i);
  if(dkk){
    out.cost = num(dkk[1] || dkk[2]); out.currency = 'DKK';
    out.note.push('Fandt varekost ' + kr(out.cost, 2) + ' i teksten.');
  }else if(usd){
    out.currency = 'USD';
    out.cost = num(usd[1]) * num(state.settings.usdRate);
    out.note.push('Fandt $' + usd[1] + ' → ' + kr(out.cost, 2) + ' med kurs ' + state.settings.usdRate + '.');
  }
  return out;
}

/* ---------------------------------------------------------------- produkttekst */

function copyFor(p){
  const s = state.settings;
  const e = economics(p);
  const name = p.name || 'Produktet';
  const aud  = p.audience || 'dig, der gerne vil have hverdagen til at glide lidt lettere';
  const ben  = p.benefit  || 'løser problemet på under et minut';
  const feats = String(p.features || '').split('\n').map(f => f.trim()).filter(Boolean);
  const bullets = feats.length ? feats : [
    'Klar til brug ud af kassen — ingen samling, ingen app',
    'Fylder mindre end en bog i skuffen',
    'Holder til daglig brug, ikke kun til billedet'
  ];
  const before = Math.round(num(p.price) * 1.45 / 10) * 10 - 1;

  const lines = [];
  lines.push('OVERSKRIFT');
  lines.push(`${name} — ${ben}`);
  lines.push('');
  lines.push('UNDEROVERSKRIFT');
  lines.push(`Lavet til ${aud}. Sendes med sporing, ${num(s.freeShipFrom) ? `fri fragt over ${fmt(num(s.freeShipFrom))} kr.` : 'fast lav fragt'} og 30 dages returret.`);
  lines.push('');
  lines.push('PUNKTER');
  bullets.slice(0, 5).forEach(b => lines.push('• ' + b));
  lines.push('');
  lines.push('BESKRIVELSE');
  lines.push(`Du kender følelsen: det tager for lang tid, og du gider det ikke i dag. ${name} er den lille genvej — den ${ben.toLowerCase()}, uden at du skal lægge om på noget.`);
  lines.push('');
  lines.push(`Den er tænkt til ${aud}. Du pakker den ud, bruger den, og så står den der næste gang du får brug for den. Ikke mere.`);
  lines.push('');
  lines.push('PRIS OG TILBUD');
  lines.push(`Normalpris ${fmt(before)} kr. — nu ${fmt(num(p.price))} kr.`);
  if(e.up.perOrder > 0 && p.upsell?.bundleQty > 1){
    lines.push(`Tag ${p.upsell.bundleQty} stk. og spar ${fmt(num(p.upsell.bundleDiscount))} % på nr. 2 og frem.`);
  }
  if(p.upsell?.addonName) lines.push(`Tilføj ${p.upsell.addonName} for ${fmt(num(p.upsell.addonPrice))} kr.`);
  lines.push('');
  lines.push('ANNONCEKROGE (3 stk. — test dem mod hinanden)');
  lines.push(`1. "Jeg troede det var en gimmick. Så prøvede jeg den i en uge."`);
  lines.push(`2. "Hvis du også ${ben.toLowerCase()} — så er det her til dig."`);
  lines.push(`3. "${fmt(num(p.price))} kr. for at slippe for det her hver eneste dag."`);
  lines.push('');
  lines.push('OFTE STILLEDE SPØRGSMÅL');
  lines.push('Hvor lang er leveringstiden? — Typisk 6–12 hverdage. Det står i ordrebekræftelsen.');
  lines.push('Kan jeg returnere? — Ja, 30 dage. Skriv til os, så sender vi en returlabel.');
  lines.push('Hvem står bag? — ' + (s.storeName || 'Butikken') + ', en lille dansk webshop.');
  lines.push('');
  lines.push('— Tjek selv, at løfterne om fragt og retur passer med det, du faktisk kan holde.');
  return lines.join('\n');
}

/* ---------------------------------------------------------------- opgavemotor */

function stats(){
  const ps = state.products;
  const ideas   = ps.filter(p => p.status === 'ide');
  const testing = ps.filter(p => p.status === 'test');
  const winners = ps.filter(p => p.status === 'vinder');
  const live    = [...testing, ...winners];

  const last30 = state.log.filter(l => (Date.now() - new Date(l.date + 'T00:00:00')) < 30 * 86400000);
  const sum = key => last30.reduce((a, l) => a + num(l[key]), 0);
  const rev = sum('rev'), ads = sum('ads'), goods = sum('cogs'), orders = sum('orders');
  const vat = num(state.settings.vat) / 100;
  const fees = orders * num(state.settings.feeFix) + rev * num(state.settings.feePct) / 100;
  const profit = rev / (1 + vat) - goods - ads - fees;

  const lastLog = state.log.length ? state.log.map(l => l.date).sort().at(-1) : null;
  const daysSinceLog = lastLog ? Math.floor((Date.now() - new Date(lastLog + 'T00:00:00')) / 86400000) : 999;

  return {
    ideas, testing, winners, live, rev, ads, goods, orders, profit, fees, daysSinceLog,
    roas: ads > 0 ? rev / ads : 0,
    aov: orders > 0 ? rev / orders : 0,
    perOrder: orders > 0 ? profit / orders : 0,
    goalPct: num(state.settings.goal) > 0 ? clamp(profit / num(state.settings.goal), 0, 1) : 0
  };
}

function tasks(){
  const st = stats();
  const list = [];
  const add = (id, title, why, min, view, prio) => list.push({id, title, why, min, view, prio});

  if(state.products.length === 0)
    add('first', 'Importér tre produktlinks', 'Du kan ikke vælge, før du har noget at vælge imellem. Find tre ting på AliExpress eller TikTok Shop og sæt linkene ind.', 10, 'hunt', 1);

  if(state.products.length > 0 && st.live.length === 0 && st.ideas.length > 0)
    add('pick', 'Vælg dagens favorit og sæt den i test', `Du har ${st.ideas.length} idé${st.ideas.length === 1 ? '' : 'er'} liggende. Den med højest score skal videre — resten kan vente.`, 5, 'catalog', 1);

  const bleeding = st.live.filter(p => economics(p).profitUp < 0);
  if(bleeding.length)
    add('bleed', `Ret prisen på ${bleeding[0].name}`, 'Du taber penge på hver ordre som tallene står nu. Hæv prisen, skær annoncebudgettet eller find varen billigere.', 5, 'catalog', 0);

  const noCopy = st.live.find(p => !p.benefit || !p.features);
  if(noCopy)
    add('copy', `Skriv produkttekst til ${noCopy.name}`, 'Udfyld målgruppe og tre fordele — så skriver generatoren resten, og du kan kopiere den direkte ind i din shop.', 6, 'catalog', 2);

  const noUpsell = st.live.find(p => upsell(p).perOrder <= 0);
  if(noUpsell)
    add('upsell', `Byg et upsalg på ${noUpsell.name}`, 'Et 2-for-1 eller et tilbehør hæver ordren uden at koste en eneste annoncekrone ekstra.', 8, 'catalog', 2);

  const noImage = st.live.find(p => !p.image);
  if(noImage)
    add('image', `Lav produktbilleder til ${noImage.name}`, 'Leverandørens billeder ligner leverandørens billeder. Beskær, læg ren baggrund på og skriv prisen — ti minutter under Billeder.', 10, 'images', 2);

  if(st.live.length && !state.settings.checkoutUrl && !state.settings.contactEmail)
    add('pay', 'Gør butikken klar til at tage imod ordrer', 'Uden betalingslink eller e-mail kan kunden ikke bestille. Sæt et Stripe- eller MobilePay-link ind under Opsætning.', 6, 'shop', 0);

  const launchDone = Object.values(state.flow.launch || {}).filter(Boolean).length;
  if(st.live.length && launchDone < LAUNCH_LENGTH)
    add('launch', `Lanceringsplanen — ${launchDone}/14 klaret`, 'Én ting om dagen i to uger. Det er hele forskellen mellem en butik, der fik en chance, og en der ikke gjorde.', 15, 'flow', 1);

  if(st.daysSinceLog > 6 && state.products.length > 0)
    add('log', 'Log ugens tal', 'Ordrer, omsætning og annonceforbrug. Ét minut — og så ved du, om der er forretning i det.', 2, 'numbers', 1);

  if(st.winners.length && st.perOrder > 0)
    add('scale', `Hæv budgettet 20 % på ${st.winners[0].name}`, `Du tjener ${kr(st.perOrder)} pr. ordre. Skru langsomt op — 20 % ad gangen — og se om tallet holder.`, 4, 'numbers', 2);

  if(st.winners.length && st.ideas.length < 3)
    add('next', 'Find produkt nummer to i samme niche', 'Samme kunde, samme annoncer, ny ordre. Det er den billigste vækst du kan få.', 10, 'hunt', 3);

  add('scan', 'Ti minutters produktjagt', 'Scroll TikTok, Reels eller AliExpress bestsellers. Sæt link ind på alt, der får dig til at stoppe.', 10, 'hunt', 4);

  return list.sort((a, b) => a.prio - b.prio).slice(0, 3);
}

// Dage i træk med mindst én afkrydset opgave. I dag tæller kun med, hvis den er krydset af.
function streak(){
  const d = new Date();
  if(!(state.done[today()] || []).length) d.setDate(d.getDate() - 1);
  let n = 0;
  for(let i = 0; i < 400; i++){
    const key = d.toISOString().slice(0, 10);
    if(!(state.done[key] || []).length) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ---------------------------------------------------------------- render: I dag */

function renderToday(){
  const st = stats();
  const s = state.settings;

  $('#heroCard').innerHTML = `
    <span class="eyebrow">${new Date().toLocaleDateString('da-DK', {weekday:'long', day:'numeric', month:'long'})}</span>
    <h1>${esc(s.storeName || 'Min butik')}</h1>
    <p>${st.live.length ? `${st.live.length} produkt${st.live.length === 1 ? '' : 'er'} i luften. ` : 'Ingen produkter i luften endnu. '}
       Målet er ${kr(num(s.goal))} i overskud om måneden — du er ${Math.round(st.goalPct * 100)} % af vejen de sidste 30 dage.</p>
    <div class="bar"><i style="width:${Math.round(st.goalPct * 100)}%"></i></div>
    <div class="hero-row">
      <div><b>${kr(st.profit)}</b>overskud 30 dage</div>
      <div><b>${fmt(st.orders)}</b>ordrer</div>
      <div><b>${st.roas ? fmt(st.roas, 2) + '×' : '—'}</b>ROAS</div>
      <div><b>${fmt(num(s.minutesPerWeek))} min</b>din uge</div>
    </div>`;

  const kpis = [
    {label:'Overskud 30 dage', value: kr(st.profit), sub: st.orders ? kr(st.perOrder) + ' pr. ordre' : 'ingen ordrer endnu', tone: st.profit >= 0 ? 'pos' : 'neg'},
    {label:'Omsætning 30 dage', value: kr(st.rev), sub: st.aov ? 'snit ' + kr(st.aov) + ' pr. ordre' : 'log dine tal under Tal'},
    {label:'Annoncer 30 dage', value: kr(st.ads), sub: st.roas ? 'ROAS ' + fmt(st.roas, 2) + '×' : 'ingen annoncer logget'},
    {label:'Produkter i test', value: fmt(st.testing.length), sub: `${st.winners.length} vinder${st.winners.length === 1 ? '' : 'e'}, ${st.ideas.length} idé${st.ideas.length === 1 ? '' : 'er'}`}
  ];
  $('#todayKpis').innerHTML = kpis.map(k => `
    <div class="kpi ${k.tone || ''}">
      <div class="label">${k.label}</div>
      <div class="value num">${k.value}</div>
      <div class="sub">${k.sub}</div>
    </div>`).join('');

  const done = state.done[today()] || [];
  $('#taskList').innerHTML = tasks().map(t => `
    <label class="task ${done.includes(t.id) ? 'done' : ''}">
      <input type="checkbox" data-task="${t.id}" ${done.includes(t.id) ? 'checked' : ''}>
      <div>
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-why">${esc(t.why)}</div>
        <div class="t-meta">
          <span class="t-min">${t.min} min</span>
          <button class="btn sm ghost" data-goto="${t.view}">Gå til →</button>
        </div>
      </div>
    </label>`).join('');

  const n = streak();
  $('#streakBadge').textContent = n === 0 ? 'Ny dag' : `${n} dag${n === 1 ? '' : 'e'} i streg`;

  const focus = st.live.map(p => ({p, e: economics(p)})).sort((a, b) => b.e.profitUp - a.e.profitUp)[0];
  $('#focusCard').innerHTML = focus ? `
    <span class="eyebrow">Din bedste hest lige nu</span>
    <h3 style="margin:5px 0 10px">${esc(focus.p.name)}</h3>
    <div class="stat-line"><span>Pris</span><b>${kr(focus.e.price)}</b></div>
    <div class="stat-line"><span>Tjent pr. ordre</span><b class="${focus.e.profitUp >= 0 ? 'pos' : 'neg'}">${kr(focus.e.profitUp)}</b></div>
    <div class="stat-line"><span>Break-even ROAS</span><b>${isFinite(focus.e.beRoas) ? fmt(focus.e.beRoas, 2) + '×' : '—'}</b></div>
    <div class="stat-line"><span>Maks. annonce pr. salg</span><b>${kr(focus.e.maxCpa)}</b></div>
    <button class="btn sm" style="margin-top:12px" data-open="${focus.p.id}">Åbn produktet</button>`
  : `<span class="eyebrow">Kom i gang</span>
     <h3 style="margin:5px 0 8px">Tre skridt, og du er i gang</h3>
     <div class="stat-line"><span>1. Sæt et produktlink ind</span><b>10 min</b></div>
     <div class="stat-line"><span>2. Tjek score og margin</span><b>3 min</b></div>
     <div class="stat-line"><span>3. Byg upsalg og tekst</span><b>8 min</b></div>
     <button class="btn sm primary" style="margin-top:12px" data-goto="hunt">Start med et link</button>`;
}

/* ---------------------------------------------------------------- render: Find produkt */

let draft = null;

function blankDraft(){
  return {
    id:null, name:'', url:'', source:'', cost:45, ship:15, price:249, cpa:'',
    status:'ide', scores:{}, audience:'', benefit:'', features:'', notes:'',
    upsell:{bundleQty:2, bundleDiscount:15, bundleRate:0, addonName:'', addonPrice:0, addonCost:0, addonRate:0, postName:'', postPrice:0, postCost:0, postRate:0},
    created: today()
  };
}

function draftFromForm(){
  draft.name   = $('#f_name').value.trim();
  draft.source = $('#f_source').value.trim();
  draft.cost   = num($('#f_cost').value);
  draft.ship   = num($('#f_ship').value);
  draft.price  = num($('#f_price').value);
  draft.cpa    = $('#f_cpa').value === '' ? '' : num($('#f_cpa').value);
  CRITERIA.forEach(c => {
    const el = $(`#crit_${c.key}`);
    if(el) draft.scores[c.key] = num(el.value);
  });
}

function formFromDraft(){
  $('#f_name').value   = draft.name;
  $('#f_source').value = draft.source;
  $('#f_cost').value   = draft.cost;
  $('#f_ship').value   = draft.ship;
  $('#f_price').value  = draft.price;
  $('#f_cpa').value    = draft.cpa === '' ? '' : draft.cpa;
  $('#multLabel').textContent = `Foreslå pris (×${state.settings.targetMultiple})`;
  renderCriteria();
  renderHuntResult();
}

function renderCriteria(){
  $('#criteria').innerHTML = CRITERIA.map(c => {
    const v = clamp(num(draft.scores[c.key]), 0, 5);
    return `<div class="criterion">
      <div class="name">${c.name}</div>
      <div class="val num" id="val_${c.key}">${v}/5</div>
      <div class="why">${c.why}</div>
      <input type="range" min="0" max="5" step="1" value="${v}" id="crit_${c.key}" data-crit="${c.key}">
    </div>`;
  }).join('');
}

function renderHuntResult(){
  const sc = scoreOf(draft);
  const v = verdictOf(sc.total);
  const e = economics(draft);
  const circ = 2 * Math.PI * 44;

  $('#verdictCard').innerHTML = `
    <span class="eyebrow">Dommen</span>
    <div class="gauge" style="margin-top:10px">
      <div class="ring">
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle cx="52" cy="52" r="44" fill="none" stroke="var(--surface-3)" stroke-width="9"/>
          <circle cx="52" cy="52" r="44" fill="none" stroke="var(--${v.cls === 'go' ? 'good' : v.cls === 'maybe' ? 'warn' : 'bad'})"
                  stroke-width="9" stroke-linecap="round"
                  stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - sc.total / 100)}"/>
        </svg>
        <b>${sc.total}</b>
      </div>
      <div>
        <div class="verdict ${v.cls}">${v.label}</div>
        <p class="hint" style="margin-top:5px">${v.text}</p>
      </div>
    </div>
    <div class="divider"></div>
    <div class="stat-line"><span>Produktkvalitet (scorekort)</span><b>${sc.quality}/100</b></div>
    <div class="stat-line"><span>Penge i det (margin + avance)</span><b>${sc.money}/100</b></div>`;

  const warn = [];
  if(e.multiple < 2.5) warn.push('Avancen er under 2,5× varekost — der er sjældent plads til annoncer.');
  if(e.profitUp < 0)   warn.push('Du taber penge på hver ordre med de tal her.');
  if(e.beRoas > 3)     warn.push('Break-even ROAS over 3× er hårdt arbejde på kolde annoncer.');

  $('#economyCard').innerHTML = `
    <span class="eyebrow">Regnestykket pr. ordre</span>
    <h3 style="margin:5px 0 10px">${esc(draft.name || 'Uden navn')}</h3>
    <div class="stat-line"><span>Salgspris (inkl. moms)</span><b>${kr(e.price)}</b></div>
    <div class="stat-line"><span>− Moms</span><b>−${kr(e.price - e.net)}</b></div>
    <div class="stat-line"><span>− Vare + fragt ind</span><b>−${kr(e.cogs)}</b></div>
    <div class="stat-line"><span>− Betalingsgebyr</span><b>−${kr(e.fee)}</b></div>
    <div class="stat-line"><span>− Returer (${fmt(num(state.settings.returnRate))} %)</span><b>−${kr(e.dbOrder - e.dbReturns)}</b></div>
    <div class="stat-line"><span>− Annonce pr. salg</span><b>−${kr(e.cpa)}</b></div>
    ${e.up.perOrder > 0 ? `<div class="stat-line"><span>+ Upsalg</span><b class="pos">+${kr(e.up.perOrder)}</b></div>` : ''}
    <div class="stat-line big"><span>Du har tilbage</span><b class="${e.profitUp >= 0 ? 'pos' : 'neg'}">${kr(e.profitUp)}</b></div>
    <div class="divider"></div>
    <div class="stat-line"><span>Avance</span><b>${fmt(e.multiple, 2)}×</b></div>
    <div class="stat-line"><span>Break-even ROAS</span><b>${isFinite(e.beRoas) ? fmt(e.beRoas, 2) + '×' : '—'}</b></div>
    <div class="stat-line"><span>Maks. annonce pr. salg</span><b>${kr(e.maxCpa)}</b></div>
    <div class="stat-line"><span>Ordrer til ${kr(num(state.settings.goal))}/md</span><b>${e.profitUp > 0 ? fmt(Math.ceil(num(state.settings.goal) / e.profitUp)) : '—'}</b></div>
    ${warn.length ? `<div class="note" style="margin-top:12px">${warn.map(w => '• ' + w).join('<br>')}</div>` : ''}`;
}

/* ---------------------------------------------------------------- render: katalog */

let catalogFilter = 'alle';

function renderCatalog(){
  const st = stats();
  const kpis = [
    {label:'Produkter', value: fmt(state.products.length), sub:`${st.ideas.length} idé${st.ideas.length === 1 ? '' : 'er'}`},
    {label:'I test', value: fmt(st.testing.length), sub:'kører annoncer'},
    {label:'Vindere', value: fmt(st.winners.length), sub:'skal skaleres'},
    {label:'Bedste margin', value: st.live.length ? kr(Math.max(...st.live.map(p => economics(p).profitUp))) : '—', sub:'pr. ordre'}
  ];
  $('#catalogKpis').innerHTML = kpis.map(k => `
    <div class="kpi"><div class="label">${k.label}</div><div class="value num">${k.value}</div><div class="sub">${k.sub}</div></div>`).join('');

  const list = state.products.filter(p => catalogFilter === 'alle' || p.status === catalogFilter);
  $('#catalogList').innerHTML = list.length ? list.map(p => {
    const e = economics(p), sc = scoreOf(p);
    return `<button class="row" data-open="${p.id}">
      <span class="thumb">${p.image ? `<img src="${p.image}" alt="">` : emojiFor(p.name)}</span>
      <span class="main">
        <b>${esc(p.name || 'Uden navn')}</b>
        <span>${esc(p.source || 'egen kilde')} · ${kr(e.price)} · score ${sc.total}</span>
      </span>
      <span class="metric ${e.profitUp >= 0 ? 'pos' : 'neg'}">${kr(e.profitUp)}<small>pr. ordre</small></span>
      <span class="badge ${p.status}">${statusLabel(p.status)}</span>
    </button>`;
  }).join('') : `<div class="empty">Ingen produkter her endnu. Sæt et link ind under <b>Find produkt</b> — det tager 30 sekunder.</div>`;
}

const statusLabel = s => ({ide:'Idé', test:'I test', vinder:'Vinder', drop:'Droppet'}[s] || s);

/* ---------------------------------------------------------------- drawer */

let openId = null, drawerTab = 'okonomi';

function openProduct(id){
  openId = id;
  drawerTab = 'okonomi';
  $('#drawer').classList.add('open');
  renderDrawer();
}
function closeDrawer(){
  $('#drawer').classList.remove('open');
  openId = null;
  render();
}

function renderDrawer(){
  const p = state.products.find(x => x.id === openId);
  if(!p) return closeDrawer();
  const e = economics(p), sc = scoreOf(p);

  $('#drawerPanel').innerHTML = `
    <div class="drawer-head">
      <div>
        <span class="eyebrow">${esc(p.source || 'produkt')} · score ${sc.total}</span>
        <h2 style="margin-top:5px">${esc(p.name || 'Uden navn')}</h2>
        ${p.url ? `<a class="hint" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Åbn hos leverandøren ↗</a>` : ''}
      </div>
      <button class="btn sm ghost" data-close>✕</button>
    </div>

    <div class="chips" style="margin-bottom:14px">
      ${['ide','test','vinder','drop'].map(s => `<button class="chip" data-status-set="${s}" aria-pressed="${p.status === s}">${statusLabel(s)}</button>`).join('')}
    </div>

    <div class="seg">
      ${[['okonomi','Økonomi'],['upsalg','Upsalg'],['tekst','Tekst'],['score','Score']].map(([k, l]) =>
        `<button data-tab="${k}" aria-selected="${drawerTab === k}">${l}</button>`).join('')}
    </div>

    <div id="drawerBody">${drawerBody(p, e)}</div>

    <div class="btn-row" style="margin-top:18px">
      <button class="btn primary" data-close>Luk</button>
      <button class="btn danger" data-delete="${p.id}" style="margin-left:auto">Slet produkt</button>
    </div>`;
}

function drawerBody(p, e){
  if(drawerTab === 'okonomi') return `
    <div class="card tight" style="margin-bottom:12px">
      <div class="inline-fields">
        <label class="field"><span>Navn</span><input type="text" data-p="name" value="${esc(p.name)}"></label>
        <label class="field"><span>Kilde</span><input type="text" data-p="source" value="${esc(p.source)}"></label>
      </div>
      <div class="inline-fields">
        <label class="field suffix"><span>Varekost</span><input type="number" step="0.01" data-p="cost" value="${num(p.cost)}"><em>kr.</em></label>
        <label class="field suffix"><span>Fragt ind</span><input type="number" step="0.01" data-p="ship" value="${num(p.ship)}"><em>kr.</em></label>
        <label class="field suffix"><span>Salgspris</span><input type="number" step="1" data-p="price" value="${num(p.price)}"><em>kr.</em></label>
        <label class="field suffix"><span>Annonce pr. salg</span><input type="number" step="1" data-p="cpa" value="${p.cpa === '' ? '' : num(p.cpa)}" placeholder="${num(state.settings.cpa)}"><em>kr.</em></label>
      </div>
      <button class="btn sm" data-suggest>Foreslå pris (×${state.settings.targetMultiple})</button>
      <label class="field" style="margin-top:12px"><span>Betalingslink til netop dette produkt (valgfrit)</span>
        <input type="text" data-p="payLink" value="${esc(p.payLink || '')}" placeholder="https://buy.stripe.com/... — bruges i den eksporterede butik"></label>
    </div>
    <div class="card tight" id="drawerEco">${ecoBlock(e)}</div>`;

  if(drawerTab === 'upsalg'){
    const u = p.upsell || {};
    return `
    <p class="hint" style="margin-bottom:12px">Upsalg er de billigste penge i hele butikken: kunden er allerede købt og betalt. Sæt ét op pr. produkt — det tager fem minutter og virker hver eneste ordre.</p>
    <div class="btn-row" style="margin-bottom:12px"><button class="btn sm" data-upsell-preset>Sæt et standard-upsalg op</button></div>
    <div class="card tight" style="margin-bottom:12px">
      <h3 style="margin-bottom:8px">1 · Mængderabat</h3>
      <div class="inline-fields">
        <label class="field suffix"><span>Køb antal</span><input type="number" min="1" step="1" data-p="upsell.bundleQty" value="${num(u.bundleQty)}"><em>stk.</em></label>
        <label class="field suffix"><span>Rabat på ekstra</span><input type="number" min="0" step="1" data-p="upsell.bundleDiscount" value="${num(u.bundleDiscount)}"><em>%</em></label>
        <label class="field suffix"><span>Hvor mange tager den</span><input type="number" min="0" max="100" step="1" data-p="upsell.bundleRate" value="${num(u.bundleRate)}"><em>%</em></label>
      </div>
    </div>
    <div class="card tight" style="margin-bottom:12px">
      <h3 style="margin-bottom:8px">2 · Tilbehør i kurven</h3>
      <div class="inline-fields">
        <label class="field"><span>Navn</span><input type="text" data-p="upsell.addonName" value="${esc(u.addonName)}" placeholder="Fx ekstra filter"></label>
        <label class="field suffix"><span>Pris</span><input type="number" step="1" data-p="upsell.addonPrice" value="${num(u.addonPrice)}"><em>kr.</em></label>
        <label class="field suffix"><span>Din kost</span><input type="number" step="1" data-p="upsell.addonCost" value="${num(u.addonCost)}"><em>kr.</em></label>
        <label class="field suffix"><span>Tager den</span><input type="number" min="0" max="100" step="1" data-p="upsell.addonRate" value="${num(u.addonRate)}"><em>%</em></label>
      </div>
    </div>
    <div class="card tight" style="margin-bottom:12px">
      <h3 style="margin-bottom:8px">3 · Tilbud efter køb</h3>
      <p class="hint" style="margin-bottom:8px">Vises på kvitteringssiden. Ingen ekstra fragt for kunden, ingen ekstra annoncekroner for dig.</p>
      <div class="inline-fields">
        <label class="field"><span>Navn</span><input type="text" data-p="upsell.postName" value="${esc(u.postName)}" placeholder="Fx 3-pak til halv pris"></label>
        <label class="field suffix"><span>Pris</span><input type="number" step="1" data-p="upsell.postPrice" value="${num(u.postPrice)}"><em>kr.</em></label>
        <label class="field suffix"><span>Din kost</span><input type="number" step="1" data-p="upsell.postCost" value="${num(u.postCost)}"><em>kr.</em></label>
        <label class="field suffix"><span>Tager den</span><input type="number" min="0" max="100" step="1" data-p="upsell.postRate" value="${num(u.postRate)}"><em>%</em></label>
      </div>
    </div>
    <div class="card tight" id="drawerEco">${upsellBlock(p, e)}</div>`;
  }

  if(drawerTab === 'tekst') return `
    <p class="hint" style="margin-bottom:12px">Udfyld de tre felter. Så får du overskrift, punkter, beskrivelse, tilbudslinje, tre annoncekroge og FAQ — klar til at kopiere ind i Shopify.</p>
    <label class="field"><span>Hvem er kunden?</span><input type="text" data-p="audience" value="${esc(p.audience)}" placeholder="Fx småbørnsforældre, der ikke har tid om morgenen"></label>
    <label class="field"><span>Hvad gør produktet for dem? (én sætning)</span><input type="text" data-p="benefit" value="${esc(p.benefit)}" placeholder="Fx gør morgenmaden klar, mens du klæder børnene på"></label>
    <label class="field"><span>Tre fordele — én pr. linje</span><textarea data-p="features" placeholder="Klar på 30 sekunder&#10;Kan gå i opvaskemaskinen&#10;Fylder ikke på køkkenbordet">${esc(p.features)}</textarea></label>
    <div class="btn-row" style="margin:6px 0 12px">
      <button class="btn primary" data-copytext>Kopiér teksten</button>
      <button class="btn ghost" data-refreshtext>Opdatér</button>
    </div>
    <div class="out" id="copyOut">${esc(copyFor(p))}</div>`;

  const sc = scoreOf(p);
  return `
    <p class="hint" style="margin-bottom:12px">Scoren er 60 % produkt og 40 % penge. Under 50: lad være. Over 70: test den.</p>
    ${CRITERIA.map(c => {
      const v = clamp(num((p.scores || {})[c.key]), 0, 5);
      return `<div class="criterion">
        <div class="name">${c.name}</div><div class="val num">${v}/5</div>
        <div class="why">${c.why}</div>
        <input type="range" min="0" max="5" step="1" value="${v}" data-p="scores.${c.key}">
      </div>`;
    }).join('')}
    <div class="card tight" style="margin-top:12px">
      <div class="stat-line"><span>Produktkvalitet</span><b>${sc.quality}/100</b></div>
      <div class="stat-line"><span>Penge i det</span><b>${sc.money}/100</b></div>
      <div class="stat-line big"><span>Samlet</span><b>${sc.total}/100 — ${verdictOf(sc.total).label}</b></div>
    </div>
    <label class="field" style="margin-top:12px"><span>Noter</span><textarea data-p="notes" placeholder="Leverandør svarer hurtigt. Fragt 9 dage til DK.">${esc(p.notes)}</textarea></label>`;
}

function ecoBlock(e){
  return `
    <div class="stat-line"><span>Salgspris</span><b>${kr(e.price)}</b></div>
    <div class="stat-line"><span>− Moms</span><b>−${kr(e.price - e.net)}</b></div>
    <div class="stat-line"><span>− Vare + fragt</span><b>−${kr(e.cogs)}</b></div>
    <div class="stat-line"><span>− Gebyr</span><b>−${kr(e.fee)}</b></div>
    <div class="stat-line"><span>− Returer</span><b>−${kr(e.dbOrder - e.dbReturns)}</b></div>
    <div class="stat-line"><span>− Annonce pr. salg</span><b>−${kr(e.cpa)}</b></div>
    ${e.up.perOrder > 0 ? `<div class="stat-line"><span>+ Upsalg</span><b class="pos">+${kr(e.up.perOrder)}</b></div>` : ''}
    <div class="stat-line big"><span>Tilbage pr. ordre</span><b class="${e.profitUp >= 0 ? 'pos' : 'neg'}">${kr(e.profitUp)}</b></div>
    <div class="divider"></div>
    <div class="stat-line"><span>Avance</span><b>${fmt(e.multiple, 2)}×</b></div>
    <div class="stat-line"><span>Break-even ROAS</span><b>${isFinite(e.beRoas) ? fmt(e.beRoas, 2) + '×' : '—'}</b></div>
    <div class="stat-line"><span>Maks. annonce pr. salg</span><b>${kr(e.maxCpa)}</b></div>`;
}

function upsellBlock(p, e){
  const u = e.up;
  return `
    <div class="stat-line"><span>Mængderabat</span><b class="${u.bundle >= 0 ? 'pos' : 'neg'}">+${kr(u.bundle)}</b></div>
    <div class="stat-line"><span>Tilbehør</span><b class="pos">+${kr(u.addon)}</b></div>
    <div class="stat-line"><span>Efter køb</span><b class="pos">+${kr(u.post)}</b></div>
    <div class="stat-line big"><span>Ekstra pr. ordre</span><b class="pos">+${kr(u.perOrder)}</b></div>
    <div class="divider"></div>
    <div class="stat-line"><span>Gennemsnitlig ordre</span><b>${kr(e.aov)}</b></div>
    <div class="stat-line"><span>Løft af ordrestørrelsen</span><b>${pct(u.lift, 0)}</b></div>
    <div class="stat-line"><span>Ny maks. annonce pr. salg</span><b>${kr(e.maxCpa + u.perOrder)}</b></div>
    <div class="note" style="margin-top:12px">Upsalget hæver loftet for, hvad du må betale for et salg. Det er typisk her forskellen ligger mellem en butik, der løber rundt, og en der ikke gør.</div>`;
}

/* ---------------------------------------------------------------- render: butik */

function renderShop(){
  const s = state.settings;
  const f = s.shopFilter || 'live';
  const list = state.products.filter(p =>
    f === 'alle' ? true : f === 'vinder' ? p.status === 'vinder' : (p.status === 'test' || p.status === 'vinder'));

  $('#shopPreview').innerHTML = `
    <div class="shop-bar"><i></i><i></i><i></i><span>${esc(s.storeDomain || 'minbutik.dk')}</span></div>
    <div class="shop-hero">
      <h3>${esc(s.storeName || 'Min butik')}</h3>
      <p>${esc(s.storeTagline || '')}</p>
    </div>
    ${list.length ? `<div class="shop-grid">${list.map(p => {
      const e = economics(p);
      const before = Math.round(e.price * 1.45 / 10) * 10 - 1;
      const bullets = String(p.features || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3);
      const u = p.upsell || {};
      return `<article class="p-card">
        <div class="img">${p.image ? `<img src="${p.image}" alt="${esc(p.name)}">` : emojiFor(p.name)}${p.status === 'vinder' ? '<span class="tag">Bestseller</span>' : ''}</div>
        <div class="body">
          <h4>${esc(p.name || 'Produkt')}</h4>
          ${p.benefit ? `<p class="hint" style="font-size:.78rem">${esc(p.benefit)}</p>` : ''}
          ${bullets.length ? `<ul class="bul">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
          <div class="price"><b>${fmt(e.price)} kr.</b><s>${fmt(before)} kr.</s></div>
          ${num(u.bundleQty) > 1 ? `<div class="up">Tag ${num(u.bundleQty)} stk. — spar ${fmt(num(u.bundleDiscount))} % på nr. 2</div>` : ''}
          ${u.addonName ? `<div class="up">+ ${esc(u.addonName)} for ${fmt(num(u.addonPrice))} kr.</div>` : ''}
          <button class="btn sm primary" data-open="${p.id}" style="justify-content:center">Læg i kurv</button>
        </div>
      </article>`;
    }).join('')}</div>` : `<div class="empty" style="margin:18px; border:0">Ingen produkter at vise endnu. Sæt et produkt i test, så dukker det op her.</div>`}`;

  const live = list.map(p => ({p, e: economics(p)}));
  const avgAov = live.length ? live.reduce((a, x) => a + x.e.aov, 0) / live.length : 0;
  const withUpsell = live.filter(x => x.e.up.perOrder > 0).length;

  $('#shopTips').innerHTML = `
    <span class="eyebrow">Sådan flytter du tallet</span>
    <h3 style="margin:5px 0 10px">Butikkens tre knapper</h3>
    <div class="stat-line"><span>Snit pr. ordre lige nu</span><b>${kr(avgAov)}</b></div>
    <div class="stat-line"><span>Produkter med upsalg</span><b>${withUpsell}/${live.length || 0}</b></div>
    <div class="divider"></div>
    <div class="stat-line"><span>1. Hæv prisen 10 %</span><b>+${kr(avgAov * 0.10)}</b></div>
    <div class="stat-line"><span>2. Upsalg på alt</span><b>+${kr(avgAov * 0.18)}</b></div>
    <div class="stat-line"><span>3. Fri fragt over ${fmt(num(state.settings.freeShipFrom))} kr.</span><b>+${kr(avgAov * 0.07)}</b></div>
    <p class="hint" style="margin-top:10px">Tallene er erfaringstal, ikke løfter. Prøv én ting ad gangen i en uge, og se hvad dine egne tal siger.</p>`;
}

/* ---------------------------------------------------------------- render: tal + graf */

function weeklySeries(){
  const map = new Map();
  state.log.forEach(l => {
    const w = isoWeek(l.date);
    const cur = map.get(w) || {week:w, rev:0, ads:0, cogs:0, orders:0};
    cur.rev += num(l.rev); cur.ads += num(l.ads); cur.cogs += num(l.cogs); cur.orders += num(l.orders);
    map.set(w, cur);
  });
  const vat = num(state.settings.vat) / 100;
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-8).map(w => {
    const fees = w.orders * num(state.settings.feeFix) + w.rev * num(state.settings.feePct) / 100;
    return {...w, profit: w.rev / (1 + vat) - w.cogs - w.ads - fees};
  });
}

function renderNumbers(){
  const st = stats();
  const kpis = [
    {label:'Overskud 30 dage', value: kr(st.profit), sub: st.orders ? kr(st.perOrder) + ' pr. ordre' : '—', tone: st.profit >= 0 ? 'pos' : 'neg'},
    {label:'ROAS', value: st.roas ? fmt(st.roas, 2) + '×' : '—', sub:'omsætning pr. annoncekrone'},
    {label:'Ordrer', value: fmt(st.orders), sub: st.aov ? 'snit ' + kr(st.aov) : 'sidste 30 dage'},
    {label:'Mål', value: Math.round(st.goalPct * 100) + ' %', sub:'af ' + kr(num(state.settings.goal)) + ' pr. md.'}
  ];
  $('#numbersKpis').innerHTML = kpis.map(k =>
    `<div class="kpi ${k.tone || ''}"><div class="label">${k.label}</div><div class="value num">${k.value}</div><div class="sub">${k.sub}</div></div>`).join('');

  drawChart(weeklySeries());

  const rows = weeklySeries();
  $('#chartTable').innerHTML = rows.length ? `
    <table>
      <thead><tr><th>Uge</th><th class="r">Ordrer</th><th class="r">Omsætning</th><th class="r">Annoncer</th><th class="r">Overskud</th></tr></thead>
      <tbody>${rows.slice().reverse().map(r => `<tr>
        <td>${weekLabel(r.week)}</td><td class="r">${fmt(r.orders)}</td><td class="r">${fmt(r.rev)}</td>
        <td class="r">${fmt(r.ads)}</td><td class="r ${r.profit >= 0 ? 'pos' : 'neg'}">${fmt(r.profit)}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<p class="hint">Ingen tal endnu — log din første uge til højre.</p>';

  const best = st.live.map(p => economics(p).profitUp).sort((a, b) => b - a)[0] || 0;
  const perOrder = st.perOrder > 0 ? st.perOrder : best;
  const goal = num(state.settings.goal);
  const needed = perOrder > 0 ? Math.ceil(goal / perOrder) : 0;

  $('#goalCard').innerHTML = `
    <span class="eyebrow">Vejen til målet</span>
    <h3 style="margin:5px 0 10px">${kr(goal)} i overskud pr. måned</h3>
    ${perOrder > 0 ? `
      <div class="stat-line"><span>Du tjener pr. ordre</span><b>${kr(perOrder)}</b></div>
      <div class="stat-line"><span>Ordrer pr. måned</span><b>${fmt(needed)}</b></div>
      <div class="stat-line"><span>Ordrer pr. dag</span><b>${fmt(needed / 30, 1)}</b></div>
      <div class="stat-line big"><span>Annoncebudget pr. måned</span><b>${kr(needed * num(state.settings.cpa))}</b></div>
      <p class="hint" style="margin-top:10px">${needed <= 30
        ? 'Det er én ordre om dagen. Det er inden for rækkevidde ved siden af et fuldtidsjob.'
        : needed <= 150
          ? 'Det kræver et produkt, der virker, og et annoncebudget der får lov at køre. Realistisk på 2–4 måneder.'
          : 'Det er mange ordrer. Hæv prisen eller byg et upsalg, så du tjener mere pr. ordre — det er lettere end at firedoble trafikken.'}</p>`
    : `<p class="hint">Sæt et produkt i test, så regner jeg ud, hvor mange ordrer der skal til.</p>`}`;
}

function drawChart(rows){
  const wrap = $('#chart');
  if(!rows.length){
    wrap.innerHTML = '<div class="empty" style="border:0">Ingen uger logget endnu.</div>';
    return;
  }
  const W = 640, H = 230, padL = 52, padR = 16, padT = 16, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals = rows.map(r => r.profit);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const span = (max - min) || 1;
  const y = v => padT + (max - v) / span * ih;
  const bw = Math.min(46, iw / rows.length * 0.62);
  const step = iw / rows.length;
  const y0 = y(0);

  const ticks = [max, (max + min) / 2, min].filter((v, i, a) => a.indexOf(v) === i);
  const bars = rows.map((r, i) => {
    const cx = padL + step * i + step / 2;
    const yv = y(r.profit);
    const h = Math.max(2, Math.abs(yv - y0));
    const top = r.profit >= 0 ? yv : y0;
    const rad = Math.min(4, h);
    const path = r.profit >= 0
      ? `M${cx - bw / 2} ${top + h} L${cx - bw / 2} ${top + rad} Q${cx - bw / 2} ${top} ${cx - bw / 2 + rad} ${top} L${cx + bw / 2 - rad} ${top} Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + rad} L${cx + bw / 2} ${top + h} Z`
      : `M${cx - bw / 2} ${top} L${cx + bw / 2} ${top} L${cx + bw / 2} ${top + h - rad} Q${cx + bw / 2} ${top + h} ${cx + bw / 2 - rad} ${top + h} L${cx - bw / 2 + rad} ${top + h} Q${cx - bw / 2} ${top + h} ${cx - bw / 2} ${top + h - rad} Z`;
    const last = i === rows.length - 1;
    return `
      <path class="bar ${last ? 'on' : ''}" data-i="${i}" d="${path}" fill="var(--${r.profit >= 0 ? 'chart' : 'chart-neg'})"/>
      ${last ? `<text class="axis" x="${cx}" y="${(r.profit >= 0 ? top - 7 : top + h + 14)}" text-anchor="middle" fill="var(--ink)" style="font-weight:600">${fmt(r.profit)}</text>` : ''}
      <text class="axis" x="${cx}" y="${H - 12}" text-anchor="middle">${weekLabel(r.week).replace('Uge ', 'u')}</text>
      <rect class="bar-hit" data-i="${i}" x="${padL + step * i}" y="${padT}" width="${step}" height="${ih}"/>`;
  }).join('');

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ugentligt overskud efter annoncer">
      ${ticks.map(t => `<line class="gridline" x1="${padL}" y1="${y(t)}" x2="${W - padR}" y2="${y(t)}"/>
        <text class="axis" x="${padL - 8}" y="${y(t) + 3}" text-anchor="end">${fmt(t)}</text>`).join('')}
      <line class="zeroline" x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}"/>
      ${bars}
    </svg>`;

  const wrapEl = $('#chartWrap'), tip = $('#chartTip');
  $$('.bar-hit', wrap).forEach(hit => {
    hit.addEventListener('mouseenter', () => {
      const r = rows[+hit.dataset.i];
      wrapEl.classList.add('hovering');
      $$('.bar', wrap).forEach(b => b.classList.toggle('on', b.dataset.i === hit.dataset.i));
      tip.innerHTML = `<b>${weekLabel(r.week)}</b>
        <div class="l"><span>Ordrer</span><span>${fmt(r.orders)}</span></div>
        <div class="l"><span>Omsætning</span><span>${fmt(r.rev)}</span></div>
        <div class="l"><span>Annoncer</span><span>${fmt(r.ads)}</span></div>
        <div class="l"><span>Overskud</span><span class="${r.profit >= 0 ? 'pos' : 'neg'}">${fmt(r.profit)}</span></div>`;
      const box = hit.getBoundingClientRect(), pbox = wrapEl.getBoundingClientRect();
      tip.style.left = (box.left - pbox.left + box.width / 2) + 'px';
      tip.style.top = (box.top - pbox.top + 40) + 'px';
      tip.classList.add('on');
    });
    hit.addEventListener('mouseleave', () => {
      wrapEl.classList.remove('hovering');
      tip.classList.remove('on');
    });
  });
}

/* ---------------------------------------------------------------- render: rutine */

const RHYTHM = [
  {when:'Mandag',  min:10, title:'Tjek tallene fra weekenden',      text:'Ordrer, annonceforbrug, ROAS. Tag én beslutning: op, ned eller stop.'},
  {when:'Onsdag',  min:15, title:'Én ny annonce eller én ny vinkel', text:'Samme produkt, ny krog. Det er billigere end at finde et nyt produkt.'},
  {when:'Fredag',  min:10, title:'Kundeservice og leverandør',       text:'Svar på mails, tjek at pakkerne er afsendt. Utilfredse kunder koster mere end annoncer.'},
  {when:'Søndag',  min:20, title:'Produktjagt + log ugen',           text:'Find tre nye idéer, giv dem en score, og skriv ugens tal ind. Så er ugen lukket.'}
];

const SETUP_ONCE = [
  {id:'shop',     title:'Opret shoppen',                 text:'Shopify, Shoporama eller lignende. Ét tema, ingen pillerier. Du skal bruge en dag — ikke en måned.'},
  {id:'cvr',      title:'CVR-nummer og moms',            text:'Gratis på virk.dk. Moms skal afregnes, uanset hvor lille butikken er.'},
  {id:'pay',      title:'Betaling: kort + MobilePay',    text:'Danskere dropper kurven, hvis MobilePay mangler. Det er den billigste konvertering du kan købe.'},
  {id:'policy',   title:'Handelsbetingelser og returret', text:'14 dages fortrydelsesret er lovpligtig. Skriv leveringstiden tydeligt — det halverer sure mails.'},
  {id:'supplier', title:'Aftal leveringstid med leverandøren', text:'Bed om DK-lager eller europæisk lager, hvis det findes. 6 dage slår 20 dage hver gang.'},
  {id:'autopay',  title:'Automatisk ordreafsendelse',    text:'DSers, CJ eller Zendrop kobler shoppen til leverandøren, så ordrer sendes af sig selv.'},
  {id:'mail',     title:'Tre automatiske mails',         text:'Tak for ordren, pakken er sendt, og "husk din kurv". Sættes op én gang, tjener penge hver uge.'},
  {id:'pixel',    title:'Pixel og konverteringssporing', text:'Uden sporing annoncerer du i blinde. Det er 20 minutter, der afgør alt andet.'}
];

const RULES = [
  'Brug aldrig mere end 3× varekost på en test, før du har set et salg.',
  'Ingen vinder efter 500 kr. i annoncer og 0 salg? Så er det produktet — ikke annoncen.',
  'Hæv aldrig budgettet mere end 20 % ad gangen.',
  'Køb aldrig lager, før det samme produkt har solgt i tre uger.',
  'Et produkt, du ikke selv gider vente 10 dage på, skal du ikke sælge.'
];

function renderRoutine(){
  const weekly = RHYTHM.reduce((a, r) => a + r.min, 0);
  const doneSetup = SETUP_ONCE.filter(s => state.routine[s.id]).length;
  $('#routineKpis').innerHTML = [
    {label:'Fast tid pr. uge', value: weekly + ' min', sub:'fordelt på fire dage'},
    {label:'Opsætning klaret', value: doneSetup + '/' + SETUP_ONCE.length, sub:'gør det én gang'},
    {label:'Dit budget', value: fmt(num(state.settings.minutesPerWeek)) + ' min', sub: num(state.settings.minutesPerWeek) >= weekly ? 'der er luft' : 'stram — skær en dag væk'}
  ].map(k => `<div class="kpi"><div class="label">${k.label}</div><div class="value num">${k.value}</div><div class="sub">${k.sub}</div></div>`).join('');

  $('#rhythm').innerHTML = RHYTHM.map(r => `
    <div class="tl">
      <span class="when">${r.when}<br>${r.min} min</span>
      <div><b>${r.title}</b><p>${r.text}</p></div>
    </div>`).join('');

  $('#setupList').innerHTML = SETUP_ONCE.map(s => `
    <label class="task ${state.routine[s.id] ? 'done' : ''}">
      <input type="checkbox" data-setup="${s.id}" ${state.routine[s.id] ? 'checked' : ''}>
      <div><div class="t-title">${s.title}</div><div class="t-why">${s.text}</div></div>
    </label>`).join('');

  $('#rules').innerHTML = RULES.map(r => `<div class="stat-line"><span>${r}</span></div>`).join('');
}

/* ---------------------------------------------------------------- render alt */

function render(){
  renderToday();
  renderCatalog();
  renderShop();
  renderNumbers();
  renderRoutine();
  if(draft) renderHuntResult();
  // moduler i egne filer — kaldes kun hvis de er indlæst
  [window.renderJagt, window.renderImages, window.renderFlow, window.renderExportCard]
    .forEach(fn => { if(typeof fn === 'function') fn(); });
}

function showView(name){
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === name)));
  window.scrollTo({top:0, behavior:'smooth'});
}

function syncBindings(){
  $$('[data-bind]').forEach(el => {
    const v = getPath(state, el.dataset.bind);
    if(v !== undefined) el.value = v;
  });
}

/* ---------------------------------------------------------------- events */

document.addEventListener('click', e => {
  const t = e.target;

  const tab = t.closest('.tab');
  if(tab){ showView(tab.dataset.view); return; }

  const goto = t.closest('[data-goto]');
  if(goto){ showView(goto.dataset.goto); return; }

  const open = t.closest('[data-open]');
  if(open){ openProduct(open.dataset.open); return; }

  if(t.closest('[data-close]')){ closeDrawer(); return; }

  const dtab = t.closest('[data-tab]');
  if(dtab){ drawerTab = dtab.dataset.tab; renderDrawer(); return; }

  const sset = t.closest('[data-status-set]');
  if(sset){
    const p = state.products.find(x => x.id === openId);
    p.status = sset.dataset.statusSet;
    save(); renderDrawer(); renderCatalog(); renderToday(); renderShop();
    toast('Status: ' + statusLabel(p.status));
    return;
  }

  const del = t.closest('[data-delete]');
  if(del){
    if(confirm('Slet produktet permanent?')){
      state.products = state.products.filter(x => x.id !== del.dataset.delete);
      save(); closeDrawer(); toast('Produktet er slettet');
    }
    return;
  }

  if(t.closest('[data-suggest]')){
    const p = state.products.find(x => x.id === openId);
    p.price = suggestedPrice(p);
    save(); renderDrawer();
    return;
  }

  if(t.closest('[data-upsell-preset]')){
    const p = state.products.find(x => x.id === openId);
    p.upsell = {...p.upsell, bundleQty:2, bundleDiscount:15, bundleRate:25};
    save(); renderDrawer();
    toast('2-for-1 sat op — ret tallene, så de passer til dit produkt');
    return;
  }

  if(t.closest('[data-refreshtext]')){ renderDrawer(); return; }

  if(t.closest('[data-copytext]')){
    const p = state.products.find(x => x.id === openId);
    navigator.clipboard?.writeText(copyFor(p))
      .then(() => toast('Teksten er kopieret'))
      .catch(() => toast('Markér teksten og kopiér manuelt'));
    return;
  }

  const chip = t.closest('#statusFilter .chip');
  if(chip){
    catalogFilter = chip.dataset.status;
    $$('#statusFilter .chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    renderCatalog();
    return;
  }
});

document.addEventListener('change', e => {
  const task = e.target.closest('[data-task]');
  if(task){
    const key = today();
    const list = new Set(state.done[key] || []);
    task.checked ? list.add(task.dataset.task) : list.delete(task.dataset.task);
    state.done[key] = [...list];
    save(); renderToday();
    if(task.checked) toast('Færdig for i dag 👊');
    return;
  }
  const setup = e.target.closest('[data-setup]');
  if(setup){
    state.routine[setup.dataset.setup] = setup.checked;
    save(); renderRoutine();
    return;
  }
});

document.addEventListener('input', e => {
  const el = e.target;

  if(el.dataset.bind){
    const raw = el.type === 'number' ? num(el.value) : el.value;
    setPath(state, el.dataset.bind, raw);
    save(); render();
    if(draft) $('#multLabel').textContent = `Foreslå pris (×${state.settings.targetMultiple})`;
    return;
  }

  if(el.dataset.p){
    const p = state.products.find(x => x.id === openId);
    if(!p) return;
    let val = el.type === 'number' || el.type === 'range' ? (el.value === '' ? '' : num(el.value)) : el.value;
    if(el.dataset.p === 'cpa' && el.value === '') val = '';
    setPath(p, el.dataset.p, val);
    save();
    const eco = $('#drawerEco');
    if(eco) eco.innerHTML = drawerTab === 'upsalg' ? upsellBlock(p, economics(p)) : ecoBlock(economics(p));
    if(el.type === 'range'){
      const box = el.closest('.criterion')?.querySelector('.val');
      if(box) box.textContent = clamp(num(el.value), 0, 5) + '/5';
    }
    const out = $('#copyOut');
    if(out) out.textContent = copyFor(p);
    return;
  }

  if(el.dataset.crit){
    draft.scores[el.dataset.crit] = num(el.value);
    $('#val_' + el.dataset.crit).textContent = num(el.value) + '/5';
    renderHuntResult();
    return;
  }

  if(el.closest('#view-hunt') && ['f_name','f_source','f_cost','f_ship','f_price','f_cpa'].includes(el.id)){
    draftFromForm();
    renderHuntResult();
  }
});

/* ---------------- find-produkt knapper ---------------- */

function applyParsed(parsed, target){
  if(parsed.name) target.name = parsed.name;
  if(parsed.source) target.source = parsed.source;
  if(parsed.url) target.url = parsed.url;
  if(parsed.cost) target.cost = Math.round(parsed.cost * 100) / 100;
  if(parsed.cost) target.price = suggestedPrice(target);
}

$('#huntParse').addEventListener('click', () => {
  const text = $('#huntPaste').value.trim();
  if(!text) return toast('Sæt et link ind først');
  const parsed = parseLink(text);
  applyParsed(parsed, draft);
  formFromDraft();
  $('#parseNote').innerHTML = `<div class="note" style="margin-top:12px">
    ${parsed.note.length ? parsed.note.map(n => esc(n)).join('<br>') : 'Kunne ikke finde en pris i teksten — skriv varekosten selv.'}
    <br>Tjek altid varekost og fragt hos leverandøren — priser på produktsider er ofte uden fragt.</div>`;
  toast('Link læst');
});

$('#huntClear').addEventListener('click', () => {
  $('#huntPaste').value = '';
  $('#parseNote').innerHTML = '';
});

$('#pasteBtn').addEventListener('click', async () => {
  try{
    const text = await navigator.clipboard.readText();
    $('#huntPaste').value = text;
    $('#huntParse').click();
  }catch(e){ toast('Browseren gav ikke adgang — sæt ind med Ctrl+V'); }
});

$('#suggestPrice').addEventListener('click', () => {
  draftFromForm();
  draft.price = suggestedPrice(draft);
  formFromDraft();
});

$('#usdConv').addEventListener('click', () => {
  draftFromForm();
  draft.cost = Math.round(draft.cost * num(state.settings.usdRate) * 100) / 100;
  draft.price = suggestedPrice(draft);
  formFromDraft();
  toast('Omregnet med kurs ' + state.settings.usdRate);
});

$('#resetHunt').addEventListener('click', () => {
  draft = blankDraft();
  formFromDraft();
  $('#huntPaste').value = '';
  $('#parseNote').innerHTML = '';
});

$('#saveProduct').addEventListener('click', () => {
  draftFromForm();
  if(!draft.name) return toast('Giv produktet et navn');
  const p = {...draft, id: uid(), created: today()};
  state.products.unshift(p);
  save();
  draft = blankDraft();
  formFromDraft();
  $('#huntPaste').value = '';
  $('#parseNote').innerHTML = '';
  render();
  toast('Gemt i kataloget');
  showView('catalog');
});

$('#quickImport').addEventListener('click', () => {
  const text = $('#quickPaste').value.trim();
  if(!text) return toast('Sæt et link ind først');
  const p = blankDraft();
  applyParsed(parseLink(text), p);
  if(!p.name) p.name = 'Ny idé';
  p.id = uid();
  state.products.unshift(p);
  save();
  $('#quickPaste').value = '';
  render();
  toast('Lagt i kataloget som idé');
});

$('#quickToHunt').addEventListener('click', () => {
  const text = $('#quickPaste').value.trim();
  if(text){ $('#huntPaste').value = text; }
  showView('hunt');
  if(text) $('#huntParse').click();
});

$('#newProduct').addEventListener('click', () => {
  draft = blankDraft();
  formFromDraft();
  showView('hunt');
});

/* ---------------- tal ---------------- */

$('#addLog').addEventListener('click', () => {
  const date = $('#l_date').value || today();
  const entry = {
    id: uid(), date,
    orders: num($('#l_orders').value),
    rev:    num($('#l_rev').value),
    cogs:   num($('#l_cogs').value),
    ads:    num($('#l_ads').value)
  };
  if(!entry.orders && !entry.rev && !entry.ads) return toast('Skriv mindst ét tal');
  state.log.push(entry);
  save();
  ['l_orders','l_rev','l_cogs','l_ads'].forEach(id => $('#' + id).value = 0);
  renderNumbers(); renderToday();
  toast('Tallene er gemt');
});

/* ---------------- opsætning, data, tema ---------------- */

const dlg = $('#setupDialog');
$('#setupBtn').addEventListener('click', () => { syncBindings(); dlg.showModal(); });
$('#closeSetup').addEventListener('click', () => dlg.close());

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'medvind-' + today() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const data = JSON.parse(await file.text());
    state = {...structuredClone(DEFAULTS), ...data, settings:{...DEFAULTS.settings, ...(data.settings || {})}};
    save(); syncBindings(); render();
    toast('Data indlæst');
  }catch(err){ toast('Filen kunne ikke læses'); }
  e.target.value = '';
});

$('#wipeBtn').addEventListener('click', () => {
  if(!confirm('Slet alle produkter, tal og indstillinger?')) return;
  state = structuredClone(DEFAULTS);
  save(); syncBindings(); draft = blankDraft(); formFromDraft(); render();
  toast('Alt er nulstillet');
});

$('#demoBtn').addEventListener('click', () => { seedDemo(); toast('Eksempeldata indlæst'); });

$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark' : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(KEY + '.theme', next);
});

/* ---------------------------------------------------------------- demo */

function seedDemo(){
  const mk = (o) => ({...blankDraft(), id: uid(), ...o});
  state.products = [
    mk({name:'Nakkemassager Pro', source:'AliExpress', url:'https://www.aliexpress.com/item/1005006534120983.html',
        cost:62, ship:18, price:399, status:'vinder', benefit:'tager spændingen i nakken på ti minutter foran fjernsynet',
        audience:'dig der sidder ved en skærm hele dagen',
        features:'Ti minutters program med auto-stop\nVarme kan slås fra\nOplades med USB-C — holder en uge',
        scores:{wow:5, problem:5, local:3, audience:4, light:4, robust:3, upsell:4, repeat:3},
        upsell:{bundleQty:2, bundleDiscount:20, bundleRate:22, addonName:'Ekstra gelpuder', addonPrice:79, addonCost:14, addonRate:28, postName:'2 års udvidet garanti', postPrice:99, postCost:0, postRate:14}}),
    mk({name:'Morgenmadskande 2L', source:'CJdropshipping', cost:38, ship:22, price:249, status:'test',
        benefit:'gør morgenmaden klar aftenen før', audience:'småbørnsforældre med travle morgener',
        features:'Klar på 30 sekunder\nTåler opvaskemaskine\nFylder ikke på køkkenbordet',
        scores:{wow:3, problem:4, local:2, audience:5, light:4, robust:4, upsell:3, repeat:3},
        upsell:{bundleQty:2, bundleDiscount:15, bundleRate:18, addonName:'', addonPrice:0, addonCost:0, addonRate:0, postName:'', postPrice:0, postCost:0, postRate:0}}),
    mk({name:'Hundesele med lys', source:'AliExpress', cost:54, ship:20, price:199, status:'ide',
        scores:{wow:3, problem:4, local:2, audience:4, light:3, robust:3, upsell:3, repeat:2}}),
    mk({name:'Skærmrens-sæt', source:'Temu', cost:12, ship:9, price:99, status:'drop',
        scores:{wow:1, problem:2, local:1, audience:2, light:5, robust:4, upsell:1, repeat:2}})
  ];
  const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  state.log = [
    {id:uid(), date:day(49), orders:3,  rev:1050, cogs:240,  ads:900},
    {id:uid(), date:day(42), orders:7,  rev:2540, cogs:560,  ads:1600},
    {id:uid(), date:day(35), orders:11, rev:4120, cogs:880,  ads:2300},
    {id:uid(), date:day(28), orders:9,  rev:3380, cogs:720,  ads:2500},
    {id:uid(), date:day(21), orders:16, rev:6240, cogs:1280, ads:2900},
    {id:uid(), date:day(14), orders:21, rev:8390, cogs:1680, ads:3400},
    {id:uid(), date:day(7),  orders:26, rev:10480, cogs:2080, ads:3900},
    {id:uid(), date:day(2),  orders:12, rev:4870, cogs:960,  ads:1750}
  ];
  state.routine = {shop:true, cvr:true, pay:true, policy:true};
  save(); syncBindings(); render();
  showView('today');
}

/* ---------------------------------------------------------------- init */

function init(){
  const savedTheme = localStorage.getItem(KEY + '.theme');
  if(savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  draft = blankDraft();
  $('#l_date').value = today();
  syncBindings();
  formFromDraft();
  render();

  if(!state.products.length && !state.log.length){
    $('#parseNote').innerHTML = `<div class="note" style="margin-top:12px">Ny her? Tryk <b>Opsætning → Indlæs eksempel</b> for at se en butik med tal i — og slet det igen bagefter.</div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
