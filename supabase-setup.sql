-- Efficiency Tracker — Supabase schema setup
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.

create table if not exists tasks (
  id uuid primary key,
  title text not null,
  category text default 'work',        -- work | sales
  priority text default 'med',         -- high | med | low
  due date,
  done boolean default false,
  completed_at timestamptz,
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sales (
  id uuid primary key,
  type text not null,                  -- call | follow_up | proposal | meeting | closed | lost
  client text,
  amount numeric,
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists meetings (
  id uuid primary key,
  title text not null,
  "when" timestamptz not null,
  with_who text,
  done boolean default false,
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists deadlines (
  id uuid primary key,
  title text not null,
  due date not null,
  done boolean default false,
  deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_tasks_done on tasks(done) where not deleted;
create index if not exists idx_sales_created on sales(created_at);
create index if not exists idx_meetings_when on meetings("when");
create index if not exists idx_deadlines_due on deadlines(due) where not done;

-- Row Level Security.
-- Single-user setup: the app uses your anon key, so we allow anon access.
-- If you later add Supabase Auth, replace these with per-user policies.
alter table tasks enable row level security;
alter table sales enable row level security;
alter table meetings enable row level security;
alter table deadlines enable row level security;

create policy "anon all tasks"     on tasks     for all using (true) with check (true);
create policy "anon all sales"     on sales     for all using (true) with check (true);
create policy "anon all meetings"  on meetings  for all using (true) with check (true);
create policy "anon all deadlines" on deadlines for all using (true) with check (true);
