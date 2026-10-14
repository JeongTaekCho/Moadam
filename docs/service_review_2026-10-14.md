# 모아담 전체 서비스 점검

- 점검일: 2026-10-14 (한국 시간)
- 기준 커밋: `936d38d`
- 운영: `https://moadam.vercel.app`, Spring Render 서비스, FastAPI Vercel 서비스, Supabase Moadam
- 상태: HTTP·배포·DB 및 격리 테스트 점검 완료, 로그인된 운영 브라우저 추가 점검 제한

## 결론

점검 시 공개 페이지, API 인증 차단, Spring liveness/readiness, RAG liveness는 정상 응답했다. 프론트와 RAG는 기준 커밋의 production 배포가 READY였다. 최근 30분의 두 Vercel 프로젝트 error/fatal 로그 조회 결과는 없었으며, 이는 그 시간 범위에서 반환된 로그가 없다는 뜻이다.

운영 인증 오류에서 한글이 깨지는 문제를 재현하고 백엔드 코드를 수정했다. AI 답변 한 건에는 실제 줄바꿈 대신 역슬래시와 n 문자가 노출되는 잔여 품질 이슈가 있어 별도 확인이 필요하다. 현재 결과를 모든 운영 기능의 종단간 검증 완료로 해석하면 안 된다.

## 운영에서 직접 확인한 범위

| 항목                                          | 결과                     | 근거와 한계                                                                |
| --------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| 홈·소개·자료·게시판·일정·멤버·마이페이지·설정 | HTTP 200                 | 비로그인 페이지 응답 검사이며 로그인 후 데이터 로딩 검증은 아님            |
| robots/sitemap                                | HTTP 200                 | 정상 콘텐츠 유형                                                           |
| BFF `/api/proxy/me`, `/api/proxy/groups`      | HTTP 401                 | 비로그인 보호 정상, 한국어 세션 안내 정상                                  |
| Spring `/api/v1/me`, `/api/v1/groups`         | HTTP 401                 | 접근 차단 정상, 한글 오류 메시지는 깨짐 재현                               |
| Spring `/healthz`                             | HTTP 200 / ok            | 642ms 관찰                                                                 |
| Spring `/readyz`                              | HTTP 200 / ready         | 412ms 관찰, DB와 readiness 검사 대상 테이블 확인                           |
| RAG `/healthz`                                | HTTP 200 / ok            | 프로세스 liveness만 확인하며 내부 토큰·모델·DB readiness까지 보장하지 않음 |
| 프론트·RAG 배포                               | 같은 커밋 / READY        | Vercel API 조회                                                            |
| Vercel 런타임 오류                            | 최근 30분 조회 결과 없음 | 장기 오류 이력·Render 로그·트래픽 전체 정상 여부는 별개                    |
| 회원 페이지 캐시                              | private/no-store         | 비로그인 페이지 응답의 헤더 확인                                           |
| HTTP 보안 헤더                                | nosniff / DENY           | 프론트 응답 확인                                                           |

로그인 브라우저는 컴퓨터 제어가 `cgWindowNotFound`를 반환해 이 점검 중 새 운영 CRUD, 가입·로그아웃, 초대 참여, 파일 업로드와 개인 대화 실행을 완료하지 못했다. 사용자 데이터의 생성·삭제나 운영 설정 변경은 수행하지 않았다. 앞선 같은 세션의 홍보 자료 작업에서 실제 자료 검색·AI 답변 및 출처 이동·게시판·일정 상세를 사용했지만, 이를 이번 점검의 새 회귀 검사로 대체하지 않는다.

## 로컬 및 격리 검증

