create or replace function public.admin_reject_registration(
  target_user_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer_id uuid := auth.uid();
  clean_reason text := nullif(trim(reason), '');
begin
  if reviewer_id is null or not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and is_active = true and account_status = 'active'
  ) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if clean_reason is null then
    raise exception '반려 사유를 입력해 주세요.';
  end if;

  update public.registration_requests
  set status = 'rejected',
      rejection_reason = left(clean_reason, 300),
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      updated_at = now()
  where user_id = target_user_id and status = 'pending';

  if not found then
    raise exception '승인 대기 중인 가입 신청을 찾을 수 없습니다.';
  end if;

  -- 반려된 신청자가 메일 링크 없이 로그인해 사유를 확인하고 재신청할 수 있게 한다.
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_reject_registration(uuid, text) from public, anon;
grant execute on function public.admin_reject_registration(uuid, text) to authenticated;
