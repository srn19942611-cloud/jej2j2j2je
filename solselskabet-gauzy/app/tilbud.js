// Tilbudsvisning: tegning af anlægget på taget, produktion og fordeling af forbrug.
import { FORUDSAETNINGER as F, anlaegFor, layout, beregn } from './anlaeg.js';

const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tal = (v, d = 0) => Number(v).toLocaleString('da-DK', { maximumFractionDigits: d, minimumFractionDigits: d });
const mwh = (kwh) => tal(kwh / 1000, kwh < 100000 ? 1 : 0);
const pct = (v) => tal(v * 100) + ' %';

export function tegnTilbud(container, nr, { projektNavn } = {}) {
	const a = anlaegFor(nr);
	if (!a) {
		container.innerHTML = `<div class="tom">Der er ikke lagt anlægsdata ind for denne lokation endnu.<br><span class="svag">Tilføj den i app/anlaeg.js</span></div>`;
		return;
	}
	const lay = layout(a);
	const r = beregn(a);
	const t = r.total;
	const navn = projektNavn || `Lokation ${a.nr}`;

	container.innerHTML = `
		<section class="tilbud-hero">
			<img src="logo.svg" alt="Solselskabet" class="tilbud-logo">
			<div class="tilbud-titel">Solcelleanlæg</div>
			<h1>${esc(navn)}</h1>
			<div class="svag">${tal(a.kwp)} kWp · ${tal(lay.placeret)} moduler · ${esc(a.tag.type)}, ${tal(a.tag.haeldning)}° hældning</div>
			<div class="eksempel">Eksempel – tal og tag er illustrative, indtil PVSOL-rapport og målerdata er lagt ind</div>
		</section>

		<div class="noegletal">
			${tile('Årsproduktion', mwh(t.produktion), 'MWh')}
			${tile('Dækker af butikkens forbrug', pct(t.daekning), '', 'sol')}
			${tile('Bruges i butikken selv', pct(t.egetforbrugsandel), '')}
			${tile('Værdi pr. år (vejledende)', tal(Math.round(t.vaerdi / 1000)), 't. kr.')}
		</div>

		<h2>Anlægget på taget</h2>
		<div class="kort">
			${tagSvg(a, lay)}
			<div class="forklaring">
				<span><i class="fk modul"></i>Solcellemodul (${tal(F.modul.wp)} Wp)</span>
				<span><i class="fk felt"></i>Brandfelt (maks. ${F.feltMaks} × ${F.feltMaks} m)</span>
				<span><i class="fk fri"></i>Fri zone ${tal(F.kantafstand, 1)} m</span>
				<span><i class="fk hindring"></i>Ventilation/ovenlys</span>
			</div>
			<table class="fakta">
				<tr><td>Tag</td><td>${tal(a.tag.bredde)} × ${tal(a.tag.dybde)} m, ${esc(a.tag.type)}</td></tr>
				<tr><td>Felter</td><td>${lay.felter.map((f) => `${f.navn}: ${tal(f.b)} × ${tal(f.d)} m (${f.moduler} moduler)`).join('<br>')}</td></tr>
				<tr><td>Afstand mellem felter</td><td>${lay.felter.length > 1 ? `${F.feltAfstand} m` : 'Ét felt'}</td></tr>
				<tr><td>Inverter</td><td>${esc(a.inverter)}</td></tr>
				<tr><td>Installeret effekt</td><td>${tal(lay.kwpPlaceret, 1)} kWp</td></tr>
			</table>
		</div>

		<h2>Produktion måned for måned</h2>
		<div class="kort graf" id="g-prod"></div>

		<h2>Hvor kommer butikkens strøm fra?</h2>
		<div class="kort">
			<div class="donut-raekke">
				${donut(t.egetforbrug, t.fraNet)}
				<div>
					<div class="serie"><i style="background:var(--sol-serie)"></i><b>${pct(t.daekning)}</b> fra solcellerne<br><span class="svag">${mwh(t.egetforbrug)} MWh om året</span></div>
					<div class="serie"><i style="background:var(--net-serie)"></i><b>${pct(1 - t.daekning)}</b> fra nettet<br><span class="svag">${mwh(t.fraNet)} MWh om året</span></div>
					<div class="serie svag">Overskud solgt til nettet: ${mwh(t.tilNet)} MWh</div>
				</div>
			</div>
			<div class="graf" id="g-fordeling"></div>
		</div>

		<h2>En typisk dag</h2>
		<div class="kort">
			<div class="chips" role="group" aria-label="Vælg måned">
				${[0, 3, 5, 8, 11].map((m) => `<button class="chip" data-mdr="${m}" aria-pressed="${m === 5}">${MDR[m]}</button>`).join('')}
			</div>
			<div class="graf" id="g-doegn"></div>
		</div>

		<h2>Tabel</h2>
		<details class="kort"><summary>Vis alle tal pr. måned</summary>${tabel(r)}</details>

		<p class="svag forudsaetninger">Forudsætninger: ${tal(F.specifiktUdbytte)} kWh/kWp/år, typisk dansk solprofil og supermarkedsprofil (køl/frost døgnet rundt, åbent 7–22).
		Værdi: sparet indkøb ${tal(F.elpris, 2)} kr./kWh og salg af overskud ${tal(F.salgspris, 2)} kr./kWh. Årsforbrug: ${mwh(a.aarsforbrug)} MWh.</p>`;

	tegnProduktion(container.querySelector('#g-prod'), r);
	tegnFordeling(container.querySelector('#g-fordeling'), r);
	const doegn = container.querySelector('#g-doegn');
	tegnDoegn(doegn, r, 5);
	container.querySelectorAll('[data-mdr]').forEach((b) => (b.onclick = () => {
		container.querySelectorAll('[data-mdr]').forEach((x) => x.setAttribute('aria-pressed', x === b));
		tegnDoegn(doegn, r, +b.dataset.mdr);
	}));
}

