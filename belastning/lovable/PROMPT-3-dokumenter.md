# PROMPT 3 — Indlæsning af maskinlister og datablade

*(Kør når etape 2 virker.)*

---

Byg dokumentindlæsningen. Logikken ligger færdig i
`src/lib/belastning/indlaesning.ts` — brug den, skriv ikke din egen parser.

```ts
import { indlaes } from '@/lib/belastning/indlaesning';
const resultat = indlaes(filnavn, raekker, katalog, stamdata, 'Maskinliste');
// resultat: { filtype, mapping, bindinger, ubundne, konflikter, advarsler }
```

`raekker` er regnearket som `unknown[][]` — brug SheetJS til at læse xlsx/xls/csv.

## Upload

Træk-og-slip af `.xlsx`, `.xls`, `.csv` og `.pdf` på projektet. Filen gemmes i storage og
som en række i tabellen `dokumenter` sammen med det rå udtræk og den tolkning, brugeren
godkender. Motoren genkender selv filtypen: maskinliste, effektoversigt, gruppeskema,
datablad, plantegning eller byggeprogram.

## Review-skærm — det er her tiden spares

Tre dele under hinanden:

**1. Kolonnetolkningen** øverst: hvilken række blev opfattet som overskrifter, og hvilken
kolonne blev til hvilket felt. Skal kunne rettes med en dropdown pr. kolonne, hvorefter
indlæsningen kører igen.

**2. Rækkerne**: læst værdi, foreslået katalogbinding med score og begrundelse
("Maskinnummer SL11", "Navnelighed med BC7"), samt advarsler. Alt kan rettes. Rækker uden
binding (stålborde, stikvogne) markeres **"ingen el"** med ét klik.

**3. Konflikter** mod katalogets standardværdier, vist som `8,5 kW → 9,5 kW (datablad)`
med tre valg:
- *Brug i denne sag* — kun dette projekt
- *Brug og foreslå ændring i kataloget* — skriver også en rettelse til feedbackloopet
- *Afvis* — behold katalogets værdi

Først når brugeren trykker **Godkend**, skrives rækkerne til `forbrugere` med kilden sat
til dokumenttypen.

## Det, motoren allerede håndterer — nævn det i brugerfladen

Dansk decimalkomma (`11,1`), enheder i cellen (`16,5 kW`), `3 x 400` som 400 V 3-faset,
`230/400` som tvetydig med advarsel, `x`/`JA` som ja, `?` som ukendt, og fodnoter som
`1**`, der betyder at posterne deler gruppe. VVS-kolonner (varmt vand, afløb, aftræk) i
FDB-maskinlisten springes over automatisk.
