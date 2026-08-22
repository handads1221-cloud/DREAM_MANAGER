import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { assignTeacher, linkParent, linkStudentAccount } from './actions';

export default async function RelationshipsPage() {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');
  const [{ data: students }, { data: accounts }, { data: guardians }, { data: assignments }] = await Promise.all([
    supabase.from('students').select('id, full_name, grade, class_name, profile_id, primary_parent_id').eq('is_active', true).order('grade').order('full_name'),
    supabase.from('profiles').select('id, full_name, role').in('role', ['student', 'parent', 'teacher']).eq('is_active', true).order('full_name'),
    supabase.from('student_guardians').select('student_id, parent_id, relationship'),
    supabase.from('teacher_assignments').select('teacher_id, grade, class_name, school_year').eq('school_year', new Date().getFullYear()),
  ]);
  const studentAccounts = (accounts ?? []).filter(a => a.role === 'student'); const parents = (accounts ?? []).filter(a => a.role === 'parent'); const teachers = (accounts ?? []).filter(a => a.role === 'teacher');
  const accountName = new Map((accounts ?? []).map(a => [a.id, a.full_name]));
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/relationships">
    <div className="module-heading"><div><p className="eyebrow">RELATIONSHIPS</p><h1>계정·가족·담당 연결</h1><span>학생명단을 기준으로 로그인 계정과 보호자, 담당 선생님을 연결합니다.</span></div></div>
    <section className="linkage-grid"><article><h2>학생 계정 연결</h2><p>학생이 로그인하면 본인의 출석과 보석을 볼 수 있습니다.</p><form action={linkStudentAccount}><select name="student_id" required>{(students ?? []).map(s => <option key={s.id} value={s.id}>{s.grade}학년 {s.full_name}</option>)}</select><select name="profile_id"><option value="">연결 해제</option>{studentAccounts.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select><button>학생계정 연결</button></form></article>
      <article><h2>부모–자녀 연결</h2><p>부모님은 연결된 자녀 정보만 볼 수 있습니다.</p><form action={linkParent}><select name="student_id" required>{(students ?? []).map(s => <option key={s.id} value={s.id}>{s.grade}학년 {s.full_name}</option>)}</select><select name="parent_id" required><option value="">부모 선택</option>{parents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select><input name="relationship" placeholder="관계 (예: 어머니)" /><button>부모계정 연결</button></form></article>
      <article><h2>선생님 담당 배정</h2><p>학년 전체 또는 특정 반을 담당하도록 설정합니다.</p><form action={assignTeacher}><select name="teacher_id" required><option value="">선생님 선택</option>{teachers.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select><select name="grade">{[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}</select><input name="class_name" placeholder="전체 또는 반 이름" defaultValue="전체" /><button>담당 배정</button></form></article></section>
    <section className="link-status"><h2>현재 연결 현황</h2><div>{(students ?? []).map(s => { const parent = (guardians ?? []).find(g => g.student_id === s.id); return <div key={s.id}><b>{s.grade}학년 {s.full_name}</b><span>학생계정: {s.profile_id ? accountName.get(s.profile_id) : '미연결'}</span><span>부모: {parent ? `${accountName.get(parent.parent_id)} (${parent.relationship})` : '미연결'}</span></div>; })}</div></section>
    <section className="assignment-status"><h2>선생님 배정</h2>{(assignments ?? []).map((a, index) => <span key={`${a.teacher_id}-${a.grade}-${a.class_name}-${index}`}>{accountName.get(a.teacher_id)} · {a.grade}학년 {a.class_name}</span>)}</section>
  </DashboardShell>;
}
