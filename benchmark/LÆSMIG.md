# Modelsammenligning

Her ligger de alternativer, normallastmodellen blev målt imod, og den prøve,
der afgjorde valget. De er gemt, fordi resultatet skal kunne efterprøves — og
fordi den næste, der vil skifte model, skal kunne køre den samme prøve.

## Hvad der blev prøvet

**Normallastmodeller** (`modeller.mjs`)

| | |
|---|---|
| `modelOLS` | Ret linje i temperaturen, eventuelt knækket ved 15 °C. Den oprindelige. |
| `modelTOWT` | Dagtype × temperaturbånd, median pr. celle. M&V-standardernes model. |
| `modelMedian` | Medianregression (L1) via iterativt vægtede mindste kvadrater. |
| `modelKNN` | De k nærmeste døgn efter temperatur og dagtype. Kan ikke ekstrapolere. |

**Skiftepunktsmetoder**

| | |
|---|---|
| `cpCUSUM` | Argmax af den kumulerede afvigelse. Den oprindelige. |
| `cpBinaer` | Binær segmentering: prøv hvert punkt, tag mindste samlede SSE. |
| `cpBIC` | Log-likelihood-ratio med BIC-straf for de ekstra parametre. |

## Prøven, og hvorfor den ser ud som den gør

Den første udgave af prøven brugte scenariegeneratorens serier. Alle fire
modeller scorede 93–100 %, og prøven kunne altså ikke skelne dem. Grunden er
den samme fejl, der har bidt to gange før i dette projekt: **scenarierne
frembringes med `basis + koefficient · temperatur`, altså med præcis den form,
den ene af modellerne tilpasser.** En model, der prøves af mod data, den selv
har frembragt, består altid.

`koer.mjs` bruger derfor tre sandheder, som ingen af modellerne kan udtrykke
nøjagtigt, og som hver især ligner noget, der står i en butik:

- **køl** — flad under 10 °C (kondenseringen er begrænset af mindstetryk),
  derefter kvadratisk stigende
- **vent** — tidsstyret, temperaturuafhængig i drift, men med køleflade over
  18 °C, og med et spring mellem hverdag og weekend
- **blandet** — V-form med knæk ved 14 °C og forskellige hældninger på hver side

Støjen vokser med temperaturen, som den gør i virkeligheden.

## Resultatet

| Model | Fandt fejlene | Falske alarmer | Skævhed på ren serie |
|---|---|---|---|
| OLS | 100 % | **33 %** | 1,2 % |
| **TOWT** | 100 % | **0 %** | 0,7 % |
| Medianregression | 100 % | 0 % | 0,8 % |
| k-NN | 100 % | 8 % | 0,9 % |

Alle fire fandt hver eneste ægte fejl. Forskellen ligger udelukkende i de
falske — altså i netop det, der afgør, om agenten overlever i drift.

**De 33 % kom ét sted fra: ventilation.** OLS meldte 12 % afvigelse på en ren
ventilationsserie, værste tilfælde 15,6 %. Årsagen er, at et aggregat kører
180 kWh på en hverdag og 70 i weekenden, med et temperaturled først over 18
grader. En model, der kun kender temperaturen, kan ikke udtrykke den forskel
og midler den — og så flytter residualmedianen sig, bare fordi
vurderingsvinduet har en anden fordeling af hverdage og weekender end
referencen.

Dagtypeopdelingen fandtes i forvejen i `byggNormallast`. Den blev tabt, da den
nyere motor blev skrevet.

Skiftepunktsmetoderne lå derimod lige: CUSUM og binær segmentering begge på
0 % falske, BIC på 4 %. Der var ingen grund til at skifte.

## Sidegevinst: modellen afslørede en for lempelig vagt

Ekstrapolationsvagten var sat ved 35 %. En opsætning med 32 % af
vurderingsdøgnene uden for referencen slap altså igennem — og med en ret linje
så det ud til at gå, fordi linjen ekstrapolerer villigt og på lineært
frembragte data tilfældigvis rammer rigtigt. Med en båndmodel, der ikke kan
ekstrapolere, blev det synligt: hver tredje forudsigelse var nærmeste bånds
median, altså et gæt.

Grænsen er sat ned til 15 %. På de rigtige toårsdata var den højeste andel
udenfor 3,3 %, så der er rigelig luft til den opsætning, der faktisk skal
bruges.

## Kør prøven igen

```
node benchmark/koer.mjs
```
