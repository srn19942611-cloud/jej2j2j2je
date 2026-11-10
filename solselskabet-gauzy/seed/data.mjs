// Indholdet af demoen. Ret frit her – kør derefter `node seed/seed.mjs --reset`.
//
// OBS: Status på opgaverne er EKSEMPLER til præsentationen, ikke den faktiske
// fremdrift. Lokationernes navne og kWp er ikke udfyldt – skriv dem ind nedenfor.

export const ORGANIZATION = {
	name: 'Coop × Solselskabet',
	description:
		'Fælles projektstyring af solcelleanlæg på Coop-butikker under rammeaftalen ' +
		'Solselskabet ApS ⇄ Coop Danmark A/S (01.11.2025 – 31.10.2030). Status på opgaver er eksempler.'
};

// Kolonnerne på tavlen. Rækkefølgen her er rækkefølgen i Gauzy.
export const STATUSES = [
	{ key: 'todo', icon: 'open', name: 'Ikke startet', color: '#9CA3AF', isTodo: true, isDefault: true },
	{ key: 'doing', icon: 'in-progress', name: 'I gang', color: '#3B82F6', isInProgress: true },
	{ key: 'coop', icon: 'ready', name: 'Afventer Coop', color: '#F59E0B', isInProgress: true },
	{ key: 'ext', icon: 'backlog', name: 'Afventer net/myndighed', color: '#A855F7', isInProgress: true },
	{ key: 'review', icon: 'in-review', name: 'Til godkendelse', color: '#06B6D4', isInProgress: true },
	{ key: 'blocked', icon: 'blocked', name: 'Blokeret', color: '#EF4444', isInProgress: true },
	{ key: 'done', icon: 'completed', name: 'Færdig', color: '#10B981', isDone: true }
];

export const TAGS = {
	solselskabet: { name: 'Ansvar: Solselskabet', color: '#F2B705' },
	coop: { name: 'Ansvar: Coop', color: '#00A04A' },
	ekstern: { name: 'Ansvar: Netselskab/kommune', color: '#7C3AED' },
	dok: { name: 'Dokumentation', color: '#64748B' },
	brand: { name: 'Brand & forsikring', color: '#DC2626' },
	el: { name: 'El & net', color: '#2563EB' },
	afklaring: { name: 'Afklaringspunkt', color: '#EA580C' }
};

// Lokationerne i førstegangsudrulningen (8 lokationer, ~941 kWp i alt).
// `fremdrift` = hvor mange faser der står som færdige i demoen (0-14).
export const LOKATIONER = [
	{ navn: 'Lokation 1', kwp: null, fremdrift: 13 },
	{ navn: 'Lokation 2', kwp: null, fremdrift: 11 },
	{ navn: 'Lokation 3', kwp: null, fremdrift: 9 },
	{ navn: 'Lokation 4', kwp: null, fremdrift: 7 },
	{ navn: 'Lokation 5', kwp: null, fremdrift: 6 },
	{ navn: 'Lokation 6', kwp: null, fremdrift: 4 },
	{ navn: 'Lokation 7', kwp: null, fremdrift: 2 },
	{ navn: 'Lokation 8', kwp: null, fremdrift: 0 }
];

// Faserne for ét anlæg – fra screening til drift.
// `venter` = hvilken status fasen står i, mens den er den aktive fase.
export const FASER = [
	{ titel: 'Screening af lokation', tekst: 'Tag, eltavle, forbrugsprofil og adgangsforhold gennemgås. Billeder og noter lægges i Dalux.', tags: ['solselskabet'], dage: 7, venter: 'doing' },
	{ titel: 'Tilbud og PVSOL-beregning', tekst: 'Layout, kWp, forventet produktion og pris. PVSOL-rapport vedlægges.', tags: ['solselskabet', 'dok'], dage: 10, venter: 'doing' },
	{ titel: 'Godkendelse og bestilling hos Coop', tekst: 'Butik/bestyrelse og Coop Ejendomme godkender tilbuddet.', tags: ['coop'], dage: 14, venter: 'coop' },
	{ titel: 'Statisk dokumentation', tekst: 'Skriftlig vurdering fra statiker af tagets bæreevne og montagesystemets forankring.', tags: ['solselskabet', 'dok'], dage: 14, venter: 'doing' },
	{ titel: 'Brandnotat og forsikringskrav', tekst: 'DBI 39 og forsikringens fakta ark (Bilag 14): feltstørrelse maks. 40 × 40 m, afstand mellem felter og til brandåbninger, inverterplacering.', tags: ['solselskabet', 'brand', 'dok'], dage: 10, venter: 'review' },
	{ titel: 'Byggetilladelse / anmeldelse til kommunen', tekst: 'Ansøgning eller anmeldelse efter kommunens krav.', tags: ['solselskabet', 'ekstern'], dage: 30, venter: 'ext' },
	{ titel: 'Anmeldelse til netselskab', tekst: 'Installationsblanket og tilslutningstilsagn. Ingen leveringsdato før netselskabet har bekræftet.', tags: ['solselskabet', 'ekstern', 'el'], dage: 30, venter: 'ext' },
	{ titel: 'Materialebestilling', tekst: 'Moduler, invertere og montagesystem iht. Coops krav (Bilag 13).', tags: ['solselskabet'], dage: 21, venter: 'doing' },
	{ titel: 'Montage på tag', tekst: 'Montagesystem, moduler og DC-føring. Aftale med butikken om adgang og sikkerhed.', tags: ['solselskabet'], dage: 10, venter: 'doing' },
	{ titel: 'AC-tilslutning, SPD og eltavle', tekst: 'Tilslutning i tavle inkl. overspændingsbeskyttelse (SPD) iht. Bilag 13.', tags: ['solselskabet', 'el'], dage: 5, venter: 'doing' },
	{ titel: 'Idriftsættelse og test', tekst: 'Måling, idriftsættelsesprotokol og test af overvågning.', tags: ['solselskabet', 'el', 'dok'], dage: 3, venter: 'doing' },
	{ titel: 'KS-pakke og dokumentation', tekst: 'Komplet KS-pakke: datablade, tegninger, målerapporter, brandnotat, statik, DKV- og beredskabsplan.', tags: ['solselskabet', 'dok'], dage: 10, venter: 'review' },
	{ titel: 'Aflevering og godkendelse', tekst: 'Fælles gennemgang på stedet. Coop godkender KS-pakken.', tags: ['coop', 'dok'], dage: 7, venter: 'coop' },
	{ titel: 'Anlæg oprettet i Dalux og overvågning', tekst: 'Anlæg, dokumenter og serviceplan registreres i Dalux. Produktion følges.', tags: ['solselskabet', 'coop'], dage: 5, venter: 'doing' }
];

