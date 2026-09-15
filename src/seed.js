/* Rigtige tal fra porteføljen, hentet fra Enity og Coops energidatamodel
 * (periode september 2025 – august 2026). De ligger her, så hubben kan
 * bruges og efterprøves uden netværksadgang til de to MCP-servere, og så
 * detektorerne kan køres mod et kendt datasæt.
 *
 * Når MCP-forbindelsen er oppe, erstattes alt herunder af live data.
 */

export const PORTEFOLJE = {
  periode: { fra: '2025-09', til: '2026-08' },
  butikker: 1171,
  butikkerMedEnity: 1171,
  butikkerMedDalux: 865,
  butikkerMedAreal: 723,
  maalere: 13529,
  maalerRoller: { bimaaler: 9079, hovedmaaler_intern: 1862, forsyning: 1478, lejer: 900, solceller: 183 },
  elBruttoGWh: 254.0,
  solproduktionMWh: 12604,
  lejereMWh: 4520,
  hentet: '2026-09-14',
};

/* Månedstotaler for hele porteføljen, GWh el brutto. September 2026 er delvis. */
export const MAANED = [
  ['2026-01', 20.93, 0.103], ['2026-02', 18.95, 0.149], ['2026-03', 20.22, 1.112],
  ['2026-04', 18.96, 1.938], ['2026-05', 20.67, 2.357], ['2026-06', 22.10, 2.393],
  ['2026-07', 23.38, 2.187], ['2026-08', 22.99, 1.904],
].map(([periode, gwh, solGWh]) => ({ periode, gwh, solGWh }));

/* Submålt forbrug pr. faggruppe, hele porteføljen, GWh/år. */
export const FAGGRUPPE_AAR = [
  { fg: 'koel_frys',      gwh: 91.42, butikker: 874 },
  { fg: 'lys_inde',       gwh: 34.15, butikker: 843 },
  { fg: 'ventilation',    gwh:  9.41, butikker: 546 },
  { fg: 'koeleflader',    gwh:  4.27, butikker: 544 },
  { fg: 'varme_el',       gwh:  3.76, butikker: 345 },
  { fg: 'lys_ude',        gwh:  1.03, butikker: 530 },
  { fg: 'varme_fjern',    gwh:  0.17, butikker:  20 },
  { fg: 'cts',            gwh:  0.00, butikker:  15 },
  { fg: 'overskudsvarme', gwh:  0.00, butikker:   7 },
];

export const KAEDER = [
  { kaede: 'SuperBrugsen',  butikker: 241, gwh: 90.7, daekning: 46, avgM2: 2058, kwhM2: 238 },
  { kaede: '365 discount',  butikker: 421, gwh: 63.1, daekning: 82, avgM2:  947, kwhM2: 236 },
  { kaede: 'Kvickly',       butikker:  69, gwh: 51.7, daekning: 59, avgM2: 4036, kwhM2: 210 },
  { kaede: "Dagli'Brugsen", butikker: 315, gwh: 37.3, daekning: 40, avgM2:  733, kwhM2: 270 },
  { kaede: 'Lager/HQ',      butikker:  23, gwh: 10.9, daekning: 49, avgM2: null, kwhM2: null },
];

