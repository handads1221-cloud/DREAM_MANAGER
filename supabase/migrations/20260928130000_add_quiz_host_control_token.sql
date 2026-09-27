alter table public.quiz_rooms
add column if not exists host_control_token uuid not null default gen_random_uuid();

create or replace function public.control_live_quiz_room(
  requested_room uuid,
  requested_token uuid,
  requested_state text,
  requested_question_index integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.quiz_rooms;
  updated_room public.quiz_rooms;
begin
  select * into target_room
  from public.quiz_rooms
  where id = requested_room and host_control_token = requested_token
  for update;

  if target_room.id is null then
    raise exception '퀴즈방 진행 권한을 확인할 수 없습니다.';
  end if;

  if requested_state not in ('question', 'reveal', 'finished') then
    raise exception '변경할 수 없는 진행 상태입니다.';
  end if;

  if requested_state = 'question' then
    if requested_question_index is null or requested_question_index < 0 then
      raise exception '문제 번호를 확인해 주세요.';
    end if;
    if not exists (
      select 1 from public.quiz_questions
      where quiz_id = target_room.quiz_id and position = requested_question_index
    ) then
      raise exception '문제를 찾을 수 없습니다.';
    end if;
    if not (
      (target_room.state = 'lobby' and requested_question_index = 0)
      or (target_room.state = 'reveal' and requested_question_index = target_room.current_question_index + 1)
    ) then
      raise exception '현재 단계에서는 이 문제를 시작할 수 없습니다.';
    end if;
  elsif requested_state = 'reveal' then
    if target_room.state <> 'question' or requested_question_index <> target_room.current_question_index then
      raise exception '현재 문제의 정답만 공개할 수 있습니다.';
    end if;
  elsif requested_state = 'finished' then
    if target_room.state <> 'reveal' then
      raise exception '정답 공개 후 최종 순위를 볼 수 있습니다.';
    end if;
    if exists (
      select 1 from public.quiz_questions
      where quiz_id = target_room.quiz_id and position > target_room.current_question_index
    ) then
      raise exception '아직 남은 문제가 있습니다.';
    end if;
  end if;

  update public.quiz_rooms
  set state = requested_state,
      current_question_index = coalesce(requested_question_index, current_question_index)
  where id = target_room.id
  returning * into updated_room;

  return jsonb_build_object(
    'state', updated_room.state,
    'current_question_index', updated_room.current_question_index,
    'question_started_at', updated_room.question_started_at,
    'ended_at', updated_room.ended_at
  );
end;
$$;

revoke all on function public.control_live_quiz_room(uuid,uuid,text,integer) from public;
grant execute on function public.control_live_quiz_room(uuid,uuid,text,integer) to anon, authenticated;

create or replace function public.get_live_quiz_host_state(
  requested_room uuid,
  requested_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.quiz_rooms;
  participant_json jsonb;
  current_question_id uuid;
begin
  select * into target_room
  from public.quiz_rooms
  where id = requested_room and host_control_token = requested_token;

  if target_room.id is null then
    raise exception '퀴즈방 진행 권한을 확인할 수 없습니다.';
  end if;

  select id into current_question_id
  from public.quiz_questions
  where quiz_id = target_room.quiz_id and position = target_room.current_question_index;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', participant.id,
    'display_name', participant.display_name,
    'avatar_key', participant.avatar_key,
    'score', participant.score
  ) order by participant.score desc, participant.display_name), '[]'::jsonb)
  into participant_json
  from public.quiz_participants participant
  where participant.room_id = target_room.id;

  return jsonb_build_object(
    'state', target_room.state,
    'current_question_index', target_room.current_question_index,
    'question_started_at', target_room.question_started_at,
    'participants', participant_json,
    'answer_count', case when current_question_id is null then 0 else (
      select count(*) from public.quiz_answers
      where room_id = target_room.id and question_id = current_question_id
    ) end
  );
end;
$$;

revoke all on function public.get_live_quiz_host_state(uuid,uuid) from public;
grant execute on function public.get_live_quiz_host_state(uuid,uuid) to anon, authenticated;
