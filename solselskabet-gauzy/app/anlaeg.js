// Anlægsdata og beregningsmodel til tilbudsvisningen.
//
// OBS: Tallene pr. lokation er EKSEMPLER (8 lokationer, 941 kWp i alt som i førstegangsudrulningen).
// Erstat dem med tal fra PVSOL-rapporten og butikkens målerdata, før tilbuddet vises for en butik.

export const FORUDSAETNINGER = {
	specifiktUdbytte: 900, // kWh pr. kWp pr. år (tagparallelt, lavt fald: 850–950)
	modul: { bredde: 1.134, laengde: 1.762, wp: 440 }, // m og Wp
	kantafstand: 1.5, // m fri zone langs tagkant og brandåbninger
	feltMaks: 40, // m – brandfelter maks. 40 × 40 m
	feltAfstand: 5, // m mellem felter (forsikringens fakta ark)
	gang: 0.6, // m servicegang mellem modulrækker
	elpris: 0.8, // kr./kWh – sparet indkøb (egetforbrug)
	salgspris: 0.2, // kr./kWh – solgt overskud (konservativt)
	// Andel af årsproduktionen pr. måned (Danmark, typisk)
	maanedsfordeling: [0.022, 0.042, 0.08, 0.115, 0.138, 0.136, 0.134, 0.116, 0.09, 0.06, 0.03, 0.017],
	// Dagslængde i timer pr. måned (ca. 56° N) – bruges til døgnprofilen
	dagslaengde: [7.3, 9.3, 11.8, 14.4, 16.6, 17.6, 17.1, 15.1, 12.6, 10.1, 7.9, 6.8]
};

// Tag: bredde × dybde i meter, forhindringer = ventilation, ovenlys m.m. (x, y fra øverste venstre hjørne)
export const ANLAEG = [
	{ nr: 1, kwp: 165, aarsforbrug: 610000, tag: { bredde: 92, dybde: 46, type: 'Tagpap', haeldning: 2 }, forhindringer: [{ x: 40, y: 6, b: 6, d: 4, navn: 'Ventilation' }, { x: 20, y: 30, b: 3, d: 3, navn: 'Ovenlys' }], inverter: 'Tag (ikke-brandbar konstruktion)' },
	{ nr: 2, kwp: 150, aarsforbrug: 540000, tag: { bredde: 84, dybde: 44, type: 'Stål/trapez', haeldning: 4 }, forhindringer: [{ x: 60, y: 30, b: 5, d: 4, navn: 'Ventilation' }], inverter: 'Teknikrum 60 min.' },
	{ nr: 3, kwp: 135, aarsforbrug: 480000, tag: { bredde: 80, dybde: 40, type: 'Tagpap', haeldning: 2 }, forhindringer: [{ x: 36, y: 4, b: 6, d: 4, navn: 'Køleanlæg' }], inverter: 'Tag (ikke-brandbar konstruktion)' },
	{ nr: 4, kwp: 120, aarsforbrug: 450000, tag: { bredde: 72, dybde: 40, type: 'Tagpap', haeldning: 2 }, forhindringer: [], inverter: 'Teknikrum 60 min.' },
	{ nr: 5, kwp: 110, aarsforbrug: 400000, tag: { bredde: 70, dybde: 36, type: 'Stål/trapez', haeldning: 5 }, forhindringer: [{ x: 10, y: 20, b: 4, d: 4, navn: 'Ventilation' }], inverter: 'Tag (ikke-brandbar konstruktion)' },
	{ nr: 6, kwp: 96, aarsforbrug: 360000, tag: { bredde: 64, dybde: 34, type: 'Tagpap', haeldning: 2 }, forhindringer: [], inverter: 'Teknikrum 60 min.' },
	{ nr: 7, kwp: 90, aarsforbrug: 330000, tag: { bredde: 60, dybde: 34, type: 'Tagpap', haeldning: 3 }, forhindringer: [{ x: 28, y: 14, b: 4, d: 3, navn: 'Ovenlys' }], inverter: 'Tag (ikke-brandbar konstruktion)' },
	{ nr: 8, kwp: 75, aarsforbrug: 300000, tag: { bredde: 56, dybde: 30, type: 'Tagpap', haeldning: 2 }, forhindringer: [], inverter: 'Teknikrum 60 min.' }
];

export const anlaegFor = (nr) => ANLAEG.find((a) => a.nr === Number(nr));
export const lokationsNr = (projektNavn) => Number(/Lokation\s+(\d+)/i.exec(projektNavn || '')?.[1]) || null;

