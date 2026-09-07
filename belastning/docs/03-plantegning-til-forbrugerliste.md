# Fra plantegning til forbrugerliste

Det er her tiden går i dag: at læse antal af udstyr på tegninger og dokumenter og
sætte det op i et ark. Flowet nedenfor gør det til et review-job i stedet for et
indtastningsjob.

## Flow

```
1. Upload        PDF/DWG-eksport/foto af plantegning  →  storage-bucket "tegninger"
2. Render        PDF-side → PNG (min. 2000 px bred)
3. Udtræk        vision-kald med prompten i data/tegningsudtraek-prompt.md → JSON
4. Slå op        koder og maskinnumre → katalog via data/plansymboler.json
5. Bekræft       brugeren godkender/retter optællingen side om side med tegningen
6. Flet          bekræftet optælling + butikstypens skabelon → forbrugerliste
7. Beregn        engine/beregning.ts → hovedtavle, grupper, tjek, eksport
```

Trin 5 er ikke til forhandling. Ingen tegning er ens, og en optælling, der ikke er set
igennem, må ikke ende i en tavlebestilling.

## Hvad tegningen faktisk kan give

Målt på referencetegningen (Rask Mølle, 2251110-7):

| Kan læses af tegningen | Kommer fra skabelon/datablade |
|---|---|
| Arealer pr. rum (`SALGSLOKALE 688 M2`, `LAGER 97 M2`, `DELI 45 M2`) | Central køl, kompressorer |
| Køle- og frostrum (`FROST 16 M2`, `KØL 8 M2`, `MEJERIKØL 13 M2`) | Ventilation og varmepumper |
| Slagtermaskiner med maskinlistenummer (`SL11`, `SL12`, `SL21`, `SL23a`) | Belysning (W/m²) |
| Kølemøbler og reoler (`EGM`, `LDF`, `CLS`) | IT, POS-backend, ABA/ABDL/AIA, CTS |
| Kasselinje, hurtigport, flaskeautomat, varesikring | Dispositionsstik, rengøringskraft |

Tegningen dækker typisk **25–40 % af rækkerne**, men de rækker er de mest projektspecifikke.
Resten er stabile erfaringstal, der skaleres på arealet. Derfor bærer hver række et
`kilde`-felt (`Tegning`, `Datablad`, `Maskinliste`, `Byggeprogram`, `Skaleret erfaring`),
og app'en viser dækningsgraden, så man ved, hvor meget der er dokumenteret.

## Symbolordbogen

`data/plansymboler.json` oversætter tekst på tegningen til katalogposter. Hver mapping
har et tillidsniveau:

- **sikker** – verificeret mod maskinliste eller byggeprogram. Bruges direkte.
  Maskinnumrene er den stærke kobling: tegningen er mærket med præcis de numre,
  slagter-maskinlisten bruger (SL7a, SL11, SL12, SL15, SL17, SL21, SL23a, SL25, SL31),
  og de findes som id i katalogtabellen.
- **forslag** – sandsynlig, udledt af referencesagen. Møbelkoderne `EGM`, `LDF` og `CLS`
  er i denne kategori: de optræder på tegningen, men om et modul er køl, frost eller tør
  reol afhænger af projektet. Brugeren bekræfter dem første gang.
- **ukendt** – vises som ubesvaret række, hvor brugeren vælger katalogpost eller
  markerer "ingen el" (fx `SL8 Stålbord`, `Fletkurv`, `Stikvogn`).

Bekræftede valg gemmes i tabellen `kode_mapping` og genbruges. Ordbogen bliver bedre
for hver sag, uden at nogen skal vedligeholde den manuelt.

## Faldgruber, der er indbygget som advarsler

- **Tallene langs kasselinjen og reolrækkerne er hyldelængder, ikke antal.** Vision-modeller
  tolker dem gerne som styktal. Prompten instruerer imod det, og optællingen af kasser
  markeres altid med lav tillid til manuel kontrol.
- **Samme rumnavn flere gange** (`KØL 16 M2` og `KØL 8 M2`) er to rum → to kølerum,
  ikke ét på 24 m².
- **Møbler tegnet i flere lag** (fx reol med påbygget køl) tælles let dobbelt.
- **Areal på tegningen er nettoareal.** Byggeprogrammets W/m²-tal regner på salgsareal;
  brug kun `SALGSLOKALE`-arealet til belysning og komfortkøl.

## Review-skærmen

Tre kolonner:

1. Tegningen med zoom (og gerne markering af det, der blev talt).
2. Optællingen: kode, læst antal, tillid, foreslået katalogpost. Alt kan rettes.
3. Effekten af rettelsen: hvor mange kW og hvilke grupper posten giver.

Knapper: *Godkend optælling* (skriver til `forbrugere`), *Gem mapping* (skriver til
`kode_mapping`), *Marker som ingen el*.

## Uden tegning

Systemet skal kunne bruges uden tegning: vælg butikstype, indtast salgsareal, lagerareal
og antal kasser, slå afdelinger til, og der ligger en komplet liste på 60–80 rækker med
kilde "Skaleret erfaring". Tegningen løfter derefter kvaliteten af de rækker, den dækker.
