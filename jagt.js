/* Jagt — hvor kandidaterne findes, hvornår de sælger, og hvad der skal tjekkes først.
   Bygger søgelinks til de steder, der faktisk siger noget om efterspørgsel. */

const NICHES = [
  {label:'Hjem & opbevaring', q:'storage organizer home'},
  {label:'Køkken',            q:'kitchen gadget'},
  {label:'Søvn & afslapning', q:'sleep relax massage'},
  {label:'Træning',           q:'home fitness gear'},
  {label:'Baby & børn',       q:'baby parenting gadget'},
  {label:'Kæledyr',           q:'pet dog cat accessory'},
  {label:'Bil',               q:'car accessory gadget'},
  {label:'Have & altan',      q:'garden balcony outdoor'},
  {label:'Skønhed',           q:'beauty skincare tool'},
  {label:'Kontor & hjemmearbejde', q:'desk setup office gadget'}
];

const LINK_GROUPS = [
  {
    title:'Find produkterne',
    hint:'Her ligger varerne og leverandørerne.',
    links: q => [
      {ic:'🛒', name:'AliExpress — flest ordrer først', why:'Sortér efter antal solgte. Under 300 ordrer: spring den over.',
       url:`https://www.aliexpress.com/wholesale?SearchText=${q}&SortType=total_tranpro_desc`},
      {ic:'📦', name:'AliExpress Dropshipping Center', why:'Kræver login. Viser salgstal og om varen er på vej op.',
       url:'https://www.aliexpress.com/p/dropshipper/index.html'},
      {ic:'🏭', name:'CJdropshipping', why:'Ofte EU-lager og kortere leveringstid end AliExpress.',
       url:`https://www.google.com/search?q=site%3Acjdropshipping.com+${q}`},
      {ic:'🟠', name:'Temu', why:'God til at se, hvad der presses ud i markedet lige nu.',
       url:`https://www.temu.com/search_result.html?search_key=${q}`},
      {ic:'📕', name:'Amazon bestsellers (DE)', why:'Det, der sælger i Tyskland, sælger typisk i Danmark 3–6 måneder efter.',
       url:'https://www.amazon.de/gp/bestsellers/'}
    ]
  },
  {
    title:'Tjek efterspørgslen',
    hint:'Er der nogen, der leder efter det?',
    links: q => [
      {ic:'📈', name:'Google Trends — Danmark', why:'Fladt eller opadgående er fint. Nedadgående er en fælde.',
       url:`https://trends.google.com/trends/explore?geo=DK&q=${q}`},
      {ic:'🎵', name:'TikTok-søgning', why:'Se visninger og kommentarer. "Hvor kan man købe den?" er det bedste signal, der findes.',
       url:`https://www.tiktok.com/search?q=${q}`},
      {ic:'🔥', name:'TikTok Creative Center', why:'Hvilke annoncer og lyde der kører i Danmark lige nu.',
       url:'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?region=DK'},
      {ic:'📌', name:'Pinterest-søgning', why:'Stærkt på hjem, indretning, have og gaver.',
       url:`https://www.pinterest.com/search/pins/?q=${q}`}
    ]
  },
  {
    title:'Tjek konkurrencen',
    hint:'Er der plads til dig — og til din pris?',
    links: q => [
      {ic:'🇩🇰', name:'Sælger danske shops det allerede?', why:'Et par stykker er sundt. Ti er for sent.',
       url:`https://www.google.com/search?q=${q}+site%3A.dk`},
      {ic:'💰', name:'Google Shopping — dansk pris', why:'Hvad tager andre? Din pris skal kunne ligge i nærheden.',
       url:`https://www.google.com/search?tbm=shop&gl=dk&q=${q}`},
      {ic:'📣', name:'Meta Ad Library — Danmark', why:'Kører nogen annoncer på det? Så tjener nogen penge på det.',
       url:`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=DK&media_type=all&q=${q}`},
      {ic:'🛍️', name:'Etsy — pris og vinkler', why:'Godt til at se, hvordan folk beskriver og pakker produktet ind.',
       url:`https://www.etsy.com/search?q=${q}`}
    ]
  }
];