| 검사                                     | 결과              | 범위                                                                                                                                                                                                                 |
| ---------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 프론트 `pnpm check`                      | 통과              | 포맷·ESLint·TypeScript                                                                                                                                                                                               |
| 백엔드 `mvn verify`                      | 통과              | 52개 테스트 및 패키징, 인증 한글 수정 후 재검증                                                                                                                                                                      |
| RAG unittest                             | 52개 통과         | 색인·검색·출처·권한·공지/일정 맥락·토큰 계량·스트리밍                                                                                                                                                                |
| RAG Ruff / 규칙·마이그레이션·의존성 검사 | 통과              | `make rag-check conventions`                                                                                                                                                                                         |
| 프론트 cache/ai-usage/db/events          | 통과              | 요청 중복·취소·모임 격리, 토큰 수치, PGlite 24개 DB 검사, 날짜 경계                                                                                                                                                  |
| OAuth 격리 검사                          | 통과              | PKCE·콜백·쿠키·중복 가입·비밀번호 검증, 실제 메일/OAuth 제공자 호출 없음                                                                                                                                             |
| chat-stream                              | 통과              | UTF-8 분할·중단·오류·BFF 전달·취소                                                                                                                                                                                   |
| ai-errors UI                             | 1440px/390px 통과 | 오류 문구·초안 보존·재시도·모임 한도·마크다운                                                                                                                                                                        |
| performance UI                           | 통과              | 8개 페이지 비로그인 보호, 캐시 이동·수정 무효화·모임 전환·만료 세션·모바일                                                                                                                                           |
| events UI                                | 1440px/390px 통과 | 한국/미국 시간대·과거 시작일 오류·폼 정렬·달력·참석·105개 일정 페이징                                                                                                                                                |
| discussion UI                            | 1440px/390px 통과 | 키보드 이동·댓글/답글·실패 초안·수정/삭제·리소스 격리                                                                                                                                                                |
| documents UI                             | 1440px/390px 통과 | 메모 색인·상태 polling·업로드 재개·OCR 실패 표시                                                                                                                                                                     |
| Next production webpack 빌드             | 통과              | `pnpm exec next build --webpack`, 해당 빌드로 격리 UI 검사                                                                                                                                                           |
| 기본 Turbopack 빌드                      | 로컬 실행 실패    | PostCSS 처리의 하위 프로세스 포트 bind에서 `Operation not permitted`; 동일 소스 webpack 빌드는 통과. 일반 Node의 localhost bind는 가능해 Turbopack 하위 프로세스 실행 경계 문제로 범위를 좁혔으나 근본 원인은 미확정 |

루트 `make check`는 시스템 PATH에 mvn이 없어 백엔드 단계에서 중단됐다. 설치된 Maven의 절대 경로로 백엔드를 검증하고 나머지 검사도 각각 완료했다. RAG 테스트는 `rag/` 작업 디렉터리에서 실행해야 하며, 루트에서 잘못 실행한 초기 import 오류는 올바른 디렉터리 실행으로 해소했다.

위 UI·OAuth·DB 테스트는 fixture 및 격리 DB를 사용한다. 운영 CRUD·메일·모델 품질·서드파티 OAuth 성공을 증명하는 테스트가 아니다. 모바일 과거 시작일 오류 캡처도 확인했으며 시작일 안내가 줄바꿈되고 종료일 칸과 겹치지 않았다.

## 발견 사항 및 조치

### 수정 완료 / 배포 필요: 인증 오류 한글 손상

Spring Security의 직접 JSON Writer 응답에 UTF-8이 빠져 있었다. UTF-8을 지정하고 실제 HTTP 회귀 검증을 보강했다. [수정 기록](issue/2026-10-14_인증_오류_한글_깨짐.md)을 참고한다. 백엔드 배포 전까지 운영 메시지는 기존 상태다.

### 미해결: AI 답변의 이중 이스케이프 줄바꿈

같은 세션의 실제 AI 사용 중 일반 설명·번호 목록 사이에 `\\n`이 문자로 노출됐다. 내용 원문을 외부에 복사하지 않고 DB 집계로 확인한 결과 assistant 메시지 59건 중 리터럴 역슬래시+n을 포함한 메시지는 1건이었다. 이 집계만으로 모든 포함 사례가 오류임을 판단할 수는 없지만, 이번 화면에서는 줄바꿈 의도임을 확인했다.

