# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 규칙

### 소통
- 항상 한국어로 답변해주세요
- 코드 수정 전에 계획을 투두리스트처럼 만들어서 먼저 알려주세요
- 파일을 삭제할 때는 반드시 먼저 확인해주세요
- git push는 절대 하지 마세요 — 사용자가 직접 합니다
- 커밋 메시지는 한국어로, 짧고 직관적으로 작성 (예: "적립식 투자 기능 추가")

### 코드 스타일
- 과도한 추상화 금지 — 동작하는 심플한 코드 우선. 헬퍼/유틸은 반복이 확실할 때만 추출
- 새 컴포넌트 파일은 최소한으로 — 재사용이 명확하지 않으면 페이지 내에서 처리
- 페이지 컴포넌트는 `'use client'` 클라이언트 사이드 패턴 유지
- 데이터 페칭 로직은 `src/hooks/`에 커스텀 훅으로 분리
- 계산/포맷 로직은 `src/utils/`에 분리
- UI 컴포넌트는 항상 MUI 컴포넌트 사용 (HTML 태그 직접 사용 금지 — `<div>` 대신 `<Box>`, `<button>` 대신 `<Button>` 등)
- 스타일링은 MUI `sx` prop 사용 (별도 CSS 파일 생성하지 않기)
- default export 사용 (Next.js 컨벤션)
- 타입은 간결하게 — 복잡한 제네릭이나 타입 계층 지양, 인라인 또는 `src/types/`에 정의
- 테스트 파일 작성하지 않기 (사용자가 요청하지 않는 한)
- 불필요한 주석, docstring, 타입 어노테이션 추가하지 않기

### API 라우트
- Supabase 클라이언트 사용: 서버 → `supabase-server.ts`, 브라우저 → `supabase-browser.ts`
- 에러 응답: `NextResponse.json({ error: message }, { status: code })` 패턴
- 입력 검증: 필수 파라미터 누락 시 400으로 즉시 반환
- 에러 메시지는 한국어로

## 프로젝트 개요

쿠팡 판매 관리 도구 — 쿠팡 API로 판매정보를 불러와 원가/부가비용을 빼고 순이익을 계산하는 웹앱.

- **프레임워크**: Next.js (App Router) + React + TypeScript
- **UI**: MUI 7 (Material UI)
- **DB**: Supabase
- **배포**: Vercel
- **패키지매니저**: pnpm

## 명령어

- `pnpm dev` — 개발 서버 실행 (localhost:3000)
- `pnpm build` — 프로덕션 빌드
- `pnpm lint` — ESLint 실행 (`eslint-config-next`의 core-web-vitals + typescript 설정 사용)
