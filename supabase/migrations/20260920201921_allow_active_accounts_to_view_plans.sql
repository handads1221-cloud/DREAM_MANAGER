drop policy if exists weekly_plans_staff_select on public.weekly_plans;

create policy weekly_plans_active_account_select
on public.weekly_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and account_status = 'active'
  )
);
