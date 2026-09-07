# Feedbackloop: modellen bliver bedre af at blive rettet

Standardværdierne i kataloget er kvalificerede skøn fra to effektoversigter, en
maskinliste og et byggeprogram. Nogle af dem er forkerte. Systemet er bygget, så det
opdager det selv, i stedet for at gentage fejlen på næste sag.

Kode: `engine/laering.ts`. Tabeller: `supabase/skema-laering.sql`.

## Fire kredsløb med hver sin hastighed

| Kredsløb | Udløses af | Virker | Godkendelse |
|---|---|---|---|
| **1. Kodeordbog** | Bruger bekræfter tolkning af en tegningskode | Med det samme, i alle projekter | Ingen — bekræftelsen *er* godkendelsen |
| **2. Katalogforslag** | Gentagne rettelser af samme felt | Efter 3 rettelser fra 2 projekter | Fagligt ansvarlig godkender |
| **3. Skaleringsregler** | Rettede antal | Efter 4 sager | Fagligt ansvarlig godkender |
| **4. Kalibrering** | Målt forbrug i idriftsat butik | Løbende, skærper referenceintervallet | Ingen — måledata er måledata |

## 1. Hvad der fanges

Når brugeren gemmer, sammenlignes det, modellen foreslog, med det, der blev gemt
(`registrerRettelser`). Hver forskel på et af felterne

`antal · kw · spaending · cosphi · df · karakteristik · rcd · varmeAfgivelse ·
noedforsyning · mcb · grupper · laengde`

bliver til en række i `rettelser` med projekt, butikstype, salgsareal, før-værdi,
efter-værdi og en årsag. Årsagen udfyldes automatisk fra rækkens kilde (datablad,
tegning, maskinliste) og kan rettes af brugeren. Vil man have et tal til at gælde kun
denne ene sag, sættes `projektspecifikt` — så tælles det ikke med i læringen.

Brugeren skal ikke gøre noget aktivt. Det eneste, der kræves, er et valg af årsag,
hvis vedkommende vil kvalificere rettelsen.

## 2. Fra rettelser til nye standardværdier

`aggregerRettelser()` samler rettelser pr. (katalogpost, felt) og beregner:

- **median** af de nye værdier (robust over for enkelte tastefejl),
- **spredning** som median af de absolutte afvigelser, i procent,
- **afvigelse** i forhold til katalogets nuværende værdi,
- fordeling af **årsager**.

Anbefalingen bliver:

| Anbefaling | Betingelse |
|---|---|
| **godkend** | ≥ 3 rettelser fra ≥ 2 projekter, spredning ≤ 20 %, afvigelse ≥ 10 %, ikke overvejende projektspecifikke |
| **undersøg** | Nok data, men stor spredning (posten dækker formentlig flere apparater og bør deles op) eller overvejende projektspecifikke rettelser (lav en variant pr. butikstype i `katalog_override`) |
| **afvent** | For få observationer |

Eksempel fra testen:

> `[godkend] SL12.kw: 8,5 → 9,5 — 3 rettelser fra 3 projekter peger samstemmende på 9,5 (+12 % i forhold til katalogets 8,5). 3 af dem stammer fra datablade.`

Godkendelse sker i en **admin-skærm**, ikke automatisk. Dimensioneringsdata må ikke
ændre sig, uden at nogen har set det. Ved godkendelse skrives både den nye værdi og en
historikpost, og eksisterende projekter påvirkes ikke — de har deres egne rækker. App'en
kan vise "katalogværdien er ændret siden, vil du opdatere denne sag?".

**Antal, længde og antal grupper** bliver aldrig til katalogværdier. De er
projektspecifikke og bruges i stedet til kredsløb 3.

## 3. Skaleringsregler

Retter man antallet af impulskølere fra 12 til 18 i en butik på 688 m², siger det, at der
går ca. 38 m² pr. møbel — ikke 58, som kataloget antager. `skaleringsforslag()` regner
det implicitte m²-tal for hver sag og foreslår medianen, når der er mindst fire sager.
Det er den mekanisme, der gør skabelonen præcis for jeres butikker frem for for
"butikker i almindelighed".

## 4. Kalibrering mod målt forbrug

Det vigtigste loop. Når en butik har været i drift, indtastes det målte 15-minutters peak
i `kalibrering` sammen med den beregnede maks. fasestrøm. `kalibrer()` giver:

- **faktoren** målt/beregnet (median) — på de tre kendte referencer ca. **0,50**,
- **A pr. m²** som interval og median, samlet og pr. butikstype,
- en anbefaling i klartekst.

Faktoren bruges to steder: i vurderingen af ampererettighed (`anbefalRettighed`) og som
et nøgletal i brugerfladen, der viser, hvor konservativ beregningen er lige nu. Med fem
målinger eller flere kan referenceintervallet i modellen opdateres direkte fra data —
og så er valget af ampererettighed ikke længere et skøn, men et målt erfaringstal.

**Dette er den enkeltstående vigtigste ting at få gjort til rutine.** Hver butik, der
måles, gør alle efterfølgende sager billigere at dimensionere.

## 5. Tegningsudtrækket lærer af sine fejl

Ved review gemmes både modellens tal og brugerens tal pr. kode
(`udtraek_praecision`). `udtraeksstatistik()` finder koder med systematisk skæv aflæsning,
og `faldgruberTilPrompt()` laver linjer, der lægges ind i vision-prompten:

> `- Kasselinje tælles systematisk for højt (-80 %) — sandsynligvis tolkes tal på tegningen som styktal.`

Prompten forbedrer altså sig selv ud fra de faktiske fejl, i stedet for at nogen skal
huske at skrive reglen ind.

## Hvad der bevidst *ikke* automatiseres

- Katalogværdier ændres aldrig uden en menneskelig godkendelse.
- Rettelser fra én enkelt sag ændrer aldrig modellen.
- En godkendt ændring rører ikke ved allerede afsluttede projekter — en bestilt tavle
  skal kunne forklares ud fra de tal, der gjaldt den dag, den blev bestilt.
- Kalibreringsfaktoren skrues ikke automatisk ned i beregningen. Den vises, og mennesket
  vælger ampererettigheden. En for lille rettighed er dyrere at rette end en for stor.

## Måltal for, om loopet virker

Vis dem på en enkel status-side:

- antal rettelser og hvor mange projekter de kommer fra,
- forslag klar til godkendelse,
- andel af rækker i nye sager med kilde "Tegning"/"Datablad"/"Maskinliste"
  (dækningsgrad — bør stige),
- andel rækker uden rettelser i sidste sag (træfsikkerhed — bør stige),
- antal kalibreringsmålinger og den aktuelle faktor.
