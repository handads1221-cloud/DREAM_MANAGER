'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { createStudent, deleteStudent, updateStudent } from './actions';
import type { Student } from './types';

const emptyLabel = '미등록';

export function StudentManager({ initialStudents }: { initialStudents: Student[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [grade, setGrade] = useState<number | 'all'>('all');
  const [selected, setSelected] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleStudents = useMemo(
    () => grade === 'all' ? students : students.filter((student) => student.grade === grade),
    [grade, students],
  );

  const counts = useMemo(() => {
    return students.reduce<Record<number, number>>((result, student) => {
      result[student.grade] = (result[student.grade] ?? 0) + 1;
      return result;
    }, {});
  }, [students]);

  const openStudent = (student: Student) => {
    setSelected(student);
    setEditing(false);
    setMessage(null);
  };

  const closeModal = () => {
    if (pending) return;
    setSelected(null);
    setAdding(false);
    setEditing(false);
    setMessage(null);
  };

  const submitCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createStudent(formData);
      if (!result.ok) { setMessage({ kind: 'error', text: result.message }); return; }
      setStudents((current) => [...current, result.student].sort((a, b) => a.grade - b.grade || a.full_name.localeCompare(b.full_name, 'ko')));
      setAdding(false);
      setSelected(result.student);
      setEditing(false);
      setMessage({ kind: 'success', text: result.message });
    });
  };

  const submitDelete = () => {
    if (!selected || !window.confirm(`${selected.full_name} 학생을 현재 명단에서 삭제할까요?\n출석·보석 기록은 보존됩니다.`)) return;
    const formData = new FormData(); formData.set('id', selected.id);
    startTransition(async () => {
      const result = await deleteStudent(formData);
      if (!result.ok) { setMessage({ kind: 'error', text: result.message }); return; }
      setStudents((current) => current.filter((student) => student.id !== selected.id));
      setSelected(null); setEditing(false); setMessage(null);
    });
  };

  const submitUpdate = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateStudent(formData);
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.message });
        return;
      }
      setStudents((current) => current.map((student) => student.id === result.student.id ? result.student : student));
      setSelected(result.student);
      setEditing(false);
      setMessage({ kind: 'success', text: result.message });
    });
  };

  return (
    <>
      <div className="student-page-intro">
        <div><p>STUDENT DIRECTORY</p><h1>학생명단관리</h1><span>드림어린이부 1~6학년 학생 정보를 확인하고 관리합니다.</span></div>
        <div className="student-heading-actions"><strong>전체 {students.length}명</strong><button onClick={() => { setAdding(true); setSelected(null); setMessage(null); }}>＋ 학생 추가</button></div>
      </div>
      <section className="student-filter" aria-label="학년별 학생 명단 필터">
        <button className={grade === 'all' ? 'active' : ''} onClick={() => setGrade('all')}>
          전체 <span>{students.length}</span>
        </button>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <button key={item} className={grade === item ? 'active' : ''} onClick={() => setGrade(item)}>
            {item}학년 <span>{counts[item] ?? 0}</span>
          </button>
        ))}
      </section>

      <div className="student-list-heading">
        <div><b>{grade === 'all' ? '전체 학생' : `${grade}학년`}</b><span>{visibleStudents.length}명</span></div>
        <p>학생을 선택하면 등록된 상세정보를 확인하고 수정할 수 있습니다.</p>
      </div>

      <section className="student-table" aria-live="polite">
        <div className="student-table-head"><span>학년</span><span>이름</span><span>반</span><span>학교</span><span>연락처</span><span>관리</span></div>
        {visibleStudents.map((student) => (
          <article className="student-row" key={student.id}>
            <span className={`student-grade-badge grade-${student.grade}`}>{student.grade}학년</span>
            <button type="button" className="student-name-button" onClick={() => openStudent(student)} aria-label={`${student.full_name} 상세정보 보기`}>{student.full_name}</button><span>{student.class_name ?? '미등록'}</span><span>{student.school_name ?? '미등록'}</span><span>{student.phone ?? '미등록'}</span>
            <button type="button" onClick={() => openStudent(student)}>상세·수정</button>
          </article>
        ))}
        {visibleStudents.length === 0 && <p className="student-empty-row">해당 학년에 등록된 학생이 없습니다.</p>}
      </section>

      {adding && (
        <div className="student-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-add-title">
            <button className="student-modal-close" onClick={closeModal} aria-label="학생 추가 닫기">×</button>
            <div className="student-modal-title"><div className="student-avatar grade-1">＋</div><div><span>NEW STUDENT</span><h2 id="student-add-title">학생 추가</h2></div></div>
            {message && <p className={`student-form-message ${message.kind}`} role="status">{message.text}</p>}
            <form action={submitCreate} className="student-edit-form">
              <div className="student-form-grid">
                <label><span>이름 *</span><input name="full_name" required maxLength={50} autoFocus /></label>
                <label><span>학년 *</span><select name="grade" defaultValue="1">{[1,2,3,4,5,6].map((item) => <option key={item} value={item}>{item}학년</option>)}</select></label>
                <label><span>반 이름</span><input name="class_name" placeholder="예: 사랑반" /></label>
                <label><span>연락처</span><input name="phone" inputMode="tel" placeholder="010-0000-0000" /></label>
                <label className="wide"><span>주소</span><input name="address" /></label>
                <label><span>학교명</span><input name="school_name" /></label>
                <label><span>생년월일</span><input type="date" name="birth_date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} /></label>
                <label><span>부모 계정 ID</span><input name="primary_parent_id" placeholder="추후 연결 가능" /></label>
                <label className="wide"><span>얼굴 사진 (JPG·PNG·WEBP, 5MB 이하)</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" /></label>
                <label className="wide"><span>비고</span><textarea name="note" rows={3} /></label>
              </div>
              <div className="student-modal-actions"><button type="button" className="secondary" onClick={closeModal} disabled={pending}>취소</button><button type="submit" disabled={pending}>{pending ? '추가 중…' : '학생 추가'}</button></div>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="student-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <button className="student-modal-close" onClick={closeModal} aria-label="학생 상세정보 닫기">×</button>
            <div className="student-modal-title">
              {selected.photo_url ? <Image className="student-face-photo" src={selected.photo_url} alt={`${selected.full_name} 얼굴 사진`} width={46} height={46} /> : <div className={`student-avatar grade-${selected.grade}`}>{selected.full_name.slice(-1)}</div>}
              <div><span>{selected.grade}학년 {selected.class_name ?? '반 미정'}</span><h2 id="student-modal-title">{selected.full_name}</h2></div>
            </div>

            {message && <p className={`student-form-message ${message.kind}`} role="status">{message.text}</p>}

            {editing ? (
              <form action={submitUpdate} className="student-edit-form">
                <input type="hidden" name="id" value={selected.id} />
                <div className="student-form-grid">
                  <label><span>이름 *</span><input name="full_name" defaultValue={selected.full_name} required maxLength={50} /></label>
                  <label><span>학년 *</span><select name="grade" defaultValue={selected.grade}>{[1,2,3,4,5,6].map((item) => <option key={item} value={item}>{item}학년</option>)}</select></label>
                  <label><span>반 이름</span><input name="class_name" defaultValue={selected.class_name ?? ''} placeholder="예: 사랑반" /></label>
                  <label><span>연락처</span><input name="phone" defaultValue={selected.phone ?? ''} inputMode="tel" placeholder="010-0000-0000" /></label>
                  <label className="wide"><span>주소</span><input name="address" defaultValue={selected.address ?? ''} /></label>
                  <label><span>학교명</span><input name="school_name" defaultValue={selected.school_name ?? ''} /></label>
                  <label><span>생년월일</span><input type="date" name="birth_date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={selected.birth_date ?? ''} /></label>
                  <label><span>부모 계정 ID</span><input name="primary_parent_id" defaultValue={selected.primary_parent_id ?? ''} placeholder="계정 연결 시 입력" /></label>
                  <label className="wide"><span>얼굴 사진 변경 (JPG·PNG·WEBP, 5MB 이하)</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" /></label>
                  <label className="wide"><span>비고</span><textarea name="note" defaultValue={selected.note ?? ''} rows={3} /></label>
                  <label className="student-active-check"><input type="checkbox" name="is_active" defaultChecked={selected.is_active} /><span>현재 명단에 표시되는 재학생</span></label>
                </div>
                <div className="student-modal-actions">
                  <button type="button" className="secondary" onClick={() => setEditing(false)} disabled={pending}>취소</button>
                  <button type="submit" disabled={pending}>{pending ? '저장 중…' : '변경사항 저장'}</button>
                </div>
              </form>
            ) : (
              <>
                <dl className="student-detail-list">
                  <div><dt>이름</dt><dd>{selected.full_name}</dd></div>
                  <div><dt>학년</dt><dd>{selected.grade}학년</dd></div>
                  <div><dt>반 이름</dt><dd>{selected.class_name ?? emptyLabel}</dd></div>
                  <div><dt>연락처</dt><dd>{selected.phone ?? emptyLabel}</dd></div>
                  <div className="wide"><dt>주소</dt><dd>{selected.address ?? emptyLabel}</dd></div>
                  <div><dt>학교명</dt><dd>{selected.school_name ?? emptyLabel}</dd></div>
                  <div><dt>생년월일</dt><dd>{selected.birth_date ? new Date(`${selected.birth_date}T00:00:00`).toLocaleDateString('ko-KR') : emptyLabel}</dd></div>
                  <div><dt>부모 계정</dt><dd>{selected.primary_parent_id ?? '연결 안 됨'}</dd></div>
                  <div className="wide"><dt>비고</dt><dd>{selected.note ?? emptyLabel}</dd></div>
                </dl>
                <div className="student-modal-actions">
                  <button type="button" className="danger" onClick={submitDelete} disabled={pending}>명단에서 삭제</button>
                  <button type="button" className="secondary" onClick={closeModal}>닫기</button>
                  <button type="button" onClick={() => { setEditing(true); setMessage(null); }}>수정하기</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
