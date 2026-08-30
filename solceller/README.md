# Solceller – dimensionering og byggetilladelse

Værktøj der ud fra en adresse leverer et samlet beslutningsgrundlag for et
solcelleanlæg på et erhvervstag: placering, bæreevne, produktion,
nettilslutning, brandsikkerhed, tagets tilstand, økonomi, myndighedsforhold og
drift – samlet i én rapport, der kan bruges som bilag til en ansøgning om
byggetilladelse.

```bash
node server/index.js          # http://127.0.0.1:8080
npm test                      # 93 tests
```

Ingen afhængigheder ud over Node ≥ 20.

---

## Det vigtigste forbehold

Værktøjet leverer et **fagligt underlag, ikke en juridisk gyldig statisk
dokumentation**. Efter dansk praksis (BR18) skal statisk dokumentation for
højere konsekvensklasser underskrives af en certificeret statiker, og
erhvervsbygninger som butikker ligger typisk i CC2–CC3.

Det er ikke en note i bunden af rapporten – det er indbygget i, hvordan
værktøjet regner:

- Forside og konklusion bærer stemplet *"Udkast – kræver godkendelse af
  certificeret statiker"*.
- Hvert eneste tal bærer sin herkomst og dato hele vejen gennem systemet
  (`server/lib/kilde.js`). Rapporten slutter med en kildeliste over samtlige
  datapunkter.
- Modul 5 nægter at konkludere på statikken, hvis bæreevnen ikke stammer fra en
  **brugerbekræftet** kilde. En beregnet eller antaget værdi tæller ikke – det
  er dækket af en test.
- Mangler data, returneres `MANGLER` med en begrundelse. Der gættes ikke.

## Herkomst – systemets rygrad

| Herkomst | Betydning |
|---|---|
| `hentet` | Hentet maskinelt fra en navngiven datakilde |
| `brugerbekraeftet` | Læst af et dokument og udtrykkeligt bekræftet af brugeren |
| `beregnet` | Udledt af andre datapunkter i værktøjet |
| `antagelse` | Manuelt vedligeholdt konfiguration |
| `mangler` | Kunne ikke fremskaffes – flaget frem for gættet |

Kun `hentet` og `brugerbekraeftet` må bære en konklusion.

## Moduler

Hvert modul er en selvstændig fil under `server/modules/` uden bivirkninger.
`orchestrator.js` binder dem sammen.

| Modul | Automatisering | Mekanisme |
|---|---|---|
| 1 · Adresse og tagdata | Fuld¹ | Datafordeleren (DAR/BBR/Matriklen) + GeoDanmark WFS, Adressevælgeren til autocomplete |
| 2 · Layout | Fuld | Ren geometri |
| 3 · Vægt og last | Fuld | EN 1991-1-4 (vind) og EN 1991-1-3 (sne) |
| 4 · Dokumentationssøgning | **Manuel/assisteret** | Ingen API. FilArkiv/WebLager med brugerbekræftelse |
| 5 · Strukturel vurdering | Delvis | Automatisk sammenligning, men afhænger af modul 4 |
| 6 · Rapport | Fuld | HTML med print-styling → PDF fra browseren |
| 7 · Produktion | Fuld¹ | PVGIS v5.3 (server-side; tjenesten har ikke CORS) |
| 8 · Skygge | Delvis | Solgeometri over året; kræver højdedata for omgivelserne |
| 9 · Nettilslutning | **Manuel/assisteret** | Intern kommunetabel, indikativ indtil bekræftet |
| 10 · Brandsikkerhed | Fuld | Regelmotor på layoutets geometri |
| 11 · Tagets tilstand | Delvis | Alder/materiale fra BBR; fysisk tilstand kræver besigtigelse |
| 12 · Økonomi | Fuld/delvis | Eloverblik for forbrug; priser vedligeholdes manuelt |
| 13 · Myndighed | Fuld¹ | Plandata.dk WFS, filtreret på solcelle-anvendelseskategori |
| 14 · Drift og CO₂ | Fuld | Beregning og eksportstruktur |

¹ Når datakilden er konfigureret og kan nås. Ellers kører modulet videre i
reduceret tilstand med de berørte felter markeret `MANGLER`.

### Den iterative del

Modul 8 (skygge) og modul 10 (brandveje) sender udelukkelseszoner tilbage til
modul 2, som genberegner layoutet. Orchestratoren gentager, indtil layoutet er
stabilt (højst tre gennemløb). Forløbet vises i UI'et og i rapporten:

```
gennemløb 1: 370 paneler, 166,5 kWp, 1 brandkonflikt  → 2 nye zoner
gennemløb 2: 332 paneler, 149,4 kWp, 0 brandkonflikter → stabilt
```

### Modul 4 er flaskehalsen

Byggesagsarkiver ligger på to konkurrerende platforme, og en kommune bruger
typisk kun den ene:

