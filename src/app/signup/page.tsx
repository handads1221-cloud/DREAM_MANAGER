import Image from 'next/image';
import Link from 'next/link';
import { signUp } from './actions';

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <main className="auth-page signup-page">
      <section className="auth-visual">
        <Image src="/dream-group.jpg" alt="드림어린이부 단체사진" fill sizes="(max-width: 820px) 100vw, 48vw" priority />
        <div className="auth-overlay" />
        <div className="auth-visual-copy">
          <span>청주신흥교회 드림 어린이부</span>
          <h1>우리 함께<br />시작해요</h1>
          <p>가입 신청 후 관리자가 확인하여 부모·학생·선생님 권한을 연결합니다.</p>
        </div>
      </section>
      <section className="auth-form-wrap signup-form-wrap">
        <div className="auth-card signup-card">
          <p className="eyebrow">CREATE ACCOUNT</p>
          <h2>가입 신청</h2>
          <p className="auth-description">이메일·이름·비밀번호만 입력해도 신청할 수 있습니다. 나머지는 나중에 추가할 수 있어요.</p>
          {error && <p className="form-alert error">{error}</p>}
          <form action={signUp} className="auth-form signup-form">
            <label htmlFor="signup-email">이메일 *</label>
            <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="example@email.com" required />
            <label htmlFor="signup-name">이름 *</label>
            <input id="signup-name" name="full_name" type="text" autoComplete="name" maxLength={50} placeholder="이름" required />
            <div className="signup-two-columns">
              <label><span>비밀번호 *</span><input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="8자 이상" required /></label>
              <label><span>비밀번호 확인 *</span><input name="password_confirm" type="password" autoComplete="new-password" minLength={8} placeholder="한 번 더 입력" required /></label>
            </div>
            <details className="signup-optional">
              <summary>선택 정보 미리 입력하기</summary>
              <div>
                <label htmlFor="signup-phone">연락처</label><input id="signup-phone" name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" />
                <label htmlFor="signup-address">주소</label><input id="signup-address" name="address" type="text" autoComplete="street-address" />
                <label htmlFor="signup-note">비고</label><textarea id="signup-note" name="note" rows={3} placeholder="관리자에게 전달할 내용" />
              </div>
            </details>
            <button type="submit">가입 신청하기</button>
          </form>
          <p className="signup-login-link">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
        </div>
      </section>
    </main>
  );
}
