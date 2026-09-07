# Excel-eksport

Eksporten skal kunne sendes direkte til tavlebygger og elektriker og ligne det, de er
vant til at få. Layoutet nedenfor følger de to eksisterende ark
(`Effektoversigt_Brugsen_20260708.xlsx` og Mariannes SB-effektoversigt), så modtageren
ikke skal lære et nyt format.

I Lovable: brug `exceljs` + `file-saver`. Vil man undgå afhængigheder, ligger der en
komplet, testet skriver i `engine/xlsx.js` (ca. 150 linjer, ingen dependencies).

## Ark 1 – Forside

| Felt | Kilde |
|---|---|
| Projekt, adresse, sagsnr., dato | stamdata |
| Butikstype og arealer | stamdata |
| Netform | `TN-S 3F+N+PE, 400/230 V, 50 Hz` |
| Total installeret effekt | `instKw` |
| Samtidig belastning | `belKw` og samlet DF |
| Maks. fasestrøm | `balance.maxA` (+ skævhed) |
| Reference fra målte butikker | `anbefaling.referenceA` |
| **Foreslået ampererettighed** | `anbefaling.foreslaaetRettighed` med begrundelse |
| Hovedkabel og tavle dimensioneres til | `anbefaling.dimensionerKabelOgTavleTil` |
| Dækningsgrad | andel rækker med kilde "Tegning"/"Datablad" |
| Leverandørfelter | tomme felter til tilbud, leveringstid, kontaktperson |

## Ark 2 – Effektliste

Én række pr. forbruger, kolonner i denne rækkefølge:

`Mærkat · Tavle · Afdeling · Gr. · Forbruger · Antal · kW/stk · V · cos φ · DF ·
Inst. kW · Belast. kW · Grupper · A/gruppe · Sikring · Kabel · L [m] · ΔU % ·
RCD · Bimåler · Nød · Kilde · Noter`

Nederst: sum af installeret og belastet effekt, maks. fasestrøm, valgt hovedsikring.
Solceller står som negativ effekt og indgår **ikke** i summen til hovedsikringen.

## Ark 3 – Gruppeskema

Mariannes format: én række pr. forbruger, én kolonne pr. gruppetype, celleværdien er
antal grupper.

`Gr. · Forbruger · Antal · Spænding · 1P+N C10 · 1P+N C16 · 3P+N C10 · 3P+N C16 ·
3P+N C32 · Øvrige · Bemærkning`

Kolonnerne dannes dynamisk af de kombinationer af (faser, karakteristik, størrelse),
der faktisk optræder. Sumrækken nederst er det, tavlebyggeren bestiller efter.

## Ark 4 – Mærkatliste

`Mærkat (HT01-Fxx) · Tavle · Gruppe · Forbruger/beskrivelse · Karakteristik ·
Sikring · Tværsnit · L [m] · Ref. installationsmetode · Beskyttelse (RCD)`

Mærkaterne nummereres fortløbende pr. tavle: `HT01-F01`, `UT02-F01` osv.

## Ark 5 – Fasebalance

Fordeling af 1-fasede grupper på L1/L2/L3, kVA og A pr. fase, skævhed i procent samt
listen over de største 1-fasede grupper, der kan flyttes.

## Ark 6 – Nødforsyning

Kritiske komponenter (`noedforsyning = true`) med belastning, strøm og sikring, samt
sum mod 125 A CEE-tilslutningen.

## Ark 7 – Komfortkøl

Varmebalancen post for post, ventilationens køleydelse, underskud, anbefalet split-effekt
og antal enheder — plus tommelfingerreglen som kontroltal.

## Ark 8 – Byggeprogram-tjek

Kravene fra `data/tabeller.json` med automatisk status (OK / advarsel / mangler) og den
faktiske værdi, så det kan vedlægges tavlebestillingen som dokumentation.

## Ark 9 – Tegningskalkule

Kommer der en indretningstegning ind, er dette arket, der viser, hvordan tegningen blev
til effekt. Én linje pr. beregning:

`Grundlag · Beskrivelse · Mål · Nøgletal · kW · Antal · kW/enhed · Tillid · Kilde · Forklaring`

Eksempler på indhold:

| Grundlag | Beskrivelse | Mål | Nøgletal | kW |
|---|---|---|---|---|
| løbende meter | Plug-in frostmøbel — LDF 0,9 1020x845 | 6 moduler à 1,02 m = 6,12 m | 1,00 kW/m | 6,12 |
| areal | Belysning salgsareal — SALGSLOKALE | 688 m² | 9,0 W/m² | 6,19 |
| areal | Frostrum, kompressor — FROST | 16 m² | 250 W/m² | 4,00 |
| stk | Flaskeautomat | 1 stk. | 3,50 kW/stk. | 3,50 |

Øverst: den fundne skala med metode og kontrolmålinger, listen over rum med arealer og
listen over møbelløb med antal fra tegning mod antal fra målt længde. Nederst: samlet
effekt, samlet effekt uden grove afdelingstal, og vægtet tillid.

Arket er dokumentationen for, hvorfor der står 6,12 kW og ikke noget andet — og det er
det, en leverandør kan efterprøve.

## Ark 10 – Forudsætninger

Samtidighedsfaktorer med intervaller og noter, konstanter (ρ, c, motorfaktor, maks.
spændingsfald), kabeltabellen og en kort metodebeskrivelse. Uden dette ark kan modtageren
ikke efterprøve tallene.
