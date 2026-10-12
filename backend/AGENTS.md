# Spring 백엔드 지침

루트 지침과 `../docs/development/conventions.md`의 백엔드 절을 따른다.

- Java 21, Spring Boot, `com.moadam` 아래 도메인별 controller/service/repository/dto를 사용한다. 기존 구조와 JSON 계약을 유지한다.
- controller에 SQL·외부 통신·업무 트랜잭션을 넣지 않는다. 권한은 service의 MembershipPolicy를 통해 검사한다.
- `common`에는 실제 공통 기능만 추가한다. 개인정보 로그를 만들지 않고 예외 응답의 code/message/requestId 계약을 유지한다.
- 형식 수정은 `mvn spotless:apply`, 검사/테스트는 `mvn verify`. 외부 인증정보 없이 사용하는 fixture 테스트와 실제 DB smoke를 구분한다.
- API 변경 시 루트 `make api-types`로 OpenAPI와 프론트 타입을 갱신해 함께 검토한다. 기본 검사에서 파일을 생성하지 않으며 exportOpenApi 옵션으로만 생성하고 서버 URL을 정규화한다.
- 비밀값을 pom/resources/test에 넣지 않는다. 새 테스트의 외부 통신은 fixture 또는 명시된 격리 서버를 사용한다.