/* Butikker: [butiksnr, navn, kæde, by, salgsareal m², kWh/år, solprod kWh, datadækning %, daluxId, enityId] */
const B = [
['2980',"02980 KV Odder",'Kvickly','Odder',5350,1726133,0,42,'379','20778'],
['7800',"07800 KV Nørresundby",'Kvickly','Nørresundby',11136,1584781,0,53,'367','20004'],
['2000',"02000 KV Viby J",'Kvickly','Viby J',9451,1569396,0,61,'11','19927'],
['5500',"05500 KV Holstebro",'Kvickly','Holstebro',7988,1452953,0,40,'345','19966'],
['6300',"06300 KV Svendborg",'Kvickly','Svendborg',5733,1342133,0,64,'401','19977'],
['8200',"08200 KV Allerød",'Kvickly','Allerød',6552,1292471,0,0,'370','20891'],
['4310',"04310 KV Holbæk",'Kvickly','Holbæk',4940,1126189,0,48,'388','20044'],
['6561',"06561 KV Middelfart",'Kvickly','Middelfart',4334,1103897,0,50,'406','20835'],
['3500',"03500 KV Ribe",'Kvickly','Ribe',5258,1103185,0,41,'395','20797'],
['4012',"04012 SB Asnæs",'SuperBrugsen','Asnæs',3065,1102813,0,40,'1596','20862'],
['8830',"08830 KV Helsinge",'Kvickly','Helsinge',5918,1101885,737889,77,'353','20896'],
['3770',"03770 KV Varde",'Kvickly','Varde',4198,1071250,0,51,'409','20806'],
['3976',"03976 SB Sydals",'SuperBrugsen','Sydals',2524,1065896,0,26,'1707','20813'],
['8090',"08090 SB Hillerød",'SuperBrugsen','Hillerød',3841,1025432,0,53,'526','20887'],
['3780',"03780 KV Tønder",'Kvickly','Tønder',4992,1018219,188415,29,'381','20808'],
['2220',"02220 KV Silkeborg",'Kvickly','Silkeborg',3479,1017508,0,66,'4031','19932'],
['2762',"02762 KV Ry",'Kvickly','Ry',3976,1013432,109225,3,'385','20773'],
['7125',"07125 SB Løkken",'SuperBrugsen','Løkken',3705,1007268,0,75,'1806','20847'],
['6413',"06413 SB Kerteminde",'SuperBrugsen','Kerteminde',3157,999999,0,34,'534','20832'],
['2245',"02245 KV Ebeltoft",'Kvickly','Ebeltoft',3850,995977,0,52,'405','20752'],
['8500',"08500 KV Helsingør",'Kvickly','Helsingør',7291,990782,577198,63,'344','20061'],
['4091',"04091 SB Holmegaard",'SuperBrugsen','Holmegaard',3680,983624,0,0,'1603','20865'],
['5900',"05900 KV Herning",'Kvickly','Herning',4213,981749,0,50,'372','19971'],
['2020',"02020 KV Aarhus C",'Kvickly','Aarhus C',2705,962861,0,63,'369','19929'],
['8550',"08550 KV Søborg",'Kvickly','Søborg',3310,938573,0,65,'346','20062'],
['4820',"04820 SB Havdrup",'SuperBrugsen','Havdrup',2632,928161,0,5,'595','20885'],
['4630',"04630 KV Kalundborg",'Kvickly','Kalundborg',4228,919397,538993,55,'351','20881'],
['1620',"01620 KV Roskilde",'Kvickly','Roskilde',4844,912302,226222,77,'359','20026'],
['2370',"02370 SB Hedensted",'SuperBrugsen','Hedensted',3264,900930,0,0,'513','20758'],
['3830',"03830 KV Vejen",'Kvickly','Vejen',3791,894751,0,51,'384','20811'],
['7590',"07590 KV Aalborg",'Kvickly','Aalborg',3697,888467,0,64,'350','20003'],
['5745',"05745 SB Struer",'SuperBrugsen','Struer',2624,868630,0,61,'2279','19968'],
['5278',"05278 KV Lemvig",'Kvickly','Lemvig',2910,868176,0,60,'207','19963'],
['1610',"01610 KV København S",'Kvickly','København S',3361,858222,0,69,'393','20024'],
['3102',"03102 SB Brørup",'SuperBrugsen','Brørup',3040,833768,0,0,'637','20782'],
['4640',"04640 KV Vordingborg",'Kvickly','Vordingborg',3838,833068,0,75,'382','20048'],
['1910',"01910 KV Albertslund",'Kvickly','Albertslund',3530,831449,0,75,'390','18572'],
['8120',"08120 KV Frederiksværk",'Kvickly','Frederiksværk',3776,822065,0,44,'398','20053'],
['8854',"08854 SB Lynge",'SuperBrugsen','Lynge',2505,819807,0,11,'565','20897'],
['1960',"01960 KV Valby",'Kvickly','Valby',2698,816284,0,67,'400','20036'],
['6720',"06720 SB Søndersø",'SuperBrugsen','Søndersø',2927,812228,0,22,'1715','20841'],
['6160',"06160 KV Svendborg",'Kvickly','Svendborg',2196,802469,0,38,'355','19976'],
['5020',"05020 SB Thisted",'SuperBrugsen','Thisted',2653,801553,0,67,'644','19962'],
['8299',"08299 SB Slangerup",'SuperBrugsen','Slangerup',3712,796592,0,1,'1713','20892'],
['1600',"01600 KV Taastrup",'Kvickly','Taastrup',5150,795452,0,69,'399','20023'],
['8930',"08930 KV Holte",'Kvickly','Holte',2894,795451,0,56,'105','20069'],
['6450',"06450 KV Odense C",'Kvickly','Odense C',2926,793463,0,69,'386','19981'],
['1700',"01700 KV Hvidovre",'Kvickly','Hvidovre',2883,789986,0,43,'358','20029'],
['3805',"03805 SB Haderslev",'SuperBrugsen','Haderslev',2451,788119,0,78,'2937','19954'],
['2890',"02890 KV Risskov",'Kvickly','Risskov',2499,787488,0,61,'354','19947'],
['1740',"01740 KV Frederiksberg",'Kvickly','Frederiksberg',4037,785183,0,91,'936','20031'],
['1149',"01149 SB Hvalsø",'SuperBrugsen','Hvalsø',2839,779896,0,0,'592','20858'],
['2880',"02880 KV Grenaa",'Kvickly','Grenaa',3212,770639,0,50,'404','19946'],
['8106',"08106 SB Gilleleje",'SuperBrugsen','Gilleleje',3404,764922,0,0,'1601','20889'],
['1315',"01315 SB København V",'SuperBrugsen','København V',3059,756182,0,62,'569','20018'],
['7287',"07287 SB Svenstrup J",'SuperBrugsen','Svenstrup J',2662,751492,0,0,'530','20851'],
['6590',"06590 SB Ringe",'SuperBrugsen','Ringe',2879,749795,0,59,'1711','20838'],
['5770',"05770 KV Ringkøbing",'Kvickly','Ringkøbing',3452,749583,0,65,'387','19970'],
['4810',"04810 KV Nykøbing F",'Kvickly','Nykøbing F',3468,745491,0,60,'360','19961'],
['8715',"08715 KV Farum",'Kvickly','Farum',3345,736798,0,60,'352','20065'],
['8261',"08261 SB Hellerup",'SuperBrugsen','Hellerup',1043,651783,0,44,'1620','20872'],
['1865',"01865 SB København Ø",'SuperBrugsen','København Ø',1266,511989,0,52,'1622','20020'],
['24855',"24855 365 Esbjerg V",'365 discount','Esbjerg',1560,488211,0,71,'2140','24855'],
['24541',"24541 365 Holte Midtpunkt",'365 discount','Holte',874,352042,0,68,'2101','24541'],
['3988',"03988 BR Sønderborg","Dagli'Brugsen",'Sønderborg',594,308239,0,55,'1730','20815'],
['4462',"04462 BR Strøby","Dagli'Brugsen",'Strøby',617,308804,0,49,'1745','20870'],
['1033',"01033 BR København Ø","Dagli'Brugsen",'København Ø',305,221753,0,38,'1512','20013'],
['1040',"01040 BR Frederiksberg C","Dagli'Brugsen",'Frederiksberg',370,230390,0,41,'1514','20015'],
['2679',"02679 SB Beder",'SuperBrugsen','Beder',2265,393417,0,58,'1655','19940'],
['24216',"24216 365 Aalborg",'365 discount','Aalborg',1107,191664,0,74,'2088','24216'],
['5128',"05128 BR Fur","Dagli'Brugsen",'Fur',1222,239712,0,44,'1760','19965'],
['3313',"03313 BR Højer","Dagli'Brugsen",'Højer',1173,169554,0,47,'1736','20790'],
['4010',"04010 BR Fårevejle","Dagli'Brugsen",'Fårevejle',696,232692,0,52,'1741','20861'],
['78061',"78061 LG Brøndby",'Lager/HQ','Brøndby',null,3545926,0,27,null,'21004'],
['78835',"78835 LG Brødcooperativet",'Lager/HQ','Hvidovre',null,2726634,0,22,null,'21009'],
['78006',"78006 LG Odense S",'Lager/HQ','Odense',null,1760456,0,0,null,'21002'],
['77500',"77500 ADM Albertslund",'Lager/HQ','Albertslund',null,1312706,0,5,null,'21001'],
];

export const BUTIKKER = B.map(([bn, navn, kaede, by, m2, kwh, sol, daek, dalux, enity]) => ({
  id: bn, butiksnummer: bn, navn, kaede, by,
  salgsareal_m2: m2, kwhAar: kwh, solAar: sol, daekningPct: daek,
  daluxBuildingId: dalux, enityBuildingId: enity,
  kwhPrM2: m2 ? Math.round(kwh / m2) : null,
}));

