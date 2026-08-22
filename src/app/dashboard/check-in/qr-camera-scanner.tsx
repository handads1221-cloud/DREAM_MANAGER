'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QrScanner from 'qr-scanner';

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return '카메라 권한이 거부되었습니다. 브라우저 주소창의 카메라 권한을 허용한 뒤 다시 시도해 주세요.';
  if (name === 'NotFoundError') return '사용 가능한 카메라를 찾지 못했습니다.';
  if (name === 'NotReadableError') return '다른 앱이 카메라를 사용 중입니다. 다른 앱을 닫고 다시 시도해 주세요.';
  return '카메라를 시작하지 못했습니다. HTTPS 접속 여부와 브라우저 카메라 권한을 확인해 주세요.';
}

export function QrCameraScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState('카메라를 준비하고 있습니다.');
  const [running, setRunning] = useState(false);

  const start = useCallback(async () => {
    handledRef.current = false;
    if (!videoRef.current) return;
    if (!scannerRef.current) {
      scannerRef.current = new QrScanner(videoRef.current, (result) => {
        if (handledRef.current) return;
        try {
          const scanned = new URL(result.data, window.location.origin);
          const token = scanned.searchParams.get('token');
          if (scanned.origin !== window.location.origin || scanned.pathname !== '/dashboard/check-in' || !token) {
            setStatus('드림어린이부 출석 QR이 아닙니다. 안내 화면의 QR을 촬영해 주세요.');
            return;
          }
          handledRef.current = true;
          scannerRef.current?.stop();
          setStatus('QR을 확인했습니다. 출석 확인 화면으로 이동합니다.');
          router.push(`/dashboard/check-in?token=${encodeURIComponent(token)}`);
        } catch {
          setStatus('QR 내용을 읽지 못했습니다. QR을 화면 중앙에 다시 맞춰 주세요.');
        }
      }, { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true });
    }
    try {
      setStatus('카메라에서 출석 QR을 찾아주세요.');
      await scannerRef.current.start();
      setRunning(true);
    } catch (error) {
      setRunning(false);
      setStatus(cameraErrorMessage(error));
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void start(), 0);
    return () => {
      window.clearTimeout(timer);
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [start]);

  const stop = () => {
    scannerRef.current?.stop();
    setRunning(false);
    setStatus('카메라가 꺼졌습니다. 다시 시작하려면 버튼을 눌러 주세요.');
  };

  return <div className="qr-camera-scanner">
    <div className="qr-video-frame"><video ref={videoRef} playsInline muted aria-label="QR 출석 카메라 화면" /><div className="qr-scan-guide" aria-hidden="true" /></div>
    <p className={running ? 'camera-status active' : 'camera-status'}>{status}</p>
    <div className="qr-camera-actions">{running ? <button type="button" onClick={stop}>카메라 끄기</button> : <button type="button" onClick={() => void start()}>카메라 다시 켜기</button>}</div>
  </div>;
}
