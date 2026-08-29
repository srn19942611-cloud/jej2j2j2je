# Kørselslog

Android app that logs driving automatically and computes the Danish commuter
deduction — **befordringsfradrag, rubrik 51** on the årsopgørelse.

Built for a *variable* workplace: no fixed office, ~47 retail locations. Trips
between two work locations are **erhverv** and are deliberately kept out of the
rubrik 51 figure; only the legs that touch home feed the deduction.

---

## ⚠️ Check the satser every tax year

Skatterådet re-sets the rates annually, **and they can change mid-year**. They
did in 2026: originally 2,28 / 1,14 kr/km, then raised retroactively for the
whole year by the decision of 25 June 2026.

| Tier (per day, round trip) | 2025 | 2026 |
|---|---|---|
| 0–24 km | 0 kr | 0 kr |
| 25–120 km | 2,23 kr/km | **3,17 kr/km** |
| over 120 km | 1,12 kr/km | **1,59 kr/km** |
| udkantskommune / småø (whole stretch) | 2,23 kr/km | **3,51 kr/km** |

These are seeded into the database on first run but are stored **unverified**,
so the app shows a red banner on the dashboard and stamps a warning into the
rubrik 51 export until you confirm them against
<https://skat.dk/borger/fradrag/koerselsfradrag>. Nothing in the calculator is
hardcoded — every threshold and rate is an editable per-year row.

> The seeded numbers were taken from public reporting of Skatterådet's satser in
> August 2026, not read off skat.dk directly (that host was unreachable from the
> build environment). Confirm them before you file.

---

## Building

```bash
cd korselslog-android
./gradlew assembleDebug
```

APK lands in `app/build/outputs/apk/debug/`. Side-load it with
`adb install -r app/build/outputs/apk/debug/app-debug.apk`.

Requires JDK 17+ and an Android SDK with API 35. CI (`.github/workflows/android.yml`)
runs the unit tests and builds the same APK on every push, and uploads it as a
downloadable artifact — use that if you'd rather not install the SDK locally.

Run the unit tests alone:

```bash
./gradlew test
```

---

## How the deduction is computed

Per ligningsloven § 9 C, per **calendar day**:

1. The day's commute distance is the sum of that day's `COMMUTE` trips. On a
   `home → store A → store B → home` day that is `home→A` plus `B→home` — the
   inter-store leg is `BUSINESS` and never counted.
2. The first **24 km** of the daily distance yield nothing.
3. The excess is split at **120 km** and charged at the two band rates.
4. Days you did not actually commute yield nothing. Home office, sick days,
   holidays and vacation are marked on the **Dage** screen; a marker overrides
   whatever GPS recorded, so a drive on a sick day still yields nothing.
5. Residents of an udkantskommune can instead take the whole deductible stretch
   at one flat rate (off by default).

Business trips live in a completely separate ledger and are exportable on their
own for a kørselsregnskab.

### 60-dages-reglen

With changing workplaces, driving from home to a location you have visited on
60 days or fewer within the preceding 12 months is *erhvervsmæssig*; from day 61
that location counts as fixed and the driving becomes ordinary commuting.

