-- Migration: per-user accounts (run once on an existing project)
alter table tasks add column if not exists user_id uuid default auth.uid();
alter table sales add column if not exists user_id uuid default auth.uid();
alter table meetings add column if not exists user_id uuid default auth.uid();
alter table deadlines add column if not exists user_id uuid default auth.uid();

drop policy if exists "anon all tasks" on tasks;
drop policy if exists "anon all sales" on sales;
drop policy if exists "anon all meetings" on meetings;
drop policy if exists "anon all deadlines" on deadlines;

create policy "own tasks" on tasks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sales" on sales for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own meetings" on meetings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own deadlines" on deadlines for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_sales_user on sales(user_id);
create index if not exists idx_meetings_user on meetings(user_id);
create index if not exists idx_deadlines_user on deadlines(user_id);

-- Sales deal-stage checklist
alter table sales add column if not exists stages jsonb default '{}'::jsonb;

-- Per-account app settings (AI provider/key/model), private via RLS
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
