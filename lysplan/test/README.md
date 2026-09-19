# Tests

## `layout-mod-planer.mjs`

Holder værktøjets skinneplacering op mod **alle** SJOC-planerne og mod
byggeprogrammets eget eksempel. Tallene er aflæst af styklisterne på
planerne og målt i vektorerne/pixels i tegningerne:

| Butik | Salgsareal | Skinne | Bricks | m/m² | m²/Bricks | **m skinne/Bricks** | spot/Bricks |
|---|---|---|---|---|---|---|---|
| Brugsen Mønsted | 343 m² | 187 m | 70 | 0,545 | 4,9 | **2,67** | 0,66 |
| 365 Discount Kalundborg | 812 m² | 268 m | 79 | 0,330 | 10,3 | **3,39** | 0,63 |
| SuperBrugsen Stenstalle | – | 493 m | 146 | – | – | **3,38** | 0,67 |
| Kvickly Skibhusvej | 1.700 m² | 794 m | 266 | 0,467 | 6,4 | **2,98** | 0,33 |
| SuperBrugsen Støvring | 1.196 m² | – | 135 | – | 8,9 | – | – |
| Kvickly Hvidovre | 2.318 m² | – | 244 | – | 9,5 | – | – |

Byggeprogrammets eget eksempel (Bilag 1, "Øvrige lofttyper") er et
rasterbillede, så det er målt i pixels med Bricks' 1,20 m som målestok:

* skinne-c/c **2,73 / 2,92 / 2,94 / 3,07 m** – måltallene på tegningen siger
  2800 / 3000 / 3000 / 3100, så målestokken passer
* armaturafstand på skinnen **2,56–2,76 m**
* skinnen ligger **35–63 %** inde i gangen, gangbredde 1,77–2,46 m

### Hvad der holder, og hvad der ikke gør

**Holder:** meter skinne pr. armatur ligger på **2,56–3,39 m** i alt hvad
der er målt – styklister, vektorer og byggeprogrammets eksempel. Median ca.
3,0. Det er den regel, værktøjet styrer efter, og den testen kræver.

**Holder ikke:** tætheden. Skinne pr. m² går fra 0,33 til 0,545 og m² pr.
Bricks fra 10,3 til 4,9 – en faktor 2. En lille butik har forholdsvis meget
vægring og mange smalle gange; et discountmarked har brede gange og lidt
ring. Tætheden er en **følge** af butikkens form, ikke et mål.

En tidligere udgave af denne test låste tætheden til Kalundborgs 0,33 m/m²
og 10,3 m²/Bricks, fordi den var kalibreret på den ene butik. Den ville
have afvist tre af de fem skinnebutikker ovenfor. Nu kontrolleres kun hele
det observerede spænd, og tallene står ellers som oplysning.

## Skinnen midt i gangen

Planerne fra SJOC lægger aldrig en skinne oven på en reol eller en køler, og
aldrig op ad den ene side af gangen. Bilag 1 i byggeprogrammet har gange på
1,77–2,46 m med skinnen 35–63 % inde i gangen – altså omkring midten.

Testen måler det direkte: ni punkter langs hver skinne, og til hver side
afstanden på tværs til nærmeste møbelkant. `skaev = |v-h|/(v+h)`, hvor 0 er
præcis midt imellem.

Hvad der tæller som en *gang* er afgørende for målingen. Står den nærmeste
reol 5 m væk, er det ikke gangens anden side, men næste række på den anden
side af et åbent gulv – og så er der ingen midte at centrere imod. Derfor
tæller kun møbler inden for 3 m med. En tidligere udgave målte til 6 m og
gav 0,4 i skævhed på skinner, der lå helt korrekt: den straffede dem for
ikke at være centreret mod noget, der ikke var en gang.

Står der kun én række ud for skinnen – vægkøl, en endegavl, et åbent
kampagneareal – holdes gangafstanden på 1,1 m til rækkens forkant i stedet.

