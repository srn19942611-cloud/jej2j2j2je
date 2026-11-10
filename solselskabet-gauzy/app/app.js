// Feltapp – mobil-app til håndværkere oven på Ever Gauzy.
// Taler med Gauzys REST-API via samme adresse (/api og /public proxies i nginx).
import { tjeklisteFor, erUdfyldt, mangler } from './tjeklister.js';

const API = '/api';
const MARKOER = '📋 Feltrapport (feltapp)';
const RAPPORT_OVERSKRIFT = 'Feltrapport fra mobil';
const $app = document.getElementById('app');

// ---------- Tilstand ---------------------------------------------------------
const gemt = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const hent = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

const state = {
	session: hent('feltapp.session'), // { token, tenantId, organizationId, orgNavn, navn, employeeId }
	filter: hent('feltapp.filter') || { visning: 'aktive', mine: false, soeg: '' },
	statusser: [],
	opgaver: []
};

// ---------- Hjælpere ---------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dato = (d) => (d ? new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const tid = (d) => new Date(d).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const relativ = (url) => { try { const u = new URL(url, location.href); return u.pathname + u.search; } catch { return url; } };

let beskedTimer;
function besked(tekst, type = '') {
	const el = document.getElementById('besked');
	el.textContent = tekst;
	el.className = 'besked ' + type;
	el.hidden = false;
	clearTimeout(beskedTimer);
	beskedTimer = setTimeout(() => (el.hidden = true), type === 'fejl' ? 5000 : 2500);
}

function topbar(titel, under = '', { tilbage = null, menu = false } = {}) {
	document.getElementById('top-titel').textContent = titel;
	document.getElementById('top-under').textContent = under;
	const tb = document.getElementById('tilbage');
	tb.hidden = !tilbage;
	tb.onclick = tilbage;
	const m = document.getElementById('menu');
	m.hidden = !menu;
	m.onclick = visMenu;
	document.title = titel + ' – Feltapp';
}

