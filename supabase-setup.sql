-- Efficiency Tracker — full schema (fresh install, with user accounts)
-- Run once in Supabase Dashboard -> SQL Editor.
-- Also enable Email auth: Authentication -> Sign In / Up -> Email.

create table if not exists tasks (
  id uuid primary key,
  title text not null,
  category text default 'work',
  priority text default 'med',
  due date,
  done boolean default false,
  completed_at timestamptz,
  deleted boolean default false,
  user_id uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists sales (
  id uuid primary key,
  type text not null,
  client text,
  amount numeric,
  stages jsonb default '{}'::jsonb,
  deleted boolean default false,
  user_id uuid default auth.uid(),
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
  user_id uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists deadlines (
  id uuid primary key,
  title text not null,
  due date not null,
  done boolean default false,
  deleted boolean default false,
  user_id uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
alter table sales enable row level security;
alter table meetings enable row level security;
alter table deadlines enable row level security;

create policy "own tasks" on tasks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sales" on sales for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own meetings" on meetings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own deadlines" on deadlines for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_sales_user on sales(user_id);
create index if not exists idx_meetings_user on meetings(user_id);
create index if not exists idx_deadlines_user on deadlines(user_id);

create table if not exists user_settings (
  user_id uuid primary key default auth.uid(),
  ai_provider text,
  ai_key text,
  ai_model text,
  ai_base text,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
create policy "own settings" on user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
