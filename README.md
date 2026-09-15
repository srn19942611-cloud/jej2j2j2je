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

## Hvem har hvad

Ingen sag må stå uden en navngiven modtager. `src/personer.js` er tabellen,
der gør en faggruppe til en person — og dermed en sag til nogens ansvar.

| Person | Område | Faggrupper | Fagområder i Dalux |
|---|---|---|---|
| **Henrik Ravn** | Køl og frost | Køl & frys | Køl/Frost |
| **Mads** | Ventilation — hele aggregatet | Ventilation + køle- og varmeflade i aggregatet | Ventilation/Klima |
| **Morten** | CTS, elevatorer og selvstændig klimakøl | CTS & teknik, Køleflader/klima (fritstående) | Elevator/Rulletrappe |
| **Emil** | Varme, overskudsvarme og VVS | Overskudsvarme, Varme el/varmepumpe, Varme fjernvarme | VVS/Sanitet |
| **Stefan** | Solceller og belysning · **energiansvarlig** | Solceller, Belysning inde, Belysning ude | Solceller, Lys/El |
| **Charlie** | Alarm og sikkerhed | — | Sikkerhed/Alarm |
| **Christian** | Målere og målepunkter | Øvrigt (restposten) | — |
| — | **Produktion & køkken** (ovne, friture, kipsteger) | Produktion | — |
| **Lars** | Flaskeautomater og porte | — | Flaskeautomat, Port/Dør |
| **Martin** | Systemydelser og eltavler | — | El tavler, IT/Kasse |

Fanen **Mit område** giver hver person sit eget billede: min kø, mine anlæg,
mit forbrug, gentagne fejl på mit område, mine detektorer — og hvad jeg endnu
ikke kan se.

### Tre ting, opdelingen afslører

**Ansvaret hænger på anlægget, ikke på faggruppen.** Den, der har
ventilationsaggregatet, har også dets køle- og varmeflade — det er samme
maskine og samme servicebesøg. Men en fritstående chiller er noget andet, selv
om den havner i den samme faggruppe.

Ansvarstabellen udtrykker derfor par af **faggruppe × energirolle**, ikke bare
faggrupper:

| Faggruppe | Energirolle | Ejer | Hvorfor |
|---|---|---|---|
| Ventilation | ventilatordrift | Mads | Aggregatet |
| Køleflader/klima | køleflade | Mads | Fladen sidder i aggregatet |
| Varme fjernvarme | varmeflade | Mads | Fladen sidder i aggregatet |
| Køleflader/klima | alt andet | Morten | Fritstående chiller, AC, lufttæppe |
| Varme fjernvarme | alt andet | Emil | Fjernvarme, veksler, VVB |

Skelnen kan kun holdes, fordi målepunkterne har et L4-tag: `L2 Ventilation +
L4 Køleflade` er Mads' flade, mens `L2 Klimaanlæg` er Mortens selvstændige
anlæg. Et krav med eksplicitte roller vinder over et uden, så det mest præcise
ansvar afgør.

**Lars og Martin har områder uden energiside.** Deres anlæg bruger strøm, men
vi måler det ikke separat. Deres billede er derfor drevet af Dalux-opgaver og
gentagne fejl, ikke af kWh. Det er en reel forskel, ikke en mangel ved deres
dashboard — og den vises frem for at skjules.

**Stefan er visitator, og det er en anden slags arbejde.** De fagansvarlige
dækker hver sin anlægstype, men "Øvrigt/uspecificeret" hører ikke til nogen af dem — og det
er dér 87 af de 110 sager lander, fordi restpost, benchmark, målerfejl og ny
konstant last netop handler om forbrug, der endnu ikke ER henført til et anlæg.
Stefan er energiansvarlig og visiterer dem videre.

Hans to køer holdes adskilt i hele hubben, og det er ikke kosmetik:

- **Min kø** — solceller og belysning. Sager, han selv skal løse.
- **Til visitation** — sager uden fagansvarlig. De skal *sendes videre*, ikke
  løses.

Slås de sammen, forsvinder netop det, man skal kunne se: om sagerne bliver
placeret, eller om de bare ligger hos den, der fik dem sidst. En sag i
visitationskøen er ubehandlet, uanset hvor dygtig visitatoren er.

Knappen "Send videre" router en sagstype til en fagansvarlig, og valget gemmes
på butik + sagstype, så det holder, når detektorerne kører igen. Rammer den
samme sagstype gang på gang den samme person, vises det som et **mønster** —
det er en routingregel, der mangler, ikke en beslutning, nogen skal tage hver
gang.

Nøgletallet på visitationskøen er dens **alder**, ikke dens længde. Målet er
under fem arbejdsdage. Det måler, om funktionen er bemandet — ikke om
detektorerne er gode. En lang kø, der tømmes hurtigt, er sundere end en kort,
der står stille. Og køen bliver kortere af sig selv, efterhånden som
datadækningen stiger: et forbrug med en bimåler på har en anlægstype, og en
anlægstype har en fagansvarlig.

### Hvorfor nogle områder står uhåndterede

