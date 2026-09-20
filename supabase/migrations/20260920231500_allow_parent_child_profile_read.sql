create policy profiles_parent_linked_student_select
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.student_guardians sg on sg.student_id = s.id
    where s.profile_id = profiles.id
      and sg.parent_id = (select auth.uid())
  )
);