The app tracks a rolling 12-month distinct-day count per work location and warns
as one approaches the limit (Indstillinger → the location's card). It does **not**
silently re-classify anything — the counter is shown, you decide.

*Simplification:* the statute also resets the count after a 60-consecutive-working-day
absence from a location. Only the rolling 12-month count is implemented, which is
the stricter reading.

---

## Trip detection

The design priority was capturing every drive whole, without splitting one into
several.

**Two triggers, so nothing is missed:**

- **The car's Bluetooth (primary).** Pick your car stereo or handsfree kit under
  Indstillinger → Bilens Bluetooth. Connecting starts a trip within seconds of
  the ignition; disconnecting ends it immediately, with no dwell period, because
  the car powering down is a definitive end of drive. This beats activity
  recognition, which needs the car moving before it is confident and so joins
  every trip late.
- **Activity recognition (fallback).** Play Services fires an `IN_VEHICLE` ENTER
  transition. Covers a borrowed car, or a phone that is not paired. Its EXIT
  transition is only a *hint* — the dwell still has to elapse, since it reports
  brief exits at long traffic lights.

The service ignores a start while a trip is already running, so the two triggers
cannot double-log a drive. If the car is already connected when you enable
tracking — or after a reboot mid-drive — the trip is picked up rather than lost.

- **Start** — as above. Nothing polls; GPS only runs between a start and its stop.
- **Distance** — fixes worse than 50 m accuracy are dropped, movement under 20 m
  is treated as jitter, and a fix implying >60 m/s becomes a new anchor without
  billing the phantom kilometres (that is what a cold lock or a tunnel exit looks
  like).
- **Stop** — a trip ends only once the vehicle has stayed inside a 60 m radius for
  the dwell period (default 5 minutes), measured **from the last time it actually
  moved**, not from the last fix received. A vehicle-EXIT transition is a hint that
  starts the clock, never an immediate stop. Traffic lights, level crossings and
  drive-throughs therefore never split a trip.
- **Merge** — if a new trip starts within 6 minutes and 300 m of where the last one
  ended, they are glued back together.
- **Discard** — anything under 0,5 km or 90 seconds is dropped as noise.

Every one of those thresholds is a field on `TrackingConfig`.

### Correcting a trip

GPS gets it wrong; the correction flow is built to be fast. Tapping a trip opens
an editor with the three classification buttons at the top — one tap re-tags it.
Distance, times, addresses and notes are all editable, trips can be deleted, and
the repository supports splitting a trip at a timestamp (re-measuring both halves
from the stored route) and merging two trips.

Trips the classifier was unsure about are flagged **Bekræft** in the list and
counted on the dashboard.

### Auto-classification

Set your home address and every work location (Indstillinger → Adresser). Then:

| From | To | Result |
|---|---|---|
| home | work | Bopæl–arbejde |
| work | home | Bopæl–arbejde |
| work | work | Erhverv |
| home | home | Privat |
| anything unknown | | guessed, flagged for review |

Editing a place re-runs classification over every trip you have **not** manually
corrected — your corrections are never overwritten.

---

## Permissions & battery

- Foreground location, activity recognition and notifications are requested first.
- **Background location is requested separately, only after foreground is granted** —
  asking for both at once makes Android silently deny "Allow all the time".
- On Android 11+ the system refuses to show a dialog for background location at
  all, so the app sends you to app settings with an explanation of what to pick.

Battery: activity **transitions** rather than polling, `PRIORITY_BALANCED_POWER_ACCURACY`,
a 15 s interval with a 25 m distance filter, and GPS running only between an
IN_VEHICLE enter and the stop.

---

## Exports

Share sheet, from the **Eksport** tab. All CSV is `;`-separated with a UTF-8 BOM
and Danish decimal commas, so Excel-dk opens it cleanly.

| Export | Contents |
|---|---|
| **Årsopgørelse (rubrik 51)** | The figure to type in, the satser used, summary counts, **TastSelv-shaped lines** (period from/to, home + workplace address, day count, km per day), monthly breakdown, marked non-driving days, and every daily calculation behind the total. |
| **Kørselsregnskab (erhverv)** | Business trips only, CSV and JSON. Date, purpose, both endpoints, distance, rate, amount. |
| **Alle ture** | Raw trip export incl. coordinates and the review flags. |

The rubrik 51 export is grouped the way TastSelv's calculator wants input —
period + day count, not a raw trip log. Days are grouped by workplace and by
daily distance **rounded to whole km**, so GPS noise (60,1 / 59,8 / 60,4 km)
does not fragment one commute into dozens of lines.

The business JSON carries a `"schema": "koerselsregnskab/v1"` marker for the
separate React kørselsregnskab tool. Field names are English camelCase
(`date`, `from`, `to`, `km`, `purpose`, `ratePerKm`, `amount`); you may need to
map them to whatever that tool expects.

---

## Architecture

```
domain/    Pure Kotlin, zero Android imports — the tax engine, the segmenter,
           the classifier, the 60-day rule. All of it unit-tested.
data/      Room entities, DAOs, repository. Flow-based, so the dashboard
           recomputes live as trips land.
tracking/  Activity transitions → foreground service → recorder.
export/    CSV / JSON / TastSelv renderers.
ui/        Compose screens + ViewModels.
```

Keeping `domain/` free of Android types is deliberate: the rules that decide a
tax figure are the part that most needs to be testable, and they run on a plain
JVM.

---

## Testing status

76 unit tests cover the tax engine, the daily aggregation, the 60-day rule, the
segmenter's stop/merge logic, the classifier, and all three exporters — including
worked examples at the 24 km floor, the 120 km band edge, and the peripheral rate.

**The Android build is green.** CI compiles the app, runs the unit tests and
produces the debug APK (~17,5 MB), uploaded as the `koerselslog-debug-apk`
artifact on every run. The environment this was written in blocks
`dl.google.com`, so AGP, the Android SDK and androidx were unreachable locally
and the first CI runs were the first real compile; they failed on two bad
imports (`androidx.compose.foundation.lazy.item` — `item` is a `LazyListScope`
member, so only `items` is importable), which are fixed.

What that does *not* cover: nothing has run on a real device. Trip detection,
the permission flow, reverse geocoding and the share-sheet exports are compiled
and unit-tested where they are pure logic, but unexercised against actual GPS,
Play Services and Android's background-location behaviour.

## Known limitations

- Room's generated code and the Compose UI are unverified (see above).
- Reverse geocoding is best-effort: no connectivity at the moment a trip ends
  means the trip is saved with coordinates and a blank address.
- Distance is great-circle summed along the recorded track, so it slightly
  under-reads versus the road distance Skat expects. Correct any trip by hand
  where the difference matters.
- Trip splitting is implemented in the repository but not yet surfaced in the UI.
