# PROMPT 4 — Indretningstegning og kalkuleret ark

*(Kør når etape 3 virker.)*

---

Byg tegningslæsningen. Geometrien ligger færdig i `src/lib/belastning/geometri.ts` —
den finder selv skala, rum, arealer og møbelløb og regner effekten ud af løbende meter
og kvadratmeter.

## PDF-laget

Installér `pdfjs-dist` og byg en `PdfSide` af hver side:

```ts
const page = await doc.getPage(n);
const tc = await page.getTextContent();
const tekster = tc.items.map((i) => ({
  tekst: i.str, x: i.transform[4], y: i.transform[5],
  bredde: i.width, hoejde: i.height,
  lodret: Math.abs(i.transform[1]) > Math.abs(i.transform[0]),
}));
// streger: gennemløb page.getOperatorList() og saml constructPath-segmenter
// (moveTo/lineTo/rectangle) som {x1,y1,x2,y2}, transformeret med den aktuelle CTM.
```

Derefter:

```ts
import { byggKalkule, kalkuleTilForbrugere } from '@/lib/belastning/geometri';
import { fletMedSkabelon } from '@/lib/belastning/tegning';

const kalkule = byggKalkule(side);
const fraTegning = kalkuleTilForbrugere(kalkule, katalog, stamdata);
const liste = fletMedSkabelon(fraTegning, stamdata, katalog, { overtagKw: true });
```

## Skærmen "Tegning"

**Øverst: den fundne skala.** Metode (målkæde, målestok eller rumareal), mm pr.
tegningsenhed, tillid og kontrolmålingerne med deres afvigelse i procent. Er tilliden
under 0,6, vises en tydelig advarsel om, at alle længder bør bekræftes.

**Rum:** navn, type, areal og tillid. Knappen "Brug arealer som stamdata" udfylder
salgsareal, lagerareal og øvrigt areal og slår tilvalg til (deli, slagter, central køl).

**Møbelløb:** kode, antal, længde i meter, og de to uafhængige tællinger side om side —
tallet fra tegningen og målt længde ÷ modulbredde — med motorens forklaring
("Tallet 6 stemmer med den målte længde"). Antal skal kunne rettes.

**Det kalkulerede ark:** én linje pr. beregning med grundlag (løbende meter / areal /
stk), mål ("6 moduler à 1,02 m = 6,12 m"), nøgletal ("1,00 kW/m"), kW, tillid, kilde og
forklaring. Linjer med tillid under 0,5 markeres. Linjer mærket som grove afdelingstal
vises adskilt, og summen vises både med og uden dem.

Knappen **"Overfør til effektliste"** kører fletningen ovenfor.

## Scannede tegninger

Har PDF'en intet tekstlag, renderes siden til PNG i mindst 2000 px bredde og sendes til
Lovable AI med prompten i `data/tegningsudtraek-prompt.md`. Svaret er en optælling, som
køres gennem `optaellingTilForbrugere()` fra `tegning.ts` og vises i samme review-skærm —
bare med lavere tillid. Ukendte koder og koder markeret som "forslag" skal bekræftes, og
bekræftelsen gemmes i `kode_mapping`, så den genbruges næste gang.

Excel-eksporten får automatisk en ekstra fane, når der findes en kalkule:
`byggExcel(stamdata, resultat, kalkule)`.