export const PROJEKTER_OEVRIGE = [
	{
		navn: 'Rammeaftale 2025–2030',
		beskrivelse: 'Samarbejdet på tværs af lokationer: møder, rapportering, priser og milepæle.',
		opgaver: [
			{ titel: 'Opstartsmøde og kontaktpersoner (SPC)', tags: ['solselskabet', 'coop'], status: 'done', dage: 0 },
			{ titel: 'Fælles tavle i Gauzy – aftal hvem der opdaterer hvad', tags: ['solselskabet', 'coop'], status: 'doing', dage: 7 },
			{ titel: 'Månedlig statusrapport pr. lokation', tags: ['solselskabet'], status: 'todo', dage: 30 },
			{ titel: 'Kvartalsvis samarbejdsmøde', tags: ['solselskabet', 'coop'], status: 'todo', dage: 45 },
			{ titel: 'Rateplan iht. Bilag 1 (10/40/35/15 %) – kobl hver rate til en milepæl', tags: ['solselskabet', 'coop'], status: 'review', dage: 14 },
			{ titel: 'Prisregulering 01.01.2027 (DST PRIS91, Elinstallation)', tags: ['solselskabet', 'coop'], status: 'todo', dage: 51 },
			{ titel: 'Årlig evaluering af samarbejdet', tags: ['solselskabet', 'coop'], status: 'todo', dage: 355 }
		]
	},
	{
		navn: 'Drift og service',
		beskrivelse: 'Anlæg i drift: overvågning, eftersyn og fejl.',
		opgaver: [
			{ titel: 'Overvågning af produktion – fælles adgang til portal', tags: ['solselskabet'], status: 'doing', dage: 14 },
			{ titel: 'Årligt serviceeftersyn pr. anlæg', tags: ['solselskabet'], status: 'todo', dage: 180 },
			{ titel: 'Fejlmelding og afhjælpning via Dalux-arbejdsordrer', tags: ['solselskabet', 'coop'], status: 'todo', dage: 21 },
			{ titel: 'Termografi og kontrol af DC-forbindelser', tags: ['solselskabet', 'brand'], status: 'todo', dage: 365 },
			{ titel: 'Garantisager og reklamationer', tags: ['solselskabet'], status: 'todo', dage: 60 }
		]
	},
	{
		navn: 'Afklaringspunkter i kravsættet',
		beskrivelse: 'Punkter i Bilag 13/14 der skal afklares mellem Coop og Solselskabet.',
		opgaver: [
			{ titel: '"Polykrystallinske" moduler i Bilag 13 – rettes til "monokrystallinske, all-black"', tags: ['afklaring', 'coop'], status: 'coop', dage: 14 },
			{ titel: 'Inverterplacering: på tag (Bilag 13) vs. teknikrum 60 min. (Bilag 14) – afklares pr. butik', tags: ['afklaring', 'brand'], status: 'doing', dage: 21 },
			{ titel: 'Min. 5 m mellem felter (fakta ark) – mangler i brandnotat for alle 8 lokationer', tags: ['afklaring', 'brand', 'solselskabet'], status: 'blocked', dage: 10 },
			{ titel: 'SPD under AC-arbejde – Bilag 13 (med SPD) er gældende', tags: ['afklaring', 'el'], status: 'review', dage: 7 }
		]
	}
];