Spørgsmålet fortjener tal. Gennemgangen af alle 11.817 el- og varmemålere gav
fire forskellige grunde, og to af dem var fejl i hubben selv:

| Grund | Målepunkter | Slags | Status |
|---|---|---|---|
| OK Tank — ekstern forbruger | 198 | mapping-fejl | **rettet** |
| Ingen tags overhovedet | 162 | datahul | åben |
| Tavle uden specifikt indhold | 94 | kræver fysisk gennemgang | åben |
| Produktions- og køkkenudstyr | 80 | **manglende faggruppe** | **rettet** |
| Samlet anlæg — tre strømme i én måler | 278 | kræver tre målere | åben |
| Blandet HVAC uden underniveau | 20 | for bredt tag | åben |

**De 198 OK Tank-målere** lå i Øvrigt, fordi tagget satte rollen til *lejer*,
men ingen faggruppe. Det er lejerforbrug og skal ud af butikkens nøgletal.
Rettet: rollen sætter nu faggruppen.

**De 80 målepunkter på ovne, friture, kipsteger og komfurer** lå i Øvrigt, fordi
der ikke fandtes en faggruppe til dem. Det er ikke "øvrigt" — det er et
selvstændigt område med sin egen driftsprofil og sine egne leverandører.
Faggruppen **Produktion & køkken** er oprettet. Den mangler stadig en
ansvarlig, og det er nu synligt frem for skjult.

De øvrige tre er ikke fejl, men huller, der kræver noget fysisk: et målepunkt,
der aldrig blev tagget, en tavle, ingen har gennemgået, og 278 aggregater, hvor
ventilation, køle- og varmeflade deler én måler og derfor ikke kan skilles ad.

### Restposten har alligevel en ejer

Jeg skrev tidligere, at **Øvrigt/uspecificeret** aldrig kunne få en
fagansvarlig, fordi den ikke er en anlægstype. Det var forkert. Restposten er
det forbrug, der endnu ikke er henført til et anlæg — og at lukke det hul
*er* måleropgaven. Den hører derfor til hos **Christian**, ansvarlig for
målere og målepunkter.

Det flytter 71 sager fra visitationskøen til en person, der kan gøre noget ved
dem, og giver en KPI, der betyder noget: **109,8 GWh — 43 % af porteføljens el,
som ingen detektor kan se.** Hver måler, der kommer på plads, fjerner sager fra
køen af sig selv.

Tilbage står to faggrupper uden ejer: **Lejere** (et afregningsforhold, ikke en
driftsopgave) og **Produktion & køkken** (serviceres i dag af leverandøren
direkte).

### Områder, der bevidst står uden ansvarlig

Forskellen på *"ingen har taget den endnu"* og *"ingen skal have den"* er
vigtig. Det første er et hul, der skal lukkes; det andet er en truffet
beslutning, og den skal kunne ses som sådan — ellers dukker den op som en
mangel, nogen skal forholde sig til igen og igen.

| Fagområde | Opgaver | Begrundelse |
|---|---|---|
| Skadedyr | 2.355 | Serviceaftale med egen leverandør, lovpligtige tilsyn frem for fejl |
| Bygning/Tag | 2.162 | Bygningsvedligehold ligger uden for de tekniske driftsområder |

Sagerne oprettes stadig og kan ses, men de venter ikke på nogen og tæller ikke
med i visitationskøen.

## Visitationen

Visitation er tre afgørelser, ikke én flytning: hører sagen til hos nogen, er
den værd at bruge tid på, og **burde afgørelsen have været truffet automatisk?**

**Målersager er ikke visitation.** Restpost og målerfejl kan ikke sendes til en
fagansvarlig, for der er netop ikke noget anlæg at sende dem til. De er
Christians måleropgaver. Benchmark er derimod en energiscreening — spørgsmålet
*"hvorfor ligger butikken højt mod sine søskende"* — og hører til hos Stefan.

Sammen med de bevidst henlagte områder tømmer det køen for alt, der ikke
venter på en beslutning: **fra 87 sager til 4.**

**Rækkefølgen i routingen betyder noget.** Fagområdet vinder over faggruppen,
når faggruppen kun er "Øvrigt". En sag om gentagne alarmfejl har faggruppen
Øvrigt, fordi alarmanlæg ikke har en energiside — ikke fordi den er en
målersag. Uden den regel ville hver eneste opgavesag uden energiside lande hos
den, der har restposten: en toiletlækage er ikke en målersag.

**Forslag med begrundelse.** Hubben peger på en modtager ad fem veje, i
rækkefølge: en fast regel, anlægget bag sagen, fagområdet, **faget** (en
opgave på en ballepresser hører til hos den, der har presserne, selv om ingen
formelt er sat på området), og endelig historikken. Forslaget siger altid hvorfor — en visitator,
der ikke kan se begrundelsen, kan ikke tage stilling til om den holder.

**Mønstre bliver til regler.** Er den samme slags sag sendt samme sted hen
mindst tre gange og i mindst 80 % af tilfældene, foreslår hubben at gøre det
til en fast routingregel. Så forsvinder sagerne fra køen af sig selv, og
visitatoren slipper for at tage den samme beslutning igen.

