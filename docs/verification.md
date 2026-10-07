# 통합 검토·검증 결과

검증일: 2026-10-07. 빈 저장소에서 구현. 운영 배포와 원격 DB 변경은 수행하지 않았습니다.

## 계약 검토에서 확인하고 수정한 불일치

|문제|근거|수정|
|---|---|---|
|목록/상세 응답이 넓은 Map 타입|초기 OpenAPI가 구체적인 리소스 DTO를 제공하지 않음|별도 Dtos record, 필수 필드·enum·nullable 타입, Spring 생성 계약에서 프론트 타입 생성|
|모임 전환 후 이전 요청이 화면에 반영될 가능성|비동기 응답과 모임 선택 상태가 독립적|모임 scope별 AbortController, 응답 시 scope 재검사, 전환 시 상세/목록 초기화|
|메모 수정 후 이전 청크 사용 가능성|본문과 검색 version 일치 필요|문서 version 증가, pending 전환, SQL join에서 현재 version만 검색|
|재색인 실패 후 잘못된 ready 상태|존재하는 과거 version 청크만으로 ready 판단하면 잘못됨|현재 version의 청크가 있을 때만 ready 복구|
|응답 생성 중 재색인으로 인용 청크가 제거될 가능성|문서 ID만 재확인하면 삭제된 청크 인용이 남음|provider 호출 후 실제 청크 ID·현재 문서 version·모임 범위 재확인|
|Supabase Storage 삭제 응답 배열|응답을 Map으로만 파싱하면 파일 삭제 후 오류 발생|객체 및 배열 응답 처리|
|로컬 JWT와 원격 JWKS 설정 차이|로컬 Supabase 기본 HS256은 비대칭 JWKS에서 검증 불가|서버 secret 명시 시 HS256, 기본은 issuer/audience/만료/JWKS 검증|
|모임 삭제 후 감사 로그 소실|group cascade가 감사 행도 지움|감사 로그는 콘텐츠 없이 모임/actor UUID·행위·시각 보존|
|챗 메시지 순서 불안정|동일 transaction의 now() timestamp가 같음|DB identity sequence로 개인 세션 메시지 정렬|
|migration 이중 실행|Supabase와 Flyway가 같은 초기 DDL을 다시 적용하면 충돌|기본 Flyway 비활성, migration 실행 주체 한 개를 README에 명시|
|nullable 메모 폼 값|생성 타입이 string/null로 정확해지며 TypeScript 실패|폼 defaultValue에 빈 문자열 적용|

## 실제 실행한 검증

- Java 21 / Maven package 성공. Spring Boot 3.5.16 실행을 포함한 **13개 테스트, 실패 0**.
  - RSA JWKS 서명, issuer/audience, 만료, 위조 서명 거부.
  - 명시적 local HS256의 올바른 secret 허용 및 잘못된 secret 거부.
  - 모임 비멤버 404, 멤버 관리자 행위 거부, 작성자 본인 수정, 관리자와 소유자 구분, 다른 모임 거부.
  - JDBC timestamp UTC DTO 변환, Storage 경로 응답 제외.
  - 실제 Spring HTTP OpenAPI 출력 및 인증 없는 API 401. **25개 REST 경로 / 45개 HTTP 연산** 계약 저장.
- Next.js 16.4.0 **TypeScript 검사 및 production build 성공**. 루트 화면 및 두 BFF route 생성.
- Python 3.12.15 / FastAPI **10개 테스트, 실패 0**.
  - 내부 토큰 필수, 모임/개인 세션 검증, SQL 모임 및 허용 문서 조건, 인용 문서·페이지, 근거 없음/degraded, 요청 크기/질문 길이, 페이지 청킹, 결정적 mock 차원.
  - 테스트 DB adapter는 fake이며 이 테스트만으로 실제 DB 검색을 검증했다고 간주하지 않음.
- **PGlite PostgreSQL/pgvector 13개 실제 SQL 검증 통과**.
  - migration 전체 적용, public 또는 extensions에 설치된 pgvector의 search_path 처리.
  - 모임별 게시글 조회, 다른 모임 post에 댓글 FK 거부.
  - 비멤버 참석 FK 거부, 참석 upsert, 잘못된 일정 시간 거부.
  - 같은 임베딩을 가진 다른 모임 문서가 검색에 섞이지 않음, 허용 문서 범위 제한.
  - 트랜잭션 rollback 시 기존 청크 유지, authenticated 직접 테이블 접근 거부.
  - 개인 챗 사용자 범위, 탈퇴 시 챗/참석 삭제 및 게시글 보존, 문서/모임 삭제 청크 cascade.
  - Supabase의 auth.users/storage.buckets만 최소 stub. 실제 Auth/Storage 서버는 이 테스트에 포함되지 않음.
- Supabase/Flyway migration 동일성 및 1536차원 일치 검사 성공.
- 실제 Next 개발 서버 HTTP **4개 smoke 검증 통과**: 화면 200, 쿠키 없는 API 401, 다른 Origin의 auth POST 403, Supabase 설정 누락 503.
- 프론트 소스에서 NEXT_PUBLIC secret·localStorage 토큰·실제 service_role/LLM 비밀 literal 없음 확인. 서버 환경 예시는 placeholder만 제공.

