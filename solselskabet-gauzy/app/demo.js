// Demotilstand: feltappen kører helt i browseren uden server (fx på Vercel).
// Slår til på *.vercel.app, eller med ?demo i adressen. Data gemmes i browseren (localStorage).
// Opgaverne bygges ud fra de samme data som seed-scriptet (seed/data.mjs).

const lokalt = (() => { try { return localStorage.getItem('feltapp.demo') === '1'; } catch { return false; } })();
export const ER_DEMO = location.hostname.endsWith('.vercel.app') || new URLSearchParams(location.search).has('demo') || lokalt;
if (new URLSearchParams(location.search).has('demo')) { try { localStorage.setItem('feltapp.demo', '1'); } catch {} }

const NOEGLE = 'feltapp.demo.db.v1';
let db = null;
let fotoHukommelse = {}; // fotos der ikke kunne gemmes i localStorage (pladsmangel)

const iso = (d) => d.toISOString();
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

async function byg() {
	const { ORGANIZATION, STATUSES, TAGS, LOKATIONER, FASER, PROJEKTER_OEVRIGE, MONTOERER } = await import('../seed/data.mjs');
	const statusser = STATUSES.map((s, i) => ({ id: 'st-' + s.key, key: s.key, name: s.name, value: s.name.toLowerCase().replace(/[^a-zæøå0-9]+/g, '-'), color: s.color, order: i, isTodo: !!s.isTodo, isInProgress: !!s.isInProgress, isDone: !!s.isDone }));
	const st = Object.fromEntries(statusser.map((s) => [s.key, s]));
	const tags = Object.fromEntries(Object.entries(TAGS).map(([k, t]) => [k, { id: 'tag-' + k, name: t.name, color: t.color }]));
	const ansatte = MONTOERER.map((m, i) => ({ id: 'emp-' + i, email: m.email, navn: `${m.fornavn} ${m.efternavn}`, m }));
	const ansvar = (nr, projekt) => ansatte.filter((a) => (nr && a.m.lokationer.includes(nr)) || (projekt && a.m.oevrige.includes(projekt))).map((a) => ({ id: a.id, user: { name: a.navn } }));
	const opgaver = [];
	let n = 0;
	const opgave = (projekt, { titel, tekst, tagsK = [], status, start, due, priority = 'medium', members = [] }) => {
		const s = st[status];
		opgaver.push({ id: 't-' + ++n, title: titel, description: tekst ? `<p>${tekst}</p>` : '', status: s.value, taskStatusId: s.id, taskStatus: s, priority, startDate: start && iso(start), dueDate: due && iso(due), projectId: projekt.id, project: projekt, tags: tagsK.map((k) => tags[k]), members });
	};
	const idag = new Date();
	const projekter = [];
	PROJEKTER_OEVRIGE.forEach((p, i) => {
		const proj = { id: 'p-o' + i, name: p.navn };
		projekter.push(proj);
		p.opgaver.forEach((o) => opgave(proj, { titel: o.titel, tagsK: o.tags, status: o.status, due: addDays(idag, o.dage), members: ansvar(null, p.navn), priority: o.status === 'blocked' ? 'urgent' : o.tags.includes('afklaring') ? 'high' : 'medium' }));
	});
	const programStart = new Date('2026-06-01');
	LOKATIONER.forEach((lok, i) => {
		const proj = { id: 'p-l' + (i + 1), name: lok.kwp ? `${lok.navn} – ${lok.kwp} kWp` : lok.navn };
		projekter.push(proj);
		let start = addDays(programStart, i * 21);
		FASER.forEach((f, k) => {
			const due = addDays(start, f.dage);
			opgave(proj, {
				titel: `${String(k + 1).padStart(2, '0')}. ${f.titel}`, tekst: f.tekst, tagsK: f.tags,
				status: k < lok.fremdrift ? 'done' : k === lok.fremdrift ? f.venter : 'todo',
				start, due, priority: k === lok.fremdrift ? 'high' : 'medium',
				members: f.tags.includes('solselskabet') ? ansvar(i + 1) : []
			});
			start = due;
		});
	});
	return { org: { id: 'org-demo', name: ORGANIZATION.name }, statusser, opgaver, kommentarer: [], ansatte: ansatte.map(({ m, ...a }) => a) };
}