const tile = (label, v, enhed, cls = '') => `<div class="tile ${cls}"><div class="tile-v">${v}<small>${enhed ? ' ' + enhed : ''}</small></div><div class="tile-l">${label}</div></div>`;

// ---------- Tegning af taget -----------------------------------------------------
function tagSvg(a, lay) {
	const { bredde: W, dybde: D } = a.tag;
	const pad = 6;
	const vb = `${-pad} ${-pad} ${W + pad * 2} ${D + pad * 2 + 4}`;
	const k = F.kantafstand;
	const skala = W > 60 ? 20 : 10;
	return `<svg class="tag-svg" viewBox="${vb}" role="img" aria-label="Tegning af tag ${W} × ${D} m med ${lay.placeret} solcellemoduler i ${lay.felter.length} brandfelter">
		<defs>
			<linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3f63"/><stop offset="1" stop-color="#16243d"/></linearGradient>
			<pattern id="fri" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" class="tag-flade"/><line x1="0" y1="0" x2="0" y2="1.2" class="fri-streg"/></pattern>
		</defs>
		<rect x="0" y="0" width="${W}" height="${D}" fill="url(#fri)" class="tag-kant" rx="0.4"/>
		<rect x="${k}" y="${k}" width="${W - 2 * k}" height="${D - 2 * k}" class="tag-flade"/>
		${lay.felter.map((f) => `<rect x="${f.x}" y="${f.y}" width="${f.b}" height="${f.d}" class="felt"/><text x="${f.x + 0.8}" y="${f.y - 0.6}" class="felt-navn">Felt ${f.navn}</text>`).join('')}
		${lay.moduler.map((m) => `<rect x="${m.x.toFixed(2)}" y="${m.y.toFixed(2)}" width="${m.b}" height="${m.d}" fill="url(#mg)" class="modul"/>`).join('')}
		${a.forhindringer.map((o) => `<rect x="${o.x}" y="${o.y}" width="${o.b}" height="${o.d}" class="hindring" rx="0.3"><title>${esc(o.navn)}</title></rect><text x="${o.x + o.b / 2}" y="${o.y + o.d / 2 + 0.5}" class="hindring-navn">${esc(o.navn)}</text>`).join('')}
		<g class="maal">
			<line x1="0" y1="${D + 2}" x2="${W}" y2="${D + 2}"/><line x1="0" y1="${D + 1}" x2="0" y2="${D + 3}"/><line x1="${W}" y1="${D + 1}" x2="${W}" y2="${D + 3}"/>
			<text x="${W / 2}" y="${D + 4.6}">${W} m</text>
			<line x1="${-2}" y1="0" x2="${-2}" y2="${D}"/><text x="${-3.2}" y="${D / 2}" transform="rotate(-90 ${-3.2} ${D / 2})">${D} m</text>
		</g>
		<g class="nord" transform="translate(${W + 2.5},${-1})"><path d="M0,-3 L1.4,1.5 L0,0.6 L-1.4,1.5 Z"/><text y="4">N</text></g>
		<g class="maal" transform="translate(${W - skala},${-3})"><line x1="0" y1="0" x2="${skala}" y2="0"/><line x1="0" y1="-0.8" x2="0" y2="0.8"/><line x1="${skala}" y1="-0.8" x2="${skala}" y2="0.8"/><text x="${skala / 2}" y="-1.2">${skala} m</text></g>
	</svg>`;
}

