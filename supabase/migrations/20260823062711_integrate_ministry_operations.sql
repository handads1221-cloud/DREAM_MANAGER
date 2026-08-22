create table public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null default '보호자',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (student_id, parent_id)
);
create index student_guardians_parent_idx on public.student_guardians(parent_id, student_id);

alter table public.student_guardians enable row level security;
grant select, insert, update, delete on public.student_guardians to authenticated;
revoke all on public.student_guardians from anon;

create policy student_guardians_select on public.student_guardians for select to authenticated using (
  private.current_app_role() = 'admin'
  or parent_id = (select auth.uid())
  or exists (select 1 from public.students s where s.id = student_id and s.profile_id = (select auth.uid()))
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id))
);
create policy student_guardians_admin_insert on public.student_guardians for insert to authenticated with check (private.current_app_role() = 'admin');
create policy student_guardians_admin_update on public.student_guardians for update to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');
create policy student_guardians_admin_delete on public.student_guardians for delete to authenticated using (private.current_app_role() = 'admin');

create or replace function private.is_linked_parent(student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.student_guardians
    where parent_id = (select auth.uid()) and student_id = student
  )
$$;

create or replace function private.is_assigned_teacher(student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.teacher_assignments ta
    join public.students s on s.id = student
    where ta.teacher_id = (select auth.uid())
      and ta.grade = s.grade
      and (ta.class_name = '전체' or ta.class_name = coalesce(s.class_name, '전체'))
      and ta.school_year = extract(year from current_date)::integer
  )
$$;

drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated using (
  private.current_app_role() = 'admin'
  or profile_id = (select auth.uid())
  or private.is_linked_parent(id)
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(id))
);

alter table public.attendance_records drop constraint if exists attendance_records_student_id_fkey;
alter table public.attendance_records add constraint attendance_records_student_id_fkey foreign key (student_id) references public.students(id) on delete cascade;
alter table public.point_transactions drop constraint if exists point_transactions_student_id_fkey;
alter table public.point_transactions add constraint point_transactions_student_id_fkey foreign key (student_id) references public.students(id) on delete cascade;

drop policy if exists attendance_records_select on public.attendance_records;
drop policy if exists attendance_records_staff_insert on public.attendance_records;
drop policy if exists attendance_records_staff_update on public.attendance_records;
create policy attendance_records_select on public.attendance_records for select to authenticated using (
  private.current_app_role() = 'admin'
  or student_id in (select id from public.students where profile_id = (select auth.uid()))
  or private.is_linked_parent(student_id)
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id))
);
create policy attendance_records_staff_insert on public.attendance_records for insert to authenticated with check (
  private.current_app_role() = 'admin'
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id) and checked_by = (select auth.uid()))
);
create policy attendance_records_staff_update on public.attendance_records for update to authenticated
using (private.current_app_role() = 'admin' or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id)))
with check (private.current_app_role() = 'admin' or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id)));

drop policy if exists point_transactions_select on public.point_transactions;
drop policy if exists point_transactions_staff_insert on public.point_transactions;
create policy point_transactions_select on public.point_transactions for select to authenticated using (
  private.current_app_role() = 'admin'
  or student_id in (select id from public.students where profile_id = (select auth.uid()))
  or private.is_linked_parent(student_id)
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id))
);
create policy point_transactions_staff_insert on public.point_transactions for insert to authenticated with check (
  (private.current_app_role() = 'admin' and awarded_by = (select auth.uid()))
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id) and awarded_by = (select auth.uid()))
);

drop view if exists public.student_point_balances;
create view public.student_point_balances with (security_invoker = true) as
select s.id as student_id, s.full_name, s.grade, s.class_name, coalesce(sum(pt.amount), 0)::bigint as balance
from public.students s left join public.point_transactions pt on pt.student_id = s.id
where s.is_active
group by s.id, s.full_name, s.grade, s.class_name;
grant select on public.student_point_balances to authenticated;

