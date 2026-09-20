/* Fagligt grundlag: faggrupper, målertags, detektorkatalog og fejlkort.
 *
 * Faggrupper og farver følger opsætningen i Coops energirapportering, så en
 * sag i hubben og en linje i månedsrapporten taler om det samme.
 *
 * Målertaggene er Enitys egne: hvert målepunkt bærer "custom:L0/1 <faggruppe>",
 * ofte suppleret med L2 (anlæg), L3 (zone) og L4 (delkomponent). Vi gætter
 * derfor ikke ud fra målernavne — vi læser den klassifikation, driften selv
 * har lagt ind. Navneparseren nedenfor er kun en nødplan for de målere,
 * der endnu ikke er tagget.
 */

export const FAGGRUPPER = [
  { key: 'koel_frys',      navn: 'Køl & frys',           farve: '#1f6feb', enhed: 'el',    rolle: 'Køleansvarlig',           fag: 'Køletekniker',        def: 'Kompressorer, konsumkøl, frost, kondensatorer og tilhørende teknik.' },
  { key: 'koeleflader',    navn: 'Køleflader/klima',     farve: '#22a6b3', enhed: 'el',    rolle: 'Ventilationsansvarlig',   fag: 'Ventilationstekniker',def: 'Køleflader i ventilation og komfortkøling.' },
  { key: 'ventilation',    navn: 'Ventilation',          farve: '#00b894', enhed: 'el',    rolle: 'Ventilationsansvarlig',   fag: 'Ventilationstekniker',def: 'Ventilationsanlæg, AHU og aggregater uden køle-/varmeflade.' },
  { key: 'lys_inde',       navn: 'Belysning indendørs',  farve: '#f2c744', enhed: 'el',    rolle: 'Energiansvarlig',         fag: 'Elektriker',          def: 'Salgs- og baglokalebelysning.' },
  { key: 'lys_ude',        navn: 'Udendørsbelysning',    farve: '#e58e26', enhed: 'el',    rolle: 'Energiansvarlig',         fag: 'Elektriker',          def: 'Facade, skilte og parkeringsbelysning.' },
  { key: 'varme_fjern',    navn: 'Varme fjernvarme',     farve: '#c0392b', enhed: 'varme', rolle: 'Energi- og VVS-ansvarlig',fag: 'VVS',                 def: 'Fjernvarme til radiatorer, varmeflader og varmt brugsvand.' },
  { key: 'varme_el',       navn: 'Varme el/varmepumpe',  farve: '#8e44ad', enhed: 'el',    rolle: 'Energi- og VVS-ansvarlig',fag: 'VVS',                 def: 'Elvarme, varmepumper og varmetæpper.' },
  { key: 'overskudsvarme', navn: 'Overskudsvarme (HRU)', farve: '#16a085', enhed: 'varme', rolle: 'Energi- og VVS-ansvarlig',fag: 'VVS',                 def: 'Leveret varme fra køleanlæg — vises som leveret, ikke som forbrug.' },
  { key: 'vand',           navn: 'Vand',                 farve: '#2980b9', enhed: 'vand',  rolle: 'Energi- og VVS-ansvarlig',fag: 'VVS',                 def: 'Brugsvand: toiletter, køkken og produktion, rengøring, vanding og køling med brugsvand. Måles i m³.' },
  { key: 'solceller',      navn: 'Solceller',            farve: '#d68910', enhed: 'el',    rolle: 'Solcelleansvarlig',       fag: 'Elektriker',          def: 'Produktion, strenge og invertere. Vises som produktion, ikke forbrug.' },
  { key: 'cts',            navn: 'CTS & teknik',         farve: '#636e72', enhed: 'el',    rolle: 'CTS-ansvarlig',           fag: 'CTS-programmør',      def: 'CTS, automatik, IT og teknisk udstyr.' },
  { key: 'produktion',     navn: 'Produktion & køkken',  farve: '#d35400', enhed: 'el',    rolle: 'Ikke besat',              fag: 'Serviceleverandør',   def: 'Ovne, friture, kipsteger, komfurer og andet bageri- og slagterudstyr. Eget fagområde — ikke teknisk bygningsdrift.' },
  { key: 'lejere',         navn: 'Lejere',               farve: '#5d6d7e', enhed: 'el',    rolle: 'Energiansvarlig',         fag: '—',                   def: 'Fremlejet forbrug. Trækkes ud af butikkens eget nøgletal.' },
  { key: 'oevrigt',        navn: 'Øvrigt/uspecificeret', farve: '#95a5a6', enhed: 'el',    rolle: 'Energiansvarlig',         fag: 'Elektriker',                   def: 'Restpost og målepunkter uden sikker kategori.' },
];

