alter table public.profiles add column if not exists birth_date date;

comment on column public.profiles.birth_date is '계정 소유자 생년월일. 관리자 생일 현황에서 선생님 생일 조회에 사용';
