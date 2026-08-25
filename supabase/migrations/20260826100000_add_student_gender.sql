alter table public.students
add column gender text null;

alter table public.students
add constraint students_gender_check
check (gender is null or gender in ('male', 'female'));

comment on column public.students.gender is 'Student gender: male or female';
