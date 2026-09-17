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
3. **Inventar** – tryk “Find inventar i tegningen”. Reoler, køl, frost, kasser
   og diske genkendes som rektangler i CAD-tegningen, og teksterne på planen
   bestemmer varegruppe og antal fag. Alt kan rettes i listen, og manglende
   møbler tegnes med inventarværktøjet (I).
4. **Zoner** – vælg zonetype og tegn polygonen. Salgsareal, betjente områder,
   vindfang, lager og personale har hver sit lux-krav, og arealet vises løbende.
5. **Beregn belysningsplan** – vælg koncept, loftstype og c/c-afstand.
   Skinnerne lægges oven på reol- og kølerækkerne, resten af zonen dækkes med
   parallelle rækker, og armaturerne fordeles, til zonens lux-krav er dækket af
   grundbelysningen alene. Rækker den valgte c/c-afstand ikke, rykkes rækkerne
   tættere, og det siges.
6. **Se det i 3D** – sæt kigpunkter med kameraværktøjet (K) og skift til
   3D-kig. Lyset beregnes på gulv, reoler og vægge, så man kan se lysfordelingen
   i gangene. Gem en reference, ret armaturer eller inventar, og skift frem og
   tilbage for at se forskellen i lux og watt med det samme.
7. **Ret til i hånden** – tegn ekstra skinnerækker, placér enkeltarmaturer
   (de snapper til nærmeste skinne), flyt og slet. Ctrl+Z fortryder.
8. **Ud af huset** – stykliste som CSV med både armaturer og inventar, plan som
   PNG, samlet udskrift med tegning, zoner, styklister, kravkontrol og elnoter,
   og hele projektet som `.json` til senere.

Genveje: `H` flyt, `V` vælg, `M` målestok, `A` zone, `S` lysskinne,
`I` inventar, `K` kigpunkt, `3` 3D-kig, `Enter` afslut optegning, `Esc` fortryd,
`Delete` slet det valgte. Alt-tasten slår vinkellåsen fra under optegning og
snap fra ved placering. I 3D flytter W A S D, Q og E hæver og sænker, og man
trækker med musen for at kigge.

## Det programmet regner

* **Skinner** opdeles i standardlængder 4000/3000/2000 mm med færrest mulige
  stykker. Lige samlinger følger af opdelingen, hjørnesamlinger af
  knækpunkterne, og T-samlinger tælles, hvor en rækkes ende lander midt på en
  anden række. Frie ender får endestykke; start/tilslutning sættes pr. række
  (kan ændres).
* **Wireophæng + wire bracket** beregnes ud fra en c/c-afstand pr. meter skinne
  for de rækker, der er nedhængt i wire.
* **Belysningsstyrken beregnes punkt for punkt** ud fra hvert armaturs
  placering, monteringshøjde og lysfordeling: `E = Σ I(θ)·cosε / d² × LLMF`.
  Lysfordelingen ligger i en tabel pr. armatur – enten symmetrisk `cosⁿθ` eller
  batwing, hvor lyset kastes ud til siden mod varerne.
  Oven i det direkte lys lægges det reflekterede med den klassiske
  interrefleksionsformel `E = Φ·MF·ρ/(A·(1−ρ))` ud fra rummets flader og
  refleksionerne loft 70 %, vægge 50 % og gulv 20 % – de samme, SJOC's
  DIALux-rapporter regner med. Gulvet under møblerne tælles ikke med.
  Samme beregning bruges til nøgletal, kravkontrol, varmekortet i planen og
  3D-billedet, så tallene altid stemmer overens.
* **To måltal, to metoder.** Byggeprogrammet kræver 700 lux *på gulvet*.
  SJOC's egne lysberegninger opgør derimod **lodret belysningsstyrke i 0,8 m**
  (adaptiv) mod normens 300 lux i DS/EN 12464-1. Værktøjet viser begge tal pr.
  zone, så man kan se, hvad der er dokumenteret hvad.
* **Gruppeopdeling** følger noterne på lysplanerne: fase 1 til Bricks, maks.
  12 pr. fase; fase 2 til spot, bast lamper og wall washer, maks. 30 pr. fase;
  fase 3 til fast strøm. Antal 3-polede grupper er det største krav af de to.

## Kalibrering mod rigtige lysberegninger

Værktøjet er holdt op mod to af SJOC's egne DIALux-rapporter, og
kontrolberegningen kan køres direkte i fanen **Krav**:

