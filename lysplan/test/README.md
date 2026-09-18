# Tests

## `layout-mod-planer.mjs`

Holder værktøjets skinneplacering op mod SJOC's
rigtige lysplaner. Tallene i testen er målt i vektorerne i selve
lysplan-PDF'erne (1:100), ikke gættet:

| | 365 Discount Kalundborg | Kvickly Hvidovre |
|---|---|---|
| Salgsareal | 812 m² | – |
| Skinne i stykliste | 47×4000 + 20×3000 + 10×2000 = **268 m** | – |
| Bricks Track Line | **79 stk.** | 244 stk. |
| Armaturafstand på skinnen | median **3,39 m** (3,5 m i 37 af 57 spring) | median **2,99 m** |
| c/c mellem skinnerækkerne | **3,39 m** fem gange i træk | median 2,5 m, stor spredning |
| Skinne pr. m² | **0,33 m/m²** | – |
| m² pr. Bricks | **10,3** | – |

Begge planer gør det samme: **skinnen ligger i gangen mellem to
møbelrækker, ikke oven på møblet.** Gangrækkerne T-samles ind i en ring
langs væggene. c/c er ikke et fast tal – det er møbelafstanden, og derfor
er Kalundborg (ens gondoler) helt regelmæssig, mens Kvickly (afdelinger
med blandet inventar) varierer.

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
