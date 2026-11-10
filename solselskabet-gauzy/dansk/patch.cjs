// Gør Gauzys webapp dansk. Køres under `docker compose build` (se dansk/Dockerfile).
//
//   node patch.cjs <webapp-mappe> <dansk-mappe>
//
// 1. Sprogfilen:              assets/i18n/en.json  ← da.json
// 2. Indbyggede plugin-ordbøger: translations:{en:JSON.parse('…')}  ← plugins-da.json
// 3. Hårdkodede tekster i skabeloner og attributter  ← ui-tekster.json
// 4. Biblioteker (kalender, datovælger, rullelister, tabeller) og datoformater ← regler nedenfor
const fs = require('fs');
const path = require('path');
const [, , WEB, DA] = process.argv;
const læs = (f) => JSON.parse(fs.readFileSync(path.join(DA, f), 'utf8'));

// --- 1. Sprogfil -------------------------------------------------------------
fs.copyFileSync(path.join(DA, 'da.json'), path.join(WEB, 'assets/i18n/en.json'));
{
	const idx = path.join(WEB, 'index.html');
	let h = fs.readFileSync(idx, 'utf8');
	h = h.replace('<html lang="en"', '<html lang="da"').split('Loading dashboard').join('Indlæser overblik');
	fs.writeFileSync(idx, h);
}

const pluginDa = læs('plugins-da.json'); // { "<fil>#<n>": { ...ordbog } }
const ui = læs('ui-tekster.json'); // { "English": "Dansk" }

const jsStr = (lit) => Function('"use strict";return ' + lit)();
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');
const enkeltCitat = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(LS, '\\u2028').replace(PS, '\\u2029') + "'";
const oversæt = (raw) => {
	const t = raw.trim();
	if (!t || !ui[t]) return null;
	const lead = raw.slice(0, raw.indexOf(t));
	const trail = raw.slice(raw.indexOf(t) + t.length);
	return lead + ui[t] + trail;
};

