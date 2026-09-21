/* Flow — tragten, lanceringsplanen, opslagene, annoncerne og mailsene.
   Software skaffer ikke kunder. Den kan planlægge arbejdet og vise hvor det siver. */

const BENCH = {
  atc:      {low:6,  high:10, name:'Besøg → kurv',      fixes:['Første billede skal vise produktet i brug, ikke på hvid baggrund.', 'Skriv prisen og fri fragt-grænsen over folden.']},
  checkout: {low:45, high:60, name:'Kurv → betaling',   fixes:['Vis fragtprisen allerede i kurven — skjulte gebyrer dræber flere køb end prisen.', 'Læg et "fri fragt om du køber for X mere" ind.']},
  purchase: {low:50, high:70, name:'Betaling → køb',    fixes:['MobilePay skal være der. Mangler den, falder danskerne fra.', 'Færre felter i formularen, og ingen tvungen kontooprettelse.']}
};

const LAUNCH = [
  {t:'Vælg ét produkt og lås det',        x:'Ingen skift i 14 dage. At skifte produkt er den dyreste vane i dropshipping.'},
  {t:'Læg butikken online',               x:'Eksportér butik.html og træk den ind på Netlify Drop — eller opret shoppen hos Shopify.'},
  {t:'Fem produktbilleder',               x:'Lav dem under Billeder: kvadratisk til shoppen, 4:5 til feed, 9:16 til story.'},
  {t:'Skriv teksterne færdige',           x:'Produkttekst, fragt, retur og "om os". Brug generatoren og ret et par sætninger, så det lyder som dig.'},
  {t:'Betaling klar og testet',           x:'Lav betalingslinket og køb for 1 krone af dig selv. Hvis du ikke kan bestille, kan kunden heller ikke.'},
  {t:'Film tre råklip på telefonen',      x:'Et hook-klip, et demo-klip og et nærbillede. 30 minutter, ingen redigering endnu.'},
  {t:'Læg den første video op',           x:'TikTok og Reels, organisk. Gratis data om, hvorvidt folk stopper op.'},
  {t:'Sporing sat op og testet',          x:'Pixel/konverteringssporing. Uden den annoncerer du i blinde.'},
  {t:'Start annonce nummer ét',           x:'100 kr. om dagen, ét annoncesæt, bredt publikum. Lad den køre i fred.'},
  {t:'Video to op — og svar på alt',      x:'Hver kommentar er gratis rækkevidde og en ny videoidé.'},
  {t:'Aflæs tallene for første gang',     x:'Klik, kurv, køb. Først nu har du nok data til at ændre noget.'},
  {t:'Dræb det dårligste, dupliker det bedste', x:'Ét greb ad gangen, så du ved hvad der virkede.'},
  {t:'Sæt de fire mails op',              x:'Tak, afsendt, glemt kurv og anmeldelse. De kører af sig selv bagefter.'},
  {t:'Beslut: skalér, skift vinkel eller drop', x:'Salg og fornuftig CPA: skru op. Ingen salg efter 500 kr.: det er produktet, ikke annoncen.'}
];

