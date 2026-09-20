create or replace function private.handle_dream_registration()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  login_id text := nullif(trim(new.raw_user_meta_data ->> 'login_id'), '');
  requested_role_text text := new.raw_user_meta_data ->> 'requested_role';
  selected_role public.app_role;
  matched_student_id uuid;
  matched_student_count integer;
begin
  if login_id is null then
    insert into public.registration_requests(user_id,email,full_name,phone,address,note,requested_role)
    values(new.id,coalesce(new.email,''),coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'가입자'),nullif(trim(new.raw_user_meta_data->>'phone'),''),nullif(trim(new.raw_user_meta_data->>'address'),''),nullif(trim(new.raw_user_meta_data->>'note'),''),nullif(trim(requested_role_text),'')) on conflict(user_id) do nothing;
    return new;
  end if;
  if requested_role_text='student' then selected_role:='student'; elsif requested_role_text='teacher' then selected_role:='teacher'; elsif requested_role_text='accountant' then selected_role:='accountant'; else selected_role:='parent'; end if;
  insert into public.registration_requests(user_id,email,full_name,phone,address,note,requested_role,status,reviewed_at)
  values(new.id,login_id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'가입자'),nullif(trim(new.raw_user_meta_data->>'phone'),''),nullif(trim(new.raw_user_meta_data->>'address'),''),nullif(trim(new.raw_user_meta_data->>'note'),''),selected_role::text,case when selected_role='parent' or selected_role='student' then 'approved' else 'pending' end,case when selected_role='parent' or selected_role='student' then now() else null end);
  if selected_role='parent' or selected_role='student' then
    insert into public.profiles(id,email,role,full_name,phone,address,note,is_active,account_status) values(new.id,login_id,selected_role,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'가입자'),nullif(trim(new.raw_user_meta_data->>'phone'),''),nullif(trim(new.raw_user_meta_data->>'address'),''),nullif(trim(new.raw_user_meta_data->>'note'),''),true,'active');
    insert into public.user_roles(user_id,role) values(new.id,selected_role);
  end if;
  if selected_role='student' then
    select (array_agg(id order by created_at))[1], count(*)::integer
      into matched_student_id, matched_student_count
      from public.students
      where is_active=true and profile_id is null
        and full_name=coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'가입자');
    if matched_student_count=1 then
      update public.students set profile_id=new.id,updated_at=now() where id=matched_student_id and profile_id is null;
    end if;
  end if;
  update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()),updated_at=now() where id=new.id;
  return new;
end;
$body$;