// Danske måneds- og dagnavne
const MDR = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
const MDR_K = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];
const DAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const DAGE_K = ['søn.', 'man.', 'tirs.', 'ons.', 'tors.', 'fre.', 'lør.'];
const DAGE_M = ['sø', 'ma', 'ti', 'on', 'to', 'fr', 'lø'];
const arr = (a) => JSON.stringify(a);
const EN_MDR = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_MDR_K = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_DAGE = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_DAGE_K = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EN_DAGE_M = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Præcise erstatninger [fra, til]. Rækkefølgen betyder noget.
const REGLER = [
	// Angular, date-fns og Gauzy: lister med måneder/dage
	[arr(EN_MDR), arr(MDR)],
	[arr(EN_MDR_K), arr(MDR_K)],
	[arr(EN_DAGE), arr(DAGE)],
	[arr(EN_DAGE_K), arr(DAGE_K)],
	[arr(EN_DAGE_M), arr(DAGE_M)],
	// Angular 'en' datoformater → danske
	['["M/d/yy","MMM d, y","MMMM d, y","EEEE, MMMM d, y"]', `["dd.MM.y","d. MMM y","d. MMMM y","EEEE 'den' d. MMMM y"]`],
	['["h:mm\\u202fa","h:mm:ss\\u202fa","h:mm:ss\\u202fa z","h:mm:ss\\u202fa zzzz"]', '["HH.mm","HH.mm.ss","HH.mm.ss z","HH.mm.ss zzzz"]'],
	['["{1}, {0}",', '["{1} {0}",'],
	// moment (standard-locale)
	['"January_February_March_April_May_June_July_August_September_October_November_December"', JSON.stringify(MDR.join('_'))],
	['"Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec"', JSON.stringify(MDR_K.join('_'))],
	['"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday"', JSON.stringify(DAGE.join('_'))],
	['"Sun_Mon_Tue_Wed_Thu_Fri_Sat"', '"søn_man_tir_ons_tor_fre_lør"'],
	['"Su_Mo_Tu_We_Th_Fr_Sa"', '"sø_ma_ti_on_to_fr_lø"'],
	['calendar:{sameDay:"[Today at] LT",nextDay:"[Tomorrow at] LT",nextWeek:"dddd [at] LT",lastDay:"[Yesterday at] LT",lastWeek:"[Last] dddd [at] LT",sameElse:"L"}',
		'calendar:{sameDay:"[i dag kl.] LT",nextDay:"[i morgen kl.] LT",nextWeek:"[på] dddd [kl.] LT",lastDay:"[i går kl.] LT",lastWeek:"[sidste] dddd [kl.] LT",sameElse:"L"}'],
	['relativeTime:{future:"in %s",past:"%s ago",s:"a few seconds",ss:"%d seconds",m:"a minute",mm:"%d minutes",h:"an hour",hh:"%d hours",d:"a day",dd:"%d days",M:"a month",MM:"%d months",y:"a year",yy:"%d years"}',
		'relativeTime:{future:"om %s",past:"%s siden",s:"få sekunder",ss:"%d sekunder",m:"et minut",mm:"%d minutter",h:"en time",hh:"%d timer",d:"en dag",dd:"%d dage",M:"en måned",MM:"%d måneder",y:"et år",yy:"%d år"}'],
	['longDateFormat:{LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"}',
		'longDateFormat:{LTS:"HH:mm:ss",LT:"HH:mm",L:"DD.MM.YYYY",LL:"D. MMMM YYYY",LLL:"D. MMMM YYYY HH:mm",LLLL:"dddd [d.] D. MMMM YYYY [kl.] HH:mm"}'],
	['invalidDate:"Invalid date"', 'invalidDate:"Ugyldig dato"'],
	// Faste visningsformater i Gauzys kode
	['"MMM d, y"', '"d. MMM y"'],
	['"MMMM d, y"', '"d. MMMM y"'],
	['"MMM D, YYYY"', '"D. MMM YYYY"'],
	['"MMMM D, YYYY"', '"D. MMMM YYYY"'],
	['"hh:mm A"', '"HH:mm"'],
	['"h:mm A"', '"HH:mm"'],
	['"hh:mm a"', '"HH:mm"'],
	['"h:mm a"', '"HH:mm"'],
	// Kalender (FullCalendar)
	['Ce={code:"en",week:{dow:0,doy:4}', 'Ce={code:"da",week:{dow:1,doy:4}'], // dansk dato-/tidsformat og mandag som første ugedag
	['function tt(d){let a=d.length>0?d[0].code:"en"', 'function tt(d){let a=d.length>0?d[0].code:"da"'], // kalenderen bruger dansk, uanset browserens sprog
	['buttonText:{prev:"prev",next:"next",prevYear:"prev year",nextYear:"next year",year:"year",today:"today",month:"month",week:"week",day:"day",list:"list"},weekText:"W"',
		'buttonText:{prev:"forrige",next:"næste",prevYear:"forrige år",nextYear:"næste år",year:"år",today:"i dag",month:"måned",week:"uge",day:"dag",list:"liste"},weekText:"U"'],
	['weekTextLong:"Week",closeHint:"Close",timeHint:"Time",eventHint:"Event",allDayText:"all-day",moreLinkText:"more",noEventsText:"No events to display"',
		'weekTextLong:"Uge",closeHint:"Luk",timeHint:"Tid",eventHint:"Begivenhed",allDayText:"hele dagen",moreLinkText:"flere",noEventsText:"Ingen begivenheder"'],
	['buttonHints:{prev:"Previous $0",next:"Next $0",today:(d,a)=>"day"===a?"Today":`This ${d}`}', 'buttonHints:{prev:"Forrige $0",next:"Næste $0",today:(d,a)=>"day"===a?"I dag":`Denne ${d}`}'],
	// Datovælger (daterangepicker)
	['weekLabel:"W",applyLabel:"Apply",cancelLabel:"Cancel",clearLabel:"Clear",customRangeLabel:"Custom range"',
		'weekLabel:"U",applyLabel:"Anvend",cancelLabel:"Annuller",clearLabel:"Ryd",customRangeLabel:"Brugerdefineret periode"'],
	// Rullelister (ng-select)
	['this.notFoundText="No items found",this.typeToSearchText="Type to search",this.addTagText="Add item",this.loadingText="Loading...",this.clearAllText="Clear all",this.removeText="Remove",this.ariaLabelDropdown="Options List"',
		'this.notFoundText="Ingen resultater",this.typeToSearchText="Skriv for at søge",this.addTagText="Tilføj",this.loadingText="Indlæser...",this.clearAllText="Ryd alle",this.removeText="Fjern",this.ariaLabelDropdown="Valgmuligheder"'],
	// Tabeller (smart-table)
	['expand:{buttonContent:"Expand"}', 'expand:{buttonContent:"Udvid"}'],
	['noDataMessage:"No data found"', 'noDataMessage:"Ingen data fundet"'],
	['perPageSelectLabel:"Per Page:"', 'perPageSelectLabel:"Pr. side:"'],
	// Sideskift
	['" Showing ",t||0," of ",D||0," plugins "', '" Viser ",t||0," af ",D||0," plugins "'],
	['," of ",', '," af ",'],
	['"% of "', '"% af "'],
	['," hour")', '," timer")'],
	['," hour ")', '," timer ")'],
	['${n.selectedTimeFormat} hour`', '${n.selectedTimeFormat} timer`'],
	['," hour"]', '," timer"]'],
	['viewHint:"$0 view",navLinkHint:"Go to $0"', 'viewHint:"$0-visning",navLinkHint:"Gå til $0"'],
	['displayName:"All"}', 'displayName:"Alle"}'],
	['title:"Customers"', 'title:"Kunder"'],
	['t.bMT(6,6,a.contactType+"s")', 't.bMT(6,6,{customer:"Kunder",client:"Klienter",lead:"Leads"}[String(a.contactType).toLowerCase()]||a.contactType+"s")'],
	['title:"Clients"', 'title:"Klienter"'],
	['title:"Leads"', 'title:"Leads"'],
	// Vælgere i topbaren og datointervaller
	['name:"All Teams"', 'name:"Alle teams"'],
	['name:"All Projects"', 'name:"Alle projekter"'],
	['firstName:"All Employees"', 'firstName:"Alle medarbejdere"'],
	['.TODAY="Today",', '.TODAY="I dag",'],
	['.YESTERDAY="Yesterday",', '.YESTERDAY="I går",'],
	['.CURRENT_WEEK="Current Week",', '.CURRENT_WEEK="Denne uge",'],
	['.LAST_WEEK="Last Week",', '.LAST_WEEK="Sidste uge",'],
	['.CURRENT_MONTH="Current Month",', '.CURRENT_MONTH="Denne måned",'],
	['.LAST_MONTH="Last Month",', '.LAST_MONTH="Sidste måned",'],
	['"hide password":"show password"', '"skjul adgangskode":"vis adgangskode"']
];

