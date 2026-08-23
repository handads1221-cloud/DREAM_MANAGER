import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '청주신흥교회 드림 어린이부',
    short_name: '드림 매니저',
    description: '청주신흥교회 드림 어린이부 출석·보석·공지 관리',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f4f7f5',
    theme_color: '#0b8f78',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