**At lukke er et gyldigt udfald.** Ikke alt, en detektor finder, er værd at
sende videre — men årsagen skal med.

**Køens alder er nøgletallet**, ikke dens længde: median og ældste sag mod et
mål på fem arbejdsdage. Det måler, om funktionen er bemandet, ikke om
detektorerne er gode.

Fanen viser også **hvorfor** hver sag står i køen, fordelt på fem grunde — fordi
nogle er et bemandingsspørgsmål og andre er et datahul, og datahullerne lukker
sig selv, når målepunkterne kommer på plads.

### En tom kø er ikke i sig selv en god nyhed

Den kan betyde tre forskellige ting, og den fagansvarlige skal kunne se
hvilken: at detektorerne kører og intet har fundet, at detektorerne venter på
en datakilde, eller at området slet ikke har en energiside. Hvert dashboard
skriver det ud med de konkrete detektornavne og det, de mangler — en tom kø
under et område uden detektorer i drift betyder, at der ikke bliver kigget.

## Agenten — fra afvigelse til en beslutning, nogen har taget

Det er her, kæden bliver til noget, man kan handle på. Syv trin, hvert med ét job:

| | Trin | Hvor |
|---|---|---|
| 1 | Opdag: måleren afviger fra sin egen vejrkorrigerede normal | `src/aarsag.js` · `maalSignatur` |
| 2 | Kobl: hvad siger Dalux om det anlæg i samme periode? | `src/korrelation.js` |
| 3 | Forklar: hvilken årsag passer på signaturen? | `src/aarsag.js` · `diagnosticer` |
| 4 | Prissæt: i den rigtige beløbsklasse, eller slet ikke | `src/agent.js` · `prissaet` |
| 5 | Adressér: hvem har anlægget? | `src/personer.js` · `ejerMedRolle` |
| 6 | Spørg: ét varsel, to knapper | `src/views/agent.js` |
| 7 | Lær: hvad svarede de, og hvad ændrer det? | `src/agent.js` · `registrerSvar` |

### Det første, analysen viste: sammenhængen findes ikke i årstal

Det oplagte sted at lede efter koblingen mellem nedbrud og energi er dér, hvor
data allerede ligger: 80 butikker med både målt køleforbrug og talte
Køl/Frost-opgaver. Butikker med gentagne kølefejl bruger 26 % mere el pr. m² på
køl end butikker uden.

Det tal holder ikke. De samme butikker er 27 % mindre, og deres samlede forbrug
pr. m² er 18 % højere — altså er de mere intensive hele vejen rundt, ikke kun på
køl. Måler man på køleandelen af elforbruget i stedet, som er upåvirket af
størrelsen, falder forskellen til 2,6 procentpoint. En permutationstest med
20.000 omrokeringer giver **p = 0,53**: seks butikker kan sagtens lande dér ved
rent tilfælde.

**Konklusionen er ikke, at sammenhængen ikke findes — men at årsopgørelser aldrig
kan vise den.** Et kompressorsvigt er et spring på en tirsdag. Lagt sammen over
tolv måneder forsvinder det. Koblingen lever i tid, og derfor er det timedata og
opgavedatoer, den skal bygges på — ikke årssummer.

### Retningen i tid afgør, om sagen overhovedet er en sag

| Opgaven ligger | Betyder | Hvad agenten gør |
|---|---|---|
| **Før** afvigelsen | Nogen har lavet noget — ny sektion, nyt setpunkt | Ingen fejlmelding. Normalen skal genberegnes |
| **Samtidig** | Butikken og måleren så det samme | Højeste konfidens, to uafhængige kilder |
| **Efter** | Måleren så det først | Forspringet i dage er hele forretningsargumentet |
| **Ingen opgave** | Uopdaget fejl — eller slet ikke en fejl | Siges højt frem for at gætte |

Datoen alene kan ikke afgøre det. En opgave to dage før springet kan være begge
dele. Derfor læses også **opgavens tekst**: *"idriftsættelse af ny frostsektion"*
er planlagt arbejde, *"køleanlægget står, temperaturen stiger"* er en
fejlmelding. Uden den skelnen blev et setpunkt, der var skruet ned efter aftale,
læst som et nedbrud.

### Årsagsanalysen skiller årsagerne ad på form, ikke på størrelse

To fejl kan koste det samme og se ens ud på en månedsopgørelse:

- **Tilsmudset kondensator** — merforbruget vokser med udetemperaturen. Om
  vinteren er det næsten væk.
- **Fastlåst afrimning** — det samme antal kWh i døgnet, året rundt.

Det er vejrdataene, der skiller dem. Uden dem er begge bare "+14 %", og
anbefalingen bliver "få en tekniker til at kigge på det" — altså ingen
anbefaling. Seks ting måles, og hver af dem adskiller mindst ét årsagspar:
**form** (spring eller glidning), **retning**, **overgangens bredde i døgn**,
**vejrafhængighed** i merforbruget, **ændring i anlæggets vejrfølsomhed**, og
**restniveau** — hvor meget der stadig kører.

Restniveauet er det, der skiller en død måler (nul) fra et standset anlæg
(styring og ventilatorer kører, 5–20 %) fra et tabt kompressortrin (næsten alt
kører endnu). Tre sager, der ellers alle blot er "forbruget faldt".