export const FG = Object.fromEntries(FAGGRUPPER.map((f) => [f.key, f]));
export const fgNavn  = (k) => (FG[k] ? FG[k].navn : k);
export const fgFarve = (k) => (FG[k] ? FG[k].farve : '#95a5a6');

/* ---- Målepunkt-klassifikation --------------------------------------------
 * Den rigtige tagmapping ligger i anlaeg.js: 61 regler over fire niveauer,
 * hentet fra Coop Energi Einsight. Den er den eneste kilde — den tidligere
 * håndlavede tabel her er fjernet, så der ikke er to steder at rette.
 */
export { klassificerMaalepunkt, klassificerMaalepunkt as klassificerMaaler, TAGMAPPING } from './anlaeg.js';

/* ---- Detektorkatalog ------------------------------------------------------
 * En detektor finder et symptom, aldrig en diagnose. "kraever" er de kilder,
 * detektoren ikke kan klare sig uden — den er derfor kun i drift, når de er
 * koblet på. Status følger bølgeplanen: bølge 1 kan køre på Enity alene.
 */
export const DETEKTORER = [
  { id: 'D-01', navn: 'Basislast om natten',        kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'drift',
    symptom: 'Forbrug i lukketimer over butikkens eget normalniveau.',
    kraever: ['Enity timeserie', 'Åbningstider'], mangler: ['CTS-tidsplan', 'Unikair driftstilstand'],
    sagstype: 'Noget kører, når butikken er lukket' },
  { id: 'D-02', navn: 'Ny konstant last',           kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'drift',
    symptom: 'Forbruget hopper til et nyt niveau og bliver liggende.',
    kraever: ['Enity døgn-/månedsserie'], mangler: ['Hændelser', 'Dalux-opgaver i perioden'],
    sagstype: 'En installation blev tændt og aldrig slukket' },
  { id: 'D-03', navn: 'Bimålersum mod hovedmåler',  kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'drift',
    symptom: 'Summen af bimålere passer ikke med forsyningsmåleren.',
    kraever: ['Målerhierarki', 'Enity månedsdata'], mangler: [],
    sagstype: 'Manglende bimåler, defekt måler eller uidentificeret forbrug' },
  { id: 'D-04', navn: 'Måler uden data',            kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'drift',
    symptom: 'Et målepunkt med tag leverer nul eller intet i en periode, hvor butikken kører.',
    kraever: ['Enity månedsdata'], mangler: [],
    sagstype: 'Defekt måler eller afbrudt dataopsamling' },
  { id: 'D-05', navn: 'Benchmark pr. m²',           kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'drift',
    symptom: 'Butikken ligger højt mod sammenlignelige butikker i samme kæde.',
    kraever: ['Salgsareal fra Dalux', 'Enity årsforbrug'], mangler: [],
    sagstype: 'Kandidat til gennemgang — ikke en fejl i sig selv' },
  { id: 'D-06', navn: 'Køleandel mod naboer',       kilde: 'Enity',  fg: 'koel_frys',   boelge: 1, status: 'skygge',
    symptom: 'Køl fylder mere af butikkens el end hos butikker med samme anlægstype.',
    kraever: ['Bimåler køl', 'Peer-gruppe'], mangler: ['AK-centralen', 'Vejrdata'],
    sagstype: 'Køleanlægget yder dårligere end porteføljen' },
  { id: 'D-07', navn: 'Produktion mod forventet',   kilde: 'Solcelleplatform', fg: 'solceller', boelge: 1, status: 'skygge',
    symptom: 'Anlægget yder under den model, indstrålingen tilsiger.',
    kraever: ['Indstrålingsdata', 'Forventet produktion', 'Inverter-API'],
    mangler: ['Kalibreret forventningsmodel — PR over 1,0 på over halvdelen af anlæggene'],
    sagstype: 'Underproduktion — årsag skal findes' },
  { id: 'D-08', navn: 'Gradvist fald uden fejl',    kilde: 'Solcelleplatform', fg: 'solceller', boelge: 1, status: 'skygge',
    symptom: 'Produktionen falder over måneder uden fejlkoder.',
    kraever: ['Degraderingsberegning', 'Nedbørsdata'],
    mangler: ['Statistisk sikre degraderingstal — 0 af 629 er sikre endnu'],
    sagstype: 'Nedsmudsning — planlæg rens frem for hastesag' },
  { id: 'D-21', navn: 'Nulproduktion 24 timer',     kilde: 'Solcelleplatform', fg: 'solceller', boelge: 1, status: 'skygge',
    symptom: 'Anlægget har ikke produceret i et helt døgn med dagslys.',
    kraever: ['Inverter-API', 'Vejrdata'],
    mangler: ['Adskillelse af anlægsfejl fra integrationsfejl — alle 14 åbne alarmer kommer fra samme datakilde'],
    sagstype: 'Anlæg står stille — eller integrationen leverer ikke' },
  { id: 'D-22', navn: 'Strengafvigelse',            kilde: 'Solcelleplatform', fg: 'solceller', boelge: 1, status: 'skygge',
    symptom: 'Én streng eller MPPT ligger under sine søskende på samme anlæg.',
    kraever: ['Strengniveau fra inverter'], mangler: [],
    sagstype: 'Streng ude, defekt panel eller ny skygge' },
  { id: 'D-09', navn: 'Lukkedag mod åbningstid',    kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'skygge',
    symptom: 'Forholdet mellem lukket og åben skrider.',
    kraever: ['Åbningstider i stamdata', 'Enity timeserie'], mangler: ['Bekræftede åbningstider fra Dalux'],
    sagstype: 'Tidsplan følger ikke de faktiske åbningstider' },
  { id: 'D-10', navn: 'Effektspids',                kilde: 'Enity',  fg: 'oevrigt',     boelge: 1, status: 'planlagt',
    symptom: 'Nye spidser, der rammer effekttariffen.',
    kraever: ['Enity 15-min data'], mangler: ['AK samtidig kompressordrift', 'CTS'],
    sagstype: 'Sammenfald, der kan forskydes' },
  { id: 'D-11', navn: 'Møbeltemperatur over setpunkt', kilde: 'AK-centralen', fg: 'koel_frys', boelge: 2, status: 'planlagt',
    symptom: 'Temperatur uden for bånd i sammenhængende perioder.',
    kraever: ['AK-centralen'], mangler: ['AK-centralen (adgang ikke etableret)'],
    sagstype: 'Fødevaresikkerhed — altid højeste prioritet', p1: true },
  { id: 'D-12', navn: 'Kondenstryk mod udetemperatur', kilde: 'AK-centralen', fg: 'koel_frys', boelge: 2, status: 'planlagt',
    symptom: 'Kondensering højere, end vejret tilsiger.',
    kraever: ['AK-centralen', 'Vejrdata', 'Enity bimåler køl'], mangler: ['AK-centralen', 'Vejrdata'],
    sagstype: 'Snavset kondensator eller fejl på kondensatorventilator' },
  { id: 'D-13', navn: 'Afrimning',                  kilde: 'AK-centralen', fg: 'koel_frys', boelge: 2, status: 'planlagt',
    symptom: 'For hyppig, for lang, eller afsluttet på tid frem for temperatur.',
    kraever: ['AK-centralen'], mangler: ['AK-centralen'],
    sagstype: 'Afrimningsindstilling koster energi og giver istilvækst' },
  { id: 'D-14', navn: 'Gentagne alarmer',           kilde: 'AK-centralen', fg: 'koel_frys', boelge: 2, status: 'planlagt',
    symptom: 'Samme alarm i samme møbel igen efter kvittering.',
    kraever: ['AK-centralen', 'Dalux-opgavehistorik'], mangler: ['AK-centralen'],
    sagstype: 'Symptombehandling — den egentlige fejl er aldrig fundet' },
  { id: 'D-15', navn: 'Natsænkning virker ikke',    kilde: 'CTS Ltech', fg: 'cts',       boelge: 3, status: 'planlagt',
    symptom: 'Tidsplan siger sænkning, driften siger andet.',
    kraever: ['CTS Ltech', 'Enity natforbrug', 'Unikair'], mangler: ['CTS Ltech', 'Unikair'],
    sagstype: 'Tidsplan eller override' },
  { id: 'D-16', navn: 'Samtidig køl og varme',      kilde: 'CTS Ltech', fg: 'cts',       boelge: 3, status: 'planlagt',
    symptom: 'Køl og varme aktive i samme zone samtidig.',
    kraever: ['CTS Ltech', 'AK-centralen'], mangler: ['CTS Ltech', 'AK-centralen'],
    sagstype: 'Systemerne modarbejder hinanden — ingen alarm nogen steder' },
  { id: 'D-17', navn: 'Filtertryk',                 kilde: 'Unikair', fg: 'ventilation',  boelge: 3, status: 'planlagt',
    symptom: 'Tryktabet over filteret passerer grænsen.',
    kraever: ['Unikair'], mangler: ['Unikair (API ukendt)'],
    sagstype: 'Filterskift når det er nødvendigt, ikke efter kalender' },
  { id: 'D-30', navn: 'Normallast pr. anlæg', kilde: 'Enity + vejr', fg: 'oevrigt', boelge: 1, status: 'skygge',
    symptom: 'Anlægget bruger mere, end det plejer at gøre under de samme forhold — vejr, ugedag og åbningstid.',
    kraever: ['Anlæg koblet til målepunkt', 'Døgnserie', 'Vejrdata'],
    mangler: ['Dedikeret måler på anlægget — kun 3,3 % af målerne bærer en anlægskode'],
    sagstype: 'Merforbrug på et bestemt anlæg' },
  { id: 'D-31', navn: 'Niveauskift på anlæg', kilde: 'Enity + vejr', fg: 'oevrigt', boelge: 1, status: 'skygge',
    symptom: 'Forbruget flyttede sig til et nyt niveau og blev der.',
    kraever: ['Døgnserie', 'Normallast'], mangler: [],
    sagstype: 'En indstilling eller en komponent ændrede sig på en bestemt dato' },
  { id: 'D-32', navn: 'Brudt vejrrespons', kilde: 'Enity + vejr', fg: 'oevrigt', boelge: 1, status: 'skygge',
    symptom: 'Anlægget holdt op med at reagere på udetemperaturen.',
    kraever: ['Vejrdata', 'Mindst 90 døgn'], mangler: [],
    sagstype: 'Anlægget står i manuel drift eller kører konstant' },
  { id: 'D-19', navn: 'Gentagne opgaver på samme anlæg', kilde: 'Dalux FM', fg: 'oevrigt', boelge: 1, status: 'drift',
    symptom: 'Det samme anlæg er meldt ind gentagne gange, og fejlen kommer igen efter hver lukket opgave.',
    kraever: ['Dalux opgavehistorik', 'Fagområde-klassificering'], mangler: ['Forventet pris pr. opgave fra Dalux'],
    sagstype: 'Symptombehandling — den egentlige fejl er aldrig fundet' },
  { id: 'D-20', navn: 'Butik med gentagne fejl', kilde: 'Dalux FM', fg: 'oevrigt', boelge: 1, status: 'drift',
    symptom: 'Butikken melder den samme slags fejl ind igen og igen på tværs af flere anlæg.',
    kraever: ['Dalux opgavehistorik', 'Fagområde-klassificering'], mangler: ['Butiksformat til sammenligning'],
    sagstype: 'Anlægsporteføljen er ved at være udtjent' },
  { id: 'D-18', navn: 'Varme afvist og købt samtidig', kilde: 'Leanheat', fg: 'overskudsvarme', boelge: 4, status: 'planlagt',
    symptom: 'Overskudsvarme dumpes, mens der købes fjernvarme.',
    kraever: ['Leanheat', 'Enity fjernvarme', 'CTS varmebehov'], mangler: ['Leanheat', 'CTS Ltech'],
    sagstype: 'Det dyreste enkeltmønster vi har — to systemer der modarbejder hinanden' },
];

