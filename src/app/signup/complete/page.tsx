import Link from 'next/link';

export default async function SignupCompletePage({ searchParams }: PageProps<'/signup/complete'>) {
  const params = await searchParams;
  const email = typeof params.email === 'string' ? params.email : '';
  return <main className="pending-account-page signup-complete-page"><section>
    <span className="modal-icon">✓</span><p className="eyebrow">REQUEST COMPLETE</p>
    <h1>가입 신청이 완료되었습니다</h1>
    <p><b>{email}</b><br />관리자가 신청 내용을 확인하고 권한을 승인하면 로그인할 수 있습니다.</p>
    <ol><li>관리자가 가입 유형과 정보를 확인합니다.</li><li>부모·학생·선생님 등 실제 권한을 부여합니다.</li><li>승인 후 가입한 이메일과 비밀번호로 로그인합니다.</li></ol>
    <div className="pending-actions"><Link href="/login">로그인 화면으로</Link></div>
  </section></main>;
}