create table private.attendance_qr_tokens (
  event_id uuid primary key references public.attendance_events(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
revoke all on private.attendance_qr_tokens from public, anon, authenticated;

create or replace function private.ensure_sunday_event(target_date date default ((now() at time zone 'Asia/Seoul')::date))
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  event_uuid uuid;
  raw_token text;
  open_time timestamptz;
  close_time timestamptz;
begin
  if extract(isodow from target_date) <> 7 then
    target_date := target_date + (7 - extract(isodow from target_date))::integer;
  end if;
  open_time := (target_date::timestamp + time '06:00') at time zone 'Asia/Seoul';
  close_time := (target_date::timestamp + time '13:30') at time zone 'Asia/Seoul';
  select id into event_uuid from public.attendance_events where service_date = target_date;
  if event_uuid is null then
    raw_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.attendance_events(service_date, title, guide_text, qr_token_hash, opens_at, closes_at)
    values(target_date, '주일예배', '예배 전 QR을 촬영해 출석해 주세요.', encode(extensions.digest(raw_token, 'sha256'), 'hex'), open_time, close_time)
    returning id into event_uuid;
    insert into private.attendance_qr_tokens(event_id, token) values(event_uuid, raw_token);
  end if;
  return event_uuid;
end;
$$;
revoke all on function private.ensure_sunday_event(date) from public, anon, authenticated;

create or replace function public.admin_get_attendance_qr(target_date date default ((now() at time zone 'Asia/Seoul')::date))
returns table(event_id uuid, service_date date, title text, guide_text text, token text, opens_at timestamptz, closes_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare selected_event uuid;
begin
  if private.current_app_role() <> 'admin' then raise exception 'forbidden'; end if;
  selected_event := private.ensure_sunday_event(target_date);
  return query select e.id, e.service_date, e.title, e.guide_text, q.token, e.opens_at, e.closes_at
  from public.attendance_events e join private.attendance_qr_tokens q on q.event_id = e.id where e.id = selected_event;
end;
$$;
revoke all on function public.admin_get_attendance_qr(date) from public, anon;
grant execute on function public.admin_get_attendance_qr(date) to authenticated;

create or replace function public.admin_refresh_attendance_qr(target_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare selected_event uuid; raw_token text;
begin
  if private.current_app_role() <> 'admin' then raise exception 'forbidden'; end if;
  selected_event := private.ensure_sunday_event(target_date);
  raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  update public.attendance_events set qr_token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') where id = selected_event;
  insert into private.attendance_qr_tokens(event_id, token) values(selected_event, raw_token)
  on conflict(event_id) do update set token = excluded.token, created_at = now();
  return raw_token;
end;
$$;
revoke all on function public.admin_refresh_attendance_qr(date) from public, anon;
grant execute on function public.admin_refresh_attendance_qr(date) to authenticated;

create or replace function public.submit_qr_attendance(raw_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare selected_event uuid; selected_student uuid;
begin
  if private.current_app_role() <> 'student' then raise exception 'student account required'; end if;
  select id into selected_student from public.students where profile_id = (select auth.uid()) and is_active limit 1;
  if selected_student is null then raise exception 'student profile not linked'; end if;
  select e.id into selected_event
  from private.attendance_qr_tokens q join public.attendance_events e on e.id = q.event_id
  where q.token = raw_token and now() between e.opens_at and e.closes_at limit 1;
  if selected_event is null then raise exception 'invalid or expired qr'; end if;
  insert into public.attendance_records(event_id, student_id, status, method, checked_by)
  values(selected_event, selected_student, 'present', 'qr', (select auth.uid()))
  on conflict(event_id, student_id) do update set status='present', method='qr', checked_at=now(), checked_by=(select auth.uid());
  return '출석이 완료되었습니다.';
end;
$$;
revoke all on function public.submit_qr_attendance(text) from public, anon;
grant execute on function public.submit_qr_attendance(text) to authenticated;

select private.ensure_sunday_event();

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'dream-sunday-attendance-event',
  '0 15 * * 6',
  $$select private.ensure_sunday_event(((now() at time zone 'Asia/Seoul')::date + 1));$$
);
