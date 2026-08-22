create or replace function public.admin_confirm_user_email(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
      and account_status = 'active'
  ) then
    raise exception 'Administrator permission required';
  end if;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

create or replace function public.admin_set_user_password(target_user_id uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and is_active
      and account_status = 'active'
  ) then
    raise exception 'Administrator permission required';
  end if;
  if target_user_id = (select auth.uid()) then
    raise exception 'Use the signed-in password change flow for your own account';
  end if;
  if char_length(new_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if octet_length(new_password) > 72 then
    raise exception 'Password must be at most 72 bytes';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'User not found';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;

  delete from auth.sessions where user_id = target_user_id;
end;
$$;

revoke all on function public.admin_confirm_user_email(uuid) from public, anon;
revoke all on function public.admin_set_user_password(uuid, text) from public, anon;
grant execute on function public.admin_confirm_user_email(uuid) to authenticated;
grant execute on function public.admin_set_user_password(uuid, text) to authenticated;
