# Indretnings-PDF: fra tegning til kalkuleret ark

Målet er, at man uploader indretningstegningen og får et **kalkuleret ark** tilbage: hvert
møbel, hvert rum og hver enhed, der bruger strøm, med det mål der ligger til grund
(løbende meter eller m²), nøgletallet der er brugt, den beregnede effekt og hvor sikkert
tallet er. Ingen indtastning.

Kode: `engine/geometri.ts`. Nøgletal: `data/nogletal.json`. Kører uden brugerinput —
review er en mulighed, ikke en forudsætning.

## Kæden

```
PDF → PDF-lag (tekster + streger med koordinater)
    → findSkala()      mm pr. tegningsenhed
    → findRum()        rumnavne, rumtyper og arealer
    → findLoeb()       møbelløb: familie, modulbredde, længde, antal
    → byggKalkule()    kalkuleret ark med kW pr. linje
    → kalkuleTilForbrugere() + fletMedSkabelon() → effektliste → hovedtavle
```

## PDF-laget

`engine/geometri.ts` kender ikke til PDF-formatet. Den skal have en `PdfSide`:

```ts
interface PdfSide { nr, bredde, hoejde, tekster: TekstElement[], streger: Streg[] }
interface TekstElement { tekst, x, y, bredde, hoejde, lodret? }
interface Streg { x1, y1, x2, y2 }
```

I Lovable bygges den med `pdfjs-dist`:

```ts
const doc  = await pdfjs.getDocument({ data }).promise;
const page = await doc.getPage(sideNr);

// tekster
const tc = await page.getTextContent();
const tekster = tc.items.map((i) => ({
  tekst: i.str,
  x: i.transform[4],
  y: i.transform[5],
  bredde: i.width,
  hoejde: i.height,
  lodret: Math.abs(i.transform[1]) > Math.abs(i.transform[0]),   // roterede måltal
}));

// streger: gennemløb operator-listen og saml constructPath-segmenter
const ops = await page.getOperatorList();
// OPS.constructPath → args[0] = delkommandoer (moveTo/lineTo/rectangle),
// args[1] = koordinater. Transformér med den aktuelle CTM og gem hvert segment
// som {x1,y1,x2,y2}. Kun segmenter over ca. 5 enheder er interessante.
```

Vektor-PDF er det normale fra en projekterende. Er tegningen scannet (intet tekstlag),
renderes siden til PNG i mindst 2000 px bredde og sendes til vision-kaldet i
`docs/03`; bounding boxes derfra kan bruges som `TekstElement`, blot med lavere tillid.
DWG eksporteres til PDF først.

## Skala — tre uafhængige metoder

Uden skala er alle længder værdiløse, så den bestemmes på tre måder og krydstjekkes:

| Metode | Sådan | Tillid |
|---|---|---|
| **Målkæde** | Måltal (`2.149`, `1.400`, `800`) parres med den nærmeste streg af tilsvarende længde. `mm pr. enhed = måltal / streglængde`. Median af alle fund, afvigere over 15 % kasseres. | 0,80 |
| **Målestok** | Teksten `1:100` på tegningen. `mm pr. enhed = 0,3528 × 100`. | 0,70 |
| **Kendt rumareal** | `SALGSLOKALE 688 M2` mod den tegnede flade. | 0,50 |

Målkæden vinder, fordi den står på tegningen og er uafhængig af, hvordan filen er
eksporteret. Er de andre metoder enige inden for 5 %, hæves tilliden. Er der ingen
metode, regnes med 1:100, tilliden sættes til 0,2, og der kommer en advarsel om, at
alle længder skal bekræftes.

## Rum

Enhver tekst med `M2`/`m²` læses som en rumetiket. Navnet tages fra samme tekst eller
fra det nærmeste versaltekst-navn. Rumtypen bestemmes af ordbogen i `nogletal.json`, så
`MEJERIKØL` ikke forveksles med `KØL`, og `FLASKE-INDLEV.` havner under flaskerum.

Rummene giver tre ting: arealbaserede poster (belysning, ventilation, komfortkøl,
kølerum), forslag til stamdata (salgsareal, lagerareal, øvrigt areal) og tilvalg —
findes der et DELI-rum, slås deli og bake-off til; findes der FROST eller KØL, slås
central køl til.