const HOOKS = [
  {t:'Problemet',            h:a => `Det her tager mig 10 minutter hver dag — indtil jeg fandt ${a.name}.`,      f:'Film irritationen først. Produktet må først dukke op efter tre sekunder.'},
  {t:'Før og efter',         h:a => `Før: kaos. Efter: ${String(a.benefit).toLowerCase()}.`,                    f:'Ét klip, samme kameravinkel, hårdt klip imellem.'},
  {t:'Tre ting jeg ikke vidste', h:a => `Tre ting jeg ville ønske jeg vidste om ${a.name}, før jeg købte den.`, f:'Tal ind i kameraet, tekst på skærmen, tæl 1-2-3.'},
  {t:'Unboxing uden musik',  h:a => `Pakken kom i dag. Ingen musik — bare lyden.`,                              f:'Rolige hænder, tæt på. Lyd sælger mere end klipning.'},
  {t:'Svar på en kommentar', h:a => `"Holder den overhovedet?" — godt spørgsmål, se her.`,                      f:'Skærmbillede af kommentaren øverst i de første to sekunder.'},
  {t:'Sådan bruger jeg den', h:a => `${a.name} på 20 sekunder — sådan gør jeg.`,                                f:'Ét take, ingen klip. Vis hele forløbet.'},
  {t:'Ærlig test',           h:a => `Er ${fmt(a.price)} kr. for meget for det her? Ærligt svar.`,               f:'Nævn også en ulempe. Det er derfor de tror på resten.'},
  {t:'POV',                  h:a => `POV: du har prøvet alt andet, og det virkede i to dage.`,                  f:'Tekst på skærmen fra frame ét. Ingen intro.'},
  {t:'Nogen andre prøver',   h:a => `Jeg gav ${a.name} til en, der ikke tror på den slags.`,                    f:'Reaktionen er indholdet. Film ansigtet, ikke produktet.'},
  {t:'Tre måder',            h:a => `Tre måder at bruge ${a.name} på, du ikke har tænkt på.`,                   f:'Hurtige klip, tre sekunder hver, tekst over.'},
  {t:'Spørgsmålet igen',     h:a => `Det her spørgsmål får jeg hver eneste dag.`,                               f:'Svar konkret på 15 sekunder. Slut med hvor man køber.'},
  {t:'Pakning af en ordre',  h:a => `Kom med, når jeg pakker dagens ordrer.`,                                   f:'Bygger tillid til, at der står et rigtigt menneske bag.'},
  {t:'Hvorfor netop den',    h:a => `Der findes ti versioner af ${a.name}. Derfor valgte jeg den her.`,         f:'Vis to modeller side om side og peg på forskellen.'},
  {t:'Hvis du stadig...',    h:a => `Hvis du stadig ${String(a.benefit).toLowerCase().replace(/^gør /,'')} på den gamle måde — se her.`, f:'Direkte tiltale. Slut med en tydelig opfordring.'}
];

function flowProduct(){
  const sel = $('#flowProduct');
  const id = sel?.value;
  const live = state.products.filter(p => p.status === 'test' || p.status === 'vinder');
  const p = state.products.find(x => x.id === id) || live[0] || state.products[0];
  return p ? {
    name: p.name || 'produktet',
    benefit: p.benefit || 'gør hverdagen lettere',
    price: num(p.price),
    audience: p.audience || 'dem, der har prøvet alt andet'
  } : {name:'produktet', benefit:'gør hverdagen lettere', price:0, audience:'dine kunder'};
}

function funnel(){
  const f = state.flow;
  const visitors = num(f.visitors);
  const atc = visitors * num(f.atc) / 100;
  const co  = atc * num(f.checkout) / 100;
  const orders = co * num(f.purchase) / 100;
  const cr = visitors > 0 ? orders / visitors : 0;
  const cpa = cr > 0 ? num(f.cpc) / cr : 0;

  const live = state.products.filter(p => p.status === 'test' || p.status === 'vinder').map(p => economics(p));
  const aov = live.length ? live.reduce((a, e) => a + e.aov, 0) / live.length : 0;
  const perOrder = live.length ? live.reduce((a, e) => a + e.profitUp, 0) / live.length : 0;

  const steps = [
    {key:'atc',      value: num(f.atc),      from: visitors, to: atc},
    {key:'checkout', value: num(f.checkout), from: atc,      to: co},
    {key:'purchase', value: num(f.purchase), from: co,       to: orders}
  ].map(s => {
    const b = BENCH[s.key];
    return {...s, bench:b, weak: s.value < b.low, gap: b.low - s.value};
  });

  const weakest = steps.slice().sort((a, b) => (b.gap) - (a.gap))[0];
  return {visitors, atc, co, orders, cr, cpa, aov, perOrder, steps, weakest};
}