// ---------- Grafer (SVG, med hover/tryk) -------------------------------------------
const G = { w: 640, h: 240, l: 44, r: 12, t: 14, b: 28 };

function akser(maks, enhed, n = 4) {
	const trin = pænTrin(maks / n);
	const top = Math.ceil(maks / trin) * trin;
	const y = (v) => G.t + (G.h - G.t - G.b) * (1 - v / top);
	let s = '';
	for (let v = 0; v <= top + 1e-9; v += trin) s += `<line class="gitter" x1="${G.l}" x2="${G.w - G.r}" y1="${y(v)}" y2="${y(v)}"/><text class="akse" x="${G.l - 6}" y="${y(v) + 4}" text-anchor="end">${tal(v)}</text>`;
	s += `<text class="akse" x="${G.l - 6}" y="${G.t - 4}" text-anchor="end">${enhed}</text>`;
	return { y, top, s };
}
function pænTrin(r) {
	const p = Math.pow(10, Math.floor(Math.log10(r)));
	return [1, 2, 2.5, 5, 10].map((f) => f * p).find((v) => v >= r);
}
function bar(x, y0, y1, w, cls, rund = true) {
	const h = Math.max(0, y0 - y1);
	const r = rund ? Math.min(4, h, w / 2) : 0;
	return `<path class="${cls}" d="M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z"/>`;
}

function medTooltip(el, svg, tekster) {
	el.innerHTML = svg + '<div class="tip" hidden></div>';
	const tip = el.querySelector('.tip');
	el.querySelectorAll('[data-i]').forEach((z) => {
		const vis = (e) => {
			tip.innerHTML = tekster[z.dataset.i];
			tip.hidden = false;
			const r = el.getBoundingClientRect();
			const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
			tip.style.left = Math.min(Math.max(8, x - tip.offsetWidth / 2), r.width - tip.offsetWidth - 8) + 'px';
			el.querySelectorAll('.aktiv').forEach((a) => a.classList.remove('aktiv'));
			z.classList.add('aktiv');
		};
		z.addEventListener('pointerenter', vis);
		z.addEventListener('pointermove', vis);
		z.addEventListener('click', vis);
	});
	el.addEventListener('pointerleave', () => { tip.hidden = true; el.querySelectorAll('.aktiv').forEach((a) => a.classList.remove('aktiv')); });
}