- **FilArkiv** (public.filarkiv.dk)
- **WebLager** (weblager.dk) – afviser automatiseret adgang i robots.txt og
  kræver i nogle kommuner MitID

Værktøjet scraper ingen af dem. Det udpeger det rigtige arkiv, åbner
søgningen og lader brugeren bekræfte fundet. Bekræftelser gemmes i
`data/bekraeftede-opslag.json`, så kommune→arkiv-tabellen bliver bedre for hver
sag. Er kommunen ukortlagt, vises begge arkiver frem for at gætte – et forkert
valg giver et tomt resultat, der ligner "ingen byggesag".

Et dokument indgår først i beregningen, når brugeren har bekræftet **alle tre**:
rigtig bygning, gældende revision, korrekt aflæsning.

## Opsætning af datakilder

```bash
export DATAFORDELER_BRUGER=...   # tjenestebruger fra datafordeler.dk
export DATAFORDELER_KODE=...     # abonnér på DAR, BBR, GeoDanmark, Matriklen, DHM
export ELOVERBLIK_TOKEN=...      # tredjeparts-token fra eloverblik.dk
```

PVGIS og Plandata.dk kræver ingen opsætning. DAWA bruges bevidst **ikke** –
tjenesten lukker 1. oktober 2026 og har ikke leveret BBR-data siden april 2024.

UI'et viser øverst, hvilke kilder der er slået til.

## Hvad der er verificeret – og hvad der ikke er

**Verificeret:**

- 93 tests: geometri, solposition mod kendte astronomiske værdier,
  lastberegning, herkomstreglerne og alle moduler.
- Hele flowet kørt i en rigtig browser (Chromium): formular → analyse →
  dashboard → rapport.
- Solpositionsalgoritmen rammer den maksimale vintersolhøjde i København
  (10,88°) og azimut i syd ved solmiddag.
- UTM32-konverteringen rammer kendte koordinater for Aarhus og København.
- Selvskygningens lukkede form er nul præcis ved den rækkeafstand, modul 2
  vælger – de to formler er udledt af samme geometri.

**Ikke verificeret (og hvorfor):**

- **Ingen af de eksterne API-kald er afprøvet mod en levende tjeneste.**
  Udviklingsmiljøet har ingen udgående netadgang – PVGIS, Datafordeleren,
  Plandata og Eloverblik svarede alle 403 gennem proxyen. Klienterne er skrevet
  efter tjenesternes dokumenterede kontrakter, og svarparsningen er tolerant
  over for formvariationer, men **feltnavne og versionsstier skal kontrolleres
  mod den faktiske tjeneste, første gang værktøjet kører med netadgang.**
- Kan PVGIS ikke nås, bruges en intern indstrålingsmodel. Den giver
  fysisk rimelige danske ydelser (902 kWh/kWp ved 15° syd), men er markeret
  `ANTAGELSE` og må ikke forveksles med et databaseopslag.
- Kommune→netselskab-tabellen er indikativ. Forsyningsområder følger ikke
  kommunegrænser præcist, så den skal bekræftes på målepunktet.
- Kommune→arkiv-tabellen starter tom med vilje.
- Brandreglerne i `server/config/brandregler.js` er projekteringsværdier efter
  almindelig praksis, ikke en gengivelse af gældende ret. De skal verificeres
  mod BR18 kapitel 5 og Beredskabsstyrelsens vejledninger og aftales med det
  stedlige beredskab.
- Løftekoefficienten i lastberegningen er generisk. Den endelige ballastplan
  skal komme fra montagesystemets ETA.

## Hvad der skal vedligeholdes manuelt

- `server/config/antagelser.js` – paneler, montagesystemer, systemtab,
  CAPEX-kurve, elpriser, CO₂-faktor. Hver post har `kilde` og `gaeldendeFra`,
  som føres videre til rapportens kildeliste.
- `server/config/kommuner.js` – netselskaber og vindzoner.
- `server/config/brandregler.js` – afstandskrav.

Poster mærket `SKAL VERIFICERES` er fagligt rimelige, men ikke slået op i den
gældende udgave af normen eller prislisten.

## Kodekonventioner

Kommentarer og al brugervendt tekst er på dansk med æ, ø og å. JavaScript-
identifikatorer og interne enum-værdier er ren ASCII (`vaerdi`, `haeldning`,
`oest-vest`), fordi de bruges som nøgler på tværs af moduler, i JSON mod
browseren og i CSS-klassenavne. En test håndhæver, at enum-værdier ikke
utilsigtet får danske bogstaver.

## Filer

```
server/
  index.js              HTTP-server og API
  config/               antagelser, kommuner, brandregler, datakilder
  lib/                  kilde (herkomst), geometri, sol, http, tegning, lager
  modules/              m01–m14 + orchestrator
web/                    dansk UI (ingen build)
test/                   93 tests
data/                   bekræftede opslag og gemte sager
```
