'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { assignTeacher, linkParent, linkStudentAccount, updateParentProfile, uploadRelationshipPhoto } from './actions';

type Account = { id: string; full_name: string; email: string | null; phone: string | null; photo_url: string | null };
type Student = { id: string; full_name: string; grade: number; class_name: string | null; profile_id: string | null; photo_url: string | null; guardians: { parent_id: string; relationship: string }[] };
type Teacher = Account & { assignments: { grade: number; class_name: string }[] };

export function RelationshipDirectory({ students, studentAccounts, parents, teachers }: { students: Student[]; studentAccounts: Account[]; parents: Account[]; teachers: Teacher[] }) {
  const [tab, setTab] = useState<'parents' | 'students' | 'teachers'>('students');
  const [grade, setGrade] = useState<number | 'all'>('all');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [parent, setParent] = useState<Account | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [photoTarget, setPhotoTarget] = useState<{ id: string; name: string; kind: 'student' | 'teacher' } | null>(null);
  const linkedIds = useMemo(() => new Set(students.map((item) => item.profile_id).filter(Boolean)), [students]);
  const availableAccounts = studentAccounts.filter((account) => !linkedIds.has(account.id) || account.id === student?.profile_id);
  const visibleStudents = grade === 'all' ? students : students.filter((item) => item.grade === grade);
  const childrenFor = (id: string) => students.filter((item) => item.guardians.some((guardian) => guardian.parent_id === id));
  const visibleParents = unassignedOnly ? parents.filter((item) => childrenFor(item.id).length === 0) : parents;
  const visibleTeachers = unassignedOnly ? teachers.filter((item) => item.assignments.length === 0) : teachers;
  const counts = students.reduce<Record<number, number>>((all, item) => ({ ...all, [item.grade]: (all[item.grade] ?? 0) + 1 }), {});
  const openTab = (next: typeof tab) => { setTab(next); setUnassignedOnly(false); };

  return <section className="relationship-workspace">
    <nav className="relationship-tabs">
      <button className={tab === 'parents' ? 'active' : ''} onClick={() => openTab('parents')}>부모명단보기 <span>{parents.length}</span></button>
      <button className={tab === 'students' ? 'active' : ''} onClick={() => openTab('students')}>학생명단보기 <span>{students.length}</span></button>
      <button className={tab === 'teachers' ? 'active' : ''} onClick={() => openTab('teachers')}>선생님명단보기 <span>{teachers.length}</span></button>
    </nav>

    {tab === 'students' && <><div className="relationship-toolbar"><div className="management-grade-filter"><button className={grade === 'all' ? 'active' : ''} onClick={() => setGrade('all')}>전체 <span>{students.length}</span></button>{[1,2,3,4,5,6].map((item) => <button key={item} className={grade === item ? 'active' : ''} onClick={() => setGrade(item)}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div></div><div className="directory-list directory-students"><div className="directory-head"><span>사진</span><span>학생</span><span>학년·반</span><span>학생계정</span><span>보호자</span></div>{visibleStudents.map((item) => <div className="directory-row" key={item.id}>
      <AvatarButton url={item.photo_url} name={item.full_name} onClick={() => setPhotoTarget({ id: item.id, name: item.full_name, kind: 'student' })}/>
      <button className="directory-name-button" onClick={() => setStudent(item)}>{item.full_name}</button><span>{item.grade}학년 · {item.class_name || '반 미정'}</span><span className={!item.profile_id ? 'unlinked' : ''}>{item.profile_id ? studentAccounts.find((account) => account.id === item.profile_id)?.email || '연결됨' : '미연결'}</span><span className={item.guardians.length === 0 ? 'unlinked' : ''}>{item.guardians.length ? item.guardians.map((guardian) => parents.find((account) => account.id === guardian.parent_id)?.full_name).filter(Boolean).join(', ') : '미연결'}</span>
    </div>)}</div></>}

    {tab === 'parents' && <><FilterToolbar checked={unassignedOnly} onChange={setUnassignedOnly} label="자녀 미연결 부모만 보기" count={visibleParents.length}/><div className="directory-list directory-accounts"><div className="directory-head"><span>이름</span><span>아이디</span><span>연락처</span><span>연결된 자녀</span></div>{visibleParents.map((item) => <button className="directory-row directory-row-button" key={item.id} onClick={() => setParent(item)}><b>{item.full_name}</b><span>{item.email || '이메일 없음'}</span><span>{item.phone || '미입력'}</span><span className={childrenFor(item.id).length === 0 ? 'unlinked' : ''}>{childrenFor(item.id).map((child) => `${child.grade}학년 ${child.full_name}`).join(', ') || '미배정'}</span></button>)}</div></>}

    {tab === 'teachers' && <><FilterToolbar checked={unassignedOnly} onChange={setUnassignedOnly} label="담임반 미배정 선생님만 보기" count={visibleTeachers.length}/><div className="directory-list directory-teachers"><div className="directory-head"><span>사진</span><span>선생님</span><span>아이디</span><span>담당 학년·반</span></div>{visibleTeachers.map((item) => <div className="directory-row" key={item.id}><AvatarButton url={item.photo_url} name={item.full_name} onClick={() => setPhotoTarget({ id: item.id, name: item.full_name, kind: 'teacher' })}/><button className="directory-name-button" onClick={() => setTeacher(item)}>{item.full_name}</button><span>{item.email || '이메일 없음'}</span><span className={item.assignments.length === 0 ? 'unlinked' : ''}>{item.assignments.map((a) => `${a.grade}학년 ${a.class_name}`).join(', ') || '미배정'}</span></div>)}</div></>}

    {student && <Modal close={() => setStudent(null)} title={`${student.full_name} 학생계정 연결`} eyebrow={`${student.grade}학년`}><p className="modal-guide">다른 학생과 연결되지 않은 학생 계정만 표시됩니다.</p><form action={linkStudentAccount} className="relationship-modal-form"><input type="hidden" name="student_id" value={student.id}/><label><span>가입된 학생 계정</span><select name="profile_id" defaultValue={student.profile_id ?? ''}><option value="">연결 안 함</option>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.full_name} · {account.email}</option>)}</select></label><button>학생계정 연결 저장</button></form></Modal>}
    {parent && <Modal close={() => setParent(null)} title={`${parent.full_name} 부모님`} eyebrow="PARENT ACCOUNT"><form action={updateParentProfile} className="relationship-modal-form"><input type="hidden" name="parent_id" value={parent.id}/><label><span>아이디(이메일)</span><input value={parent.email ?? ''} readOnly /></label><label><span>이름</span><input name="full_name" defaultValue={parent.full_name} required /></label><label><span>연락처</span><input name="phone" defaultValue={parent.phone ?? ''} /></label><button>부모 정보 저장</button></form><div className="relationship-linked-list"><h3>연결된 자녀</h3>{childrenFor(parent.id).map((child) => <span key={child.id}>{child.grade}학년 {child.full_name}</span>)}{childrenFor(parent.id).length === 0 && <p>연결된 자녀가 없습니다.</p>}</div><form action={linkParent} className="relationship-modal-form compact"><input type="hidden" name="parent_id" value={parent.id}/><label><span>자녀 연결 추가</span><select name="student_id" required><option value="">학생 선택</option>{students.map((child) => <option key={child.id} value={child.id}>{child.grade}학년 {child.full_name}</option>)}</select></label><label><span>관계</span><input name="relationship" placeholder="예: 어머니" /></label><button>자녀 연결</button></form></Modal>}
    {teacher && <Modal close={() => setTeacher(null)} title={`${teacher.full_name} 담임반 연결`} eyebrow="TEACHER ACCOUNT"><div className="relationship-linked-list"><h3>현재 담당</h3>{teacher.assignments.map((a, index) => <span key={`${a.grade}-${a.class_name}-${index}`}>{a.grade}학년 {a.class_name}</span>)}{teacher.assignments.length === 0 && <p>아직 배정된 담당반이 없습니다.</p>}</div><form action={assignTeacher} className="relationship-modal-form compact"><input type="hidden" name="teacher_id" value={teacher.id}/><label><span>학년</span><select name="grade">{[1,2,3,4,5,6].map((item) => <option key={item} value={item}>{item}학년</option>)}</select></label><label><span>반</span><input name="class_name" defaultValue="전체" /></label><button>담임반 연결</button></form></Modal>}
    {photoTarget && <Modal close={() => setPhotoTarget(null)} title={`${photoTarget.name} 사진 추가`} eyebrow="PROFILE PHOTO"><form action={uploadRelationshipPhoto} className="relationship-modal-form"><input type="hidden" name="target_id" value={photoTarget.id}/><input type="hidden" name="target_kind" value={photoTarget.kind}/><label><span>JPG·PNG·WEBP, 5MB 이하</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required /></label><button>사진 저장</button></form></Modal>}
  </section>;
}

function AvatarButton({ url, name, onClick }: { url: string | null; name: string; onClick: () => void }) { return <button className="directory-avatar-button" onClick={onClick} aria-label={`${name} 사진 추가`}>{url ? <Image src={url} alt="" width={44} height={44}/> : <span>{name.slice(-1)}</span>}<i>＋</i></button>; }
function FilterToolbar({ checked, onChange, label, count }: { checked: boolean; onChange: (value: boolean) => void; label: string; count: number }) { return <div className="relationship-toolbar"><label><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/>{label}</label><span>{count}명</span></div>; }
function Modal({ close, title, eyebrow, children }: { close: () => void; title: string; eyebrow: string; children: React.ReactNode }) { return <div className="student-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="student-modal relationship-modal"><button className="student-modal-close" onClick={close} aria-label="닫기">×</button><div className="student-modal-title"><div className="relationship-letter-avatar">{title.slice(0,1)}</div><div><span>{eyebrow}</span><h2>{title}</h2></div></div>{children}</section></div>; }
