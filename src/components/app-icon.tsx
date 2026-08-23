import type { SVGProps } from 'react';

export type AppIconName = 'home' | 'students' | 'relationships' | 'attendance' | 'gem' | 'notice' | 'accounts' | 'contact' | 'child' | 'teacher' | 'inquiry' | 'qr';
type Props = SVGProps<SVGSVGElement> & { name: AppIconName };

export function AppIcon({ name, ...props }: Props) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}><g {...common}>
    {name === 'home' && <><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.4v10.1h13V9.4M9.5 19.5v-6h5v6"/></>}
    {name === 'students' && <><circle cx="9" cy="8" r="3"/><path d="M3.8 19c.5-3.2 2.3-5 5.2-5s4.7 1.8 5.2 5M15.5 6.2a2.7 2.7 0 0 1 0 5.2M16.2 14.1c2.3.4 3.7 2 4 4.4"/></>}
    {name === 'relationships' && <><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="m8.7 8.9 2 5.7m4.6-5.7-2 5.7M9.5 7h5"/></>}
    {name === 'attendance' && <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.5 2.5L16.5 9"/></>}
    {name === 'gem' && <><path d="m5 9 2.7-3h8.6L19 9l-7 9-7-9Z"/><path d="M5 9h14M7.7 6 12 9l4.3-3M12 9v9M12 3V1.5M5.2 4.2 4 3m14.8 1.2L20 3"/></>}
    {name === 'notice' && <><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4"/></>}
    {name === 'accounts' && <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.4 2.4-5 5.5-5 1.3 0 2.4.3 3.3.9M17 14v6M14 17h6"/></>}
    {name === 'contact' && <path d="M7.2 3.5h3l1.2 4-2 1.6a15.8 15.8 0 0 0 5.5 5.5l1.6-2 4 1.2v3c0 1.8-1.5 3.2-3.3 3-7-.8-12.2-6-13-13-.2-1.8 1.2-3.3 3-3.3Z"/>}
    {name === 'child' && <path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10Z"/>}
    {name === 'teacher' && <><circle cx="9" cy="8" r="3"/><path d="M3.8 19c.5-3.2 2.3-5 5.2-5 1.5 0 2.7.5 3.6 1.3M15 5h5v7h-5M17.5 12v3"/></>}
    {name === 'inquiry' && <><path d="M4 5.5h16v11H9l-4.5 3v-3H4z"/><path d="M8 9h8M8 12.5h5"/></>}
    {name === 'qr' && <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-6v-2M17 17h3"/></>}
  </g></svg>;
}

export function GemIcon(props: Omit<Props, 'name'>) { return <AppIcon name="gem" {...props}/>; }
