/* Billedværksted — beskær, rens baggrunden og skriv pris på, direkte i browseren.
   Billederne forlader aldrig maskinen; kun det, du sætter som produktbillede, gemmes. */

const FORMATS = [
  {key:'1x1',  label:'Kvadratisk',  w:1080, h:1080, use:'produktbillede'},
  {key:'4x5',  label:'Feed',        w:1080, h:1350, use:'Instagram & Facebook'},
  {key:'9x16', label:'Story',       w:1080, h:1920, use:'TikTok & Reels'},
  {key:'16x9', label:'Banner',      w:1600, h:900,  use:'forside & mail'}
];

const BACKGROUNDS = [
  {key:'white',   label:'Hvid'},
  {key:'soft',    label:'Lys sand'},
  {key:'brand',   label:'Brandfarve'},
  {key:'fade',    label:'Blød tone'},
  {key:'dark',    label:'Mørk'},
  {key:'none',    label:'Billedet fylder alt'}
];

const shots = [];               // {name, img}
let shotIdx = -1;

const IMGSET = {
  format:'1x1', zoom:1, ox:0.5, oy:0.5,
  bg:'white', pad:6, radius:0,
  badge:'', price:'', store:'', productId:''
};

const slug = s => String(s || 'billede').toLowerCase()
  .replace(/[æ]/g,'ae').replace(/[ø]/g,'oe').replace(/[å]/g,'aa')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'billede';

function fmtDef(){ return FORMATS.find(f => f.key === IMGSET.format) || FORMATS[0]; }

function bgFill(ctx, W, H){
  const brand = state.settings.brandColor || '#0B7A5D';
  if(IMGSET.bg === 'white'){ ctx.fillStyle = '#FFFFFF'; }
  else if(IMGSET.bg === 'soft'){ ctx.fillStyle = '#F2EFE8'; }
  else if(IMGSET.bg === 'dark'){ ctx.fillStyle = '#14181C'; }
  else if(IMGSET.bg === 'brand'){ ctx.fillStyle = brand; }
  else if(IMGSET.bg === 'fade'){
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, brand + '33');
    g.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = g;
  }
  else { ctx.fillStyle = '#FFFFFF'; }
  ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx, x, y, w, h, r){
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
  else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}

