/* Butikseksport — laver en færdig, selvstændig HTML-butik ud af kataloget.
   Én fil med kurv, produktsider og betalingslink. Læg den op hos en hvilken som helst udbyder. */

function shopProducts(){
  const f = state.settings.shopFilter || 'live';
  return state.products.filter(p =>
    f === 'alle' ? true : f === 'vinder' ? p.status === 'vinder' : (p.status === 'test' || p.status === 'vinder'));
}

function productCopyParts(p){
  const feats = String(p.features || '').split('\n').map(x => x.trim()).filter(Boolean);
  return {
    headline: p.benefit ? `${p.name} — ${p.benefit}` : p.name,
    bullets: feats.length ? feats : ['Klar til brug med det samme', 'Enkel at bruge hver dag', 'Fylder ikke'],
    body: p.benefit
      ? `Du kender følelsen: det tager for lang tid, og du gider det ikke i dag. ${p.name} er den lille genvej — den ${String(p.benefit).toLowerCase()}, uden at du skal lægge om på noget.`
      : `${p.name} er et af de produkter, der bare gør én ting — og gør den hver gang.`,
    audience: p.audience || ''
  };
}

function shopData(){
  const s = state.settings;
  return {
    name: s.storeName || 'Min butik',
    tagline: s.storeTagline || '',
    domain: s.storeDomain || '',
    email: s.contactEmail || '',
    cvr: s.cvr || '',
    brand: s.brandColor || '#0B7A5D',
    ship: num(s.shipPrice),
    freeFrom: num(s.freeShipFrom),
    returnDays: num(s.returnDays) || 30,
    checkoutUrl: s.checkoutUrl || '',
    products: shopProducts().map(p => {
      const e = economics(p);
      const c = productCopyParts(p);
      const u = p.upsell || {};
      return {
        id: p.id,
        name: p.name || 'Produkt',
        headline: c.headline,
        bullets: c.bullets,
        body: c.body,
        audience: c.audience,
        price: Math.round(e.price),
        before: Math.round(e.price * 1.45 / 10) * 10 - 1,
        image: p.image || '',
        emoji: emojiFor(p.name),
        bundleQty: num(u.bundleQty) > 1 ? num(u.bundleQty) : 0,
        bundleDiscount: num(u.bundleDiscount),
        addonName: u.addonName || '',
        addonPrice: num(u.addonPrice),
        payLink: p.payLink || '',
        badge: p.status === 'vinder' ? 'Bestseller' : ''
      };
    })
  };
}

