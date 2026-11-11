# Demo i morgen: forberedelse og manuskript

## I aften (ca. 45 minutter)

**Anbefalet: læg det på en server.** Så virker det på din pc, på deres skærm og på alle telefoner uden at være afhængigt af jeres wifi.

1. **Opret serveren.** Opret en Hetzner Cloud-konto og en server: **CX33, Ubuntu 24.04**. Det koster få kroner for et døgn, og serveren kan slettes bagefter.
2. **Log ind og installér.** Følg trin 3–4 i `online/README.md`. Brug adressen `<ip-med-bindestreger>.sslip.io` som domæne, så skal du ikke bruge et rigtigt domæne:
   ```bash
   ./online/installer.sh 95-217-10-20.sslip.io
   ```
3. **Gem adgangskoderne og QR-koden.** Installeren skriver dem ud til sidst. Tag et billede af skærmen.
4. **Generalprøve:**
   - Log ind på `https://<adresse>/` på pc'en.
   - Scan QR-koden med telefonen, og log ind som montør.
   - Udfyld en tjekliste med et foto, og send den.
   - Se, at rapporten dukker op i Gauzy.
5. **Hvis I har tid:** Ret navne og kWp for et par lokationer i `seed/data.mjs` og `app/anlaeg.js`, så det ligner deres egne butikker. Kør derefter installeren igen.

**Nødplan uden server:** Kør `./start.sh` på din egen pc. Det kræver Docker Desktop og Node.js. Kontoret er så på `http://localhost:4200` og feltappen på `http://<pc-ens-ip>:8080`. Telefonen skal være på samme wifi, og gæste-wifi blokerer ofte for det. Tag også skærmbillederne i `skaermbilleder/` med som sidste udvej.

## Under mødet (15–20 minutter)

Hav to faner åbne på pc'en, og telefonen klar ved siden af.

| Minut | Vis | Sig |
|---|---|---|
| 0–2 | **Login** og **Opgaver**, filtreret på en lokation | "Én fælles tavle for Coop og Solselskabet. Alle 8 lokationer, 14 faser fra screening til drift, og det står på dansk." |
| 2–5 | **Projekter**: Lokation 1 mod Lokation 8, statusser og ansvar-tags | "Man kan straks se, hvem bolden ligger hos: Solselskabet, Coop eller netselskabet." |
| 5–9 | **Telefonen**: feltappen, *Næste skridt*, en montageopgave. Tag et foto, udfyld et par felter, og prøv *Send til godkendelse* | "Montøren dokumenterer på taget. Appen siger fra, hvis noget mangler. Fotos får stempel med lokation og tidspunkt." |
| 9–10 | **Pc'en**: åbn samme opgave i Gauzy, så feltrapporten med fotos står der | "Kontoret ser det med det samme. Ingen mails med billeder frem og tilbage." |
| 10–14 | **Tilbudsvisningen**: tryk *Se anlæg* på en lokation. Vis tegningen af taget, produktionen og hvor strømmen kommer fra. Skift mellem juni og december i "en typisk dag" | "Det her kan vises direkte for butikken. Det er et link uden login." |
| 14–16 | **Afklaringspunkter** og **Rammeaftale**-projekterne | "De åbne punkter i kravsættet ligger samme sted som opgaverne." |
| 16–20 | Spørgsmål og næste skridt | Se nedenfor |

**Sig det højt fra starten:** Tallene er eksempler. Status på opgaverne, tagstørrelser, kWp og forbrug er illustrative, indtil PVSOL-rapporter og målerdata er lagt ind.

**Vis ikke:**
- AI-assistenten, før en API-nøgle er lagt ind. Sidepanelet siger ellers, at AI ikke er sat op.
- Gauzys demofunktioner (Jobs, Kandidater, Salg). De er ikke relevante for Solselskabet og kan slås fra senere.

**Mulige næste skridt at foreslå:**
- Solselskabet får egne logins, og montørerne får adgang til feltappen.
- Rigtige butiksnavne, PVSOL-tal og målerdata lægges ind.
- Tavlevisninger (kanban/Gantt), AI-mødereferent og automatiseringer (se `MONDAY-SAMMENLIGNING.md`).
- Drift: ca. 110 kr. om måneden for serveren, uanset antal brugere.