Afvejningen sker i log-odds, så beviser kan lægges sammen, og så det bagefter kan
gøres op, hvilket bevis der trak i hvilken retning. Ingen sprogmodel stiller
diagnosen; den beskriver kun den, tallene har stillet.

### Prøvet af på ni scenarier med kendt facit

En detektor, der aldrig er prøvet på noget, hvor man kender svaret, er ikke en
detektor — den er et gæt med et konfidenstal på. `src/scenarier.js` bygger ni
døgnserier, hvor fejlen, dens starttidspunkt og dens størrelse er lagt ind med
vilje. Fire af dem er **ikke** fejl (setpunkt, ombygning, død måler, ren serie):
en detektor, der finder fejl i dem, er værre end ingen detektor.

| | Resultat |
|---|---|
| Ramte den rigtige årsag | **95,3 %** af 972 kørsler |
| Falske alarmer på ren serie | **1 ud af 108** (0,9 %) |
| Oversete fejl | 9 — alle sammen scenariet, der ikke er en fejl |

De 972 kørsler er 12 tilfældighedsfrø × 3 støjniveauer × 3 anlægsstørrelser —
altså data, tærsklerne **ikke** er sat efter. På de ni scenarier alene rammer den
9 ud af 9, men det tal er intet værd i sig selv: det er målt på netop de serier,
modellen blev rettet til imod.

Vejen dertil gik gennem seks fejl, der alle var mine egne, og som alle ville have
set rigtige ud i en demo. De står dokumenteret i koden, dér hvor de blev begået —
`theilSen` kaldt med `[x, y]` i stedet for `{x, y}`, så hvert eneste vejrbevis
tavst udeblev; en signatur målt over hele vinduet, så et kompressorsvigt 25 døgn
før seriens slutning gav 0,1 % afvigelse; et restniveau på 1,046 på et skadet
anlæg, fordi juli blev holdt op mod en vinterbaseline; en glidende fejl, der lånte
temperaturens sæsonkurve og udgav sig for at være vejrafhængig; et spring, der
blev målt som otte ugers optrapning, fordi tærskelkrydsninger drukner i støj; og
en prior, der gik **op** for en årsag, der var blevet modbevist seks gange, fordi
præcision og basisrate blev blandet sammen.

### Pop-up'en: to knapper, og "Afvis" er ikke en skraldespand

Den fagansvarlige skal kunne sige ja eller nej uden at åbne noget andet. Derfor
står hele grundlaget i pop-up'en: hvad måleren viser, hvad agenten tror, hvad der
taler for og imod, hvilke andre muligheder der ikke kan udelukkes, hvad der skal
tjekkes i hvilken rækkefølge, hvad det koster at lade stå, og hvilke forbehold der
er.

**Opret opgave i Dalux** sender hele teksten med over, som den står. Ingen skal
skrive den igen. Nederst i opgaven står et spørgsmål om, hvad årsagen viste sig at
være — og det er dét svar, der lukker sløjfen.

**Afvis** spørger hvorfor, og de seks grunde gør hver deres:

| Grund | Hvad den ændrer |
|---|---|
| Årsagen er forkert — det var noget andet | Justerer sandsynlighederne for faggruppen: den forkerte ned, den rigtige op |
| Det er ikke det anlæg, måleren dækker | Ryger i koblingsbunken — den fejl rammer alt, hvad der måles på den måler |
| Kendt og accepteret | Undertrykkes til en **dato, der altid sættes** — en accept må ikke blive et blindt punkt |
| Allerede løst | Lukkes uden at tælle som forkert diagnose. Agenten havde ret, den var for langsom |
| For lille til at rykke ud på | Hæver beløbsgrænsen for faggruppen — varslet forsvinder ikke, det holder bare op med at afbryde |
| Ikke mit område | Sender videre og noterer ruten. Tre gange samme rute foreslås som fast regel |

**En bekræftelse tæller først, når Dalux-opgaven lukkes med en årsag.** At sende
et varsel videre betyder kun, at nogen tog det alvorligt nok til at se efter.
Priorene opdateres som en tælling af, hvor ofte hver årsag viste sig at *være* den
rigtige, blandet med udgangspunktet efter hvor meget erfaring der er — tolv
bekræftelser, før erfaringen vejer halvt.

## Flåden — hvorfor en god detektor ikke er nok

En detektor, der virker på ét anlæg, virker ikke nødvendigvis på 13.529.
Regnestykket er ubarmhjertigt:

> 0,9 % falske alarmer — et godt tal for en enkelt detektor — gange 11.770
> analyseenheder er **109 blindgyder. Hver nat.** Fordelt på ni fagansvarlige:
> tolv stykker hver, hver nat, mod en realistisk kapacitet på under én ny sag
> om dagen.

Agenten ville blive slået fra i løbet af en uge, og den ville have fortjent det.
Det løses ikke med en bedre detektor. Det er multiplicitet, og det har sin egen
matematik. `src/flaade.js` er fire greb i rækkefølge:

