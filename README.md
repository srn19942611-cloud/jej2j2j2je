# Coop Energi- & Driftshub

En samlet overvågningsportal for driften af Coops butikker. Den henter forbrug
og produktion fra **Enity** og bygningsdata, anlæg og opgaver fra **Dalux FM** —
begge over MCP — finder hvad der kører forkert eller kan optimeres, og lader den
fagansvarlige oprette opgaven direkte i Dalux uden at forlade skærmen.

Bygget på de to notater *Agenter til drift og vedligehold* og *Fagligheden i
agenterne*: fire lag, én sag pr. fysisk fejl, fire knapper, og en læring der er
konkret nok til at kunne revideres.

```
Enity (MCP)            Dalux FM (MCP)
forbrug · produktion   bygning · anlæg · opgaver · tjeklister
      │                        │
      ▼                        ▼
 1 · DETEKTORER  ── signaler ──►  2 · SAGSBYGGER ──►  3 · ANBEFALING ──► 4 · BESLUTNING
   symptomer,               én sag pr. fejl,       hvad · hvorfor ·     opgave i Dalux
   ingen diagnoser          konfidens, kroner      kr. · tjekpunkter    falsk · undertryk
   src/engine.js            src/engine.js          src/views/sager.js   src/state.js
                                                                              │
                     tærskler · undertrykkelser · kontekst · fagbog ◄──────────┘
```

## Kom i gang

Det er en statisk side uden byggetrin. Servér mappen:

```sh
python3 -m http.server 8000      # eller: npx serve .
```

Åbn <http://localhost:8000>. Hubben starter på et **udtræk af rigtige data**
(september 2025 – august 2026) og virker uden netværk. Slå live-data til under
**Opsætning**, når den kører et sted, der kan nå de to MCP-servere.

## Kilderne

Hubben hviler på fem Lovable-projekter, som allerede indeholder det, der skal til.
Opsætningen er hentet derfra frem for opfundet på ny.

| Projekt | Hvad hubben tager med |
|---|---|
| **Enity Consumption MCP** | Forbrug og produktion, 13.529 målepunkter med tag-klassifikation |
| **MCP Dalux Connect** | Bygninger, anlæg, opgaver, tjeklister — og skrivning af arbejdsordrer |
| **Coop Energi Einsight** | Faggrupper, tagmapping (61 regler × 4 niveauer), Dalux-anlægsklassifikation, forudsætninger |
| **Remix of Shop Sentinel · DALUX API** | Fagområde-klassificering af 23.040 opgaver, gentagne fejl, anbefalet handling |
| **Create From Attachment** | 84 solcelleanlæg, 7.111 kWp, indstråling, forventet produktion, PR, degradering, alarmer |

## Hvad de to MCP-kilder faktisk kan

Begge servere taler MCP Streamable HTTP uden login. Værktøjskataloget er
gennemgået — det er det, hubben er bygget oven på.

### Enity — `https://entity-love-helper.lovable.app/mcp` · 8 værktøjer

| Værktøj | Bruges til |
|---|---|
| `list_buildings`, `get_building`, `get_building_hierarchy` | Butiksstamdata og koncernhierarki |
| `list_meters` | Målepunkter pr. bygning, med **tags** — hubbens vigtigste felt |
| `get_meter_data` | Tidsserie, `15min` / `30min` / `hour` / `day` / `week` / `month` / `year` |
| `get_summation`, `get_summarised_consumption` | Totaler pr. energitype, månedstal med CO₂e og pris |
| `health_check` | Forbindelsestjek |

Energityper: `Electricity`, `Water`, `Heat`, `Cooling`, `Gas`. Læs altid
`structuredContent.data`, ikke tekstresuméet. Serveren cacher selv mod Enity,
så gentagne kald er billige; `refresh: true` tvinger friske tal.

### Dalux FM — `https://mcp-dalux-connect.lovable.app/mcp` · 98 værktøjer

Fuld dækning af Dalux FM-API'et. Det, hubben bruger:

| Formål | Værktøj |
|---|---|
| Stamdata | `dalux_list_buildings`, `dalux_get_building`, `dalux_list_estates`, `dalux_list_locations` |
| Anlæg | `dalux_list_building_assets`, `dalux_get_asset`, `dalux_list_asset_workorders`, `dalux_list_asset_classifications` |
| Opgaver | `dalux_list_building_workorders`, `dalux_workorder_metadata`, **`dalux_create_workorder`**, `dalux_update_workorder` |
| Historik og facit | `dalux_list_workorder_history`, `dalux_find_checklists`, `dalux_get_checklist` |
| Henvendelser | `dalux_create_ticket`, `dalux_ticket_metadata` |

`dalux_get` / `dalux_write` kan kalde ethvert dokumenteret endpoint, hvis noget
mangler. **Alle skrivninger kræver en menneskelig godkendelse** — hubben viser
den præcise payload, før den sendes.

