# PROMPT 2 — Excel-eksport og revisioner

*(Kør når etape 1 virker, og motoren ligger i `src/lib/belastning/`.)*

---

Byg eksporten. **Den er allerede skrevet færdig** i `src/lib/belastning/eksport.ts` —
du skal ikke lave arkene selv og ikke installere exceljs eller file-saver.

```ts
import { byggExcel, filnavn } from '@/lib/belastning/eksport';

const bytes = byggExcel(stamdata, resultat);            // Uint8Array
const blob = new Blob([bytes], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});
// download blob med filnavn(stamdata)
```

Filen indeholder ti faner: Forside, Effektliste, Gruppeskema, Mærkatliste, Fasebalance,
Nødforsyning, Komfortkøl, Byggeprogram-tjek, Tavlebestilling og Forudsætninger.

## Eksport-skærm

- Knap **"Hent Excel"** med filnavnet vist.
- En liste over, hvad filen indeholder, så brugeren ved, hvad der sendes videre — med
  særlig fremhævelse af **Tavlebestilling**-fanen, der kan sendes direkte til
  tavlebyggeren.
- **Advarsel før download**, hvis kvalitetstjekkene har røde punkter: "Der er 2 krav, der
  ikke er opfyldt. Vil du eksportere alligevel?" — men bloker ikke.
- Vis dækningsgraden: hvor stor en del af rækkerne der stammer fra tegning, datablad
  eller maskinliste frem for erfaringstal.

## Revisioner

Knappen **"Gem revision"** skriver et snapshot af stamdata, forbrugere og resultat til
tabellen `revisioner` med en note fra brugeren ("Sendt til tavlebygger 12-05").

Vis revisionerne som en tidslinje på projektet. Man skal kunne se en gammel revision og
sammenligne den med den aktuelle: hvilke rækker er kommet til, faldet fra eller ændret,
og hvordan har hovedstrømmen og den foreslåede ampererettighed flyttet sig.

Det er sporbarheden bag en bestilt tavle: man skal altid kunne svare på, hvad der lå til
grund den dag, bestillingen blev sendt.

## PDF-print

Lav en printvenlig udgave af hovedtavle-siden (browserens print til PDF er nok):
nøgletal, valg af ampererettighed med begrundelse, gruppeskema og kvalitetstjek på én
side. Den bruges til at vedlægge en mail.
