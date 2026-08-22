create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null check (length(trim(full_name)) > 0),
  grade smallint not null check (grade between 1 and 6),
  class_name text,
  phone text,
  address text,
  school_name text,
  primary_parent_id uuid references public.profiles(id) on delete set null,
  note text,
  is_active boolean not null default true,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_grade_name_idx
  on public.students(grade, full_name)
  where is_active;
create index students_parent_idx on public.students(primary_parent_id);

create trigger students_touch
before update on public.students
for each row execute function private.touch_updated_at();

alter table public.students enable row level security;
grant select, insert, update, delete on public.students to authenticated;
revoke all on public.students from anon;

create policy students_select on public.students
for select to authenticated using (
  private.current_app_role() in ('admin', 'teacher')
  or profile_id = (select auth.uid())
  or primary_parent_id = (select auth.uid())
);
create policy students_admin_insert on public.students
for insert to authenticated
with check (private.current_app_role() = 'admin');
create policy students_admin_update on public.students
for update to authenticated
using (private.current_app_role() = 'admin')
with check (private.current_app_role() = 'admin');
create policy students_admin_delete on public.students
for delete to authenticated
using (private.current_app_role() = 'admin');

insert into public.students (full_name, grade, source_ref) values
  ('김정현', 1, 'initial-1-김정현'),
  ('김하린', 1, 'initial-1-김하린'),
  ('박하민', 1, 'initial-1-박하민'),
  ('양정원', 1, 'initial-1-양정원'),
  ('위이안', 1, 'initial-1-위이안'),
  ('이루아', 1, 'initial-1-이루아'),
  ('민유아', 1, 'initial-1-민유아'),
  ('음윤우', 1, 'initial-1-음윤우'),
  ('윤주원', 1, 'initial-1-윤주원'),
  ('장서준', 1, 'initial-1-장서준'),
  ('김예겸', 2, 'initial-2-김예겸'),
  ('김도윤', 2, 'initial-2-김도윤'),
  ('김하엘', 2, 'initial-2-김하엘'),
  ('송치훈', 2, 'initial-2-송치훈'),
  ('이도아', 2, 'initial-2-이도아'),
  ('정우혁', 2, 'initial-2-정우혁'),
  ('황서희', 2, 'initial-2-황서희'),
  ('김도겸', 3, 'initial-3-김도겸'),
  ('김도윤', 3, 'initial-3-김도윤'),
  ('김수현', 3, 'initial-3-김수현'),
  ('김예봄', 3, 'initial-3-김예봄'),
  ('박건희', 3, 'initial-3-박건희'),
  ('리암', 3, 'initial-3-리암'),
  ('유선제', 3, 'initial-3-유선제'),
  ('이해준', 3, 'initial-3-이해준'),
  ('이주원', 3, 'initial-3-이주원'),
  ('임이나', 3, 'initial-3-임이나'),
  ('최연우', 3, 'initial-3-최연우'),
  ('황지안', 3, 'initial-3-황지안'),
  ('음윤아', 3, 'initial-3-음윤아'),
  ('민한별', 3, 'initial-3-민한별'),
  ('이시안', 3, 'initial-3-이시안'),
  ('김예나', 4, 'initial-4-김예나'),
  ('김예준', 4, 'initial-4-김예준'),
  ('박시아', 4, 'initial-4-박시아'),
  ('박은규', 4, 'initial-4-박은규'),
  ('위시안', 4, 'initial-4-위시안'),
  ('정지원', 4, 'initial-4-정지원'),
  ('정하윤', 4, 'initial-4-정하윤'),
  ('조서연', 4, 'initial-4-조서연'),
  ('박지완', 4, 'initial-4-박지완'),
  ('조범규', 4, 'initial-4-조범규'),
  ('노윤찬', 5, 'initial-5-노윤찬'),
  ('임의택', 5, 'initial-5-임의택'),
  ('권지민', 5, 'initial-5-권지민'),
  ('박하연', 5, 'initial-5-박하연'),
  ('양지원', 5, 'initial-5-양지원'),
  ('유채아', 5, 'initial-5-유채아'),
  ('김예린', 6, 'initial-6-김예린'),
  ('박주아', 6, 'initial-6-박주아'),
  ('최연아', 6, 'initial-6-최연아'),
  ('박환희', 6, 'initial-6-박환희'),
  ('안성욱', 6, 'initial-6-안성욱'),
  ('최건', 6, 'initial-6-최건'),
  ('최은혁', 6, 'initial-6-최은혁')
on conflict (source_ref) do update
set full_name = excluded.full_name,
    grade = excluded.grade,
    updated_at = now();
