# Prompt til Lovable

Kopier alt under stregen ind som første besked i et nyt Lovable-projekt, og upload
mappen `belastning/` (eller mindst `data/`, `engine/` og `supabase/`) som filer i projektet.

---

Byg **Effektoversigt** — et internt værktøj til Coop Ejendomme, der dimensionerer
hovedtavlen til en butik. Brugerne er byggeledere og projektledere i Byg & Etablering,
der i dag bruger flere timer pr. sag på at læse antal udstyr af på plantegninger og
sætte det op i Excel. Værktøjet skal gøre det til et review-job på under en time.

## Stak

React + TypeScript + Tailwind + shadcn/ui. Lovable Cloud (Supabase) til data, storage og
auth. Excel-eksport med `exceljs` + `file-saver`. Dansk brugerflade, dansk talformat
(komma som decimalseparator).

## Medfølgende filer — brug dem, opfind ikke nye tal

- `supabase/skema.sql` + `supabase/seed-katalog.sql` — kør dem som migration. Skemaet er
  færdigt: `katalog`, `butikstyper`, `referencemaalinger`, `projekter`, `forbrugere`,
  `tegninger`, `kode_mapping`, `revisioner`, med RLS.
- `engine/beregning.ts`, `engine/tegning.ts`, `engine/typer.ts`, `engine/data.ts` —
  beregningskernen. Den er testet mod en rigtig sag; **kopiér den ind som den er** og
  byg UI ovenpå. Lav ikke dine egne formler.
- `data/*.json` — kilden bag `engine/data.ts` og seed-filen.
- `docs/` — datamodel, beregningsregler, tegningsflow, eksportlayout, kvalitetstjek.

## Skærmbilleder

1. **Projekter** — liste med butiksnavn, type, salgsareal, foreslået ampererettighed,
   status (kladde / til review / godkendt / bestilt). Opret, dupliker, slet.

2. **Stamdata** — butikstype (udfylder arealer, kasser og tilvalg fra `butikstyper`),
   arealer, antal kasser og SCO, tilvalg som chips (deli, bake-off, slagter, central køl,
   varmepumpe, flaskeautomat, elevator, ladestandere, sprinkler, solceller). Under en
   sammenklappelig sektion "Tekniske forudsætninger": installationsmetode, motorfaktor,
   maks. spændingsfald, kortslutningsstrøm ved hovedtavle, buffer, tavlereserve,
   køleydelse i ventilationsaggregat, komfortkøl-faktorer. Alle med default fra
   `engine/data.ts`.

3. **Plantegning** — upload PDF eller billede, render til PNG, send til vision-modellen
   med prompten i `data/tegningsudtraek-prompt.md`, og vis resultatet i en
   **review-skærm med tre kolonner**: tegning · optælling (kode, læst antal, tillid,
   foreslået katalogpost, alt redigerbart) · effekt af rettelsen. Ukendte og "forslag"-koder
   skal bekræftes, og bekræftelsen gemmes i `kode_mapping`, så den genbruges næste gang.
   Godkendt optælling flettes med butikstypens skabelon via `fletMedSkabelon()`.
   Vis dækningsgrad: hvor stor en del af rækkerne der stammer fra tegning/datablad.

4. **Forbrugere** — redigerbar tabel over effektlisten. Kolonner: aktiv, gruppe, navn,
   afdeling, antal, kW/stk, V, cos φ, DF, grupper, MCB, kabel, længde, karakteristik,
   RCD, nød, bimåler, kilde, note, samt beregnet inst. kW, belastet kW, A/gruppe og
   status. MCB, kabel og antal grupper vises som forslag, der kan overstyres — og det
   skal fremgå, når en værdi er overstyret. Tilføj række fra katalog med søgefelt.
   Filtrér på afdeling og på kilde.

5. **Hovedtavle** — nøgletallene: installeret kW, samtidig kW, samlet DF, W/m²,
   fasebalance (L1/L2/L3 med skævhed), antal grupper, moduler inkl. reserve, hovedkabel.
   Øverst det vigtigste kort: **valg af ampererettighed** — beregnet værdi,
   referenceinterval fra målte butikker, foreslået rettighed og begrundelsen fra
   `anbefaling.begrundelse`. Under det: gruppeskemaet i Mariannes format
   (1P+N C10, 1P+N C16, 3P+N C10, 3P+N C16, 3P+N C32) og kvalitetstjekkene med
   grøn/gul/rød og en kort forklaring på, hvad man gør, når et tjek fejler.

6. **Komfortkøl** — varmebalancen post for post, ventilationens køleydelse, underskud,
   anbefalet split-effekt og antal enheder, samt tommelfingerreglen som kontroltal.

7. **Eksport** — Excel med de ni ark, der er beskrevet i `docs/04-excel-eksport.md`,
   samt gem revision (snapshot i `revisioner`) og PDF-print af hovedtavlesiden.

## Regler, der ikke må laves om

- **Hver række har en kilde** (`Tegning`, `Datablad`, `Maskinliste`, `Byggeprogram`,
  `Referencetavle`, `Skaleret erfaring`, `Manuel`). Kilden vises i UI og i eksporten.
  Et tal uden kilde er ubrugeligt over for en leverandør.
- **Beregningen er ikke facit for ampererettigheden.** Beregnede lister ligger typisk
  40–70 % over målt peak. Vis altid beregning og reference ved siden af hinanden, og
  gør det tydeligt, at kabel og tavle dimensioneres efter beregningen, mens rettigheden
  købes efter det vægtede skøn.
- **Vision-udtræk skal altid bekræftes af et menneske**, før det bliver til en
  forbrugerliste. Ingen automatisk godkendelse.
- Solceller regnes som negativ effekt og indgår ikke i hovedsikringen.
- Ingen sletning uden bekræftelse; projekter arkiveres i stedet.

## Rækkefølge

1. Migration + seed, så katalog og butikstyper ligger i databasen.
2. Projekter → stamdata → forbrugerliste fra skabelon → hovedtavle. Værktøjet skal være
   brugbart **uden** tegning fra dag ét.
3. Excel-eksport.
4. Tegningsupload, vision-udtræk og review-skærm.
5. Revisioner og kode_mapping-læring.
