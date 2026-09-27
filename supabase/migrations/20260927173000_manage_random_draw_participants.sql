create or replace function public.sync_random_draw_exclusions_to_today_attendance()
returns table (attendee_count integer, excluded_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null or (select private.current_app_role()) <> 'admin' then
    raise exception 'forbidden';
  end if;

  delete from public.random_draw_exclusions
  where user_id = current_user_id;

  insert into public.random_draw_exclusions (user_id, student_id)
  select current_user_id, student.id
  from public.students student
  where student.is_active = true
    and not exists (
      select 1
      from public.attendance_events event
      join public.attendance_records record on record.event_id = event.id
      where event.service_date = today_kst
        and record.student_id = student.id
        and record.status in ('present', 'late', 'excused')
    );

  return query
  select
    count(*) filter (where exclusion.student_id is null)::integer,
    count(*) filter (where exclusion.student_id is not null)::integer
  from public.students student
  left join public.random_draw_exclusions exclusion
    on exclusion.user_id = current_user_id
   and exclusion.student_id = student.id
  where student.is_active = true;
end;
$$;

revoke all on function public.sync_random_draw_exclusions_to_today_attendance() from public, anon;
grant execute on function public.sync_random_draw_exclusions_to_today_attendance() to authenticated;

create or replace function public.reset_today_random_draw_results()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if (select auth.uid()) is null or (select private.current_app_role()) <> 'admin' then
    raise exception 'forbidden';
  end if;

  delete from public.random_draw_results
  where draw_date = (now() at time zone 'Asia/Seoul')::date;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reset_today_random_draw_results() from public, anon;
grant execute on function public.reset_today_random_draw_results() to authenticated;
