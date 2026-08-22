alter table public.profiles
  add column email text,
  add column account_status text not null default 'active'
    check (account_status in ('active', 'withdrawn')),
  add column withdrawn_at timestamptz,
  add column withdrawn_by uuid references public.profiles(id) on delete set null,
  add column withdrawal_note text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and u.email is not null;

create unique index profiles_email_unique_idx on public.profiles(lower(email)) where email is not null;

create index profiles_account_status_idx
  on public.profiles(account_status, role, full_name);
create index profiles_withdrawn_by_idx on public.profiles(withdrawn_by);

create or replace function private.protect_profile_account_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.current_app_role() <> 'admin'
     and (
       new.role is distinct from old.role
       or new.email is distinct from old.email
       or new.is_active is distinct from old.is_active
       or new.account_status is distinct from old.account_status
       or new.withdrawn_at is distinct from old.withdrawn_at
       or new.withdrawn_by is distinct from old.withdrawn_by
       or new.withdrawal_note is distinct from old.withdrawal_note
     ) then
    raise exception 'Only administrators can change account access fields';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_profile_account_fields() from public, anon, authenticated;

create trigger profiles_protect_account_fields
before update on public.profiles
for each row execute function private.protect_profile_account_fields();
