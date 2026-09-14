create table public.random_draw_exclusions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, student_id)
);

alter table public.random_draw_exclusions enable row level security;

revoke all on table public.random_draw_exclusions from anon, authenticated;
grant select, insert, delete on table public.random_draw_exclusions to authenticated;

create policy random_draw_exclusions_own_select
on public.random_draw_exclusions for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_app_role()) = 'admin'
);

create policy random_draw_exclusions_own_insert
on public.random_draw_exclusions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.current_app_role()) = 'admin'
);

create policy random_draw_exclusions_own_delete
on public.random_draw_exclusions for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_app_role()) = 'admin'
);
