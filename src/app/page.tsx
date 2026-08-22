"use client";

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type Role = '선생님' | '관리자' | '부모님' | '학생';

const roleData: Record<Role, {
  name: string;
  greeting: string;
  actions: { icon: string; label: string; tone: string }[];
  features: { eyebrow: string; title: string; copy: string; meta: string }[];
}> = {
  선생님: {
    name: '박하늘 선생님',
    greeting: '오늘도 아이들의 반짝이는 하루를 함께 만들어 주세요.',
    actions: [
      { icon: '✓', label: '대리 출석', tone: 'mint' },
      { icon: '◆', label: '보석 선물', tone: 'yellow' },
      { icon: '▦', label: '학생 명단', tone: 'blue' },
      { icon: '☎', label: '가족 연락처', tone: 'pink' },
    ],
    features: [
      { eyebrow: 'CHAT POINT', title: '채팅으로 보석 지급', copy: '“권지민 1포인트”처럼 말하면 학생과 보석 수를 확인하고 지급해요.', meta: '빠른 지급 시작 →' },
      { eyebrow: 'CLASS', title: '우리 반 학생 12명', copy: '학년·반별 명단에서 학생을 누르고 오늘 또는 선택 날짜로 출석을 등록해요.', meta: '3학년 사랑반 보기 →' },
      { eyebrow: 'CONTACT', title: '학생·부모 연락처', copy: '담당 학생과 연결된 보호자 정보를 확인하고 전화번호를 눌러 바로 연락해요.', meta: '연락처 찾기 →' },
    ],
  },
  관리자: {
    name: '김드림 관리자',
    greeting: '드림어린이부 운영 현황과 오늘의 기록을 확인하세요.',
    actions: [
      { icon: '＋', label: '학생 추가', tone: 'mint' },
      { icon: '▦', label: '출석 QR', tone: 'yellow' },
      { icon: '▤', label: '공지 작성', tone: 'blue' },
      { icon: '⚙', label: '계정 관리', tone: 'pink' },
    ],
    features: [
      { eyebrow: 'STUDENTS', title: '1–6학년 명단 관리', copy: '신규 학생을 등록하고 학년·반을 관리하며 새 학기에 전체 학년을 일괄 승급해요.', meta: '학생 50명 관리 →' },
      { eyebrow: 'SUNDAY QR', title: '이번 주 출석 QR', copy: '매주 일요일 새 QR을 생성하고 예배 안내문과 함께 큰 화면에 표시해요.', meta: 'QR 화면 열기 →' },
      { eyebrow: 'ACCOUNTS', title: '계정·가족 연결 관리', copy: '부모·학생·선생님·관리자 권한, 연락처, 주소와 부모–자녀 연결을 관리해요.', meta: '계정 87개 관리 →' },
    ],
  },
  부모님: {
    name: '권지민 보호자',
    greeting: '지민이의 이번 주 소식과 성장 기록을 확인해 보세요.',
    actions: [
      { icon: '▤', label: '공지사항', tone: 'mint' },
      { icon: '◌', label: '문의하기', tone: 'yellow' },
      { icon: '☎', label: '선생님 정보', tone: 'blue' },
      { icon: '♥', label: '우리아이', tone: 'pink' },
    ],
    features: [
      { eyebrow: 'MY CHILD', title: '권지민 · 3학년 사랑반', copy: '이번 달 출석 4회 중 4회, 현재 보석 24개를 모았어요.', meta: '출석·보석 자세히 →' },
      { eyebrow: 'MESSAGE', title: '관리자에게 문의하기', copy: '궁금한 점을 비공개 메시지로 남기고 답변 완료 알림을 받아요.', meta: '새 문의 작성 →' },
      { eyebrow: 'TEACHER', title: '우리 반 박하늘 선생님', copy: '담당 선생님의 소속과 연락처를 확인하고 휴대폰에서 바로 전화해요.', meta: '연락처 보기 →' },
    ],
  },
  학생: {
    name: '권지민 어린이',
    greeting: '이번 주에도 출석하고 반짝이는 보석을 모아 봐요!',
    actions: [
      { icon: '▦', label: 'QR 출석', tone: 'mint' },
      { icon: '◆', label: '내 보석', tone: 'yellow' },
      { icon: '✓', label: '출석 현황', tone: 'blue' },
      { icon: '▤', label: '공지사항', tone: 'pink' },
    ],
    features: [
      { eyebrow: 'MY GEM', title: '반짝이는 보석 24개', copy: '예배 출석과 활동으로 받은 내 보석과 최근 지급 기록을 확인해요.', meta: '내 보석 보기 →' },
      { eyebrow: 'ATTENDANCE', title: '이번 달 출석 100%', copy: '로그인한 내 계정의 날짜별 출석 기록만 안전하게 확인할 수 있어요.', meta: '출석 달력 보기 →' },
      { eyebrow: 'MY TEACHER', title: '박하늘 선생님', copy: '3학년 사랑반 담당 선생님의 이름과 연락처를 확인해요.', meta: '선생님 정보 →' },
    ],
  },
};

