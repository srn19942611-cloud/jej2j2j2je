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

## Hvad de to kilder faktisk kan

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

## Det afgørende fund i data

Enitys målepunkter bærer allerede en **struktureret klassifikation** som tags:

```
custom:L0/1 HVAC            ← faggruppe
custom:L2  Ventilation      ← anlægstype
custom:L3  Slagter          ← zone
custom:L4  Køleflade        ← delkomponent
custom:Tax meter            ← afregningsmåler
```

Det betyder, at hubben **ikke behøver at gætte ud fra målernavne**. L0/1 findes
på 13.529 målepunkter fordelt på 12 værdier (HVAC 4.168, Hovedmåler 2.495, Lys
1.870, Forsyningsmåler 1.481, Konsumkøl 1.472, Lejere 690, Overskudsvarme 659,
Solceller 183 m.fl.), og L2 forfiner dem til 52 anlægstyper. `src/taxonomy.js`
læser den klassifikation direkte; navneparseren er kun en nødplan for de
målepunkter, der endnu ikke er tagget.

**Koblingen Enity ↔ Dalux** sker på butiksnummeret, der står forrest i
Enity-bygningens navn (`07360 SB Aalborg`, af og til med `L_`-præfiks). 865 af
1.171 butikker er koblet i dag; 723 har et registreret salgsareal, og uden
areal kan benchmark pr. m² ikke køre.

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
| D-06 | Køleandel mod naboer | skygge |
| D-07/08 | Solproduktion mod forventet · gradvist fald | skygge |
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
  seed.js           rigtigt dataudtræk, så hubben virker uden netværk
  views/            overblik · sager · butikker · detektorer · fagbog · opsætning
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
