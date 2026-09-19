'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function subscribeToDisplayMode(callback: () => void) {
  const query = window.matchMedia('(display-mode: standalone)');
  query.addEventListener('change', callback);
  return () => {
    query.removeEventListener('change', callback);
  };
}

function getStandaloneSnapshot() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export function InstallShortcutButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const standalone = useSyncExternalStore(subscribeToDisplayMode, getStandaloneSnapshot, () => false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowGuide(false);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function requestInstall() {
    if (!installPrompt) {
      setShowGuide(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed || standalone) return <p className="install-complete">✓ 이 기기에 드림 매니저가 설치되어 있습니다.</p>;

  return <>
    <button type="button" className="install-shortcut-button" onClick={requestInstall}>
      <span aria-hidden="true">＋</span><b className="install-label-desktop">PC에 앱 설치</b><b className="install-label-mobile">홈 화면에 바로가기 추가</b>
    </button>
    {showGuide ? <div className="install-guide-backdrop" role="presentation" onClick={() => setShowGuide(false)}>
      <section className="install-guide" role="dialog" aria-modal="true" aria-labelledby="install-guide-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="install-guide-close" aria-label="설치 안내 닫기" onClick={() => setShowGuide(false)}>×</button>
        <span className="install-guide-icon" aria-hidden="true">＋</span>
        <h3 id="install-guide-title"><span className="install-label-desktop">드림 매니저 설치하기</span><span className="install-label-mobile">홈 화면에 추가하기</span></h3>
        <p className="install-guide-desktop">Chrome 또는 Edge 주소창 오른쪽의 설치 아이콘을 누르거나, 브라우저 메뉴에서 <strong>드림 매니저 설치</strong>를 선택해 주세요.</p>
        <p className="install-guide-mobile"><b>iPhone·iPad</b><br/>브라우저의 공유 버튼을 누른 뒤 <strong>홈 화면에 추가</strong>를 선택해 주세요.<br/><br/><b>Android</b><br/>브라우저 메뉴(⋮)에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해 주세요.</p>
        <button type="button" className="install-guide-confirm" onClick={() => setShowGuide(false)}>확인</button>
      </section>
    </div> : null}
  </>;
}
