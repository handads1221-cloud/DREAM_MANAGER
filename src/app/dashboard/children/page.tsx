import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

const statusCopy: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '사유 결석',
};

function formatDate(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

export default async function ParentChildrenPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims?.sub) redirect('/login');
  const userId = authData.claims.sub;

  const [{ data: profile }, { data: guardianRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, is_active, account_status').eq('id', userId).maybeSingle(),
    supabase.from('student_guardians').select('student_id, relationship, is_primary').eq('parent_id', userId),
  ]);
  if (!profile?.is_active || profile.account_status === 'withdrawn' || profile.role !== 'parent') redirect('/dashboard');

  const links = guardianRows ?? [];
  const studentIds = links.map((link) => link.student_id);
  const relationshipByStudent = new Map(links.map((link) => [link.student_id, link.relationship]));

  const [{ data: students }, { data: balances }, { data: attendanceRows }] = studentIds.length
    ? await Promise.all([
        supabase.from('students').select('id, full_name, grade, class_name, school_name, photo_path').in('id', studentIds).eq('is_active', true).order('grade').order('full_name'),
        supabase.from('student_point_balances').select('student_id, balance').in('student_id', studentIds),
        supabase.from('attendance_records').select('student_id, event_id, status, checked_at').in('student_id', studentIds).order('checked_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const eventIds = [...new Set((attendanceRows ?? []).map((row) => row.event_id))];
  const { data: events } = eventIds.length
    ? await supabase.from('attendance_events').select('id, service_date, title').in('id', eventIds)
    : { data: [] };
  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const balanceByStudent = new Map((balances ?? []).map((balance) => [balance.student_id, Number(balance.balance)]));
  const attendanceByStudent = new Map<string, typeof attendanceRows>();
  for (const row of attendanceRows ?? []) {
    const current = attendanceByStudent.get(row.student_id) ?? [];
    current.push(row);
    attendanceByStudent.set(row.student_id, current);
  }

  const photoPaths = [...new Set((students ?? []).map((student) => student.photo_path).filter((path): path is string => Boolean(path)))];
  const { data: signedPhotos } = photoPaths.length
    ? await supabase.storage.from('face-photos').createSignedUrls(photoPaths, 3600)
    : { data: [] };
  const photoUrlByPath = new Map((signedPhotos ?? []).map((photo) => [photo.path, photo.signedUrl]));

  return <DashboardShell profile={{ full_name: profile.full_name, role: 'parent' }} activeHref="/dashboard/children">
    <div className="parent-children-heading">
      <div><p className="eyebrow">MY CHILDREN</p><h1>우리아이</h1><span>자녀의 출석 현황과 드림보석을 한눈에 확인하세요.</span></div>
      <strong>{students?.length ?? 0}<small>명 연결</small></strong>
    </div>

    {(students ?? []).length === 0 ? <section className="parent-children-empty">
      <span>👨‍👩‍👧</span><h2>연결된 자녀가 없습니다</h2>
      <p>관리자가 부모님 계정과 학생 명단을 연결하면 이곳에서 출석과 보석 정보를 볼 수 있습니다.</p>
      <Link href="/dashboard">홈으로 돌아가기</Link>
    </section> : <div className="parent-child-grid">
      {(students ?? []).map((student) => {
        const allRecords = attendanceByStudent.get(student.id) ?? [];
        const attendedRecords = allRecords.filter((record) => record.status === 'present' || record.status === 'late');
        const recentRecords = allRecords
          .map((record) => ({ ...record, event: eventById.get(record.event_id) }))
          .filter((record) => record.event)
          .sort((a, b) => b.event!.service_date.localeCompare(a.event!.service_date))
          .slice(0, 6);
        const latestAttendance = attendedRecords
          .map((record) => eventById.get(record.event_id)?.service_date)
          .filter((date): date is string => Boolean(date))
          .sort((a, b) => b.localeCompare(a))[0];
        const photoUrl = student.photo_path ? photoUrlByPath.get(student.photo_path) : null;

        return <article className="parent-child-card" key={student.id}>
          <header className="parent-child-profile">
            <div className="parent-child-avatar">{photoUrl ? <Image src={photoUrl} alt={`${student.full_name} 학생 얼굴 사진`} width={72} height={72} unoptimized /> : <span>{student.full_name.slice(0, 1)}</span>}</div>
            <div><p>{relationshipByStudent.get(student.id) ?? '자녀'}</p><h2>{student.full_name}</h2><span>{student.grade}학년{student.class_name ? ` ${student.class_name}반` : ''}{student.school_name ? ` · ${student.school_name}` : ''}</span></div>
          </header>

          <div className="parent-child-summary">
            <div className="gems"><span>드림보석</span><strong>{balanceByStudent.get(student.id) ?? 0}<small>개</small></strong></div>
            <div><span>누적 출석</span><strong>{attendedRecords.length}<small>회</small></strong></div>
            <div><span>최근 출석</span><strong className="date">{latestAttendance ? formatDate(latestAttendance) : '기록 없음'}</strong></div>
          </div>

          <section className="parent-attendance-history">
            <div><h3>최근 출석 기록</h3><span>최근 6건</span></div>
            {recentRecords.map((record) => <div className="parent-attendance-row" key={`${student.id}-${record.event_id}`}>
              <time>{formatDate(record.event!.service_date)}</time>
              <span>{record.event!.title}</span>
              <b className={`status-${record.status}`}>{statusCopy[record.status as AttendanceStatus] ?? record.status}</b>
            </div>)}
            {recentRecords.length === 0 && <p>아직 등록된 출석 기록이 없습니다.</p>}
          </section>
        </article>;
      })}
    </div>}
  </DashboardShell>;
}
