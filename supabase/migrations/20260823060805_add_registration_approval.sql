create table public.registration_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (length(trim(full_name)) between 1 and 50),
  phone text,
  address text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index registration_requests_status_idx
  on public.registration_requests(status, requested_at desc);
create index registration_requests_reviewed_by_idx on public.registration_requests(reviewed_by);

create trigger registration_requests_touch
before update on public.registration_requests
for each row execute function private.touch_updated_at();

create or replace function private.handle_dream_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registration_requests (user_id, email, full_name, phone, address, note)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), '이름 미입력'),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'address'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'note'), '')
  );
  return new;
end;
$$;

revoke all on function private.handle_dream_registration() from public, anon, authenticated;

create trigger dream_registration_on_auth_user_created
after insert on auth.users
for each row execute function private.handle_dream_registration();

alter table public.registration_requests enable row level security;
grant select, update on public.registration_requests to authenticated;
revoke all on public.registration_requests from anon;

create policy registration_requests_select
on public.registration_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or private.current_app_role() = 'admin'
);

create policy registration_requests_admin_update
on public.registration_requests for update to authenticated
using (private.current_app_role() = 'admin')
with check (private.current_app_role() = 'admin');
