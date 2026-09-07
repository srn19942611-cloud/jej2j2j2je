# Sådan bygger du Effektoversigt i Lovable

Alt, hvad Lovable skal bruge, ligger i denne mappe. Fremgangsmåden er: opret projektet
med **PROMPT-1**, læg motoren ind via GitHub, og kør derefter **PROMPT-2 til 5** én ad
gangen. Etapevis virker langt bedre end én stor prompt — Lovable bygger færdigt og
testbart i hvert skridt.

## Indhold

```
src/lib/belastning/     motoren — 9 TypeScript-filer, klar til at lægge i projektet
supabase/migrations/    3 SQL-filer: skema, seed af referencedata, indlæsning og læring
PROJEKT-VIDEN.md        indsættes i Lovables "Knowledge"-felt (gælder alle beskeder)
PROMPT-1 … PROMPT-5     indsættes som chatbeskeder, én ad gangen
data/ og docs/          kilderne bag motoren — læg dem med i repoet som dokumentation
```

## Trin for trin

**1. Opret projektet.** Nyt Lovable-projekt → indsæt hele **PROMPT-1-fundament.md** som
første besked. Lovable opretter app, database og de første skærmbilleder.

**2. Sæt projektviden.** Åbn projektets indstillinger → Knowledge → indsæt hele
**PROJEKT-VIDEN.md**. Det er de regler, der skal gælde i alle senere beskeder, så du
ikke behøver gentage dem.

**3. Læg motoren ind via GitHub.** I Lovable: GitHub → Connect, som opretter et repo til
projektet. Gå til repoet på github.com og upload:

- hele mappen `src/lib/belastning/` (9 `.ts`-filer)
- hele mappen `supabase/migrations/` (3 `.sql`-filer)
- gerne også `data/` og `docs/` som dokumentation

GitHubs "Add file → Upload files" tager en hel mappe med træk-og-slip. Commit direkte på
main. Lovable henter ændringerne automatisk.

> **Hvorfor GitHub og ikke bare indsætte filerne i chatten?** `data.ts` er ca. 3000
> linjer katalogdata. Den skal ikke skrives af en model — den skal kopieres uændret.

**4. Fortæl Lovable, at motoren er der.** Skriv i chatten:
> Motoren ligger nu i `src/lib/belastning/`. Brug den som den er — skriv ikke dine egne
> formler eller parsere. Kør migrationerne i `supabase/migrations/` i rækkefølge.

**5. Byg videre.** Kør **PROMPT-2** (Excel-eksport), **PROMPT-3** (dokumentindlæsning),
**PROMPT-4** (indretnings-PDF) og **PROMPT-5** (feedbackloop) — én ad gangen, og tjek
resultatet i preview mellem hver.

## Hvis Lovable går i stå eller begynder at improvisere

| Symptom | Skriv dette |
|---|---|
| Den skriver sine egne beregninger | "Brug `beregn()` fra `src/lib/belastning/beregning` — lav ikke dine egne formler. Alle tal skal komme fra motoren." |
| Den vil installere exceljs eller file-saver | "Excel-eksporten er færdig i `eksport.ts` og har ingen afhængigheder. Kald `byggExcel()` og gem resultatet med en Blob." |
| Typefejl på `.ts`-imports | "Importér uden filendelse: `from './typer'`, ikke `from './typer.ts'`." |
| Den ændrer katalogets tal | "Kataloget er dimensioneringsdata. Det ændres kun gennem godkendte forslag i admin-skærmen, aldrig automatisk." |
| Den bygger for meget på én gang | "Gør kun det, denne besked beder om. Vi bygger i etaper." |

## Rækkefølgen er valgt med vilje

Værktøjet skal være brugbart **uden** tegning fra dag ét: butikstype + arealer + antal
kasser giver allerede en komplet liste på 60–80 rækker. Excel-eksporten kommer som nr. 2,
fordi det er den, der faktisk sendes videre. Tegningslæsningen er nr. 4 — den er den
mest imponerende, men den mindst nødvendige.
