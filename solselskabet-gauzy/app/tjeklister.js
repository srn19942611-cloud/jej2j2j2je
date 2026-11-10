// Tjeklister og felter som håndværkeren udfylder på telefonen.
// Bruges både af mobil-appen og af seed-scriptet. Nøglen er opgavens titel (uden "01. ").
//
// Felttyper:
//   check     Ja / Nej / Ikke relevant
//   tekst     fritekst            (flere linjer med `linjer: 3`)
//   tal       tal med `enhed`
//   valg      ét af `muligheder`
//   foto      billeder fra kameraet, `min` = mindste antal
//   signatur  underskrift med fingeren
// `krav: true` = skal være udfyldt, før opgaven kan sendes til godkendelse.

export const TJEKLISTER = {
	'Screening af lokation': [
		{ id: 'tag_type', type: 'valg', label: 'Tagtype', muligheder: ['Tagpap', 'Stål/trapez', 'Eternit/fibercement', 'Tegl', 'Andet'], krav: true },
		{ id: 'tag_haeldning', type: 'tal', label: 'Taghældning', enhed: '°' },
		{ id: 'tag_stand', type: 'valg', label: 'Tagets stand', muligheder: ['God', 'Middel', 'Dårlig – skal renoveres'], krav: true },
		{ id: 'skygge', type: 'tekst', label: 'Skyggegivere (ventilation, skilte, træer, naboer)' },
		{ id: 'adgang', type: 'tekst', label: 'Adgang til tag og kranplads' },
		{ id: 'tavle', type: 'tekst', label: 'Eltavle: placering, plads og hovedsikring' },
		{ id: 'teknikrum', type: 'check', label: 'Mulighed for teknikrum med 60 min. brandmodstand' },
		{ id: 'foto_tag', type: 'foto', label: 'Fotos af tagflader', min: 3, krav: true },
		{ id: 'foto_tavle', type: 'foto', label: 'Foto af eltavle og måler', min: 1, krav: true },
		{ id: 'noter', type: 'tekst', label: 'Øvrige bemærkninger', linjer: 3 }
	],
	'Montage på tag': [
		{ id: 'sikkerhed', type: 'check', label: 'Faldsikring og afspærring etableret', krav: true },
		{ id: 'butik_info', type: 'check', label: 'Butikschef orienteret om arbejdet i dag', krav: true },
		{ id: 'montagesystem', type: 'check', label: 'Montagesystem monteret iht. statik og montagevejledning', krav: true },
		{ id: 'tagmembran', type: 'check', label: 'Tagmembran/gennemføringer tætnet og kontrolleret', krav: true },
		{ id: 'felter', type: 'check', label: 'Feltstørrelse maks. 40 × 40 m overholdt', krav: true },
		{ id: 'afstand_felter', type: 'tal', label: 'Afstand mellem felter', enhed: 'm', krav: true },
		{ id: 'afstand_brand', type: 'tal', label: 'Afstand til nærmeste brandåbning', enhed: 'm', krav: true },
		{ id: 'antal_moduler', type: 'tal', label: 'Antal monterede moduler', enhed: 'stk', krav: true },
		{ id: 'dc_foering', type: 'check', label: 'DC-kabler fastgjort, ikke liggende på tagfladen', krav: true },
		{ id: 'mc4', type: 'check', label: 'MC4-stik samme fabrikat (han/hun) og korrekt presset', krav: true },
		{ id: 'foto_felter', type: 'foto', label: 'Fotos af hvert felt', min: 2, krav: true },
		{ id: 'foto_detaljer', type: 'foto', label: 'Fotos af gennemføringer og kabelføring', min: 2, krav: true },
		{ id: 'afvigelser', type: 'tekst', label: 'Afvigelser fra projektet', linjer: 3 }
	],
	'AC-tilslutning, SPD og eltavle': [
		{ id: 'spd_dc', type: 'check', label: 'SPD monteret på DC-siden', krav: true },
		{ id: 'spd_ac', type: 'check', label: 'SPD monteret på AC-siden', krav: true },
		{ id: 'inverter_placering', type: 'valg', label: 'Inverterens placering', muligheder: ['På tag (ikke-brandbar konstruktion)', 'Teknikrum 60 min.', 'Andet – beskriv'], krav: true },
		{ id: 'sikring', type: 'tal', label: 'Forsikring til anlæg', enhed: 'A', krav: true },
		{ id: 'noedstop', type: 'check', label: 'Brandmandsafbryder/nødstop monteret og skiltet', krav: true },
		{ id: 'maerkning', type: 'check', label: 'Tavle og kabler mærket', krav: true },
		{ id: 'foto_tavle', type: 'foto', label: 'Foto af tavle efter tilslutning', min: 1, krav: true },
		{ id: 'foto_inverter', type: 'foto', label: 'Foto af inverter og typeskilt', min: 1, krav: true }
	],
	'Idriftsættelse og test': [
		{ id: 'isolation', type: 'tal', label: 'Isolationsmåling (laveste streng)', enhed: 'MΩ', krav: true },
		{ id: 'voc', type: 'tal', label: 'Tomgangsspænding Voc (streng 1)', enhed: 'V', krav: true },
		{ id: 'isc', type: 'tal', label: 'Kortslutningsstrøm Isc (streng 1)', enhed: 'A', krav: true },
		{ id: 'polaritet', type: 'check', label: 'Polaritet kontrolleret på alle strenge', krav: true },
		{ id: 'jord', type: 'check', label: 'Potentialudligning/jording målt', krav: true },
		{ id: 'produktion', type: 'tal', label: 'Aktuel AC-effekt ved idriftsættelse', enhed: 'kW' },
		{ id: 'overvaagning', type: 'check', label: 'Overvågning online og viser data', krav: true },
		{ id: 'foto_display', type: 'foto', label: 'Foto af inverter-display/portal', min: 1, krav: true },
		{ id: 'maalerapport', type: 'foto', label: 'Foto af måleprotokol', min: 1 }
	],
	'Aflevering og godkendelse': [
		{ id: 'gennemgang', type: 'check', label: 'Fælles gennemgang på stedet gennemført', krav: true },
		{ id: 'ks_modtaget', type: 'check', label: 'KS-pakke modtaget og gennemgået', krav: true },
		{ id: 'dkv', type: 'check', label: 'DKV-plan og beredskabsplan udleveret', krav: true },
		{ id: 'skilte', type: 'check', label: 'Advarselsskilte for solceller opsat (tavle og indgang)', krav: true },
		{ id: 'mangler', type: 'tekst', label: 'Mangler ved aflevering', linjer: 4 },
		{ id: 'mangel_frist', type: 'tekst', label: 'Frist for udbedring af mangler' },
		{ id: 'foto_aflevering', type: 'foto', label: 'Oversigtsfotos', min: 2 },
		{ id: 'sign_leverandoer', type: 'signatur', label: 'Underskrift Solselskabet', krav: true },
		{ id: 'sign_coop', type: 'signatur', label: 'Underskrift Coop', krav: true }
	],
	'Årligt serviceeftersyn pr. anlæg': [
		{ id: 'visuelt', type: 'check', label: 'Visuel kontrol af moduler (revner, misfarvning, snavs)', krav: true },
		{ id: 'montage', type: 'check', label: 'Montagesystem og ballast kontrolleret', krav: true },
		{ id: 'kabler', type: 'check', label: 'Kabler og MC4-stik uden skader', krav: true },
		{ id: 'inverter_fejl', type: 'tekst', label: 'Fejllog fra inverter' },
		{ id: 'aarsproduktion', type: 'tal', label: 'Produktion seneste 12 mdr.', enhed: 'kWh' },
		{ id: 'tilstand', type: 'valg', label: 'Samlet vurdering', muligheder: ['I orden', 'Mindre fejl – udbedret', 'Fejl – kræver opfølgning'], krav: true },
		{ id: 'foto', type: 'foto', label: 'Fotos fra eftersynet', min: 2, krav: true },
		{ id: 'sign', type: 'signatur', label: 'Underskrift servicetekniker', krav: true }
	],
	'Termografi og kontrol af DC-forbindelser': [
		{ id: 'irradians', type: 'tal', label: 'Indstråling under måling', enhed: 'W/m²', krav: true },
		{ id: 'hotspots', type: 'tal', label: 'Antal hotspots fundet', enhed: 'stk', krav: true },
		{ id: 'beskrivelse', type: 'tekst', label: 'Placering og vurdering af hotspots', linjer: 3 },
		{ id: 'foto_ir', type: 'foto', label: 'Termografibilleder', min: 1, krav: true }
	]
};

// Alle andre opgaver får en kort standardtjekliste.
export const STANDARD_TJEKLISTE = [
	{ id: 'udfoert', type: 'check', label: 'Opgaven er udført', krav: true },
	{ id: 'noter', type: 'tekst', label: 'Noter', linjer: 3 },
	{ id: 'foto', type: 'foto', label: 'Fotos / dokumentation', min: 0 }
];

export function tjeklisteFor(titel) {
	const ren = String(titel || '').replace(/^\d+\.\s*/, '').trim();
	return TJEKLISTER[ren] || STANDARD_TJEKLISTE;
}

// Er et felt udfyldt?
export function erUdfyldt(felt, svar) {
	const v = svar?.[felt.id];
	if (felt.type === 'foto') return Array.isArray(v) && v.length >= Math.max(1, felt.min || 1);
	if (felt.type === 'check') return v === 'ja' || v === 'nej' || v === 'ir';
	return v !== undefined && v !== null && String(v).trim() !== '';
}

export function mangler(felter, svar) {
	return felter.filter((f) => f.krav && !erUdfyldt(f, svar));
}
