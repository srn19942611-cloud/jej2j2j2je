# Medvind — dropshipping-cockpit

En webside til dig, der vil bygge en lille e-handel ved siden af hverdagen. Du sætter et
produktlink ind fra en leverandør, får med det samme at vide om der er penge i det, og
arbejder dig videre med 15 minutter om dagen.

Ingen server, ingen konto, ingen installation. Åbn `index.html` — alt gemmes i din egen browser.

## Hvad den kan

| Sektion | Hvad du gør |
|---|---|
| **I dag** | Tre opgaver, der passer til hvor butikken står lige nu. Er de krydset af, er du færdig for i dag. Plus overskud, omsætning, ROAS og mål for de sidste 30 dage. |
| **Find produkt** | Sæt et link fra AliExpress, CJdropshipping, Temu, Alibaba, Amazon m.fl. ind. Siden læser kilde, navn og pris (også i USD), foreslår en salgspris og regner hele ordren igennem: moms, varekost, fragt, gebyr, returer og annoncekroner. Et scorekort på otte punkter giver en dom: kør, stram først, eller drop. |
| **Katalog** | Dine produkter fra idé → test → vinder → droppet, med dækningsbidrag pr. ordre på hver. |
| — Økonomi | Pris, kost og annonceudgift pr. produkt. Break-even ROAS og maks. annoncepris pr. salg. |
| — Upsalg | Mængderabat, tilbehør i kurven og tilbud efter køb. Viser hvor meget ordren og annonceloftet stiger. |
| — Tekst | Overskrift, punkter, beskrivelse, tilbudslinje, tre annoncekroge og FAQ — klar til at kopiere ind i Shopify. |
| **Butik** | Preview af hvordan produkterne ser ud for kunden, med før-pris og upsalg. Og hvad tre konkrete greb ville gøre ved ordrestørrelsen. |
| **Tal** | Log ordrer, omsætning, varekøb og annoncer. Graf over ugentligt overskud, ROAS og et regnestykke for, hvor mange ordrer der skal til for at nå dit månedsmål. |
| **Rutine** | Ugens faste rytme på 55 minutter, en "gør det én gang"-liste til shop, CVR, moms, betaling og automatik — og fem stopklodser, der sparer penge. |

## Beregningerne

Pr. ordre, ud fra dine egne tal i **Opsætning**:

```
netto        = salgspris / (1 + moms)
dækningsbidrag = netto − varekost − fragt ind − betalingsgebyr
efter returer  = DB × (1 − returrate) − (varekost + fragt) × returrate
tilbage        = efter returer − annonce pr. salg + upsalg
break-even ROAS = salgspris / dækningsbidrag
```

Scoren er 60 % produkt (de otte spørgsmål) og 40 % penge (avance og kroner pr. ordre).

## Kom i gang

1. Åbn `index.html` i en browser — eller kør `npx http-server` i mappen.
2. Tryk **Opsætning → Indlæs eksempel** for at se en butik med tal i. Slet det igen bagefter.
3. Ret moms, gebyrer, USD-kurs og dit månedsmål under **Opsætning**.
4. Sæt dit første produktlink ind under **Find produkt**.

Data ligger i `localStorage`. Brug **Eksportér data** før du rydder browseren, og
**Importér data** for at flytte det til en anden maskine.

## Forbehold

Tallene er dine egne skøn, ikke et regnskab. Moms, told, importregler, produktsikkerhed
(CE, RoHS) og markedsføringsloven er dit ansvar — tjek dem hos Skat og Forbrugerombudsmanden,
før du sælger. Teksterne fra tekstgeneratoren indeholder løfter om fragt og retur, som du
selv skal kunne holde.

## Filer

- `index.html` — al opmærkning
- `styles.css` — design, lys og mørk
- `app.js` — beregninger, link-parser, scorekort, tekstgenerator, graf og lagring
