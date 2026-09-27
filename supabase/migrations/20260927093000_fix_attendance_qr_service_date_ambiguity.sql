create or replace function public.admin_get_attendance_qr(target_date date default ((now() at time zone 'Asia/Seoul')::date))
returns table(
  event_id uuid,
  service_date date,
  title text,
  guide_text text,
  token text,
  opens_at timestamptz,
  closes_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_event uuid;
begin
  if private.current_app_role() <> 'admin' then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1
    from public.attendance_events as attendance_event
    where attendance_event.service_date = target_date
      and attendance_event.is_statistics_excluded
  ) then
    raise exception 'attendance event excluded';
  end if;

  selected_event := private.ensure_sunday_event(target_date);

  return query
  select
    attendance_event.id,
    attendance_event.service_date,
    attendance_event.title,
    attendance_event.guide_text,
    qr_token.token,
    attendance_event.opens_at,
    attendance_event.closes_at
  from public.attendance_events as attendance_event
  join private.attendance_qr_tokens as qr_token
    on qr_token.event_id = attendance_event.id
  where attendance_event.id = selected_event;
end;
$$;

revoke all on function public.admin_get_attendance_qr(date) from public, anon;
grant execute on function public.admin_get_attendance_qr(date) to authenticated;
