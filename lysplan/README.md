# Lysplan

Værktøj til at lægge bygningstegninger ind, tegne butiksindretningen og regne
belysningsplanen ud – stykliste, nøgletal og gruppeopdeling, i samme opbygning
som SJOC-lysplanerne til Coop-butikkerne.

Åbn `lysplan/index.html` i en browser. Ingen installation, ingen server:
tegninger og projekter forlader aldrig maskinen.

## Arbejdsgang

1. **Importér tegning** – træk DWG, DXF, PDF, PNG, JPG eller SVG ind på
   tegnefladen. DWG og DXF læses som vektor med tegningens egne mål, lag og
   farver, så målestokken sættes automatisk. Flere lag kan ligge oven på
   hinanden (f.eks. plan + inventaropstilling), og hvert lag kan tændes,
   dæmpes, skaleres og forskydes, så tegningerne flugter. Lagene inde i en
   CAD-tegning kan slukkes enkeltvis, så målsætning og møblering ikke støjer.
2. **Målestok** – kom den ikke med tegningen: klik to punkter med kendt
   indbyrdes afstand og indtast målet. Derefter regnes alt i meter og m².
3. **Salgsareal** – tegn polygonen om salgslokalet. Arealet vises løbende.
4. **Beregn belysningsplan** – vælg koncept, c/c-afstand og mål-lux. Værktøjet
   lægger skinnerækker ud i arealet, klipper dem mod væggene og fordeler
   armaturer, til lyskravet er dækket.
5. **Ret til i hånden** – tegn ekstra skinnerækker, placér enkeltarmaturer
   (de snapper til nærmeste skinne), flyt og slet. Ctrl+Z fortryder.
6. **Ud af huset** – stykliste som CSV, plan som PNG, samlet udskrift med
   tegning, stykliste og elnoter, og hele projektet som `.json` til senere.

Genveje: `H` flyt, `V` vælg, `M` målestok, `A` salgsareal, `S` lysskinne,
`Enter` afslut optegning, `Esc` fortryd optegning, `Delete` slet det valgte.
Alt-tasten slår vinkellåsen fra under optegning og snap fra ved placering.

## Det programmet regner

* **Skinner** opdeles i standardlængder 4000/3000/2000 mm med færrest mulige
  stykker. Lige samlinger følger af opdelingen, hjørnesamlinger af
  knækpunkterne, og T-samlinger tælles, hvor en rækkes ende lander midt på en
  anden række. Frie ender får endestykke; start/tilslutning sættes pr. række
  (kan ændres).
* **Wireophæng + wire bracket** beregnes ud fra en c/c-afstand pr. meter skinne
  for de rækker, der er nedhængt i wire.
* **Belysningsstyrke** er et overslag efter lumenmetoden:
  `E = Σlm × UF × LLMF / areal`. UF og LLMF kan sættes i panelet (default 0,5 og
  0,8). Det er et overslag til dimensionering – ikke en DIALux-beregning, og
  spot- og Bricks-lys er retningsbestemt, så den reelle belysningsstyrke på
  varen er højere end fladeberegningen viser.
* **Gruppeopdeling** følger noterne på lysplanerne: fase 1 til Bricks, maks.
  12 pr. fase; fase 2 til spot, bast lamper og wall washer, maks. 30 pr. fase;
  fase 3 til fast strøm. Antal 3-polede grupper er det største krav af de to.

## Armaturdata

Kataloget i `catalog.js` er bygget på armaturteksterne fra lysplanerne
(Bricks Track Line 70W/8800 lm, Sirius spot 28W, Coop pendel 12W, LED Panel
Premium 22W/3300 lm og 30W/4500 lm, Tri-proof 33-40W, Pan Max downlight 28W,
Bricks scan 40W, SJOC Park 2 23W). Hvor et datablad ikke angiver lysstrømmen,
er den sat til et realistisk niveau for armaturtypen – ret værdien i
`catalog.js`, hvis du har producentens tal, så følger lux- og lm/m²-tallene med.

Butikskoncepterne (c/c-afstande og lysniveauer) er udgangspunkter aflæst af
eksisterende planer for Dagli'Brugsen, SuperBrugsen/Kvickly, 365discount og
lager/bagbutik. De er ment som et startpunkt, ikke som en norm.

## Filer

| Fil | Indhold |
| --- | --- |
| `index.html` | Brugerflade |
| `styles.css` | Udseende, lyst og mørkt tema |
| `catalog.js` | Armaturer, tilbehør, koncepter, skinneopdeling, elregler |
| `cad.js` | DXF-læser, DWG via LibreDWG, fladgørelse til streger og tekst |
| `geom.js` | Geometri: areal, skæringer, projektion, rotation |
| `app.js` | Tegneflade, værktøjer, beregning, stykliste, eksport |

## CAD-filer

**DXF** læses direkte i browseren af `cad.js`. Understøttet: LINE, LWPOLYLINE,
POLYLINE, CIRCLE, ARC, ELLIPSE, SPLINE, POINT, SOLID, 3DFACE, TEXT, MTEXT,
ATTRIB, LEADER, DIMENSION og INSERT med blokke, skalering, rotation og
rækker/kolonner. HATCH, MLINE og 3D-volumener springes over – de betyder intet
for en lysplan. Binær DXF understøttes ikke; gem som almindelig (ASCII) DXF.

**DWG** læses med [LibreDWG](https://www.gnu.org/software/libredwg/) oversat til
WebAssembly. Motoren fylder ca. 10 MB og ligger ikke i dette repo – den hentes
fra cdn.jsdelivr.net (med unpkg som reserve), første gang du åbner en DWG-fil,
og ligger derefter i browserens cache. Uden internetforbindelse siger
programmet til: gem i så fald tegningen som DXF i CAD-programmet, eller hent
pakken `@mlightcad/libredwg-web` ned og skriv stien til mappen under
**Tegninger → Avanceret**. LibreDWG er GPL-3-licenseret; derfor hentes den ved
kørsel i stedet for at ligge i repoet. Testet med DWG fra AutoCAD R2000, 2004
og 2018.

**Enheder:** står `$INSUNITS` i filen, bruges den (mm, cm, m, tommer …). Mangler
den, gætter programmet på millimeter for store tegninger og siger det i
beskeden – kontrollér i så fald et kendt mål med målestoksværktøjet.

**PDF** rastreres med pdf.js, som også hentes fra cdnjs første gang. Uden
internetforbindelse skal tegningen lægges ind som PNG eller JPG i stedet.