/* Submålt forbrug pr. butik og faggruppe, kWh/år. [butiksnr, faggruppe, kWh] */
const S = [
['8090','koel_frys',340565],['7125','ventilation',58774],['2220','koel_frys',344053],['8830','lys_ude',942],
['3770','koel_frys',310483],['4630','ventilation',56915],['8500','lys_ude',6633],['8854','koeleflader',7855],
['5500','koeleflader',124300],['1700','koeleflader',30520],['7125','lys_inde',209082],['6561','koeleflader',17525],
['8120','lys_ude',14727],['6720','varme_el',73192],['1910','koeleflader',54180],['5900','koel_frys',289884],
['1600','koeleflader',10147],['3500','koeleflader',15546],['6561','lys_ude',199],['3830','koel_frys',347152],
['6160','koel_frys',303375],['3780','koel_frys',174893],['8090','koeleflader',7439],['2245','koeleflader',15963],
['7590','koeleflader',18778],['6300','lys_ude',70512],['4630','koeleflader',31492],['2220','lys_inde',166095],
['1315','lys_ude',2737],['7800','lys_inde',263601],['8830','koeleflader',48017],['1910','lys_inde',213783],
['8550','ventilation',42536],['6720','lys_inde',61950],['5745','lys_inde',124693],['6300','koel_frys',278771],
['3780','ventilation',32759],['6450','koeleflader',18045],['3805','ventilation',61218],['2980','koeleflader',3086],
['4640','koel_frys',321746],['3976','lys_inde',19208],['3500','ventilation',75301],['5745','ventilation',87276],
['4310','lys_inde',156098],['5900','ventilation',34985],['1700','koel_frys',245296],['2890','ventilation',19810],
['4640','lys_inde',151565],['1700','lys_inde',6307],['4012','koeleflader',1247],['7800','ventilation',101400],
['2980','lys_ude',1522],['6450','lys_ude',5060],['8830','ventilation',130520],['2020','ventilation',80177],
['8550','koel_frys',340687],['2762','ventilation',30497],['5745','lys_ude',8732],['8120','ventilation',99454],
['2245','ventilation',56356],['3770','koeleflader',5308],['2880','koeleflader',12795],['1960','lys_inde',109752],
['4630','lys_inde',141260],['5500','lys_inde',65630],['8550','koeleflader',55214],['8830','varme_el',7044],
['7800','koeleflader',45594],['78835','koel_frys',373372],['2880','koel_frys',160805],['8500','lys_inde',190012],
['2890','koel_frys',260092],['1315','ventilation',75268],['3976','ventilation',9807],['6413','lys_ude',2802],
['8500','koel_frys',329381],['8299','varme_el',6443],['6413','koeleflader',22043],['2980','varme_el',11571],
['78061','varme_el',71581],['1600','koel_frys',273135],['77500','koeleflader',68889],['1960','koeleflader',5288],
['5500','lys_ude',10442],['4820','koeleflader',43490],['4310','lys_ude',3169],['1315','koel_frys',210873],
['78835','lys_inde',48718],['8090','ventilation',54682],['2020','koeleflader',9314],['8930','koeleflader',25052],
['1620','lys_inde',231767],['4012','koel_frys',418592],['4640','ventilation',105456],['3830','ventilation',67186],
['1620','ventilation',248439],['1960','ventilation',248678],['6561','ventilation',65749],['4310','koel_frys',196501],
['5900','koeleflader',26014],['7590','koel_frys',271172],['1960','koel_frys',181438],['5278','koeleflader',16095],
['6561','lys_inde',95415],['3805','koeleflader',24024],['2020','koel_frys',355765],['8090','lys_ude',5706],
['5020','koeleflader',14313],['7125','koeleflader',49047],['3976','koel_frys',249501],['3500','lys_inde',141318],
['6720','lys_ude',974],['5020','koel_frys',251226],['4012','varme_el',18419],['5020','lys_ude',2109],
['6720','koeleflader',9404],['5900','lys_inde',139107],['6300','lys_inde',338762],['3770','lys_inde',155648],
['4630','koel_frys',279000],['1315','koeleflader',680],['7800','koel_frys',413657],['7800','lys_ude',9998],
['8500','koeleflader',1176],['8500','ventilation',96633],['6561','koel_frys',376516],['1600','ventilation',49047],
['78835','koeleflader',49988],['1740','ventilation',62195],['6450','lys_inde',164904],['6300','koeleflader',39237],
['2880','lys_inde',155068],['78061','ventilation',177512],['8930','koel_frys',266138],['2980','ventilation',164449],
['7590','ventilation',104952],['4310','ventilation',160527],['1610','lys_inde',217137],['2980','lys_inde',180944],
['8830','lys_inde',119953],['3770','ventilation',74971],['8550','lys_inde',175507],['3780','lys_inde',78567],
['2000','ventilation',173428],['3805','lys_inde',383441],['3500','koel_frys',215244],['4640','koeleflader',41054],
['3976','koeleflader',3446],['3805','lys_ude',2361],['5500','koel_frys',371166],['1600','lys_ude',1417],
['8830','koel_frys',540694],['5745','koeleflader',8724],['78835','ventilation',56356],['1620','koel_frys',202427],
['2020','lys_inde',150858],['2220','ventilation',116995],['78835','varme_el',57872],['6450','ventilation',74808],
['1610','koel_frys',264216],['6413','koel_frys',288351],['4640','varme_el',922],['1740','lys_inde',240643],
['2245','lys_inde',93894],['5278','lys_inde',168257],['2000','lys_inde',299801],['3770','lys_ude',1911],
['2980','koel_frys',362788],['3780','koeleflader',5889],['2000','koel_frys',448916],['6720','ventilation',33089],
['2020','lys_ude',14657],['5500','ventilation',4422],['6450','koel_frys',283957],['2890','lys_inde',189197],
['2880','lys_ude',554],['7590','lys_ude',708],['8930','ventilation',27114],['3805','koel_frys',141275],
['3780','lys_ude',5698],['1740','koeleflader',29222],['1910','ventilation',64401],['1610','ventilation',55000],
['2220','koeleflader',32705],['78835','lys_ude',13868],['2880','ventilation',53585],['4640','lys_ude',2379],
['8930','lys_inde',129343],['8090','lys_inde',134812],['4310','koeleflader',26732],['5278','koel_frys',294963],
['1610','koeleflader',58444],['5745','koel_frys',302711],['1740','koel_frys',378951],['8120','koel_frys',248568],
['2890','koeleflader',9270],['7590','lys_inde',176668],['5020','lys_inde',220111],['2762','koeleflader',1250],
['7125','koel_frys',435958],['78061','koel_frys',717930],['2000','koeleflader',39124],['1315','lys_inde',179576],
['1600','lys_inde',216826],['6413','ventilation',27813],['2245','lys_ude',2050],['1910','koel_frys',287160],
['2220','lys_ude',10539],['2245','koel_frys',351305],['1700','ventilation',58301],['3830','lys_inde',45061],
['5020','ventilation',52308],['5278','ventilation',45604],['8854','varme_el',82140],['6300','ventilation',133131],
['1620','koeleflader',20092],
];

export const BUTIK_FAGGRUPPE = S.map(([bn, fg, kwh]) => ({ butiksnummer: bn, fg, kwh }));

/** Døgnprofil, 07360 SB Aalborg, forsyningsmåler 583773, juli–august 2026,
 *  gennemsnitlig kWh pr. time. Butikken er lukket 22–06. */
export const DOEGNPROFIL_EKSEMPEL = {
  butik: '07360 SB Aalborg', meterId: '583773', periode: 'jul–aug 2026',
  timer: [28.1, 26.4, 24.6, 24.9, 25.1, 30.1, 36.0, 41.6, 49.6, 50.5, 52.4, 52.2,
          50.8, 51.3, 52.5, 51.6, 48.4, 45.1, 46.2, 47.7, 46.7, 44.5, 44.7, 39.9],
};

