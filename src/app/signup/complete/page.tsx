import Link from 'next/link';

export default async function SignupCompletePage({ searchParams }: PageProps<'/signup/complete'>) {
  const params = await searchParams;
  const loginId = typeof params.login_id === 'string' ? params.login_id : '';
  const requiresApproval = params.role === 'accountant';
  return <main className="pending-account-page signup-complete-page"><section>
    <span className="modal-icon">✓</span><p className="eyebrow">REQUEST COMPLETE</p>
    <h1>{requiresApproval ? '가입 신청이 완료되었습니다' : '회원가입이 완료되었습니다'}</h1>
    <p><b>{loginId}</b><br />{requiresApproval ? '회계담당자는 관리자 승인 후 이용할 수 있습니다.' : '지금 바로 로그인할 수 있습니다.'}</p>
    <ol>{requiresApproval ? <><li>관리자가 회계담당자 권한을 확인합니다.</li><li>승인 후 아이디와 비밀번호로 로그인합니다.</li></> : <><li>로그인 화면으로 이동합니다.</li><li>가입한 아이디와 비밀번호를 입력합니다.</li></>}</ol>
    <div className="pending-actions"><Link href="/login">로그인 화면으로</Link></div>
  </section></main>;
}
