drop policy if exists attendance_records_admin_delete on public.attendance_records;
create policy attendance_records_staff_delete
on public.attendance_records
for delete
to authenticated
using (
  private.current_app_role() = 'admin'
  or (
    private.current_app_role() = 'teacher'
    and private.is_assigned_teacher(student_id)
  )
);
