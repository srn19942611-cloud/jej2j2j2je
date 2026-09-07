# Kvalitetstjek

`engine/beregning.ts → kvalitetstjek()` kører 11 tjek på hver beregning. De har tre
niveauer: **krav** (skal være opfyldt), **advarsel** (kræver en beslutning) og **info**.

| Tjek | Niveau | Hvad det betyder, når det fejler |
|---|---|---|
| Belastning + buffer ≤ valgt hovedsikring | krav | Den valgte ampererettighed er for lille. Enten op i rettighed eller ned i samtidighed med dokumentation. |
| Hovedkabel belastes maks. 70 % | krav | Byggeprogrammets krav. Vælg større tværsnit — ikke mindre sikring. |
| Min. 30 % reserveplads i tavlen | krav | Tavlen skal bestilles større. Billigt nu, dyrt om to år. |
| Min. 10 % disponible afgange | info | Reserveres i bestillingen. |
| Type B RCD på DC-lækkende laster | krav | Varmepumper, flaskeautomat, ladestandere, PV og køl med frekvensomformer skal have type B. Type A ser ikke DC-fejlstrøm. |
| Maks. 100 A forsikring foran RCD/RCBO | krav | Producentkrav. Del gruppen op, eller flyt til egen afgang. |
| Kritiske laster ≤ 125 A CEE | krav | Nødgeneratoren kan ikke bære det, der er markeret kritisk. Skær ned i, hvad der skal køre under nedbrud. |
| Kabler: I_z ≥ I_n og spændingsfald | krav | Konkrete grupper listes. Skift tværsnit eller afkort føringsvejen. |
| Automatisk afbrydelse (I_k ≥ I_a) | krav | Ledningen er for lang/tynd til at afbryde inden for 0,1 s. Større tværsnit eller B-karakteristik. |
| Komfortkøl dækker varmebalancen | advarsel | Enten flere/større split-enheder eller mere køl i ventilationen. |
| Beregning på niveau med målte butikker | advarsel | **Den vigtigste.** Beregningen ligger mere end 50 % over målt peak. Se `docs/02` afsnit 8: køb rettigheden efter referencen, dimensionér kabel og tavle efter beregningen. |

## Hvad der bevidst *ikke* tjekkes automatisk

- Selektivitet mellem hovedafbryder og gruppeafbrydere (kræver producentkurver).
- Harmonisk forvrængning og dimensionering af nulleder (byggeprogrammet kræver blot en
  disponibel 100 A-afgang til et aktivt filter).
- Startstrømme for store motorer og elevatorer ud over samtidighedsfaktoren.
- Termisk belastning af tavlen (IP-klasse, effekttab, placering).

Disse punkter står i eksportens byggeprogram-ark som tjekpunkter til elingeniøren.
