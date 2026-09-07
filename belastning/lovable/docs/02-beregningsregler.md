# Beregningsregler

Alle formler er implementeret i `engine/beregning.ts` og testet mod referencesagen
Rask Mølle i `test/test-beregning.mjs`. Konstanterne står i `data/tabeller.json`.

## 1. Strøm pr. forbruger

| Situation | Formel |
|---|---|
| 3-faset (400 V) | `I = P / (√3 · 400 · cos φ)` |
| 1-faset (230 V) | `I = P / (230 · cos φ)` |

`P` er **installeret** effekt, når der dimensioneres kabel og afbryder, og
**belastet** effekt (`P · DF`) når der summeres til hovedtavlen.

## 2. Gruppedannelse

En række i listen kan blive til flere fysiske grupper:

| Type | Regel |
|---|---|
| Stikkontakter | 1 gruppe pr. 6 stik (`konstanter.stikPrGruppe`) |
| Belysning | opdeles så hver gruppe holder sig under 13 A |
| Maskiner ≥ 3 kW | egen gruppe pr. stk. |
| Kølemøbler | 1 gruppe pr. 4 møbler |
| Øvrigt | 1 gruppe |

Reglen kan altid overstyres pr. række (`grupper`). Antal grupper driver både
gruppeskemaet, modulregnskabet i tavlen og fasebalanceringen.

## 3. Gruppeafbryder (MCB)

```
I_b   = installeret effekt pr. gruppe → strøm
faktor = 1,25 for motor- og varmelast (maskine, køl, HVAC), ellers 1,0
MCB   = mindste standardstørrelse ≥ I_b · faktor, dog mindst 10 A
```
Standardrække: 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125 A.

## 4. Kabel

Mindste tværsnit der opfylder **begge**:

1. `I_z ≥ MCB` ved den valgte referenceinstallationsmetode (A skjult, B i rør, C frit).
2. Spændingsfald under grænsen (standard 4 %):
   - 3-faset: `ΔU = √3 · I_b · L · (ρ/S) · cos φ`
   - 1-faset: `ΔU = 2 · I_b · L · (ρ/S) · cos φ`
   - `ρ = 0,0225 Ω·mm²/m` (Cu ved ca. 70 °C)

Noteres som `5G<S>` (3-faset) eller `3G<S>` (1-faset), fx `5G2,5`.

## 5. Kortslutning og udløsning

```
Z_forsyning = 0,95 · 400 / (√3 · I_k,hovedtavle)
R_kabel     = ρ · L / S
I_k3        = 0,95 · 400 / (√3 · (Z_forsyning + R_kabel))
I_k1        = 0,95 · 230 / (Z_forsyning + 2 · R_kabel)
I_a         = k · MCB     (k = 5 for B, 10 for C, 20 for D)
```
Kravet er `min(I_k3, I_k1) ≥ I_a`. Slår det fejl, er ledningen for lang eller for tynd
til at afbryde inden for 0,1 s — vælg større tværsnit eller B-karakteristik.
`I_k,hovedtavle` indtastes fra netselskabets oplysning (default 10 kA).

## 6. Fasebalance

De 3-fasede grupper fordeler sig ligeligt. De 1-fasede sorteres faldende efter
tilsyneladende effekt og lægges én ad gangen på den fase, der aktuelt har mindst.
Det giver en realistisk `maks. fasestrøm` i stedet for den worst case, man får ved at
lægge alle 1-fasede grupper sammen.

```
I_fase = kVA_fase · 1000 / 230
skævhed % = (maks − gennemsnit) / gennemsnit
```

Er skævheden over ca. 10 %, skal grupperne fordeles anderledes i tavleskemaet.

## 7. Hovedsikring, hovedkabel og tavle

```
I_dim              = maks. fasestrøm · (1 + buffer)        buffer 15 % som standard
beregnet hovedsikring = mindste standardstørrelse ≥ I_dim
hovedkabel         = I_z ≥ maks. fasestrøm / 0,70          (byggeprogram: maks. 70 % belastning)
moduler i tavle    = Σ grupper · (4 for 3-faset, 2 for 1-faset)
tavlestørrelse     = moduler · (1 + 30 % reserve)
```

## 8. Ampererettighed: beregning mod målte butikker

Det vigtigste skøn i hele opgaven. Datablade angiver mærkeeffekt, ikke driftseffekt, så
en beregnet liste ligger typisk **40–70 % over** målt 15-minutters peak.

| Rask Mølle | Værdi |
|---|---|
| Beregnet | 205–213 A |
| Målt i sammenlignelige butikker | 110–130 A |
| Valgt ampererettighed | 200 A |
| Hovedkabel og tavle dimensioneret til | 250 A |

Motoren gør det samme automatisk (`anbefalRettighed`):

```
reference       = salgsareal · [0,130 … 0,183] A/m²      (fra referencemaalinger)
afvigelse       = beregnet maks. fasestrøm / reference_max
hvis afvigelse > 1,5:
    foreslået rettighed = mindste standard ≥ max(reference_max · 1,3, beregnet · 0,75)
ellers:
    foreslået rettighed = beregnet + buffer
kabel og tavle dimensioneres altid efter den beregnede værdi
```

Så kan rettigheden skrives op senere uden at bygge tavlen om. Hver ny butik, der får
målt sit forbrug, lægges i `referencemaalinger` og gør intervallet skarpere.

## 9. Komfortkøl

Varmebalance for salgslokalet (kun poster med `rum = salg`):

```
udstyr    = Σ (belastet kW · varmeafgivelse)      ekskl. lys og ventilation
lys       = Σ (belastet kW · varmeafgivelse)      alle lysgrupper
personer  = loft(salgsareal / 10) · 100 W
sol       = salgsareal · 15 W/m²
total     = udstyr + lys + personer + sol
underskud = total − køleydelse i ventilationsaggregat
anbefalet = rund op til nærmeste 0,5 kW af underskud · 1,10
```

Central køl (CO₂-aggregat, kølerum, frostrum) afgiver **ingen** varme til salgslokalet
— kondensatoren sidder på taget. Slagterafdelingen har egen ventilation og tæller kun
med 10 %. Faktorerne kan justeres pr. sag (`m2PrPerson`, `wPrPerson`, `solWm2`, `copKoel`).

Tommelfingerreglen bevares som kontroltal:
`split ≈ salgsareal · 0,03 + 0,8 · plug-in-varme − ventilationskøl`.

## 10. Nødforsyning

Alle poster med `noedforsyning = true` summeres og omregnes til strøm ved 400 V.
Kravet er, at de kan forsynes fra en 125 A CEE-generatortilslutning i hovedtavlens front.
