create table public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quiz_sets(id) on delete cascade,
  position integer not null check (position >= 0),
  prompt text not null check (char_length(prompt) between 1 and 300),
  duration_seconds integer not null default 20 check (duration_seconds between 5 and 120),
  unique (quiz_id, position)
);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  position integer not null check (position between 0 and 3),
  label text not null check (char_length(label) between 1 and 120),
  is_correct boolean not null default false,
  unique (question_id, position)
);

create table public.quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quiz_sets(id) on delete cascade,
  room_code text not null unique check (room_code ~ '^[0-9]{6}$'),
  host_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'lobby' check (state in ('lobby','question','reveal','finished')),
  current_question_index integer not null default -1,
  question_started_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.quiz_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_key text not null check (char_length(avatar_key) between 1 and 40),
  session_token uuid not null,
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, session_token)
);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  participant_id uuid not null references public.quiz_participants(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  option_id uuid not null references public.quiz_options(id) on delete cascade,
  is_correct boolean not null,
  score_awarded integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (participant_id, question_id)
);

create index quiz_questions_quiz_position_idx on public.quiz_questions(quiz_id, position);
create index quiz_options_question_position_idx on public.quiz_options(question_id, position);
create index quiz_participants_room_score_idx on public.quiz_participants(room_id, score desc, joined_at);
create index quiz_answers_room_question_idx on public.quiz_answers(room_id, question_id);

alter table public.quiz_sets enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_rooms enable row level security;
alter table public.quiz_participants enable row level security;
alter table public.quiz_answers enable row level security;

create policy quiz_sets_staff_all on public.quiz_sets for all to authenticated
using (private.current_app_role() in ('admin','teacher'))
with check (private.current_app_role() in ('admin','teacher') and created_by = (select auth.uid()));
create policy quiz_questions_staff_all on public.quiz_questions for all to authenticated
using (private.current_app_role() in ('admin','teacher'))
with check (private.current_app_role() in ('admin','teacher'));
create policy quiz_options_staff_all on public.quiz_options for all to authenticated
using (private.current_app_role() in ('admin','teacher'))
with check (private.current_app_role() in ('admin','teacher'));
create policy quiz_rooms_staff_all on public.quiz_rooms for all to authenticated
using (private.current_app_role() in ('admin','teacher'))
with check (private.current_app_role() in ('admin','teacher') and host_id = (select auth.uid()));
create policy quiz_participants_staff_select on public.quiz_participants for select to authenticated
using (private.current_app_role() in ('admin','teacher'));
create policy quiz_answers_staff_select on public.quiz_answers for select to authenticated
using (private.current_app_role() in ('admin','teacher'));

grant select, insert, update, delete on public.quiz_sets, public.quiz_questions, public.quiz_options, public.quiz_rooms to authenticated;
grant select on public.quiz_participants, public.quiz_answers to authenticated;

