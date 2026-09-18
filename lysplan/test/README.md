# Test af skinnelayoutet

`layout-mod-planer.mjs` holder værktøjets skinneplacering op mod SJOC's
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
