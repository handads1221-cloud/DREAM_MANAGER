create or replace function private.ensure_sunday_event(target_date date default ((now() at time zone 'Asia/Seoul')::date))
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_uuid uuid;
  raw_token text;
  event_excluded boolean;
  open_time timestamptz;
  close_time timestamptz;
begin
  if extract(isodow from target_date) <> 7 then
    target_date := target_date + (7 - extract(isodow from target_date))::integer;
  end if;

  open_time := (target_date::timestamp + time '06:00') at time zone 'Asia/Seoul';
  close_time := (target_date::timestamp + time '13:30') at time zone 'Asia/Seoul';

  select id, is_statistics_excluded
    into event_uuid, event_excluded
  from public.attendance_events
  where service_date = target_date;

  if event_uuid is null then
    raw_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into public.attendance_events(service_date, title, guide_text, qr_token_hash, opens_at, closes_at)
    values(
      target_date,
      '주일예배',
      '예배 전 QR을 촬영해 출석해 주세요.',
      encode(extensions.digest(raw_token, 'sha256'), 'hex'),
      open_time,
      close_time
    )
    returning id into event_uuid;

    insert into private.attendance_qr_tokens(event_id, token)
    values(event_uuid, raw_token);
  else
    if event_excluded then
      raise exception 'attendance event excluded';
    end if;

    select token into raw_token
    from private.attendance_qr_tokens
    where event_id = event_uuid;

    if raw_token is null then
      raw_token := encode(extensions.gen_random_bytes(24), 'hex');
      insert into private.attendance_qr_tokens(event_id, token)
      values(event_uuid, raw_token)
      on conflict(event_id) do update
        set token = excluded.token,
            created_at = now();
    end if;

    update public.attendance_events
    set qr_token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'),
        opens_at = open_time,
        closes_at = close_time
    where id = event_uuid;
  end if;

  return event_uuid;
end;
$$;

revoke all on function private.ensure_sunday_event(date) from public, anon, authenticated;
