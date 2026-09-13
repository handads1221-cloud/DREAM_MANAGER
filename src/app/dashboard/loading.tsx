export default function DashboardLoading() {
  return <main className="dashboard-route-loading" aria-live="polite" aria-label="페이지를 불러오는 중">
    <span className="dashboard-route-spinner" aria-hidden="true" />
    <strong>화면을 준비하고 있어요</strong>
  </main>;
}
