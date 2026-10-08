# 모아 프론트엔드

Next.js 16.4 App Router / React 19 / TypeScript. 인증 쿠키와 REST BFF를 유지하면서 화면과 클라이언트 로직을 FSD로 구성합니다. Java/Python/DB 계약은 변경하지 않습니다.

## 실행

프로젝트 루트 README에 따라 `frontend/.env.local`을 입력합니다. service_role/DB/LLM 키를 이 파일에 넣지 않습니다.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
# production 컴파일
pnpm build
pnpm start
```

## 기능 배치

| 위치            | 역할                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------- |
| 좌측 상단       | 현재 모임 전환, 모임 생성·초대 참여                                                                |
| 주요 내비게이션 | 모임 홈 → 지식 도우미 → 자료 보관함 → 커뮤니티 → 일정                                              |
| 관리 메뉴       | 멤버·초대, 모임 설정                                                                               |
| 홈              | 질문 진입·추천 질문, 공지 우선, 최근 이야기·자료, 다가오는 일정                                    |
| 자료            | 상단 등록 액션, 종류/상태 필터, 현재 페이지 검색, 파일명·등록일·처리 상태, 상세에서 질문·다시 처리 |
| 챗              | 개인 대화 목록, 추천 질문, 출처 있는 답변, 고정 입력 영역, 답변 대기 표시                          |
| 모바일          | 홈·도우미·자료·일정 하단 메뉴 + 전체 메뉴 대화상자, 일정 목록 우선                                 |
| 설정            | 모임 이름·표시 시간대 폼, 삭제 영역 분리                                                           |

목록 검색/필터는 API에서 받은 **현재 페이지**에 적용됩니다. 전역 검색처럼 표시하지 않습니다. 홈의 목록은 최근 최대 5개이며 전체 수치처럼 표시하지 않습니다. 표시명이 없는 API에서는 멤버 ID 일부를 사용하며 이름을 생성하지 않습니다.

## FSD 구조

```text
app/                            Next의 route/layout/BFF entrypoints
  (workspace)/layout.tsx        이동 중 상태를 유지하는 워크스페이스
  (workspace)/page.tsx          홈 route
  (workspace)/[section]/page.tsx 허용한 메뉴 경로만 매핑
  api/                          기존 HttpOnly 쿠키 Auth/REST proxy