/** År-til-år-spring målt på hele måneder, maj–august. */
export const AARSSPRING = [
  { bn: '78835', sidsteAar: 758813, iAar: 1020927, pct: 35 },
  { bn: '2679',  sidsteAar:  99628, iAar:  131139, pct: 32 },
  { bn: '24216', sidsteAar:  40039, iAar:   63888, pct: 60 },
  { bn: '5128',  sidsteAar:  64591, iAar:   79904, pct: 24 },
  { bn: '3313',  sidsteAar:  42849, iAar:   56518, pct: 32 },
  { bn: '4010',  sidsteAar:  64437, iAar:   77564, pct: 20 },
];

/** Målere for én butik — viser den tag-struktur, alle detektorer hviler på. */
export const MAALERE_EKSEMPEL = [
  { id: '583773', name: 'El total - Datahub', energyType: 'Electricity', unit: 'Kwh', kwh30d: 96780,
    tags: ['custom:L0/1 Forsyningsmåler', 'custom:L0/1 Hovedmåler', 'custom:Tax meter'], location: 'Tavle på 1 sal.' },
  { id: '565988', name: 'El total', energyType: 'Electricity', unit: 'Kwh', kwh30d: 0,
    tags: ['custom:L0/1 Hovedmåler'], location: 'Målertavlen over eltavlen på 1 sal' },
  { id: '566601', name: 'Konsum køl', energyType: 'Electricity', unit: 'Kwh', kwh30d: 0,
    tags: ['custom:L3 Alt i butikken blandet', 'custom:L2 Primær køleanlæg', 'custom:L0/1 Konsumkøl'],
    location: 'Kompresserrummet i P-kælderen under butikken' },
  { id: '567252', name: 'Lys butik 2', energyType: 'Electricity', unit: 'Kwh', kwh30d: 4735,
    tags: ['custom:L0/1 Lys', 'custom:L2 Blandet belysning', 'custom:L3 Alt i butikken blandet'], location: 'Målertavlen' },
  { id: '567251', name: 'Lys butik 1', energyType: 'Electricity', unit: 'Kwh', kwh30d: 2180,
    tags: ['custom:L0/1 Lys', 'custom:L2 Blandet belysning', 'custom:L3 Alt i butikken blandet'], location: 'Målertavlen' },
  { id: '567246', name: 'Ventilation', energyType: 'Electricity', unit: 'Kwh', kwh30d: 2823,
    tags: ['custom:L0/1 HVAC', 'custom:L3 Slagter', 'custom:L2 Ventilation', 'custom:L4 Samlet anlæg'], location: 'Loftet' },
  { id: '567584', name: 'Køleflade', energyType: 'Electricity', unit: 'Kwh', kwh30d: 1082,
    tags: ['custom:L0/1 HVAC', 'custom:L3 Slagter', 'custom:L2 Ventilation', 'custom:L4 Køleflade'], location: 'Loftet' },
  { id: '567250', name: 'Udvendigt lys', energyType: 'Electricity', unit: 'Kwh', kwh30d: 205,
    tags: ['custom:L0/1 Lys', 'custom:L2 Blandet belysning', 'custom:L3 Udvendigt'], location: 'Målertavlen' },
  { id: '567253', name: 'Danske bank hæveautomat', energyType: 'Electricity', unit: 'Kwh', kwh30d: 370,
    tags: ['custom:L0/1 Lejere', 'custom:L2  -> Bank', 'custom:Tax meter'], location: 'Målertavlen' },
  { id: '567249', name: 'El varmeramper', energyType: 'Electricity', unit: 'Kwh', kwh30d: 0,
    tags: ['custom:L0/1 Andet', 'custom:L3 Udvendigt', 'custom:L2 Eltracing - Beton fliser'], location: 'Målertavlen' },
];

/* ---------------------------------------------------------------------------
 * Opgavedata fra Dalux FM, hentet fra "Remix of Shop Sentinel - DALUX API",
 * hvor 23.040 rigtige opgaver allerede er klassificeret. Tallene herunder er
 * det faktiske billede pr. 14. september 2026.
 * ------------------------------------------------------------------------- */

export const OPGAVER_PORTEFOLJE = {
  opgaver: 23040,
  anlaeg: 50000,
  bygninger: 2599,
  fund: 128,
  fagomraadeAgenter: 21,
  hentet: '2026-09-14',
};

/** Opgaver pr. fagområde: [fagområde, antal, gns. konfidens, antal butikker] */
export const OPGAVER_FAGOMRAADE = [
  ['Køl/Frost', 5142, 0.83, 675], ['Skadedyr', 2355, 0.98, 834],
  ['VVS/Sanitet', 2256, 0.88, 524], ['Bygning/Tag', 2162, 0.58, 878],
  ['Ventilation/Klima', 1844, 0.58, 579], ['Sikkerhed/Alarm', 1557, 0.77, 620],
  ['Port/Dør', 1550, 0.89, 488], ['Lys/El', 1149, 0.73, 463],
  ['Inventar/Vogne/Kurve', 963, 0.63, 498], ['IT/Kasse', 826, 0.64, 420],
  ['Elevator/Rulletrappe', 813, 0.62, 113], ['Rengøring', 568, 0.77, 353],
  ['Udenomsarealer', 545, 0.64, 292], ['Andet', 329, 0.20, 182],
  ['Affald', 325, 0.72, 205], ['Ballepresser', 300, 0.89, 213],
  ['Flaskeautomat', 235, 0.67, 127], ['Solceller', 53, 0.99, 46],
  ['El tavler', 32, 0.68, 28], ['Mug/Kondens/Fugt', 26, 0.63, 24],
  ['Benzin og diesel', 10, 0.85, 9],
].map(([fagomraade, antal, konfidens, butikker]) => ({ fagomraade, antal, konfidens, butikker }));

/** Butikker med gentagne fejl inden for ét fagområde.
 *  [kardex, butik, fagområde, antal opgaver, antal berørte anlæg, første, seneste] */
