# 모아 — 모임 지식 커뮤니티 MVP

가족·회사·커플·동아리의 이야기, 일정, 자료와 개인 챗을 모임 단위로 관리합니다. 빈 저장소에서 Next.js App Router + TypeScript, Java 21 / Spring Boot 3.5.16, Supabase PostgreSQL·Storage·Auth, Python 3.12 / FastAPI, pgvector로 구현했습니다. Next.js 16.4.0과 프론트 의존성은 lockfile에 고정했습니다.

## 지금 해야 할 설정 (처음 실행하는 순서)

**권장 시작 구성: 원격 Supabase 개발 프로젝트 + 로컬 서비스 3개 + 개발용 mock RAG.** OpenAI 키는 나중에 추가해도 됩니다. 아래 체크리스트를 순서대로 진행하세요.

- [ ] Supabase 프로젝트 준비 및 URL/API 키/DB 접속 정보 확인
- [ ] 초기 migration 실행: 테이블 + pgvector + 비공개 Storage 생성
- [ ] 이메일 Auth / localhost URL / JWT 서명 방식 확인
- [ ] `.env`, `frontend/.env.local`, `rag/.env`에 실제 값 입력
- [ ] RAG → Spring → Next를 각각 다른 터미널에서 실행
- [ ] 가입 → 모임 생성 → 메모 등록·색인 → 챗 인용 확인
- [ ] 실제 AI가 필요하면 OpenAI 설정 후 기존 자료 재색인

### 1. Supabase에서 가져올 값

새 개발 프로젝트를 기준으로 합니다. 프로젝트가 준비되면 아래 값을 확인하세요. 키나 비밀번호를 README 또는 채팅에 붙여 넣지 말고 아래 입력 파일에 저장하세요.

|필요 값|찾는 위치 / 내용|입력할 파일|
|---|---|---|
|프로젝트 URL|프로젝트 API 설정의 `https://프로젝트REF.supabase.co`|세 파일의 `SUPABASE_URL`|
|Publishable key|Settings → API Keys의 publishable key|루트 `.env`, `frontend/.env.local`|
|Legacy service_role JWT|Settings → API Keys → Legacy 탭의 `service_role`|루트 `.env`, `rag/.env`|
|DB host / port / username|프로젝트 상단 **Connect → Session pooler**에서 복사|루트 `.env`, `rag/.env`|
|DB password|프로젝트 생성 시 정한 Database password; 모르면 DB 설정에서 재설정|루트 `.env`, Python DB URL|
|JWT secret (조건부)|서명 방식이 기존 HS256일 때만 legacy JWT secret 사용|루트 `.env`만|

현재 Storage 호출은 **legacy service_role JWT**를 사용하도록 구현되어 있습니다. `sb_secret_...` 키로 임의 교체하지 마세요. Publishable key와 service_role은 서로 다른 값이고, DB 비밀번호와 JWT secret도 서로 다릅니다.