/* ---- Fejlkort -------------------------------------------------------------
 * Fagbogens enhed. Felterne i kantede parenteser udfyldes af den fagansvarlige;
 * de er med vilje ikke gættet af en model. "ligner" er feltet, der fjerner
 * flest falske alarmer, og derfor det, der skal være grundigst udfyldt.
 */
export const FEJLKORT = [
  {
    nr: 'K-04', navn: 'Snavset eller tildækket kondensator', fg: 'koel_frys', fag: 'Køletekniker',
    ejer: 'Køleansvarlig', version: '1.0', status: 'udkast',
    anlaegstype: '[udfyldes — grænserne er forskellige på CO₂ transkritisk og HFC]',
    symptomer: 'Kondenseringstemperaturen ligger over det, udetemperaturen tilsiger, med [X] K eller mere. Stigningen er gradvis over uger. Bimåleren på køl viser merforbrug i samme periode. Værst i dagens varmeste timer.',
    ligner: 'Almindelig sommerdrift (høj udetemperatur). Defekt eller stoppet kondensatorventilator. [Kølemiddelforhold — udfyldes]. Tilstoppet luftindtag frem for snavset flade.',
    skelnes: 'Sæson følger vejret time for time og forsvinder om natten — tilsmudsning gør ikke. Ventilatorfejl giver et pludseligt spring, ikke en gradvis stigning over uger. Sammenlign med de øvrige butikker med samme anlægstype samme dag: er de også høje, er det vejret, ikke anlægget.',
    bekraeftes: '1) Visuel inspektion af kondensatorflade og luftindtag — fem minutter, og afgør sagen i de fleste tilfælde. 2) Tjek at alle kondensatorventilatorer kører. 3) Først derefter måling.',
    koster: '[kr./år pr. K forhøjet kondensering] × antal K. Beregningsmetoden ligger i kodelageret og kan efterprøves.',
    gentagelse: 'Inden for 6 måneder: undersøg placering, luftgennemstrømning og afstand til andre varmekilder. Gentagen tilsmudsning er et placeringsproblem, ikke et rengøringsproblem.',
  },
  {
    nr: 'E-01', navn: 'Ny konstant last', fg: 'oevrigt', fag: 'Elektriker',
    ejer: 'Energiansvarlig', version: '0.9', status: 'udkast',
    anlaegstype: 'Alle butiksformater',
    symptomer: 'Forbruget hopper til et nyt niveau inden for et døgn og bliver liggende. Springet ses både dag og nat, og natniveauet flytter sig lige så meget som dagniveauet.',
    ligner: 'Sæsonskifte (kommer gradvist, ikke som et spring). Ombygning eller nyt møbel sat i drift — en reel ændring, ikke en fejl. Målerskifte, hvor en bimåler er faldet ud af summen. Ny lejer.',
    skelnes: 'Et spring, der kun ses om dagen, er drift; et spring, der også flytter natniveauet, er en installation, der står tændt. Slå op i Dalux, om der er lukket en opgave i butikken i samme uge — og i hændelseslisten, om der er registreret en ombygning.',
    bekraeftes: '1) Sammenhold springet med Dalux-opgaver og hændelser i vinduet. 2) Aflæs bimålerne og find ud af, hvilken gruppe springet ligger i. 3) Er springet i restposten, mangler der en bimåler — det er en selvstændig sag.',
    koster: 'Δ kWh/døgn × 365 × elpris. Regnes i kode; metoden vises i sagen.',
    gentagelse: 'Kommer den samme last igen efter at være slukket, er der en styring eller en vane bag — ikke en enkeltstående fejl.',
  },
  {
    nr: 'M-01', navn: 'Manglende bimåler / lav datadækning', fg: 'oevrigt', fag: 'Elektriker',
    ejer: 'Energiansvarlig', version: '1.0', status: 'udkast',
    anlaegstype: 'Alle butiksformater',
    symptomer: 'Restposten (forsyningsmåler minus summen af bimålere) overstiger [30] % af butikkens el. Restposten følger butikkens samlede profil, dvs. den er ikke ét enkelt anlæg.',
    ligner: 'Defekt bimåler, der står stille (se M-02). Bimåler, der er faldet ud af Enity. Anlæg, der reelt aldrig er blevet målt. Lejerforbrug, der ikke er trukket ud.',
    skelnes: 'Står én måler helt på nul, er det en målerfejl — fordeler restposten sig jævnt over døgnet, mangler der et målepunkt. Sammenlign med butikker af samme format og byggeår: har de samme hul, er det et designproblem, ikke en butiksfejl.',
    bekraeftes: '1) Gennemgå målerlisten mod eltavlen på stedet. 2) Notér hvilke grupper der ikke er målt. 3) Prissæt en eftermontering mod den mængde forbrug, der bliver synlig.',
    koster: 'Ikke et spild i sig selv. Værdien er, at alt forbrug under restposten er usynligt for alle andre detektorer — sagen prissættes som den andel af butikkens forbrug, der ikke kan overvåges.',
    gentagelse: 'Optræder hullet i mange butikker med samme format, er det ét indkøbs- og designproblem, ikke mange serviceopgaver.',
  },
];

/* ---- Prioritering --------------------------------------------------------- */
export const PRIORITETER = {
  P1: { navn: 'P1', kriterium: 'Fødevaresikkerhed eller risiko for anlægsskade', handling: 'Besked samme dag, uanset beløb. Ingen tærskel gælder her.' },
  P2: { navn: 'P2', kriterium: 'Over 25.000 kr./år, eller vokser hurtigt',       handling: 'I den fagansvarliges kø, behandles inden for en uge.' },
  P3: { navn: 'P3', kriterium: '5.000–25.000 kr./år',                            handling: 'Planlægges. Samles med andre opgaver i samme butik.' },
  P4: { navn: 'P4', kriterium: 'Under 5.000 kr./år',                             handling: 'Kommer på en liste, ikke i en besked. Samles til en fælles serviceomgang.' },
};

export const FALSK_ALARM_AARSAGER = [
  'Datafejl',
  'Kendt drift',
  'Allerede udbedret',
  'Forkert anlæg',
  'Ikke værd at gøre noget ved',
];