async function hentDb() {
	if (db) return db;
	try { db = JSON.parse(localStorage.getItem(NOEGLE)); } catch { db = null; }
	if (!db) { db = await byg(); gem(); }
	return db;
}
function gem() {
	try { localStorage.setItem(NOEGLE, JSON.stringify(db)); } catch {
		// fuld localStorage: flyt fotos til hukommelsen, så resten stadig kan gemmes
		const kopi = JSON.parse(JSON.stringify(db));
		for (const k of kopi.kommentarer) k.comment = k.comment.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, (m) => { const id = 'mem:' + Math.random().toString(36).slice(2); fotoHukommelse[id] = m; return id; });
		try { localStorage.setItem(NOEGLE, JSON.stringify(kopi)); } catch {}
	}
}
export function nulstilDemo() {
	try { localStorage.removeItem(NOEGLE); } catch {}
	db = null;
	fotoHukommelse = {};
}

// Fotos gøres ekstra små i demoen, så mange kan ligge i browseren
async function somDataUrl(fil) {
	const bmp = await createImageBitmap(fil);
	const s = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
	const c = document.createElement('canvas');
	c.width = Math.round(bmp.width * s);
	c.height = Math.round(bmp.height * s);
	c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
	return c.toDataURL(fil.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.7);
}

// Efterligner de dele af Gauzys REST-API som feltappen bruger
export async function demoApi(method, path, body) {
	const d = await hentDb();
	const [sti, query = ''] = path.split('?');
	const q = new URLSearchParams(query);
	const fejl = (msg) => { throw new Error(msg); };

	if (method === 'POST' && sti === '/auth/login') {
		const email = String(body?.email || '').toLowerCase();
		const a = d.ansatte.find((x) => x.email === email);
		const navn = a ? a.navn : 'Projektleder (demo)';
		return { token: 'demo', user: { id: a ? 'u-' + a.id : 'u-admin', tenantId: 'demo', name: navn, employee: a ? { id: a.id } : null } };
	}
	if (sti === '/user-organization') return { items: [{ organization: d.org }] };
	if (sti === '/user/me') return { name: null, employee: null };
	if (sti === '/task-statuses') return { items: d.statusser };
	if (sti === '/tasks/pagination') return Number(q.get('skip') || 1) <= 1 ? { items: d.opgaver, total: d.opgaver.length } : { items: [], total: d.opgaver.length };

	let m;
	if ((m = /^\/tasks\/([^/]+)\/status$/.exec(sti)) && method === 'PUT') {
		const t = d.opgaver.find((x) => x.id === m[1]) || fejl('Opgaven findes ikke');
		const s = d.statusser.find((x) => x.id === body.taskStatusId);
		Object.assign(t, { taskStatusId: s.id, taskStatus: s, status: s.value });
		gem();
		return t;
	}
	if ((m = /^\/tasks\/([^/]+)$/.exec(sti))) {
		const t = d.opgaver.find((x) => x.id === m[1]) || fejl('Opgaven findes ikke');
		if (method === 'PUT') {
			const s = d.statusser.find((x) => x.id === body.taskStatusId) || t.taskStatus;
			Object.assign(t, { description: body.description ?? t.description, taskStatusId: s.id, taskStatus: s, status: s.value });
			gem();
		}
		return t;
	}
	if (sti === '/comment' && method === 'GET') {
		const id = q.get('where[entityId]');
		return { items: d.kommentarer.filter((k) => !id || k.entityId === id).map((k) => ({ ...k, comment: k.comment.replace(/mem:[a-z0-9]+/g, (x) => fotoHukommelse[x] || '') })) };
	}
	if (sti === '/comment' && method === 'POST') {
		const k = { id: 'c-' + Date.now(), entity: body.entity, entityId: body.entityId, comment: body.comment };
		d.kommentarer.push(k);
		gem();
		return k;
	}
	if ((m = /^\/comment\/([^/]+)$/.exec(sti)) && method === 'PUT') {
		const k = d.kommentarer.find((x) => x.id === m[1]) || fejl('Kommentaren findes ikke');
		k.comment = body.comment;
		gem();
		return k;
	}
	if (sti.startsWith('/image-assets/upload/') && method === 'POST') {
		const url = await somDataUrl(body.get('file'));
		return { fullUrl: url, thumbUrl: url };
	}
	fejl('Ikke tilgængelig i demoen');
}