function renderFlow(){
  const box = $('#funnel');
  if(!box) return;
  const f = funnel();

  // Bredden viser trinnets egen konvertering, ikke andelen af alle besøgende —
  // ellers bliver de sidste trin streger, man ikke kan aflæse.
  box.innerHTML = `<div class="funnel">
    <div class="fstep">
      <div class="top"><span>Besøgende pr. uge</span><b>${fmt(f.visitors)}</b></div>
      <div class="fbar"><i style="width:100%"></i></div>
    </div>
    ${f.steps.map(s => `
      <div class="fstep">
        <div class="top"><span>${s.bench.name}</span><b>${fmt(s.value, 1)} % → ${fmt(s.to, 1)}</b></div>
        <div class="fbar">
          <i class="${s.weak ? 'weak' : ''}" style="width:${clamp(s.value, 2, 100)}%"></i>
          <span class="mark" style="left:${clamp(s.bench.low, 0, 100)}%" title="Normalt niveau"></span>
        </div>
        <div class="note-s">Normalt ${s.bench.low}–${s.bench.high} %${s.weak ? ' — her siver det' : ''}</div>
      </div>`).join('')}
    <p class="note-s">Stregen i hver bjælke er det normale niveau. Bjælken skal nå forbi den.</p>
  </div>`;

  const w = f.weakest;
  const lift = (() => {
    // hvad et løft til bundnormalen ville give om ugen
    const f2 = {...state.flow, [w.key]: Math.max(num(state.flow[w.key]), w.bench.low)};
    const before = f.orders;
    const v = num(f2.visitors);
    const after = v * num(f2.atc) / 100 * num(f2.checkout) / 100 * num(f2.purchase) / 100;
    return (after - before) * f.perOrder;
  })();

  $('#funnelVerdict').innerHTML = `
    <span class="eyebrow">Diagnose</span>
    <h3 style="margin:5px 0 10px">${w.weak ? 'Det siver i: ' + w.bench.name : 'Tragten ser sund ud'}</h3>
    <div class="stat-line"><span>Ordrer pr. uge</span><b>${fmt(f.orders, 1)}</b></div>
    <div class="stat-line"><span>Konvertering i alt</span><b>${fmt(f.cr * 100, 2)} %</b></div>
    <div class="stat-line"><span>Omsætning pr. uge</span><b>${kr(f.orders * f.aov)}</b></div>
    <div class="stat-line"><span>Overskud pr. uge</span><b class="${f.orders * f.perOrder >= 0 ? 'pos' : 'neg'}">${kr(f.orders * f.perOrder)}</b></div>
    <div class="stat-line big"><span>Annonce pr. ordre ved ${fmt(num(state.flow.cpc), 2)} kr./klik</span><b>${f.cpa > 0 ? kr(f.cpa) : '—'}</b></div>
    ${w.weak ? `<div class="note" style="margin-top:12px">
      <b>${w.bench.name}</b> ligger på ${fmt(w.value, 1)} % mod ${w.bench.low}–${w.bench.high} % normalt.
      Løfter du den til ${w.bench.low} %, er det ca. ${kr(lift)} mere om ugen.
      <br>• ${w.bench.fixes[0]}<br>• ${w.bench.fixes[1]}</div>`
    : `<p class="hint" style="margin-top:10px">Alle tre trin ligger inden for det normale. Så er vejen frem flere besøgende — ikke flere justeringer på siden.</p>`}
    ${f.cpa > 0 && f.perOrder > 0 && f.cpa > f.perOrder ? `<div class="note" style="margin-top:10px">Annoncerne koster ${kr(f.cpa)} pr. ordre, men du tjener kun ${kr(f.perOrder)}. Enten skal prisen op, eller også skal konverteringen.</div>` : ''}`;

  // lanceringsplan
  const done = state.flow.launch || {};
  $('#launchPlan').innerHTML = LAUNCH.map((d, i) => `
    <label class="day ${done[i] ? 'done' : ''}">
      <input type="checkbox" data-launch="${i}" ${done[i] ? 'checked' : ''}>
      <span class="dnum">D${i + 1}</span>
      <div><div class="t-title">${d.t}</div><div class="t-why">${d.x}</div></div>
    </label>`).join('');
  $('#launchProgress').textContent = `${LAUNCH.filter((_, i) => done[i]).length}/14`;

  // produktvælger
  const sel = $('#flowProduct');
  const keep = sel.value;
  sel.innerHTML = state.products.map(p => `<option value="${p.id}">${esc(p.name || 'Uden navn')}</option>`).join('')
    || '<option value="">— intet produkt endnu —</option>';
  if(keep) sel.value = keep;

  const a = flowProduct();
  const cdone = state.flow.content || {};
  $('#contentPlan').innerHTML = HOOKS.map((h, i) => `
    <label class="day ${cdone[i] ? 'done' : ''}">
      <input type="checkbox" data-content="${i}" ${cdone[i] ? 'checked' : ''}>
      <span class="dnum">${i + 1}</span>
      <div>
        <div class="t-title">${h.t}</div>
        <div class="t-why" style="color:var(--ink-2)">"${esc(h.h(a))}"</div>
        <div class="t-why">${h.f}</div>
        <div class="t-meta"><button class="btn sm ghost" data-copy="${esc(h.h(a))}">Kopiér hook</button></div>
      </div>
    </label>`).join('');

  $('#adScripts').innerHTML = adScripts(a).map(s => `
    <div class="script">
      <h4>${s.title}</h4>
      ${s.beats.map(b => `<div class="beat"><span>${b[0]}</span><div>${esc(b[1])}</div></div>`).join('')}
      <div class="btn-row" style="margin-top:9px"><button class="btn sm ghost" data-copy="${esc(s.beats.map(b => b[0] + '  ' + b[1]).join('\n'))}">Kopiér manuskript</button></div>
    </div>`).join('');

  $('#mailFlows').innerHTML = mailFlows(a).map(m => `
    <details class="mail">
      <summary>${m.when} — ${m.subject}</summary>
      <div class="out">${esc(m.body)}</div>
      <div class="btn-row" style="margin-top:9px"><button class="btn sm ghost" data-copy="${esc('Emne: ' + m.subject + '\n\n' + m.body)}">Kopiér mail</button></div>
    </details>`).join('');

  renderUtm();
}

