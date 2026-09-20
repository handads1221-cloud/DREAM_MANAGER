import Image from 'next/image';
import Link from 'next/link';
import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <main className="auth-page signup-page">
      <section className="auth-visual">
        <Image src="/dream-group.jpg" alt="드림어린이부 단체사진" fill sizes="(max-width: 820px) 100vw, 48vw" priority />
        <div className="auth-overlay" />
        <div className="auth-visual-copy">
          <span>청주신흥교회 드림 어린이부</span>
          <h1>우리 함께<br />시작해요</h1>
          <p>아이디와 계정 유형을 선택해 드림어린이부와 함께 시작해요.</p>
        </div>
      </section>
      <section className="auth-form-wrap signup-form-wrap">
        <div className="auth-card signup-card">
          <p className="eyebrow">CREATE ACCOUNT</p>
          <h2>회원가입</h2>
          <p className="auth-description">아이디·이름·비밀번호와 계정 유형을 입력해 주세요.</p>
          <SignupForm />
          <p className="signup-login-link">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
        </div>
      </section>
    </main>
  );
}
