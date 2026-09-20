create or replace function public.get_shared_birthdays()
returns table (
  person_id uuid,
  full_name text,
  person_type text,
  month_day text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, 'student'::text, to_char(s.birth_date, 'MM-DD')
  from public.students s
  where s.is_active = true
    and s.birth_date is not null
    and exists (
      select 1 from public.profiles caller
      where caller.id = (select auth.uid())
        and caller.is_active = true
        and caller.account_status = 'active'
    )
  union all
  select p.id, p.full_name, 'teacher'::text, to_char(p.birth_date, 'MM-DD')
  from public.profiles p
  where p.is_active = true
    and p.account_status = 'active'
    and p.birth_date is not null
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.role = 'teacher'
    )
    and exists (
      select 1 from public.profiles caller
      where caller.id = (select auth.uid())
        and caller.is_active = true
        and caller.account_status = 'active'
    )
  order by 4, 2;
$$;

revoke all on function public.get_shared_birthdays() from public, anon;
grant execute on function public.get_shared_birthdays() to authenticated;
