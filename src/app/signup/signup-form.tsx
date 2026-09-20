'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signUp, type SignupState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending}>{pending ? '가입 신청 중…' : '가입 신청하기'}</button>;
}

export function SignupForm() {
  const [state, formAction] = useActionState<SignupState, FormData>(signUp, {});
  return <form action={formAction} className="auth-form signup-form">
    {state.error && <p className="form-alert error" role="alert">{state.error}</p>}
    <label htmlFor="signup-email">이메일 *</label>
    <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="example@email.com" required />
    <label htmlFor="signup-name">이름 *</label>
    <input id="signup-name" name="full_name" type="text" autoComplete="name" maxLength={50} placeholder="이름" required />
    <label htmlFor="signup-role">가입 유형 <small>(관리자 참고용)</small></label>
    <select id="signup-role" name="requested_role" defaultValue="unsure">
      <option value="unsure">잘 모르겠어요</option><option value="parent">부모님</option><option value="student">학생</option><option value="teacher">선생님</option><option value="accountant">회계담당자</option>
    </select>
    <p className="form-help">선택한 유형은 참고 정보이며, 실제 권한은 관리자가 승인할 때 확정합니다.</p>
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
