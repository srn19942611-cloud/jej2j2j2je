# Monday.com Pro mod Solselskabet-platformen

Gennemgang af alle funktioner i Monday.com Pro (november 2026) mod vores løsning: Gauzy på dansk + feltapp.

**Forklaring:**

- ✅ **Findes og virker:** testet i vores opsætning.
- ⚙️ **Findes, kræver opsætning:** typisk en API-nøgle eller en konto.
- 🛠 **Skal bygges:** findes ikke i Gauzy, men kan bygges ind i vores løsning.

## AI (Premium AI i Monday)

| Monday | Vores løsning | Status |
|---|---|---|
| **Sidekick AI-assistent**: kender dine data og udfører arbejde | Gauzys **AI-assistent** (chat i sidepanelet). Den kan læse opgaver og projekter, åbne sider, udfylde formularer, oprette opgaver og starte/stoppe tid. Den handler som brugeren selv, og alle ændringer kræver et klik på *Godkend*. Kan bruge **Claude** (Anthropic), OpenAI, Gemini, Mistral m.fl. | ⚙️ Kræver en API-nøgle (Indstillinger → AI). Er testet til at starte, men ikke med en rigtig nøgle |
| **Diktering / tale** | Mikrofonknap i AI-chatten med tale-til-tekst via Mistral, OpenAI, Groq, Deepgram eller lokal Whisper | ⚙️ Kræver en tale-udbyder |
| **AI-mødereferent** (Notetaker) | Findes ikke i Gauzy. Bygges i vores app: optag mødet eller upload lyd → tekst → AI-referat med beslutninger og opgaver → opgaverne oprettes i Gauzy efter godkendelse | 🛠 |
| **AI-kolonner**: AI udfylder felter på hver opgave | Findes ikke i Gauzy. Bygges i vores tavlevisning, fx "Risiko", "Næste skridt", "Opsummér tjekliste" eller "Mangler i KS-pakken" pr. opgave | 🛠 |
| **AI-agenter** (agent workforce) | Gauzys AI-assistent kan i forvejen udføre flertrinsopgaver. Faste agenter, fx "Hver mandag: find forsinkede faser og skriv til ansvarlig", laves i automatiseringsværktøjet (se nedenfor) | ⚙️ + 🛠 |
| **AI workflow builder** | **Activepieces** er indbygget i Gauzy som integration og kan køres hos os. Det er et open source-alternativ til Zapier/Make med AI-trin, der bygger forløb ud fra en tekstbeskrivelse | ⚙️ Activepieces-container tilføjes på serveren |
| **Vibe app builder**: lav små apps ud fra en beskrivelse | Findes ikke i Gauzy. Den nærmeste mulighed er Lovable (ekstern tjeneste, betales separat). Gauzys AI-assistent kan i stedet lave formularer og opgaver | Ikke dækket fuldt ud |
| **MCP**: forbind eksterne AI-værktøjer | Gauzy har sin egen **MCP-server**, så fx Claude Desktop kan arbejde direkte i opgaverne | ⚙️ |
| **AI-kreditter** | Ingen kreditter. Man betaler AI-udbyderen direkte efter forbrug | – |

## Arbejdsstyring

| Monday Pro | Vores løsning | Status |
|---|---|---|
| Tavler med opgaver, statusser og ansvarlige | Projekter og opgaver med danske statusser, tags, ansvarlige og frister | ✅ |
| **Avancerede visninger**: kanban, tidslinje/Gantt, kalender, arbejdsbyrde | Gauzy har kun tabel og gitter, plus kalender for aftaler. **Kanban, Gantt/tidslinje og arbejdsbyrde bygges** i vores app oven på Gauzys data | 🛠 |
| Private tavler og dokumenter | Private og offentlige projekter, dokumenter med mapper og wiki | ✅ |
| Docs | Dokumentcenter med upload, wikisider, søgning i indhold og AI-søgning | ✅ |
| Dashboards | Overblik for tidsregistrering, projektstyring, regnskab og teams, plus egne widgets | ✅ |
| Avancerede kolonner (formler, afhængigheder) | Opgaver har underopgaver, linkede opgaver og estimater. Tjeklisterne i feltappen har tal, valg, foto og underskrift | ✅ delvist |
| **Tidsregistrering** | Timer, timesedler, manuel tid, godkendelse og rapporter | ✅ |
| **Automatiseringer** (25.000 handlinger/md) | Activepieces, Zapier, Make, Sim eller webhooks. Med Activepieces på egen server er der ingen grænse | ⚙️ |
| **Integrationer** (25.000 handlinger/md) | GitHub, Jira, Plane, Upwork, Hubstaff, Zapier, Make, Activepieces. Dalux kan kobles på via Activepieces eller API | ⚙️ |
| **API** (10.000 kald/dag) | Fuldt REST-API uden dagsgrænse (feltappen bruger det) | ✅ |
| Formularer | Feltappens tjeklister med fotos og underskrift | ✅ (til feltarbejde) |
| Mobil-app | Feltapp til telefonen (kan lægges på hjemmeskærmen) | ✅ |
| Gæster / eksterne | Gauzy har gæsteroller og invitationer. Tilbudsvisningen kan deles uden login | ✅ |
| Pris | 19 €/bruger/md (10 brugere ≈ 1.400 kr./md) | Ca. 110 kr./md for serveren, uanset antal brugere, plus AI efter forbrug |

## Ud over Monday (solcellespecifikt)

| Funktion | Status |
|---|---|
| Tilbudsvisning pr. lokation: tegning af anlæg på taget med brandfelter, produktion pr. måned, forbrug fra net/sol, typisk dag | ✅ |
| Feltapp med tjeklister pr. fase (screening, montage, AC/SPD, idriftsættelse, aflevering, service, termografi) | ✅ |
| Fotos med lokation og tidsstempel, underskrift med fingeren | ✅ |
| Feltrapport skrives automatisk ind i opgaven i Gauzy | ✅ |

## Plan for det, der skal bygges

1. **Slå AI til.** Læg en Claude-nøgle og en tale-udbyder ind, og test assistenten på rigtige opgaver.
2. **Tavlevisninger i appen.** Kanban (træk opgaver mellem statusser), Gantt/tidslinje pr. lokation, kalender og arbejdsbyrde pr. montør.
3. **AI-mødereferent.** Optag eller upload → tekst → referat → opgaver.
4. **AI-kolonner** i tavlevisningen.
5. **Automatiseringer og agenter.** Activepieces på serveren med færdige forløb, fx "fase forsinket → besked", "KS-pakke godkendt → næste fase", "ugentlig statusmail" og "ny Dalux-sag → opgave".
