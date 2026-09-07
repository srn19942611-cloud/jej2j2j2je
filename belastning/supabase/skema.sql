-- Belastningsoversigt for Coop-butikker – skema til Lovable Cloud (Supabase/Postgres).
-- Kør denne fil først, derefter seed-katalog.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- referencedata
create table if not exists katalog (
  id                text primary key,              -- BU5, SL11, K3 ...
  navn              text not null,
  afdeling          text not null,
  rum               text not null check (rum in ('salg','slagter','lager','personale','teknik','udv','tag')),
  kategori          text not null check (kategori in ('koel','lys','it','maskine','stik','hvac','pv')),
  kw                numeric not null,
  spaending         int  not null check (spaending in (230,400)),
  cosphi            numeric not null,
  df                numeric not null,
  karakteristik     text not null check (karakteristik in ('B','C','D')),
  rcd               text not null default '30 mA A',
  noedforsyning     boolean not null default false,
  bimaaler          boolean not null default false,
  varmeafgivelse    numeric not null default 0.4,   -- andel af effekt der bliver til varme i salgslokalet
  tavle             text not null default 'HT01',
  tilvalg           text,                           -- null = altid med
  skalering_type    text not null,
  skalering_vaerdi  numeric,
  amp_datablad      numeric,
  leverandoer       text,
  plankoder         text[] not null default '{}',
  kilde             text,
  note              text,
  aktiv             boolean not null default true,
  opdateret         timestamptz not null default now()
);
comment on table katalog is 'Fælles udstyrskatalog med el-data og skaleringsregler. Redigeres centralt, ikke pr. projekt.';

create table if not exists butikstyper (
  navn          text primary key,
  salgsareal    int, lagerareal int, ovrigtareal int,
  kasser        int, sco int,
  tilvalg       text[] not null default '{}'
);

create table if not exists referencemaalinger (
  id        uuid primary key default gen_random_uuid(),
  butik     text not null,
  salgsareal int not null,
  peak_a    numeric not null,          -- målt 15-minutters peak
  maalt_dato date,
  kilde     text,
  note      text
);
comment on table referencemaalinger is 'Grundlaget for at vælge ampererettighed. Udbyg med hver ny butik, der får målt sit forbrug.';

-- ---------------------------------------------------------------- projekter
create table if not exists projekter (
  id             uuid primary key default gen_random_uuid(),
  navn           text not null,
  butikstype     text references butikstyper(navn),
  sagsnr         text,
  adresse        text,
  status         text not null default 'kladde' check (status in ('kladde','til_review','godkendt','bestilt')),
  stamdata       jsonb not null default '{}'::jsonb,   -- arealer, tilvalg, tekniske forudsætninger
  valgt_hovedsikring int,
  ejer           uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists forbrugere (
  id             uuid primary key default gen_random_uuid(),
  projekt_id     uuid not null references projekter(id) on delete cascade,
  katalog_id     text references katalog(id),
  sort_index     int not null default 0,
  aktiv          boolean not null default true,
  tavle          text not null default 'HT01',
  afdeling       text not null,
  rum            text not null default 'salg',
  gruppe         text not null,
  navn           text not null,
  antal          numeric not null default 1,
  kw             numeric not null,
  spaending      int not null,
  cosphi         numeric not null default 0.9,
  df             numeric not null default 0.6,
  karakteristik  text not null default 'C',
  rcd            text not null default '30 mA A',
  noedforsyning  boolean not null default false,
  bimaaler       boolean not null default false,
  varmeafgivelse numeric not null default 0.4,
  kategori       text not null default 'maskine',
  laengde        numeric not null default 25,
  grupper        int,      -- null = auto
  mcb            int,      -- null = auto
  mm2            numeric,  -- null = auto
  kilde          text not null default 'Skaleret erfaring'
                 check (kilde in ('Tegning','Datablad','Maskinliste','Byggeprogram','Referencetavle','Skaleret erfaring','Manuel')),
  note           text
);
create index if not exists forbrugere_projekt_idx on forbrugere(projekt_id);
comment on column forbrugere.kilde is 'Sporbarhed: hvor tallet kommer fra. Vises i Excel-eksporten og styrer, hvad der må stoles på.';

-- ---------------------------------------------------------------- tegninger
create table if not exists tegninger (
  id           uuid primary key default gen_random_uuid(),
  projekt_id   uuid not null references projekter(id) on delete cascade,
  filnavn      text not null,
  storage_sti  text not null,           -- bucket: tegninger
  side         int not null default 1,
  status       text not null default 'uploadet' check (status in ('uploadet','udtrukket','godkendt','fejlet')),
  optaelling   jsonb,                   -- rå svar fra vision-kaldet
  bemaerkninger text,
  created_at   timestamptz not null default now()
);

-- Lærte kodemappinger: bekræftes én gang, genbruges på tværs af projekter.
create table if not exists kode_mapping (
  id                uuid primary key default gen_random_uuid(),
  kode              text not null,
  projekt_id        uuid references projekter(id) on delete cascade,  -- null = gælder alle projekter
  katalog_id        text references katalog(id),                      -- null = "ingen el"
  antal_pr_forekomst numeric not null default 1,
  bekraeftet_af     uuid references auth.users(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (kode, projekt_id)
);

-- ---------------------------------------------------------------- historik
create table if not exists revisioner (
  id          uuid primary key default gen_random_uuid(),
  projekt_id  uuid not null references projekter(id) on delete cascade,
  snapshot    jsonb not null,           -- {stamdata, forbrugere, resultat}
  note        text,
  oprettet_af uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table projekter    enable row level security;
alter table forbrugere   enable row level security;
alter table tegninger    enable row level security;
alter table kode_mapping enable row level security;
alter table revisioner   enable row level security;
alter table katalog      enable row level security;
alter table butikstyper  enable row level security;
alter table referencemaalinger enable row level security;

-- Referencedata: alle indloggede må læse, kun redigere hvis de er logget ind (juster til jeres rollemodel).
create policy "laes referencedata" on katalog for select to authenticated using (true);
create policy "ret referencedata"  on katalog for all    to authenticated using (true) with check (true);
create policy "laes butikstyper"   on butikstyper for select to authenticated using (true);
create policy "laes maalinger"     on referencemaalinger for select to authenticated using (true);
create policy "ret maalinger"      on referencemaalinger for all to authenticated using (true) with check (true);

-- Projekter deles i afdelingen: alle indloggede kan se og redigere. Stram op med et team-id, hvis det kræves.
create policy "projekter" on projekter for all to authenticated using (true) with check (true);
create policy "forbrugere" on forbrugere for all to authenticated using (true) with check (true);
create policy "tegninger" on tegninger for all to authenticated using (true) with check (true);
create policy "kode_mapping" on kode_mapping for all to authenticated using (true) with check (true);
create policy "revisioner" on revisioner for all to authenticated using (true) with check (true);

-- updated_at
create or replace function sæt_opdateret() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists projekter_opdateret on projekter;
create trigger projekter_opdateret before update on projekter
for each row execute function sæt_opdateret();
