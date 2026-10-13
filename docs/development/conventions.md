# 코드와 폴더 규칙

## 프론트엔드

현재 구조는 기능 단위 계층을 사용하는 프로젝트 구조이며 완전한 외부 FSD 규격을 강제하는 것은 아닙니다.

```text
frontend/app/                  라우트, layout, metadata, BFF Route Handler
frontend/src/_pages/workspace/ 워크스페이스 화면 조합(ui)과 상태 흐름(model)
frontend/src/widgets/          사이드바 등 여러 기능의 화면 조합
frontend/src/features/         인증·편집·질문 같은 사용자 동작(api/model/ui)
frontend/src/entities/         게시글·일정·문서 등 타입과 표현
frontend/src/shared/           공통 API, 설정, 순수 함수, UI, 토큰
```

의존 방향은 `app → _pages → widgets/features/entities → shared`입니다. features와 widgets는 entities를 참조할 수 있습니다. shared는 업무 화면을 참조하지 않습니다. 같은 계층의 업무 기능끼리 강하게 결합시키지 말고 상위 조합에서 연결합니다. `app`과 `_pages`의 import 방향은 단방향입니다. `_pages`는 Next의 예약 `pages` 라우팅과 충돌하지 않도록 유지합니다.

일반 파일과 디렉터리는 kebab-case, 컴포넌트·타입은 PascalCase, 함수와 변수는 camelCase, 훅은 `use`로 시작합니다. JSX 이벤트는 `on*`, 내부 처리 함수는 `handle*` 또는 동사를 사용합니다. 도메인 ID는 groupId/postId처럼 식별 대상을 드러냅니다. 필수 폼 라벨과 실제 콘텐츠 제목은 텍스트를 유지합니다.

TypeScript strict를 유지하고 타입 전용 import는 `import type`을 사용합니다. 서버 전용 모듈은 `server-only` 경계를 사용하고 인증정보를 클라이언트에 전달하지 않습니다. React 훅은 최상위에서 호출하고 의존성 배열을 임의로 비우지 않습니다. 기존 서버 세션 확인과 외부 시스템 동기화 effect는 이유가 있는 경계로 취급하며, 화면에서 파생 가능한 상태는 계산합니다.

컴포넌트는 named export를 기본으로 합니다. Next 라우트 파일·설정 파일은 프레임워크의 default export 규칙을 따릅니다. 공용 slice의 작은 `index.ts`는 공개 API로 사용할 수 있지만 지연 로딩하려는 UI는 직접 경로로 import합니다. 포맷은 Prettier(2 spaces, double quotes, semicolons, trailing commas)로 결정합니다.

## 백엔드

기준 패키지는 `src/main/java/com/moadam/`입니다.

```text
<domain>/controller/  HTTP 경로·검증된 DTO·응답 상태
<domain>/service/     권한과 업무 흐름·트랜잭션
<domain>/repository/  파라미터 바인딩 SQL·데이터 접근
<domain>/dto/         요청/응답 계약
<domain>/entity/      도메인 데이터(필요할 때)
ai/client/           외부 AI/RAG 통신
ai/retrieval/        허용 문서 검색 경계
auth/                JWT·모임 멤버십 정책
common/              예외·페이지·Storage·웹 필터 등 실제 공통 코드
```

모든 도메인에 빈 폴더나 불필요한 entity/interface를 만들지 않습니다. 기존 `common/service/DomainService`는 공통 권한·조회 헬퍼이며 새로운 도메인 업무는 각 도메인 service에 둡니다. 생성자 주입, 요청 DTO 검증, 파라미터 SQL, 서비스 단위 트랜잭션을 사용합니다. 외부 호출에는 timeout과 취소 경계를 둡니다. URL 경로만 확인하지 말고 모임·작성자·개인 대화 소유권을 검사합니다.

클래스는 PascalCase, 메서드·필드는 camelCase, 패키지는 lowercase입니다. 요청/응답에 DTO를 사용합니다. JSON snake_case 필드는 기존 OpenAPI 계약을 유지합니다. Java 형식은 Spotless의 google-java-format(2 spaces), import 정렬·미사용 import 제거로 결정합니다. XML pom은 독립된 줄과 2 spaces로 작성합니다.

## RAG

`rag/app.py`는 현재 서비스의 ASGI 진입점이며 테스트가 `import app`의 공개 함수들을 검증합니다. 작은 현재 서비스는 이 진입점을 유지합니다. 새 기능으로 독립 책임이 커지면 settings/schemas/retrieval/providers/indexing 등 역할 모듈로 분리하되 순환 import 없이 `app.py`에서 조합하고 호출부·Docker·테스트를 함께 갱신합니다. 폴더 수를 맞추기 위한 이동은 하지 않습니다.

snake_case 함수·변수, PascalCase Pydantic 모델, Python 3.12 타입을 사용합니다. Ruff formatter(4 spaces, double quotes, line length 100)와 기본 오류/미사용 코드/import 정렬 검사를 적용합니다. 한 줄에 여러 제어문을 넣지 않습니다. 모델·비밀·문서 본문을 로그에 남기지 않습니다. 동기 DB/색인 작업은 async 스트리밍 이벤트 루프를 막지 않도록 기존 threadpool 경계를 유지합니다.

## 설정·계약·문서

- `.editorconfig`는 인코딩/LF/들여쓰기 기본값을, 각 포맷터는 언어별 최종 형식을 정의합니다.
- `docs/openapi.json`과 `frontend/src/shared/api/generated-api.ts`는 생성된 계약입니다. API 변경 시 루트 `make api-types`로 backend 계약과 프론트 타입을 갱신합니다. 생성기의 형식은 보존합니다.
- SQL은 기존 migration 형식을 따릅니다. 적용된 migration을 고치지 않고 새로운 migration을 추가합니다. 초기 Flyway/Supabase 복사본 일치 검사를 유지합니다.
- 스타일 토큰 원본은 `frontend/src/shared/styles/tokens.css`입니다. UI 색상 규칙은 디자인 시스템 문서와 구조 검사로 연결됩니다.
- 기술 문서는 확인된 현재 동작을 설명합니다. 긴 기능 설명을 AGENTS.md마다 복사하지 말고 원본 문서에 링크합니다.
- 이슈 수정 기록은 `docs/issue/YYYY-MM-DD_이슈명.md`에 한국어로 남깁니다. 작성 형식과 완료 상태 기준은 [이슈 기록 규칙](../issue/README.md)을 따릅니다.
