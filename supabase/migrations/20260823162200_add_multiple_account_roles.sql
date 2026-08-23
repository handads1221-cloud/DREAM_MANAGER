create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
insert into public.user_roles(user_id, role) select id, role from public.profiles on conflict do nothing;
create policy user_roles_select on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or private.current_app_role() = 'admin');
create policy user_roles_admin_insert on public.user_roles for insert to authenticated with check (private.current_app_role() = 'admin');
create policy user_roles_admin_delete on public.user_roles for delete to authenticated using (private.current_app_role() = 'admin');
grant select, insert, delete on public.user_roles to authenticated;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (private.current_app_role() = 'admin' or id = (select auth.uid()))
with check (private.current_app_role() = 'admin' or (id = (select auth.uid()) and exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = profiles.role)));

create or replace function private.protect_profile_account_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if private.current_app_role() <> 'admin' and (
    (new.role is distinct from old.role and not (new.id = (select auth.uid()) and exists (select 1 from public.user_roles ur where ur.user_id = new.id and ur.role = new.role)))
    or new.email is distinct from old.email or new.is_active is distinct from old.is_active
    or new.account_status is distinct from old.account_status or new.withdrawn_at is distinct from old.withdrawn_at
    or new.withdrawn_by is distinct from old.withdrawn_by or new.withdrawal_note is distinct from old.withdrawal_note
  ) then raise exception 'Only administrators can change account access fields'; end if;
  return new;
end;
$$;

create or replace function public.admin_set_user_roles(target_user_id uuid, selected_roles public.app_role[])
returns void language plpgsql security invoker set search_path = '' as $$
declare selected_role public.app_role;
begin
  if private.current_app_role() <> 'admin' then raise exception 'forbidden'; end if;
  if target_user_id is null or selected_roles is null or cardinality(selected_roles) = 0 then raise exception 'at least one role required'; end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then raise exception 'profile not found'; end if;
  delete from public.user_roles where user_id = target_user_id and role <> all(selected_roles);
  insert into public.user_roles(user_id, role) select target_user_id, unnest(selected_roles) on conflict do nothing;
  if not exists (select 1 from public.profiles p where p.id = target_user_id and p.role = any(selected_roles)) then
    selected_role := selected_roles[1]; update public.profiles set role = selected_role where id = target_user_id;
  end if;
end;
$$;
revoke all on function public.admin_set_user_roles(uuid, public.app_role[]) from public, anon;
grant execute on function public.admin_set_user_roles(uuid, public.app_role[]) to authenticated;

create or replace function public.switch_active_role(selected_role public.app_role)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.user_id = (select auth.uid()) and ur.role = selected_role and p.is_active) then raise exception 'role not assigned'; end if;
  update public.profiles set role = selected_role where id = (select auth.uid());
end;
$$;
revoke all on function public.switch_active_role(public.app_role) from public, anon;
grant execute on function public.switch_active_role(public.app_role) to authenticated;
