create type public.app_role as enum ('admin', 'teacher', 'parent', 'student');
create type public.attendance_status as enum ('present', 'late', 'excused', 'absent');
create type public.attendance_method as enum ('qr', 'teacher', 'admin');
create type public.inquiry_status as enum ('open', 'answered', 'closed');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text not null default '',
  phone text,
  address text,
  grade smallint check (grade between 1 and 6),
  class_name text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_links (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null default '보호자',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table public.teacher_assignments (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  grade smallint not null check (grade between 1 and 6),
  class_name text not null,
  school_year integer not null default extract(year from current_date)::integer,
  created_at timestamptz not null default now(),
  primary key (teacher_id, grade, class_name, school_year)
);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  service_date date not null unique,
  title text not null default '주일예배',
  guide_text text,
  qr_token_hash text not null unique,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.attendance_events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null default 'present',
  method public.attendance_method not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references public.profiles(id) on delete set null,
  note text,
  unique (event_id, student_id)
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0 and amount between -1000 and 1000),
  reason text not null,
  awarded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  label text not null,
  sort_order smallint not null default 0,
  unique (notice_id, label)
);

create table public.poll_votes (
  notice_id uuid not null references public.notices(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (notice_id, voter_id)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status public.inquiry_status not null default 'open',
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_role_grade_idx on public.profiles(role, grade, class_name) where is_active;
create index family_links_child_idx on public.family_links(child_id);
create index attendance_events_created_by_idx on public.attendance_events(created_by);
create index attendance_records_student_idx on public.attendance_records(student_id, checked_at desc);
create index attendance_records_checked_by_idx on public.attendance_records(checked_by);
create index point_transactions_student_idx on public.point_transactions(student_id, created_at desc);
create index point_transactions_awarded_by_idx on public.point_transactions(awarded_by);
create index notices_published_idx on public.notices(published_at desc) where published_at is not null;
create index notices_created_by_idx on public.notices(created_by);
create index poll_votes_option_idx on public.poll_votes(option_id);
create index poll_votes_voter_idx on public.poll_votes(voter_id);
create index inquiries_parent_idx on public.inquiries(parent_id);
create index inquiries_assigned_admin_idx on public.inquiries(assigned_admin_id);
create index inquiry_messages_inquiry_idx on public.inquiry_messages(inquiry_id, created_at);
create index inquiry_messages_sender_idx on public.inquiry_messages(sender_id);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

create or replace function private.current_app_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and is_active
$$;
revoke all on function private.current_app_role() from public, anon;
grant execute on function private.current_app_role() to authenticated;

create or replace function private.is_linked_parent(student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.family_links
    where parent_id = (select auth.uid()) and child_id = student
  )
$$;
revoke all on function private.is_linked_parent(uuid) from public, anon;
grant execute on function private.is_linked_parent(uuid) to authenticated;

create or replace function private.is_assigned_teacher(student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.teacher_assignments ta
    join public.profiles p on p.id = student
    where ta.teacher_id = (select auth.uid())
      and ta.grade = p.grade and ta.class_name = p.class_name
      and ta.school_year = extract(year from current_date)::integer
  )
$$;
revoke all on function private.is_assigned_teacher(uuid) from public, anon;
grant execute on function private.is_assigned_teacher(uuid) to authenticated;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger notices_touch before update on public.notices for each row execute function private.touch_updated_at();
create trigger inquiries_touch before update on public.inquiries for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.family_links enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_records enable row level security;
alter table public.point_transactions enable row level security;
alter table public.notices enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_messages enable row level security;
alter table public.notifications enable row level security;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid()) or private.current_app_role() = 'admin'
  or (private.current_app_role() = 'teacher' and role in ('student','parent','teacher'))
  or (private.current_app_role() = 'parent' and (role = 'teacher' or private.is_linked_parent(id)))
  or (private.current_app_role() = 'student' and (role = 'teacher' or id = (select auth.uid())))
);
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (private.current_app_role() = 'admin');
create policy profiles_update on public.profiles for update to authenticated
using (private.current_app_role() = 'admin' or id = (select auth.uid()))
with check (private.current_app_role() = 'admin' or (id = (select auth.uid()) and role = private.current_app_role()));
create policy profiles_admin_delete on public.profiles for delete to authenticated using (private.current_app_role() = 'admin');

create policy family_links_select on public.family_links for select to authenticated using (
  private.current_app_role() = 'admin' or parent_id = (select auth.uid()) or child_id = (select auth.uid())
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(child_id))
);
create policy family_links_admin_insert on public.family_links for insert to authenticated with check (private.current_app_role() = 'admin');
create policy family_links_admin_update on public.family_links for update to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');
create policy family_links_admin_delete on public.family_links for delete to authenticated using (private.current_app_role() = 'admin');

create policy teacher_assignments_select on public.teacher_assignments for select to authenticated using (true);
create policy teacher_assignments_admin_insert on public.teacher_assignments for insert to authenticated with check (private.current_app_role() = 'admin');
create policy teacher_assignments_admin_update on public.teacher_assignments for update to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');
create policy teacher_assignments_admin_delete on public.teacher_assignments for delete to authenticated using (private.current_app_role() = 'admin');