Kan et stykke skinne ikke skubbes helt fri af en møbelrække, fordi rækken
ligger skævt for gangen, klippes stykket, og kun de frie stumper på mindst
2,5 m beholdes. Stumperne centreres bagefter hver for sig: klippes der
først efter centreringen, arver de en midte, der blev målt på hele det
oprindelige stykke.

## Hvad der er en møbelrække, og hvad en skinne må ligge over

To ting kostede en hel række lys på prøvebutikken, og begge handlede om at
behandle alt inventar ens.

**En frostø er ikke en møbelrække.** Den er 3,5 m lang og 2 m dyb og står
midt i gangen mellem to reolrækker. Fordi den er dyb, rører den begge
rækker, og båndene smeltede sammen til ét – så hele gangen imellem dem
forsvandt, og der kom ingen skinne. En gangvæg skal derfor være lang i
forhold til de andre vægge i feltet: mindst 40 % af den længste. Det tal
kalibrerer sig selv – i en lille butik, hvor den længste række er 4 m, er
grænsen 1,6 m. Står der kun korte møbler i feltet, bruges de alligevel.

**Højden afgør, ikke om der står noget.** En skinne 2,8 m oppe over en 2 m
høj reol eller kølevæg lyser reoltoppen i stedet for gangen – den skal stå
ved siden af. Over en frostø på 1,1 m, en kasselinje eller et podie lyser
den præcis det, den skal, og sådan ligger de også på planerne. Kun inventar
over 1,5 m spærrer derfor for en skinne. Før den skelnen blev skinnen i den
genfundne gang klippet i to stumper af frostøen.

Efter begge rettelser: 7 gangskinner på 2,80 / 5,50 / 8,10 / 10,70 / 13,30 /
15,90 / 18,60 m – én pr. gang, jævnt fordelt, i fuld længde.

## Lysniveauet rammer ikke kravet præcist

Og det skal det heller ikke. Layoutet følger gangene, og lyset lander, hvor
det lander. SJOC's egne DIALux-rapporter giver 889 lux (Støvring) og 789 lux
(Hvidovre) på et krav om 700 – altså 13–27 % over.

En tidligere udgave af denne test krævede højst 12 % over kravet og ville
have afvist dem begge. Grænsen er nu 30 % på grundbelysningen, og værktøjet
siger til, når en butik har flere gange, end lyskravet kræver, i stedet for
at fjerne en række for at ramme et tal.

## Firkanter og rækkeafstand

Skinnerne skal som udgangspunkt hænge sammen i firkanter, og to rækker må
ikke stå side om side.

**Firkanterne** måles som grafteori: skinnerne er knuder, og to skinner har
en kant imellem sig, når enden af den ene rører den anden, eller de to
krydser hinanden. Antallet af uafhængige lukkede sløjfer er da `E − V + C`.
En stige af n gangskinner med en tværskinne i hver ende giver n−1 firkanter.
Testen kræver mindst én firkant, at ingen skinne hænger frit for sig selv,
og at det hele hænger sammen i højst to net.

Firkanterne laves parvis mellem naboskinner. En tidligere udgave samlede
naboerne i løb med ét fælles spænd i begge ender; men spændet er skæringen
af dem alle, så én kort skinne lukkede hele løbet ned – 9 skinner gav 1
firkant i stedet for 7.

Tværskinnen skal kunne passere gondolgavlene med 0,9 m. Kan den ikke det,
rykkes den indad i gangen, så skinnerne samles i et T lidt inde på rækken.
Gavlafstanden kan `tvaersTilMoebler` ikke måle – den ser kun møbler, punktet
står ud for på langs – så der bruges en almindelig punkt-til-rektangel
afstand i stedet.

**Rækkeafstanden** måles kun, hvor to nogenlunde parallelle skinner faktisk
står ud for hinanden. To stykker i forlængelse af hinanden er én række med
et hul i, og to på tværs er en firkant. Mindst 1,8 m – under den smalleste
gang i Bilag 1 på 1,77 m.

