# Lysplan

Værktøj til at lægge bygningstegninger ind, tegne butiksindretningen og regne
belysningsplanen ud – stykliste, nøgletal og gruppeopdeling, i samme opbygning
som SJOC-lysplanerne til Coop-butikkerne.

Ingen installation, ingen server, ingen konto: alt kører i browseren, og
tegninger og projekter forlader aldrig maskinen.

## Sådan kører du det

**På din egen pc.** Hent mappen ned (grøn `Code`-knap → `Download ZIP`, eller
`git clone`), pak ud, og:

* **Windows:** dobbeltklik `lysplan\start-lysplan.cmd`
* **macOS/Linux:** kør `lysplan/start-lysplan.sh` i en terminal

Scriptet starter en lille lokal webserver og åbner browseren på
`http://localhost:8123/`. Luk vinduet igen, når du er færdig. Har maskinen
hverken Python eller Node, åbner scriptet i stedet `index.html` direkte – så
virker alt undtagen DWG og PDF.

**Helt uden internet.** DWG læses med LibreDWG og PDF med pdf.js, som normalt
hentes fra nettet første gang. Kør `hent-motorer.cmd` (Windows) eller
`hent-motorer.sh` én gang med netforbindelse, så lægger de sig i `vendor/`, og
derefter virker både DWG og PDF offline. Mappen `vendor/` er holdt ude af
repositoriet – LibreDWG er GPL-3 og skal ikke deles videre herfra.

**Som en webside.** Repositoriet har en GitHub Pages-opsætning
(`.github/workflows/pages.yml`). Slå den til én gang under **Settings → Pages →
Source: GitHub Actions**, så ligger værktøjet på
`https://<bruger>.github.io/<repo>/lysplan/` og opdateres ved hvert push.
Er repositoriet privat, kræver GitHub Pages en betalt plan; så er en intern
webserver eller den lokale kørsel vejen frem. Værktøjet er rene statiske filer,
så det kan også bare lægges i en mappe på et intranet eller et fildrev.

## Ét tryk

Knappen **“Lav lysplan af tegningen”** øverst kører hele kæden: den finder
inventaret, læser zonerne af tegningen, lægger skinner og armaturer ud,
regner lysniveauet efter og gør 3D-kigget klar. Til sidst kommer et
resultatkort med nøgletallene, det der bør ses på, og vejen videre til 3D,
kravkontrol, stykliste og udskrift. Resten af arbejdsgangen herunder er til,
når noget skal rettes i hånden.

## Arbejdsgang

1. **Importér tegning** – træk DWG, DXF, PDF, PNG, JPG eller SVG ind på
   tegnefladen. DWG og DXF læses som vektor med tegningens egne mål, lag og
   farver, så målestokken sættes automatisk. Flere lag kan ligge oven på
   hinanden (f.eks. plan + inventaropstilling), og hvert lag kan tændes,
   dæmpes, skaleres og forskydes, så tegningerne flugter. Lagene inde i en
   CAD-tegning kan slukkes enkeltvis, så målsætning og møblering ikke støjer.
2. **Målestok** – kom den ikke med tegningen: klik to punkter med kendt
   indbyrdes afstand og indtast målet. Derefter regnes alt i meter og m².
3. **Inventar** – findes automatisk ved import, eller tryk “Find inventar i tegningen”. Reoler, køl, frost, kasser
   og diske genkendes som rektangler i CAD-tegningen, og teksterne på planen
   bestemmer varegruppe og antal fag. Alt kan rettes i listen, og manglende
   møbler tegnes med inventarværktøjet (I).
4. **Zoner** – læses af tegningens rumnavne (`SALGSAREAL 779,6 M2`, `VINDFANG`,
   `LAGER` …) med knappen “Find zoner i tegningen”. Ellers: vælg zonetype og tegn polygonen. Salgsareal, betjente områder,
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

## At tegne et areal

Zonen tegnes ved at klikke hjørnerne. Den lukkes på fire måder, og de virker
alle sammen:

* **Klik på det første punkt igen.** Punktet lyser op, og den sidste linje
  tegnes fuldt optrukket, når musen er tæt nok på.