const G = [
['2020',"COOP Kvickly Bruuns Galleri",'Køl/Frost',44,15,'2025-06-17','2026-07-07'],
['1740',"COOP Kvickly Frederiksberg",'Elevator/Rulletrappe',42,7,'2025-10-29','2026-07-03'],
['8635',"COOP Kvickly Stenløse",'Køl/Frost',42,16,'2025-11-21','2026-07-08'],
['24419',"365discount Kbh SV, Mozartsplads",'Køl/Frost',35,6,'2024-10-12','2026-06-15'],
['2523',"COOP Superbr Lystrup",'Køl/Frost',33,13,'2026-02-26','2026-07-07'],
['1850',"COOP Superbr Islands Brygge",'Køl/Frost',32,10,'2025-05-26','2026-07-08'],
['2890',"COOP Kvickly Vericentret",'Køl/Frost',29,8,'2025-09-03','2026-07-07'],
['7510',"COOP Kvickly Års",'Køl/Frost',28,8,'2026-01-02','2026-07-03'],
['8550',"COOP Kvickly Buddinge",'VVS/Sanitet',27,9,'2026-01-30','2026-06-30'],
['4810',"COOP Kvickly Nykøbing F",'Køl/Frost',27,14,'2026-02-28','2026-06-30'],
['8496',"COOP Superbr Fortunbyen",'Køl/Frost',26,10,'2025-04-15','2026-06-24'],
['4062',"BRF Superbrugsen Dalby",'Skadedyr',26,1,'2026-04-27','2026-06-23'],
['5020',"COOP Superbrugsen Thisted",'Køl/Frost',26,10,'2026-04-16','2026-07-08'],
['1420',"COOP Superbr Ålekistevej",'Køl/Frost',26,12,'2025-08-17','2026-07-06'],
['6450',"COOP Kvickly Skibhusvej",'Køl/Frost',25,12,'2025-09-05','2026-07-07'],
['8500',"COOP Kvickly Prøvestenscentret",'VVS/Sanitet',25,8,'2025-12-09','2026-07-03'],
['5500',"COOP Kvickly Holstebro",'Køl/Frost',25,7,'2025-12-06','2026-07-05'],
['8017',"Coop SuperBrugsen Hørsholm Midtpunkt",'Køl/Frost',24,5,'2024-03-08','2026-07-01'],
['4640',"COOP Kvickly Vordingborg",'VVS/Sanitet',24,8,'2026-02-05','2026-06-26'],
['8930',"COOP Kvickly Holte",'Køl/Frost',24,5,'2025-04-15','2026-06-30'],
['4230',"COOP Superbrugsen Ringsted",'Køl/Frost',24,11,'2026-03-16','2026-07-02'],
['24372',"365discount Hvidovre, Gl Køge Landevej",'Køl/Frost',23,9,'2025-10-04','2026-07-09'],
['3810',"COOP Kvickly Grindsted",'Køl/Frost',23,9,'2025-06-25','2026-07-07'],
['5750',"COOP Kvickly Brande",'Køl/Frost',23,7,'2026-01-05','2026-07-09'],
['6160',"COOP Kvickly Svendborg City",'VVS/Sanitet',23,12,'2025-12-10','2026-07-03'],
];
export const GENTAGNE_BUTIK = G.map(([kardex, butik, fagomraade, antal, anlaegAntal, foerste, seneste]) =>
  ({ kardex, butik, fagomraade, antal, anlaegAntal, foerste, seneste }));

/** Anlæg, hvor den samme fejl er meldt ind igen og igen.
 *  [anlæg, fagområde, kardex, butik, antal, seneste] */
const GA = [
['Skadedyrssikring','Skadedyr','4062',"BRF Superbrugsen Dalby",23,'2026-06-23'],
['AVS.01','Sikkerhed/Alarm','7380',"COOP Superbr Vejgård",16,'2026-07-06'],
['AVS.01','Sikkerhed/Alarm','7800',"COOP Kvickly Nørresundby",15,'2026-07-06'],
['Skadedyrssikring','Skadedyr','8090',"BRF Superbrugsen Ullerød",15,'2026-07-04'],
['Skadedyrssikring','Skadedyr','24860',"365discount Viby Mega Syd",14,'2026-06-24'],
['AVS.01','Sikkerhed/Alarm','1740',"COOP Kvickly Frederiksberg",14,'2026-07-06'],
['AVS.01','Sikkerhed/Alarm','6550',"COOP Superbr City",13,'2026-07-06'],
['AVS.01','Sikkerhed/Alarm','2523',"COOP Superbr Lystrup",13,'2026-07-06'],
['Skadedyrssikring','Skadedyr','1000403300',"Brødcooperativet",13,'2026-06-30'],
];
export const GENTAGNE_ANLAEG = GA.map(([anlaeg, fagomraade, kardex, butik, antal, seneste]) =>
  ({ anlaeg, fagomraade, kardex, butik, antal, seneste }));

/** Fund fra fagområde-agenterne — sådan ser en færdig vurdering ud. */
export const AGENT_FUND = [
  { fagomraade: 'Lys/El', butik: 'COOP Kvickly Viby J', kardex: '2000', anlaeg: 'Bageri',
    opgaver: 4, gentagelser: 3, alvor: 'high', handling: 'service_visit', udskiftning: false, status: 'godkendt',
    resume: 'Der er gentagne problemer med bevægelige dele og funktionalitet i bageriudstyret, specifikt omkring Rheon-anlægget og ovne, der indikerer behov for en grundig gennemgang af mekaniske og styringssystemer.' },
  { fagomraade: 'Port/Dør', butik: 'Brugsen Nr Jernløse', kardex: '4365', anlaeg: 'Port1',
    opgaver: 3, gentagelser: 3, alvor: 'high', handling: 'warranty_claim', udskiftning: false, status: 'afventer',
    resume: 'Cigaretskabets rørmotor og motorbeslag er svigtet gentagne gange på kort tid, hvilket indikerer en systemisk fejl — sandsynligvis en produktionsfejl eller fejlmontering.' },
  { fagomraade: 'Lys/El', butik: 'BRF Superbrugsen Vonsild', kardex: '3745', anlaeg: 'Slagter',
    opgaver: 3, gentagelser: 2, alvor: 'medium', handling: 'service_visit', udskiftning: false, status: 'godkendt',
    resume: 'To ud af tre opgaver omhandler kold ventilation/blæser i slagteren, hvilket indikerer et tilbagevendende problem med temperaturstyringen eller ventilationsanlægget.' },
  { fagomraade: 'Solceller', butik: '365discount Nyborg Vestergade', kardex: '24041', anlaeg: 'Solcelleanlæg',
    opgaver: 3, gentagelser: 2, alvor: 'medium', handling: 'warranty_claim', udskiftning: false, status: 'afventer',
    resume: 'To af tre opgaver indikerer systemiske problemer med komponenter af dårlig kvalitet eller defekte komponenter (stik og inverterblæser) på solcelleanlægget.' },
  { fagomraade: 'Port/Dør', butik: 'Brugsen Sorgenfri Torv', kardex: '8035', anlaeg: 'Butik og lager',
    opgaver: 2, gentagelser: 2, alvor: 'medium', handling: 'replace', udskiftning: true, status: 'afventer',
    resume: 'To opgaver inden for kort tid efterspørger "tilbud på ny hurtigport", hvilket indikerer et behov for udskiftning af den eksisterende port.' },
  { fagomraade: 'Port/Dør', butik: 'Brugsen Gedser', kardex: '4112', anlaeg: '13711-01',
    opgaver: 2, gentagelser: 2, alvor: 'medium', handling: 'service_visit', udskiftning: false, status: 'afventer',
    resume: 'Indgangsdøren udviser gentagne problemer med automatikken, hvilket indikerer et underliggende systemisk problem, der kræver planlagt service.' },
];

