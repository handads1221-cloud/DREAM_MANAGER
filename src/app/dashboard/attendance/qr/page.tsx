import Image from 'next/image';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../../dashboard-shell';
import { QrDisplayControls } from './qr-display-controls';

function QrStage({ date, qrData, popup }: { date: string; qrData: string; popup: boolean }) {
  const [year, month, day] = date.split('-').map(Number);
  return <main className={`qr-stage${popup ? ' popup' : ''}`}>
    <Image className="qr-stage-background" src="/qr-children-jesus.png" alt="예수님과 어린이들이 함께 웃는 일러스트" fill sizes="100vw" priority/>
    <div className="qr-stage-glow"/>
    <QrDisplayControls popup={popup}/>
    <section className="qr-stage-content">
      <h1><span>{String(year).slice(-2)}년 {month}월 {day}일</span> 출석체크!</h1>
      {qrData && <div className="qr-stage-code"><Image src={qrData} alt="오늘의 출석 QR코드" width={520} height={520} unoptimized priority/></div>}
      <p>핸드폰앱으로 모두 출첵해봐요^^</p>
    </section>
  </main>;
}

export default async function AttendanceQrPage({ searchParams }: PageProps<'/dashboard/attendance/qr'>) {
  const params = await searchParams;
  const popup = params.display === '1';
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');
  const { data: qrRows } = await supabase.rpc('admin_get_attendance_qr', {});
  const qr = qrRows?.[0];
  const qrData = qr?.token ? await QRCode.toDataURL(qr.token, { width: 520, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#153b34', light: '#ffffff' } }) : '';
  const stage = <QrStage date={qr?.service_date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())} qrData={qrData} popup={popup}/>;
  if (popup) return stage;
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/attendance">{stage}</DashboardShell>;
}
