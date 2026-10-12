<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI 선호

‘나의 프로필’ 같은 장식성 제목이나 진한 텍스트 배지를 추가하지 않습니다. 아바타·아이콘·간결한 레이아웃으로 의미를 표현합니다. 아이콘에는 필요한 접근성 이름과 툴팁을 제공하고, 닉네임·콘텐츠 제목·입력 라벨·핵심 동작처럼 실제 정보를 전달하는 텍스트는 유지합니다.

## 개발 구조와 검사

루트 지침, `../docs/development/conventions.md`, `DESIGN_SYSTEM.md`를 따른다.

- `app`은 라우트/BFF/metadata, `src/_pages`는 화면 조합과 상태, widgets/features/entities/shared는 개발 규칙의 역할을 따른다. shared가 업무 화면을 import하지 않는다.
- TypeScript strict, named component export, kebab-case 파일, 타입 전용 import를 사용한다. 포맷은 Prettier, 린트는 설치된 Next ESLint 설정으로 검사한다.
- 공통 Button/Dialog/Toast/CustomSelect/DateTimePicker/ContentSkeleton을 재사용한다. 새 UI 색은 tokens.css에 정의하고 CSS에서 var(...) 또는 Tailwind 토큰을 사용한다.
- 인증 데이터는 BFF 경유. 브라우저의 보호 API 조회는 shared/api의 취소·세션·모임 캐시 경계를 따른다. 변경 성공 시 무효화, 회원 데이터의 공용 캐시는 금지한다.
- lazy 화면은 직접 UI 경로를 import한다. 프론트 공통 barrel을 통해 지연 UI를 다시 정적 포함시키지 않는다.
- `pnpm check`로 형식·린트·타입을 확인한다. UI/비동기 흐름 변경 시 `pnpm build`, `pnpm test:performance`를 추가한다. 변경별 검증 기준은 `../docs/development/verification.md`.