Det har en pris: en butik kan nu ikke pakkes med rækker helt tæt for at nå
lux-kravet. Rammer beregningen under kravet, når rækkerne ikke kan stå
tættere og armaturerne allerede sidder på 2,4 m, siger værktøjet det med en
fejl i stedet for at pakke planen.

Centrering og gangafstand måles kun på gangskinnerne. En tværskinne krydser
gangene og har ingen gangmidte at ligge i; blandes de to slags, ser et
korrekt layout skævt ud.

## Prøvetegningen `butik.dxf`

40,0 × 20,0 m med ydervæggen som lukket polylinje på laget `VAEGGE`, seks
gondolrækker i to blokke med tværgang imellem, vægkøl til højre, to
frostøer og tre kasselinjer.

Gondolfeltet dækkede oprindeligt kun x 3–14 m af en 40 m bred butik, så tre
fjerdedele af de 800 m² var tom hal. Tæthedskontrollen dividerede med hele
arealet og faldt derfor til 0,23 m skinne pr. m², langt under planernes
0,33–0,545 – ikke fordi værktøjet lagde for lidt skinne, men fordi
prøvetegningen ikke lignede en butik. Feltet er nu ført ud til x 33 m.

## Sådan køres den

Testen kører mod en lokal server, fordi browseren ellers ikke må læse
modulerne fra disk:

```
cd lysplan
npx http-server -c-1 -p 8123 .
# i et andet vindue:
node test/layout-mod-planer.mjs
```

Den kræver Playwright (`npm i -g playwright && npx playwright install chromium`).
Den skriver hvert krav ud som OK eller FEJL og slutter med, om layoutet
følger planerne.

## `pdf-maalestok.mjs`

En PDF-plantegning bærer sit eget mål, og værktøjet skal finde det selv.
`maalestok.pdf` er en prøvetegning i 1:100 med et rektangel på 16,0 × 7,0 m
og en målkæde 4000 + 5000 + 3000 + 4000 mm under det. Testen tjekker begge
veje til målestokken:

1. **Målestoksangivelsen** i tegningshovedet ("1:100"). Ved 1:N fylder én
   meter (1000/N) mm på papiret, og en mm er 72/25,4 pt. Eksakt.
2. **Måltallene på tegningen.** På en CAD-plan står tallet midt i det
   stykke, det måler, så afstanden mellem to nabotal i en kæde er
   gennemsnittet af de to mål. Tre tal på række er nok til at regne skalaen
   ud – og kæden kontrollerer sig selv, fordi hvert par skal give det samme.

Findes begge, bruges angivelsen, og måltallene bekræfter den. Findes kun
måltallene, bruges de, og der bliver bedt om en kontrolmåling. Findes
ingen af delene, siger værktøjet til og åbner målestoksværktøjet.

På SJOC's egne planer: 365 Discount Kalundborg blev læst som 1:100,
bekræftet af 48 måltal.

## `zone-inden-for-vaegge.mjs`

Salgsarealet må aldrig række ud over bygningen. `butik.dxf` har sin ydervæg
som en lukket polylinje på laget `VAEGGE` – et rektangel på 40,0 × 20,0 m.
Testen lader værktøjet finde zonen selv og tjekker, at hvert eneste punkt
på omridset ligger inden for det, med højst 0,35 m slør (omridset lægges ud
på et net på 0,5 m og forenkles bagefter).

Den fangede to fejl, der ikke var til at se på en stor tegning: lagnavnet
`VAEGGE` matchede ikke vægmønsteret, fordi det var stavet med *ae* og ikke
*æ*, og fallback-sporet sorterede bygningens eget omrids fra som "et møbel",
fordi det er et lukket rektangel. Ydervæggen er også et lukket rektangel –
den er bare 40 m lang.
