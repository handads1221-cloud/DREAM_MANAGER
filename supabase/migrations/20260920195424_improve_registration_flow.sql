alter table public.registration_requests
  add column if not exists requested_role text,
  add column if not exists rejection_reason text;

alter table public.registration_requests
  drop constraint if exists registration_requests_requested_role_check;

alter table public.registration_requests
  add constraint registration_requests_requested_role_check
  check (requested_role is null or requested_role in ('parent', 'student', 'teacher', 'accountant', 'unsure'));

create or replace function private.handle_dream_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registration_requests (
    user_id, email, full_name, phone, address, note, requested_role
  ) values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), '가입자'),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'address'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'note'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'requested_role'), '')
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    address = excluded.address,
    note = excluded.note,
    requested_role = excluded.requested_role,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.admin_approve_registration(
  target_user_id uuid,
  selected_roles public.app_role[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer_id uuid := auth.uid();
  registration public.registration_requests%rowtype;
  primary_role public.app_role;
begin
  if reviewer_id is null or not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and is_active = true and account_status = 'active'
  ) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if coalesce(array_length(selected_roles, 1), 0) = 0 then
    raise exception '권한을 한 개 이상 선택해 주세요.';
  end if;

  select * into registration
  from public.registration_requests
  where user_id = target_user_id and status = 'pending'
  for update;

  if not found then
    raise exception '승인 대기 중인 가입 신청을 찾을 수 없습니다.';
  end if;

  primary_role := selected_roles[1];

  insert into public.profiles (
    id, email, role, full_name, phone, address, note, is_active, account_status
  ) values (
    target_user_id, registration.email, primary_role, registration.full_name,
    registration.phone, registration.address, registration.note, true, 'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    full_name = excluded.full_name,
    phone = excluded.phone,
    address = excluded.address,
    note = excluded.note,
    is_active = true,
    account_status = 'active',
    updated_at = now();

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles (user_id, role)
  select target_user_id, role
  from unnest(selected_roles) as role
  on conflict (user_id, role) do nothing;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = target_user_id;

  update public.registration_requests
  set status = 'approved',
      rejection_reason = null,
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      updated_at = now()
  where user_id = target_user_id;
end;
$$;

create or replace function public.resubmit_registration()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.registration_requests
  set status = 'pending',
      rejection_reason = null,
      reviewed_by = null,
      reviewed_at = null,
      requested_at = now(),
      updated_at = now()
  where user_id = auth.uid() and status = 'rejected';

  if not found then
    raise exception '재신청할 수 있는 반려 내역이 없습니다.';
  end if;
end;
$$;

revoke all on function public.admin_approve_registration(uuid, public.app_role[]) from public, anon;
grant execute on function public.admin_approve_registration(uuid, public.app_role[]) to authenticated;
revoke all on function public.resubmit_registration() from public, anon;
grant execute on function public.resubmit_registration() to authenticated;