export default function Home() {
  const [role, setRole] = useState<Role>('선생님');
  const [modal, setModal] = useState<string | null>(null);
  const current = roleData[role];
  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="brand">
          <Image src="/church-logo.png" alt="청주신흥교회" className="church-logo" width={174} height={64} priority />
          <span className="brand-divider" />
          <div>
            <strong>드림 어린이부</strong>
            <small>함께 자라고, 함께 꿈꾸는 우리</small>
          </div>
        </div>
        <Link href="/login" className="profile-button" aria-label="로그인 화면 열기">
          <span className="avatar">{current.name.slice(0, 1)}</span>
          <span className="profile-copy"><b>{current.name}</b><small>{role} 계정 · 데모</small></span>
          <span aria-hidden="true">⌄</span>
        </Link>
      </header>

      <div className="layout">
        <aside className="sidebar" aria-label="주요 메뉴">
          <nav>
            <a className="active" href="#today"><span>⌂</span>홈</a>
            <a href="#attendance"><span>✓</span>출석</a>
            <a href="#points"><span>◆</span>드림보석</a>
            <a href="#students"><span>♙</span>학생·가족</a>
            <a href="#notice"><span>▤</span>공지사항</a>
            <a href="#message"><span>◌</span>문의·메시지</a>
          </nav>
          <div className="sunday-card">
            <span>이번 주 예배</span>
            <strong>8월 23일 일요일</strong>
            <small>오전 11시 · 1층 어린이부 예배실</small>
          </div>
        </aside>

        <section className="content" id="today">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">2026년 8월 23일 일요일</p>
              <h1>좋은 아침이에요, {current.name}!</h1>
              <p>{current.greeting}</p>
            </div>
            <span className="weather-pill">☀ 27°C · 맑음</span>
          </div>

          <div className="role-switcher" aria-label="데모 계정 전환">
            <span>화면 미리보기</span>
            {(['선생님', '관리자', '부모님', '학생'] as Role[]).map((item) => (
              <button key={item} className={role === item ? 'active' : ''} onClick={() => setRole(item)}>
                {item}
              </button>
            ))}
          </div>

          <section className="hero-card">
            <Image src="/dream-group.jpg" alt="드림어린이부 겨울성경학교 단체사진" fill sizes="(max-width: 900px) 100vw, 1100px" priority />
            <div className="hero-overlay" />
            <div className="hero-copy">
              <span className="hero-badge">드림 어린이부</span>
              <h2>사랑 안에서<br />꿈이 자라요</h2>
              <p>“서로 사랑하라 내가 너희를 사랑한 것 같이”</p>
            </div>
            <div className="hero-date"><b>이번 주 말씀</b><span>요한복음 15:12</span></div>
          </section>

          <section className="quick-grid" aria-label="빠른 실행">
            {current.actions.map((item) => (
              <button key={item.label} className={`quick-card ${item.tone}`} onClick={() => setModal(item.label)}>
                <span className="quick-icon">{item.icon}</span>
                <span><b>{item.label}</b><small>바로가기</small></span>
                <i aria-hidden="true">›</i>
              </button>
            ))}
          </section>

          <section className="feature-grid" aria-label={`${role} 주요 기능`}>
            {current.features.map((feature) => (
              <button key={feature.title} className="feature-card" onClick={() => setModal(feature.title)}>
                <span>{feature.eyebrow}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                <b>{feature.meta}</b>
              </button>
            ))}
          </section>

          <div className="dashboard-grid">
            <section className="panel attendance-panel" id="attendance">
              <div className="panel-heading">
                <div><span className="section-label mint-text">TODAY</span><h3>오늘의 출석</h3></div>
                <button>전체보기</button>
              </div>
              <div className="attendance-summary">
                <div className="ring"><span><b>86%</b><small>출석률</small></span></div>
                <div className="attendance-numbers">
                  <div><span className="dot mint-dot" /><p>출석</p><b>43명</b></div>
                  <div><span className="dot coral-dot" /><p>미출석</p><b>7명</b></div>
                  <div><span className="dot gray-dot" /><p>전체</p><b>50명</b></div>
                </div>
              </div>
            </section>

            <section className="panel point-panel" id="points">
              <div className="panel-heading">
                <div><span className="section-label yellow-text">DREAM GEM</span><h3>오늘의 보석</h3></div>
                <button>지급내역</button>
              </div>
              <div className="gem-total"><span>◆</span><div><small>오늘 지급한 보석</small><b>128개</b></div></div>
              <div className="mini-bars" aria-label="학년별 보석 지급 그래프">
                {[48, 70, 55, 88, 66, 42].map((height, index) => (
                  <div key={index}><span style={{height: `${height}%`}} /><small>{index + 1}학년</small></div>
                ))}
              </div>
            </section>

            <section className="panel notice-panel" id="notice">
              <div className="panel-heading">
                <div><span className="section-label blue-text">NOTICE</span><h3>새로운 소식</h3></div>
                <button>전체보기</button>
              </div>
              <article><span className="notice-tag important">중요</span><div><b>여름 달란트시장 안내</b><p>8월 30일 예배 후, 드림홀에서 만나요!</p></div><time>08.18</time></article>
              <article><span className="notice-tag vote">투표</span><div><b>9월 체험활동 장소를 골라주세요</b><p>가족과 함께 투표에 참여해 주세요.</p></div><time>08.16</time></article>
            </section>
          </div>
        </section>
      </div>

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        <a className="active" href="#today"><span>⌂</span>홈</a>
        <a href="#attendance"><span>✓</span>출석</a>
        <button aria-label="QR 출석 열기">▦</button>
        <a href="#points"><span>◆</span>보석</a>
        <a href="#notice"><span>▤</span>공지</a>
      </nav>

      {modal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <section className="demo-modal" role="dialog" aria-modal="true" aria-label={modal} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="닫기">×</button>
            <span className="modal-icon">✦</span>
            <p className="eyebrow">INTERACTIVE DEMO</p>
            <h2>{modal}</h2>
            {modal.includes('보석') ? (
              <div className="chat-demo">
                <div>권지민 1포인트</div>
                <p><b>권지민</b> 어린이에게 보석 <b>1개</b>를 지급할까요?</p>
                <button onClick={() => setModal(null)}>확인하고 지급</button>
              </div>
            ) : modal.includes('QR') ? (
              <div className="qr-demo">
                <div className="fake-qr">▦</div>
                <p>2026년 8월 23일 출석 QR<br /><small>오늘 오후 1시에 만료됩니다.</small></p>
                <button onClick={() => setModal(null)}>QR 출석 체험 완료</button>
              </div>
            ) : (
              <div className="generic-demo">
                <p>이 기능의 실제 등록·조회 화면은 다음 구현 단계에서 Supabase 데이터와 연결됩니다.</p>
                <button onClick={() => setModal(null)}>확인</button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
