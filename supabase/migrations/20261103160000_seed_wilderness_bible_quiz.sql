do $$
declare
  admin_id uuid;
  quiz_id uuid;
  question_id uuid;
  question_item jsonb;
  option_item record;
  question_position integer := 0;
begin
  if exists (
    select 1 from public.quiz_sets
    where title = '광야 생활 성경 퀴즈'
  ) then
    return;
  end if;

  select id into admin_id
  from public.profiles
  where is_active = true and role = 'admin'
  order by created_at
  limit 1;

  if admin_id is null then
    raise notice '활성 관리자 계정이 없어 광야 생활 성경 퀴즈 생성을 건너뜁니다.';
    return;
  end if;

  insert into public.quiz_sets (title, description, created_by)
  values (
    '광야 생활 성경 퀴즈',
    '홍해를 건넌 뒤 광야에서 하나님과 함께 생활한 이스라엘 백성의 이야기를 풀어봐요!',
    admin_id
  )
  returning id into quiz_id;

  for question_item in
    select value from jsonb_array_elements(
      '[
        {"prompt":"마라의 물이 써서 마실 수 없을 때, 하나님은 모세에게 무엇을 하게 하셨나요?","options":["물을 모두 버리게 하셨어요","새 우물을 파게 하셨어요","한 나무를 물에 던지게 하셨어요","애굽으로 돌아가게 하셨어요"],"correctIndex":2},
        {"prompt":"광야에서 이스라엘 백성에게 하나님이 내려주신 하늘의 양식은 무엇인가요?","options":["메추라기만","만나","포도","무화과"],"correctIndex":1},
        {"prompt":"이스라엘 백성이 여섯째 날에는 만나를 두 배로 거둔 이유는 무엇인가요?","options":["손님이 오기로 해서","다른 민족에게 나누어 주려고","창고를 가득 채우려고","다음 날이 안식일이어서"],"correctIndex":3},
        {"prompt":"르비딤에서 마실 물이 없을 때 모세는 어떻게 물을 얻었나요?","options":["지팡이로 반석을 쳤어요","모래를 깊이 팠어요","비가 올 때까지 기다렸어요","바닷물을 가져왔어요"],"correctIndex":0},
        {"prompt":"아말렉과 싸울 때 지친 모세의 두 손을 붙들어 준 사람들은 누구인가요?","options":["여호수아와 갈렙","나답과 아비후","아론과 훌","모세와 이드로"],"correctIndex":2},
        {"prompt":"이드로는 혼자서 모든 재판을 하던 모세에게 어떤 조언을 했나요?","options":["모든 일을 그만두라고 했어요","능력 있고 정직한 사람들을 지도자로 세우라고 했어요","애굽으로 돌아가라고 했어요","재판을 하지 말라고 했어요"],"correctIndex":1},
        {"prompt":"하나님이 모세에게 십계명을 주신 산은 어디인가요?","options":["감람산","갈멜산","아라랏산","시내산"],"correctIndex":3},
        {"prompt":"모세가 시내산에 올라가 있는 동안 백성이 만든 우상은 무엇인가요?","options":["금송아지","은독수리","돌사자","나무양"],"correctIndex":0},
        {"prompt":"가나안 땅을 살펴본 정탐꾼 중 하나님을 믿고 들어갈 수 있다고 말한 두 사람은 누구인가요?","options":["아론과 훌","모세와 이드로","여호수아와 갈렙","나답과 아비후"],"correctIndex":2},
        {"prompt":"이스라엘 백성은 불순종 때문에 광야에서 몇 년 동안 생활하게 되었나요?","options":["10년","40년","70년","100년"],"correctIndex":1}
      ]'::jsonb
    )
  loop
    insert into public.quiz_questions (
      quiz_id,
      position,
      prompt,
      duration_seconds
    )
    values (
      quiz_id,
      question_position,
      question_item->>'prompt',
      20
    )
    returning id into question_id;

    for option_item in
      select value, ordinality
      from jsonb_array_elements_text(question_item->'options') with ordinality
    loop
      insert into public.quiz_options (
        question_id,
        position,
        label,
        is_correct
      )
      values (
        question_id,
        option_item.ordinality - 1,
        option_item.value,
        option_item.ordinality - 1 = (question_item->>'correctIndex')::integer
      );
    end loop;

    question_position := question_position + 1;
  end loop;
end;
$$;
