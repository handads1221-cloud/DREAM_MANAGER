create or replace function private.attendance_daily_code(target_date date)
returns text language sql immutable set search_path = '' as $$
  select 'SH-DRC-'
    || lpad(upper(to_hex((extract(year from target_date)::integer % 100))), 2, '0')
    || lpad(upper(to_hex(extract(month from target_date)::integer)), 2, '0')
    || lpad(upper(to_hex(extract(day from target_date)::integer)), 2, '0');
$$;
revoke all on function private.attendance_daily_code(date) from public, anon, authenticated;

create or replace function private.ensure_sunday_event(target_date date default ((now() at time zone 'Asia/Seoul')::date))
returns uuid language plpgsql security definer set search_path = '' as $$
declare event_uuid uuid; daily_code text; open_time timestamptz; close_time timestamptz;
begin
  daily_code := private.attendance_daily_code(target_date);
  open_time := target_date::timestamp at time zone 'Asia/Seoul';
  close_time := (target_date::timestamp + interval '1 day') at time zone 'Asia/Seoul';
  select id into event_uuid from public.attendance_events where service_date = target_date;
  if event_uuid is null then
    insert into public.attendance_events(service_date, title, guide_text, qr_token_hash, opens_at, closes_at)
    values(target_date, '주일예배', '당일 날짜 코드로 출석해 주세요.', encode(extensions.digest(daily_code, 'sha256'), 'hex'), open_time, close_time)
    returning id into event_uuid;
  else
    update public.attendance_events set guide_text='당일 날짜 코드로 출석해 주세요.', qr_token_hash=encode(extensions.digest(daily_code, 'sha256'), 'hex'), opens_at=open_time, closes_at=close_time where id=event_uuid;
  end if;
  insert into private.attendance_qr_tokens(event_id, token) values(event_uuid, daily_code)
  on conflict(event_id) do update set token=excluded.token, created_at=now();
  return event_uuid;
end;
$$;
revoke all on function private.ensure_sunday_event(date) from public, anon, authenticated;

create or replace function public.admin_refresh_attendance_qr(target_date date)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if private.current_app_role() <> 'admin' then raise exception 'forbidden'; end if;
  perform private.ensure_sunday_event(target_date);
  return private.attendance_daily_code(target_date);
end;
$$;
revoke all on function public.admin_refresh_attendance_qr(date) from public, anon;
grant execute on function public.admin_refresh_attendance_qr(date) to authenticated;

create or replace function public.submit_qr_attendance(raw_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare selected_event uuid; selected_student uuid; today_kst date := (now() at time zone 'Asia/Seoul')::date; expected_code text;
begin
  if private.current_app_role() <> 'student' then raise exception 'student account required'; end if;
  select id into selected_student from public.students where profile_id=(select auth.uid()) and is_active limit 1;
  if selected_student is null then raise exception 'student profile not linked'; end if;
  expected_code := private.attendance_daily_code(today_kst);
  if upper(trim(raw_token)) <> expected_code then raise exception 'invalid daily qr'; end if;
  selected_event := private.ensure_sunday_event(today_kst);
  insert into public.attendance_records(event_id, student_id, status, method, checked_by)
  values(selected_event, selected_student, 'present', 'qr', (select auth.uid()))
  on conflict(event_id, student_id) do update set status='present', method='qr', checked_at=now(), checked_by=(select auth.uid());
  return '오늘 출석이 완료되었습니다.';
end;
$$;
revoke all on function public.submit_qr_attendance(text) from public, anon;
grant execute on function public.submit_qr_attendance(text) to authenticated;

select private.ensure_sunday_event((now() at time zone 'Asia/Seoul')::date);