function buildShopHtml(){
  const d = shopData();
  const json = JSON.stringify(d).replace(/</g, '\\u003c');
  const desc = (d.tagline || d.name).slice(0, 155);

  const css = `
:root{--brand:${d.brand};--bg:#FBFAF7;--surface:#fff;--ink:#14181C;--muted:#6E7681;--border:#E4DFD5;--radius:14px}
@media(prefers-color-scheme:dark){:root{--bg:#0F1317;--surface:#171D22;--ink:#EAEEF1;--muted:#8D959D;--border:#28323A}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 "Plus Jakarta Sans",-apple-system,"Segoe UI",Roboto,sans-serif}
img{max-width:100%;display:block}h1,h2,h3,h4{margin:0;line-height:1.2;letter-spacing:-.015em}
a{color:inherit}button{font:inherit;cursor:pointer}
.wrap{max-width:1080px;margin:0 auto;padding:0 18px}
header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.hrow{display:flex;align-items:center;gap:14px;padding:13px 0}
.logo{font-weight:800;font-size:18px;margin-right:auto;text-decoration:none}
.cartbtn{border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:99px;padding:8px 15px;font-weight:650;font-size:14px}
.cartbtn b{background:var(--brand);color:#fff;border-radius:99px;padding:1px 7px;margin-left:6px;font-size:12px}
.hero{text-align:center;padding:52px 0 34px}
.hero h1{font-size:clamp(1.7rem,5vw,2.6rem)}
.hero p{color:var(--muted);margin:12px auto 0;max-width:52ch}
.trust{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;font-size:13px;color:var(--muted)}
.trust span{background:var(--surface);border:1px solid var(--border);border-radius:99px;padding:6px 13px}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));padding:14px 0 50px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;text-align:left;padding:0;color:inherit}
.card:hover{border-color:var(--brand)}
.card .ph{aspect-ratio:1/1;background:#EFECE5;display:grid;place-items:center;font-size:3rem;position:relative}
.card .ph img{width:100%;height:100%;object-fit:cover}
.tag{position:absolute;top:10px;left:10px;background:var(--brand);color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px}
.card .cb{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h3{font-size:1rem}.card .sub{font-size:13px;color:var(--muted)}
.price{display:flex;align-items:baseline;gap:9px;margin-top:auto}
.price b{font-size:1.15rem}.price s{color:var(--muted);font-size:.86rem}
.buy{background:var(--brand);color:#fff;border:0;border-radius:10px;padding:11px 14px;font-weight:700;width:100%}
.info{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));padding:30px 0;border-top:1px solid var(--border)}
.info h4{margin-bottom:6px;font-size:.95rem}.info p{color:var(--muted);font-size:.88rem;margin:0}
footer{border-top:1px solid var(--border);padding:24px 0 46px;color:var(--muted);font-size:.82rem}
.scrim{position:fixed;inset:0;background:rgba(8,12,16,.5);opacity:0;pointer-events:none;transition:opacity .2s;z-index:30}
.scrim.on{opacity:1;pointer-events:auto}
.panel{position:fixed;top:0;right:0;bottom:0;width:min(460px,100%);background:var(--bg);border-left:1px solid var(--border);z-index:40;transform:translateX(100%);transition:transform .25s ease;overflow-y:auto;padding:20px}
.panel.on{transform:none}
.panel .x{float:right;border:0;background:transparent;font-size:20px;color:var(--muted)}
.panel h2{margin:6px 0 10px;font-size:1.3rem}
.panel ul{padding-left:18px;color:var(--muted);font-size:.9rem}
.qty{display:flex;align-items:center;gap:10px;margin:14px 0}
.qty button{width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--surface);color:var(--ink);font-size:18px}
.line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px dashed var(--border);font-size:.92rem}
.line:last-of-type{border-bottom:0}
.offer{background:color-mix(in srgb,var(--brand) 12%,transparent);border:1px solid color-mix(in srgb,var(--brand) 35%,transparent);border-radius:10px;padding:10px 12px;font-size:.86rem;margin:12px 0}
details{border-top:1px solid var(--border);padding:10px 0}details summary{cursor:pointer;font-weight:650;font-size:.9rem}
.empty{color:var(--muted);font-size:.9rem;padding:20px 0}
.note{font-size:.78rem;color:var(--muted);margin-top:10px}`;

  const js = [
    'var SHOP=' + json + ';',
    'var cart=[];try{cart=JSON.parse(localStorage.getItem("cart:"+SHOP.name))||[]}catch(e){}',
    'function kr(n){return n.toLocaleString("da-DK")+" kr."}',
    'function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]})}',
    'function find(id){for(var i=0;i<SHOP.products.length;i++){if(SHOP.products[i].id===id)return SHOP.products[i]}return null}',
    'function media(p,big){return p.image?"<img src=\\""+p.image+"\\" alt=\\""+esc(p.name)+"\\">":(big?"<span style=\\"font-size:5rem\\">"+p.emoji+"</span>":p.emoji)}',
    'function renderGrid(){var g=document.getElementById("grid");if(!SHOP.products.length){g.innerHTML="<p class=\\"empty\\">Ingen produkter endnu.</p>";return}',
    'g.innerHTML=SHOP.products.map(function(p){return "<button class=\\"card\\" onclick=\\"openProduct(\'"+p.id+"\')\\">"+',
    '"<span class=\\"ph\\">"+media(p)+(p.badge?"<span class=\\"tag\\">"+p.badge+"</span>":"")+"</span>"+',
    '"<span class=\\"cb\\"><h3>"+esc(p.name)+"</h3>"+(p.audience?"<span class=\\"sub\\">"+esc(p.audience)+"</span>":"")+',
    '"<span class=\\"price\\"><b>"+kr(p.price)+"</b><s>"+kr(p.before)+"</s></span>"+',
    '"<span class=\\"buy\\">Se produktet</span></span></button>"}).join("")}',
    'var qty=1,current=null;',
    'function openProduct(id){current=find(id);qty=1;var p=current;',
    'var faq="<details><summary>Hvor lang er leveringstiden?</summary><p>Typisk 6–12 hverdage. Du får et sporingsnummer, når pakken er afsendt.</p></details>"+',
    '"<details><summary>Kan jeg fortryde?</summary><p>Ja — "+SHOP.returnDays+" dages returret fra du modtager pakken.</p></details>"+',
    '"<details><summary>Hvem står bag?</summary><p>"+esc(SHOP.name)+(SHOP.cvr?", CVR "+esc(SHOP.cvr):"")+(SHOP.email?", "+esc(SHOP.email):"")+"</p></details>";',
    'var offer=p.bundleQty?"<div class=\\"offer\\">Tag "+p.bundleQty+" stk. og spar "+p.bundleDiscount+" % på nr. 2 og frem.</div>":"";',
    'if(p.addonName)offer+="<div class=\\"offer\\">Tilføj "+esc(p.addonName)+" for "+kr(p.addonPrice)+" i kurven.</div>";',
    'document.getElementById("sheet").innerHTML="<button class=\\"x\\" onclick=\\"closeAll()\\">✕</button>"+',
    '"<div style=\\"border-radius:12px;overflow:hidden;background:#EFECE5;display:grid;place-items:center;aspect-ratio:1/1\\">"+media(p,1)+"</div>"+',
    '"<h2>"+esc(p.headline)+"</h2>"+',
    '"<div class=\\"price\\"><b>"+kr(p.price)+"</b><s>"+kr(p.before)+"</s></div>"+',
    '"<ul>"+p.bullets.map(function(b){return "<li>"+esc(b)+"</li>"}).join("")+"</ul>"+',
    '"<p style=\\"color:var(--muted);font-size:.92rem\\">"+esc(p.body)+"</p>"+offer+',
    '"<div class=\\"qty\\"><button onclick=\\"bump(-1)\\">–</button><b id=\\"q\\">1</b><button onclick=\\"bump(1)\\">+</button></div>"+',
    '"<button class=\\"buy\\" onclick=\\"addToCart()\\">Læg i kurv</button>"+faq;',
    'show("sheet")}',
    'function bump(n){qty=Math.max(1,qty+n);document.getElementById("q").textContent=qty}',
    'function addToCart(){var p=current,i;for(i=0;i<cart.length;i++){if(cart[i].id===p.id){cart[i].qty+=qty;saveCart();openCart();return}}',
    'cart.push({id:p.id,name:p.name,price:p.price,qty:qty});saveCart();openCart()}',
    'function saveCart(){try{localStorage.setItem("cart:"+SHOP.name,JSON.stringify(cart))}catch(e){}badge()}',
    'function badge(){var n=0;cart.forEach(function(i){n+=i.qty});document.getElementById("count").textContent=n}',
    'function lineTotal(i){var p=find(i.id)||{bundleQty:0,bundleDiscount:0};var full=i.price*i.qty;',
    'if(p.bundleQty&&i.qty>=p.bundleQty){var extra=i.qty-1;full=i.price+extra*i.price*(1-p.bundleDiscount/100)}return Math.round(full)}',
    'function cartTotals(){var sub=0;cart.forEach(function(i){sub+=lineTotal(i)});',
    'var ship=(SHOP.freeFrom&&sub>=SHOP.freeFrom)||sub===0?0:SHOP.ship;return{sub:sub,ship:ship,total:sub+ship}}',
    'function openCart(){var t=cartTotals();',
    'var rows=cart.length?cart.map(function(i,ix){return "<div class=\\"line\\"><span>"+esc(i.name)+" × "+i.qty+"</span><span>"+kr(lineTotal(i))+' +
      '" <button style=\\"border:0;background:transparent;color:var(--muted)\\" onclick=\\"drop("+ix+")\\">✕</button></span></div>"}).join(""):"<p class=\\"empty\\">Kurven er tom.</p>";',
    'document.getElementById("cart").innerHTML="<button class=\\"x\\" onclick=\\"closeAll()\\">✕</button><h2>Din kurv</h2>"+rows+',
    '(cart.length?"<div class=\\"line\\"><span>Fragt</span><span>"+(t.ship?kr(t.ship):"Gratis")+"</span></div>"+',
    '"<div class=\\"line\\"><b>I alt</b><b>"+kr(t.total)+"</b></div>"+',
    '"<button class=\\"buy\\" style=\\"margin-top:14px\\" onclick=\\"checkout()\\">Gå til betaling</button>"+',
    '(SHOP.freeFrom&&t.sub<SHOP.freeFrom?"<p class=\\"note\\">Køb for "+kr(SHOP.freeFrom-t.sub)+" mere og få fri fragt.</p>":"")+',
    '"<p class=\\"note\\">"+SHOP.returnDays+" dages returret. Priser inkl. moms.</p>":"");',
    'show("cart")}',
    'function drop(ix){cart.splice(ix,1);saveCart();openCart()}',
    'function checkout(){if(!cart.length)return;var p=cart.length===1?find(cart[0].id):null;',
    'var link=(p&&p.payLink)||SHOP.checkoutUrl;',
    'if(link){window.open(link,"_blank","noopener");return}',
    'var lines=cart.map(function(i){return i.qty+" × "+i.name+" — "+kr(lineTotal(i))}).join("\\n");',
    'var t=cartTotals();',
    'if(SHOP.email){location.href="mailto:"+SHOP.email+"?subject="+encodeURIComponent("Bestilling fra "+SHOP.name)+"&body="+encodeURIComponent(lines+"\\nFragt: "+kr(t.ship)+"\\nI alt: "+kr(t.total)+"\\n\\nNavn:\\nAdresse:\\nTelefon:");return}',
    'alert("Der mangler et betalingslink. Sæt det ind i Medvind under Opsætning, og eksportér butikken igen.")}',
    'function show(id){document.getElementById("scrim").classList.add("on");document.getElementById(id).classList.add("on")}',
    'function closeAll(){document.getElementById("scrim").classList.remove("on");document.getElementById("sheet").classList.remove("on");document.getElementById("cart").classList.remove("on")}',
    'document.addEventListener("keydown",function(e){if(e.key==="Escape")closeAll()});',
    'renderGrid();badge();'
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.name)}${d.tagline ? ' — ' + esc(d.tagline.slice(0, 60)) : ''}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(d.name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='${encodeURIComponent(d.brand)}'/></svg>">
<style>${css}</style>
</head>
<body>
<header><div class="wrap hrow">
  <a class="logo" href="#">${esc(d.name)}</a>
  <button class="cartbtn" onclick="openCart()">Kurv <b id="count">0</b></button>
</div></header>

<main class="wrap">
  <section class="hero">
    <h1>${esc(d.tagline || d.name)}</h1>
    <p>Udvalgte produkter, sendt med sporing. ${d.returnDays} dages returret og dansk kundeservice.</p>
    <div class="trust">
      <span>${d.freeFrom ? 'Fri fragt over ' + fmt(d.freeFrom) + ' kr.' : 'Fast lav fragt'}</span>
      <span>${d.returnDays} dages returret</span>
      <span>Sporing på alle pakker</span>
      ${d.email ? `<span>Svar inden for 24 timer</span>` : ''}
    </div>
  </section>

  <div class="grid" id="grid"></div>

  <section class="info">
    <div><h4>Fragt</h4><p>${d.freeFrom ? 'Fri fragt ved køb over ' + fmt(d.freeFrom) + ' kr., ellers ' + fmt(d.ship) + ' kr.' : fmt(d.ship) + ' kr. i fragt.'} Levering typisk 6–12 hverdage med sporing.</p></div>
    <div><h4>Retur</h4><p>${d.returnDays} dages returret fra du modtager pakken. Skriv til os, så aftaler vi returneringen.</p></div>
    <div><h4>Kontakt</h4><p>${d.email ? esc(d.email) : 'Skriv til os via siden.'}${d.cvr ? '<br>CVR ' + esc(d.cvr) : ''}</p></div>
  </section>
</main>

<footer class="wrap">
  © ${new Date().getFullYear()} ${esc(d.name)}${d.cvr ? ' · CVR ' + esc(d.cvr) : ''}${d.domain ? ' · ' + esc(d.domain) : ''}<br>
  Priser er inkl. moms. Handelsbetingelser og persondatapolitik skal tilpasses, før butikken sættes i luften.
</footer>

<div class="scrim" id="scrim" onclick="closeAll()"></div>
<div class="panel" id="sheet"></div>
<div class="panel" id="cart"></div>

<script>
${js}
</script>
</body>
</html>`;
}

function renderExportCard(){
  const el = $('#exportCard');
  if(!el) return;
  const d = shopData();
  const missing = [];
  if(!d.products.length) missing.push('Ingen produkter valgt — sæt mindst ét i test eller vinder.');
  if(!d.checkoutUrl && !d.email) missing.push('Hverken betalingslink eller e-mail — så kan kunden ikke bestille.');
  if(!d.products.some(p => p.image)) missing.push('Ingen produktbilleder endnu — lav dem under Billeder.');

  el.innerHTML = `
    <span class="eyebrow">Eksport</span>
    <h3 style="margin:5px 0 8px">Hent butikken som rigtig hjemmeside</h3>
    <p class="hint" style="margin-bottom:10px">Én HTML-fil med forside, produktsider, kurv, fragtregler og betaling. Ingen abonnement, ingen platform.</p>
    <div class="stat-line"><span>Produkter med</span><b>${d.products.length}</b></div>
    <div class="stat-line"><span>Betaling</span><b>${d.checkoutUrl ? 'betalingslink' : d.email ? 'bestilling på mail' : 'mangler'}</b></div>
    <div class="stat-line"><span>Fragt</span><b>${d.freeFrom ? 'fri over ' + kr(d.freeFrom) : kr(d.ship)}</b></div>
    ${missing.length ? `<div class="note" style="margin-top:12px">${missing.map(m => '• ' + m).join('<br>')}</div>` : ''}
    <div class="btn-row" style="margin-top:12px">
      <button class="btn primary" id="dlShop">Hent butik.html</button>
      <button class="btn" id="previewShop">Åbn forhåndsvisning</button>
    </div>
    <div class="divider"></div>
    <span class="eyebrow">Sådan kommer den online</span>
    <p class="hint" style="margin-top:6px">1. Hent filen. 2. Træk den ind på <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer">netlify.com/drop</a> — så er den online på et minut, gratis.
    3. Køb et .dk-domæne (ca. 50 kr./år) og peg det derhen. 4. Lav et betalingslink i Stripe eller MobilePay og sæt det ind under Opsætning.</p>
    <p class="hint" style="margin-top:8px">Den her butik tager imod ordrer — den holder ikke styr på lager, sender ikke ordrebekræftelser og afregner ikke moms. Vokser det, flytter du til Shopify eller Shoporama med teksterne og billederne i hånden.</p>`;
}

document.addEventListener('click', e => {
  if(e.target.id === 'dlShop'){
    const blob = new Blob([buildShopHtml()], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'butik.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('butik.html er hentet');
  }
  if(e.target.id === 'previewShop'){
    const w = window.open('', '_blank');
    if(!w) return toast('Browseren blokerede vinduet');
    w.document.write(buildShopHtml());
    w.document.close();
  }
});
