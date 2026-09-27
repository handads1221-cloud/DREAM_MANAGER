do $$
declare
  v_event uuid;
  v_token text;
begin
  select id into v_event
  from public.attendance_events
  where service_date = date '2026-09-27'
    and not is_statistics_excluded;

  if v_event is null then
    raise exception 'event missing or excluded';
  end if;

  select token into v_token
  from private.attendance_qr_tokens
  where event_id = v_event;

  if v_token is null then
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into private.attendance_qr_tokens(event_id, token)
    values(v_event, v_token)
    on conflict(event_id) do update
      set token = excluded.token,
          created_at = now();
  end if;

  update public.attendance_events
  set qr_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      opens_at = (date '2026-09-27'::timestamp + time '06:00') at time zone 'Asia/Seoul',
      closes_at = (date '2026-09-27'::timestamp + time '13:30') at time zone 'Asia/Seoul'
  where id = v_event;
end;
$$;
