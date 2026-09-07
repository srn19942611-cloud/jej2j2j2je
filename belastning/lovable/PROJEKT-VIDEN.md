# Projektviden — Effektoversigt for Coop-butikker

Indsæt denne tekst i Lovables Knowledge-felt. Den gælder for alle beskeder i projektet.

## Hvad app'en er

Et internt værktøj til Coop Ejendomme, der dimensionerer hovedtavlen til en butik.
Brugerne er byggeledere og projektledere i Byg & Etablering, der får 4–5 henvendelser om
ugen og i dag bruger flere timer pr. sag på at læse udstyr af på tegninger og sætte det
op i Excel. Målet er at gøre det til et review-job på under en time.

Brugerfladen er på dansk. Tal vises med dansk format: komma som decimaltegn, punktum som
tusindtalsseparator, enheder skrevet ud (kW, A, m², W/m²).

## Motoren må ikke omskrives

`src/lib/belastning/` indeholder en testet beregningskerne: `beregning.ts` (strøm,
gruppedannelse, MCB, kabel, spændingsfald, kortslutning, fasebalance, komfortkøl,
kvalitetstjek), `tegning.ts`, `geometri.ts`, `indlaesning.ts`, `laering.ts`,
`eksport.ts`, `xlsx.ts`, `data.ts` og `typer.ts`.

- Skriv aldrig dine egne formler, parsere eller nøgletal. Kald motoren.
- Importér uden filendelse: `from './typer'`.
- Installér ikke exceljs eller file-saver — `eksport.ts` klarer Excel uden afhængigheder.
- Skal noget beregnes, som motoren ikke kan, så sig det i stedet for at improvisere.

## Fagregler, der ikke må laves om

1. **Hver række har en kilde**: `Tegning`, `Datablad`, `Maskinliste`, `Byggeprogram`,
   `Referencetavle`, `Skaleret erfaring` eller `Manuel`. Kilden vises i brugerfladen og i
   eksporten. Et tal uden kilde kan ikke forsvares over for en leverandør.
2. **Beregningen er ikke facit for ampererettigheden.** Beregnede lister ligger typisk
   40–70 % over målt peak, fordi datablade angiver mærkeeffekt. Vis altid beregning og
   måleref­erence ved siden af hinanden, og gør tydeligt, at kabel og tavle dimensioneres
   efter beregningen, mens rettigheden købes efter det vægtede skøn fra
   `anbefaling.foreslaaetRettighed`.
3. **Automatiske udtræk skal bekræftes af et menneske**, før de bliver til en
   forbrugerliste. Ingen automatisk godkendelse.
4. **Kataloget ændrer sig aldrig af sig selv.** Rettelser fanges, aggregeres og
   foreslås — en person godkender. Ændringer logges i `katalog_historik`. Afsluttede
   projekter ændrer sig ikke bagudrettet.
5. Solceller regnes som negativ effekt og indgår ikke i hovedsikringen.
6. Antal, kabellængde og antal grupper er projektspecifikke og bliver aldrig til
   katalogværdier.
7. Ingen sletning uden bekræftelse. Projekter arkiveres i stedet for at blive slettet.

## Tone i brugerfladen

Nøgtern og fagligt præcis. Ingen udråbstegn, ingen emojis i data-skærme. Advarsler skal
sige, hvad man gør ved problemet — ikke bare at der er et. Tal, der er usikre, skal se
usikre ud (tillid vises, lav tillid markeres).