create or replace function public.join_quiz_room(
  requested_code text,
  requested_name text,
  requested_avatar text,
  requested_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.quiz_rooms;
  participant public.quiz_participants;
begin
  select * into target_room from public.quiz_rooms
  where room_code = requested_code and state <> 'finished'
  order by created_at desc limit 1;
  if target_room.id is null then raise exception '입장 가능한 퀴즈방을 찾을 수 없습니다.'; end if;
  if char_length(trim(requested_name)) not between 1 and 20 then raise exception '이름을 확인해 주세요.'; end if;

  insert into public.quiz_participants(room_id, display_name, avatar_key, session_token)
  values(target_room.id, trim(requested_name), requested_avatar, requested_token)
  on conflict(room_id, session_token) do update
    set display_name = excluded.display_name, avatar_key = excluded.avatar_key, last_seen_at = now()
  returning * into participant;

  return jsonb_build_object('participant_id', participant.id, 'room_code', target_room.room_code);
end;
$$;

create or replace function public.get_live_quiz_state(
  requested_code text,
  requested_participant uuid default null,
  requested_token uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room public.quiz_rooms;
  current_question public.quiz_questions;
  current_participant public.quiz_participants;
  question_json jsonb;
  leaderboard_json jsonb := '[]'::jsonb;
begin
  select * into target_room from public.quiz_rooms where room_code = requested_code order by created_at desc limit 1;
  if target_room.id is null then raise exception '퀴즈방을 찾을 수 없습니다.'; end if;

  if requested_participant is not null then
    select * into current_participant from public.quiz_participants
    where id = requested_participant and room_id = target_room.id and session_token = requested_token;
    if current_participant.id is null then raise exception '참가 정보를 다시 확인해 주세요.'; end if;
    update public.quiz_participants set last_seen_at = now() where id = current_participant.id;
  end if;

  if target_room.current_question_index >= 0 then
    select * into current_question from public.quiz_questions
    where quiz_id = target_room.quiz_id and position = target_room.current_question_index;
    if current_question.id is not null then
      select jsonb_build_object(
        'id', current_question.id,
        'prompt', current_question.prompt,
        'duration_seconds', current_question.duration_seconds,
        'options', coalesce(jsonb_agg(jsonb_build_object('id', option.id, 'label', option.label, 'position', option.position) order by option.position), '[]'::jsonb)
      ) into question_json from public.quiz_options option where option.question_id = current_question.id;
    end if;
  end if;

  if target_room.state in ('reveal','finished') then
    select coalesce(jsonb_agg(jsonb_build_object('name', ranked.display_name, 'avatar_key', ranked.avatar_key, 'score', ranked.score, 'rank', ranked.rank) order by ranked.rank, ranked.display_name), '[]'::jsonb)
    into leaderboard_json
    from (
      select display_name, avatar_key, score, dense_rank() over(order by score desc) as rank
      from public.quiz_participants where room_id = target_room.id order by score desc, joined_at limit 10
    ) ranked;
  end if;

  return jsonb_build_object(
    'room_id', target_room.id,
    'state', target_room.state,
    'question_index', target_room.current_question_index,
    'question_started_at', target_room.question_started_at,
    'question', question_json,
    'participant_count', (select count(*) from public.quiz_participants where room_id = target_room.id),
    'participant', case when current_participant.id is null then null else jsonb_build_object(
      'id', current_participant.id,
      'name', current_participant.display_name,
      'avatar_key', current_participant.avatar_key,
      'score', current_participant.score,
      'answered', exists(select 1 from public.quiz_answers where participant_id = current_participant.id and question_id = current_question.id)
    ) end,
    'leaderboard', leaderboard_json
  );
end;
$$;

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

  elapsed := extract(epoch from (now() - target_room.question_started_at));
  awarded := case when selected_option.is_correct then
    500 + greatest(0, round(500 * (1 - least(elapsed, current_question.duration_seconds) / current_question.duration_seconds)))::integer
  else 0 end;

  insert into public.quiz_answers(room_id, participant_id, question_id, option_id, is_correct, score_awarded)
  values(target_room.id, current_participant.id, current_question.id, selected_option.id, selected_option.is_correct, awarded);
  update public.quiz_participants set score = score + awarded, last_seen_at = now() where id = current_participant.id;
  return jsonb_build_object('accepted', true, 'score_awarded', awarded);
exception when unique_violation then
  return jsonb_build_object('accepted', false, 'reason', 'already_answered');
end;
$$;

revoke all on function public.join_quiz_room(text,text,text,uuid) from public;
revoke all on function public.get_live_quiz_state(text,uuid,uuid) from public;
revoke all on function public.submit_live_quiz_answer(text,uuid,uuid,uuid) from public;
grant execute on function public.join_quiz_room(text,text,text,uuid) to anon, authenticated;
grant execute on function public.get_live_quiz_state(text,uuid,uuid) to anon, authenticated;
grant execute on function public.submit_live_quiz_answer(text,uuid,uuid,uuid) to anon, authenticated;