const SEASONS = [
  {m:'Januar',    t:'Nytårsforsætter og oprydning',     d:'Træning, meal prep, opbevaring, budget-apps. Folk køber en ny version af sig selv.'},
  {m:'Februar',   t:'Valentin og vinterhygge',          d:'Gaver til par, lys og hygge, indendørs projekter. Kort men skarp sæson.'},
  {m:'Marts',     t:'Forårsrengøring og have',          d:'Rengøring, opbevaring, frø og altankasser. Haven vågner tidligt i søgningerne.'},
  {m:'April',     t:'Påske, cykler og udeliv',          d:'Cykeltilbehør, udendørs leg, påskepynt. Solen sætter dagsordenen.'},
  {m:'Maj',       t:'Konfirmation og grill',            d:'Gaver til unge, grillgrej, havemøbeltilbehør. Danmarks stærkeste gavemåned efter jul.'},
  {m:'Juni',      t:'Sommer, strand og rejse',          d:'Rejsetilbehør, køletasker, solbeskyttelse, camping.'},
  {m:'Juli',      t:'Ferie — lav aktivitet',            d:'Dårlig måned at lancere i. Brug den på at forberede efteråret.'},
  {m:'August',    t:'Skolestart og kontor',             d:'Taske, madkasse, skrivebord, hjemmearbejde. Stabil og forudsigelig.'},
  {m:'September', t:'Hjemmehygge og indretning',        d:'Lys, tæpper, organisering. Folk går indenfor igen.'},
  {m:'Oktober',   t:'Mørket, halloween og lys',         d:'Lamper, varme, wellness, halloween. Opvarmning til Q4.'},
  {m:'November',  t:'Black Friday og julestart',        d:'Årets største måned. Alt skal være testet og på lager i oktober.'},
  {m:'December',  t:'Jul og gaver',                     d:'Gaveklar emballage og sidste leveringsdato tydeligt på forsiden.'}
];

const TREND_CHECKS = [
  {id:'orders',  t:'Mindst 300 ordrer hos leverandøren',      d:'Under det er der ingen der har bevist, at varen kan sælges.'},
  {id:'reviews', t:'4,5 i score og billeder fra rigtige kunder', d:'Kundebilleder viser, hvad du faktisk sender ud.'},
  {id:'dk',      t:'Få eller ingen danske shops på det endnu', d:'Et par stykker er sundt. Ti betyder, at prisen allerede er presset.'},
  {id:'video',   t:'Virker på tre sekunders video uden ord',   d:'Kan du ikke vise det, kan du ikke annoncere for det.'},
  {id:'ads',     t:'Nogen kører aktive annoncer på det',       d:'Ingen brænder penge af i månedsvis for sjov.'},
  {id:'trend',   t:'Google Trends er fladt eller opad',        d:'Nedadgående kurve er et produkt, du kommer for sent til.'},
  {id:'ship',    t:'Under 1 kg, uden batteri, væske eller knive', d:'Batterier og væsker giver told, gebyrer og afviste pakker.'},
  {id:'margin',  t:'Kan sælges til mindst 3× varekost + fragt', d:'Ellers er der ikke plads til annoncer, returer og gebyrer.'},
  {id:'eu',      t:'Findes den på et EU-lager?',              d:'Siden 1. juli 2026 koster hver varepost fra lande uden for EU 3 € i told. EU-lager fjerner den og halverer leveringstiden.'}
];

function jagtQuery(){
  const raw = ($('#jagtQuery')?.value || state.hunt.keyword || '').trim();
  return encodeURIComponent(raw || 'gadget');
}

