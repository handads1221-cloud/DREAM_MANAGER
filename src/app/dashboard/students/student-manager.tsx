'use client';

import { useMemo, useState, useTransition } from 'react';
import { updateStudent } from './actions';
import type { Student } from './types';

const emptyLabel = '미등록';

export function StudentManager({ initialStudents }: { initialStudents: Student[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [grade, setGrade] = useState<number | 'all'>('all');
  const [selected, setSelected] = useState<Student | null>(null);
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
    setEditing(false);
    setMessage(null);
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

      <section className="student-grid" aria-live="polite">
        {visibleStudents.map((student) => (
          <article className="student-card" key={student.id}>
            <div className={`student-avatar grade-${student.grade}`}>{student.full_name.slice(-1)}</div>
            <div className="student-summary">
              <span>{student.grade}학년 {student.class_name ?? '반 미정'}</span>
              <h2>{student.full_name}</h2>
              <p>{student.school_name ?? '학교 미등록'} · {student.is_active ? '재학' : '비활성'}</p>
            </div>
            <button onClick={() => openStudent(student)}>상세정보 보기</button>
          </article>
        ))}
      </section>

      {selected && (
        <div className="student-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <button className="student-modal-close" onClick={closeModal} aria-label="학생 상세정보 닫기">×</button>
            <div className="student-modal-title">
              <div className={`student-avatar grade-${selected.grade}`}>{selected.full_name.slice(-1)}</div>
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
                  <label><span>부모 계정 ID</span><input name="primary_parent_id" defaultValue={selected.primary_parent_id ?? ''} placeholder="계정 연결 시 입력" /></label>
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
                  <div><dt>부모 계정</dt><dd>{selected.primary_parent_id ?? '연결 안 됨'}</dd></div>
                  <div className="wide"><dt>비고</dt><dd>{selected.note ?? emptyLabel}</dd></div>
                </dl>
                <div className="student-modal-actions">
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
