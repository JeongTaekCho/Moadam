# 모아담 Spring 백엔드

Java 21 / Spring Boot 3.5.16 / Maven 3.9+. 기본 패키지는 `com.moadam`, 실행 클래스는 `MoadamApplication`입니다. 저장소 루트 README의 환경변수를 shell 또는 IDE에 주입한 뒤 `mvn -f backend/pom.xml spring-boot:run`으로 실행합니다.

## 코드 구조

기준 경로는 `src/main/java/com/moadam/`입니다.

```text
com/moadam/
├── MoadamApplication.java
├── person/
│   ├── controller/PersonController.java
│   ├── service/PersonService.java, AvatarNormalizer.java
│   ├── repository/PersonRepository.java, PersonProfileMapper.java
│   ├── entity/Person.java
│   └── dto/PersonCreateRequest.java, PersonResponse.java, ...
├── note/
│   ├── controller/NoteController.java
│   ├── service/NoteService.java
│   ├── repository/NoteRepository.java
│   ├── entity/Note.java
│   └── dto/NoteCreateRequest.java, NoteResponse.java, ...
├── ai/
│   ├── controller/AiController.java
│   ├── service/AiService.java
│   ├── repository/AiRepository.java
│   ├── retrieval/NoteRetriever.java
│   ├── client/OpenAiClient.java, RagClient.java
│   ├── config/StreamingConfig.java
│   └── dto/AiQuestionRequest.java, AiAnswerResponse.java, ...
├── group/{controller,service,repository,dto}/
├── post/{controller,service,repository,dto}/
├── event/{controller,service,repository,dto}/
├── auth/
│   ├── SecurityConfig.java
│   ├── MembershipPolicy.java
│   └── MembershipRepository.java
└── common/
    ├── exception/GlobalExceptionHandler.java
    ├── dto/Page.java, DtoMapper.java
    ├── repository/ResourceRepository.java
    ├── service/DomainService.java
    ├── storage/SupabaseStorageClient.java
    └── web/RequestIdFilter.java
```

## 계층의 책임

- **Controller**: 경로, HTTP 메서드, 인증 principal, 요청 검증과 서비스 호출을 담당합니다. SQL과 도메인 판단을 포함하지 않습니다.
- **Service**: 모임 권한, 업무 규칙, 외부 호출 순서와 트랜잭션을 담당합니다. 기존 `@Transactional` 경계는 서비스에 배치했습니다. AI 스트리밍은 최종 검증 결과를 받은 뒤 `TransactionTemplate` 안에서 권한을 재확인하고 질문·답변을 함께 저장합니다.
- **Repository**: `JdbcTemplate`과 SQL을 담당합니다. 도메인별 쓰기·조회는 명시적인 타입의 메서드로 제공하며 공통 페이지 조회·감사 기록은 `ResourceRepository`를 사용합니다. 동적 테이블 이름은 서버의 허용 목록으로 제한합니다.
- **Entity**: JDBC에서 읽은 영속 데이터입니다. JPA로 변경하지 않았습니다. `Note`에는 비공개 Storage 경로가 있지만 컨트롤러는 `NoteResponse`만 반환합니다.
- **DTO**: HTTP 입력·출력 계약입니다. 기존 snake_case JSON 필드, 유효성 검사, OpenAPI 스키마 이름을 유지합니다.

`person`은 Supabase Auth 사용자에 연결된 프로필·닉네임·아바타·내 활동을 담당하며 기존 `profiles` 테이블을 사용합니다. `PersonCreateRequest`는 프로필 이름 입력 계약으로 기존 `/me`의 PATCH에 사용합니다. 회원 가입·사용자 생성은 기존 Supabase Auth 흐름을 따릅니다.

`note`는 메모와 PDF를 함께 다루며 기존 `documents` 테이블을 사용합니다. Java 도메인 이름만 변경했으므로 API는 계속 `/groups/{g}/documents`입니다. 메모 수정 시 문서 버전을 올리고 pending으로 전환하는 규칙을 유지합니다.

`NoteRetriever`는 현재 모임의 ready 문서 ID 범위를 선택합니다. 실제 벡터 검색·임베딩·프롬프트·OpenAI 호출·출처 재검증은 기존 Python RAG가 수행합니다. `OpenAiClient`는 Java의 모델 답변 진입점이며 `RagClient`로 위임합니다. `RagClient`는 내부 Bearer 인증, NDJSON 스트림 읽기와 타임아웃을 담당합니다. 모델 키는 Python 서비스에만 둡니다.

`auth`는 JWT 서명·issuer·audience·만료 검사와 DB 멤버십·역할 검사를 담당합니다. `common/exception`은 기존 오류 응답을 유지합니다.

## 실행과 검증

API는 `/api/v1`, 명세는 `/v3/api-docs`, Swagger는 `/swagger-ui.html`입니다. 기존 29개 경로의 메서드·요청·응답·스키마 계약을 유지합니다.

Supabase migration을 먼저 적용하고 기본 `FLYWAY_ENABLED=false`로 실행합니다. 초기 migration을 Flyway에서 실행하는 경우에만 true로 설정하며 두 방식을 중복 적용하지 않습니다. 이 리팩토링은 테이블이나 migration을 변경하지 않습니다.

```sh
mvn -f backend/pom.xml clean test
mvn -f backend/pom.xml package
```

단위·계약 테스트는 20개이며 JWT·모임 정책·아바타·DTO 계약·스트리밍 오류/완료/권한 재검사/트랜잭션 호출을 확인합니다. 실제 DB 커밋과 Storage·RAG의 연결은 별도의 live smoke로 확인합니다. 루트 환경을 사용해 frontend에서 `node --env-file=../.env scripts/profile-smoke.mjs`, `node --env-file=../.env scripts/chat-live-smoke.mjs`를 실행할 수 있습니다. 이 스크립트는 격리된 테스트 사용자·모임을 만들고 finally에서 정리합니다.

AI 전체 파이프라인과 면접 설명은 [AI 기능 상세 가이드](../docs/feature_readme.md)를 참고하세요.

2026-10-08 리팩토링 검증: Java 21 패키징 및 20개 테스트 통과, OpenAPI 29개 경로/51개 HTTP 작업의 요청·응답과 전체 스키마 동일 확인, 실제 Next BFF를 통한 프로필 smoke와 채팅 smoke 통과. 닉네임·작성자 정보·내 활동·아바타 권한/삭제, 개인 세션 격리, 메모 색인·인용·스트리밍·DB 기록을 확인했으며 테스트 데이터는 정리했습니다. 변경된 실행 클래스로 백엔드를 8080 포트에서 재시작했습니다.
