create table public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (notice_id, viewer_id)
);

create index notice_reads_viewer_idx on public.notice_reads(viewer_id, last_viewed_at desc);
create index notice_reads_notice_last_idx on public.notice_reads(notice_id, last_viewed_at desc);

alter table public.notice_reads enable row level security;
grant select, insert, update on public.notice_reads to authenticated;
revoke all on public.notice_reads from anon;

drop policy notices_published_select on public.notices;
drop policy notices_staff_insert on public.notices;
drop policy notices_staff_update on public.notices;
drop policy notices_staff_delete on public.notices;

create policy notices_select on public.notices for select to authenticated using (
  published_at is not null or private.current_app_role() = 'admin'
);
create policy notices_admin_insert on public.notices for insert to authenticated
with check (private.current_app_role() = 'admin' and created_by = (select auth.uid()));
create policy notices_admin_update on public.notices for update to authenticated
using (private.current_app_role() = 'admin')
with check (private.current_app_role() = 'admin');
create policy notices_admin_delete on public.notices for delete to authenticated
using (private.current_app_role() = 'admin');

create policy notice_reads_select on public.notice_reads for select to authenticated using (
  viewer_id = (select auth.uid()) or private.current_app_role() = 'admin'
);
create policy notice_reads_self_insert on public.notice_reads for insert to authenticated
with check (viewer_id = (select auth.uid()));
create policy notice_reads_self_update on public.notice_reads for update to authenticated
using (viewer_id = (select auth.uid()))
with check (viewer_id = (select auth.uid()));

create or replace function public.record_notice_view(target_notice_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active and account_status = 'active'
  ) then
    raise exception 'Active account required';
  end if;
  if not exists (
    select 1 from public.notices
    where id = target_notice_id
      and (published_at is not null or private.current_app_role() = 'admin')
  ) then
    raise exception 'Notice not found';
  end if;

  insert into public.notice_reads (notice_id, viewer_id)
  values (target_notice_id, (select auth.uid()))
  on conflict (notice_id, viewer_id) do update
    set last_viewed_at = now(),
        view_count = public.notice_reads.view_count + 1;
end;
$$;

revoke all on function public.record_notice_view(uuid) from public, anon;
grant execute on function public.record_notice_view(uuid) to authenticated;
