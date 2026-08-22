# DREAM_MANAGER

청주신흥교회 드림 어린이부의 출석, 드림보석, 공지·투표, 가족·교사 연결을 관리하는 모바일 우선 웹 애플리케이션입니다.

## 기술 구성

- Next.js 16 App Router / React 19 / TypeScript
- Supabase Auth, Postgres, Row Level Security
- Vercel 배포 대응

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`.env.local`에 고객 Supabase 프로젝트의 URL과 publishable key를 설정합니다. Secret 또는 service role key는 브라우저 환경변수에 넣지 않습니다.

## Vercel 환경변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (배포 후 실제 도메인)

## 데이터베이스

초기 데이터 구조와 역할별 RLS 정책은 `supabase/migrations`에 기록되어 있습니다. 현재 고객 Supabase 프로젝트에도 동일한 구조가 적용되어 있습니다.