## Tre niveauer, der hænger sammen

```
FAGGRUPPE           Køl & frys · Ventilation · Lys inde …      energiregnskabets linjer
   └─ ANLÆGSKLASSE  Dalux-klassifikation med kode (633.021)    det fysiske anlæg
        └─ MÅLEPUNKT  Enity-tag L0/1 → L2 → L3 → L4            det, der måles
```

Faggruppen er den, økonomien rapporteres på. Anlægsklassen er den, en tekniker
arbejder på, og den Dalux opretter opgaver på. Målepunktet er det, detektorerne
kigger på. Uden alle tre kan en sag hverken prissættes, forklares eller sendes
det rigtige sted hen.

### Målepunkt-tags — opsætningen fra Coop Energi Einsight

Enitys målepunkter bærer en struktureret klassifikation som tags:

```
custom:L0/1 HVAC            ← faggruppe (bred)
custom:L2  Ventilation      ← anlægstype
custom:L3  Slagter          ← zone
custom:L4  Køleflade        ← delkomponent
```

`src/anlaeg.js` indeholder alle 61 regler over fire niveauer med konfidens.
Det dybeste niveau vinder: **L4 slår L2, som slår L0/1.**

Den vigtigste enkeltregel er `kraeverUnderniveau`: **"L0/1 HVAC" må aldrig
auto-mappes alene.** Den dækker både ventilation, køleflade og varmeflade, og
uden et L2- eller L4-tag kan faggruppen ikke afgøres. Det er den regel, der
forhindrer, at en køleflade bliver talt som ventilation i energiregnskabet.
Målepunkter, der mangler underniveauet, markeres med ⚑ i butiksvisningen.

### Anlægsklasser — Dalux' eget register

52 klassifikationer med kode, mappet til faggruppe. 50.000 registrerede anlæg:
13.090 køle-/frostgondoler, 6.589 reoler, 3.651 køle-/frostrum, 1.222 centrale
køleanlæg, 1.080 ventilationsanlæg, 777 chillere.

To huller er værd at kende:

- **Solcellerne har ingen anlægsklasse i Dalux.** Anlægsregistret for dem ligger
  i solcelleplatformen, nøglet på `plant_id`. En solcellesag kan derfor ikke
  hænges på et Dalux-komponent, før anlæggene er oprettet der.
- **2.375 "impulskølere uden overvågning"** — køl helt uden måling eller
  overvågning. Usynlig for både AK-centralen og Enity.

## Opgavesiden — 23.040 rigtige Dalux-opgaver

En butik melder alt ind, ikke kun det, der bruger strøm. Opgaverne henføres
automatisk til ét af 21 fagområder ud fra anlægsfeltet, skabelonen og teksten,
i den rækkefølge — regelbaseret, ikke med en sprogmodel, så det giver samme svar
hver gang og kan testes.

| Fagområde | Opgaver | Butikker | Konfidens |
|---|---|---|---|
| Køl/Frost | 5.142 | 675 | 83 % |
| Skadedyr | 2.355 | 834 | 98 % |
| VVS/Sanitet | 2.256 | 524 | 88 % |
| Bygning/Tag | 2.162 | 878 | **58 %** |
| Ventilation/Klima | 1.844 | 579 | **58 %** |
| Sikkerhed/Alarm | 1.557 | 620 | 77 % |
| Port/Dør | 1.550 | 488 | 89 % |

Bygning/Tag og Ventilation/Klima er de mest tvetydige at læse ud af en fritekst
— "der er varmt i butikken" kan være ventilation, køl eller solindfald. De skal
gennemgås manuelt, før en sag på dem sendes videre.

### Gentagne fejl — det, energidata alene ikke kan give

Fagbogens linje gælder alt: gentagen tilsmudsning er et placeringsproblem, ikke
et rengøringsproblem. To detektorer kører på Dalux' opgavehistorik alene og
fanger dermed "gentagen alarm"-mønsteret **i dag**, uden at vente på AK-centralen:

- **D-19** · samme anlæg meldt ind gentagne gange
- **D-20** · butikken melder samme fagområde ind igen og igen

Kolonnen "anlæg" afgør tolkningen. Samler opgaverne sig på få anlæg, er der en
systematisk fejl eller en garantisag. Spreder de sig over mange anlæg, er det
butikkens anlægsportefølje, der er ved at være udtjent — og den samtale hører
til i budgettet, ikke i endnu en serviceopgave.

**Planlagt service tæller ikke som gentagne fejl.** Skadedyr, rengøring, affald,
alarm og elevator kører på serviceaftale eller lovpligtigt eftersyn, så mange
opgaver er forventet. Der foreslås aldrig udskiftning på dem, og de eskalerer
aldrig over P4 — spørgsmålet er, om antallet svarer til det aftalte. Uden den
skelnen ville hubben foreslå at udskifte skadedyrssikringen efter 23 tilsyn.

