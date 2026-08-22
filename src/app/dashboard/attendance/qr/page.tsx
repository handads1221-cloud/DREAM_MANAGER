import Image from 'next/image'; import { redirect } from 'next/navigation'; import QRCode from 'qrcode'; import { createClient } from '@/lib/supabase/server'; import { DashboardShell } from '../../dashboard-shell';

export default async function AttendanceQrPage() {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect('/login'); const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle(); if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');
  const { data: qrRows } = await supabase.rpc('admin_get_attendance_qr', {}); const qr = qrRows?.[0]; const qrData = qr?.token ? await QRCode.toDataURL(qr.token, { width: 520, margin: 2, color: { dark: '#18352b', light: '#ffffff' } }) : '';
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/attendance"><section className="qr-display-page"><div><p className="eyebrow">DAILY CHECK-IN</p><h1>{qr?.service_date} 출석 QR</h1><p>이 QR은 자정까지 동일하게 유지됩니다.</p></div>{qrData && <Image src={qrData} alt="당일 출석 QR코드" width={520} height={520} unoptimized priority />}<strong>{qr?.token}</strong><p>학생 계정의 QR 출석 카메라로 촬영해 주세요.</p></section></DashboardShell>;
}