| Greb | Hvad det fjerner |
|---|---|
| **Gate** | For lidt data, for kort tid, eller under 2.000 kr. — hastende sager og blinde punkter slipper altid forbi |
| **Dedupering** | Samme anlæg, samme årsag. Et varsel, der allerede står åbent, er ikke et nyt varsel |
| **FDR** (Benjamini–Hochberg) | Holder den forventede **andel** blindgyder under 10 %. Bonferroni ville kræve p < 0,000004 og kun lukke totalhavarier igennem |
| **Budget** | Hver fagansvarlig får det, de kan nå. Resten venter — synligt, ikke skjult |

To ting gøres bevidst konservativt i p-værdien: medianens usikkerhed vokser kun
med √n, og døgnene er ikke uafhængige — er det koldt i dag, er det sandsynligvis
koldt i morgen. Det effektive antal døgn deles derfor med tre. Tallet er et skøn,
og det er sat, så det hellere afviser et ægte fund end slipper et falskt igennem.

**Hele regnskabet vises i hubben.** En sigte, man ikke kan se igennem, er en
sigte, ingen tør stole på.

### Den samme fejl mange steder er én beslutning, ikke tredive opgaver

Findes det samme mønster på tredive butikker inden for et par uger, er det
sjældent tredive anlæg, der er gået i stykker hver for sig. Så er det en
firmwareopdatering, en leverandør, en indstilling der er rullet ud — eller en
fejl i vores egen model. Alle fire er **én** beslutning, og de tre første skal
tages et helt andet sted end i en serviceopgave.

Det kræver to ting, som begge blev gjort forkert i første forsøg:

**Kun rigtige brud har en dato.** En glidende fejl har ingen startdag — der står
bare referenceperiodens slutning i feltet, og den er ens for alle enheder. Første
udgave regnede den med, og fjorten lækager med vidt forskellige forløb fik derfor
en spredning på nul dage og blev udråbt til én fælles hændelse. Datoen var
modellens, ikke anlæggets.

**Klumpen skal være tættere end tilfældet.** Et vindue på 45 dage lagt ned over
elleve datoer spredt over fire måneder fanger næsten halvdelen — og halvdelen så
ud til at være nok. Elleve kompressorsvigt på elleve tilfældige dage blev til én
fælles hændelse, der ikke fandtes. Nu holdes klumpen op mod, hvad tilfældigt
spredte datoer ville give, og skal være mindst dobbelt så tæt.

Prøvet af: **8 ud af 8 plantede hændelser fundet**, 0,25 falske fælles hændelser
pr. kørsel over 16 kørsler à 400 enheder.

## Døgnprofilen — hvad 15-minutters data viser

Et døgnforbrug er ét tal. Et døgn i kvarterer er 96, og de indeholder ting,
summen aldrig kan vise: afrimninger som periodiske toppe, tidsplaner der kan
aflæses frem for gættes, grundlast adskilt fra spids.

Enity leverer **ægte 15-minutters data** — bekræftet, med historik mindst 24
måneder tilbage. Værdierne er forbrug i intervallet, ikke tællerstande. Der er et
reelt datahul 12. oktober – 2. november 2025 på samtlige målere, og det ligger i
kilden.

### Tre ting, de rigtige data modsagde

Jeg fik karakteristikken regnet på Kvickly Aarhus C, maj–august 2026, 11.712
kvarterer pr. måler. Tre af svarene modsagde, hvad jeg havde bygget:

**Afrimninger kunne ikke ses.** Målepunktet er en hel teknik-tavle med flere
kompressorer og en grundlast på 50–70 kW. En enkelt afrimning på 2–5 kW forsvinder
i den. Afrimningsdetektoren virker altså ikke overalt — den kræver en måler pr.
kølegruppe, og den siger det nu frem for at finde noget alligevel.

**Der lå en top på ét kvarter kl. 06:00 på 120 af 123 døgn, +70 % over baseline.**
Den er for regelmæssig og for kortvarig til at være et anlæg og ligner en
registreringsklump i måleren. Uden en regel for det ville den være blevet fundet
som en afrimning hver eneste dag. Nu frasorteres ét-kvarters toppe, der rammer det
samme klokkeslæt på over 80 % af døgnene — og antallet vises, så de ikke forsvinder
i stilhed.

**Små målere larmer.** Ventilationsmåleren kører 0,49 kWh/t i drift mod 0,05 i
grundlast. Et spring på 0,01 kWh — altså intet — er 8 % af medianen. Alle relative
tærskler har nu en absolut bund under sig.

### To fund, der kom ud af det

| Fund | Hvad data viser |
|---|---|
| **Ingen weekendnedsættelse** | Ventilationen kører 08:45–23:15 på 118 af 123 døgn — præcis det samme lørdag som tirsdag. Ikke en fejl på anlægget, men en tidsplan der aldrig er sat efter butikkens åbningstid |
| **Lyset brænder kun i weekendnætterne** | 92 % af hverdagsnattens kvarterer står på præcis nul. I weekendnætterne 0,97–1,15 kWh/t. Anlægget slukker altså, når det skal — bare ikke i weekenden |