## Møbelløb — to uafhængige tællinger

Møbelkoder på tegningen bærer selv deres mål: `EGM 600x1200` er 600 mm bred,
`LDF 0,9 1020x845` er 1020 mm, og `CLS3760` er en 3760 mm lang række. Etiketter af
samme familie, der ligger tæt og på linje, samles til ét løb.

Antallet af moduler bestemmes af to kilder, der kontrollerer hinanden:

1. **Tallet på tegningen** (de tal, der står på reolrækkerne og kasselinjen).
2. **Den målte længde** divideret med modulbredden.

| Situation | Antal | Tillid | Forklaring i arket |
|---|---|---|---|
| De to er enige inden for 35 % | tallet fra tegningen | 0,85 | "Tallet 6 stemmer med den målte længde" |
| Kun geometri | målt længde ÷ modulbredde | 0,65 | "Målt løb på 3,60 m ÷ 0,60 m = 6 moduler" |
| Kun et tal | tallet | 0,50 | "Længden kunne ikke bekræfte det" |

Tilliden ganges med skalaens tillid, så en usikker skala aldrig kan give et sikkert
modultal. Det er netop den dobbelte aflæsning, der gør automatikken forsvarlig: to
uafhængige kilder, der skal være enige, før tallet regnes som sikkert.

## Kalkuleret ark

Én linje pr. beregning, altid med sit grundlag:

| Grundlag | Eksempel | Nøgletal |
|---|---|---|
| løbende meter | 6 moduler à 1,02 m = 6,12 m plug-in frost | 1,00 kW/m → 6,12 kW |
| areal | Salgslokale 688 m², belysning | 9 W/m² → 6,19 kW |
| areal | Frostrum 16 m² | 250 W/m² → 4,00 kW |
| stk | Flaskeautomat fundet som tekst | 3,50 kW/stk. |

Nøgletallene i `data/nogletal.json` er alle udledt af referencesagen eller
byggeprogrammet og bærer kilde og tillid. To ting er værd at kende:

- **Køl versus frost.** Et løb får én køletype — bestemt af møbelfamilien, af teksten
  eller af det nærmeste rum. Et frostløb regnes ikke også som køleløb.
- **Centraltilsluttede møbler** trækker kun lys, blæser og afrimning (0,15 kW/m) på
  butikstavlen; kompressoreffekten (0,25 kW/m køl, 0,45 kW/m frost) ligger på køletavlen.

Grove afdelingsnøgletal (deli 450 W/m², slagter 900 W/m²) er markeret som `fallback`.
De vises i arket, men indgår ikke i nettosummen, fordi de skal erstattes af
maskinlisten, så snart den findes. Arket viser derfor to tal: samlet effekt og samlet
effekt uden grove afdelingstal.

## Videre til hovedtavlen

`kalkuleTilForbrugere()` samler linjerne pr. katalogpost og bevarer modulantal og kW pr.
enhed, så effektlisten stadig viser "11 stk. à 0,64 kW" og ikke bare en klump.
`fletMedSkabelon(..., { overtagKw: true })` lægger dem oven på butikstypens skabelon:
tegningen bestemmer antal og effekt for det, den viser, og skabelonen udfylder resten
(IT, sikring, dispositionsstik, nødlys). Derefter er det almindelig beregning.

## Grænser, der skal siges højt

- Møbelkoder uden mål i teksten falder tilbage på modulfamiliens standardbredde. Er
  familien ukendt, bliver løbet ikke til effekt — det havner i listen over ubekræftede
  koder.
- Et løb målt på etiketternes placering er kortere end møblet, hvis kun første og sidste
  modul er mærket. Derfor tælles der også moduler, og de to tal krydstjekkes.
- Arealer læses fra rumetiketter. Mangler etiketten, skal arealet indtastes — polygon-
  beregning på tegningens streger er ikke pålidelig nok til dimensionering.
- Kalkulen er et grundlag, ikke en projektering. Poster med tillid under 0,5 skal
  bekræftes med et datablad eller en maskinliste, før tavlen bestilles.
