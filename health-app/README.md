# Sundhed — personlig sundhedstracking

Android-app til privat brug: vægt, træning, mad og en coach, der kun bruger
dine egne tal. Alt ligger lokalt i SQLite på telefonen. Det eneste, der
forlader enheden, er de billeder du selv vælger at analysere, og det databilag
coachen får med — begge dele til Anthropics API, med din egen nøgle.

**Alle seks faser er bygget.**

| # | Fase | Hvor |
|---|------|------|
| 1 | Vægt-tracking, graf og mål | fanen **Vægt**, `app/goal.tsx` |
| 2 | Health Connect (læs + skriv) | `src/lib/healthConnect.ts`, **Indstillinger** |
| 3 | Træningsdata, manuelt og fra Health Connect | fanen **Træning**, `app/workout.tsx` |
| 4 | Mad-analyse fra billeder | fanen **Mad** |
| 5 | Tilbudsaviser og madplan | `app/catalog.tsx`, `app/mealplan.tsx` |
| 6 | Sundhedscoach | fanen **Coach** |

## Kom i gang

```bash
cd health-app
npm install
```

### Kør det på telefonen

Health Connect virker ikke i Expo Go, så appen bruger en **dev build**:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Installér den `.apk`, EAS giver dig, og start derefter:

```bash
npx expo start --dev-client
```

Herefter kan al JavaScript ændres uden at bygge igen — kun nye native pakker
kræver en ny `eas build`.

### Se det på computeren

```bash
npm run web
```

Kører hele UI'et i browseren med den samme SQLite-database (WebAssembly). Godt
til at kigge på skærmene. Health Connect, kamera og datovælgeren findes kun på
telefonen; appen siger selv til, hvor noget mangler.

### Tests

```bash
npm test        # datoer, statistik, energiberegning, træning, coach-bilag, SQL-skema
npm run typecheck
```

Testene kører uden telefon: TypeScript oversættes til en midlertidig mappe, og
skemaet køres mod Node's indbyggede SQLite.

Der er også et ende-til-ende-tjek af de fire Claude-kald, som kører hele
web-versionen i en browser og besvarer alle API-kald med faste svar — så det
kan køres uden en rigtig nøgle og uden at sende noget ud på nettet:

```bash
npm i -D playwright && npx playwright install chromium
npx expo export --platform web --output-dir dist-web
node scripts/e2e-web.mjs
```

Det kontrollerer, at billedet sendes som base64 med et JSON-skema som
svarformat, at coachen får de beregnede mål med i sit bilag, at tilbuddene
gemmes lokalt, og at madplanen bygger på både tilbud og kaloriemål.

## Opsætning i appen

1. **Indstillinger → Profil**: højde, fødselsår og køn. Det skal til for at
   regne hvilestofskifte og kaloriemål.
2. **Indstillinger → Claude API**: indsæt din nøgle fra console.anthropic.com.
   Den gemmes i Android Keystore via `expo-secure-store` — aldrig i koden, i
   `app.json` eller i APK'en. Vælg model her (Opus 5 som standard).
3. **Indstillinger → Health Connect**: giv adgang til datatyperne, og
   synkronisér. Appen læser skridt, puls, hvilepuls, træningspas, aktivt og
   samlet kalorieforbrug, distance, søvn og vægt — og skriver dine egne vægt-
   og træningslogninger tilbage.
4. **Mål**: nuværende vægt, målvægt og en frist. Appen regner det ugentlige
   tempo og siger til, hvis fristen kræver mere end ca. 1 % af kropsvægten om
   ugen.

## Sådan hænger det sammen

