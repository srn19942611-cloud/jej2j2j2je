# Kør det hele gratis til en demo

Der er to gratis måder at få Gauzy (kontoret) og feltappen til at køre live med samme data.

## A) GitHub Codespaces – anbefalet (ingen installation, virker på telefonen)

Et Codespace er en gratis computer i skyen, som GitHub starter direkte fra dit repo. Med en personlig GitHub-konto følger der et gratis antal timer med hver måned, og det rækker rigeligt til en demo.

**Sådan gør du (ca. 15 minutter, første gang):**

1. Gå til repoet på github.com, og skift branch til **`ccr-39deed5b-s9z3s0`**.
2. Tryk på den grønne knap **Code** → fanen **Codespaces** → **⋯ → New with options**.
   - Vælg **Machine type: 4-core** (Gauzy skal bruge 8 GB RAM).
   - Tryk **Create codespace**.
3. Der åbnes et VS Code-vindue i browseren. Opsætningen starter af sig selv i terminalen nederst og tager 10–15 minutter første gang. Når den er færdig, står adresser og adgangskoder i terminalen. De gemmes også i `solselskabet-gauzy/codespace/ADGANGSKODER.txt`.
4. **Gør adressen offentlig, hvis det ikke er sket automatisk.** Det er nødvendigt, for at telefoner og andre kan åbne den. Gå til fanen **PORTS**, højreklik på port **8080**, og vælg **Port Visibility → Public**.
5. Åbn adressen. Den ligner `https://<navn>-8080.app.github.dev`.
   - **Gauzy (kontoret):** selve adressen
   - **Feltappen:** adressen + `/felt/`
   - **Tilbud for lokation 3:** adressen + `/felt/#tilbud/3`

**Vigtigt:**
- **Det lukker ned efter 30 minutter uden aktivitet.** Ændr det før mødet: github.com → Settings → Codespaces → **Default idle timeout**, fx 240 minutter. Åbn codespacet en halv time før mødet. Den anden start tager kun 2–3 minutter, og data er der stadig.
- **Første besøg kan give en advarsel.** Første gang adressen åbnes, kan GitHub vise en side med "Du er ved at åbne en port i et codespace". Tryk **Continue**.
- **Stop det efter mødet.** Brug github.com/codespaces → **⋯ → Stop** eller **Delete**, så du ikke bruger af de gratis timer.

## B) På din egen computer

Det kræver:

- **Docker:** Docker Desktop er kun gratis til privat brug og små virksomheder. På en Coop-pc skal I bruge en betalt licens eller det gratis alternativ **Rancher Desktop**.
- **Node.js 18** eller nyere.
- **Git Bash** på Windows.

```bash
cd solselskabet-gauzy
./start.sh
```

Første start tager 10–15 minutter.

- **Kontor (Gauzy):** http://localhost:4200. Log ind som `admin@ever.co` / `admin`, og vælg *Coop × Solselskabet* øverst til højre.
- **Feltapp:** http://localhost:8080, eller `http://<pc-ens-ip>:8080` på telefonen, som skal være på samme wifi. Gæste- og firma-wifi blokerer ofte for det.

## C) Kun feltappen og tilbud (allerede online)

https://solselskabet-demo.vercel.app kører uden server. Data gemmes kun i den browser, man bruger, og Gauzy-kontoret er ikke med.
