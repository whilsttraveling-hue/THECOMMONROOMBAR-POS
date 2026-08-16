-- Paste this whole file into Supabase → SQL Editor → New query → Run

create table menu (
  id text primary key default 'singleton',
  value jsonb not null default '[]',
  updated_at timestamptz default now()
);

create table tabs (
  id text primary key default 'singleton',
  value jsonb not null default '[]',
  updated_at timestamptz default now()
);

create table history (
  id text primary key default 'singleton',
  value jsonb not null default '[]',
  updated_at timestamptz default now()
);

-- Allow the app (using the public anon key) to read and write these tables.
-- This is fine for a small internal team tool with PIN login in the app itself;
-- it is not per-user row security, so don't put anything beyond bar data in these tables.
alter table menu enable row level security;
alter table tabs enable row level security;
alter table history enable row level security;

create policy "public read/write menu" on menu for all using (true) with check (true);
create policy "public read/write tabs" on tabs for all using (true) with check (true);
create policy "public read/write history" on history for all using (true) with check (true);
