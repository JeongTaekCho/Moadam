# 에이전트 개발 하네스 구성

설정일: 2026-10-12.

## 진입점과 규칙 적용

[AGENTS.md 공개 형식](https://agents.md/)을 사용합니다. 루트 지침이 프로젝트 지도·작업 절차·검증 명령을 제공하고 frontend/backend/rag/supabase의 하위 AGENTS.md가 해당 코드에 구체적인 규칙을 추가합니다. 특정 도구 전용 지침을 여러 파일에 복제하지 않습니다. 기존 Next.js가 생성한 프론트 지침 블록과 사용자의 UI 선호는 유지합니다.

개발 순서는 루트 AGENTS → 서비스 AGENTS → 해당 코드/디자인 가이드 → 구현 → 검사 → 결과 보고입니다. 에이전트마다 하위 문서 자동 탐색 방식은 다를 수 있으므로 루트 지도에 각 경로를 명시했습니다.

## 원본 문서와 실행 가능한 규칙

| 원본                               | 내용                               | 자동 검사                             |
| ---------------------------------- | ---------------------------------- | ------------------------------------- |
| `.editorconfig`                    | UTF-8/LF/공백/들여쓰기             | 언어 포맷터                           |
| `docs/development/conventions.md`  | 폴더 역할, 계층 방향, 이름, 계약   | ESLint import 제한, Java package 검사 |
| `frontend/DESIGN_SYSTEM.md`        | 주황 토큰·공통 UI·상태·접근성      | CSS 색상 토큰 검사 + 브라우저 QA      |
| `frontend/.prettierrc.json`        | TS/JS/CSS/설정/개발 문서 형식      | Prettier check                        |
| `frontend/eslint.config.mjs`       | Next/React/TypeScript 및 계층 방향 | ESLint, 경고 0 기준                   |
| `backend/pom.xml`                  | Java 21 및 google-java-format      | Spotless apply/check, Maven validate  |
| `rag/pyproject.toml`               | Python 3.12 형식·미사용·import     | Ruff check/format                     |
| `docs/development/verification.md` | 변경별 검사와 fixture/live 구분    | Makefile, GitHub Actions              |

사람의 설계 판단이 필요한 컴포넌트 책임·네이밍·새 추상화의 필요성은 문서와 리뷰로 확인합니다. 자동화한 검사만으로 디자인·보안 품질 전체를 보장하지 않습니다.

## 기존 코드 정리

- Python app/test와 공통 Python 스크립트의 압축된 문장, 들여쓰기, 따옴표, import를 Ruff 기준으로 정리했습니다.
- Maven pom을 읽을 수 있는 XML로 정리하고 Java 소스·테스트를 google-java-format에 맞췄습니다.
- 프론트 미사용 import와 불필요한 lint 억제 주석을 제거하고 effect의 실제 의존성과 요청 취소 cleanup을 정리했습니다. 최초 화면은 pathname에서 초기 상태를 계산해 불필요한 초기 렌더를 줄였습니다.
- 외부 시스템을 동기화하는 필요한 effect에는 이유가 있는 국소 lint 예외를 남겼습니다. 프로젝트 전체에서 훅 검사를 끄지 않았습니다.
- 화면 CSS의 HEX/RGB 색상 19개를 공통 토큰으로 이동했습니다. 기존 색 값과 UI 구조는 유지합니다.
- 문서·JS 스크립트 형식도 기존 Prettier 기준에 맞췄습니다. 생성 OpenAPI 타입은 원본 생성기 형식이므로 명시적으로 제외합니다.
- `_pages`, Java 도메인 패키지, RAG 진입점은 실제 사용과 맞는 구조로 명시했습니다. 빈 폴더를 늘리거나 실행 경로를 일괄 이동하지 않았습니다.
- 캐시·빌드 캐시·OS 파일·환경 비밀 파일을 ignore하고 `.env.example`은 추적합니다. 기존에 추적하던 `frontend/tsconfig.tsbuildinfo`도 Git 추적에서 제외했습니다.
- 기본 계약 테스트에서 OpenAPI 파일 쓰기를 제거하고 명시적인 `make api-types`에서만 계약/타입을 생성하도록 했습니다. 랜덤 테스트 포트는 고정 로컬 URL로 정규화합니다.

## 실행

```sh
make setup
make format
make check
make test
cd frontend && pnpm exec playwright install chromium
cd .. && make qa
```

Makefile은 표준 실행 명령의 진입점입니다. Python/Maven PATH가 다르면 `RAG_PYTHON`, `PYTHON`, `MVN`을 지정합니다. GitHub Actions는 프론트·백엔드·RAG 작업을 나눠 같은 검사와 격리 QA를 실행합니다. 개발 도구 추가 후 package/lockfile과 pnpm native build 정책을 함께 저장합니다. ESLint 10은 설치된 Next 버전의 문서에서 지원하며, 일부 React/import 플러그인의 peer 선언은 아직 ESLint 9까지여서 pnpm이 peer 경고를 낼 수 있습니다. 실제 lint/빌드 검증으로 호환성을 확인합니다.

## 검증 기록

- `make check`: Prettier, ESLint 경고 0, TypeScript, Spotless(71 Java 파일), Ruff, package/색상 토큰/가이드 및 migration 일치 검사 통과.
- 계층 위반 import와 CSS 직접 색상 값을 임시로 넣어 각각 실제 차단됨을 확인했고 검사 후 probe를 제거했습니다.
- `make test`: 캐시 검사, PostgreSQL/pgvector/격리 검사 13개, Maven 테스트 21개 및 패키징, RAG unittest 17개 통과.
- `make qa`: Next 운영 빌드, Google PKCE/가입 확인/중복/비밀번호, 한글 스트리밍·BFF 전달/취소, 브라우저 QA 통과.
- 브라우저는 비로그인 8개 경로 보호 API 0회, 수정/삭제 후 최신 갱신, 모임/세션 격리, 재로그인, 503 재시도, 대화 전환 경쟁, 모바일/reduced-motion을 확인했습니다.
- `make api-types`: 명시적 OpenAPI export 및 생성 타입 재생성 통과. 타입 계약은 동일하고 OpenAPI의 서버 URL만 테스트 랜덤 포트에서 고정 로컬 URL로 정규화됐습니다.
- `pnpm install --frozen-lockfile` 통과. 운영 의존성은 유지하고 개발 검사 도구/lockfile을 추가했습니다.
- Python 코드·테스트·마이그레이션 검사 스크립트는 import를 제외한 AST가 변경 전과 같음을 확인했습니다.

원격 GitHub Actions와 운영 배포는 실행하지 않았습니다. CI 파일의 구성과 동일한 로컬 검사를 실행한 결과이며 원격 실행은 push 후 확인합니다.

참고: [AGENTS.md](https://agents.md/), [Ruff 설정](https://docs.astral.sh/ruff/configuration/), [Spotless Maven](https://github.com/diffplug/spotless/tree/main/plugin-maven). Next ESLint 규칙은 설치된 `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`를 확인했습니다.