## Solceller — 84 anlæg, 7.111 kWp

Solcelleplatformen har indstrålingsdata, forventet produktion, PR og
degradering: det, D-07 og D-08 manglede. Fire dataveje — FusionSolar (20 anlæg,
4.605 kWp), Solax (17 / 1.686), Solplanet (10 / 820) og 37 rene Enity-målere
uden anlægsdata.

Alle 1.109 alarmer kører i skyggedrift. Det er den rigtige disciplin.

**To ting skal siges højt, før tallene bruges:**

1. **Forventningsmodellen er ikke kalibreret.** Over halvdelen af anlæggene har
   en performance ratio over 1,0, hvilket er fysisk urealistisk — den forventede
   produktion er sat for lavt, ikke omvendt. Medianafvigelsen er ~20 %, og ingen
   af de 36 kalibreringer er statistisk sikre. Afvigelser vises derfor, men de
   bliver ikke til sager med beløb på.
2. **Alle 14 åbne kritiske alarmer ligger på Solax-anlæg**, og de fire dårligst
   ydende anlæg i porteføljen er også Solax. Det er ikke fjorten anlæg, der er
   gået i stå samme uge. Det behandles som en fejl i dataopsamlingen, indtil
   andet er bevist — første handling er at tjekke integrationen, ikke at sende
   fjorten kørsler afsted.

Degradering: 629 beregninger, 0 statistisk sikre. Et tal, der ikke kan bruges,
er værd at vide, at man ikke kan bruge.

### Porteføljen, som tallene ser ud

| | |
|---|---|
| Butikker | 1.171 · 365 discount 421 · Dagli'Brugsen 315 · SuperBrugsen 241 · Kvickly 69 · lager/HQ 23 |
| El, brutto | ~254 GWh/år ≈ 196 mio. kr. ved 0,77 kr/kWh |
| Submålt | Køl & frys 91,4 GWh · Belysning 34,2 · Ventilation 9,4 · Køleflader 4,3 · Varme el 3,8 |
| **Restpost** | **~110 GWh/år (43 %)** kan ikke henføres til et anlæg |
| Solproduktion | 12,6 GWh/år |

Datadækningen er meget skæv: 365 discount ligger på 82 %, Dagli'Brugsen på 40 %,
SuperBrugsen på 46 %. **Det er hubbens vigtigste enkeltresultat.** Alle
anlægsnære detektorer er blinde under restposten, så dækningen afgør, hvor
meget resten af planen overhovedet kan udrette.

## Tre slags beløb — som aldrig lægges sammen

Det ville være let at sætte pris på restposten og præsentere 30 mio. kr. i
"besparelser". Det ville være forkert, og tilliden bruges kun én gang. Hubben
skelner derfor:

| Klasse | Hvad det er | Tæller som |
|---|---|---|
| **besparelse** | Realistisk gevinst ved at rette fejlen | Gevinst |
| **potentiale** | Øvre skøn, der først holder efter en gennemgang | Vist separat |
| **blindt** | Forbrug ingen kan se — ikke et spild, men en risiko | Aldrig en gevinst |

En sag om manglende bimåling bliver derfor aldrig P2 på beløbet alene: den er en
dataopgave, ikke en fejl, der koster penge hver dag.

## Detektorer i drift nu

Bølge 1 kan køre på Enity alene — uden at vente på en eneste ny integration.

| Id | Detektor | Status |
|---|---|---|
| D-01 | Basislast om natten | drift |
| D-02 | Ny konstant last (år-til-år-spring) | drift |
| D-03 | Bimålersum mod hovedmåler | drift |
| D-04 | Måler uden data | drift |
| D-05 | Benchmark pr. m² mod kædens median | drift |
| D-19 | Gentagne opgaver på samme anlæg | drift |
| D-20 | Butik med gentagne fejl i samme fagområde | drift |
| D-06 | Køleandel mod naboer | skygge |
| D-07/08 | Solproduktion mod forventet · gradvist fald | skygge |
| D-21/22 | Nulproduktion 24 t · strengafvigelse | skygge |
| D-09/10 | Lukkedag mod åbningstid · effektspids | planlagt |
| D-11–18 | Køl, CTS, ventilation, overskudsvarme | planlagt — venter på kilder |

Katalogets fulde begrundelse, inkl. hvad hver detektor mangler for at kunne
køre, ligger i fanen **Detektorer**.

## Hvad der mangler, for at resten kan bygges

Rækkefølgen følger dataadgangen, ikke den faglige interesse.

