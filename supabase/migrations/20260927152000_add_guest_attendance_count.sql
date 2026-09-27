alter table public.attendance_events
  add column if not exists guest_count integer not null default 0
  check (guest_count between 0 and 999);

create or replace function private.clear_guest_count_when_excluded()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_statistics_excluded then new.guest_count := 0; end if;
  return new;
end;
$$;

drop trigger if exists clear_guest_count_when_excluded on public.attendance_events;
create trigger clear_guest_count_when_excluded
before insert or update of is_statistics_excluded on public.attendance_events
for each row execute function private.clear_guest_count_when_excluded();

create or replace function public.set_attendance_guest_count(target_date date, new_guest_count integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  selected_event uuid;
  excluded boolean;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active and role in ('admin', 'teacher')
  ) then raise exception 'staff account required'; end if;
  if target_date is null or new_guest_count is null or new_guest_count < 0 or new_guest_count > 999 then
    raise exception 'invalid guest count';
  end if;

  select id, is_statistics_excluded into selected_event, excluded
  from public.attendance_events where service_date = target_date;
  if excluded then raise exception 'attendance event excluded'; end if;

  if selected_event is null then
    if new_guest_count = 0 then return null; end if;
    insert into public.attendance_events(service_date, title, guide_text, qr_token_hash, opens_at, closes_at, created_by, guest_count)
    values (
      target_date, '주일예배', '당일 날짜 코드로 출석해 주세요.',
      encode(extensions.digest('manual-attendance:' || target_date::text, 'sha256'), 'hex'),
      target_date::timestamp at time zone 'Asia/Seoul',
      (target_date + 1)::timestamp at time zone 'Asia/Seoul',
      (select auth.uid()), new_guest_count
    ) returning id into selected_event;
  else
    update public.attendance_events set guest_count = new_guest_count where id = selected_event;
  end if;
  return selected_event;
end;
$$;

revoke all on function public.set_attendance_guest_count(date, integer) from public, anon;
grant execute on function public.set_attendance_guest_count(date, integer) to authenticated;
