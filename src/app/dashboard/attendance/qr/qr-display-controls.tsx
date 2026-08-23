'use client';

export function QrDisplayControls({ popup = false }: { popup?: boolean }) {
  const openDisplay = () => {
    const display = window.open('/dashboard/attendance/qr?display=1', 'dream-attendance-display', `popup=yes,width=${screen.availWidth},height=${screen.availHeight},left=0,top=0`);
    display?.focus();
  };
  const enterFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };
  return <div className="qr-stage-controls">{!popup && <button type="button" onClick={openDisplay}>새 창으로 열기</button>}<button type="button" onClick={enterFullscreen}>전체화면</button>{popup && <button type="button" onClick={() => window.close()}>창 닫기</button>}</div>;
}
