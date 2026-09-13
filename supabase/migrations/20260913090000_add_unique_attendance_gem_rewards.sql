alter table public.point_transactions
  add column if not exists attendance_record_id uuid;

alter table public.point_transactions
  drop constraint if exists point_transactions_attendance_record_id_fkey;

alter table public.point_transactions
  add constraint point_transactions_attendance_record_id_fkey
  foreign key (attendance_record_id)
  references public.attendance_records(id)
  on delete cascade;

create unique index if not exists point_transactions_attendance_reward_uidx
  on public.point_transactions(attendance_record_id)
  where attendance_record_id is not null;

create or replace function private.sync_attendance_gem_reward()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if new.status in ('present', 'late') then
    insert into public.point_transactions(student_id, amount, reason, awarded_by, attendance_record_id)
    values(new.student_id, 1, '출석 보상', new.checked_by, new.id)
    on conflict do nothing;
  else
    delete from public.point_transactions
    where attendance_record_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_attendance_gem_reward() from public, anon, authenticated;

drop trigger if exists sync_attendance_gem_reward on public.attendance_records;
create trigger sync_attendance_gem_reward
after insert or update of status on public.attendance_records
for each row
execute function private.sync_attendance_gem_reward();

comment on column public.point_transactions.attendance_record_id is
  'Links an automatic +1 gem reward to exactly one attendance record.';