src/
  _pages/workspace/             FSD pages: 전체 화면 조합과 모임 상태
    model/use-workspace.ts      인증·모임 범위·조회·상태 조율
    ui/*-view.tsx               홈/커뮤니티/일정/자료/챗/멤버/설정
  widgets/workspace-shell/      사이드바·헤더·모바일 내비게이션
  features/
    auth/                      로그인/가입/로그아웃 액션
    content-editor/            등록·수정 폼과 저장/업로드 액션
    ask-question/              질문 입력·전송·단축키
  entities/
    group/ post/ event/ document/ chat/
                               계약 기반 타입, 카드/행/달력/인용 표시
  shared/
    api/                       fetch client, 생성 OpenAPI 계약
    config/navigation.ts       메뉴 URL 매핑
    lib/                       폼/시간 변환, 서버 요청 도구
    styles/tokens.css          색상·간격·타입·radius·shadow·focus 토큰
    ui/                        공통 UI·SVG 아이콘·안전한 Markdown
```

의존 방향: `app → _pages → widgets → features → entities → shared`. 위 레이어는 필요한 하위 레이어를 직접 사용할 수 있습니다. 다른 slice는 `index.ts` 공개 API를 통해 사용하고, 공통 UI는 도메인이나 페이지 상태를 참조하지 않습니다. 화면 상태를 전체적으로 조율하는 훅은 pages 레이어에 두고 작성/업로드 및 인증 액션은 features에 둡니다.

`_pages`는 FSD의 pages 레이어입니다. `src/pages`를 사용하면 Next가 Pages Router로 감지하여 루트 `app`과 충돌하므로 Next용 공식 FSD 가이드에 맞춰 별도 이름을 사용합니다. [`Next.js + FSD 안내`](https://feature-sliced.design/docs/guides/tech/with-nextjs)

## 경로와 상태

`/`, `/community`, `/events`, `/documents`, `/chat`, `/members`, `/settings`. URL의 `?group=UUID`는 모임 선택 힌트이며 실제 내 모임 응답에 포함된 ID만 사용합니다. API는 기존 모임 범위 AbortController 및 stale response 검사를 유지합니다. 브라우저 history로 메뉴 이동/뒤로 가기를 처리하고 새로고침 시 메뉴와 접근 가능한 모임을 복원합니다. 게시글/문서 상세와 선택한 챗 세션은 현재 화면 상태로 관리하며 아직 별도 상세 permalink가 없습니다.

## 디자인 방향과 참고

2026-03 Linear UI refresh에서 강조한 일관된 헤더·뷰 컨트롤, 시각적 우선순위, 콘텐츠보다 덜 강조되는 내비게이션을 참고했습니다. 이 제품에는 라이트 뉴트럴 테마, 온화한 녹색 포인트, 표 형태의 자료 목록, 모임 홈의 실제 다음 행동, 자료 중심 AI 진입을 적용했습니다. 과도한 장식이나 의미 없는 지표는 추가하지 않습니다.

- [Linear UI refresh · 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh)
- [Linear의 최신 디자인 방향](https://linear.app/now/behind-the-latest-design-refresh)
- [Notion 홈·일정·사이드바 구성](https://www.notion.com/releases/2024-06-11)

Tailwind CSS 4의 PostCSS 플러그인과 `@theme`으로 주황 계열 브랜드, 따뜻한 중립색, 성공·경고·오류 색상을 정의합니다. 공통 컨트롤은 동일한 토큰을 사용합니다. 로고는 `public/images/logo.png`입니다. 워크스페이스는 `app/(workspace)/layout.tsx`에서 유지되며 메뉴 이동과 로고 이동에도 로그인·모임 상태를 보존합니다. 데이터 갱신 중에는 기존 내용을 유지하고 첫 진입 시에만 본문 스켈레톤을 표시합니다.

토큰은 `src/shared/styles/tokens.css`, 화면 스타일은 `app/globals.css`에 있습니다. 외부 폰트/아이콘 네트워크 의존 없이 시스템 한국어 폰트와 SVG를 사용합니다. 키보드 focus, 모달 focus trap(native dialog), 상태 문구, reduced motion, 모바일 safe area를 지원합니다. 챗 Markdown은 제한된 텍스트 포맷만 처리하고 raw HTML을 실행하지 않습니다. Ctrl/Cmd+Enter로 질문을 전송할 수 있고 실패한 질문 입력은 유지합니다.

## 계약 재생성

```sh
pnpm api:types       # ../docs/openapi.json → src/shared/api/generated-api.ts
pnpm api:types:live  # 실행 중인 Spring 계약
pnpm typecheck
```

TypeScript 컴파일과 production build를 확인합니다. OAuth와 프로필 API에는 별도 통합 검증 스크립트를 제공합니다. 실제 브라우저 클릭·모바일 시각 검수는 별도 확인이 필요합니다.

## Google 소셜 로그인

Google OAuth 로그인과 `/login/callback`을 구현했습니다. Supabase Google Provider를 활성화하고 Google Cloud Web OAuth 클라이언트를 등록한 뒤 사용할 수 있습니다. [프로젝트별 상세 설정 안내](GOOGLE_LOGIN_SETUP.md)를 참고하세요. Google 콘솔에는 Supabase의 `/auth/v1/callback`, Supabase Redirect URLs에는 앱의 `/login/callback`을 등록합니다.

## 마이페이지

로그인한 회원은 `/mypage`에서 닉네임·프로필 사진을 변경하고 계정 정보 및 작성한 글·등록한 자료를 확인할 수 있습니다. 글·댓글·자료·일정·멤버 목록은 공통 프로필로 작성자를 표시합니다. [설정 및 검증 안내](PROFILE_SETUP.md)를 참고하세요.

## 모아AI 스트리밍

모델 답변이 생성되는 대로 글자를 빠르게 표시하며 완료 후 자료 출처와 대화를 저장합니다. 화면 갱신을 프레임당 한 번으로 묶고 전송 취소를 지원합니다. [구현·운영·검증 안내](STREAMING_AI.md)를 참고하세요.