const reEff = /\.EFF\((\d+),("(?:[^"\\]|\\.)*")\)/g;
const reAttr = /"(placeholder|aria-label|title|nbTooltip|alt|label)","((?:[^"\\]|\\.)*)"/g;
const START = "translations:{en:JSON.parse('";
const START2 = "'),en:JSON.parse('"; // ordbøger hvor engelsk ikke står først
const tæl = { filer: 0, plugin: 0, tekst: 0, attr: 0 };
const regelBrugt = new Array(REGLER.length).fill(0);

for (const f of fs.readdirSync(WEB).filter((f) => f.endsWith('.js'))) {
	const fil = path.join(WEB, f);
	const før = fs.readFileSync(fil, 'utf8');
	let s = før;

	// 2. Plugin-ordbøger
	let n = 0;
	let i = s.indexOf(START);
	while (i >= 0) {
		const q = i + START.length - 1;
		let j = q + 1;
		for (; j < s.length; j++) {
			if (s[j] === '\\') { j++; continue; }
			if (s[j] === "'") break;
		}
		const da = pluginDa[`${f}#${n}`];
		if (da) {
			const ny = enkeltCitat(JSON.stringify(da));
			s = s.slice(0, q) + ny + s.slice(j + 1);
			j = q + ny.length - 1;
			tæl.plugin++;
		}
		n++;
		i = s.indexOf(START, j);
	}
	// Ordbøger hvor 'en' står efter andre sprog
	let e = 0;
	let i2 = s.indexOf(START2);
	while (i2 >= 0) {
		const q = i2 + START2.length - 1;
		let j = q + 1;
		for (; j < s.length; j++) {
			if (s[j] === '\\') { j++; continue; }
			if (s[j] === "'") break;
		}
		const da = pluginDa[`${f}#ekstra${e || ''}`];
		if (da) {
			const ny = enkeltCitat(JSON.stringify(da));
			s = s.slice(0, q) + ny + s.slice(j + 1);
			j = q + ny.length - 1;
			tæl.plugin++;
		}
		e++;
		i2 = s.indexOf(START2, j);
	}

	// 3. Skabelontekst og attributter
	s = s.replace(reEff, (m, nr, lit) => {
		const ny = oversæt(jsStr(lit));
		if (ny === null) return m;
		tæl.tekst++;
		return `.EFF(${nr},${JSON.stringify(ny)})`;
	});
	s = s.replace(reAttr, (m, navn, raw) => {
		let v;
		try { v = jsStr('"' + raw + '"'); } catch { return m; }
		const ny = oversæt(v);
		if (ny === null) return m;
		tæl.attr++;
		return `"${navn}",${JSON.stringify(ny)}`;
	});

	// 4. Faste regler
	REGLER.forEach(([fra, til], k) => {
		if (s.includes(fra)) {
			regelBrugt[k] += s.split(fra).length - 1;
			s = s.split(fra).join(til);
		}
	});

	if (s !== før) {
		fs.writeFileSync(fil, s);
		tæl.filer++;
	}
}

const ubrugte = REGLER.filter((_, k) => !regelBrugt[k]).map(([fra]) => fra.slice(0, 60));
console.log(`Dansk: ${tæl.filer} filer ændret · ${tæl.plugin} plugin-ordbøger · ${tæl.tekst} skabelontekster · ${tæl.attr} attributter · ${regelBrugt.filter(Boolean).length}/${REGLER.length} regler`);
if (ubrugte.length) console.log('Regler uden match (Gauzy-versionen kan have ændret sig):\n  ' + ubrugte.join('\n  '));
