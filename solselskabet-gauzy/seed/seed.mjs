// Lægger Solselskabet-demoen ind i en kørende Ever Gauzy via REST-API'et.
//
//   node seed/seed.mjs            opretter organisationen (stopper hvis den findes)
//   node seed/seed.mjs --reset    sletter den eksisterende og opretter forfra
//
// Miljøvariabler: GAUZY_API (standard http://localhost:3000/api),
//                 GAUZY_EMAIL / GAUZY_PASSWORD (standard admin@ever.co / admin)
import { ORGANIZATION, STATUSES, TAGS, LOKATIONER, FASER, PROJEKTER_OEVRIGE, MONTOERER } from './data.mjs';

const API = process.env.GAUZY_API || 'http://localhost:3000/api';
const EMAIL = process.env.GAUZY_EMAIL || 'admin@ever.co';
const PASSWORD = process.env.GAUZY_PASSWORD || 'admin';
const RESET = process.argv.includes('--reset');

// Fasernes tidsplan regnes fra denne dato. Lokation 1 starter først, de næste forskudt.
const PROGRAM_START = new Date('2026-06-01');
const FORSKYDNING_DAGE = 21;

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);

async function http(method, path, body, headers = {}) {
	const res = await fetch(API + path, {
		method,
		headers: { 'content-type': 'application/json', ...headers },
		body: body ? JSON.stringify(body) : undefined
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 600)}`);
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

let login;
for (let attempt = 1; ; attempt++) {
	try {
		login = await http('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
		break;
	} catch (e) {
		// Login er rate-begrænset; vent og prøv igen
		if (!String(e.message).includes('429') || attempt >= 6) throw e;
		console.log('Login er midlertidigt begrænset – venter 20 sek ...');
		await new Promise((r) => setTimeout(r, 20000));
	}
}
if (!login?.token) throw new Error('Login fejlede – tjek GAUZY_EMAIL / GAUZY_PASSWORD');
const tenantId = login.user.tenantId;
const auth = { Authorization: `Bearer ${login.token}`, 'Tenant-Id': tenantId };
const api = (method, path, body, orgId) =>
	http(method, path, body, orgId ? { ...auth, 'Organization-Id': orgId } : auth);

// --- Organisation -----------------------------------------------------------
const memberships = await api('GET', `/user-organization?relations[]=organization&where[userId]=${login.user.id}&where[tenantId]=${tenantId}`);
const found = (memberships.items || [])
	.map((m) => m.organization)
	.filter((o, i, all) => o && o.name === ORGANIZATION.name && all.findIndex((x) => x?.id === o.id) === i);
if (found.length) {
	if (!RESET) {
		console.log(`Organisationen "${ORGANIZATION.name}" findes allerede. Kør med --reset for at lægge den ind forfra.`);
		process.exit(0);
	}
	for (const o of found) {
		await api('DELETE', `/organization/${o.id}`);
		console.log(`Slettet eksisterende organisation ${o.id}`);
	}
}

const org = await api('POST', '/organization', {
	name: ORGANIZATION.name,
	short_description: ORGANIZATION.description,
	overview: ORGANIZATION.description,
	currency: 'DKK',
	defaultValueDateType: 'TODAY',
	isActive: true,
	tenantId
});
const organizationId = org.id;
const scope = { tenantId, organizationId };
const call = (m, p, b) => api(m, p, b, organizationId);
console.log(`Organisation: ${org.name} (${organizationId})`);

// --- Statusser (kolonner) ---------------------------------------------------
const defaults = await call('GET', `/task-statuses?tenantId=${tenantId}&organizationId=${organizationId}`);
const statusId = {};
const statusValue = {};
for (const [order, s] of STATUSES.entries()) {
	const value = s.name.toLowerCase().replace(/[^a-zæøå0-9]+/g, '-');
	const created = await call('POST', '/task-statuses', {
		...scope,
		name: s.name,
		value,
		color: s.color,
		icon: `ever-icons/task-statuses/${s.icon}.svg`,
		order,
		isTodo: !!s.isTodo,
		isInProgress: !!s.isInProgress,
		isDone: !!s.isDone
	});
	statusId[s.key] = created.id;
	statusValue[s.key] = value;
}
// Fjern Gauzys engelske standardstatusser fra denne organisation, så tavlen kun viser de danske.
let removed = 0;
for (const s of defaults.items || []) {
	try {
		await call('DELETE', `/task-statuses/${s.id}`);
		removed++;
	} catch {
		/* systemstatusser kan ikke slettes – de bliver bare stående */
	}
}
console.log(`Statusser: ${STATUSES.length} oprettet, ${removed} standard fjernet`);

// --- Tags -------------------------------------------------------------------
const tagId = {};
for (const [key, t] of Object.entries(TAGS)) {
	const created = await call('POST', '/tags', { ...scope, name: t.name, color: t.color, description: t.name });
	tagId[key] = created.id;
}

// --- Montører (brugere til mobil-appen) --------------------------------------
const medarbejder = {}; // email -> employeeId
for (const m of MONTOERER) {
	// Demo-brugeren slettes og oprettes forfra, så adgangskode og organisation passer
	try {
		const u = await api('GET', `/user/email/${encodeURIComponent(m.email)}`);
		if (u?.id) await api('DELETE', `/user/${u.id}`);
	} catch {
		/* findes ikke */
	}
	const e = await call('POST', '/employee', {
		...scope,
		startedWorkOn: iso(PROGRAM_START),
		password: m.adgangskode,
		user: { firstName: m.fornavn, lastName: m.efternavn, email: m.email, tenantId, preferredLanguage: 'en' }
	});
	medarbejder[m.email] = e.id;
}
const ansvarligFor = (lokationNr, projektNavn) =>
	MONTOERER.filter((m) => (lokationNr && m.lokationer.includes(lokationNr)) || (projektNavn && m.oevrige.includes(projektNavn))).map((m) => ({
		id: medarbejder[m.email]
	}));
console.log(`Montører: ${MONTOERER.map((m) => m.email).join(', ')}`);

// --- Opgaver ----------------------------------------------------------------
let taskCount = 0;
async function task(projectId, { titel, tekst, tags = [], status, start, due, priority = 'medium', members = [] }) {
	await call('POST', '/tasks', {
		...scope,
		projectId,
		title: titel,
		description: tekst ? `<p>${tekst}</p>` : undefined,
		status: statusValue[status],
		taskStatusId: statusId[status],
		priority,
		startDate: start ? iso(start) : undefined,
		dueDate: due ? iso(due) : undefined,
		tags: tags.map((k) => ({ id: tagId[k] })),
		members
	});
	taskCount++;
}

async function project(name, description) {
	return call('POST', '/organization-projects', { ...scope, name, description, currency: 'DKK', public: true });
}

// Øvrige projekter (rammeaftale, drift, afklaring)
const today = new Date();
for (const p of PROJEKTER_OEVRIGE) {
	const proj = await project(p.navn, p.beskrivelse);
	for (const o of p.opgaver) {
		const prio = o.tags.includes('afklaring') ? 'high' : 'medium';
		await task(proj.id, { ...o, members: ansvarligFor(null, p.navn), due: addDays(today, o.dage), priority: o.status === 'blocked' ? 'urgent' : prio });
	}
	console.log(`Projekt: ${p.navn} (${p.opgaver.length} opgaver)`);
}

// Ét projekt pr. lokation med alle faser
for (const [i, lok] of LOKATIONER.entries()) {
	const navn = lok.kwp ? `${lok.navn} – ${lok.kwp} kWp` : lok.navn;
	const proj = await project(navn, `Solcelleanlæg, førstegangsudrulning. kWp: ${lok.kwp ?? 'ikke oplyst'}.`);
	let start = addDays(PROGRAM_START, i * FORSKYDNING_DAGE);
	for (const [n, f] of FASER.entries()) {
		const due = addDays(start, f.dage);
		const status = n < lok.fremdrift ? 'done' : n === lok.fremdrift ? f.venter : 'todo';
		await task(proj.id, {
			titel: `${String(n + 1).padStart(2, '0')}. ${f.titel}`,
			tekst: f.tekst,
			tags: f.tags,
			status,
			start,
			due,
			priority: n === lok.fremdrift ? 'high' : 'medium',
			members: f.tags.includes('solselskabet') ? ansvarligFor(i + 1) : []
		});
		start = due;
	}
	console.log(`Projekt: ${navn} (${FASER.length} faser, ${lok.fremdrift} færdige)`);
}

console.log(`\nFærdig: ${taskCount} opgaver i "${ORGANIZATION.name}".`);
