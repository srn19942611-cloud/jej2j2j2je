# Datamodel

## Kilder bag datagrundlaget

| Fil | Indhold | Stammer fra |
|---|---|---|
| `data/katalog.json` | 79 udstyrsposter med kW, spænding, cos φ, samtidighed, RCD-krav, varmeafgivelse og skaleringsregel | Effektoversigt Rask Mølle (08-07-2026), Mariannes SB-effektoversigt (27-01-2026), slagter-maskinliste (FDB, maj 2018 / rev. jan 2025), byggeprogram |
| `data/butikstyper.json` | Skabeloner for Dagli'Brugsen, SuperBrugsen, Kvickly, 365discount + tilvalgsliste | Erfaringstal |
| `data/tabeller.json` | MCB-række, kabeltabel, samtidighedsfaktorer, byggeprogramkrav, konstanter | DS/HD 60364, byggeprogram, ark "Samtidighedsfaktorer" |
| `data/plansymboler.json` | Ordbog fra tegningstekst til katalogpost | Plantegning 2251110-7 + maskinlister |
| `data/referencer.json` | Målte peak-strømme og referencesagen Rask Mølle | Målinger SB Dragør, Brugsen Søby, Rask Mølle |

## Objekter

### Katalogpost (fælles, redigeres centralt)
`id · navn · afdeling · rum · kategori · kw · spaending · cosphi · df · karakteristik ·
rcd · noedforsyning · bimaaler · varmeAfgivelse · tavle · tilvalg · skalering ·
ampDatablad · leverandoer · plankoder · kilde · note`

- **rum** (`salg`, `slagter`, `lager`, `personale`, `teknik`, `udv`, `tag`) styrer, om
  varmeafgivelsen tæller med i komfortkøl-beregningen.
- **kategori** (`koel`, `lys`, `it`, `maskine`, `stik`, `hvac`, `pv`) styrer gruppedannelse
  og om der bruges motorfaktor ved valg af afbryder.
- **skalering** angiver, hvordan antal eller kW udledes af stamdata:
  `fast`, `m2salg`, `m2lager`, `kasser`, `sco`, `wm2salg`, `wm2lager`, `kwm2salg`,
  `ladestander`, `pv`.
- **tilvalg** kobler posten til en afdeling, der kan slås til/fra (deli, bake-off, slagter,
  central køl, varmepumpe, flaskeautomat, elevator, ladestander, sprinkler, solceller).

### Stamdata (pr. projekt)
Arealer (salg, lager, øvrigt), antal kasser og SCO, tilvalg, samt de tekniske
forudsætninger: installationsmetode, motorfaktor, maks. spændingsfald, kortslutningsstrøm
ved hovedtavlen, buffer på hovedsikring, krævet tavlereserve, køleydelse i ventilations-
aggregatet og komfortkøl-faktorerne.

### Forbruger (pr. projekt, én række i effektlisten)
Samme felter som katalogposten plus `antal`, `laengde`, `grupper`, `mcb`, `mm2` (alle tre
kan være `null` = beregn automatisk) og `kilde`. **`kilde` er obligatorisk** — det er
forskellen på et tal, der kan forsvares over for en leverandør, og et gæt.

### Beregnet forbruger (afledt, gemmes ikke)
Installeret og belastet kW, strøm pr. gruppe, valgt MCB, tværsnit, I_z, spændingsfald,
I_k, I_a, kabelbetegnelse, modulforbrug og statusflag pr. krav.

## Database

Se `supabase/skema.sql`. Tabeller: `katalog`, `butikstyper`, `referencemaalinger`,
`projekter`, `forbrugere`, `tegninger`, `kode_mapping`, `revisioner`.

To ting adskiller den fra en almindelig CRUD-model:

1. **`kode_mapping`** gør systemet lærende: en bekræftet tolkning af en tegningskode
   genbruges på tværs af projekter.
2. **`revisioner`** gemmer et snapshot af stamdata + forbrugere + resultat, hver gang en
   oversigt sendes til en leverandør. Så kan man altid svare på, hvad der lå til grund
   for den bestilte tavle.