create policy attendance_events_select on public.attendance_events for select to authenticated using (true);
create policy attendance_events_admin_insert on public.attendance_events for insert to authenticated with check (private.current_app_role() = 'admin');
create policy attendance_events_admin_update on public.attendance_events for update to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');
create policy attendance_events_admin_delete on public.attendance_events for delete to authenticated using (private.current_app_role() = 'admin');

create policy attendance_records_select on public.attendance_records for select to authenticated using (
  private.current_app_role() in ('admin','teacher') or student_id = (select auth.uid()) or private.is_linked_parent(student_id)
);
create policy attendance_records_staff_insert on public.attendance_records for insert to authenticated with check (
  private.current_app_role() = 'admin' or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id))
);
create policy attendance_records_staff_update on public.attendance_records for update to authenticated
using (private.current_app_role() = 'admin' or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id)))
with check (private.current_app_role() = 'admin' or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id)));
create policy attendance_records_admin_delete on public.attendance_records for delete to authenticated using (private.current_app_role() = 'admin');

create policy point_transactions_select on public.point_transactions for select to authenticated using (
  private.current_app_role() in ('admin','teacher') or student_id = (select auth.uid()) or private.is_linked_parent(student_id)
);
create policy point_transactions_staff_insert on public.point_transactions for insert to authenticated with check (
  private.current_app_role() = 'admin'
  or (private.current_app_role() = 'teacher' and private.is_assigned_teacher(student_id) and awarded_by = (select auth.uid()))
);
create policy point_transactions_admin_update on public.point_transactions for update to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');
create policy point_transactions_admin_delete on public.point_transactions for delete to authenticated using (private.current_app_role() = 'admin');

create policy notices_published_select on public.notices for select to authenticated using (published_at is not null or private.current_app_role() in ('admin','teacher'));
create policy notices_staff_insert on public.notices for insert to authenticated with check (private.current_app_role() in ('admin','teacher'));
create policy notices_staff_update on public.notices for update to authenticated using (private.current_app_role() in ('admin','teacher')) with check (private.current_app_role() in ('admin','teacher'));
create policy notices_staff_delete on public.notices for delete to authenticated using (private.current_app_role() in ('admin','teacher'));

create policy poll_options_select on public.poll_options for select to authenticated using (true);
create policy poll_options_staff_insert on public.poll_options for insert to authenticated with check (private.current_app_role() in ('admin','teacher'));
create policy poll_options_staff_update on public.poll_options for update to authenticated using (private.current_app_role() in ('admin','teacher')) with check (private.current_app_role() in ('admin','teacher'));
create policy poll_options_staff_delete on public.poll_options for delete to authenticated using (private.current_app_role() in ('admin','teacher'));

create policy poll_votes_select on public.poll_votes for select to authenticated using (voter_id = (select auth.uid()) or private.current_app_role() in ('admin','teacher'));
create policy poll_votes_self_insert on public.poll_votes for insert to authenticated with check (voter_id = (select auth.uid()));
create policy poll_votes_self_update on public.poll_votes for update to authenticated using (voter_id = (select auth.uid())) with check (voter_id = (select auth.uid()));
create policy poll_votes_self_delete on public.poll_votes for delete to authenticated using (voter_id = (select auth.uid()));

create policy inquiries_select on public.inquiries for select to authenticated using (parent_id = (select auth.uid()) or private.current_app_role() = 'admin');
create policy inquiries_parent_insert on public.inquiries for insert to authenticated with check (private.current_app_role() = 'parent' and parent_id = (select auth.uid()));
create policy inquiries_admin_update on public.inquiries for update to authenticated using (private.current_app_role() = 'admin') with check (private.current_app_role() = 'admin');

create policy inquiry_messages_select on public.inquiry_messages for select to authenticated using (
  private.current_app_role() = 'admin'
  or exists (select 1 from public.inquiries i where i.id = inquiry_id and i.parent_id = (select auth.uid()))
);
create policy inquiry_messages_insert on public.inquiry_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and (
    private.current_app_role() = 'admin'
    or exists (select 1 from public.inquiries i where i.id = inquiry_id and i.parent_id = (select auth.uid()))
  )
);

create policy notifications_select on public.notifications for select to authenticated using (recipient_id = (select auth.uid()) or private.current_app_role() = 'admin');
create policy notifications_self_update on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy notifications_admin_insert on public.notifications for insert to authenticated with check (private.current_app_role() = 'admin');

create or replace view public.student_point_balances with (security_invoker = true) as
select p.id as student_id, p.full_name, p.grade, p.class_name, coalesce(sum(pt.amount), 0)::bigint as balance
from public.profiles p left join public.point_transactions pt on pt.student_id = p.id
where p.role = 'student' and p.is_active
group by p.id, p.full_name, p.grade, p.class_name;
grant select on public.student_point_balances to authenticated;