```
app/                     skærme (expo-router)
  _layout.tsx            åbner databasen og kører migrationer ved opstart
  (tabs)/index.tsx       I dag: vægt, kalorier, aktivitet, ugen, genveje
  (tabs)/weight.tsx      vægt-log, graf og trend
  (tabs)/training.tsx    ugeoverblik og træningslog
  (tabs)/food.tsx        mad-dagbog, foto-analyse og ugestatistik
  (tabs)/coach.tsx       coach-chat
  workout.tsx            opret/redigér pas — øvelser, sæt, reps, distance, puls
  goal.tsx               vægtmål og fremskridt
  catalog.tsx            scan tilbudsaviser
  mealplan.tsx           madplan og indkøbsliste
  settings.tsx           profil, API-nøgle, model, Health Connect
src/
  db/schema.ts           alt SQL: migrationer og upserts (uden afhængigheder)
  db/index.ts            åbner databasen, migrerer efter user_version
  db/*.ts                ét modul pr. tabel
  lib/healthConnect.ts   læs/skriv mod Health Connect
  lib/claude.ts          API-nøgle, model og de fire Claude-kald
  lib/energy.ts          BMR, vedligeholdelsesbehov, kalorie- og proteinmål
  lib/summary.ts         samler alle data til ét billede af situationen
  lib/coachContext.ts    databilaget coachen får — ren, læsbar tekst
  lib/stats.ts           glidende gennemsnit, trend, fremskridt
  components/            kort, grafer, knapper og felter (med animationer)
```

### Databasen

Migrationer ligger i `src/db/schema.ts` og køres i rækkefølge styret af
SQLite's `user_version`. **Ret aldrig i en migration, der er kørt** — tilføj en
ny nederst, ellers bliver telefonens database og koden uenige.

`weight_entries` og `workouts` har begge `source`, `hc_record_id` og
`synced_to_hc`, så appen kan skelne dine egne indtastninger fra det, der kommer
fra Health Connect, og kun sende dine egne den anden vej. Et pas fra Health
Connect kan ikke lande to gange: `hc_record_id` har et unikt indeks, og en
gensynkronisering overskriver ikke felter, du selv har udfyldt (RPE, noter, sæt).

### Tallene

Ingen af tallene i appen er gættet. Kæden ser sådan ud:

1. **Vedligeholdelsesbehov (TDEE).** Har du logget mad i mindst 14 dage, regnes
   det på energibalancen: gennemsnitligt indtag + (ugentlig vægtændring ×
   7 700 kcal ÷ 7). Det er dine egne tal. Ellers bruges Mifflin-St Jeor gange
   en aktivitetsfaktor udledt af dine faktiske skridt fra Health Connect.
2. **Underskud.** Det ugentlige tab, målet lægger op til, ganges med
   7 700 kcal/kg og deles med 7.
3. **Kaloriemål** = TDEE − underskud, men aldrig under hvilestofskiftet og
   aldrig under 1 500 kcal (mænd) / 1 200 kcal (kvinder). Rammer det gulvet,
   siger appen det.
4. **Protein**: 1,9 g pr. kg (midt i det anbefalede 1,6–2,2 g/kg ved vægttab),
   regnet på den laveste af nuværende og målvægt.
5. **Trend**: hældningen (mindste kvadraters metode) over de seneste 28 dages
   vægtmålinger, omregnet til kg/uge. Den tykke kurve i grafen er et 7-dages
   glidende gennemsnit.

Coachen får de færdigregnede tal med som databilag og har besked på ikke at
lave sine egne. Du kan selv læse bilaget: tryk **Vis de data, coachen fik**
under samtalen.

### Claude-kaldene

Fire steder bruger appen Claude, alle med den model du vælger i
Indstillinger (`claude-opus-5` som standard):

| Hvor | Hvad |
|------|------|
| Mad → foto | Billedet skaleres til 1024 px og sendes med et struktureret svarformat: varer, kalorier, makroer og hvor sikkert skønnet er |
| Tilbudsaviser | Op til 8 sider ad gangen læses til varenavn, pris, mængde og kategori |
| Madplan | Tilbuddene + dit kalorie- og proteinmål ind, uge­plan og indkøbsliste ud |
| Coach | Databilaget + samtalen ind, kort svar på dansk ud |

Svarene på de tre første er bundet til et skema (`output_config.format`), så de
altid kan læses maskinelt. Kalorieskøn kan altid rettes i hånden, inden de
gemmes.

### Tilbudsaviser

Appen kender Netto, Rema 1000, **365discount**, Lidl, Aldi, Føtex, Bilka,
Coop 365, SuperBrugsen og Meny — og "Andet" til resten. Fotografér siderne
eller vælg dem fra galleriet; tilbuddene gemmes lokalt og bruges, næste gang du
laver en madplan.

## Hvad appen ikke gør

- Den synkroniserer ikke mellem enheder. Én telefon, én database.
- Der er ingen eksport/backup endnu — dør telefonen, er data væk.
- Den er ikke en læge. Coachen henviser videre ved helbredsmæssige spørgsmål.