/* ---------------------------------------------------------------------------
 * Solcelleanlæg, hentet fra Lovable-projektet "Create From Attachment".
 * 84 anlæg, 7.111 kWp, fire dataveje: FusionSolar (Huawei), Solax, Solplanet
 * og Enity-målere. Platformen har selv indstrålingsdata, forventet produktion,
 * PR og degradering — det, D-07 og D-08 manglede.
 * ------------------------------------------------------------------------- */

export const SOL_PORTEFOLJE = {
  anlaeg: 84, aktive: 84, kwp: 7111, invertere: 157,
  performanceDage: 40642, produktionstimer: 101072,
  alarmer: 1109, alarmerISkyggedrift: 1109, aabneKritiske: 14,
  hentet: '2026-09-14',
};

/** Dataveje. [kilde, antal anlæg, kWp] */
export const SOL_KILDER = [
  { kilde: 'FusionSolar (Huawei)', anlaeg: 20, kwp: 4605 },
  { kilde: 'Solax',                anlaeg: 17, kwp: 1686 },
  { kilde: 'Solplanet',            anlaeg: 10, kwp: 820 },
  { kilde: 'Enity-målere',         anlaeg: 37, kwp: 0, note: 'Kun måler — ingen anlægsdata, ingen inverterstatus' },
];

/** Ydelse pr. anlæg. [navn, kilde, kæde, kWp, dage, PR, afvigelse %, kWh, specifikt udbytte] */
const SP = [
['Distributionscenter Odense','fusionsolar','Lager',952,411,1.287,38.2,1316932,2.35],
['Ferskvarecenter Brøndby','fusionsolar','Lager',936,411,1.296,42.2,1218399,2.30],
['Hasselager 2','fusionsolar','Lager',800,257,1.728,88.4,770121,3.73],
['R45','fusionsolar','Lager',400,30,1.397,43.8,42926,2.45],
['Jyllandsgade 11','solax','SuperBrugsen',266,379,0.948,3.4,251737,1.52],
['Fredensgade 1','solax','SuperBrugsen',246,379,0.193,-78.8,149490,0.31],
['COOP Kvickly Prøvestenscenteret','fusionsolar','Kvickly',240,411,1.423,55.7,339121,2.43],
['Vestergade 70','solax','SuperBrugsen',216,321,0.147,-83.9,162854,0.25],
['Københavnsvej 5','solax','SuperBrugsen',182,379,0.737,-19.1,157076,1.32],
['Kvickly Hyrdehøj','fusionsolar','Kvickly',180,411,1.555,70.4,268529,2.68],
['COOP Kvickly Ringkøbing (5770)','solplanet','Kvickly',175,17,1.111,21.2,4727,1.53],
['COOP Centralbageri Brøndby','fusionsolar','Lager',160,411,1.119,30.0,181707,1.97],
['Dronningensvej 1','solax','SuperBrugsen',141,324,0.065,-92.8,108545,0.17],
['COOP HQ','fusionsolar','Lager',140,411,1.315,42.2,182957,2.33],
['Hjarupvej 2','solax','SuperBrugsen',134,321,0.838,-8.4,49153,1.38],
['Hasselager','fusionsolar','Lager',100,30,1.858,74.4,13686,2.86],
['COOP Superbr Ålekistevej (1420)','solplanet','SuperBrugsen',100,17,1.536,68.4,4606,2.63],
['Coop SuperBrugsen Dragør (1013)','solplanet','SuperBrugsen',100,17,1.652,72.6,4854,2.80],
['COOP365 Hjallesevej','fusionsolar','365 Discount',99,411,1.115,22.4,118300,2.07],
['Kliplev Nygade 2','solax','Brugsen',97,169,1.081,2.3,58097,1.88],
['SuperBrugsen Nr. Alslev','fusionsolar','SuperBrugsen',89,411,0.922,-3.7,122935,2.28],
['COOP365 Holstebro','fusionsolar','365 Discount',84,411,1.451,57.7,111005,2.11],
];
export const SOL_ANLAEG = SP.map(([navn, kilde, kaede, kwp, dage, pr, afvigelse, kwh, udbytte]) =>
  ({ navn, kilde, kaede, kwp, dage, pr, afvigelse, kwh, udbytte }));

/** Alarmtyper. Alle kører i skyggedrift — ingen når endnu frem til et menneske. */
export const SOL_ALARMER = [
  { type: 'inverter_offline',      alvor: 'høj',      antal: 339, aabne: 0,   tabKwh: 3075,  tabDkk: 4104 },
  { type: 'streng_afvigelse',      alvor: 'middel',   antal: 299, aabne: 0,   tabKwh: 3245,  tabDkk: 4288 },
  { type: 'temperatur_derating',   alvor: 'middel',   antal: 234, aabne: 234, tabKwh: 529,   tabDkk: 476 },
  { type: 'nulproduktion_24t',     alvor: 'kritisk',  antal: 180, aabne: 14,  tabKwh: 49348, tabDkk: 71295 },
  { type: 'underpraestation',      alvor: 'høj',      antal: 34,  aabne: 0,   tabKwh: 11216, tabDkk: 13270 },
  { type: 'nulproduktion_dagtimer',alvor: 'kritisk',  antal: 23,  aabne: 0,   tabKwh: 809,   tabDkk: 728 },
];

/** De åbne kritiske alarmer. Bemærk kilden — den er den samme hele vejen ned. */
export const SOL_AABNE_KRITISKE = [
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-10', tabKwh: 502, tabDkk: 452 },
  { anlaeg: 'Fredensgade 1',    kilde: 'solax', kwp: 246, dato: '2026-09-14', tabKwh: 465, tabDkk: 418 },
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-09', tabKwh: 434, tabDkk: 391 },
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-14', tabKwh: 360, tabDkk: 324 },
  { anlaeg: 'Fredensgade 1',    kilde: 'solax', kwp: 246, dato: '2026-09-12', tabKwh: 224, tabDkk: 201 },
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-12', tabKwh: 220, tabDkk: 198 },
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-11', tabKwh: 161, tabDkk: 145 },
  { anlaeg: 'Fredensgade 1',    kilde: 'solax', kwp: 246, dato: '2026-09-13', tabKwh: 125, tabDkk: 112 },
  { anlaeg: 'Sønderskovvej 76', kilde: 'solax', kwp: 64,  dato: '2026-09-14', tabKwh: 119, tabDkk: 107 },
  { anlaeg: 'Nøjsomhedsvej 45', kilde: 'solax', kwp: 69,  dato: '2026-09-14', tabKwh: 106, tabDkk: 95 },
  { anlaeg: 'Grønnegade 12',    kilde: 'solax', kwp: 28,  dato: '2026-09-14', tabKwh: 65,  tabDkk: 59 },
  { anlaeg: 'Grønnegade 12',    kilde: 'solax', kwp: 28,  dato: '2026-09-13', tabKwh: 65,  tabDkk: 59 },
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-08', tabKwh: 56,  tabDkk: 50 },
  { anlaeg: 'Dronningensvej 1', kilde: 'solax', kwp: 141, dato: '2026-09-13', tabKwh: 12,  tabDkk: 11 },
];

