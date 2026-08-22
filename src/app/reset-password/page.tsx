import Link from 'next/link';
import { updatePassword } from './actions';

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  return <main className="pending-account-page"><section><span className="modal-icon">✦</span><p className="eyebrow">PASSWORD RESET</p><h1>새 비밀번호 설정</h1><p>영문·숫자 조합 규칙 없이 어떤 문자든 8자 이상 입력해 주세요.</p>{error && <p className="form-alert error">{error}</p>}<form action={updatePassword} className="auth-form"><label htmlFor="new-password">새 비밀번호</label><input id="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required /><label htmlFor="new-password-confirm">새 비밀번호 확인</label><input id="new-password-confirm" name="password_confirm" type="password" minLength={8} autoComplete="new-password" required /><button type="submit">비밀번호 변경</button></form><p className="signup-login-link"><Link href="/login">로그인으로 돌아가기</Link></p></section></main>;
}