function adScripts(a){
  const price = a.price ? fmt(a.price) + ' kr.' : 'prisen';
  return [
    {title:'1 · Problemet først', beats:[
      ['0–3 s',  `"Hvis du også ${String(a.benefit).toLowerCase()} — så stop her."`],
      ['3–8 s',  'Vis problemet, som det ser ud i virkeligheden. Rodet bord, øm nakke, kold kaffe.'],
      ['8–18 s', `Vis ${a.name} løse det i ét take. Ingen klip, ingen musik over talen.`],
      ['18–25 s','"Jeg har brugt den hver dag i tre uger." — konkret, ikke superlativ.'],
      ['25–30 s',`"${price} og fri fragt. Linket står i profilen."`]
    ]},
    {title:'2 · Ærlig anmeldelse', beats:[
      ['0–3 s',  `"Er ${a.name} pengene værd? Jeg købte den selv."`],
      ['3–10 s', 'Sig én ting, der ikke er perfekt. Det er derfor de tror på resten.'],
      ['10–20 s','Vis de to ting, den faktisk er god til.'],
      ['20–27 s',`"Til ${a.audience} — ja. Ellers ikke."`],
      ['27–30 s','"Link i profilen, hvis det lyder som dig."']
    ]},
    {title:'3 · Før og efter', beats:[
      ['0–2 s',  'Klip af "før". Ingen tale, bare billedet.'],
      ['2–5 s',  'Hårdt klip til "efter". Samme vinkel, samme lys.'],
      ['5–15 s', `"Forskellen er ${a.name}." — vis den i hånden.`],
      ['15–25 s','Gentag før/efter én gang til, hurtigere.'],
      ['25–30 s',`"${price}. Fri fragt over ${fmt(num(state.settings.freeShipFrom))} kr."`]
    ]}
  ];
}