/** Modellens kalibrering pr. datakilde. `statistiskSikker: 0` overalt. */
export const SOL_KALIBRERING = [
  { kilde: 'fusionsolar', anlaeg: 20, faktor: 1.04, medianAfvigelse: 19.3, statistiskSikker: 0, mistaenktFejl: 0 },
  { kilde: 'solax',       anlaeg: 10, faktor: 1.03, medianAfvigelse: null, statistiskSikker: 0, mistaenktFejl: 0 },
  { kilde: 'solplanet',   anlaeg: 6,  faktor: 1.07, medianAfvigelse: 22.6, statistiskSikker: 0, mistaenktFejl: 0 },
];

export const SOL_DEGRADERING = { beregninger: 629, statistiskSikre: 0 };

/* ---------------------------------------------------------------------------
 * Anlæg og målepunkter for én butik, hentet direkte fra Dalux og Enity
 * (Kvickly Aarhus C, kardex 2020 / Enity-bygning 19929). Bruges til at
 * demonstrere koblingen anlæg ↔ målepunkt på rigtige navne.
 * ------------------------------------------------------------------------- */

export const DEMO_BUTIK = { kardex: '2020', navn: '02020 KV Aarhus C', enityId: '19929', postnr: '8000' };

export const DEMO_ANLAEG = [
  { asset_id: '3197',   kardex: '2020', name: 'VE01.1',    classification_name: 'Ventilationsanlæg' },
  { asset_id: '3199',   kardex: '2020', name: 'VE02.1',    classification_name: 'Ventilationsanlæg' },
  { asset_id: '3202',   kardex: '2020', name: 'VE03.1',    classification_name: 'Ventilationsanlæg' },
  { asset_id: '71904',  kardex: '2020', name: 'VE04.1',    classification_name: 'Ventilationsanlæg' },
  { asset_id: '3201',   kardex: '2020', name: 'KØ02.1',    classification_name: 'Chillere (komfortkøl)' },
  { asset_id: '140357', kardex: '2020', name: 'Pos. 2A',   classification_name: 'Centralt køleanlæg (konsumkøl)', description: 'Co2 anlæg - Po opt - Flydende/Statisk Konds.' },
  { asset_id: '140358', kardex: '2020', name: 'Pos. 3A',   classification_name: 'Centralt køleanlæg (konsumkøl)', description: 'Co2 anlæg - Po opt - Flydende/Statisk Konds.' },
  { asset_id: '140359', kardex: '2020', name: 'Pos. 10A',  classification_name: 'Køle-/frostrum', description: 'Rum' },
  { asset_id: '140360', kardex: '2020', name: 'Pos. 11A',  classification_name: 'Køle-/frostrum', description: 'Rum' },
  { asset_id: '171320', kardex: '2020', name: 'CTS-anlæg', classification_name: 'CTS-anlæg' },
  { asset_id: '12581',  kardex: '2020', name: 'Overskudsvarme', classification_name: 'Varmegenvindingsanlæg', description: 'Kitech' },
];