Session pooler는 기본 예시에서 5432 포트를 사용하며 사용자명은 `postgres.프로젝트REF`입니다. **호스트는 Connect 화면의 실제 값을 복사**하세요. 지역명으로 조합하지 마세요. Direct 연결을 쓰면 사용자명이 `postgres`이고 기본 IPv6 연결 가능 여부를 확인해야 합니다. 현재 기본 구성에서는 prepared statement를 지원하는 Session pooler를 사용합니다. [공식 DB 연결 안내](https://supabase.com/docs/guides/database/connecting-to-postgres)

### 2. DB·pgvector·Storage 초기 설정

Supabase **SQL Editor → New query**에서 아래 파일 전체를 붙여 넣어 **새 개발 DB에 한 번** 실행하세요.

[`supabase/migrations/20261007053817_initial_community.sql`](supabase/migrations/20261007053817_initial_community.sql)

이미 적용한 프로젝트에서는 다시 실행하지 않습니다. CLI를 선호하면 아래 기존 "Supabase 설정과 migration" 절의 `db push` 방식을 사용하세요. 둘 중 하나만 사용하고 루트 `.env`의 `FLYWAY_ENABLED=false`를 유지합니다.

이 migration이 다음을 함께 설정합니다.

- `vector`(pgvector), `pgcrypto` extension
- 모임·게시글·일정·문서·챗 등 13개 테이블과 모임 범위 FK / RLS
- `document_chunks.embedding`의 **vector(1536)** 컬럼
- **비공개** `group-documents` Storage 버킷: PDF MIME, 최대 20MB

별도 벡터 서비스 가입이나 Dashboard에서 임베딩 생성 설정은 필요 없습니다. Python 서비스가 임베딩을 생성하고 PostgreSQL에 저장·검색합니다. 추가 검색 RPC 또는 HNSW 인덱스도 현재 MVP 실행에 필수는 아닙니다. [공식 pgvector 안내](https://supabase.com/docs/guides/database/extensions/pgvector)

SQL Editor에서 아래 조회로 적용 상태를 확인할 수 있습니다.

```sql
select e.extname, e.extversion, n.nspname as schema_name
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'vector';

select attname, format_type(atttypid, atttypmod) as column_type
from pg_attribute
where attrelid = 'public.document_chunks'::regclass
  and attname = 'embedding' and not attisdropped;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'group-documents';
```

기대 결과: vector extension 1행, `vector(1536)`, 버킷 `public=false` / `file_size_limit=20971520` / PDF MIME입니다. 브라우저는 Spring API를 통해 접근하므로 테이블의 anon/authenticated 권한을 열거나 버킷을 public으로 바꿀 필요가 없습니다. PDF는 앱의 자료 업로드 화면에서 등록해야 문서 레코드와 색인이 연결됩니다.

### 3. Supabase Auth 설정

- Authentication의 이메일 Provider를 활성화하고 신규 가입을 허용합니다.
- URL Configuration의 **Site URL**을 `http://localhost:3000`으로 설정하고 Redirect URLs에도 이 주소를 허용합니다.
- 개발 중 빠르게 확인하려면 이메일 확인을 끌 수 있습니다. 켜 둔다면 가입 후 확인 메일 링크를 누르고 다시 로그인하세요. 운영 환경에서는 메일 확인 및 실제 HTTPS 주소를 사용하세요.
- JWT Signing Keys가 **ES256/RS256이면 `SUPABASE_JWT_SECRET`을 비워 둡니다.** Spring이 JWKS로 검증합니다. 기존 HS256 또는 로컬 legacy 구성에서만 JWT secret을 입력합니다. 초기 실행을 위해 기존 키를 무조건 회전할 필요는 없습니다.

### 4. 환경변수 입력 — 파일이 준비되어 있습니다

|실제 입력 파일|예시 원본|사용 서비스|
|---|---|---|
|[`.env`](.env)|[`.env.example`](.env.example)|로컬 Spring / Docker Compose|
|[`frontend/.env.local`](frontend/.env.local)|[`frontend/.env.example`](frontend/.env.example)|Next.js 서버|
|[`rag/.env`](rag/.env)|[`rag/.env.example`](rag/.env.example)|로컬 Python RAG|

실제 입력 파일은 기존 파일이 있으면 보존하고, 없으면 placeholder로 생성했습니다. `YOUR_*` 값을 실제 값으로 교체하세요. 실제 파일은 `.gitignore`로 제외되어 있습니다. 환경변수를 바꾼 뒤에는 해당 서비스를 재시작합니다.

**반드시 맞출 항목:**

1. 세 파일의 `SUPABASE_URL`은 같은 프로젝트.
2. 루트 / Next의 `SUPABASE_PUBLISHABLE_KEY`는 같은 키.
3. 루트 / RAG의 `SUPABASE_SERVICE_ROLE_KEY`는 같은 legacy JWT.
4. `openssl rand -hex 32`로 내부 토큰을 생성하여 루트 / RAG의 `RAG_INTERNAL_TOKEN`에 **동일하게** 입력.
5. 루트의 `DATABASE_URL`은 JDBC, RAG의 `DATABASE_URL`은 PostgreSQL URL.

```dotenv
# 루트 .env: Spring
DATABASE_URL=jdbc:postgresql://실제_POOLER_HOST:5432/postgres?sslmode=require
DATABASE_USER=postgres.실제_PROJECT_REF
DATABASE_PASSWORD='원본_DB_비밀번호'
RAG_URL=http://localhost:8000

# rag/.env: Python (jdbc: 접두사 없음)
DATABASE_URL=postgresql://postgres.실제_PROJECT_REF:URL인코딩한_비밀번호@실제_POOLER_HOST:5432/postgres?sslmode=require

# frontend/.env.local
BACKEND_URL=http://localhost:8080
```

Python URL의 비밀번호는 reserved character를 percent-encoding합니다. 예: 원본 `abc@123#` → `abc%40123%23`. Spring의 `DATABASE_PASSWORD`에는 인코딩하지 않은 원본을 입력하세요. 루트 `.env`는 shell로 로드하므로 특수문자는 적절히 인용해야 합니다. 작은따옴표를 포함한 비밀번호는 단순 작은따옴표 감싸기 대신 shell quoting을 처리하거나 IDE 환경변수 설정을 사용하세요.

**처음에는 기본값을 유지:** `APP_ENV=development`, `RAG_PROVIDER=mock`, `EMBEDDING_DIMENSIONS=1536`, `FLYWAY_ENABLED=false`. mock은 개발용 임베딩/발췌 답변으로 화면에 표시되며 실제 LLM 답변이 아닙니다. `degraded`는 인덱싱을 실패 상태로 명시하고 근거 없는 답변을 유보하는 모드입니다.

루트 `RAG_DATABASE_URL`은 Compose에서 Python에 전달할 URL입니다. 로컬 Python은 `rag/.env`의 `DATABASE_URL`을 읽습니다. Compose를 사용할 때는 모델/키 설정도 **루트 `.env`**를 수정하세요. Compose는 `RAG_URL`과 `BACKEND_URL`의 컨테이너 주소를 자동 지정합니다.

### 5. 실행 — 서로 다른 터미널 3개

필요 도구: Node 22 이상 / pnpm 12.5.1 / Java 21 / Maven 3.9 이상 / Python 3.12. 아래는 프로젝트 루트에서 시작하는 명령입니다. **실행할 때 예시 파일을 다시 복사해 입력한 값을 덮어쓰지 마세요.**

터미널 A — RAG:

```sh
cd rag
# .venv가 없거나 다른 Python으로 만들었다면 생성
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

터미널 B — Spring:

```sh
set -a
. ./.env
set +a
mvn -f backend/pom.xml spring-boot:run
```

터미널 C — Next:

```sh
cd frontend
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

접속: 앱 `http://localhost:3000`, Swagger `http://localhost:8080/swagger-ui.html`. RAG는 내부 토큰 인증이 필요하므로 브라우저에서 `/health`를 직접 열면 401이 정상입니다.

**RAG 터미널에서 루트 `.env`를 source하지 마세요.** 이미 export된 JDBC `DATABASE_URL`이 `rag/.env`보다 우선해 DB 연결을 깨뜨립니다. 새 터미널에서 위 순서대로 실행하세요.

### 6. 처음 확인할 사용 흐름 / 실제 AI 켜기

1. 가입·로그인 → 모임 생성.
2. 자료에서 메모 `회비는 월 1만원입니다.` 등록 → 사용 가능 상태 확인.
3. 새 챗에서 `회비는` 질문 → 개발용 발췌 답변과 실제 자료 인용 확인. mock은 단어 일치 중심이므로 자연어 추론 품질 검증용이 아닙니다.
4. 다른 계정으로 초대 참여 → 글/일정/참석 응답 확인.
5. 관리자로 PDF 업로드 → 처리 상태 및 출처 페이지 확인. 스캔 PDF의 OCR은 지원하지 않습니다.

실제 AI가 필요하면 `rag/.env`의 `RAG_PROVIDER=openai`, `OPENAI_API_KEY=실제키`를 설정하고 RAG를 재시작합니다. 기본 모델은 `text-embedding-3-small` / `gpt-4.1-mini`, 차원은 1536입니다. 키 발급은 [OpenAI API 대시보드](https://platform.openai.com/api-keys)에서 하고 계정의 모델 접근 권한/사용 한도를 확인하세요. provider나 embedding model을 바꾼 뒤에는 **기존 자료 전체를 재색인**해야 합니다. OpenAI 키는 frontend 파일에 넣지 않습니다.

### 7. 설정 중 자주 만나는 오류

|증상|확인할 설정|
|---|---|
|로그인/가입 503|Next의 Supabase URL / publishable key 입력 및 재시작|
|로그인 후 API 401|같은 프로젝트인지, JWT ES256/RS256이면 secret이 비어 있는지|
|`relation does not exist`|올바른 프로젝트에 migration을 적용했는지|
|DB 연결 실패|Connect의 실제 host / username / password, 5432, SSL, URL 인코딩|
|자료 업로드 실패|legacy service_role, 비공개 버킷 생성, PDF MIME / 20MB|
|RAG 연결 실패|로컬 RAG_URL=localhost:8000, 서비스 실행, 내부 토큰 일치|
|자료 상태 실패 / EMBEDDING_UNAVAILABLE|provider가 degraded인지; mock/openai를 명시적으로 선택|
|OpenAI 색인 실패|API 키 / 계정 한도 / 모델 권한 / 서비스 재시작|
|답변 유보 또는 검색 불일치|문서 ready 상태, provider 변경 후 재색인, 실제 자료 내용|

이 문서는 설정 방법을 정리한 것이며, 실제 Supabase 프로젝트의 migration·키·Auth 설정은 아직 적용하지 않았습니다. 입력 후 외부 연동 확인이 필요합니다.

## 구현

프론트 화면 구성·FSD 구조·디자인 토큰·메뉴 URL은 [frontend/README.md](frontend/README.md)에 정리했습니다.

- 이메일 가입·로그인·세션 갱신·로그아웃. 브라우저에 토큰을 반환하지 않는 HttpOnly 쿠키 BFF, Origin 검사, 입력 크기 제한.
- 모임 생성·전환·설정·삭제, 소유자/관리자/멤버, 만료·폐기·일회용 초대, 탈퇴·멤버 제거.
- 일반/질문/공지 게시글과 댓글 CRUD. 작성자 및 관리자 권한, 공지 우선, 페이지네이션.
- 월간 달력·모바일 일정 목록, UTC 저장/시간대 표시, 일정 CRUD, 본인 참석/불참/미정 upsert.
- 비공개 PDF 업로드·다운로드, 메모 생성·수정, 문서 상태·재색인·삭제. 메모 변경 시 version 증가.
- 사용자 개인 챗 세션·기록, 모임 자료 검색과 실제 청크 인용, 근거 부족 유보, degraded/mock/openai 명시 모드.
- 공통 디자인 토큰과 Button, TextField, Textarea, Select, Badge, Avatar, Card, Dialog, Dropdown, Tabs, Toast, Skeleton, EmptyState, ErrorState, ConfirmDialog. 도메인 컴포넌트와 반응형 메뉴.

설계·권한·API 계약은 [architecture.md](docs/architecture.md), 실제 Spring 생성 계약은 [openapi.json](docs/openapi.json), 검증 범위와 제한은 [verification.md](docs/verification.md)에 있습니다.

## 사전 준비

Node 22 이상, pnpm 12.5.1, Java 21, Maven 3.9 이상, Python 3.12, Supabase 프로젝트 또는 Docker + Supabase CLI가 필요합니다. LLM 키는 필요하지 않습니다. `RAG_PROVIDER=degraded`에서는 커뮤니티·일정·자료 등록을 사용할 수 있고 인덱싱은 `EMBEDDING_UNAVAILABLE`, 질문은 `grounded=false`로 명시됩니다.

환경 예시는 루트 `.env.example`, `frontend/.env.example`, `rag/.env.example`입니다. 비밀을 `NEXT_PUBLIC_*`에 넣지 마세요. `SUPABASE_SERVICE_ROLE_KEY`는 서버용 **legacy service_role JWT**를 사용합니다. 공개용 publishable 키는 Next 서버의 Auth 호출에서만 사용합니다. 서비스별 URL 형식은 다음과 같습니다.

|변수|소비 서비스|값|
|---|---|---|
|DATABASE_URL|Spring|`jdbc:postgresql://HOST:5432/postgres?sslmode=require`|
|DATABASE_USER / DATABASE_PASSWORD|Spring|Supabase Connect의 DB 자격증명|
|RAG_DATABASE_URL|Compose|`postgresql://USER:URL_ENCODED_PASSWORD@HOST:5432/postgres?sslmode=require`|
|DATABASE_URL|Python 단독 실행|위 libpq URL (`jdbc:` 없음)|
|SUPABASE_URL|세 서비스|Auth 및 Storage API URL|
|SUPABASE_PUBLISHABLE_KEY|Next 서버|publishable 또는 local anon 키|
|SUPABASE_SERVICE_ROLE_KEY|Spring·Python|서버 전용 legacy service_role JWT|
|SUPABASE_JWT_SECRET|Spring|local HS256일 때만 설정; 비대칭 키는 빈 값|
|RAG_INTERNAL_TOKEN|Spring·Python|동일한 32자 이상 난수|
|RAG_URL|Spring|단독 `http://localhost:8000`, Compose `http://rag:8000`|
|BACKEND_URL|Next|단독 `http://localhost:8080`|
|CORS_ORIGINS|Spring|쉼표로 구분한 허용 Origin|
|FLYWAY_ENABLED|Spring|기본 false; migration 실행 주체를 하나만 사용|

`openssl rand -hex 32`로 내부 토큰을 만들 수 있습니다. 루트 환경변수는 Spring이 자동으로 `.env`에서 읽지 않으므로 아래의 환경 로드 명령 또는 IDE run configuration이 필요합니다. 비밀번호 등 shell 특수 문자가 들어간 값은 `.env`에서 작은따옴표로 감싸고 Python DB URL의 비밀번호는 URL 인코딩하세요. 예제 placeholder를 실제 값으로 바꿔야 서비스 연결이 됩니다.

## Supabase 설정과 migration

### 로컬

```sh
supabase --help
supabase start
supabase status
# 새 개발 DB의 스키마를 적용합니다. reset은 기존 로컬 데이터를 지웁니다.
supabase db reset
```

CLI가 생성한 `supabase/config.toml`과 `supabase/migrations/*_initial_community.sql`을 제공합니다. 기본 로컬 URL은 API `http://localhost:54321`, DB `localhost:54322`, Studio `http://localhost:54323`입니다. status의 anon/service_role/JWT secret과 DB URL을 환경변수에 복사하세요. local HS256은 `SUPABASE_JWT_SECRET` 설정이 필요합니다. 로컬은 이메일 확인을 끄고, 원격 환경에서는 확인 메일을 권장합니다.

### 원격 개발 프로젝트

Auth에서 이메일 가입을 활성화하고 Site URL/허용 redirect를 실제 프론트 Origin으로 설정합니다. 기본 JWT 검증은 issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`, ES256/RS256 JWKS를 사용합니다. [Supabase JWT 문서](https://supabase.com/docs/guides/auth/jwts)를 기준으로 구성했습니다.

프로젝트를 지정한 후 CLI `supabase link --project-ref YOUR_REF`, `supabase db push`로 migration을 적용하거나 제공 SQL을 검토하여 SQL Editor에서 실행합니다. **운영 데이터가 있는 프로젝트에 초기 스키마를 그대로 적용하지 마세요.** PostgreSQL direct connection 또는 session pooler를 사용하고 Connect의 SSL 연결 정보를 따르세요. JDBC prepared statement와 transaction을 위해 transaction pooler는 기본 구성에서 사용하지 않습니다.

migration은 13개 도메인 테이블, 복합 FK, UTC timestamp, 인덱스, 갱신 trigger, `vector(1536)`, 비공개 `group-documents` 버킷을 만듭니다. 모든 public 도메인 테이블에 RLS를 켜고 `anon`/`authenticated` 직접 접근을 revoke했습니다. 이 앱의 데이터 접근은 Spring API를 통해서만 허용합니다. Storage에는 공개 정책이 없으며 서버가 권한 확인 후 서명 URL을 발급합니다.

**migration 실행 주체를 중복 사용하지 않습니다.** Supabase CLI 적용 후에는 `FLYWAY_ENABLED=false`를 유지합니다. Flyway를 사용하는 별도 초기 배포에서는 `FLYWAY_ENABLED=true`로 동일 SQL의 `backend/.../V1__community.sql`을 한 번 적용합니다. 이미 Supabase migration을 적용한 DB에 Flyway 초기 migration을 다시 실행하면 충돌합니다. `python3 scripts/check-migrations.py`는 두 SQL의 동일성을 검사합니다.

## 서비스별 실행

### 1. Python RAG

```sh
cd rag
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
# 입력 파일이 없는 경우에만 생성 (기존 값 보존)
[ -f .env ] || cp .env.example .env
# .env에 실제 DB/API/서버 키/내부 토큰을 설정
uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
```

`예시 파일은 `RAG_PROVIDER=mock`으로 시작합니다. 변수 미설정 시 코드 기본값은 `degraded`입니다. `APP_ENV=development`와 `RAG_PROVIDER=mock`을 함께 사용하면 1536차원 결정적 테스트 임베딩과 **개발용 발췌 답변**을 사용합니다. 프로덕션 mock은 시작 단계에서 거부합니다. 실제 모델은 `RAG_PROVIDER=openai`, `OPENAI_API_KEY`를 설정합니다. 모델 기본값은 `text-embedding-3-small` / `gpt-4.1-mini`. 차원은 migration과 같은 1536으로 고정 검증합니다. provider 또는 embedding model 변경 시 **모든 자료를 재색인**하세요. 서로 다른 provider의 임베딩을 섞으면 검색 품질을 보장할 수 없습니다.

`CHUNK_SIZE=1000`, `CHUNK_OVERLAP=150`, `TOP_K=5`, `SIMILARITY_THRESHOLD=0.3`, `MAX_PAGES=200`을 환경변수로 조정할 수 있습니다. 청크는 페이지를 넘지 않고 실제 페이지 번호를 보존합니다. 유사도는 근거 품질을 완전히 보장하는 확률이 아닙니다. 모든 벡터 조회에 SQL 수준의 모임 및 document ID 조건을 적용합니다. 내부 토큰뿐 아니라 실제 DB 멤버십/개인 세션도 확인합니다.

HTTP `/health`, `/ready`, `/index`, `/query` 모두 `Authorization: Bearer RAG_INTERNAL_TOKEN` 필수입니다. 스키마는 FastAPI `/openapi.json`이며 서비스 포트는 외부에 공개하지 않습니다. 동시 인덱싱/질문 4개, 요청 본문 1MB, 질문 4000자, PDF 20MB·200쪽, 최대 1000청크·페이지당 10만자·전체 100만자 추출 제한입니다. OCR은 지원하지 않습니다. 라이브러리 오류는 안전한 코드로 변환하며 문서/질문/토큰을 로깅하지 않습니다.

### 2. Spring REST

```sh
# 저장소 루트에서 .env.example을 .env로 복사하고 실제 값을 설정
# 입력 파일이 없는 경우에만 생성 (기존 값 보존)
[ -f .env ] || cp .env.example .env
set -a
. ./.env
set +a
# 단독 실행 시 RAG_URL=http://localhost:8000로 설정
mvn -f backend/pom.xml spring-boot:run
```

REST `http://localhost:8080/api/v1`, Swagger `http://localhost:8080/swagger-ui.html`, OpenAPI `http://localhost:8080/v3/api-docs`입니다. 운영에서는 `SPRINGDOC_API_DOCS_ENABLED=false`, `SPRINGDOC_SWAGGER_UI_ENABLED=false`로 문서를 숨길 수 있습니다. 내부 HTTP connect timeout 5초, Storage 20초, RAG 90초. 비용이 발생하는 POST는 자동 재시도하지 않으며 사용자가 명시적으로 재색인을 요청할 수 있습니다.

### 3. Next.js

```sh
cd frontend
# 입력 파일이 없는 경우에만 생성
[ -f .env.local ] || cp .env.example .env.local
# 실제 SUPABASE_URL/PUBLISHABLE_KEY/BACKEND_URL 설정
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

`http://localhost:3000`에서 접속합니다. `pnpm build && pnpm start`로 프로덕션 실행. 원격 배포에서는 HTTPS를 사용합니다. 이메일 가입 확인이 필요한 경우 메일 링크로 확인한 뒤 다시 로그인하세요. Next 서버가 세션을 HttpOnly/SameSite 쿠키에 보관하고 Spring에 Bearer 토큰을 전달합니다. `/api/proxy`는 Origin 검사, 세션 갱신, no-store, 네트워크 오류 변환을 수행합니다.

### Docker Compose

```sh
# 외부 Supabase DB/Auth/Storage를 연결한 루트 .env가 필요
# Docker 컨테이너 내 localhost는 Supabase 호스트가 아닙니다.
docker compose up --build
```

Compose는 세 앱을 실행하며 Supabase 자체를 띄우지 않습니다. 로컬 Supabase와 함께 쓰려면 컨테이너에서 접근 가능한 호스트 주소/issuer 구성이 필요하므로 우선 위 단독 실행을 사용하세요. RAG 포트는 내부 네트워크에만 노출합니다. 운영 배포는 이 요청에 포함되지 않았습니다.

## 데모 seed와 사용 흐름

앱에서 두 개의 실제 계정을 가입합니다. `scripts/seed-demo.sql`은 실사용자 UUID를 인자로 받아 독서 모임·공지·다가오는 일정·메모를 멱등적으로 만듭니다. Auth 계정이나 비밀번호를 SQL로 만들지 않습니다.

```sh
psql "$RAG_DATABASE_URL" -v owner_id=FIRST_USER_UUID -v member_id=SECOND_USER_UUID -f scripts/seed-demo.sql
```

소유자로 로그인 → 모임 생성 → 멤버 화면에서 초대 생성 → 다른 사용자로 초대 참여 → 글/댓글/일정과 참석 응답 → 관리자 자료 등록 → 문서 상태 확인 → 새 챗에서 질문 → 인용을 클릭해 자료 상세/PDF를 확인합니다. 메모 수정 후에는 자료의 재색인 버튼을 누릅니다.

## 검증 명령

```sh
mvn -f backend/pom.xml test
python3 scripts/check-migrations.py
cd frontend
pnpm api:types
pnpm typecheck
pnpm build
pnpm test:db
# rag/.venv 활성화 후 rag 폴더에서
python -m unittest discover -s tests -v
```

`ContractTest`는 실제 Spring 서버에서 OpenAPI를 생성해 `docs/openapi.json`에 저장합니다. `pnpm api:types`는 이 계약에서 `src/shared/api/generated-api.ts`를 생성합니다. 프론트의 도메인 타입은 생성된 스키마에서 직접 가져옵니다. 변경 시 Java 검증 → 타입 생성 → TypeScript 검사를 순서대로 실행하세요. `pnpm api:types:live`는 실행 중인 Spring 계약을 사용합니다.

`pnpm test:db`는 PGlite의 실제 PostgreSQL/pgvector에서 migration·FK·검색 조건·삭제를 실행합니다. 테스트의 auth.users와 storage.buckets는 최소 스키마 stub이며 실제 Supabase 서비스 통합을 검증하지 않습니다. 자세한 실행 결과와 미검증 항목은 [verification.md](docs/verification.md)에 기록했습니다.

## 삭제 및 운영 제한

게시글 삭제는 댓글, 일정 삭제는 참석, 자료 삭제는 벡터, 모임 삭제는 모든 모임 콘텐츠에 cascade됩니다. PDF 파일 삭제가 성공한 뒤 DB 삭제합니다. Storage와 DB 사이에는 분산 트랜잭션이 없으므로 DB 삭제 실패 시 재시도로 마무리해야 합니다. 실패 업로드는 pending 자료로 남아 관리자가 삭제할 수 있습니다.

탈퇴/멤버 제거는 개인 챗·참석을 삭제하고 글·댓글·일정·자료는 모임 기록으로 보존합니다. 소유자는 탈퇴할 수 없으며 현재 MVP에는 소유권 이전이 없습니다. 감사 로그는 모임 삭제 후에도 UUID와 행위·시각만 보존하며 본문·질문·토큰은 저장하지 않습니다. 관리자 표시명 편집, OCR, 백그라운드 작업 큐·다중 서버 rate limit, 바이러스 스캔은 현재 범위에 없습니다. 인덱싱은 동기 처리라 큰 PDF는 시간 제한에 도달할 수 있습니다. 실제 Supabase 프로젝트 및 모델 연동 검증을 완료하기 전 운영 릴리스로 간주하지 마세요.