* **Knappen "Luk arealet"** i bjælken, der kommer frem, så snart der er sat
  et punkt. Bjælken viser også, hvor mange punkter der er, og hvor stort
  arealet er lige nu.
* **Enter.**
* **Dobbeltklik.**

Bjælken har også "Fortryd punkt" og "Annullér". Det samme gælder lysskinner,
hvor knappen hedder "Afslut rækken".

## Målestok fra tegningen

DWG og DXF bærer deres egen enhed, så målestokken sættes af filen. For PDF
læses målet af tegningen selv, på to måder:

* **Målestoksangivelsen** i tegningshovedet ("1:100"). Ved 1:N fylder én
  meter (1000/N) mm på papiret. Eksakt.
* **Måltallene på tegningen.** Et måltal står midt i det stykke, det måler,
  så afstanden mellem to nabotal i en målkæde er gennemsnittet af de to mål.
  Tre tal på række rækker, og kæden kontrollerer sig selv, fordi hvert par
  skal give det samme svar.

Står begge dele på tegningen, bruges angivelsen, og måltallene bekræfter
den – er de uenige, bliver der sagt til. På 365 Discount Kalundborg læses
1:100 og bekræftes af 48 måltal. Er der intet af delene, åbnes
målestoksværktøjet, så et kendt mål kan trækkes op i hånden.

## Bygningens vægge

Salgsarealet må ikke løbe ud gennem en væg. Tegningen siger selv, hvor
væggene er – enten med et lagnavn på dansk ("Vægge udv."), eller med
bips/DS-lagkoderne, hvor A20 er ydervægge og A21 indervægge. Målsætnings-
og tekstlag (A29--M-, A29--T-) sorteres fra; de er streger, ikke mure.

Til at afgøre hvad der er **inde og ude**, tæller hver eneste streg med,
ikke kun vægglagene: ydervæggen er altid tegnet, også når den ligger på et
lag, der ikke hedder noget med væg. Til at spærre gangene duer det ikke –
så ville en gondolkant lukke gangen – og der bruges kun vægglagene.

Væggene bruges tre gange:

1. De spærrer på nettet, så gulvet omkring møblerne ikke kan brede sig
   gennem en mur.
2. Murene tykkes ét felt, så huller ved døre og vinduer op til ca. en meter
   lukker, og der flydes ind fra kanten. Det, der ikke kan nås udefra, er
   inde i bygningen. Står møblerne for det meste "udenfor" bagefter, er
   vægnettet for hullet til at bruge, og trinnet springes over.
3. Omridset lægges ned **på** væggen: for hver kant søges en væg, der er
   næsten parallel og tæt på, og kanten projiceres ind på den. Så følger
   zonen bygningen præcist, hvor der er en væg, og bliver liggende, hvor der
   ikke er. En forenkling alene ville bare skære hjørnet af.
4. Til sidst efterses hvert punkt på omridset: fra de nærmeste møbler – som
   med sikkerhed står inde i butikken – trækkes en linje ud til punktet. Er
   punktet spærret set fra dem alle, hører det til på den anden side af
   muren og flyttes ind foran den.

## Sådan tegnes planen

Planen følger samme signatur som SJOC's lysplaner og byggeprogrammets
Bilag 1, hvor tre ting holdes adskilt:

* **3-faset skinne** – en tynd streg. Det er den, armaturerne hænger på.
* **Lysskinne** – den fede bjælke i sin rigtige længde (Bricks er 1,20 m),
  tegnet oven på sporet og mærket BRICKS.
* **Spot** – sit eget symbol.

Er der zoomet nok ind, sættes modulmålene (4000/3000/2000) og
samlingskoderne på: **S.** ved tilslutningen, **S.S.** ved hver lige
samling, **T.S.** hvor en skinne ender midt på en anden, og **E.** ved en
fri ende. T-samlingerne findes efter samme regel, som styklisten tæller
efter, så plan og stykliste er enige.

## Sådan placeres skinnerne

Placeringen er ikke gættet. Den er aflæst af styklisterne på SJOC's seks
lysplaner og målt i vektorerne og pixels i tegningerne – og holdt op mod
byggeprogrammets eget eksempel i Bilag 1. Hele tabellen står i
`test/README.md`.

### Det byggeprogrammet kræver

