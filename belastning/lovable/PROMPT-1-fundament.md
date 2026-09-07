# PROMPT 1 — Fundament

*(Indsæt hele denne tekst som første besked i et nyt Lovable-projekt.)*

---

Byg **Effektoversigt** — et internt værktøj til Coop Ejendomme, der dimensionerer
hovedtavlen til en butik. Brugerne er byggeledere i Byg & Etablering, som i dag bruger
timer pr. sag på at læse udstyr af på tegninger og sætte det op i Excel.

Stak: React + TypeScript + Tailwind + shadcn/ui, Lovable Cloud til database, storage og
auth. Dansk brugerflade og dansk talformat (komma som decimaltegn).

Jeg lægger om lidt en færdig, testet beregningsmotor ind i `src/lib/belastning/` og tre
SQL-migrationer i `supabase/migrations/`. **Byg denne etape, så motoren kan sættes ind
bagefter uden at noget skal skrives om** — lav ikke dine egne beregningsformler.

## Denne etape

**1. Database.** Opret tabellerne fra migrationerne (jeg leverer SQL'en): `katalog`,
`butikstyper`, `referencemaalinger`, `projekter`, `forbrugere`, `tegninger`,
`kode_mapping`, `revisioner`. Referencedata seedes fra `0002_seed_referencedata.sql` —
79 udstyrsposter og 4 butikstyper. Auth: e-mail-login, alle indloggede kan se og redigere
projekter.

**2. Projektliste** (forside). Kort pr. projekt med butiksnavn, type, salgsareal,
foreslået ampererettighed og status (kladde / til review / godkendt / bestilt). Opret,
dupliker, arkivér. Søgning og filtrering på status.

**3. Stamdata-skærm.** Vælg butikstype (udfylder arealer, antal kasser og tilvalg fra
`butikstyper`), ret salgsareal, lagerareal, øvrigt areal, antal kasser og
selvbetjeningskasser. Tilvalg som chips: deli, bake-off, slagter, central køl,
varmepumper, flaskeautomat, elevator, ladestandere, sprinkler, solceller.
Under en sammenklappelig sektion "Tekniske forudsætninger": installationsmetode (A/B/C),
motorfaktor, maks. spændingsfald, kortslutningsstrøm ved hovedtavlen, buffer på
hovedsikring, krævet tavlereserve, køleydelse i ventilationsaggregatet og
komfortkøl-faktorerne. Alle med fornuftige defaults.

Når stamdata gemmes første gang, genereres forbrugerlisten fra butikstypens skabelon
(motoren har funktionen `genererForbrugerliste`). Det giver 60–80 færdige rækker med
samtidighedsfaktorer og RCD-krav. **Værktøjet skal være fuldt brugbart uden tegning.**

**4. Forbrugere.** Redigerbar tabel over effektlisten. Kolonner: aktiv, gruppe, navn,
afdeling, antal, kW/stk, V, cos φ, DF, antal grupper, sikring, kabel, længde,
karakteristik, RCD, nød, bimåler, kilde, note — plus de beregnede: installeret kW,
belastet kW, A pr. gruppe og status. Sikring, kabel og antal grupper vises som forslag,
der kan overstyres, og det skal fremgå tydeligt, når en værdi er overstyret. Tilføj
række fra kataloget med søgefelt. Filtrér på afdeling og på kilde. Kilden vises som et
lille mærkat på hver række.

**5. Hovedtavle.** Øverst det vigtigste kort: **valg af ampererettighed** — beregnet
værdi, referenceinterval fra målte butikker, foreslået rettighed og begrundelsen, som
motoren skriver ud. Under det: installeret kW, samtidig kW, samlet samtidighedsfaktor,
W/m², fasebalance for L1/L2/L3 med skævhed, antal grupper, moduler inkl. reserve og
hovedkabel. Derefter gruppeskemaet (antal grupper pr. type: 1P+N C10, 1P+N C16, 3P+N C10,
3P+N C16, 3P+N C32) og kvalitetstjekkene med grøn/gul/rød og en kort forklaring på, hvad
man gør, når et tjek fejler.

**6. Komfortkøl.** Varmebalancen post for post, ventilationens køleydelse, underskud,
anbefalet split-effekt og antal enheder, samt tommelfingerreglen som kontroltal.

## Regler

- Hver række har en **kilde** (Tegning, Datablad, Maskinliste, Byggeprogram,
  Referencetavle, Skaleret erfaring, Manuel). Den vises i brugerfladen og i eksporten.
- Beregningen er ikke facit for ampererettigheden: vis beregning og målt reference ved
  siden af hinanden, og gør tydeligt, at kabel og tavle dimensioneres efter beregningen.
- Solceller er negativ effekt og indgår ikke i hovedsikringen.
- Ingen sletning uden bekræftelse; projekter arkiveres.

Byg kun denne etape. Excel-eksport, dokumentindlæsning, tegningslæsning og feedbackloop
kommer i næste beskeder.
