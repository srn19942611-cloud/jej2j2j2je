# Coop × Solselskabet i Ever Gauzy

Demo af [Ever Gauzy](https://github.com/ever-co/ever-gauzy), det open source-alternativ til Monday.com der var i videoen,
sat op med Solselskabets opgaver for Coop under rammeaftalen.

![Opgaver](skaermbilleder/opgaver.png)

## Indhold i demoen

Organisationen **Coop × Solselskabet** med 11 projekter og 128 opgaver:

| Projekt | Indhold |
|---|---|
| **Lokation 1–8** | Ét projekt pr. butik i førstegangsudrulningen. 14 faser pr. anlæg, fra screening over tilbud/PVSOL, statik, brandnotat, myndighed og net, montage, SPD, idriftsættelse og KS-pakke til aflevering og Dalux-registrering |
| **Rammeaftale 2025–2030** | Opstart, månedsrapport, samarbejdsmøder, rateplan (Bilag 1), prisregulering 01.01.2027 |
| **Drift og service** | Overvågning, årligt eftersyn, fejlmelding via Dalux, termografi, garantisager |
| **Afklaringspunkter i kravsættet** | Polykrystallinsk-formuleringen, inverterplacering, 5 m mellem felter, SPD |

**Kolonner/statusser:** Ikke startet · I gang · Afventer Coop · Afventer net/myndighed · Til godkendelse · Blokeret · Færdig

**Tags:** Ansvar: Solselskabet / Coop / Netselskab-kommune · Brand & forsikring · El & net · Dokumentation · Afklaringspunkt

> **Status på opgaverne er eksempler** (lokationerne står forskudt, så tavlen viser hele forløbet).
> Butiksnavne og kWp er ikke udfyldt. Skriv dem ind i `seed/data.mjs` før præsentationen.

## Sådan kører du det

Kræver [Docker Desktop](https://www.docker.com/products/docker-desktop/) og [Node.js](https://nodejs.org) 18 eller nyere.

```bash
cd solselskabet-gauzy
./start.sh
```

Første start tager 3–6 minutter. Derefter:

1. Åbn **http://localhost:4200**
2. Log ind med **admin@ever.co / admin** (eller klik "Super Admin Demo")
3. Vælg organisationen **Coop × Solselskabet** i vælgeren øverst til højre
4. Gå til **Tasks → Dashboard** for alle opgaver, eller **Organization → Projects** for lokationerne

På Windows uden bash: kør `docker compose up -d`, vent til http://localhost:3000/api/health svarer, og kør `node seed/seed.mjs`.
`.env` laves af `start.sh`. Uden den kan du kopiere `env.template` til `.env` og selv udfylde de fire `JWT_*`/`EXPRESS_SESSION_SECRET`-linjer med lange tilfældige strenge.

## Tilpas indholdet

Alt indhold ligger i `seed/data.mjs`: lokationer (navn, kWp, fremdrift), faser, statusser, tags og øvrige opgaver.
Når du har rettet, lægger du det ind igen med:

```bash
node seed/seed.mjs --reset
```

## Godt at vide

- Gauzy kører i **demotilstand**. Der ligger også Gauzys egne eksempelfirmaer i databasen. Vælg derfor den rigtige organisation, når du viser det frem.
- Brugerfladen er på engelsk (menuer). Statusser, projekter og opgaver er på dansk.
- Login er rate-begrænset. Hvis du får "Login/Email combination is not correct" lige efter seed, så vent et minut.
- Stop: `docker compose down`. Slet alt inkl. data: `docker compose down -v`.
- Seed-scriptet bruger Gauzys REST-API. Med `GAUZY_API`, `GAUZY_EMAIL` og `GAUZY_PASSWORD` kan det også pege på en anden Gauzy-installation. Det er kun testet mod den lokale opsætning her.