| Sag | Areal | Armaturer | Montage | Rapportens Ēlodret | Værktøjet | W/m² rapport | W/m² her |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SuperBrugsen Støvring, 22-06-2026 | 1196 m² | 135 Bricks + 13 Pan Max | 2,80 m | 889 lux | 843 lux (−5 %) | 8,21 | 8,12 |
| Kvickly Hvidovre, 02-07-2026 | 2318 m² | 244 Bricks | 3,20 m | 789 lux | 791 lux (±0 %) | 7,43 | 7,37 |

Rapporterne regner begge med vedligeholdelsesfaktor 0,80, refleksioner
70/50/20 %, beregningshøjde 0,8 m og lodret adaptiv belysningsstyrke.
W/m²/100lx lander på 0,96 og 0,93 mod rapporternes 0,92 og 0,94.

Det, kontrolberegningen **ikke** kan sammenlignes på, er uensartetheden:
rapporterne får Uo 0,17–0,19, fordi de regner på den rigtige opstilling med
inventar, mens kontrollen her fordeler armaturerne jævnt i et tomt rektangel og
derfor får et langt højere tal.

To rettelser kom ud af rapporterne: **Pan Max downlight er 20 W / 2000 lm**
(ikke 28 W / 3000 lm som først antaget), og **Bricks Track Line er bekræftet
70 W / 8800 lm = 125,7 lm/W** – altså under byggeprogrammets krav på 130 lm/W
til grundbelysning, hvilket kontrollen derfor melder om. Bricks' lysfordeling
er sat som batwing og tilpasset, så de to sager rammes; kommer producentens
IES/LDT-fil, bør den lægges ind i stedet.

## Kontrol mod byggeprogrammet

Fanen **Krav** holder planen op mod Coops byggeprogram for belysningsanlæg
(EL – Belysningsanlæg 1.3):

| Krav | Sådan kontrolleres det |
| --- | --- |
| Salgsareal 700 lux, betjente områder og vindfang 1000 lux | pr. zone, med ±10 % tolerance som i programmets målekrav |
| Spots må ikke være grundbelysning | zonens krav skal kunne nås af grundbelysningen alene – accentlys tæller ikke med |
| ≥ 130 lm/W grundbelysning, ≥ 100 lm/W spots | pr. anvendt armaturtype ud fra katalogets W og lm |
| 3500K inde, 3000K ude, Ra > 85 | pr. anvendt armaturtype |
| Systemloft → paneler og tilt-spots, øvrige lofter → 3-fasede skinner | loftstypen sammenholdes med det, der er tegnet |
| Ra ≥ 90 og R9 ≥ 90 ved slagter, delikatesse og kød/pålæg | vist som krav; armaturet `ferskspot` opfylder det |
| 3-polede grupper, maks. 12 Bricks og 30 spots pr. fase | beregnes af antallet |

Kontrollen kommer med i både CSV-eksporten og udskriften. Den erstatter ikke
den lysberegning, lysspredning, UGR-dokumentation og måling i butikken, som
programmet kræver før bestilling – den fanger de fejl, man kan se af planen.

## Inventar fra tegningen

Genkendelsen leder efter rektangler i CAD-tegningen – både polylinjer, blokke
og rektangler tegnet med fire enkeltlinjer – og samler nabokasser med samme
retning og dybde til én række. Teksten nærmest rækken bestemmer resten:

* `6 Baby` bliver til 6 fag med varegruppen Baby.
* `4,37 m Drikkevare køl` bliver til et kølemøbel med længde.
* `FROST`, `KØL`, `Kasse`, `Slagter` m.fl. bestemmer typen; ellers gættes den
  ud fra dybden (under 1,05 m = reol, derover køl, over 1,6 m = frostø).
* Betegnelserne fra rigtige Coop-planer kendes: `CLS2100` (reol, højde 2100),
  `CLS_Endeboks`, `Mega 200`, `Kampagne`, `Katapult`, `Dumper`, `Styrtkurv`,
  `Fletkurv`, `T-rack`, `Rack 120`, `F&G-Bord`, `Brødskab H:1605`,
  `Tobaksreol`, `Posestativ`, `Pantautomat Tomra`, `Safe-pay`,
  `Lagerreol 2 paller`, `Euro 800x1200`, `1/1 Papirpalle` og kølemøbler som
  `LISBONA LF 95 3750 G` og `SANTIAGO LF 95 2500 G`, hvor tallet er længden i
  mm og `G` betyder glaslåger.
* Mål skrevet i teksten vinder over standardmålene: `H:1605`, `h:1680 d:900
  b:1267`, `B1400 x D1100 x H1400` og `600x1245x1482`.
* Står der flere varegrupper på samme gondolrække, deles rækken op efter dem og
  efter deres antal fag – som varegrupperne står på planen.

Opgørelsen giver antal, løbende meter og fag pr. type og varegruppe, med
totaler for reol, køl og frost. Alt kan rettes i listen, og rum og bygningsdele
(lager, teknik, kontor …) sorteres fra.