* **Spots må ikke anvendes som grundbelysning**, kun til vindfang, F&G
  frontreol, vægnavigation, endegavle, foliebranding over kølere, vin,
  spotvarer, pristjekker, slagter, delikatesse og bager. Værktøjet vurderer
  derfor lux-kravet på **grundbelysningen alene**; accentlyset lægger oveni,
  men tæller ikke med.
* **700 lux på salgsarealet**, 1.000 lux i betjente områder og i vindfang,
  jævnt fordelt på gulvet, målt i 0 m og/eller 0,85 m med ±10 %.
* **Belysningsplanen skal tage udgangspunkt i kunde-flow og butiksindretning,
  så lyset fordeles jævnt over hylder og gangarealer**, uden skyggeområder.
  Det er grunden til, at skinnen ligger i gangen: derfra rammer
  batwing-fordelingen begge reolfronter.
* **Systemloft → LED-paneler og indbyggede tilt-spots. Alle øvrige lofter →
  3-fasede skinner med skinnespots og nedhængte lysskinner.** Det afgøres af
  loftet, ikke af butikskæden: 365 Discount Kalundborg kører på skinner,
  365 Discount Rødovrevej på 156 paneler.

### Det planerne viser

**Det der holder på tværs af alle seks planer** er meter skinne pr.
armatur: **2,56–3,39 m**, median ca. 3,0. Byggeprogrammets eget eksempel
ligger på 2,56–2,76 m. Det er den regel, værktøjet styrer efter.

**Det der ikke holder** er tætheden. Skinne pr. m² går fra 0,33 (365
Discount Kalundborg) til 0,545 (Brugsen Mønsted), og m² pr. Bricks fra 10,3
til 4,9. Tætheden er en følge af butikkens form – en lille butik har
forholdsvis meget vægring og mange smalle gange – ikke et tal man kan sætte
som mål.

Tre ting går igen i alle planerne:

1. **Skinnen ligger i gangen mellem to møbelrækker – ikke oven på møblet.**
   I byggeprogrammets eksempel ligger den 35–63 % inde i gangen. Værktøjet
   finder møbelrækkerne, lægger dem som bånd på tværs af gangretningen og
   sætter én skinne midt i hvert mellemrum.
2. **c/c er ikke et fast tal – det er møbelafstanden.** Byggeprogrammets
   eksempel: 2,73–3,07 m. Kalundborg: 3,39 m fem gange i træk. Kvickly
   varierer med afdelingen. Værktøjet måler butikkens egen takt og bruger
   den; åbent gulv fyldes i samme rytme.
3. **Gangskinnerne T-samles ind i en ring langs væggene.** Det er den, der
   giver lys på vægreoler, skilte og endegavle.

Lysniveauet reguleres med armaturafstanden inden for 2,4–3,6 m, og først
når båndet er brugt op, lægges der flere rækker. Det er den rækkefølge, en
lysdesigner arbejder i: layoutet følger butikken, ikke omvendt.

`test/layout-mod-planer.mjs` holder værktøjets resultat op mod de målte tal.

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

Oven på lysberegningen ligger et lille lysrig, som et CAD-program bruger det:
et hovedlys skråt oppefra, et svagere udfyldningslys fra modsat side, et
ambient niveau og en svag spejling. Uden det har to sider af samme reol samme
lux og dermed samme farve, så kanten forsvinder. Riggen ændrer kun billedet,
aldrig lux-tallene, og den er slået fra i falskfarve, hvor farven **er**
måleresultatet. Hver flade får desuden en kantstreg i sin egen tone, så
møblerne står skarpt uden at billedet bliver et trådnet.

Billedet tegnes med det samme, mens man drejer, og tegnes om et øjeblik efter i
dobbelt opløsning og skaleres ned, så kanterne bliver rene uden at det hakker.

**Oversigt over butikken** stiller kameraet i hjørnet og lidt over taghøjde, så
hele salgsarealet er i billedet på én gang – afstanden regnes ud fra
synsvinklen. I falskfarve er det den hurtigste måde at se, om lyset ligger, hvor
varerne står.

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
| `start-lysplan.cmd/.sh` | Starter en lokal webserver og åbner værktøjet |
| `hent-motorer.cmd/.sh` | Henter DWG- og PDF-motoren ned til offline brug |
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