Ingen af de to kan ses i en døgnsum. Den første kræver, at lørdagens profil lægges
oven på tirsdagens; den anden, at nætterne skilles ad efter ugedag.

### Kortcykling: hvad detektoren ikke kan

Første udgave målte medianen af udsvinget fra kvarter til kvarter. Det var forkert,
og prøven viste hvorfor: et anlæg, der cyklede hver anden time mellem fuld drift og
stop, fik samme tal som et, der kørte helt jævnt. Medianen er robust over for
enkeltspring — og cyklingens spring *er* enkeltspring.

Det rigtige mål er **starter pr. time**, som er det tal, en køletekniker regner i.
Men her er grænsen, og den skal stå: med 15-minutters data kan højst **2 starter i
timen** ses, og ægte kortcykling ligger ofte på seks til ti. Detektoren kan derfor
udelukke langsom cykling — den kan ikke frikende et anlæg for hurtig. Det kræver
styringens egne starttællere.

### Datakvalitet: 8 af 14 målere kan bære det

| | Målere | |
|---|---|---|
| Egnet til kvartersanalyse | 8 | Køl, el total, lys og fire mindre laster |
| Kun til start/stop | 1 | Ventilationen — 22 forskellige værdier på fire måneder |
| Pulsmåler, hele kWh-trin | 4 | Overskudsvarme og varmeflader — for groft kvantiseret |
| **Død** | **1** | **548601 AC Kontor: konstant nul i fire måneder** |

Den sidste er et fund i sig selv, og den er fundet af datakvalitetstjekket, ikke af
en detektor. Opløsningsgaten afviser nu både døde målere og pulsmålere frem for at
regne procenter på dem.

## Koblingen anlæg ↔ målepunkt

Den vigtigste kobling i hubben. Uden den kan vi sige *"køl i denne butik bruger
340.000 kWh"* — men ikke *"dette køleanlæg bruger for meget"*. Forskellen er
hele forskellen mellem en rapport og en driftsopgave.

### Fundet, der bærer det hele

Anlægskoden står i målernavnet. Enity-måleren `VE.02 Slagter` hører til
Dalux-anlægget `VE02.1`. Det er ikke et gæt — det er den samme kode, og
koblingen har ligget i data hele tiden uden at være trukket ud.

**Men det gælder kun 386 af 11.817 el- og varmemålere, altså 3,3 %.** Resten
har ingen kode, og der findes typisk ÉN måler til FLERE anlæg: en butik med
fire ventilationsanlæg kan have én måler mærket "Ventilation". Modellen er
derfor bygget om det, data kan bære:

| Trin | Grundlag | Konfidens | Giver |
|---|---|---|---|
| 1 | Anlægskoden står i begge navne | 95 % | Ægte 1:1 |
| 1b | Zonekort lært af trin 1 | 85 % | 1:1 |
| 2 | Klasse mod tag, ét anlæg af typen | 80 % | 1:1 |
| 3 | Klasse mod tag, flere anlæg | 85 % | **Gruppe, ikke anlæg** |

Trin 1b er værd at fremhæve: måleren `VE.02 Slagter` fortæller både at VE02 er
anlægget, *og* at VE02 står i slagteren. Den anden oplysning bruges på
nabomåleren `Klimakøl slagter`, som kun har zonen at gå efter. Uden det trin
bliver kølefladen koblet til alle butikkens fem ventilationsanlæg.

### Hvad modellen nægter at gøre

En delt måler fordeles **aldrig** ud på anlæggene efter installeret effekt.
Det ville give fire pæne tal, som ingen kan efterprøve — og en fejl på ét anlæg
ville forsvinde i gennemsnittet af fire. Analysenheden er derfor gruppen, når
måleren er delt, og sagen siger det: afvigelsen peger på gruppen, og
servicebesøget skal starte med at finde ud af hvilket anlæg.

To dækningstal rapporteres, ikke ét. På eksempelbutikken Kvickly Aarhus C:
**91 % af anlæggene er koblet, men kun 45 % har egen måler.** Kun de sidste kan
analyseres hver for sig.

### Ét aggregat, tre energistrømme, tre ansvarlige

`VE02.1` har tre målepunkter: ventilatordrift (el), køleflade (el) og
varmeflade (varme). Det er tre forskellige fysikker med hver sin fejlmåde — og
i Coops opsætning tre forskellige ansvarlige: Mads, Morten og Emil på det samme
fysiske anlæg. Opdelingen kan kun holdes, fordi L4-tagget skiller strømmene ad.

### Koblingen finder også hullerne

Måleren `VE.05 Kiosk køkken` peger på et anlæg `VE05`, som ikke findes i
butikkens Dalux-register. Det er ikke en koblingsfejl — det er et hul i
anlægsregistret, og et anlæg, der ikke er oprettet, kan ingen opgave hænges på.
Hubben melder det som sådan.

## Normallast og mønsterbrud pr. anlæg

Spørgsmålet er ikke *"bruger anlægget meget?"* men *"bruger det mere, end det
plejer under de her forhold?"*. Et køleanlæg, der bruger mere i juli end i
januar, er ikke i stykker.

