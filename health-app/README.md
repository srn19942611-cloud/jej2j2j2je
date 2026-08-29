# Sundhed — personlig sundhedstracking

Android-app til privat brug. Alt gemmes lokalt på telefonen i SQLite; intet
sendes nogen steder hen, før faserne med Claude-analyse er bygget (og der
sendes kun de billeder, du selv vælger).

**Status: fase 1 er færdig — vægt-tracking, graf og mål.**

## Kom i gang

```bash
cd health-app
npm install
```

### Se det på computeren (hurtigt UI-tjek)

```bash
npm run web
```

Kører appen i browseren med den samme SQLite-database (WebAssembly). Fint til
at kigge på skærmene — men Health Connect, kamera og datovælgeren findes kun
på telefonen.

### Kør det på telefonen

Health Connect (fase 2) virker ikke i Expo Go, så vi bruger en **dev build**
fra starten:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Når EAS er færdig, får du et link til en `.apk`. Installér den på telefonen,
og start derefter udviklingsserveren:

```bash
npx expo start --dev-client
```

Scan QR-koden med appen. Herefter kan al JavaScript-kode ændres uden at bygge
igen — kun når der tilføjes en ny native pakke, skal `eas build` køres på ny.

### Tests

```bash
npm test        # datologik, statistik og SQL-skema
npm run typecheck
```

Testene kører uden telefon: TypeScript oversættes til en midlertidig mappe, og
skemaet køres mod Node's indbyggede SQLite.

## Sådan hænger det sammen

```
app/                    skærme (expo-router)
  _layout.tsx           åbner databasen og kører migrationer ved opstart
  (tabs)/index.tsx      log dagens vægt + seneste målinger
  (tabs)/graph.tsx      graf og trend, uge/måned/år/alt
  (tabs)/goal.tsx       mål, fremskridt og realistisk ugentligt tempo
src/
  db/schema.ts          SQL: migrationer og upserts (uden afhængigheder)
  db/index.ts           åbner databasen, kører migrationer efter user_version
  db/weight.ts          vægtmålinger
  db/goal.ts            målet, gemt i settings-tabellen
  db/settings.ts        nøgle/værdi
  lib/date.ts           lokale kalenderdage som "YYYY-MM-DD"
  lib/stats.ts          glidende gennemsnit, trend, fremskridt, plan
  lib/format.ts         dansk tal-format (komma)
  components/           kort, graf, knapper og felter
```

### Databasen

Migrationer ligger i `src/db/schema.ts` og køres i rækkefølge styret af
SQLite's `user_version`. **Ret aldrig i en migration, der er kørt** — tilføj en
ny nederst, ellers bliver telefonens database og koden uenige.

Tabellen `weight_entries` har allerede felterne `source`, `hc_record_id` og
`synced_to_hc`, så fase 2 kan skelne mellem manuelt indtastede målinger og dem,
der kommer fra Health Connect, uden at skemaet skal laves om.

### Tallene

- **Trend** er hældningen (mindste kvadraters metode) over de seneste 28 dages
  målinger, omregnet til kg/uge. Den tykke kurve i grafen er et 7-dages
  glidende gennemsnit — dag-til-dag udsving på vægten er mest væske.
- **Sikker øvre grænse** er sat til ca. 1 % af kropsvægten om ugen. Kræver din
  frist mere end det, siger appen til og foreslår en længere tidshorisont.
- Alt regnes udelukkende på de målinger, du selv har logget. Appen udfylder
  ikke huller med gæt.

## Faser

| # | Fase | Status |
|---|------|--------|
| 1 | Grundstruktur + vægt-tracking | ✅ færdig |
| 2 | Health Connect (læs/skriv vægt og aktivitet) | ikke påbegyndt |
| 3 | Træningsdata (manuel + fra Health Connect) | ikke påbegyndt |
| 4 | Mad-analyse fra billeder | ikke påbegyndt |
| 5 | Madplan fra tilbudsaviser | ikke påbegyndt |
| 6 | Sundhedscoach | ikke påbegyndt |