function tegnProduktion(el, r) {
	const vals = r.maaneder.map((m) => m.produktion / 1000);
	const ax = akser(Math.max(...vals), 'MWh');
	const bw = (G.w - G.l - G.r) / 12;
	let s = `<svg viewBox="0 0 ${G.w} ${G.h}" class="graf-svg" role="img" aria-label="Solcelleproduktion pr. måned">${ax.s}`;
	vals.forEach((v, i) => {
		const x = G.l + i * bw;
		s += `<g data-i="${i}" class="zone"><rect x="${x}" y="${G.t}" width="${bw}" height="${G.h - G.t - G.b}" class="hit"/>${bar(x + bw * 0.22, ax.y(0), ax.y(v), bw * 0.56, 'sol-fyld')}<text class="akse" x="${x + bw / 2}" y="${G.h - 9}" text-anchor="middle">${MDR[i]}</text></g>`;
	});
	const top = vals.indexOf(Math.max(...vals));
	s += `<text class="direkte" x="${G.l + top * bw + bw / 2}" y="${ax.y(vals[top]) - 6}" text-anchor="middle">${tal(vals[top], 1)}</text></svg>`;
	medTooltip(el, s, vals.map((v, i) => `<b>${MDR[i]}</b><br>${tal(v, 1)} MWh produceret`));
}

function tegnFordeling(el, r) {
	const ms = r.maaneder;
	const ax = akser(Math.max(...ms.map((m) => m.forbrug / 1000)), 'MWh');
	const bw = (G.w - G.l - G.r) / 12;
	let s = `<svg viewBox="0 0 ${G.w} ${G.h}" class="graf-svg" role="img" aria-label="Butikkens forbrug pr. måned fordelt på solceller og net">${ax.s}`;
	ms.forEach((m, i) => {
		const x = G.l + i * bw + bw * 0.22, w = bw * 0.56;
		const ySol = ax.y(m.egetforbrug / 1000);
		s += `<g data-i="${i}" class="zone"><rect x="${G.l + i * bw}" y="${G.t}" width="${bw}" height="${G.h - G.t - G.b}" class="hit"/>
			${bar(x, ax.y(0), ySol, w, 'sol-fyld', false)}
			${bar(x, ySol - 2, ax.y(m.forbrug / 1000), w, 'net-fyld')}
			<text class="akse" x="${G.l + i * bw + bw / 2}" y="${G.h - 9}" text-anchor="middle">${MDR[i]}</text></g>`;
	});
	s += `</svg><div class="legende"><span><i style="background:var(--sol-serie)"></i>Fra solceller</span><span><i style="background:var(--net-serie)"></i>Fra nettet</span></div>`;
	medTooltip(el, s, ms.map((m, i) => `<b>${MDR[i]}</b><br><i class="p" style="background:var(--sol-serie)"></i>Sol: ${tal(m.egetforbrug / 1000, 1)} MWh (${pct(m.egetforbrug / m.forbrug)})<br><i class="p" style="background:var(--net-serie)"></i>Net: ${tal(m.fraNet / 1000, 1)} MWh`));
}

