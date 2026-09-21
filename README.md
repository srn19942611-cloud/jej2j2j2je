# Medvind — dropshipping-cockpit

En webside til dig, der vil bygge en lille e-handel ved siden af hverdagen. Du sætter et
produktlink ind fra en leverandør, får med det samme at vide om der er penge i det, og
arbejder dig videre med 15 minutter om dagen.

Ingen server, ingen konto, ingen installation. Åbn `index.html` — alt gemmes i din egen browser.

## Hvad den kan

| Sektion | Hvad du gør |
|---|---|
| **I dag** | Tre opgaver, der passer til hvor butikken står lige nu. Er de krydset af, er du færdig for i dag. Plus overskud, omsætning, ROAS og mål for de sidste 30 dage. |
| **Jagt** | Skriv en niche eller et produkt og gå direkte ind i 13 færdige søgninger: AliExpress sorteret efter antal solgte, Dropshipping Center, CJ, Temu, Amazon bestsellers, Google Trends DK, TikTok, TikTok Creative Center, Pinterest, Meta Ad Library DK, Google Shopping og "sælger danske shops det allerede". Plus en sæsonkalender for det danske år og otte tjek, der skal være grønne, før du bruger penge. |
| **Vurdér** | Sæt et link fra AliExpress, CJdropshipping, Temu, Alibaba, Amazon m.fl. ind. Siden læser kilde, navn og pris (også i USD), foreslår en salgspris og regner hele ordren igennem: moms, varekost, fragt, gebyr, returer og annoncekroner. Et scorekort på otte punkter giver en dom: kør, stram først, eller drop. |
| **Katalog** | Dine produkter fra idé → test → vinder → droppet, med dækningsbidrag pr. ordre på hver. |
| — Økonomi | Pris, kost og annonceudgift pr. produkt. Break-even ROAS og maks. annoncepris pr. salg. |
| — Upsalg | Mængderabat, tilbehør i kurven og tilbud efter køb. Viser hvor meget ordren og annonceloftet stiger. |
| — Tekst | Overskrift, punkter, beskrivelse, tilbudslinje, tre annoncekroge og FAQ — klar til at kopiere ind i Shopify. |
| **Billeder** | Træk leverandørens billeder ind (eller Ctrl+V). Beskær til 1:1, 4:5, 9:16 og 16:9, læg hvid, sand, brandfarvet eller blød baggrund på, sæt mærkat, pris og butiksnavn på, og hent alle fire formater. Ét klik sætter billedet som produktbillede i butikken. Alt sker på din maskine — intet uploades. |
| **Butik** | Preview af hvordan produkterne ser ud for kunden, med før-pris og upsalg. Og hvad tre konkrete greb ville gøre ved ordrestørrelsen. |
| — Eksport | **Hent butik.html**: en færdig, selvstændig webshop med forside, produktsider, kurv, mængderabat, fragtregler, FAQ og betaling via dit Stripe-/MobilePay-link (eller bestilling på mail). Læg filen på Netlify Drop, så er butikken online. |
| **Flow** | Tragtberegner (besøg → kurv → betaling → køb) med danske normalniveauer, der peger på hvilket trin der siver og hvad et løft er værd i kroner. 14-dages lanceringsplan, 14 færdige opslagsidéer med hook-tekst til dit produkt, tre annoncemanuskripter med tidskoder, fire automatiske mails og en UTM-linkbygger. |
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

## Det den ikke gør

- **Søger ikke selv efter produkter.** En side i din browser må ikke hente data fra AliExpress eller TikTok (CORS), og der findes ikke et åbent gratis produkt-API. Automatisk søgning kræver en server og en betalt datatjeneste. Jagt-fanen giver de samme søgninger med ét klik i stedet.
- **Genererer ikke billeder med AI.** Den redigerer de billeder, du selv har.
- **Er ikke en shopplatform.** Den eksporterede butik tager imod ordrer, men holder ikke styr på lager, sender ikke ordrebekræftelser og afregner ikke moms. Vokser det, flytter du til Shopify eller Shoporama med tekster og billeder i hånden.
- **Skaffer ikke kunder.** Det gør annoncer og indhold. Flow-fanen planlægger og måler arbejdet.

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
- `app.js` — state, økonomi, link-parser, scorekort, tekstgenerator, graf og lagring
- `jagt.js` — søgelinks, sæsonkalender og tjekliste
- `images.js` — billedværkstedet (canvas, formater, baggrunde, påskrift)
- `shopexport.js` — bygger den selvstændige `butik.html`
- `flow.js` — tragt, lanceringsplan, indhold, annoncer, mails og UTM