async function api(method, path, body, { raw = false } = {}) {
	const s = state.session;
	const headers = {};
	if (s?.token) headers.Authorization = 'Bearer ' + s.token;
	if (s?.tenantId) headers['Tenant-Id'] = s.tenantId;
	if (s?.organizationId) headers['Organization-Id'] = s.organizationId;
	if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
	let res;
	try {
		res = await fetch(API + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
	} catch {
		throw new Error('Ingen forbindelse til serveren. Tjek netværket og prøv igen.');
	}
	if (res.status === 401 && s?.token) {
		logUd();
		throw new Error('Du er blevet logget ud. Log ind igen.');
	}
	const tekst = await res.text();
	let data;
	try { data = JSON.parse(tekst); } catch { data = tekst; }
	if (!res.ok) {
		const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || res.statusText;
		throw new Error(res.status === 429 ? 'For mange forsøg. Vent et minut og prøv igen.' : msg);
	}
	return raw ? res : data;
}
const scope = () => ({ tenantId: state.session.tenantId, organizationId: state.session.organizationId });
const qs = (o) => new URLSearchParams(o).toString();

// ---------- Login ------------------------------------------------------------
function visLogin(fejl = '') {
	topbar('Feltapp', 'Coop × Solselskabet');
	$app.innerHTML = `
		<div class="logo">☀️</div>
		<h1 style="text-align:center">Log ind</h1>
		<p class="svag" style="text-align:center;margin-top:0">Brug det samme login som i Gauzy</p>
		<form id="login" class="kort" autocomplete="on">
			<label class="felt" for="email">E-mail</label>
			<input id="email" type="email" inputmode="email" autocomplete="username" required value="${esc(hent('feltapp.email') || '')}">
			<div style="height:12px"></div>
			<label class="felt" for="pw">Adgangskode</label>
			<input id="pw" type="password" autocomplete="current-password" required>
			${fejl ? `<p class="krav">${esc(fejl)}</p>` : ''}
			<div style="height:16px"></div>
			<button class="knap" type="submit">Log ind</button>
		</form>`;
	document.getElementById('login').onsubmit = async (e) => {
		e.preventDefault();
		const email = document.getElementById('email').value.trim();
		const password = document.getElementById('pw').value;
		const knap = e.target.querySelector('button');
		knap.disabled = true;
		knap.textContent = 'Logger ind …';
		try {
			const r = await api('POST', '/auth/login', { email, password });
			if (!r?.token) throw new Error('Forkert e-mail eller adgangskode.');
			gemt('feltapp.email', email);
			state.session = { token: r.token, tenantId: r.user.tenantId, userId: r.user.id, navn: r.user.name || [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || email, employeeId: r.user.employee?.id || r.user.employeeId || null };
			await vaelgOrganisation();
		} catch (err) {
			visLogin(err.message.includes('Unauthorized') ? 'Forkert e-mail eller adgangskode.' : err.message);
		}
	};
}

async function vaelgOrganisation(tving = false) {
	const r = await api('GET', '/user-organization?' + qs({ 'relations[]': 'organization', 'where[userId]': state.session.userId, 'where[tenantId]': state.session.tenantId }));
	const orgs = [];
	for (const m of r.items || []) if (m.organization && !orgs.some((o) => o.id === m.organization.id)) orgs.push(m.organization);
	if (!orgs.length) throw new Error('Din bruger er ikke knyttet til nogen organisation.');
	const foretrukken = orgs.find((o) => /solselskab/i.test(o.name));
	if (!tving && (orgs.length === 1 || foretrukken)) return saetOrg(foretrukken || orgs[0]);

	topbar('Vælg organisation', state.session.navn, { tilbage: state.session.organizationId ? visListe : null });
	$app.innerHTML = `<div class="kort menu-liste">${orgs.map((o) => `<button data-id="${o.id}">${esc(o.name)}</button>`).join('')}</div>`;
	$app.querySelectorAll('button[data-id]').forEach((b) => (b.onclick = () => saetOrg(orgs.find((o) => o.id === b.dataset.id))));
}

async function saetOrg(org) {
	state.session.organizationId = org.id;
	state.session.orgNavn = org.name;
	// Find medarbejder-id for "Mine opgaver"
	try {
		const me = await api('GET', '/user/me?' + qs({ 'relations[]': 'employee' }));
		state.session.employeeId = me?.employee?.id || state.session.employeeId || null;
		state.session.navn = me?.name || state.session.navn;
	} catch {}
	gemt('feltapp.session', state.session);
	state.statusser = [];
	await visListe();
}

function logUd() {
	state.session = null;
	gemt('feltapp.session', undefined);
	visLogin();
}

function visMenu() {
	topbar('Menu', state.session?.navn || '', { tilbage: visListe });
	$app.innerHTML = `
		<div class="kort menu-liste">
			<button id="m-opd">↻ Opdater opgaver</button>
			<button id="m-org">🏢 Skift organisation (${esc(state.session?.orgNavn || '')})</button>
			<button id="m-ud">⎋ Log ud</button>
		</div>
		<p class="svag" style="padding:0 6px">Tip: Tilføj appen til hjemmeskærmen via browserens menu ("Føj til startskærm"), så åbner den som en app.</p>`;
	document.getElementById('m-opd').onclick = () => visListe(true);
	document.getElementById('m-org').onclick = () => vaelgOrganisation(true).catch((e) => besked(e.message, 'fejl'));
	document.getElementById('m-ud').onclick = logUd;
}

// ---------- Data -------------------------------------------------------------
async function hentStatusser() {
	if (state.statusser.length) return state.statusser;
	const r = await api('GET', '/task-statuses?' + qs(scope()));
	state.statusser = (r.items || []).filter((s) => !s.projectId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	return state.statusser;
}

async function hentOpgaver() {
	const alle = [];
	// Gauzy: `skip` er sidenummeret (1, 2, …), `take` er sidestørrelsen (maks. 100)
	for (let side = 1; side < 50; side++) {
		const p = new URLSearchParams({ 'where[organizationId]': state.session.organizationId, 'where[tenantId]': state.session.tenantId, take: 100, skip: side });
		['project', 'taskStatus', 'members', 'members.user', 'tags'].forEach((r) => p.append('relations[]', r));
		const r = await api('GET', '/tasks/pagination?' + p);
		alle.push(...(r.items || []));
		if (alle.length >= (r.total || 0) || !(r.items || []).length) break;
	}
	state.opgaver = alle;
	gemt('feltapp.cache.' + state.session.organizationId, alle.map(({ id, title, dueDate, project, taskStatus, members, status }) => ({ id, title, dueDate, status, project: project && { id: project.id, name: project.name }, taskStatus: taskStatus && { id: taskStatus.id, name: taskStatus.name, color: taskStatus.color, isDone: taskStatus.isDone }, members: (members || []).map((m) => ({ id: m.id })) })));
	return alle;
}

const statusAf = (t) => t.taskStatus || state.statusser.find((s) => s.id === t.taskStatusId) || { name: t.status || 'Ukendt', color: '#999' };
const erFaerdig = (t) => !!statusAf(t).isDone;

// ---------- Opgaveliste ------------------------------------------------------
async function visListe(opdater = false) {
	if (!state.session?.organizationId) return visLogin();
	topbar('Opgaver', state.session.orgNavn, { menu: true });
	if (!state.opgaver.length || opdater) {
		const cache = hent('feltapp.cache.' + state.session.organizationId);
		if (cache && !state.opgaver.length) state.opgaver = cache;
		if (!state.opgaver.length) $app.innerHTML = '<div class="tom">Henter opgaver …</div>';
		try {
			await hentStatusser();
			await hentOpgaver();
		} catch (e) {
			besked(e.message, 'fejl');
			if (!state.session) return;
		}
	}
	tegnListe();
}

function tegnListe() {
	const f = state.filter;
	const soeg = f.soeg.toLowerCase();
	let liste = state.opgaver.filter((t) => {
		if (f.visning === 'aktive' && erFaerdig(t)) return false;
		if (f.visning === 'faerdige' && !erFaerdig(t)) return false;
		if (f.visning === 'godkendelse' && !/godkend/i.test(statusAf(t).name)) return false;
		if (f.mine && !(t.members || []).some((m) => m.id === state.session.employeeId)) return false;
		if (soeg && !(`${t.title} ${t.project?.name || ''}`.toLowerCase().includes(soeg))) return false;
		return true;
	});
	// Kun den næste aktive fase pr. lokation, når "Næste skridt" er valgt
	if (f.visning === 'naeste') {
		const pr = new Map();
		for (const t of state.opgaver.filter((t) => !erFaerdig(t)).sort((a, b) => a.title.localeCompare(b.title, 'da', { numeric: true }))) {
			const k = t.project?.id || 'ingen';
			if (!pr.has(k)) pr.set(k, t);
		}
		liste = [...pr.values()].filter((t) => (!f.mine || (t.members || []).some((m) => m.id === state.session.employeeId)) && (!soeg || `${t.title} ${t.project?.name || ''}`.toLowerCase().includes(soeg)));
	}

	const grupper = new Map();
	for (const t of liste) {
		const k = t.project?.name || 'Uden projekt';
		if (!grupper.has(k)) grupper.set(k, []);
		grupper.get(k).push(t);
	}
	const navne = [...grupper.keys()].sort((a, b) => a.localeCompare(b, 'da', { numeric: true }));

	const fremdrift = (projektNavn) => {
		const alle = state.opgaver.filter((t) => (t.project?.name || 'Uden projekt') === projektNavn);
		return alle.length ? Math.round((alle.filter(erFaerdig).length / alle.length) * 100) : 0;
	};

	const chip = (v, tekst) => `<button class="chip" data-v="${v}" aria-pressed="${f.visning === v}">${tekst}</button>`;
	$app.innerHTML = `
		<input id="soeg" type="search" placeholder="Søg opgave eller lokation" value="${esc(f.soeg)}" aria-label="Søg">
		<div style="height:10px"></div>
		<div class="chips" role="group" aria-label="Filter">
			${chip('naeste', 'Næste skridt')}${chip('aktive', 'Aktive')}${chip('godkendelse', 'Til godkendelse')}${chip('faerdige', 'Færdige')}${chip('alle', 'Alle')}
			<button class="chip" id="mine" aria-pressed="${f.mine}">👷 Mine</button>
		</div>
		${navne.length ? '' : `<div class="tom">Ingen opgaver her.${f.mine ? '<br>Prøv at slå "Mine" fra.' : ''}</div>`}
		${navne.map((n) => `
			<h2>${esc(n)} <span style="float:right">${fremdrift(n)} %</span></h2>
			${grupper.get(n).sort((a, b) => a.title.localeCompare(b.title, 'da', { numeric: true })).map((t) => {
				const s = statusAf(t);
				const forsinket = t.dueDate && !erFaerdig(t) && new Date(t.dueDate) < new Date();
				return `<button class="opgave" data-id="${t.id}">
					<span class="prik" style="background:${esc(s.color || '#999')}"></span>
					<span style="min-width:0">
						<div class="titel">${esc(t.title)}</div>
						<div class="meta">${esc(s.name)}${t.dueDate ? ` · <span style="${forsinket ? 'color:var(--fejl);font-weight:700' : ''}">${forsinket ? 'Forsinket – ' : 'Frist '}${dato(t.dueDate)}</span>` : ''}</div>
					</span>
					<span class="pil">›</span>
				</button>`;
			}).join('')}`).join('')}`;

	const sf = document.getElementById('soeg');
	sf.oninput = () => { f.soeg = sf.value; gemt('feltapp.filter', f); tegnListe(); document.getElementById('soeg').focus(); };
	$app.querySelectorAll('.chip[data-v]').forEach((b) => (b.onclick = () => { f.visning = b.dataset.v; gemt('feltapp.filter', f); tegnListe(); }));
	document.getElementById('mine').onclick = () => { f.mine = !f.mine; gemt('feltapp.filter', f); tegnListe(); };
	$app.querySelectorAll('.opgave').forEach((b) => (b.onclick = () => visOpgave(b.dataset.id)));
	document.querySelector('.bund')?.remove();
}

// ---------- Opgave med tjekliste --------------------------------------------
async function hentRapportKommentar(taskId) {
	const r = await api('GET', '/comment?' + qs({ 'where[organizationId]': state.session.organizationId, 'where[tenantId]': state.session.tenantId, 'where[entity]': 'Task', 'where[entityId]': taskId }));
	const k = (r.items || []).find((c) => typeof c.comment === 'string' && c.comment.startsWith(MARKOER));
	if (!k) return { kommentar: null, data: null };
	try {
		return { kommentar: k, data: JSON.parse(k.comment.slice(k.comment.indexOf('\n') + 1)) };
	} catch {
		return { kommentar: k, data: null };
	}
}

async function visOpgave(id) {
	document.querySelector('.bund')?.remove();
	topbar('Henter …', '', { tilbage: () => visListe() });
	$app.innerHTML = '<div class="tom">Henter opgave …</div>';
	let opgave, rapport;
	try {
		await hentStatusser();
		const p = new URLSearchParams();
		['project', 'taskStatus', 'tags', 'members', 'members.user'].forEach((r) => p.append('relations[]', r));
		[opgave, rapport] = await Promise.all([api('GET', `/tasks/${id}?${p}`), hentRapportKommentar(id)]);
	} catch (e) {
		besked(e.message, 'fejl');
		return visListe();
	}

	const felter = tjeklisteFor(opgave.title);
	const kladdeNoegle = 'feltapp.kladde.' + id;
	const kladde = hent(kladdeNoegle);
	const serverSvar = rapport.data?.svar || {};
	// Brug lokal kladde, hvis den er nyere end det gemte på serveren
	let svar = kladde && (!rapport.data?.opdateret || kladde.tid > Date.parse(rapport.data.opdateret)) ? kladde.svar : { ...serverSvar };
	let aendret = !!(kladde && svar === kladde.svar);
	const gemKladde = () => { aendret = true; gemt(kladdeNoegle, { tid: Date.now(), svar }); opdaterBund(); };

	const basisBeskrivelse = (opgave.description || '').split(`<h3>${RAPPORT_OVERSKRIFT}`)[0];
	topbar(opgave.title.replace(/^\d+\.\s*/, ''), opgave.project?.name || '', { tilbage: () => { if (!aendret || confirm('Du har ændringer, der ikke er sendt. Gå tilbage alligevel? (De gemmes som kladde på telefonen.)')) visListe(true); } });

	const tegn = () => {
		const s = statusAf(opgave);
		const udfyldt = felter.filter((fl) => erUdfyldt(fl, svar)).length;
		$app.innerHTML = `
			<div class="kort">
				<span class="badge" style="background:${esc(s.color || '#999')}">${esc(s.name)}</span>
				${opgave.dueDate ? `<span class="svag"> · Frist ${dato(opgave.dueDate)}</span>` : ''}
				<h1>${esc(opgave.title)}</h1>
				<div class="svag">${esc(opgave.project?.name || '')}${(opgave.tags || []).length ? ' · ' + opgave.tags.map((t) => esc(t.name)).join(', ') : ''}</div>
				${basisBeskrivelse ? `<div class="beskrivelse" style="margin-top:8px">${basisBeskrivelse}</div>` : ''}
				${rapport.data?.opdateret ? `<p class="svag">Senest sendt ${tid(rapport.data.opdateret)} af ${esc(rapport.data.af || '')}</p>` : ''}
			</div>

			<h2>Status</h2>
			<div class="kort status-grid" role="group" aria-label="Status">
				${state.statusser.map((st) => `<button data-sid="${st.id}" aria-pressed="${st.id === opgave.taskStatusId}" style="${st.id === opgave.taskStatusId ? `background:${esc(st.color)};border-color:${esc(st.color)}` : `border-color:${esc(st.color)}`}">${esc(st.name)}</button>`).join('')}
			</div>

			<h2>Tjekliste <span style="float:right">${udfyldt}/${felter.length}</span></h2>
			<div class="fremdrift" style="margin:-4px 4px 10px"><div style="width:${Math.round((udfyldt / felter.length) * 100)}%"></div></div>
			<div class="kort" id="tjekliste">${felter.map((fl) => feltHtml(fl, svar)).join('')}</div>`;

		$app.querySelectorAll('[data-sid]').forEach((b) => (b.onclick = () => skiftStatus(b.dataset.sid)));
		bindFelter();
	};

	function feltHtml(fl, sv) {
		const v = sv[fl.id];
		const lbl = `<div class="lbl">${esc(fl.label)}${fl.krav ? ' <span class="krav">*</span>' : ''}${fl.type === 'foto' && fl.min ? ` <span class="svag">(min. ${fl.min})</span>` : ''}</div>`;
		let input = '';
		switch (fl.type) {
			case 'check':
				input = `<div class="tre" data-f="${fl.id}">${[['ja', 'Ja'], ['nej', 'Nej'], ['ir', 'Ikke relevant']].map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${v === k}">${t}</button>`).join('')}</div>`;
				break;
			case 'tekst':
				input = fl.linjer ? `<textarea data-f="${fl.id}" rows="${fl.linjer}">${esc(v || '')}</textarea>` : `<input type="text" data-f="${fl.id}" value="${esc(v || '')}">`;
				break;
			case 'tal':
				input = `<div class="med-enhed"><input type="text" inputmode="decimal" data-f="${fl.id}" value="${esc(v ?? '')}"><span>${esc(fl.enhed || '')}</span></div>`;
				break;
			case 'valg':
				input = `<select data-f="${fl.id}"><option value="">Vælg …</option>${fl.muligheder.map((m) => `<option ${v === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>`;
				break;
			case 'foto':
				input = `<div class="fotos">${(v || []).map((p, i) => `<div class="foto"><img src="${esc(relativ(p.thumb || p.url))}" alt="Foto ${i + 1}" loading="lazy"><button type="button" class="fjern" data-fjern="${fl.id}" data-i="${i}" aria-label="Fjern foto">×</button></div>`).join('')}<div class="foto uploader" id="up-${fl.id}" hidden>Uploader …</div></div>
					<label class="knap sekundaer kamera">📷 Tag foto<input type="file" accept="image/*" capture="environment" data-foto="${fl.id}"></label>
					<label class="knap sekundaer kamera" style="margin-top:6px;min-height:44px;font-size:15px">🖼️ Vælg fra billeder<input type="file" accept="image/*" multiple data-foto="${fl.id}"></label>`;
				break;
			case 'signatur':
				input = v?.url
					? `<img class="sign-img" src="${esc(relativ(v.url))}" alt="Underskrift"><div class="svag">${esc(v.navn || '')} · ${v.tid ? tid(v.tid) : ''}</div><div class="raekke"><button type="button" class="knap sekundaer" data-sign-ny="${fl.id}">Skriv igen</button></div>`
					: `<input type="text" placeholder="Navn med blokbogstaver" data-sign-navn="${fl.id}"><div style="height:8px"></div><canvas class="sign" data-sign="${fl.id}"></canvas><div class="raekke"><button type="button" class="knap sekundaer" data-sign-ryd="${fl.id}">Ryd</button><button type="button" class="knap" data-sign-gem="${fl.id}">Gem underskrift</button></div>`;
				break;
		}
		return `<div class="punkt" data-punkt="${fl.id}">${lbl}${input}</div>`;
	}

	function bindFelter() {
		const t = document.getElementById('tjekliste');
		t.querySelectorAll('.tre').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => {
			svar[g.dataset.f] = svar[g.dataset.f] === b.dataset.v ? undefined : b.dataset.v;
			g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', svar[g.dataset.f] === x.dataset.v));
			gemKladde();
			opdaterTaeller();
		})));
		t.querySelectorAll('input[data-f], textarea[data-f], select[data-f]').forEach((el) => (el[el.tagName === 'SELECT' ? 'onchange' : 'oninput'] = () => {
			svar[el.dataset.f] = el.value;
			gemKladde();
			opdaterTaeller();
		}));
		t.querySelectorAll('input[data-foto]').forEach((el) => (el.onchange = () => tilfoejFotos(el.dataset.foto, [...el.files])));
		t.querySelectorAll('[data-fjern]').forEach((b) => (b.onclick = () => {
			if (!confirm('Fjern dette foto fra tjeklisten?')) return;
			svar[b.dataset.fjern].splice(+b.dataset.i, 1);
			gemKladde();
			tegn();
		}));
		t.querySelectorAll('canvas[data-sign]').forEach(opsaetSignatur);
		t.querySelectorAll('[data-sign-ny]').forEach((b) => (b.onclick = () => { svar[b.dataset.signNy] = undefined; gemKladde(); tegn(); }));
	}

	function opdaterTaeller() {
		const h = [...$app.querySelectorAll('h2')].find((x) => x.textContent.startsWith('Tjekliste'));
		const udfyldt = felter.filter((fl) => erUdfyldt(fl, svar)).length;
		if (h) h.querySelector('span').textContent = `${udfyldt}/${felter.length}`;
		const bar = $app.querySelector('.fremdrift > div');
		if (bar) bar.style.width = Math.round((udfyldt / felter.length) * 100) + '%';
	}

	async function tilfoejFotos(feltId, filer) {
		if (!filer.length) return;
		const vis = document.getElementById('up-' + feltId);
		if (vis) vis.hidden = false;
		let ok = 0;
		for (const fil of filer) {
			try {
				const blob = await komprimer(fil, `${opgave.project?.name || ''} · ${new Date().toLocaleString('da-DK')}`);
				const fd = new FormData();
				fd.append('file', blob, `foto-${Date.now()}.jpg`);
				const r = await api('POST', '/image-assets/upload/feltapp', fd);
				(svar[feltId] ||= []).push({ url: r.fullUrl, thumb: r.thumbUrl || r.fullUrl, tid: new Date().toISOString() });
				ok++;
			} catch (e) {
				besked('Foto kunne ikke uploades: ' + e.message, 'fejl');
			}
		}
		if (ok) { gemKladde(); besked(ok === 1 ? 'Foto tilføjet' : `${ok} fotos tilføjet`, 'ok'); }
		tegn();
	}

	function opsaetSignatur(c) {
		const ratio = window.devicePixelRatio || 1;
		c.width = c.clientWidth * ratio;
		c.height = c.clientHeight * ratio;
		const ctx = c.getContext('2d');
		ctx.scale(ratio, ratio);
		ctx.lineWidth = 2.5;
		ctx.lineCap = 'round';
		ctx.strokeStyle = '#111';
		let tegner = false, tom = true;
		const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
		c.onpointerdown = (e) => { tegner = true; tom = false; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
		c.onpointermove = (e) => { if (!tegner) return; ctx.lineTo(...pos(e)); ctx.stroke(); };
		c.onpointerup = c.onpointercancel = () => (tegner = false);
		const id = c.dataset.sign;
		$app.querySelector(`[data-sign-ryd="${id}"]`).onclick = () => { ctx.clearRect(0, 0, c.width, c.height); tom = true; };
		$app.querySelector(`[data-sign-gem="${id}"]`).onclick = async (e) => {
			const navn = $app.querySelector(`[data-sign-navn="${id}"]`).value.trim();
			if (tom) return besked('Skriv underskriften i feltet først', 'fejl');
			if (!navn) return besked('Skriv navnet med blokbogstaver', 'fejl');
			e.target.disabled = true;
			try {
				// hvid baggrund, så underskriften kan læses i mørk tilstand og i rapporten
				const ud = document.createElement('canvas');
				ud.width = c.width; ud.height = c.height;
				const u = ud.getContext('2d');
				u.fillStyle = '#fff'; u.fillRect(0, 0, ud.width, ud.height); u.drawImage(c, 0, 0);
				const blob = await new Promise((r) => ud.toBlob(r, 'image/png'));
				const fd = new FormData();
				fd.append('file', blob, `underskrift-${Date.now()}.png`);
				const r = await api('POST', '/image-assets/upload/feltapp', fd);
				svar[id] = { url: r.fullUrl, navn, tid: new Date().toISOString() };
				gemKladde();
				tegn();
			} catch (err) {
				e.target.disabled = false;
				besked(err.message, 'fejl');
			}
		};
	}

	async function skiftStatus(statusId) {
		const st = state.statusser.find((s) => s.id === statusId);
		if (!st || st.id === opgave.taskStatusId) return;
		if (st.isDone || /godkend/i.test(st.name)) {
			const m = mangler(felter, svar);
			if (m.length) { markerMangler(m); return besked(`Udfyld først: ${m.map((x) => x.label).join(', ')}`, 'fejl'); }
		}
		try {
			await api('PUT', `/tasks/${opgave.id}/status`, { ...scope(), taskStatusId: st.id, status: st.value });
			opgave.taskStatusId = st.id; opgave.taskStatus = st; opgave.status = st.value;
			const i = state.opgaver.findIndex((t) => t.id === opgave.id);
			if (i >= 0) Object.assign(state.opgaver[i], { taskStatusId: st.id, taskStatus: st, status: st.value });
			besked('Status: ' + st.name, 'ok');
			tegn();
		} catch (e) { besked(e.message, 'fejl'); }
	}

	function markerMangler(m) {
		$app.querySelectorAll('.punkt').forEach((p) => p.classList.toggle('mangler', m.some((x) => x.id === p.dataset.punkt)));
		$app.querySelector(`[data-punkt="${m[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	async function send(tilGodkendelse) {
		if (tilGodkendelse) {
			const m = mangler(felter, svar);
			if (m.length) { markerMangler(m); return besked(`Mangler ${m.length} obligatoriske felt${m.length > 1 ? 'er' : ''}`, 'fejl'); }
		}
		const knapper = document.querySelectorAll('.bund button');
		knapper.forEach((b) => (b.disabled = true));
		try {
			const nu = new Date().toISOString();
			const data = { version: 1, tjekliste: felter.map((f) => f.id), svar, opdateret: nu, af: state.session.navn };
			const tekst = MARKOER + '\n' + JSON.stringify(data);
			if (rapport.kommentar) await api('PUT', `/comment/${rapport.kommentar.id}`, { ...scope(), comment: tekst });
			else rapport.kommentar = await api('POST', '/comment', { ...scope(), entity: 'Task', entityId: opgave.id, comment: tekst });
			rapport.data = data;

			// Læsbar rapport i opgavens beskrivelse, så kontoret ser den i Gauzy
			const beskrivelse = basisBeskrivelse + rapportHtml(felter, svar, data);
			let status = statusAf(opgave);
			if (tilGodkendelse) status = state.statusser.find((s) => /godkend/i.test(s.name)) || status;
			const opd = await api('PUT', `/tasks/${opgave.id}`, {
				...scope(), title: opgave.title, description: beskrivelse, projectId: opgave.projectId,
				status: status.value || opgave.status, taskStatusId: status.id || opgave.taskStatusId, priority: opgave.priority || undefined
			});
			opgave.description = opd.description ?? beskrivelse;
			opgave.taskStatusId = status.id || opgave.taskStatusId; opgave.taskStatus = status;
			const i = state.opgaver.findIndex((t) => t.id === opgave.id);
			if (i >= 0) Object.assign(state.opgaver[i], { taskStatusId: opgave.taskStatusId, taskStatus: status });
			gemt(kladdeNoegle, undefined);
			aendret = false;
			besked(tilGodkendelse ? 'Sendt til godkendelse ✓' : 'Gemt ✓', 'ok');
			tegn();
			opdaterBund();
		} catch (e) {
			besked('Kunne ikke sende: ' + e.message + ' – dine svar ligger som kladde på telefonen.', 'fejl');
		} finally {
			knapper.forEach((b) => (b.disabled = false));
		}
	}

	function opdaterBund() {
		let bund = document.querySelector('.bund');
		if (!bund) {
			bund = document.createElement('div');
			bund.className = 'bund';
			bund.innerHTML = `<div class="indre"><button class="knap sekundaer" id="b-gem">Gem</button><button class="knap sol" id="b-send">Send til godkendelse</button></div>`;
			document.body.appendChild(bund);
			bund.querySelector('#b-gem').onclick = () => send(false);
			bund.querySelector('#b-send').onclick = () => send(true);
		}
		bund.querySelector('#b-gem').textContent = aendret ? 'Gem ●' : 'Gem';
	}

	tegn();
	opdaterBund();
}

function rapportHtml(felter, svar, data) {
	const vaerdi = (f) => {
		const v = svar[f.id];
		if (f.type === 'check') return { ja: '✔ Ja', nej: '✘ Nej', ir: 'Ikke relevant' }[v] || '–';
		if (f.type === 'foto') return (v || []).length ? `${v.length} foto${v.length > 1 ? 's' : ''}` : '–';
		if (f.type === 'signatur') return v?.url ? `${esc(v.navn)} (${tid(v.tid)})<br><img src="${esc(v.url)}" width="240" alt="Underskrift">` : '–';
		if (f.type === 'tal') return v !== undefined && v !== '' ? `${esc(v)} ${esc(f.enhed || '')}` : '–';
		return v ? esc(v).replace(/\n/g, '<br>') : '–';
	};
	const fotos = felter.filter((f) => f.type === 'foto' && (svar[f.id] || []).length);
	return `<h3>${RAPPORT_OVERSKRIFT}</h3>
<p>Opdateret ${esc(tid(data.opdateret))} af ${esc(data.af)}</p>
<table><tbody>${felter.map((f) => `<tr><td>${esc(f.label)}</td><td>${vaerdi(f)}</td></tr>`).join('')}</tbody></table>
${fotos.map((f) => `<p><strong>${esc(f.label)}</strong></p><p>${svar[f.id].map((p) => `<a href="${esc(p.url)}"><img src="${esc(p.thumb || p.url)}" width="200" alt="${esc(f.label)}"></a>`).join(' ')}</p>`).join('')}`;
}

// Billeder gøres mindre (maks. 1600 px) og får tidsstempel, før de sendes.
async function komprimer(fil, stempel) {
	const MAX = 1600;
	let bmp;
	try { bmp = await createImageBitmap(fil, { imageOrientation: 'from-image' }); }
	catch { bmp = await new Promise((ok, fejl) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fejl; i.src = URL.createObjectURL(fil); }); }
	const skala = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
	const c = document.createElement('canvas');
	c.width = Math.round(bmp.width * skala);
	c.height = Math.round(bmp.height * skala);
	const ctx = c.getContext('2d');
	ctx.drawImage(bmp, 0, 0, c.width, c.height);
	const fs = Math.max(14, Math.round(c.width / 45));
	ctx.font = `600 ${fs}px system-ui, sans-serif`;
	const w = ctx.measureText(stempel).width;
	ctx.fillStyle = 'rgba(0,0,0,.55)';
	ctx.fillRect(c.width - w - fs * 1.2, c.height - fs * 2, w + fs * 1.2, fs * 2);
	ctx.fillStyle = '#fff';
	ctx.fillText(stempel, c.width - w - fs * 0.6, c.height - fs * 0.6);
	return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
}

// ---------- Start ------------------------------------------------------------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
	navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (state.session?.token && state.session?.organizationId) visListe();
else visLogin();