function pill(ctx, text, x, y, size, bg, fg, align){
  if(!text) return;
  ctx.font = `700 ${size}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const padX = size * 0.62, padY = size * 0.42;
  const w = ctx.measureText(text).width + padX * 2;
  const h = size + padY * 2;
  const px = align === 'right' ? x - w : x;
  ctx.fillStyle = bg;
  roundRect(ctx, px, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, px + padX, y + h / 2 + size * 0.03);
  return h;
}

function paint(canvas, W, H){
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  bgFill(ctx, W, H);

  const shot = shots[shotIdx];
  const S = Math.min(W, H);
  const pad = IMGSET.bg === 'none' ? 0 : S * IMGSET.pad / 100;
  const inX = pad, inY = pad, inW = W - pad * 2, inH = H - pad * 2;

  if(shot){
    const iw = shot.img.naturalWidth, ih = shot.img.naturalHeight;
    const scale = Math.max(inW / iw, inH / ih) * IMGSET.zoom;
    const dw = iw * scale, dh = ih * scale;
    const dx = inX + (inW - dw) * IMGSET.ox;
    const dy = inY + (inH - dh) * IMGSET.oy;
    ctx.save();
    roundRect(ctx, inX, inY, inW, inH, S * IMGSET.radius / 100);
    ctx.clip();
    ctx.drawImage(shot.img, dx, dy, dw, dh);
    ctx.restore();
  }else{
    ctx.fillStyle = 'rgba(110,118,129,.5)';
    ctx.font = `600 ${S * 0.045}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Slip et billede for at komme i gang', W / 2, H / 2);
  }

  const brand = state.settings.brandColor || '#0B7A5D';
  const light = IMGSET.bg === 'dark' || IMGSET.bg === 'brand';
  const m = S * 0.055;

  if(IMGSET.badge) pill(ctx, IMGSET.badge.toUpperCase(), m, m, S * 0.038, brand, '#FFFFFF', 'left');
  if(IMGSET.price){
    const size = S * 0.05;
    pill(ctx, IMGSET.price, m, H - m - (size * 1.84), size, '#FFFFFF', '#14181C', 'left');
  }
  if(IMGSET.store){
    ctx.font = `600 ${S * 0.03}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillStyle = light ? 'rgba(255,255,255,.85)' : 'rgba(20,24,28,.6)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(IMGSET.store, W - m, H - m);
  }
  return canvas;
}

function renderImages(){
  const chips = $('#formatChips');
  if(!chips) return;

  chips.innerHTML = FORMATS.map(f =>
    `<button class="chip" data-format="${f.key}" aria-pressed="${IMGSET.format === f.key}">${f.label} · ${f.use}</button>`).join('');
  $('#bgChips').innerHTML = BACKGROUNDS.map(b =>
    `<button class="chip" data-bg="${b.key}" aria-pressed="${IMGSET.bg === b.key}">${b.label}</button>`).join('');

  const sel = $('#imgProduct');
  const keep = IMGSET.productId;
  sel.innerHTML = `<option value="">— uden produkt —</option>` +
    state.products.map(p => `<option value="${p.id}">${esc(p.name || 'Uden navn')}</option>`).join('');
  sel.value = keep;

  $('#filmstrip').innerHTML = shots.map((s, i) =>
    `<button class="film" data-shot="${i}" aria-pressed="${i === shotIdx}" title="${esc(s.name)}">
       <img src="${s.img.src}" alt=""><b data-drop="${i}">×</b>
     </button>`).join('');

  const f = fmtDef();
  $('#canvasTitle').textContent = `${f.label} · ${f.w} × ${f.h}`;
  paint($('#imgCanvas'), f.w, f.h);
}

/* ---------------- indlæsning ---------------- */

function addFiles(files){
  const list = [...files].filter(f => f.type.startsWith('image/'));
  if(!list.length) return toast('Det var ikke et billede');
  let pending = list.length;
  list.forEach(file => {
    const img = new Image();
    img.onload = () => {
      shots.push({name:file.name, img});
      shotIdx = shots.length - 1;
      if(--pending === 0){ renderImages(); toast(list.length + ' billede' + (list.length === 1 ? '' : 'r') + ' klar'); }
    };
    img.onerror = () => { if(--pending === 0) renderImages(); };
    img.src = URL.createObjectURL(file);
  });
}

function downloadCanvas(canvas, name){
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

function currentName(){
  const p = state.products.find(x => x.id === IMGSET.productId);
  return slug(p ? p.name : (shots[shotIdx]?.name || 'billede'));
}

/* ---------------- hændelser ---------------- */

document.addEventListener('DOMContentLoaded', () => {
  const zone = $('#dropZone'), canvas = $('#imgCanvas');
  if(!zone) return;

  IMGSET.store = state.settings.storeName || '';
  $('#imgStore').value = IMGSET.store;

  ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.add('hot');
  }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.remove('hot');
  }));
  zone.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  zone.addEventListener('click', () => $('#imgFile').click());
  $('#imgPick').addEventListener('click', () => $('#imgFile').click());
  $('#imgFile').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });

  window.addEventListener('paste', e => {
    if(!$('#view-images').classList.contains('active')) return;
    const files = [...(e.clipboardData?.items || [])]
      .filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
    if(files.length) addFiles(files);
  });

  // træk for at flytte billedet
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', e => {
    if(shotIdx < 0) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', e => {
    if(!dragging) return;
    const box = canvas.getBoundingClientRect();
    IMGSET.ox = clamp(IMGSET.ox - (e.clientX - lastX) / box.width * 1.4, 0, 1);
    IMGSET.oy = clamp(IMGSET.oy - (e.clientY - lastY) / box.height * 1.4, 0, 1);
    lastX = e.clientX; lastY = e.clientY;
    const f = fmtDef();
    paint(canvas, f.w, f.h);
  });
  ['pointerup','pointercancel'].forEach(ev => canvas.addEventListener(ev, () => {
    dragging = false; canvas.classList.remove('drag');
  }));

  $('#imgDownload').addEventListener('click', () => {
    if(shotIdx < 0) return toast('Sæt et billede ind først');
    const f = fmtDef();
    downloadCanvas(paint(document.createElement('canvas'), f.w, f.h), `${currentName()}-${f.key}.png`);
  });

  $('#imgDownloadAll').addEventListener('click', () => {
    if(shotIdx < 0) return toast('Sæt et billede ind først');
    FORMATS.forEach((f, i) => setTimeout(() => {
      downloadCanvas(paint(document.createElement('canvas'), f.w, f.h), `${currentName()}-${f.key}.png`);
    }, i * 350));
    toast('Henter fire formater');
  });

  $('#imgSetProduct').addEventListener('click', () => {
    if(shotIdx < 0) return toast('Sæt et billede ind først');
    const p = state.products.find(x => x.id === IMGSET.productId);
    if(!p) return toast('Vælg hvilket produkt billedet hører til');
    const c = paint(document.createElement('canvas'), 1080, 1080);
    const small = document.createElement('canvas');
    small.width = 640; small.height = 640;
    small.getContext('2d').drawImage(c, 0, 0, 640, 640);
    p.image = small.toDataURL('image/jpeg', 0.82);
    save();
    render();
    toast('Sat som produktbillede — det vises nu i butikken');
  });
});

document.addEventListener('click', e => {
  const f = e.target.closest('[data-format]');
  if(f){ IMGSET.format = f.dataset.format; renderImages(); return; }

  const b = e.target.closest('[data-bg]');
  if(b){ IMGSET.bg = b.dataset.bg; renderImages(); return; }

  const drop = e.target.closest('[data-drop]');
  if(drop){
    e.stopPropagation();
    shots.splice(+drop.dataset.drop, 1);
    shotIdx = Math.min(shotIdx, shots.length - 1);
    renderImages();
    return;
  }

  const s = e.target.closest('[data-shot]');
  if(s){ shotIdx = +s.dataset.shot; IMGSET.ox = 0.5; IMGSET.oy = 0.5; renderImages(); }
});

document.addEventListener('input', e => {
  const id = e.target.id;
  if(id === 'imgZoom'){ IMGSET.zoom = num(e.target.value) / 100; }
  else if(id === 'imgPad'){ IMGSET.pad = num(e.target.value); }
  else if(id === 'imgRadius'){ IMGSET.radius = num(e.target.value) / 10; }
  else if(id === 'imgBadge'){ IMGSET.badge = e.target.value; }
  else if(id === 'imgPrice'){ IMGSET.price = e.target.value; }
  else if(id === 'imgStore'){ IMGSET.store = e.target.value; }
  else return;
  const f = fmtDef();
  paint($('#imgCanvas'), f.w, f.h);
});

document.addEventListener('change', e => {
  if(e.target.id !== 'imgProduct') return;
  IMGSET.productId = e.target.value;
  const p = state.products.find(x => x.id === IMGSET.productId);
  if(p){
    IMGSET.price = fmt(num(p.price)) + ' kr.';
    $('#imgPrice').value = IMGSET.price;
  }
  const f = fmtDef();
  paint($('#imgCanvas'), f.w, f.h);
});
