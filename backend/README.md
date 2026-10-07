# Spring REST

Java 21 / Spring Boot 3.5.16, Maven 3.9+. 저장소 루트 README의 환경변수를 shell 또는 IDE에 주입한 뒤 `mvn -f backend/pom.xml spring-boot:run`.

API는 `/api/v1`, 명세는 `/v3/api-docs`, Swagger는 `/swagger-ui.html`. `Api`는 입력/응답 DTO를 사용하며 `Policy`가 DB 멤버십·권한을 검사합니다. SQL은 리소스마다 group_id를 포함하고 개인 챗에는 user_id도 포함합니다. `Security`는 Supabase 서명·issuer·audience·만료를 검증합니다. `Integrations`는 권한 검증된 호출에서만 비공개 Storage와 내부 RAG를 사용합니다.

Supabase migration을 먼저 적용하고 기본 `FLYWAY_ENABLED=false`로 실행합니다. 초기 migration을 Flyway에서 실행하는 경우에만 true로 설정하며 두 방식을 중복 적용하지 않습니다. `mvn -f backend/pom.xml test`는 독립 인증·정책·계약 테스트이며 실제 Supabase 데이터 흐름을 검증하지 않습니다. 전체 실행 및 제한은 루트 README와 docs/verification.md 참고.
