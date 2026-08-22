import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

const roleLabel = {
  admin: '관리자',
  teacher: '선생님',
  parent: '부모님',
  student: '학생',
} as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, grade, class_name')
    .eq('id', data.claims.sub)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="pending-account-page">
        <section>
          <span className="modal-icon">✦</span>
          <p className="eyebrow">ACCOUNT PENDING</p>
          <h1>계정 연결을 준비하고 있어요</h1>
          <p>로그인은 완료됐지만 어린이부 명단과 아직 연결되지 않았습니다. 관리자에게 이름과 계정 이메일을 알려주세요.</p>
          <div className="pending-actions">
            <Link href="/">서비스 미리보기</Link>
            <form action={signOut}><button type="submit">로그아웃</button></form>
          </div>
        </section>
      </main>
    );
  }

  const role = roleLabel[profile.role as keyof typeof roleLabel] ?? '사용자';
  return (
    <main className="live-dashboard">
      <header>
        <div><p className="eyebrow">LIVE ACCOUNT</p><h1>{profile.full_name} {role}</h1></div>
        <form action={signOut}><button type="submit">로그아웃</button></form>
      </header>
      <section className="live-welcome">
        <span>안전하게 로그인되었습니다</span>
        <h2>{role} 계정에 맞는 기능을 준비 중입니다.</h2>
        <p>{profile.grade ? `${profile.grade}학년 ${profile.class_name ?? ''}` : '드림 어린이부'} · 실제 데이터는 Supabase 권한에 따라 표시됩니다.</p>
        {profile.role === 'admin' ? (
          <Link href="/dashboard/students">학생명단관리 열기 →</Link>
        ) : (
          <Link href="/">전체 기능 미리보기 보기 →</Link>
        )}
      </section>
    </main>
  );
}