## Møbelbibliotek

Hvert møbel får en model med de mål, der er gængse i dansk detail, og bliver
bygget op af sokkel, gavle, bagvæg, hylder, varer, skiltefrise og eventuelle
låger – ikke som en kasse:

| Model | Højde | Dybde | Modul | Hylder |
| --- | --- | --- | --- | --- |
| Gondolareol 1800, dobbeltsidet | 1,80 m | 1,00 m | 1,00 m | 5 pr. side |
| Gondolareol 2100, dobbeltsidet | 2,10 m | 1,00 m | 1,00 m | 6 pr. side |
| Gondolareol 1400, lav gennemsigt | 1,40 m | 1,00 m | 1,00 m | 4 pr. side |
| Vægreol 2200, enkeltsidet | 2,20 m | 0,60 m | 1,00 m | 6 |
| Brødreol med skrå hylder | 1,60 m | 0,70 m | 1,00 m | 4 |
| Kølereol med glaslåger 2100 | 2,10 m | 0,90 m | 1,25 m | 5, låger à 0,625 m |
| Åben kølereol (multideck) 2000 | 2,00 m | 0,90 m | 1,25 m | 4, med kappe |
| Frostreol med glaslåger 2000 | 2,00 m | 0,80 m | 0,75 m | 5, låger à 0,75 m |
| Frostø med glaslåg 1100 | 1,10 m | 1,35 m | 1,25 m | kurve og låg |
| Betjeningsdisk med skråt glas | 1,25 m | 1,20 m | 1,25 m | – |
| Kassebånd med scanner og terminal | 0,95 m | 0,90 m | 3,00 m | bånd og pakkeplads |
| Selvbetjeningskasse | 1,45 m | 0,70 m | 0,70 m | skærm |
| Frugt & grønt-podie | 0,95 m | 1,20 m | 1,25 m | skrå kasser |
| Pallefelt / spotvare | 1,20 m | 1,20 m | 1,20 m | – |

Modellen vælges automatisk ud fra type og de mål, der står på tegningen: en
reol længere end 1,2 m fra nærmeste ydervæg regnes som dobbeltsidet gondol, en
langs væggen som vægreol, og enkeltsidede møbler vendes med fronten ind mod
butikken. Alt kan skiftes i inventarlisten, hvor højden følger med modellen.

Målene er typetal for dansk dagligvarehandel og ikke en bestemt leverandørs
katalog – ret dem i `moebler.js`, når leverandørens egne mål kendes.
Opgørelsen giver antal moduler, hylder, låger og hyldemeter oven i de løbende
meter, så styklisten kan bruges til at bestille efter.

## 3D-kig

3D-billedet tegnes uden nogen 3D-motor: gulvet lægges ud i et net på 0,5 m,
møblerne bygges op fra møbelbiblioteket med hylder, varer, låger og sokkel, og
hver flade får den belysningsstyrke, den faktisk modtager fra armaturerne –
plus det lys, gulvet foran fladen kaster tilbage, så reolsider og gavle ikke
står sorte. Farverne kan vises
realistisk eller som falskfarve i lux, ligesom i et lysberegningsprogram.
Samme farveskala kan lægges ned over plantegningen som varmekort – det er
lysspredningen, byggeprogrammet beder om.

Accentspots drejes ca. 25° ud mod reolfronten, skiftevis til hver side, så de
lyser på varen og ikke på gulvet.

## Armaturdata

Kataloget i `catalog.js` er bygget på armaturteksterne fra lysplanerne
(Bricks Track Line 70W/8800 lm, Sirius spot 28W, Coop pendel 12W, LED Panel
Premium 22W/3300 lm og 30W/4500 lm, Tri-proof 33-40W, Pan Max downlight 28W,
Bricks scan 40W, SJOC Park 2 23W). Hvor et datablad ikke angiver lysstrømmen,
er den sat til et realistisk niveau for armaturtypen – ret værdien i
`catalog.js`, hvis du har producentens tal, så følger lux- og lm/m²-tallene med.

Armaturer fra byggeprogrammet er også med: tilt-spot til systemlofter,
fersk­vare-spot med Ra ≥ 90/R9 ≥ 90, Park One-mast, Floodlight IP65 til
varegården, LED LINEAR XOOLINE til facade og udhæng samt wallwasher til
bannere.

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
| `inventar.js` | Genkendelse af reoler, køl og frost samt inventaropgørelse |
| `moebler.js` | Møbelbibliotek med detailmål og opbygning af møblerne i 3D |
| `tre.js` | Lysberegning punkt for punkt og 3D-billedet |
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