검증 중 sandbox의 네트워크/로컬 포트 제한으로 실패한 실행은 승인된 권한으로 다시 실행했습니다. Python 기본 설치는 3.9여서 검증용 3.12 런타임을 사용했습니다. FastAPI TestClient의 httpx adapter와 Mockito 동적 agent에 deprecation 경고가 있었으나 최종 검증은 통과했습니다.

## 미검증·남은 제한

- 실제 Supabase Auth 가입·확인메일·refresh·회원 계정 기반 두 모임 E2E, Storage signed URL CORS/업로드/다운로드/삭제는 실제 프로젝트 환경 설정 후 확인해야 합니다. 원격 프로젝트를 임의 선택하거나 비밀을 가져오지 않았습니다.
- 실제 OpenAI embedding/chat 호출, 문서 PDF 추출과 실제 DB를 잇는 전체 인덱싱·챗 흐름은 외부 키 없이 실행하지 않았습니다. mock/degraded adapter의 동작만 검증했습니다.
- 브라우저를 통한 로그인 후 전체 화면, 모바일 viewport, 스크린리더·키보드의 종단 검증은 미완료입니다. 기본 화면 HTTP와 빌드 성공을 시각/접근성 검증으로 간주하지 않습니다.
- Docker 환경이 없어 Compose image build/up 및 로컬 Supabase start/db reset을 실행하지 않았습니다. 초기 SQL은 PGlite에서만 실제 적용했습니다. 원격 Supabase advisors도 실행하지 않았습니다.
- 현재 화면 전환은 한 App Router 페이지 내부 상태이며, 상세 URL 공유·브라우저 뒤로 가기 이력은 지원하지 않습니다.
- 소유권 이전·프로필 이름 편집·OCR·백그라운드 작업 큐·다중 인스턴스 rate limit은 없습니다. 자료 인덱싱은 동기식이며 큰 PDF는 HTTP 시간 제한에 도달할 수 있습니다.
- Storage와 PostgreSQL을 아우르는 분산 트랜잭션은 없습니다. 파일 삭제 후 DB 실패 시 다시 삭제해 마무리하고, 실패 업로드 pending 문서는 관리자가 정리합니다.
- 기존에 발급된 access JWT는 로그아웃 후에도 만료 시각까지 서명 검증이 가능하지만 DB 멤버십 확인으로 탈퇴/제거된 모임 접근은 차단합니다. 요청/권한 변경의 완전한 직렬화와 session revocation DB 조회는 구현하지 않았습니다.

## 실제 서비스 연결 후 실행할 시나리오

1. 새 개발 Supabase에 migration 적용 → 두 사용자 가입/로그인 → 각각 다른 모임 생성.
2. 다른 모임 UUID·post/event/document/session ID로 모든 읽기/수정/삭제와 RAG 요청을 변조해 데이터가 노출되지 않는지 확인.
3. 멤버의 공지·자료·초대·역할 변경을 403으로 확인하고 관리자/소유자 권한을 대조.
4. 초대 만료·폐기·중복 참여, 소유자 탈퇴 금지, 멤버 제거 즉시 접근 차단 확인.
5. UTC 일정의 브라우저/모임 시간대 표시와 참석 응답 갱신 확인.
6. 텍스트 PDF·메모 등록 → ready → 질문 → 실제 문서/페이지 인용 → 다른 모임 검색 제외.
7. 스캔 PDF·손상 PDF·MIME/크기 위반과 degraded/provider 오류를 사용자 문구로 확인.
8. 재색인 실패 rollback, 문서 삭제 파일/벡터 정리, 탈퇴 챗/참석 정리 확인.
9. mobile 폼/채팅, Dialog focus/ESC, 목록 빈 상태·오류·세션 만료 및 느린 모임 전환 확인.

## 2026-10-07 PDF RAG 실연동 점검

- 실제 등록 PDF는 ready, version 1, 2개 청크/추출 텍스트 1445자로 확인. 기존 환경은 키가 있어도 mock provider였음.
- 로컬 및 Compose 환경의 provider를 openai로 변경. 실제 text-embedding-3-small 호출이 1536차원을 반환했고 기존 PDF를 원자적으로 재색인하여 ready 확인.
- 의미 검색은 SQL의 모임/허용 문서/current version/ready 필터를 유지한 top-k 후보 방식으로 변경. 실제 OpenAI 후보에는 mock용 고정 cutoff를 사용하지 않으며 모델이 근거를 판단. 제목/페이지를 함께 제공하고 요약·표현 변경·부분 답변을 허용하는 프롬프트 적용.
- RAG 회귀 테스트 13개 통과: tenant/session 인가, 실제 청크 인용, provider 후보 방식, 에러 안내 구분, 다른 모임 비밀 요구 차단 포함.
- 실제 모델로 PDF 요약 grounded=true/인용 2개, 자료에 없는 주식 가격 grounded=false/인용 0개 확인. 사용자 실제 로그인 화면을 통한 전체 E2E는 이 점검에서 실행하지 않음.
