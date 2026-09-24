alter table public.attendance_events
  add column if not exists is_statistics_excluded boolean not null default false,
  add column if not exists statistics_exclusion_reason text;

alter table public.attendance_events
  drop constraint if exists attendance_events_exclusion_reason_check;
alter table public.attendance_events
  add constraint attendance_events_exclusion_reason_check
  check (not is_statistics_excluded or nullif(btrim(statistics_exclusion_reason), '') is not null);

create index if not exists attendance_events_statistics_excluded_idx
  on public.attendance_events(service_date)
  where is_statistics_excluded;

create or replace function private.prevent_excluded_event_attendance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.attendance_events
    where id = new.event_id and is_statistics_excluded
  ) then
    raise exception 'attendance event excluded';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_excluded_event_attendance on public.attendance_records;
create trigger prevent_excluded_event_attendance
before insert or update of event_id, status on public.attendance_records
for each row execute function private.prevent_excluded_event_attendance();

create or replace function public.set_attendance_statistics_exclusion(target_date date, excluded boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event uuid;
  fixed_reason constant text := '전세대 이음으로 교회학교 별도 예배 없음';
begin
  if private.current_app_role() <> 'admin' then
    raise exception 'forbidden';
  end if;
  if extract(isodow from target_date) <> 7 then
    raise exception 'sunday required';
  end if;

  if excluded then
    insert into public.attendance_events (
      service_date, title, guide_text, qr_token_hash, opens_at, closes_at, created_by,
      is_statistics_excluded, statistics_exclusion_reason
    ) values (
      target_date, '예배 없음', fixed_reason,
      encode(extensions.digest('no-service:' || target_date::text, 'sha256'), 'hex'),
      (target_date::timestamp + time '00:00') at time zone 'Asia/Seoul',
      (target_date::timestamp + time '23:59:59') at time zone 'Asia/Seoul',
      (select auth.uid()), true, fixed_reason
    )
    on conflict (service_date) do update set
      title = '예배 없음',
      guide_text = fixed_reason,
      is_statistics_excluded = true,
      statistics_exclusion_reason = fixed_reason
    returning id into selected_event;

    delete from public.attendance_records where event_id = selected_event;
  else
    update public.attendance_events set
      title = '주일예배',
      guide_text = '예배 전 QR을 촬영해 출석해 주세요.',
      is_statistics_excluded = false,
      statistics_exclusion_reason = null
    where service_date = target_date;
  end if;
end;
$$;

revoke all on function public.set_attendance_statistics_exclusion(date, boolean) from public, anon;
grant execute on function public.set_attendance_statistics_exclusion(date, boolean) to authenticated;

create or replace function public.admin_get_attendance_qr(target_date date default ((now() at time zone 'Asia/Seoul')::date))
returns table(event_id uuid, service_date date, title text, guide_text text, token text, opens_at timestamptz, closes_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare selected_event uuid;
begin
  if private.current_app_role() <> 'admin' then raise exception 'forbidden'; end if;
  if exists (select 1 from public.attendance_events where service_date = target_date and is_statistics_excluded) then
    raise exception 'attendance event excluded';
  end if;
  selected_event := private.ensure_sunday_event(target_date);
  return query select e.id, e.service_date, e.title, e.guide_text, q.token, e.opens_at, e.closes_at
  from public.attendance_events e join private.attendance_qr_tokens q on q.event_id = e.id where e.id = selected_event;
end;
$$;

create or replace function public.admin_refresh_attendance_qr(target_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare selected_event uuid; raw_token text;
begin
  if private.current_app_role() <> 'admin' then raise exception 'forbidden'; end if;
  if exists (select 1 from public.attendance_events where service_date = target_date and is_statistics_excluded) then
    raise exception 'attendance event excluded';
  end if;
  selected_event := private.ensure_sunday_event(target_date);
  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  update public.attendance_events set qr_token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') where id = selected_event;
  insert into private.attendance_qr_tokens(event_id, token) values(selected_event, raw_token)
  on conflict(event_id) do update set token = excluded.token, created_at = now();
  return raw_token;
end;
$$;

create or replace function public.submit_qr_attendance(raw_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare selected_event uuid; selected_student uuid;
begin
  if private.current_app_role() <> 'student' then raise exception 'student account required'; end if;
  select id into selected_student from public.students where profile_id = (select auth.uid()) and is_active limit 1;
  if selected_student is null then raise exception 'student profile not linked'; end if;
  select e.id into selected_event
  from private.attendance_qr_tokens q join public.attendance_events e on e.id = q.event_id
  where q.token = raw_token and now() between e.opens_at and e.closes_at and not e.is_statistics_excluded limit 1;
  if selected_event is null then raise exception 'invalid or expired qr'; end if;
  insert into public.attendance_records(event_id, student_id, status, method, checked_by)
  values(selected_event, selected_student, 'present', 'qr', (select auth.uid()))
  on conflict(event_id, student_id) do update set status='present', method='qr', checked_at=now(), checked_by=(select auth.uid());
  return '출석이 완료되었습니다.';
end;
$$;
