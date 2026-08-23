import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { assignTeacher, createAndLinkStudent, linkParent, linkStudentAccount } from './actions';
import { RelationshipDirectory } from './relationship-directory';

export default async function RelationshipsPage({ searchParams }: PageProps<'/dashboard/relationships'>) {
  const params = await searchParams; const message = typeof params.message === 'string' ? params.message : ''; const error = typeof params.error === 'string' ? params.error : '';
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');
  const [{ data: students }, { data: accounts }, { data: guardians }, { data: assignments }] = await Promise.all([
    supabase.from('students').select('id, full_name, grade, class_name, profile_id, primary_parent_id').eq('is_active', true).order('grade').order('full_name'),
    supabase.from('profiles').select('id, full_name, email, role').in('role', ['student', 'parent', 'teacher']).eq('is_active', true).order('full_name'),
    supabase.from('student_guardians').select('student_id, parent_id, relationship'),
    supabase.from('teacher_assignments').select('teacher_id, grade, class_name, school_year').eq('school_year', new Date().getFullYear()),
  ]);
  const studentAccounts = (accounts ?? []).filter(a => a.role === 'student'); const parents = (accounts ?? []).filter(a => a.role === 'parent'); const teachers = (accounts ?? []).filter(a => a.role === 'teacher');
  const linkedStudentAccountIds = new Set((students ?? []).map(s => s.profile_id).filter(Boolean)); const unlinkedStudentAccounts = studentAccounts.filter(a => !linkedStudentAccountIds.has(a.id));
  const accountName = new Map((accounts ?? []).map(a => [a.id, a.full_name]));
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/relationships">
    <div className="module-heading"><div><p className="eyebrow">RELATIONSHIPS</p><h1>계정·가족·담당 연결</h1><span>학생명단을 기준으로 로그인 계정과 보호자, 담당 선생님을 연결합니다.</span></div></div>
    {message && <p className="form-alert success account-feedback">{message}</p>}{error && <p className="form-alert error account-feedback">{error}</p>}
    {unlinkedStudentAccounts.length > 0 && <section className="unlinked-accounts"><h2>연결이 필요한 학생 계정</h2><p>연결 전에는 QR 출석과 본인 출석·보석 조회를 사용할 수 없습니다.</p><div>{unlinkedStudentAccounts.map(account => <form key={account.id} action={createAndLinkStudent}><input type="hidden" name="profile_id" value={account.id}/><span><b>{account.full_name}</b><small>{account.email}</small></span><select name="grade" aria-label={`${account.full_name} 학년`}>{[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}</select><button>명단 추가·연결</button></form>)}</div></section>}
    <section className="linkage-grid"><article><h2>학생 계정 연결</h2><p>기존 학생명단과 로그인 계정을 연결합니다.</p><form action={linkStudentAccount}><select name="student_id" required>{(students ?? []).map(s => <option key={s.id} value={s.id}>{s.grade}학년 {s.full_name}</option>)}</select><select name="profile_id"><option value="">연결 해제</option>{studentAccounts.map(a => <option key={a.id} value={a.id}>{a.full_name} · {a.email}</option>)}</select><button>학생계정 연결</button></form></article>
      <article><h2>부모–자녀 연결</h2><p>부모님은 연결된 자녀 정보만 볼 수 있습니다.</p><form action={linkParent}><select name="student_id" required>{(students ?? []).map(s => <option key={s.id} value={s.id}>{s.grade}학년 {s.full_name}</option>)}</select><select name="parent_id" required><option value="">부모 선택</option>{parents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select><input name="relationship" placeholder="관계 (예: 어머니)" /><button>부모계정 연결</button></form></article>
      <article><h2>선생님 담당 배정</h2><p>학년 전체 또는 특정 반을 담당하도록 설정합니다.</p><form action={assignTeacher}><select name="teacher_id" required><option value="">선생님 선택</option>{teachers.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select><select name="grade">{[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}</select><input name="class_name" placeholder="전체 또는 반 이름" defaultValue="전체" /><button>담당 배정</button></form></article></section>
    <RelationshipDirectory students={(students ?? []).map(s => ({ ...s, studentAccount: s.profile_id ? accountName.get(s.profile_id) ?? '계정 확인 필요' : '미연결', parent: (() => { const parent = (guardians ?? []).find(g => g.student_id === s.id); return parent ? `${accountName.get(parent.parent_id) ?? '계정 확인 필요'} (${parent.relationship})` : '미연결'; })() }))} />
    <section className="assignment-status"><h2>선생님 배정</h2>{(assignments ?? []).map((a, index) => <span key={`${a.teacher_id}-${a.grade}-${a.class_name}-${index}`}>{accountName.get(a.teacher_id)} · {a.grade}학년 {a.class_name}</span>)}</section>
  </DashboardShell>;
}
