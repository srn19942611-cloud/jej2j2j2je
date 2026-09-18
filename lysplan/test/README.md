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

## Sådan køres den## Sådan køres den

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