**Normallasten** regnes af enhedens egen historik, delt på dagtype (åben
hverdag / weekend / lukket) og korrigeret for vejret. Modellen bruges kun, hvis
den faktisk forklarer noget: R² under 0,25 forkastes, og medianen bruges i
stedet. En model, der lader som om den ved noget, er værre end ingen model.

**Seks mønstre** ses på afvigelsen fra normallasten:

| Mønster | Hvad det er |
|---|---|
| Niveauskift | Forbruget flyttede sig og blev der |
| Drift | Langsom forværring uden et tydeligt skift |
| Vedvarende afvigelse | Ligger højt uden skift eller trend |
| Brudt vejrrespons | Anlægget holdt op med at reagere på udetemperaturen |
| Nulforbrug | Nul i syv døgn, hvor der normalt er forbrug |
| Ny spids | Nyt maksimum, der kan ramme effekttariffen |

### Tre statistiske valg, der afgør om modellen dur

**Baseline må ikke bygges på data, der indeholder fejlen.** Det er den fejl,
der oftest gør en energimodel ubrugelig. I en prøve, hvor et køleanlæg fik
+45 kWh/døgn fra dag 200, endte temperaturkoefficienten på 8,96 mod de sande
6,0 — fejlen var blevet til en påstået vejrfølsomhed, og bruddet blev fundet
140 døgn for tidligt. Normallasten tilpasses derfor på den ældste del af
vinduet, og når et brud er fundet, genberegnes den på tiden *før* bruddet.

**CUSUM skal bruge den rigtige estimator.** Den tabelform, der bruges til
procesovervågning, akkumulerer til seriens ende og ville udpege sidste døgn som
bruddet. Modellen bruger i stedet argmax af den kumulerede afvigelse, som
rammer skiftepunktet præcist (prøve: fandt dag 200 af 365 med et spring på 44,7
mod de sande 45,0).

**Køleanlæg måles mod temperaturen selv, ikke mod kølegraddage.** En
kondensator følger den omgivende luft hele året, også ved 5 grader.
Kølegraddage med basis 20 ville være nul det meste af året og give en model,
der intet forklarer. Komfortkøl er derimod ægte tærskelstyret, og dér er
kølegraddage det rigtige mål.

**Konkurrerende forklaringer vælges imellem, ikke rapporteres begge.** En
glidende forværring ligner et niveauskift, hvis man skærer den over. Modellen
sammenligner, hvor godt et trin og en linje hver især forklarer afvigelsen, og
siger hvilken den valgte fra og hvorfor. Nulforbrug slår alt: en måler, der
står stille, er ikke en besparelse på 62.000 kr.

## Vejrdata

Fire størrelser, hver med sin rolle: **temperatur** skiller sæson fra fejl,
**solindstråling** giver forventet produktion og dagslysstyring, **skydække**
forklarer en grå dag, og **vind** påvirker infiltration og kondensatorydelse.

Kilden er Open-Meteo (ingen nøgle, historik og prognose i samme kald). DMI kan
sættes ind som udbyder uden at ændre resten.

**Ti vejrzoner frem for 1.171 adresser.** Butikkerne grupperes efter
postnummer. Det er en bevidst afvejning: til graddage er fejlen typisk under én
grad og slår ens igennem på alle butikker i zonen, så en nabosammenligning er
upåvirket. Til solindstråling er fejlen større — skydække er lokalt — og derfor
bruger solcelleanalysen anlæggets egne koordinater, når de findes.

Graddage regnes dansk: varme mod 17 °C, køl mod 20 °C. Begge er forudsætninger,
ikke naturlove, og kan rettes under Opsætning.

## Motoren — hvilket anlæg handler opgaven om?

Af 23.040 rigtige opgaver har kun 5.909 udfyldt anlægsfeltet, og feltet
indeholder tit et **sted** frem for et anlæg: "Lager", "Slagter",
"Grøntafdeling", "På lagret". Resten skal læses ud af fritekst.

Motoren (`src/motor.js`) afgør det i seks trin med faldende sikkerhed:

| Trin | Hvad den gør | Konfidens |
|---|---|---|
| 1 | Anlægs-id står i opgaven og findes i butikkens register | 100 % |
| 2 | Positionskode, fx `Pos. 117A` | 95 % |
| 3 | Navnematch mod butikkens egne anlæg | 50–85 % |
| 4 | Teksten peger på en anlægstype, men ikke et konkret anlæg | 70 % |
| 5 | Kun fagområdet kan afgøres | 30–60 % |
| 6 | Kan ikke afgøres — sagen går til gennemgang | — |

Tre principper bærer den:

**Anlægget først, faggruppen bagefter.** Kan vi pege på et anlæg, kender vi
dets klassifikation i Dalux — og faggruppen følger af klassifikationen. Det er
langt mere pålideligt end at gætte ud fra ord i en fritekst.

**Kandidatmængden skal være lille.** Vi matcher aldrig mod alle 50.000 anlæg,
men kun mod dem, der står i netop den butik — typisk 20–200. Det gør et svagt
tekstmatch til et stærkt et. Ord vægtes desuden efter, hvor entydige de er
*inden for butikken*: "ovn" peger på ét anlæg, "pos" peger på tyve.

