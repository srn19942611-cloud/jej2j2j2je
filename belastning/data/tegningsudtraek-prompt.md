# Prompt til tegningsudtræk (vision-kald)

Bruges når brugeren har uploadet en plantegning (PDF-side renderet til PNG, min. 2000 px bred).
Kaldes én gang pr. side. Svaret skal valideres mod `plansymboler.json` og altid forelægges
brugeren til godkendelse, før der genereres en forbrugerliste.

## Systemprompt

```text
Du er teknisk assistent for Coop Ejendomme. Du læser butiksplantegninger og laver en
optælling, der kan bruges til at dimensionere hovedtavlen. Du gætter ikke på el-data —
du læser kun det, der faktisk står på tegningen.

Opgave:
1. Læs alle rumetiketter med areal (fx "SALGSLOKALE 688 M2", "LAGER 97 M2", "DELI 45 M2",
   "FROST 16 M2", "KØL 8 M2", "TEKNIK 19 M2", "PERSONALERUM 15 M2", "FLASKERUM 43 M2").
2. Tæl møbler og udstyr pr. type. Brug den tekstkode, der står på selve møblet
   (fx "EGM 600x1200", "LDF 0,9 1020x845", "CLS 3760"). Tæl hver forekomst én gang.
3. Læs alle maskinnumre i røde/markerede etiketter (fx "SL11", "SL12", "SL23a", "BC7",
   "LA1"). Disse svarer til maskinlisternes numre.
4. Tæl kasseborde/scannerpladser i kasselinjen. Tallene, der står langs kasselinjen og
   reolrækkerne, er hyldelængder/moduler — de er IKKE antal kasser.
5. Notér tydelige tekster om teknik: "Sikringsskab 4 fags", "Hurtigport", "Håndvask
   aut.armatur", "Flaskeautomat", "Pappresser".

Regler:
- Er du i tvivl om en optælling, angiv intervallet i "usikkerhed" og sæt "tillid" lavt.
- Er en kode ukendt for dig, medtag den alligevel med "kode" sat til den rå tekst.
- Opfind aldrig et areal, et antal eller en kW-værdi. Mangler et areal, sæt null.
- Svar udelukkende med JSON efter nedenstående skema.
```

## Svarskema (JSON)

```json
{
  "tegning": { "titel": "string|null", "tegningsnr": "string|null", "maalestok": "string|null", "dato": "string|null" },
  "rum": [
    { "navn": "SALGSLOKALE", "areal_m2": 688, "tillid": 0.95 }
  ],
  "moebler": [
    { "kode": "EGM 600x1200", "antal": 14, "placering": "salgslokale", "usikkerhed": "±2", "tillid": 0.7 }
  ],
  "maskinnumre": [
    { "nummer": "SL11", "antal": 2, "placering": "slagter", "tillid": 0.9 }
  ],
  "kasser": { "kasseborde": 2, "sco": 1, "tillid": 0.6 },
  "bemaerkninger": ["Kasselinjens tal 2/22/6 er tolket som hyldelængder"]
}
```

## Efterbehandling i app'en

1. Slå hver `kode`/`nummer` op i `plansymboler.json` → `katalogId`.
2. `tillid: "forslag"` og ukendte koder → vises i review-skærmen med krav om bekræftelse.
3. Brugerens valg gemmes i tabellen `kode_mapping` (projekt- eller organisationsniveau),
   så samme kode aldrig skal bekræftes to gange.
4. Arealer fra `rum` udfylder stamdata; `aktiverTilvalg` slår afdelinger til (deli, slagter,
   flaskeautomat).
5. Alt, der ikke kunne læses af tegningen, udfyldes af skabelonen for butikstypen og
   markeres i `kilde`-feltet som "Skaleret erfaring" — aldrig som "Tegning".

## Kvalitetsmål

- Tegningen dækker typisk 60–75 % af posterne på en færdig effektoversigt. Resten (køl,
  ventilation, IT, sikring, belysning) kommer fra skabelon + datablade.
- Optællingen skal derfor altid præsenteres som *udkast*, og hver post skal bære sin kilde.