function renderJagt(){
  const box = $('#searchLinks');
  if(!box) return;
  const field = $('#jagtQuery');
  if(field && document.activeElement !== field && !field.value && state.hunt.keyword) field.value = state.hunt.keyword;
  const q = jagtQuery();

  box.innerHTML = LINK_GROUPS.map(g => `
    <div>
      <div class="eyebrow" style="margin-bottom:8px">${g.title}</div>
      <div class="stack" style="gap:8px">
        ${g.links(q).map(l => `
          <a class="linktile" href="${l.url}" target="_blank" rel="noopener noreferrer">
            <span class="ic">${l.ic}</span>
            <span><b>${l.name}</b><span>${l.why}</span></span>
          </a>`).join('')}
      </div>
      <p class="hint" style="margin-top:7px">${g.hint}</p>
    </div>`).join('');

  $('#nicheChips').innerHTML = NICHES.map(n =>
    `<button class="chip" data-niche="${esc(n.q)}">${n.label}</button>`).join('');

  $('#jagtNote').innerHTML = `Rækkefølgen betyder noget: find varen, tjek at nogen efterspørger den, og se til sidst om der er plads til dig.
    Bruger du mere end ti minutter på ét produkt, er svaret som regel nej.`;

  const now = new Date().getMonth();
  $('#seasonList').innerHTML = SEASONS.map((s, i) => {
    const ahead = (i - now + 12) % 12;
    const hot = ahead <= 2;
    return `<div class="month ${hot ? 'now' : ''}">
      <span class="m">${s.m.slice(0, 3)}${ahead === 0 ? ' •' : ''}</span>
      <div><b>${s.t}</b><p>${s.d}${ahead === 2 ? ' — bestil testvarer nu, hvis du vil nå det.' : ''}</p></div>
    </div>`;
  }).join('');

  $('#trendChecks').innerHTML = TREND_CHECKS.map(c => `
    <label class="task ${state.hunt.checks[c.id] ? 'done' : ''}">
      <input type="checkbox" data-check="${c.id}" ${state.hunt.checks[c.id] ? 'checked' : ''}>
      <div><div class="t-title">${c.t}</div><div class="t-why">${c.d}</div></div>
    </label>`).join('');

  const hits = TREND_CHECKS.filter(c => state.hunt.checks[c.id]).length;
  const total = TREND_CHECKS.length;
  $('#scrapeNote').innerHTML = `
    <span class="eyebrow">Status</span>
    <h3 style="margin:5px 0 8px">${hits}/${total} tjek klaret${hits >= 7 ? ' — den er værd at teste' : hits >= 3 ? ' — bliv færdig, før du bruger penge' : ''}</h3>
    <div class="divider"></div>
    <span class="eyebrow">Hvorfor søger siden ikke selv?</span>
    <p class="hint" style="margin-top:6px">En side, der ligger i din browser, må ikke hente data fra AliExpress eller TikTok — det blokerer browseren (CORS), og der findes ikke et åbent, gratis produkt-API.
    Automatisk søgning kræver en lille server og en betalt datatjeneste (fx Apify eller Zendrop/CJ's API) — typisk 200–500 kr. om måneden.
    Indtil da er linkene herover det samme arbejde, bare uden abonnement: ét klik i stedet for ti.</p>`;
}

document.addEventListener('input', e => {
  if(e.target.id === 'jagtQuery'){
    state.hunt.keyword = e.target.value;
    save();
    renderJagt();
  }
});

document.addEventListener('click', e => {
  const n = e.target.closest('[data-niche]');
  if(n){
    $('#jagtQuery').value = n.dataset.niche;
    state.hunt.keyword = n.dataset.niche;
    save();
    renderJagt();
  }
});

document.addEventListener('change', e => {
  const c = e.target.closest('[data-check]');
  if(c){
    state.hunt.checks[c.dataset.check] = c.checked;
    save();
    renderJagt();
  }
});
