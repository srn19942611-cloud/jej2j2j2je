# Sæt Solselskabet-platformen online

Resultatet bliver ét domæne med HTTPS:

| Adresse | Hvad |
|---|---|
| `https://<domæne>/` | Gauzy på dansk (kontoret) |
| `https://<domæne>/felt/` | Feltappen (telefonen) |
| `https://<domæne>/felt/#tilbud/3` | Tilbudsvisning for lokation 3 – kan åbnes uden login |

## Hvorfor ikke Vercel?

Vercel kan kun køre hjemmesider og korte funktioner. Platformen her består af:

- en server, der kører hele tiden (Gauzys API)
- en PostgreSQL-database
- et filarkiv til fotos og underskrifter
- Docker-containere

Vercel har ingen fast lagerplads og har lukket sin egen Postgres. Containere er kun i beta. Derfor bruger vi en almindelig virtuel server, hvor det hele kører samlet.

## Pris pr. måned

**Anbefaling: Hetzner Cloud CX33** (4 vCPU, 8 GB RAM, 80 GB SSD, 20 TB trafik). Serveren står i Tyskland eller Finland, altså i EU.

| Post | Pris ekskl. moms | Ca. kr. inkl. moms |
|---|---|---|
| Server CX33 inkl. IPv4 | 8,99 € / md | ~84 kr. / md |
| Automatisk backup af hele serveren (+20 %) | 1,80 € / md | ~17 kr. / md |
| Domæne, fx `solselskabet-projekter.dk` | ~100 kr. / år | ~8 kr. / md |
| HTTPS-certifikat (Let's Encrypt) | gratis | 0 kr. |
| **I alt** | | **ca. 110 kr. / md** |

Til sammenligning koster Monday.com Pro 19 € pr. bruger pr. måned. Med 10 brugere er det ca. 1.400 kr. om måneden. Her er der ingen pris pr. bruger.

**Valgfrit:**

- **AI-funktioner:** betales efter forbrug hos AI-udbyderen. Typisk 50–500 kr. om måneden afhængigt af brug.
- **Mail-udsendelse** (invitationer, glemt adgangskode) via fx Brevo: gratis op til 300 mails om dagen.

**Alternativer, hvis Coop IT kræver det:**

- DigitalOcean 8 GB: ca. 48 $ om måneden.
- Azure / Coops egen drift: prisen afhænger af Coops aftale.

Gauzy bruger ca. 0,7 GB RAM i drift. 8 GB giver rigeligt luft til database, AI og vækst.

## Sådan gør du (ca. 30 minutter)

1. **Opret server.** Gå til hetzner.com/cloud, opret en konto og et projekt, og tilføj en server:
   - Location: Falkenstein eller Helsinki
   - Image: **Ubuntu 24.04**
   - Type: **CX33**
   - Slå **Backups** til
   - Tilføj din SSH-nøgle, eller vælg adgangskode
2. **Peg domænet på serveren.** Opret en **A-record** hos din domæneudbyder, så domænet peger på serverens IP-adresse.
3. **Log ind på serveren og hent koden:**
   ```bash
   ssh root@<serverens-ip>
   apt-get update && apt-get install -y git gh
   gh auth login                       # vælg GitHub.com → HTTPS → "Login with a web browser", og indtast koden
   gh repo clone srn19942611-cloud/jej2j2j2je
   cd jej2j2j2je/solselskabet-gauzy
   ```
4. **Installer:**
   ```bash
   ./online/installer.sh <dit-domæne>
   ```
   Installeren gør følgende:
   - installerer Docker
   - slår firewallen til
   - laver tilfældige adgangskoder
   - bygger den danske udgave med Solselskabets logo
   - lægger data ind
   - opsætter natlig backup

   Til sidst viser den adgangskoderne. De gemmes også i `/root/solselskabet-adgangskoder.txt`.

## Sikkerhed

- **Ingen demotilstand:** ingen demo-logins og ingen eksempelfirmaer.
- **Ingen åben tilmelding:** ingen kan selv oprette en konto.
- **Kun det nødvendige er åbent:** kun port 80 og 443 vender ud mod internettet. Database og API er kun tilgængelige internt.
- **Adgangskoder:** alle er lange og tilfældige.
- **Backup:** database og fotos tages hver nat kl. 02.30 og gemmes i 14 dage i `/var/backups/solselskabet`. Hetzners backup kommer oveni.

## Drift

| Opgave | Kommando |
|---|---|
| Opdater til nyeste version fra GitHub | `git pull && ./online/installer.sh <domæne>` |
| Se status | `docker compose -p solselskabet -f docker-compose.yml -f online/docker-compose.online.yml ps` |
| Se log | `... logs -f api` |
| Tag backup nu | `SOLSELSKABET_DIR=$PWD /usr/local/bin/solselskabet-backup` |
| Gendan database | `... exec -T db pg_restore -U postgres -d gauzy --clean < /var/backups/solselskabet/database_<dato>.dump` |
