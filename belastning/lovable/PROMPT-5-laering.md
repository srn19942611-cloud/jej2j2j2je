# PROMPT 5 — Feedbackloop, så modellen bliver bedre

*(Kør til sidst. Det er den etape, der gør værktøjet bedre for hver sag.)*

---

Byg feedbackloopet. Logikken ligger færdig i `src/lib/belastning/laering.ts`.

## 1. Fang rettelser automatisk

Ved hvert gem af forbrugerlisten:

```ts
import { registrerRettelser } from '@/lib/belastning/laering';
const rettelser = registrerRettelser(foreslaaet, gemt, stamdata, projektId);
// skriv dem til tabellen rettelser
```

`foreslaaet` er det, modellen genererede; `gemt` er det, brugeren har rettet til.
Brugeren skal ikke gøre noget. Ved siden af hvert rettet felt vises et lille valg af
årsag (datablad, tegning, maskinliste, erfaring, fejl i kataloget, projektspecifikt) —
valgfrit, men det gør forslagene skarpere. **Projektspecifikt** betyder, at rettelsen
kun gælder denne sag og ikke tælles med i læringen.

## 2. Admin-skærm: forslag til kataloget

```ts
import { aggregerRettelser, skaleringsforslag, anvendForslag } from '@/lib/belastning/laering';
```

Vis forslagene med observationer, antal projekter, spredning, årsagsfordeling og
motorens begrundelse, fx:

> **[godkend] SL12.kw: 8,5 → 9,5** — 3 rettelser fra 3 projekter peger samstemmende på
> 9,5 (+12 % i forhold til katalogets 8,5). 3 af dem stammer fra datablade.

Tre knapper: **Godkend** (opdaterer `katalog` og skriver til `katalog_historik`),
**Afvis**, **Udskyd**. Sortér efter anbefaling: godkend før undersøg før afvent.

Skaleringsforslag vises samme sted: "Impulskølere: ét stk. pr. 38 m² i stedet for 58 m²,
målt på 4 sager."

**Kataloget må aldrig ændre sig automatisk.** Afsluttede projekter må ikke ændre sig
bagudrettet — de har deres egne rækker. Når en katalogværdi er ændret, kan et åbent
projekt vise "katalogværdien er ændret siden, vil du opdatere denne sag?".

## 3. Kalibrering mod målt forbrug

En skærm hvor man registrerer målt 15-minutters peak for en butik i drift: butik,
butikstype, salgsareal, beregnet maks. fasestrøm og målt peak. `kalibrer()` giver
faktoren målt/beregnet, A pr. m² som interval og median, samlet og pr. butikstype.

Vis faktoren som et nøgletal ("beregningen rammer i gennemsnit 2,0 × målt peak") og gør
det nemt at tilføje en måling — **det er det vigtigste, der skal blive rutine.** Hver
butik, der måles, gør alle efterfølgende sager billigere at dimensionere.

## 4. Tegningsudtrækket lærer af sine fejl

Ved review gemmes både modellens tal og brugerens tal pr. kode i `udtraek_praecision`.
`udtraeksstatistik()` og `faldgruberTilPrompt()` finder de koder, der systematisk læses
skævt, og laver linjer, der lægges ind i vision-prompten som kendte faldgruber:

> "Kasselinje tælles systematisk for højt (−80 %) — sandsynligvis tolkes tal på tegningen
> som styktal."

## 5. Status-side

Antal rettelser og hvor mange projekter de kommer fra, forslag klar til godkendelse,
dækningsgrad i nye sager (andel rækker fra tegning/datablad/maskinliste — bør stige),
andel rækker uden rettelser i sidste sag (træfsikkerhed — bør stige), antal
kalibreringsmålinger og den aktuelle faktor.