// ---------- Tegning: placér moduler i brandfelter --------------------------------
export function layout(a, F = FORUDSAETNINGER) {
	const { bredde: W, dybde: D } = a.tag;
	const m = F.modul;
	const antal = Math.round((a.kwp * 1000) / m.wp);
	const k = F.kantafstand;
	// Felter: del det brugbare areal i felter på maks. 40 × 40 m med 5 m imellem
	const brugB = W - 2 * k, brugD = D - 2 * k;
	const nx = Math.max(1, Math.ceil((brugB + F.feltAfstand) / (F.feltMaks + F.feltAfstand)));
	const ny = Math.max(1, Math.ceil((brugD + F.feltAfstand) / (F.feltMaks + F.feltAfstand)));
	const fb = (brugB - (nx - 1) * F.feltAfstand) / nx;
	const fd = (brugD - (ny - 1) * F.feltAfstand) / ny;
	const felter = [];
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) felter.push({ x: k + i * (fb + F.feltAfstand), y: k + j * (fd + F.feltAfstand), b: fb, d: fd, navn: String.fromCharCode(65 + felter.length), moduler: 0 });

	const kollision = (x, y, b, d) => a.forhindringer.some((o) => x < o.x + o.b + 0.5 && x + b > o.x - 0.5 && y < o.y + o.d + 0.5 && y + d > o.y - 0.5);
	// Øst/vest-rækker: moduler på langs, to og to ryg mod ryg, gang imellem
	const moduler = [];
	const raekkeD = m.bredde * 2 + F.gang;
	// Fordel modulerne jævnt på felterne, så anlægget ikke klumper sig i det ene hjørne
	const maal = Math.ceil(antal / felter.length);
	for (const f of felter) {
		const start = moduler.length;
		fyld: for (let y = f.y; y + m.bredde * 2 <= f.y + f.d + 1e-6; y += raekkeD) {
			for (let x = f.x; x + m.laengde <= f.x + f.b + 1e-6; x += m.laengde + 0.02) {
				for (const dy of [0, m.bredde]) {
					if (moduler.length >= antal || moduler.length - start >= maal) break fyld;
					if (kollision(x, y + dy, m.laengde, m.bredde)) continue;
					moduler.push({ x, y: y + dy, b: m.laengde, d: m.bredde, felt: f.navn });
					f.moduler++;
				}
			}
		}
	}
	// Felternes ramme = det areal modulerne faktisk dækker
	for (const f of felter) {
		const ms = moduler.filter((x) => x.felt === f.navn);
		if (!ms.length) continue;
		const x0 = Math.min(...ms.map((q) => q.x)), y0 = Math.min(...ms.map((q) => q.y));
		const x1 = Math.max(...ms.map((q) => q.x + q.b)), y1 = Math.max(...ms.map((q) => q.y + q.d));
		Object.assign(f, { x: x0 - 0.3, y: y0 - 0.3, b: x1 - x0 + 0.6, d: y1 - y0 + 0.6 });
	}
	// Felter med samme navn i rækkefølge A, B, C …
	felter.filter((f) => f.moduler).forEach((f, i) => {
		const gl = f.navn;
		f.navn = String.fromCharCode(65 + i);
		moduler.forEach((q) => { if (q.felt === gl) q.feltNy = f.navn; });
	});
	moduler.forEach((q) => { if (q.feltNy) q.felt = q.feltNy; delete q.feltNy; });
	return { antal, placeret: moduler.length, moduler, felter: felter.filter((f) => f.moduler), kwpPlaceret: (moduler.length * m.wp) / 1000 };
}

// ---------- Produktion og forbrug ------------------------------------------------
const DAGE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// [andel af dagene, produktion i forhold til gennemsnittet]
const DAGTYPER = [[0.35, 1.72], [0.4, 0.8], [0.25, 0.32]];

// Solcelleproduktion i én time (kWh) for en typisk dag i måneden
function pvDoegn(kwp, mdr, F) {
	const aar = kwp * F.specifiktUdbytte;
	const dag = (aar * F.maanedsfordeling[mdr]) / DAGE[mdr];
	const L = F.dagslaengde[mdr];
	const op = 13 - L / 2; // soltid centreret om kl. 13 (sommertid/normaltid ca.)
	const raa = Array.from({ length: 24 }, (_, h) => {
		const t = h + 0.5 - op;
		return t > 0 && t < L ? Math.pow(Math.sin((Math.PI * t) / L), 1.5) : 0;
	});
	const sum = raa.reduce((s, v) => s + v, 0) || 1;
	return raa.map((v) => (v / sum) * dag);
}

// Supermarkedsprofil: køl/frost hele døgnet + åbningstid 7–22, lidt mere om sommeren
function forbrugDoegn(aarsforbrug, mdr) {
	const saeson = [0.95, 0.94, 0.96, 0.98, 1.02, 1.07, 1.1, 1.08, 1.02, 0.98, 0.95, 0.95];
	const profil = Array.from({ length: 24 }, (_, h) => (h >= 7 && h < 22 ? 1 : 0.62) * (h >= 10 && h < 18 ? 1.08 : 1));
	const vaegt = saeson.reduce((s, f, i) => s + f * DAGE[i], 0) * profil.reduce((s, v) => s + v, 0);
	return profil.map((v) => (aarsforbrug * v * saeson[mdr]) / vaegt);
}

export function beregn(a, F = FORUDSAETNINGER) {
	const maaneder = DAGE.map((dage, mdr) => {
		const pv = pvDoegn(a.kwp, mdr, F);
		const last = forbrugDoegn(a.aarsforbrug, mdr);
		let prod = 0, forbrug = 0, eget = 0;
		// Vejret varierer: solrige, skiftende og overskyede dage (vægtet, gennemsnit = 1)
		for (const [andel, faktor] of DAGTYPER) {
			for (let h = 0; h < 24; h++) {
				const p = pv[h] * faktor;
				prod += andel * p;
				forbrug += andel * last[h];
				eget += andel * Math.min(p, last[h]);
			}
		}
		return { produktion: prod * dage, forbrug: forbrug * dage, egetforbrug: eget * dage, fraNet: (forbrug - eget) * dage, tilNet: (prod - eget) * dage, doegn: { pv, last } };
	});
	const sum = (k) => maaneder.reduce((s, m) => s + m[k], 0);
	const total = { produktion: sum('produktion'), forbrug: sum('forbrug'), egetforbrug: sum('egetforbrug'), fraNet: sum('fraNet'), tilNet: sum('tilNet') };
	total.egetforbrugsandel = total.egetforbrug / total.produktion; // hvor meget af strømmen bruges selv
	total.daekning = total.egetforbrug / total.forbrug; // hvor meget af butikkens forbrug dækkes af sol
	total.vaerdi = total.egetforbrug * F.elpris + total.tilNet * F.salgspris;
	return { maaneder, total };
}
