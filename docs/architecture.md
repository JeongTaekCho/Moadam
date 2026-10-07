# 모임 지식 커뮤니티 MVP 계약

빈 저장소에서 시작. Next.js App Router BFF → Spring Boot REST → PostgreSQL / Supabase Storage 및 내부 FastAPI. Java 21, Python 3.11+, Node 22+. Supabase Auth 이메일/비밀번호와 비대칭 JWT 서명키 기본 사용. local HS256은 서버 secret 명시 설정 시에만 검증. 브라우저에 토큰을 반환하지 않고 HttpOnly 쿠키에 보관. BFF는 Origin 검사를 통해 CSRF를 차단한다.

## 권한
|행위|소유자|관리자|멤버|
|---|---|---|---|
|열람, 글/댓글/일정 생성, 참석, 개인 챗|가능|가능|가능|
|작성물 수정/삭제|전체|전체|본인|
|공지, 자료 관리, 초대|가능|가능|불가|
|관리자 역할 변경, 모임 설정/삭제|가능|불가|불가|
|멤버 제거|가능|일반 멤버만|본인 탈퇴|

소유자 탈퇴/제거 금지. 탈퇴 후 콘텐츠는 보존하되 개인 챗과 참석 응답 삭제. 모임 삭제는 관련 콘텐츠 cascade 및 Storage 파일 정리. 감사 로그는 모임 UUID·행위·시각만 삭제 후에도 보존. 문서 삭제는 벡터 cascade, Storage 삭제 성공 후 DB 삭제. 게시글/댓글/일정은 hard delete; 게시글 삭제 시 댓글, 일정 삭제 시 참석 cascade. 모든 시간을 UTC timestamptz 저장하며 group.timezone IANA로 표시.

## API
접두사 `/api/v1`. UUID 리소스. 목록 `{items, page, size, total}`. 오류 `{code,message,requestId}`. 기본 page=0,size=20,max=100. 입력 DTO는 별도 record. Springdoc `/v3/api-docs`를 프론트 openapi-typescript로 생성한다.

- GET/POST groups; GET/PATCH/DELETE groups/{g}
- GET groups/{g}/members; PATCH/DELETE groups/{g}/members/{user}; DELETE groups/{g}/membership
- GET/POST groups/{g}/invites; DELETE groups/{g}/invites/{id}; POST invites/join `{token}` (일회용 7일 만료, SHA256 해시 저장)
- GET/POST groups/{g}/posts; GET/PATCH/DELETE groups/{g}/posts/{id}
- GET/POST groups/{g}/posts/{p}/comments; PATCH/DELETE .../comments/{id}
- GET/POST groups/{g}/events; GET/PATCH/DELETE .../events/{id}; PUT .../{id}/attendance `{status:going|not_going|maybe}`; GET .../{id}/attendance
- GET/POST groups/{g}/documents (memo: `{title,kind:memo,text}`); GET/PATCH/DELETE .../{id}; POST .../{id}/index; POST .../uploads `{title,filename,mime,size}` → document + signed upload URL; POST .../{id}/complete; GET .../{id}/download
- GET/POST groups/{g}/chat/sessions; GET/DELETE .../{id}; GET/POST .../{id}/messages `{question}`

## 화면과 API 의존성
단일 앱 내 현재 모임 전환, 홈, 커뮤니티 상세/편집/댓글, 월간 일정/목록/참석, 자료 업로드/메모/상태, 개인 챗/인용, 멤버/초대/설정. 로그인은 BFF auth, 모든 도메인 화면은 위 REST 계약. 공통 상태 컴포넌트와 폼은 모바일 우선.

## RAG
내부 Bearer 토큰 필수. `/health`, `/ready`, `/index`, `/query`. Spring에서 멤버십 확인 후 전달, Python에서 DB 멤버십 재확인. SQL WHERE group_id 및 허용 document IDs 적용 후 LIMIT. 1536차원 임베딩, 청크 1000자 overlap 150, 페이지 보존. 같은 version 인덱싱은 transaction에서 교체, 삭제/재색인 경쟁은 문서 row lock. 기본 degraded 모드는 인덱싱 명확한 실패와 grounded=false 답변. development mock은 명시 설정에서만 사용, 답변은 인용된 발췌이며 실제 LLM처럼 표시하지 않는다. OpenAI provider는 실제 embedding + 응답, 검증된 청크 ID만 인용. OCR 미지원.
