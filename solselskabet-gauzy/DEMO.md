# Demo i morgen: sådan viser du det hele

## Den sikre vej: ét Vercel-link (ingen server, virker på alt)

Feltappen har en indbygget **demotilstand**. Hele forløbet kører i browseren uden server, og det tager kun et par minutter at sætte op:

- montøren på taget
- kontor-tavlen
- feltrapporter med fotos
- tilbud med tegning og grafer

### I aften (ca. 10 minutter)

1. **Opret projektet.** Gå til **vercel.com**, log ind med GitHub, og vælg **Add New → Project** → importér repoet **jej2j2j2je**.
2. **Indstil projektet:**
   - **Root Directory:** `solselskabet-gauzy`
   - **Framework Preset:** *Other*
   - Lad build-indstillingerne stå tomme, og tryk **Deploy**.
3. **Vælg den rigtige branch.** Gå til **Settings → Git → Production Branch**, og skriv `ccr-39deed5b-s9z3s0`. Gå derefter til **Deployments**, og vælg **Redeploy**. Ellers bliver det kun en preview, og den kræver Vercel-login.
4. **Prøv linket** `https://<projekt>.vercel.app` på pc'en og på telefonen. Log ind med en vilkårlig adgangskode, fordi montørens e-mail er udfyldt på forhånd.
5. **Nulstil demoen.** Kør demoen igennem én gang, og tryk så **⋯ → Nulstil demo**, så du starter rent i morgen.

### Under mødet (15–20 minutter) – alt på pc'en, telefonen som ekstra

Visningerne skifter du mellem med de tre faner øverst: **👷 Montør · 🗂 Kontor-tavle · 📋 Feltrapporter**.

| Minut | Vis | Sig |
|---|---|---|
| 0–3 | **🗂 Kontor-tavle**, alle lokationer. Vælg derefter *Lokation 3* | "Én fælles tavle for Coop og Solselskabet. 8 lokationer med 14 faser fra screening til drift. Man ser straks, hvor bolden ligger." |
| 3–5 | **Træk et kort** fra *I gang* til *Til godkendelse* | "Status ændres ved at trække, ligesom i Monday." |
| 5–10 | **👷 Montør** → søg *Screening* → åbn opgaven. Udfyld tagtype og stand, tag fotos, og tryk **Send til godkendelse**. Prøv først at sende uden fotos, så appen siger fra | "Montøren dokumenterer på taget. Appen stopper ham, hvis noget mangler. Fotos får stempel med lokation og tidspunkt." |
| 10–12 | **📋 Feltrapporter**: rapporten med fotos ligger øverst. Gå til tavlen, hvor kortet har fået 📋 | "Kontoret ser det med det samme. Ingen mails med billeder frem og tilbage." |
| 12–16 | **👷 Montør** → **☀ Se anlæg, produktion og forbrug** på en lokation. Vis tegningen af taget, produktionen og hvor strømmen kommer fra. Skift mellem juni og december | "Det her kan sendes direkte til butikken som et link." |
| 16–20 | Spørgsmål og næste skridt | Se nedenfor |

**Telefonen:** Åbn samme link på din telefon, og vis feltappen i hånden: tag et rigtigt foto med kameraet, og skriv en underskrift på *13. Aflevering*. I demoen gemmes data kun i den browser, man bruger, så telefonens rapport kan ikke ses på pc'en. Det kan den først på en rigtig server (se nedenfor).

**Sig fra starten:** Tallene er eksempler. Status, tagstørrelser, kWp og forbrug er illustrative, indtil PVSOL-rapporter og målerdata er lagt ind.

**OBS:** Vercel-linket er offentligt. Det indeholder projektet "Afklaringspunkter i kravsættet". Del derfor kun linket med dem, der skal se det.

### Næste skridt at foreslå

- **Rigtig server** (ca. 110 kr. om måneden, se `online/README.md`). Så kører telefon og kontor på samme data, og Gauzy-delen med rapporter, tidsregistrering og dokumenter kommer med.
- **Rigtige data:** butiksnavne, PVSOL-tal og målerdata lægges ind.
- **Næste funktioner:** AI-assistent, AI-mødereferent og automatiseringer (se `MONDAY-SAMMENLIGNING.md`).

## Hvis du også vil vise Gauzy live

Det kræver en server. Følg `online/README.md` med en adresse som `<ip-med-bindestreger>.sslip.io`. Det tager ca. 45 minutter. Så virker det hele på samme data, og telefonens rapport dukker op i Gauzy på pc'en.

## Nødplan

Hvis internettet driller, så vis skærmbillederne i `skaermbilleder/`. Du kan også køre demoen lokalt: åbn `app/index.html?demo` via en lokal webserver, fx `npx serve solselskabet-gauzy` → `http://localhost:3000/app/?demo`.
