import Image from 'next/image';
import Link from 'next/link';
import { signIn } from './actions';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Image src="/dream-group.jpg" alt="드림어린이부 단체사진" fill sizes="(max-width: 820px) 100vw, 55vw" priority />
        <div className="auth-overlay" />
        <div className="auth-visual-copy">
          <span>청주신흥교회 드림 어린이부</span>
          <h1>사랑 안에서<br />꿈이 자라요</h1>
          <p>출석과 드림보석, 우리 아이의 소식을 안전하게 만나보세요.</p>
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <p className="eyebrow">DREAM MANAGER</p>
          <h2>반가워요!</h2>
          <p className="auth-description">가입한 이메일과 비밀번호로 로그인해 주세요.</p>
          {error && <p className="form-alert error">{error}</p>}
          {message && <p className="form-alert success">{message}</p>}
          <form action={signIn} className="auth-form">
            <label htmlFor="loginId">이메일</label>
            <input id="loginId" name="loginId" type="text" autoComplete="username" placeholder="example@email.com" required />
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력하세요" required />
            <button type="submit">로그인</button>
          </form>
          <Link href="/signup" className="signup-link-button">처음이신가요? 가입 신청하기</Link>
          <small className="auth-help">가입 후 이메일 인증과 관리자 승인이 완료되면 계정별 홈을 이용할 수 있습니다.</small>
        </div>
      </section>
    </main>
  );
}