function tegnDoegn(el, r, mdr) {
	const { pv, last } = r.maaneder[mdr].doegn;
	const solrig = pv.map((v) => v * 1.72); // en solrig dag
	const ax = akser(Math.max(...last, ...solrig), 'kW');
	const x = (h) => G.l + ((G.w - G.l - G.r) * h) / 24;
	const linje = (arr) => arr.map((v, h) => `${h ? 'L' : 'M'}${x(h + 0.5).toFixed(1)},${ax.y(v).toFixed(1)}`).join(' ');
	const egen = solrig.map((v, h) => Math.min(v, last[h]));
	const flade = `M${x(0.5)},${ax.y(0)} ` + egen.map((v, h) => `L${x(h + 0.5).toFixed(1)},${ax.y(v).toFixed(1)}`).join(' ') + ` L${x(23.5)},${ax.y(0)} Z`;
	let s = `<svg viewBox="0 0 ${G.w} ${G.h}" class="graf-svg" role="img" aria-label="Forbrug og solproduktion en solrig dag i ${MDR[mdr]}">${ax.s}
		<path d="${flade}" class="sol-flade"/>
		<path d="${linje(solrig)}" class="sol-linje"/>
		<path d="${linje(last)}" class="net-linje"/>
		${[0, 6, 12, 18, 24].map((h) => `<text class="akse" x="${x(h)}" y="${G.h - 9}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`).join('')}
		<line class="kryds" x1="0" x2="0" y1="${G.t}" y2="${G.h - G.b}" hidden/>`;
	for (let h = 0; h < 24; h++) s += `<rect data-i="${h}" class="hit zone" x="${x(h)}" y="${G.t}" width="${x(1) - x(0)}" height="${G.h - G.t - G.b}"/>`;
	s += `</svg><div class="legende"><span><i style="background:var(--sol-serie)"></i>Solproduktion (solrig dag)</span><span><i style="background:var(--net-serie)"></i>Butikkens forbrug</span><span><i class="skravering"></i>Dækket af sol</span></div>`;
	medTooltip(el, s, pv.map((_, h) => `<b>kl. ${String(h).padStart(2, '0')}–${String(h + 1).padStart(2, '0')}</b><br>Sol: ${tal(solrig[h])} kW<br>Forbrug: ${tal(last[h])} kW<br>Fra nettet: ${tal(Math.max(0, last[h] - solrig[h]))} kW`));
	const kryds = el.querySelector('.kryds');
	el.querySelectorAll('[data-i]').forEach((z) => z.addEventListener('pointerenter', () => { const cx = x(+z.dataset.i + 0.5); kryds.setAttribute('x1', cx); kryds.setAttribute('x2', cx); kryds.removeAttribute('hidden'); }));
}

function donut(sol, net) {
	const R = 54, r = 34, total = sol + net;
	const vinkel = (sol / total) * Math.PI * 2;
	const p = (a, rad) => [80 + rad * Math.sin(a), 80 - rad * Math.cos(a)];
	const bue = (a0, a1, cls) => {
		const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
		const stor = a1 - a0 > Math.PI ? 1 : 0;
		return `<path class="${cls}" d="M${x0},${y0} A${R},${R} 0 ${stor} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${stor} 0 ${x3},${y3} Z"/>`;
	};
	const gap = 0.03;
	return `<svg viewBox="0 0 160 160" class="donut" role="img" aria-label="${pct(sol / total)} af forbruget fra solceller">
		${bue(gap, vinkel - gap, 'sol-fyld')}${bue(vinkel + gap, Math.PI * 2 - gap, 'net-fyld')}
		<text x="80" y="80" class="donut-v" text-anchor="middle">${pct(sol / total)}</text><text x="80" y="98" class="akse" text-anchor="middle">fra sol</text></svg>`;
}

function tabel(r) {
	return `<div class="tabel-wrap"><table class="tal-tabel"><thead><tr><th>Måned</th><th>Produktion</th><th>Forbrug</th><th>Fra sol</th><th>Fra net</th><th>Til net</th></tr></thead><tbody>
		${r.maaneder.map((m, i) => `<tr><td>${MDR[i]}</td><td>${tal(m.produktion / 1000, 1)}</td><td>${tal(m.forbrug / 1000, 1)}</td><td>${tal(m.egetforbrug / 1000, 1)}</td><td>${tal(m.fraNet / 1000, 1)}</td><td>${tal(m.tilNet / 1000, 1)}</td></tr>`).join('')}
		<tr class="sum"><td>År</td><td>${tal(r.total.produktion / 1000, 0)}</td><td>${tal(r.total.forbrug / 1000, 0)}</td><td>${tal(r.total.egetforbrug / 1000, 0)}</td><td>${tal(r.total.fraNet / 1000, 0)}</td><td>${tal(r.total.tilNet / 1000, 0)}</td></tr>
		</tbody></table><div class="svag">Alle tal i MWh</div></div>`;
}
