'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp, type SignupState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending}>{pending ? '가입 신청 중…' : '가입 신청하기'}</button>;
}

export function SignupForm() {
  const [state, formAction] = useActionState<SignupState, FormData>(signUp, {});
  const [requestedRole, setRequestedRole] = useState('parent');
  return <form action={formAction} className="auth-form signup-form">
    {state.error && <p className="form-alert error" role="alert">{state.error}</p>}
    <label htmlFor="signup-login-id">아이디 *</label>
    <input id="signup-login-id" name="login_id" type="text" autoComplete="username" minLength={3} maxLength={30} placeholder="공백 없이 3~30자" required />
    <label htmlFor="signup-name">이름 *</label>
    <input id="signup-name" name="full_name" type="text" autoComplete="name" minLength={2} maxLength={10} pattern="[가-힣]{2,10}" title="공백 없이 한글 2~10자로 입력해 주세요." placeholder="한글 이름" required />
    <label htmlFor="signup-role">가입 유형 <small>(관리자 참고용)</small></label>
    <select id="signup-role" name="requested_role" value={requestedRole} onChange={(event) => setRequestedRole(event.target.value)} required>
      <option value="parent">부모님</option><option value="student">학생</option><option value="teacher">선생님</option><option value="accountant">회계담당자</option>
    </select>
    {requestedRole === 'teacher' && <><label htmlFor="teacher-invite-code">선생님 초대코드 *</label><input id="teacher-invite-code" name="teacher_invite_code" type="text" autoComplete="off" minLength={6} placeholder="관리자에게 받은 1회용 코드" required /></>}
    <p className="form-help">부모님·학생은 바로 가입됩니다. 선생님은 1회용 초대코드가 필요하며, 회계담당자는 관리자 승인 후 이용할 수 있습니다.</p>
    <div className="signup-two-columns">
      <label><span>비밀번호 *</span><input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="문자 종류 제한 없이 8자 이상" aria-describedby="signup-password-help" required /></label>
      <label><span>비밀번호 확인 *</span><input name="password_confirm" type="password" autoComplete="new-password" minLength={8} placeholder="한 번 더 입력" required /></label>
    </div>
    <p id="signup-password-help" className="form-help">영문·숫자 조합 규칙 없이 어떤 문자든 8자 이상이면 됩니다.</p>
    <details className="signup-optional"><summary>선택 정보 미리 입력하기</summary><div>
      <label htmlFor="signup-phone">연락처</label><input id="signup-phone" name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" />
      <label htmlFor="signup-address">주소</label><input id="signup-address" name="address" type="text" autoComplete="street-address" />
      <label htmlFor="signup-note">비고</label><textarea id="signup-note" name="note" rows={3} placeholder="관리자에게 전달할 내용" />
    </div></details>
    <SubmitButton />
  </form>;
}
