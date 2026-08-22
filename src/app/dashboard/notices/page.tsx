import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { createNotice, deleteNotice, updateNotice } from './actions';
import { NoticeViewTracker } from './notice-view-tracker';

const roleLabel: Record<string, string> = { admin: '관리자', teacher: '선생님', parent: '부모님', student: '학생' };

export default async function NoticesPage({ searchParams }: PageProps<'/dashboard/notices'>) {
  const params = await searchParams;
  const selectedId = typeof params.id === 'string' ? params.id : null;
  const message = typeof params.message === 'string' ? params.message : null;
  const errorMessage = typeof params.error === 'string' ? params.error : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active, account_status').eq('id', data.claims.sub).maybeSingle();
  if (!profile?.is_active || profile.account_status === 'withdrawn') redirect('/dashboard');
  const role = profile.role as AppRole;
  const { data: notices } = await supabase.from('notices').select('id, title, body, is_pinned, published_at, created_at, updated_at').order('is_pinned', { ascending: false }).order('published_at', { ascending: false, nullsFirst: true });
  const rows = notices ?? [];
  const selected = rows.find((notice) => notice.id === selectedId) ?? rows[0] ?? null;

  const metrics = new Map<string, { total: number; readers: number }>();
  let readers: { viewer_id: string; first_viewed_at: string; last_viewed_at: string; view_count: number; profiles: unknown }[] = [];
  if (role === 'admin') {
    const { data: readRows } = await supabase.from('notice_reads').select('notice_id, viewer_id, view_count');
    for (const read of readRows ?? []) {
      const current = metrics.get(read.notice_id) ?? { total: 0, readers: 0 };
      current.total += read.view_count;
      current.readers += 1;
      metrics.set(read.notice_id, current);
    }
    if (selected) {
      const { data: selectedReaders } = await supabase.from('notice_reads').select('viewer_id, first_viewed_at, last_viewed_at, view_count, profiles!notice_reads_viewer_id_fkey(full_name, role, email)').eq('notice_id', selected.id).order('last_viewed_at', { ascending: false });
      readers = (selectedReaders ?? []) as typeof readers;
    }
  }

  return <DashboardShell profile={{ full_name: profile.full_name, role }} activeHref="/dashboard/notices">
    <div className="notice-page-heading"><div><p className="eyebrow">NOTICE BOARD</p><h1>공지게시판</h1><span>{role === 'admin' ? '공지를 작성하고 조회 현황을 확인합니다.' : '드림어린이부의 새로운 소식을 확인하세요.'}</span></div>{role === 'admin' && <strong>전체 {rows.length}건</strong>}</div>
    {message && <p className="form-alert success">{message}</p>}{errorMessage && <p className="form-alert error">{errorMessage}</p>}
    {role === 'admin' && <details className="notice-editor" open={rows.length === 0}><summary>새 공지 작성</summary><form action={createNotice}><label>제목<input name="title" maxLength={100} required /></label><label>내용<textarea name="body" rows={7} maxLength={10000} required /></label><div><label><input type="checkbox" name="is_pinned" /> 상단 고정</label><label><input type="checkbox" name="is_published" defaultChecked /> 즉시 게시</label></div><button type="submit">공지 저장</button></form></details>}
    <div className="notice-board-layout"><aside className="notice-list">{rows.map((notice) => { const count = metrics.get(notice.id); return <Link key={notice.id} href={`/dashboard/notices?id=${notice.id}`} className={selected?.id === notice.id ? 'active' : ''}><div><b>{notice.is_pinned && '📌 '}{notice.title}</b><span>{notice.published_at ? new Date(notice.published_at).toLocaleDateString('ko-KR') : '임시저장'}</span></div>{role === 'admin' && <small>조회 {count?.total ?? 0}회 · {count?.readers ?? 0}명</small>}</Link>; })}{rows.length === 0 && <p>등록된 공지가 없습니다.</p>}</aside>
      <section className="notice-detail">{selected ? <><NoticeViewTracker noticeId={selected.id} /><div className="notice-detail-head"><div><span>{selected.published_at ? '게시됨' : '임시저장'}{selected.is_pinned ? ' · 상단 고정' : ''}</span><h2>{selected.title}</h2><time>{new Date(selected.updated_at).toLocaleString('ko-KR')}</time></div>{role === 'admin' && <b>조회 {metrics.get(selected.id)?.total ?? 0}회</b>}</div><div className="notice-body">{selected.body}</div>
        {role === 'admin' && <><details className="notice-editor compact"><summary>공지 수정</summary><form action={updateNotice}><input type="hidden" name="notice_id" value={selected.id} /><label>제목<input name="title" defaultValue={selected.title} maxLength={100} required /></label><label>내용<textarea name="body" defaultValue={selected.body} rows={7} maxLength={10000} required /></label><div><label><input type="checkbox" name="is_pinned" defaultChecked={selected.is_pinned} /> 상단 고정</label><label><input type="checkbox" name="is_published" defaultChecked={Boolean(selected.published_at)} /> 게시</label></div><button type="submit">수정 저장</button></form></details><form action={deleteNotice} className="notice-delete-form"><input type="hidden" name="notice_id" value={selected.id} /><button type="submit">공지 삭제</button></form><section className="notice-reader-log"><h3>조회자 기록</h3>{readers.map((read) => { const viewer = read.profiles as { full_name?: string; role?: string; email?: string } | null; return <div key={read.viewer_id}><span><b>{viewer?.full_name ?? '알 수 없는 계정'}</b><small>{roleLabel[viewer?.role ?? ''] ?? viewer?.role} · {viewer?.email ?? ''}</small></span><span><b>{read.view_count}회</b><small>최근 {new Date(read.last_viewed_at).toLocaleString('ko-KR')}</small></span></div>; })}{readers.length === 0 && <p>아직 조회한 계정이 없습니다.</p>}</section></>}
      </> : <div className="account-empty">게시된 공지가 없습니다.</div>}</section></div>
  </DashboardShell>;
}
