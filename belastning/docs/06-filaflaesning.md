# Filaflæsning

App'en skal kunne tage imod det, der faktisk kommer ind i en sag: en maskinliste fra
en leverandør, en effektoversigt fra en rådgiver, et PDF-datablad, en plantegning.
Målet er, at brugeren uploader filen og *reviewer* et udkast — ikke taster af.

Reglerne ligger i `data/kolonneordbog.json`, koden i `engine/indlaesning.ts`.

## Pipeline

```
1. Upload      → storage-bucket "dokumenter", række i tabellen dokumenter
2. Genkend     genkendFiltype(filnavn, overskrifter) → maskinliste | effektoversigt |
               gruppeskema | datablad | plantegning | byggeprogram
3. Læs         regneark: SheetJS → array of arrays.  PDF: tekstlag, ellers vision.
4. Kolonner    matchKolonner() finder overskriftsrækken og binder kolonner til felter
5. Værdier     parseTal / parseSpaending / parseJa — dansk talformat, "3 x 400" osv.
6. Bind        bindTilKatalog(): maskinnummer → navn → navnelighed
7. Konflikter  sammenlign med katalogets standardværdier
8. Review      brugeren godkender række for række → forbrugere + rettelser
```

Intet skrives til projektet uden trin 8.

## Filtyper og hvad de bruges til

| Filtype | Genkendes på | Bruges til |
|---|---|---|
| **Maskinliste** | "maskintype", "leverandør", "stk", "kardex" | Enkeltposter til forbrugerlisten. Stærkeste kilde, fordi maskinnumrene (SL7a, SL11 …) matcher katalogets id'er direkte. |
| **Effektoversigt** | "mærkat", "cos", "df", "belast", "sikring" | Indlæses som et helt projekt — bruges til at genskabe en gammel sag eller sammenligne med en rådgivers forslag. |
| **Gruppeskema** | kolonner som "1P+N C10", "3P+N C32" | Antal grupper pr. type. Sætter `grupper`, `mcb` og `karakteristik` direkte. |
| **Datablad (PDF)** | "rated", "nominal", "tilslutning" | Retter kW, spænding og cos φ på én post. Den vigtigste kilde til at forbedre katalogets standardværdier. |
| **Plantegning** | "salgslokale", "m2", "målestok" | Se `docs/03`. |
| **Byggeprogram** | "byggeprogram", "§" | Krav til tjeklisten, ikke til forbrugerlisten. |

## Det, ordbogen håndterer

**Kolonnenavne** matches mod synonymlister — "Maskintype", "Forbruger", "Betegnelse" og
"Salgslokale" er alle navnekolonnen. VVS-kolonner ("varmt vand", "afløb", "aftræk")
ignoreres eksplicit, så FDB-maskinlisten kan læses uden opsætning.

**Værdiformater** fra de virkelige ark:

| Står i arket | Læses som |
|---|---|
| `11,1` · `16,5 kW` | 11.1 · 16.5 (dansk decimalkomma, enheder fjernes) |
| `3 x 400` | 400 V, 3-faset |
| `230/400` | 400 V, 3-faset, **tillid 0,5 + advarsel** — kan være 1-faset tilslutning |
| `x` · `JA` | ja |
| `?` · `??` · `afklares` | ukendt, ikke nul |
| `1*` · `1**` | antal grupper + fodnote: posterne med samme tegn deler gruppe |

**Overskriftsrækker** midt i arket ("Slagter", "Lager", "Hovedtavle", "SUM") springes over,
fordi de mangler tal.

## Binding til katalog

1. **Maskinnummer** i nr.-kolonnen (`SL11`, `BC7`, `LA1`) → direkte opslag. Score 1,0.
2. **Identisk navn** → score 0,95.
3. **Navnelighed** (fælles ord, delvis match) → score op til 0,9. Under 0,5 bindes der ikke.

Uden binding havner rækken i `ubundne`, hvor brugeren vælger katalogpost, opretter en ny
eller markerer "ingen el" — sådan som `SL8 Stålbord` og `Stikvogne` skal ende.

## Konflikter er ikke fejl — de er læringsmateriale

Når et datablad siger 9,5 kW, og katalogets standardværdi er 8,5 kW, dannes en konflikt.
Brugeren vælger, hvad der gælder for sagen, og valget bliver samtidig en **rettelse**,
der indgår i feedbackloopet (`docs/07`). Det er sådan katalogets tal bliver bedre uden,
at nogen skal sidde og vedligeholde dem manuelt.

## Grænser

- DWG læses ikke direkte — eksportér til PDF eller PNG først.
- Scannede PDF'er uden tekstlag kræver vision-kaldet og giver lavere tillid.
- Sammenlagte celler og flerlinjede overskrifter i regneark kan flytte kolonneindekset;
  derfor vises den fundne kolonnetolkning altid i review-skærmen, så den kan rettes.