코드의 JSON 디코더는 정상 JSON 이스케이프를 한 번 해석하고, 마크다운 렌더러는 실제 개행으로 나눈다. 모델이 개행을 이중 이스케이프했을 가능성이 있으나 원시 provider payload는 확보하지 않아 발생 지점을 확정하지 않았다. 전체 문자열에 무조건 replace/unescape하면 코드 예시의 `\\n`, 정규식, 경로를 훼손할 수 있어 이번 점검에서 임의 변환이나 기존 대화 DB 수정을 하지 않았다. 다음 조치는 비민감 fixture로 이중 이스케이프를 재현하고 코드/인라인 리터럴을 보존하는 변환 경계를 정하는 것이다.

### DB 점검 권고: 즉시 장애와 구분

- 18개 public 테이블의 RLS는 활성화돼 있고 정책은 없다. anon/authenticated 직접 테이블 권한이 없으며 public SECURITY DEFINER 함수도 없다. 현재 BFF·Spring 권한 검사 구조의 차단 상태이므로, 이 알림을 없애려고 공개 정책을 추가할 필요는 없다.
- 자료 3건 모두 ready이며 document_jobs는 완료 1건으로 집계됐다. 대기/실패/장기 실행 작업은 이 집계에 없었다.
- vector 확장이 public에 있다는 WARN이 있다. 스키마 이동은 vector 타입·검색 경로와 의존성을 확인한 별도 마이그레이션으로 검토한다. [공식 권고](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- 유출 비밀번호 보호 비활성 WARN이 있다. Supabase 플랜과 인증 정책을 확인해 운영 설정으로 검토한다. [공식 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- FK를 덮는 인덱스가 없는 항목 6개가 INFO로 나왔다: chat_sessions.user_id, comments.author_id, event_attendees.(group_id,user_id), event_attendees.user_id, events.author_id, group_invites.created_by. 실제 쿼리/삭제 빈도·EXPLAIN 확인 후 추가 여부를 정한다. [공식 권고](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- 미사용 인덱스 6개는 작은 현재 데이터·사용량만으로 불필요하다고 판단할 수 없어 삭제하지 않았다. [공식 안내](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## 남은 운영 확인

1. 수정된 백엔드를 배포한 뒤 401 한국어 응답을 재확인한다.
2. 브라우저 창 접근이 복구되면 로그인 상태로 신규 메모/게시글/일정의 등록·수정·삭제와 초대/프로필, 세션 만료 흐름을 실제로 점검한다. 테스트용 콘텐츠는 별도로 식별한다.
3. RAG 내부 readiness와 Spring → RAG 운영 호출을 확인하고, AI의 일정·공지 참조 및 후속 질문을 실제 모델로 재검증한다.
4. AI 개행 이슈의 스트리밍·저장·재조회 동작을 함께 고친다.

운영 배포·DB 스키마/인증 설정 변경·SQL Editor 수정은 이번 점검에서 수행하지 않았다. 확인된 한글 수정에는 SQL 작업이 필요 없다.

## 2026-10-14 후속 개선 결과

- AI 리터럴 개행은 코드·경로를 보존하는 표시 보정과 생성 지침을 추가했다. 기존 저장 메시지·작성 중 메시지에 같은 렌더러가 적용된다. [상세 수정 및 검증](issue/2026-10-13_모아AI_답변_마크다운_서식.md)
- production 기본 빌드는 검증된 Webpack으로 명시했고 `pnpm build`가 성공했다. CI도 같은 package script를 사용한다. 기존 Turbopack 하위 프로세스 환경 문제 자체는 우회한 것이다.
- advisor의 누락 FK 인덱스 6개를 보완하는 SQL과 Flyway 복사본을 작성했다. 격리 DB에서 대상 FK 인덱스 적용·반복 실행·기존 접근 차단을 확인했다. [SQL 적용 안내](issue/2026-10-14_운영빌드_및_FK_인덱스_보완.md)
- 프론트 검사·마크다운 회귀 검사·production 빌드·AI 오류 UI·성능·스트리밍·DB 검사, RAG Ruff 및 unittest 52개를 통과했다. 인증 UTF-8 수정은 앞선 백엔드 52개 검사 통과 상태를 유지한다.
- 운영 코드 배포와 SQL Editor 적용은 대기 상태다. 운영 브라우저 제약과 실제 모델 재검증 제한은 위 점검 기록과 같다. 기존 대화 내용의 DB 수정이나 운영 보안 설정 변경은 수행하지 않았다.