function mailFlows(a){
  const s = state.settings;
  const shop = s.storeName || 'butikken';
  return [
    {when:'Straks efter køb', subject:'Tak — vi er i gang med din ordre',
     body:`Hej {{fornavn}}\n\nTak fordi du købte ${a.name}. Vi pakker den i dag, og du får en mail med sporingsnummer, så snart pakken er afsendt.\n\nForventet levering: 6–12 hverdage.\n\nSkriv endelig, hvis du har spørgsmål — du kan bare svare på denne mail.\n\n${shop}`},
    {when:'Når pakken sendes', subject:'Din pakke er på vej',
     body:`Hej {{fornavn}}\n\nDin ${a.name} er afsendt. Du kan følge pakken her: {{sporingslink}}\n\nNår den lander: prøv den et par dage, før du dømmer. De fleste bruger den forkert den første gang — vi har lagt en kort vejledning i pakken.\n\n${shop}`},
    {when:'4 timer efter forladt kurv', subject:'Du glemte noget',
     body:`Hej\n\nDu lagde ${a.name} i kurven, men nåede ikke i mål. Den ligger her stadig: {{kurvlink}}\n\n${num(s.returnDays) || 30} dages returret, så du kan roligt prøve den. Passer den ikke, sender du den bare tilbage.\n\n${shop}`},
    {when:'10 dage efter levering', subject:'Virkede den?',
     body:`Hej {{fornavn}}\n\nDu har haft ${a.name} i en uges tid nu. Virkede den, som du håbede?\n\nEt ærligt svar hjælper os mere end noget andet — og skriver du to linjer som anmeldelse, hjælper det den næste, der står i tvivl: {{anmeldelseslink}}\n\nVar der noget galt, så sig til. Vi retter op.\n\n${shop}`}
  ];
}

function renderUtm(){
  const base = ($('#utmUrl')?.value || '').trim() || `https://${state.settings.storeDomain || 'minbutik.dk'}`;
  const q = new URLSearchParams({
    utm_source: ($('#utmSource')?.value || 'tiktok').trim(),
    utm_medium: ($('#utmMedium')?.value || 'organic').trim(),
    utm_campaign: ($('#utmCampaign')?.value || 'lancering').trim()
  });
  const link = base + (base.includes('?') ? '&' : '?') + q.toString();
  $('#utmOut').textContent = link;
  return link;
}

document.addEventListener('change', e => {
  const l = e.target.closest('[data-launch]');
  if(l){ state.flow.launch[l.dataset.launch] = l.checked; save(); renderFlow(); return; }
  const c = e.target.closest('[data-content]');
  if(c){ state.flow.content[c.dataset.content] = c.checked; save(); renderFlow(); return; }
  if(e.target.id === 'flowProduct') renderFlow();
});

document.addEventListener('input', e => {
  if(['utmUrl','utmSource','utmMedium','utmCampaign'].includes(e.target.id)) renderUtm();
});

document.addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if(c){
    navigator.clipboard?.writeText(c.dataset.copy)
      .then(() => toast('Kopieret'))
      .catch(() => toast('Markér teksten og kopiér manuelt'));
    return;
  }
  if(e.target.id === 'utmCopy'){
    navigator.clipboard?.writeText(renderUtm())
      .then(() => toast('Link kopieret'))
      .catch(() => toast('Markér linket og kopiér manuelt'));
  }
});