export const DEMO_MAALERE = [
  { id: '584291', name: 'El total - Datahub',               energyType: 'Electricity', tags: ['custom:L0/1 Forsyningsmåler', 'custom:L0/1 Hovedmåler', 'custom:Tax meter'] },
  { id: '548608', name: 'VE.02 Slagter',                    energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Slagter', 'custom:L2 Ventilation', 'custom:L4 Kun ventilation'] },
  { id: '548629', name: 'VE.03 Bager',                      energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Bager', 'custom:L2 Ventilation', 'custom:L4 Kun ventilation'] },
  { id: '548609', name: 'VE.05 Kiosk køkken',               energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L2 Ventilation', 'custom:L4 Kun ventilation', 'custom:L3 Kiosk'] },
  { id: '548610', name: 'Klimakøl slagter',                 energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Slagter', 'custom:L2 Ventilation', 'custom:L4 Køleflade'] },
  { id: '548606', name: 'Vent køl kontor',                  energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Kontor & birum', 'custom:L2 Ventilation', 'custom:L4 Køleflade'] },
  { id: '548358', name: 'Varme VE.01 (butik)',              energyType: 'Heat',        tags: ['custom:L0/1 HVAC', 'custom:L3 Salgsområde', 'custom:L2 Ventilation', 'custom:L4 Varmeflade'] },
  { id: '548359', name: 'Varme VE.02 (slagter)',            energyType: 'Heat',        tags: ['custom:L0/1 HVAC', 'custom:L3 Slagter', 'custom:L2 Ventilation', 'custom:L4 Varmeflade'] },
  { id: '548360', name: 'Varme VE.03 (bager)',              energyType: 'Heat',        tags: ['custom:L0/1 HVAC', 'custom:L3 Bager', 'custom:L2 Ventilation', 'custom:L4 Varmeflade'] },
  { id: '548516', name: '(2-T02-02) Teknik Tavle (Kølanlæg)', energyType: 'Electricity', tags: ['custom:L3 Alt i butikken blandet', 'custom:L2 Primær køleanlæg', 'custom:L0/1 Konsumkøl'] },
  { id: '548515', name: '(2-T02-01) Teknik Tavle',          energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Lager', 'custom:L2 Ventilation', 'custom:L4 Kun ventilation'] },
  { id: '548522', name: '(2-T05-01) Kontor og kantine ventilation', energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Kontor & birum', 'custom:L2 Ventilation', 'custom:L4 Samlet anlæg'] },
  { id: '548601', name: 'AC Kontor',                        energyType: 'Electricity', tags: ['custom:L0/1 HVAC', 'custom:L3 Kontor & birum', 'custom:L2 Klimaanlæg'] },
  { id: '548592', name: 'Lys 1',                            energyType: 'Electricity', tags: ['custom:L0/1 Lys', 'custom:L3 Salgsområde', 'custom:L2 Særbelysning'] },
  { id: '548233', name: 'Overskudsvarme',                   energyType: 'Heat',        tags: ['custom:L2 Overskudsvarme - Total produktion', 'custom:L0/1 Overskudsvarme', 'custom:Tax meter'] },
];

/**
 * Døgnserie til at demonstrere normallastmodellen.
 *
 * VIGTIGT: de enkelte døgnværdier er MODELLEREDE, ikke aflæste. Enity har
 * timedata, men de er ikke trukket med i udtrækket her. Serien er bygget ud
 * fra butikkens rigtige årsforbrug på køl og en realistisk temperaturrespons,
 * så modellen kan afprøves på noget, der opfører sig som virkeligheden.
 *
 * Den er med vilje mærket som modelleret, så ingen kommer til at læse et
 * konkret døgn som en aflæsning. Når live-data er slået til, erstattes den
 * af rigtige målinger.
 */
export function demoDoegnserie({ dage = 365, fejl = 'niveauskift', froe = 20260915 } = {}) {
  let s = froe;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const raekker = [];
  const start = new Date(Date.now() - dage * 864e5);
  for (let i = 0; i < dage; i++) {
    const d = new Date(start.getTime() + i * 864e5);
    // Dansk årstemperatur: middel ~9 °C, amplitude ~8 °C, minimum i februar.
    const aarsdag = (d.getMonth() * 30.4 + d.getDate());
    const temp = 8.8 + 8.2 * Math.sin((aarsdag - 115) / 365 * 2 * Math.PI) + (rnd() - 0.5) * 6;
    const ugedag = d.getDay();
    const aaben = true;
    // Køl: basis + temperaturrespons. Tallene svarer til butikkens rigtige
    // køleforbrug på 355.765 kWh/år.
    let kwh = 780 + 14 * temp + (rnd() - 0.5) * 60;
    if (ugedag === 0) kwh *= 0.93;
    if (fejl === 'niveauskift' && i >= dage - 96) kwh += 118;
    if (fejl === 'drift') kwh += i * 0.55;
    raekker.push({
      dato: d.toISOString().slice(0, 10), kwh: Math.round(kwh), ugedag, aaben,
      temperatur: Math.round(temp * 10) / 10,
      hdd: Math.max(0, 17 - temp), cdd: Math.max(0, temp - 20),
      indstraaling: Math.max(0, 2 + 9 * Math.sin((aarsdag - 80) / 365 * 2 * Math.PI)) + (rnd() - 0.5),
      modelleret: true,
    });
  }
  return raekker;
}

/* ---------------------------------------------------------------------------
 * Hvorfor målepunkter ikke kan henføres til en faggruppe.
 * Optalt på alle 11.817 el- og varmemålere i Enity, 15. september 2026.
 * ------------------------------------------------------------------------- */

export const UKLASSIFICEREDE = [
  { grund: 'OK Tank — ekstern forbruger på matriklen', antal: 198, tags: 'L0/1 Andet + L2 OK Tank',
    slags: 'mapping', status: 'rettet',
    forklaring: 'Tagget satte rollen til lejer, men ingen faggruppe, så målepunktet endte i Øvrigt. '
      + 'Det er lejerforbrug og skal trækkes ud af butikkens eget nøgletal. Rettet: rollen sætter nu faggruppen.' },
  { grund: 'Ingen tags overhovedet', antal: 162, tags: '—',
    slags: 'datahul', status: 'åben',
    forklaring: 'Målepunktet er oprettet i Enity, men aldrig klassificeret. Der er ingen måde at gætte, '
      + 'hvad det måler. Skal tagges af den, der kender eltavlen.' },
  { grund: 'Tavle uden specifikt indhold', antal: 94, tags: 'L2 Tavle uden specifikt indhold',
    slags: 'fysisk', status: 'åben',
    forklaring: 'Tavlen er kendt, men ikke hvad der sidder på den. Kræver en gennemgang på stedet — '
      + 'ikke en rettelse i data.' },
  { grund: 'Produktions- og køkkenudstyr', antal: 80, tags: 'L0/1 Produktion + L2 Ovn / Friture / Kipsteger / Komfur',
    slags: 'manglende-faggruppe', status: 'rettet',
    forklaring: 'Ovne, friture, kipsteger og komfurer er ikke "øvrigt" — de er et selvstændigt fagområde med '
      + 'sin egen driftsprofil og sine egne leverandører. Faggruppen "Produktion & køkken" er oprettet, '
      + 'men mangler stadig en ansvarlig.' },
  { grund: 'Blandet HVAC uden underniveau', antal: 20, tags: 'L0/1 HVAC + L2 Blandet HVAC',
    slags: 'bredt-tag', status: 'åben',
    forklaring: 'Tagget dækker både ventilation, køleflade og varmeflade. Uden et L4-niveau kan faggruppen '
      + 'ikke afgøres — og det er netop den skelnen, der afgør, om anlægget hører til Mads eller Morten.' },
  { grund: 'Samlet anlæg — tre strømme i én måler', antal: 278, tags: 'L4 Samlet anlæg',
    slags: 'fysisk', status: 'åben',
    forklaring: 'Ventilation, køle- og varmeflade måles på samme punkt. Faggruppen kan ikke afgøres, og en '
      + 'afvigelse kan ikke henføres til én af de tre. Kræver tre målere, ikke en rettelse i data.' },
];

/** Faggrupper uden en navngiven ansvarlig, og hvorfor. */
export const UDAEKKEDE_OMRAADER = [
  { fg: 'produktion', navn: 'Produktion & køkken', maalere: 80, butikker: null,
    hvorfor: 'Faggruppen blev først oprettet, da tallene viste, at 80 målepunkter på ovne, friture og '
      + 'kipsteger lå i Øvrigt. Området har sine egne leverandører og sin egen driftsprofil — det hører '
      + 'hverken til hos køl eller ventilation.',
    hvem: 'Ingen udpeget. Bageri- og slagterudstyr serviceres i dag af leverandøren direkte.' },
  { fg: 'lejere', navn: 'Lejere', maalere: 900, butikker: null,
    hvorfor: 'Lejerforbrug er ikke Coops eget forbrug og skal trækkes ud af nøgletallene. Det er derfor '
      + 'ikke en driftsopgave, men et afregningsforhold.',
    hvem: 'Hører til hos den kontraktansvarlige, ikke hos en fagansvarlig.' },
  { fg: 'oevrigt', navn: 'Øvrigt/uspecificeret', maalere: 1009, butikker: 479,
    hvorfor: 'Restposten er ikke en anlægstype — den er det forbrug, der endnu ikke er henført til en. '
      + 'Jeg skrev tidligere, at den derfor aldrig kunne få en fagansvarlig. Det var forkert: at lukke '
      + 'hullet ER måleropgaven, og den har nu en ejer.',
    hvem: 'Christian, ansvarlig for målere og målepunkter.' },
];

export const FAGOMRAADER_UDEN_ANSVARLIG = [
  { navn: 'VVS/Sanitet', opgaver: 2256, hvorfor: 'Ingen formelt udpeget. Faget er Emils, og hubben foreslår ham med det forbehold — men beslutningen mangler.' },
  { navn: 'Inventar/Vogne/Kurve', opgaver: 963, hvorfor: 'Butiksinventar, ikke teknisk anlæg. Ikke afklaret hvor det hører hjemme.' },
  { navn: 'IT/Kasse', opgaver: 826, hvorfor: 'Lagt foreløbigt hos Martin under "systemydelser" — skal bekræftes.' },
  { navn: 'Rengøring', opgaver: 568, hvorfor: 'Serviceaftale. Ikke afklaret om driften har en rolle.' },
  { navn: 'Udenomsarealer', opgaver: 545, hvorfor: 'Anlægsgartnerarbejde, ikke teknisk anlæg.' },
  { navn: 'Affald og ballepresser', opgaver: 625, hvorfor: 'Renovationsaftale. Ballepresseren er et anlæg, men ingen har det.' },
];
