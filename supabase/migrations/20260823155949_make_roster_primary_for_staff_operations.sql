-- The ministry roster is the operational source of truth. Account links are
-- optional and only provide personal/parent views and student QR check-in.

drop policy if exists students_select on public.students;
create policy students_select on public.students
for select to authenticated
using (
  private.current_app_role() in ('admin', 'teacher')
  or profile_id = (select auth.uid())
  or private.is_linked_parent(id)
);

drop policy if exists attendance_records_select on public.attendance_records;
drop policy if exists attendance_records_staff_insert on public.attendance_records;
drop policy if exists attendance_records_staff_update on public.attendance_records;
drop policy if exists attendance_records_staff_delete on public.attendance_records;

create policy attendance_records_select on public.attendance_records
for select to authenticated
using (
  private.current_app_role() = 'admin'
  or (
    private.current_app_role() = 'teacher'
    and exists (select 1 from public.students s where s.id = student_id)
  )
  or student_id in (select id from public.students where profile_id = (select auth.uid()))
  or private.is_linked_parent(student_id)
);

create policy attendance_records_staff_insert on public.attendance_records
for insert to authenticated
with check (
  (
    private.current_app_role() in ('admin', 'teacher')
    and checked_by = (select auth.uid())
    and exists (select 1 from public.students s where s.id = student_id and s.is_active)
  )
);

create policy attendance_records_staff_update on public.attendance_records
for update to authenticated
using (
  private.current_app_role() in ('admin', 'teacher')
  and exists (select 1 from public.students s where s.id = student_id and s.is_active)
)
with check (
  private.current_app_role() in ('admin', 'teacher')
  and exists (select 1 from public.students s where s.id = student_id and s.is_active)
);

create policy attendance_records_staff_delete on public.attendance_records
for delete to authenticated
using (
  private.current_app_role() in ('admin', 'teacher')
  and exists (select 1 from public.students s where s.id = student_id and s.is_active)
);

drop policy if exists point_transactions_select on public.point_transactions;
drop policy if exists point_transactions_staff_insert on public.point_transactions;

create policy point_transactions_select on public.point_transactions
for select to authenticated
using (
  private.current_app_role() = 'admin'
  or (
    private.current_app_role() = 'teacher'
    and exists (select 1 from public.students s where s.id = student_id)
  )
  or student_id in (select id from public.students where profile_id = (select auth.uid()))
  or private.is_linked_parent(student_id)
);

create policy point_transactions_staff_insert on public.point_transactions
for insert to authenticated
with check (
  private.current_app_role() in ('admin', 'teacher')
  and awarded_by = (select auth.uid())
  and exists (select 1 from public.students s where s.id = student_id and s.is_active)
);
