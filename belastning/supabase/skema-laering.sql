-- Indlæsning af filer og feedbackloop. Køres efter skema.sql.

-- ---------------------------------------------------------------- dokumenter
create table if not exists dokumenter (
  id           uuid primary key default gen_random_uuid(),
  projekt_id   uuid not null references projekter(id) on delete cascade,
  filnavn      text not null,
  storage_sti  text not null,               -- bucket: dokumenter
  filtype      text not null check (filtype in ('maskinliste','effektoversigt','gruppeskema','datablad','plantegning','byggeprogram','ukendt')),
  status       text not null default 'uploadet' check (status in ('uploadet','laest','godkendt','afvist')),
  kolonnemapping jsonb,                     -- hvilke kolonner blev tolket hvordan
  raa_poster   jsonb,                       -- rækkerne som de blev læst
  bindinger    jsonb,                       -- forslag til binding mod katalog
  advarsler    text[] default '{}',
  laest_af     uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
comment on table dokumenter is 'Hver uploadet fil gemmes med både det rå udtræk og den tolkning, brugeren godkendte. Det er sporbarheden bag hvert tal — og datagrundlaget for at måle, hvor godt indlæsningen virker.';

-- ---------------------------------------------------------------- rettelser
create table if not exists rettelser (
  id            uuid primary key default gen_random_uuid(),
  projekt_id    uuid not null references projekter(id) on delete cascade,
  katalog_id    text not null references katalog(id),
  butikstype    text,
  salgsareal    int,
  felt          text not null,
  foer          jsonb,
  efter         jsonb,
  aarsag        text not null default 'ukendt'
                check (aarsag in ('datablad','tegning','maskinliste','erfaring','fejl_i_katalog','projektspecifikt','ukendt')),
  kun_denne_sag boolean not null default false,
  rettet_af     uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists rettelser_katalog_idx on rettelser(katalog_id, felt);
comment on table rettelser is 'Hver gang en bruger ændrer noget, modellen foreslog. Skrives automatisk ved gem — brugeren skal kun vælge årsag, hvis vedkommende vil.';

-- Aggregeret grundlag for forslag. Projektspecifikke felter holdes udenfor.
create or replace view rettelser_aggregeret as
select r.katalog_id,
       r.felt,
       count(*)                                   as observationer,
       count(distinct r.projekt_id)               as projekter,
       percentile_cont(0.5) within group (order by (r.efter #>> '{}')::numeric)
         filter (where jsonb_typeof(r.efter) = 'number')  as median_numerisk,
       mode() within group (order by r.efter #>> '{}')    as hyppigste_vaerdi,
       jsonb_object_agg(r.aarsag, 1)              as aarsager,
       max(r.created_at)                          as senest
from rettelser r
where not r.kun_denne_sag
  and r.felt not in ('antal','laengde','grupper')
group by r.katalog_id, r.felt;

-- ---------------------------------------------------------------- forslag og historik
create table if not exists katalog_forslag (
  id             uuid primary key default gen_random_uuid(),
  katalog_id     text not null references katalog(id),
  felt           text not null,
  nuvaerende     jsonb,
  foreslaaet     jsonb not null,
  observationer  int not null,
  projekter      int not null,
  spredning_pct  numeric,
  afvigelse_pct  numeric,
  anbefaling     text not null check (anbefaling in ('godkend','undersøg','afvent')),
  begrundelse    text,
  status         text not null default 'åben' check (status in ('åben','godkendt','afvist','udskudt')),
  behandlet_af   uuid references auth.users(id),
  behandlet_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (katalog_id, felt, status) deferrable initially deferred
);

create table if not exists katalog_historik (
  id           uuid primary key default gen_random_uuid(),
  katalog_id   text not null,
  felt         text not null,
  foer         jsonb,
  efter        jsonb,
  begrundelse  text,
  aendret_af   uuid references auth.users(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
comment on table katalog_historik is 'Fuld sporbarhed på ændringer i dimensioneringsdata. En bestilt tavle skal altid kunne forklares ud fra de værdier, der gjaldt på bestillingstidspunktet.';

-- Varianter pr. butikstype, når rettelserne ikke peger på én fælles værdi.
create table if not exists katalog_override (
  id          uuid primary key default gen_random_uuid(),
  katalog_id  text not null references katalog(id),
  butikstype  text not null references butikstyper(navn),
  felt        text not null,
  vaerdi      jsonb not null,
  begrundelse text,
  created_at  timestamptz not null default now(),
  unique (katalog_id, butikstype, felt)
);

-- ---------------------------------------------------------------- kalibrering
create table if not exists kalibrering (
  id          uuid primary key default gen_random_uuid(),
  projekt_id  uuid references projekter(id) on delete set null,
  butik       text not null,
  butikstype  text,
  salgsareal  int not null,
  beregnet_a  numeric not null,        -- maks. fasestrøm fra beregningen
  maalt_peak_a numeric not null,       -- målt 15-minutters peak efter idriftsættelse
  maalt_dato  date,
  kilde       text,
  note        text,
  created_at  timestamptz not null default now()
);
comment on table kalibrering is 'Loopet der lukker: målt forbrug mod beregnet. Hver ny måling gør referenceintervallet for ampererettighed skarpere.';

create or replace view kalibrering_noegletal as
select coalesce(butikstype, 'alle') as butikstype,
       count(*) as antal,
       round(percentile_cont(0.5) within group (order by maalt_peak_a / beregnet_a)::numeric, 2) as faktor,
       round(min(maalt_peak_a / salgsareal)::numeric, 3) as a_pr_m2_min,
       round(percentile_cont(0.5) within group (order by maalt_peak_a / salgsareal)::numeric, 3) as a_pr_m2_median,
       round(max(maalt_peak_a / salgsareal)::numeric, 3) as a_pr_m2_maks
from kalibrering
group by rollup (butikstype);

-- ---------------------------------------------------------------- kvalitet i tegningsudtræk
create table if not exists udtraek_praecision (
  id          uuid primary key default gen_random_uuid(),
  tegning_id  uuid references tegninger(id) on delete cascade,
  kode        text not null,
  laest       numeric not null,        -- vision-modellens tal
  bekraeftet  numeric not null,        -- brugerens tal efter review
  created_at  timestamptz not null default now()
);

create or replace view udtraek_faldgruber as
select kode,
       count(*) as forekomster,
       round(avg((bekraeftet - laest) / greatest(laest, 1))::numeric, 3) as gns_afvigelse,
       round((count(*) filter (where laest = bekraeftet))::numeric / count(*), 2) as raet_foerste_gang
from udtraek_praecision
group by kode
having count(*) >= 3
order by abs(avg((bekraeftet - laest) / greatest(laest, 1))) desc;
comment on view udtraek_faldgruber is 'Koder, hvor tegningsudtrækket systematisk rammer forkert. Linjerne herfra lægges ind i vision-prompten som kendte faldgruber, så udtrækket bliver bedre af sig selv.';

-- ---------------------------------------------------------------- automatik
-- Log alle ændringer i katalogets dimensioneringsdata.
create or replace function log_katalog_aendring() returns trigger language plpgsql as $$
declare felt text; felter text[] := array['kw','spaending','cosphi','df','karakteristik','rcd','varmeafgivelse','noedforsyning','skalering_vaerdi'];
begin
  foreach felt in array felter loop
    if to_jsonb(old) -> felt is distinct from to_jsonb(new) -> felt then
      insert into katalog_historik (katalog_id, felt, foer, efter, begrundelse)
      values (new.id, felt, to_jsonb(old) -> felt, to_jsonb(new) -> felt, 'Ændret via katalogredigering');
    end if;
  end loop;
  new.opdateret := now();
  return new;
end $$;
drop trigger if exists katalog_historik_trigger on katalog;
create trigger katalog_historik_trigger before update on katalog
for each row execute function log_katalog_aendring();

-- ---------------------------------------------------------------- RLS
alter table dokumenter        enable row level security;
alter table rettelser         enable row level security;
alter table katalog_forslag   enable row level security;
alter table katalog_historik  enable row level security;
alter table katalog_override  enable row level security;
alter table kalibrering       enable row level security;
alter table udtraek_praecision enable row level security;

create policy "dokumenter" on dokumenter for all to authenticated using (true) with check (true);
create policy "rettelser" on rettelser for all to authenticated using (true) with check (true);
create policy "forslag" on katalog_forslag for all to authenticated using (true) with check (true);
create policy "historik laes" on katalog_historik for select to authenticated using (true);
create policy "override" on katalog_override for all to authenticated using (true) with check (true);
create policy "kalibrering" on kalibrering for all to authenticated using (true) with check (true);
create policy "praecision" on udtraek_praecision for all to authenticated using (true) with check (true);
