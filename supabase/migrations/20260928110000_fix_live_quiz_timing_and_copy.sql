create or replace function public.enforce_quiz_room_server_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.state = 'question'
    and (old.state is distinct from 'question' or old.current_question_index is distinct from new.current_question_index)
  then
    new.question_started_at := clock_timestamp();
  end if;

  if new.state = 'finished' and old.state is distinct from 'finished' then
    new.ended_at := clock_timestamp();
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_quiz_room_server_timestamps() from public, anon, authenticated;

drop trigger if exists quiz_room_server_timestamps on public.quiz_rooms;
create trigger quiz_room_server_timestamps
before update on public.quiz_rooms
for each row execute function public.enforce_quiz_room_server_timestamps();

create or replace function public.submit_live_quiz_answer(
  requested_code text,
  requested_participant uuid,
  requested_token uuid,
  requested_option uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.quiz_rooms;
  current_question public.quiz_questions;
  current_participant public.quiz_participants;
  selected_option public.quiz_options;
  awarded integer;
  elapsed numeric;
begin
  select * into target_room from public.quiz_rooms where room_code = requested_code and state = 'question';
  if target_room.id is null then raise exception '현재 답변을 받고 있지 않습니다.'; end if;
  select * into current_participant from public.quiz_participants
  where id = requested_participant and room_id = target_room.id and session_token = requested_token;
  if current_participant.id is null then raise exception '참가 정보를 확인할 수 없습니다.'; end if;
  select * into current_question from public.quiz_questions
  where quiz_id = target_room.quiz_id and position = target_room.current_question_index;
  select * into selected_option from public.quiz_options
  where id = requested_option and question_id = current_question.id;
  if selected_option.id is null then raise exception '선택지를 확인해 주세요.'; end if;
  if target_room.question_started_at is null then raise exception '문제 시작 시간을 확인할 수 없습니다.'; end if;

  elapsed := greatest(0, extract(epoch from (clock_timestamp() - target_room.question_started_at)));
  if elapsed > current_question.duration_seconds + 2 then
    raise exception '답변 시간이 종료되었습니다.';
  end if;

  awarded := case when selected_option.is_correct then
    500 + round(500 * (1 - least(elapsed, current_question.duration_seconds) / current_question.duration_seconds))::integer
  else 0 end;
  awarded := greatest(0, least(1000, awarded));

  insert into public.quiz_answers(room_id, participant_id, question_id, option_id, is_correct, score_awarded)
  values(target_room.id, current_participant.id, current_question.id, selected_option.id, selected_option.is_correct, awarded);
  update public.quiz_participants set score = score + awarded, last_seen_at = clock_timestamp() where id = current_participant.id;
  return jsonb_build_object('accepted', true, 'score_awarded', awarded);
exception when unique_violation then
  return jsonb_build_object('accepted', false, 'reason', 'already_answered');
end;
$$;

revoke all on function public.submit_live_quiz_answer(text,uuid,uuid,uuid) from public;
grant execute on function public.submit_live_quiz_answer(text,uuid,uuid,uuid) to anon, authenticated;

update public.quiz_options
set label = '바로'
where label = '바로 왕'
  and question_id in (select id from public.quiz_questions where prompt = '이스라엘 백성이 많아지는 것을 두려워한 애굽 왕은 누구인가요?');

update public.quiz_options
set label = '불이 붙었지만 타지 않는 떨기나무 가운데'
where label = '불붙는 떨기나무 가운데';

update public.quiz_questions
set prompt = '하나님은 말하는 것을 어려워한 모세를 돕도록 누구를 보내셨나요?'
where prompt = '하나님은 말하기를 어려워한 모세를 돕도록 누구를 보내셨나요?';

update public.quiz_options
set label = '모세의 형 아론'
where label = '형 아론';

update public.quiz_options
set label = '문 양옆 기둥과 문 위쪽'
where label = '문설주와 문 위';

update public.quiz_options
set label = '바로가 보낸 애굽 군대'
where label = '바로의 군대';
