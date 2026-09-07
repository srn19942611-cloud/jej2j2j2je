# Belastningsoversigt for Coop-butikker — datagrundlag og system

Grundlaget til at bygge et værktøj, der dimensionerer hovedtavlen til en butik ud fra en
plantegning og et par stamdata: udstyrskatalog med el-data, beregningskerne, ordbog fra
tegningstekst til udstyr, databaseskema og en beskrivelse af, hvordan delene spiller
sammen. Alt på dansk, alt med kildeangivelse.

Pakken er lavet, så den kan fodres direkte ind i Lovable (se `LOVABLE-PROMPT.md`), men
den er uafhængig af værktøj — motoren er ren TypeScript uden afhængigheder.

## Indhold

```
data/        katalog.json (79 udstyrsposter) · butikstyper.json · tabeller.json
             plansymboler.json · kolonneordbog.json · nogletal.json
             referencer.json · tegningsudtraek-prompt.md
engine/      typer.ts · beregning.ts · tegning.ts · geometri.ts · indlaesning.ts
             laering.ts · eksport.ts · data.ts (genereret) · xlsx.mjs
eksempel/    Effektoversigt genereret fra referencesagen (10 ark)
supabase/    skema.sql · seed-katalog.sql · skema-laering.sql
docs/        01 datamodel · 02 beregningsregler · 03 plantegning → forbrugerliste
             04 excel-eksport · 05 kvalitetstjek · 06 filaflæsning
             07 feedback og læring · 08 PDF og geometri
test/        test-beregning.mjs · test-indlaesning.mjs · test-geometri.mjs
```

## Kom i gang

```bash
node --experimental-strip-types belastning/test/test-beregning.mjs    # beregning og tegningsflow
node --experimental-strip-types belastning/test/test-indlaesning.mjs  # filindlæsning og feedbackloop
node --experimental-strip-types belastning/test/test-geometri.mjs     # PDF-geometri og kalkuleret ark
node belastning/scripts-generer-data.mjs                              # genskab engine/data.ts efter ændringer i data/
node --experimental-strip-types belastning/scripts-eksempel-eksport.mjs  # byg eksempel-Excel fra referencesagen
```

Den første test kører referencesagen igennem: skabelon for en Dagli'Brugsen på 688 m²,
derefter en optælling fra plantegningen, fletning, beregning og alle kvalitetstjek.
Den anden læser en maskinliste og et gruppeskema i de formater, I får dem i, og kører
hele feedbackloopet: rettelser → forslag → godkendelse → kalibrering.

## Hvor tallene kommer fra

| Kilde | Bruges til |
|---|---|
| Effektoversigt Rask Mølle, 08-07-2026 | Effektliste, samtidighedsfaktorer, RCD-krav, referencesag |
| Mariannes SB-effektoversigt, 27-01-2026 | Gruppeskemaets format, terminaltavle- og sikringsposter |
| Slagter-maskinliste (FDB, maj 2018, rev. jan 2025) | SL-numre med kW og ampere fra datablade |
| Plantegning 2251110-7, Rask Mølle | Symbolordbog, rumetiketter, maskinnumre på tegning |
| Byggeprogram og kravspecifikation | Tavlekrav, RCD-typer, reserveplads, måling, nødforsyning |
| Målinger i sammenlignelige butikker | Referenceinterval for valg af ampererettighed |

## Det, systemet gør anderledes end et regneark

1. **Skabelon frem for blank side.** Butikstype + arealer + antal kasser giver 60–80
   færdige rækker med samtidighedsfaktorer og RCD-krav.
2. **Tegningen læses, mennesket bekræfter.** Optællingen er et udkast, der skal godkendes
   — og de bekræftede kodetolkninger genbruges på næste sag.
3. **Kilde på hver række.** Man kan se, hvad der er læst af en tegning, hvad der kommer
   fra et datablad, og hvad der er erfaringstal.
4. **Fasebalance i stedet for worst case.** 1-fasede grupper fordeles på L1/L2/L3, så
   hovedstrømmen bliver realistisk.
5. **Ampererettigheden vurderes mod målte butikker.** På referencesagen giver metoden
   200 A rettighed med kabel og tavle til 315 A — samme konklusion som den, der blev
   truffet manuelt (200 A / 250 A).
6. **Kvalitetstjek mod byggeprogrammet** følger med i eksporten som dokumentation.
7. **Filer læses, i stedet for at blive tastet af.** Maskinlister, gruppeskemaer og
   datablade bindes til kataloget på maskinnummer eller navn — dansk talformat,
   "3 x 400" og fodnoter som "1**" håndteres. Se `docs/06`.
8. **Indretnings-PDF'en måles op.** Skalaen findes ved målkæder, målestok og kendt
   rumareal, der krydstjekker hinanden. Møbelløb tælles både på tallene på tegningen og
   på den målte længde ÷ modulbredde. Ud kommer et kalkuleret ark, hvor hver linje viser
   mål, nøgletal, kW og tillid. Se `docs/08`.
9. **Excel-arket er færdigt, ikke bare beskrevet.** Ti ark inkl. gruppeskema i Mariannes
   format, mærkatliste, fasebalance, byggeprogram-tjek og en tavlebestilling, der kan
   sendes direkte til tavlebyggeren. Ingen afhængigheder.
10. **Modellen lærer af rettelser.** Ændrer man et tal, fanges det. Når flere sager peger
   samme vej, foreslås en ny standardværdi til godkendelse. Målt forbrug fra idriftsatte
   butikker kalibrerer forholdet mellem beregning og virkelighed. Se `docs/07`.

## Begrænsninger, der skal siges højt

- Katalogets kW-værdier er dimensioneringstal fra datablade og referencesager, ikke
  målte driftsværdier. De skal erstattes af projektets egne datablade, når de foreligger.
- Symbolordbogens møbelkoder (`EGM`, `LDF`, `CLS`) er markeret som *forslag* og skal
  bekræftes pr. projekt. De er læst af én tegning.
- Kabeltabellen er en forenklet udgave uden samlet føring, temperaturkorrektion og
  gruppering. Den giver et forslag, ikke en projekteret dimensionering.
- Selektivitet, harmonisk forvrængning, startstrømme og termisk tavlebelastning ligger
  uden for beregningen og står som tjekpunkter til elingeniøren.
- Beregningen erstatter ikke en autoriseret elprojekterende. Den skal gøre det hurtigt at
  komme frem til et kvalificeret grundlag for en tavlebestilling.