| Kilde | Status | Det, der skal afklares |
|---|---|---|
| **AK-centralen** (køl) | Ikke etableret | Den største enkeltbeslutning i planen: lokal Modbus TCP/XML pr. butik, X-Gate på BMS-protokol, eller Danfoss' cloud. Uden den er bølge 2 — den fagligt vigtigste — helt lukket. |
| **CTS Ltech** (klima) | Skal afklares | Officiel API eller skriftlig aftale. Ikke et personligt login på en hjemmeside. |
| **Leanheat** (overskudsvarme) | API findes | Feltvalg, opløsning og en servicekonto ejet af Coop. |
| **Unikair** (ventilation) | Ukendt | Spørg leverandøren, om der findes en API — og hvad aftalen siger, hvis ikke. |
| **Vejrdata** | Mangler | Uden graddage og udetemperatur er halvdelen af alle kølesager falske om sommeren. |
| **Enity-serveren** | Kører | Registreret uden login. Skal sikres, før den bruges bredere. |

## Sådan er det skruet sammen

```
index.html          skal
styles.css          ét temasæt, lys og mørk
src/
  app.js            router og optegning
  mcp.js            JSON-RPC over MCP Streamable HTTP, sessions og SSE-svar
  taxonomy.js       faggrupper, målertags, detektorkatalog, fejlkort
  engine.js         detektorer + sagsbygger: konfidens, kroner, prioritet
  state.js          data, beslutninger, undertrykkelser, nøgletal
  dalux.js          opgavetekst, payload og oprettelse i Dalux FM
  anlaeg.js         teknisk anlægsregister: tagmapping, Dalux-anlægsklasser
  opgaver.js        fagområder, klassificering af Dalux-opgaver, gentagne fejl
  seed.js           rigtigt dataudtræk, så hubben virker uden netværk
  views/            overblik · sager · butikker · anlæg · gentagne fejl ·
                    solceller · detektorer · fagbog · opsætning
```

Principper, der er værd at kende, før man retter i koden:

- **Detektorer finder symptomer, ikke diagnoser.** Blandes de to, får man 40
  agenter, der hver gætter på en årsag, og tre modstridende beskeder om samme fejl.
- **Beløb regnes i kode med en metodetekst, der følger med sagen.** Ingen model
  skønner kroner.
- **Konfidens regnes af fire ting**, og alle fire vises: antal uafhængige
  kilder, datadækning, detektorens historiske præcision, og stabilitet.
- **En sag dør aldrig i stilhed** — opgave, undertrykkelse eller en lukning med
  begrundelse. "Falsk alarm" kan ikke trykkes uden en årsag.
- **Undertrykkelser har ejer og udløbsdato.** Antallet uden udløbsdato er et
  nøgletal, der skal være nul.
- **Fagligheden hører til i fejlkortene**, ikke i prompten. En rettelse i et
  fejlkort kan ses i en pull request og godkendes af en fagperson; en rettelse i
  en prompt kan ingen gennemskue et halvt år senere.

## Kendte begrænsninger

- **Beslutninger gemmes i browserens `localStorage`.** I drift hører de hjemme i
  tabellerne `signal`, `sag`, `sag_signal`, `beslutning`, `resultat`,
  `undertrykkelse` og `detektor_praecision`. Lagret her har med vilje samme form.
- **Ingen tilbageløb fra Dalux endnu.** Opgaveteksten beder om årsagen, men
  hubben henter den ikke tilbage automatisk. Uden det måler vi kun, om
  anbefalingerne lyder overbevisende — ikke om de er rigtige.
- **Detektorernes præcision er ikke målt.** Tallene i konfidensberegningen er
  forsigtige udgangspunkter, indtil skyggedriften har leveret rigtige tal.
- **CORS.** Hubben kalder de to MCP-servere direkte fra browseren. Svarer en
  server ikke med CORS-headere til det domæne, siden ligger på, så peg
  proxy-feltet under Opsætning på en videresender.
- **Timeprofilen** findes kun for den ene eksempelbutik i udtrækket. D-01 kører
  på alle butikker, så snart live-data er slået til.
- **Opgaveøkonomi mangler.** Dalux rummer forventet pris pr. opgave, men den er
  ikke hentet ind. Sager om gentagne fejl prioriteres derfor på gentagelser, ikke
  på kroner — og det er en svagere prioritering end den, energisagerne får.
- **Solcelleafvigelser er ikke handlingsklare.** Modellen skal kalibreres, før
  en afvigelse kan blive til en sag. Det er også derfor, D-07, D-08, D-21 og
  D-22 står i skyggedrift og ikke i drift.
- **Koblingen mellem Enity og Dalux sker på butiksnummer/kardex.** De to felter
  er ens i de fleste butikker, men ikke alle. Butikker, der kun kendes fra Dalux,
  lægges ind som skyggeposter, så en sag om gentagne fejl ikke falder på gulvet —
  men de har hverken areal eller forbrug, og kan derfor ikke benchmarkes.