**Handlingsord må aldrig bestemme emnet.** *"Ovnen kan ikke gøre sig selv
ren"* er en ovn, ikke rengøring. Ord som rens, vask, skift, service, eftersyn
og tilbud beskriver, hvad der skal gøres — ikke hvad det handler om. Den fejl
findes i de data, vi har set: en bageriovn var klassificeret som en
rengøringsopgave. Motoren finder i stedet anlægget "Ovn bageri" og lander på
det rigtige fagområde.

Motoren har lov til at sige **"kan ikke afgøres"**, og det er ikke en mangel.
Andelen er et sundhedstegn i begge retninger: er den nul, gætter motoren bare;
er den halvtreds procent, mangler vi data. Gennemgangskøen er samtidig den
prioriterede ønskeseddel til, hvad der ville løfte motoren mest.

Fanen **Motor** lader dig skrive en opgave ind og se hele kæden — trin,
kandidater, begrundelse og konfidens.

## Natlig synkronisering

Dalux, Enity og solcelleplatformen hentes én gang i døgnet kl. 03.15, og
derefter kører motoren og detektorerne, så morgenens sagsliste er klar, inden
nogen møder ind.

Tolv trin, hver med sin egen status. Et trin, der fejler, stopper ikke de
andre — alternativet er en kørsel, der vælter, fordi én leverandørs API var
nede kl. 03.

```
dalux-bygninger → dalux-anlaeg → dalux-opgaver → dalux-historik
enity-bygninger → enity-maalere → enity-forbrug
sol-anlaeg → sol-produktion → sol-alarmer
                                    ↓
                        motor → detektorer
```

Rækkefølgen er ikke tilfældig: stamdata før bevægelsesdata, og motoren efter
begge — den kan ikke matche en opgave mod et anlægsregister, der ikke er hentet.

- **Inkrementelt.** Vandmærker gør, at kun det ændrede hentes. Forbrugsdata
  hentes dog 45 døgn tilbage hver nat, fordi målerdata efterreguleres — en
  aflæsning, der kom for sent, ville ellers aldrig blive hentet.
- **Genforsøg med voksende ventetid** på netværksfejl (2s, 4s, 8s, 16s).
  En afvist forespørgsel (403) prøves ikke igen; gentagne forsøg på den gør
  kun skade.
- **Tre udfald pr. trin**, ikke to: `ok`, `fejl` og `sprunget over`. Et trin,
  hvis forudsætning manglede, melder aldrig grønt for nul rækker. Et trin, der
  melder grønt uden at have gjort noget, er værre end et rødt.
- **Delvis er ikke fejlet.** En kørsel, hvor otte af tolv trin gik igennem,
  markeres som delvis, så ingen tror, dagens tal dækker hele porteføljen.

### Sådan sættes den op

```sh
# afprøv planen uden at hente noget
node sync/run.mjs --toer

# kør den
node sync/run.mjs --ud data/

# kun én kilde
node sync/run.mjs --kun dalux

# cron, kl. 03.15 hver nat
15 3 * * *  cd /sti/til/hubben && node sync/run.mjs --ud data/ >> sync.log 2>&1
```

GitHub Actions ligger klar i `.github/workflows/natlig-sync.yml`.
Afslutningskoder: `0` alt kørte, `1` delvis, `2` intet kunne hentes.

| Miljøvariabel | Bruges til |
|---|---|
| `ENITY_MCP_URL` / `DALUX_MCP_URL` | overskriver standard-endpoints |
| `SOL_API_URL` / `SOL_API_KEY` | solcelleplatformen — uden dem springes de tre solcelletrin over |
| `MCP_PROXY` | valgfri videresender, hvis CORS blokerer |

**En browserfane er ikke en pålidelig cron.** Fanen kan være lukket kl. 03.
Hubben kan arme en timer (slås til under Opsætning), men den er en
bekvemmelighed — den rigtige kørsel sker fra `sync/run.mjs`. Derfor viser
hubben altid, hvornår der sidst kom data ind, så en manglende kørsel ikke kan
forveksles med en rolig nat.

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
  personer.js       hvem har hvad — faggruppe × energirolle pr. fagansvarlig
  visitation.js     forslag, grunde, regler og køens alder
  kobling.js        anlæg ↔ målepunkt: fire trin, delte målere, analyseenheder
  statistik.js      median, MAD, Theil-Sen, regression, CUSUM — robust mod udbrud
  anlaegsanalyse.js normallast pr. anlæg og seks mønsterbrud
  vejr.js           ti vejrzoner, graddage, Open-Meteo
  motor.js          anlægs- og faggruppemotoren: seks trin, konfidens, begrundelse
  sync.js           natlig synkronisering: trin, genforsøg, vandmærker
  seed.js           rigtigt dataudtræk, så hubben virker uden netværk
  views/            overblik · mit område · sager · butikker · anlæg ·
                    gentagne fejl · solceller · anlægsanalyse · motor ·
                    detektorer · fagbog · opsætning
sync/
  run.mjs           indgangen til cron — samme kode, kørt fra Node
.github/workflows/
  natlig-sync.yml   scheduled workflow, hvis der ikke er en server at croone på
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
