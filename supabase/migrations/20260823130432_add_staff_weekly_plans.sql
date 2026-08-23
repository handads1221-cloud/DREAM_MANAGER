create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  schedule_time time,
  title text not null check (char_length(title) between 1 and 120),
  details text not null default '' check (char_length(details) <= 5000),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists weekly_plans_schedule_date_idx on public.weekly_plans(schedule_date, schedule_time);
alter table public.weekly_plans enable row level security;
create policy weekly_plans_staff_select on public.weekly_plans for select to authenticated using (private.current_app_role() in ('admin','teacher'));
create policy weekly_plans_staff_insert on public.weekly_plans for insert to authenticated with check (private.current_app_role() in ('admin','teacher') and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy weekly_plans_staff_update on public.weekly_plans for update to authenticated using (private.current_app_role() in ('admin','teacher')) with check (private.current_app_role() in ('admin','teacher') and updated_by = (select auth.uid()));
create policy weekly_plans_staff_delete on public.weekly_plans for delete to authenticated using (private.current_app_role() in ('admin','teacher'));
grant select, insert, update, delete on public.weekly_plans to authenticated;
