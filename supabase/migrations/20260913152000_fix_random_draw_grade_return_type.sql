create or replace function public.draw_random_student(
  target_grade integer default null,
  excluded_student_ids uuid[] default array[]::uuid[],
  prevent_daily_duplicate boolean default true
)
returns table (
  result_id uuid,
  student_id uuid,
  full_name text,
  grade integer,
  draw_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  inserted_id uuid;
begin
  if (select auth.uid()) is null or (select private.current_app_role()) <> 'admin' then
    raise exception 'forbidden';
  end if;

  if target_grade is not null and target_grade not between 1 and 6 then
    raise exception 'invalid grade';
  end if;

  if prevent_daily_duplicate then
    perform pg_advisory_xact_lock(hashtextextended('dream-random-draw:' || today_kst::text, 0));
  end if;

  select s.*
  into selected_student
  from public.students s
  where s.is_active = true
    and (target_grade is null or s.grade = target_grade)
    and not (s.id = any(coalesce(excluded_student_ids, array[]::uuid[])))
    and (
      not prevent_daily_duplicate
      or not exists (
        select 1
        from public.random_draw_results previous
        where previous.draw_date = today_kst
          and previous.student_id = s.id
      )
    )
  order by random()
  limit 1;

  if selected_student.id is null then
    raise exception 'no eligible students';
  end if;

  insert into public.random_draw_results (student_id, draw_date, drawn_by, prevent_duplicate)
  values (selected_student.id, today_kst, (select auth.uid()), prevent_daily_duplicate)
  returning id into inserted_id;

  return query select inserted_id, selected_student.id, selected_student.full_name,
    selected_student.grade::integer, today_kst;
end;
$$;

revoke all on function public.draw_random_student(integer, uuid[], boolean) from public, anon;
grant execute on function public.draw_random_student(integer, uuid[], boolean) to authenticated;
