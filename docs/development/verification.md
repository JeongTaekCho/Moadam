# 변경별 검증

## 로컬 준비

Node 22.13+ (CI는 Node 22), packageManager에 지정한 pnpm 12.5.1, Java 21, Maven 3.9+, Python 3.12를 사용합니다. 개발 설정은 `.editorconfig`, 프론트 Prettier/ESLint, backend Spotless, rag Ruff가 원본입니다.

루트 `make setup`으로 개발 도구를 설치합니다. 브라우저 QA는 `cd frontend && pnpm exec playwright install chromium`을 한 번 실행합니다. 시스템 PATH에 Maven이 없으면 `make check MVN=/실제/경로/mvn`처럼 지정할 수 있습니다. 다른 Python 가상환경은 `RAG_PYTHON=/실제/경로/python`으로 지정합니다. 임시 머신 경로는 저장소 설정에 하드코딩하지 않습니다.

## 완료 기준

| 변경                        | 필요한 검사                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| 문서/설정/포맷              | 관련 포맷 검사 + `make conventions`                                      |
| 프론트 로직/공통 UI         | `pnpm check`, `pnpm build`, 영향받는 smoke                               |
| 인증/BFF                    | 위 검사 + `pnpm test:oauth`, 필요하면 `pnpm test:chat-stream`            |
| 캐시/메뉴/로딩/프로필/AI UI | 위 검사 + `pnpm test:cache`, `pnpm test:performance`                     |
| Java                        | `mvn verify` (Spotless validate 포함)                                    |
| API 계약                    | 위 검사 + OpenAPI 생성/비교 + `pnpm api:types` + 프론트 타입 검사        |
| RAG 로직/형식               | Ruff check/format + unittest 17개                                        |
| SQL                         | migration 복사본 검사, `pnpm test:db`, 실제 적용은 요청 범위에 따라 별도 |
| 서비스 전체 규칙 변경       | `make check`, `make test`, `make qa`                                     |

`make check`는 코드를 변경하지 않고 오류를 반환합니다. `make format`은 포맷·미사용 import를 정리합니다. CI에서도 같은 언어별 명령과 격리 QA를 실행합니다.

## 검사 대상과 예외

- Prettier는 프론트 소스·스크립트·설정과 에이전트 개발 문서를 검사합니다. 생성 API 타입/Next 선언, lockfile, 폰트·이미지·빌드 디렉터리는 해당 생성 도구 형식을 보존합니다.
- ESLint는 Next Core Web Vitals/TypeScript 규칙과 계층 import 방향을 검사합니다. 경고도 실패합니다.
- 외부 URL 동기화·native 폼 검증·API 요청 상태 초기화 같은 기존 effect는 `set-state-in-effect`의 국소 예외를 이유와 함께 표시합니다. 훅 규칙이나 의존성 검사를 파일/프로젝트 전체에서 끄지 않습니다.
- Spotless는 Java 형식·import를 검사합니다. pom XML은 읽을 수 있는 줄 구조로 유지합니다.
- Ruff는 Python 형식, 기본 오류·미사용 코드·import 순서를 검사합니다. RAG 테스트의 환경 설정 후 ASGI import는 설정상 `E402` 예외입니다.
- `check-conventions.py`는 Java package/폴더 일치, UI CSS의 색상 토큰 경계, 핵심 가이드 존재를 검사합니다. TypeScript 계층 의존성은 ESLint가 검사합니다.

## QA 범위와 외부 의존성

기본/CI 검사는 fixture, PGlite, 격리된 Auth/API 서버를 사용합니다. 저장소에 운영 비밀을 넣거나 CI에서 실제 이메일·업로드·원격 DB 쓰기·모델 과금을 실행하지 않습니다. 실제 `test:profile`, `test:chat-live`, 루트 live HTTP smoke는 해당 요청과 환경이 준비된 경우에만 실행합니다.

기본 ContractTest는 파일을 쓰지 않습니다. API 변경 시 루트 `make api-types`로 OpenAPI와 프론트 타입을 명시적으로 생성합니다. export 시 서버 URL은 localhost:8080으로 정규화해 랜덤 테스트 포트로 인한 변경을 방지합니다. 생성 결과를 계약 변경과 함께 검토합니다.

보고 시 실행 명령과 통과 여부를 명시하고 로컬 mock 검증, 실제 운영 검증, 미실행 항목을 구분합니다. 빌드/검사 통과는 실제 네트워크·SMTP·DB 운영 환경 검증을 대신하지 않습니다.
