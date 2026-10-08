# Google 소셜 로그인 설정

구현 완료: Google로 계속하기 → Supabase Google OAuth (PKCE) → `/login/callback`에서 code 교환 → 기존 HttpOnly access/refresh 쿠키 저장 → 홈 화면. 이메일 로그인·가입도 계속 사용할 수 있습니다.

2026-10-08 확인 결과: 현재 Supabase Auth 설정 조회 HTTP 200, Google Provider `false`, 이메일 Provider `true`. Google Provider 활성화와 Google Cloud 자격증명 설정은 사용자가 완료해야 합니다.

## 1. 두 콜백 URL의 구분

| 등록 위치 | 등록할 값 | 역할 |
| --- | --- | --- |
| Google Cloud → OAuth client → Authorized redirect URIs | `https://kvikbodlebhxeznbjmyv.supabase.co/auth/v1/callback` | Google → Supabase |
| Supabase → Authentication → URL Configuration → Redirect URLs | `http://localhost:3000/login/callback` | Supabase → 앱 |
| Supabase → Authentication → URL Configuration → Site URL | `http://localhost:3000` | 앱의 기본 주소 |
| Google Cloud → OAuth client → Authorized JavaScript origins | `http://localhost:3000` | 앱의 origin, 경로 없이 입력 |

**Google의 Authorized redirect URIs에 앱의 `/login/callback`을 넣는 방식이 아닙니다.** Google은 Supabase로 돌아오고, Supabase가 다시 앱으로 보냅니다. 기존 설정의 callback이 앱 경로라면 Supabase Redirect URLs에 등록되어 있어야 합니다.

현재 앱은 원격 Supabase를 사용합니다. Supabase CLI의 로컬 Auth 주소인 `127.0.0.1:54321`을 Google 콜백으로 넣지 않습니다.

## 2. Google Cloud / Google Auth Platform

1. https://console.cloud.google.com/ 에서 프로젝트를 선택하거나 만듭니다.
2. Google Auth Platform → Branding에 앱 이름 `모아담`, 사용자 지원 이메일, 개발자 연락처를 입력합니다. 운영 공개 시 실제 홈페이지·개인정보 처리방침·약관 URL을 준비합니다.
3. Audience에서 서비스 대상에 맞게 설정합니다. 일반 Google 계정도 로그인할 서비스라면 External을 선택합니다. Testing 상태이면 로그인할 계정을 Test users에 추가합니다. 운영 공개 시 Publishing status를 확인합니다.
4. Data Access에 기본 로그인 범위를 추가합니다.
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Clients → Create client → Web application을 선택합니다. 위 표의 JavaScript origin과 Supabase callback을 입력합니다.
6. 발급된 Client ID와 Client Secret을 Supabase Google Provider 설정에 입력합니다.

Client Secret은 Google Cloud에서 발급되어 Supabase에 저장됩니다. 이 앱의 프론트 환경변수에 Google Client Secret을 추가할 필요가 없습니다.

## 3. Supabase

현재 프로젝트: https://supabase.com/dashboard/project/kvikbodlebhxeznbjmyv

1. Authentication → Sign In / Providers (또는 Providers) → Google을 엽니다.
2. Google Provider를 활성화합니다.
3. Google Web client의 Client ID와 Client Secret을 입력하고 저장합니다.
4. 이 화면의 Callback URL이 `https://kvikbodlebhxeznbjmyv.supabase.co/auth/v1/callback`인지 확인하고 Google 콘솔의 Authorized redirect URIs와 일치시킵니다. 커스텀 Auth 도메인을 사용한다면 이 화면에 표시된 실제 값을 사용합니다.
5. Authentication → URL Configuration에서 Site URL을 `http://localhost:3000`으로 지정합니다.
6. Redirect URLs에 `http://localhost:3000/login/callback`을 추가합니다. `/login/callback`만 입력하는 대신 전체 URL을 등록합니다.
7. 신규 Google 계정도 가입해야 한다면 신규 사용자 가입 허용 설정을 확인합니다.

localhost와 127.0.0.1은 쿠키 호스트가 다릅니다. 개발 시 `http://localhost:3000`으로 로그인 시작과 콜백 주소를 통일하세요. 여러 탭에서 동시에 Google 로그인을 시작하면 마지막 요청의 verifier가 적용되므로 한 번씩 진행합니다.

## 4. 앱 환경변수

기존 `frontend/.env.local`의 다음 값이 사용됩니다.

```dotenv
SUPABASE_URL=https://kvikbodlebhxeznbjmyv.supabase.co
SUPABASE_PUBLISHABLE_KEY=현재_프로젝트의_publishable_key
BACKEND_URL=http://localhost:8080
```

기존 실제 값은 유지합니다. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `service_role`을 추가할 필요가 없습니다. 앱은 요청 origin에 `/login/callback`을 붙여 redirectTo를 생성합니다. 프론트·백엔드는 같은 Supabase 프로젝트를 사용해야 합니다.

Supabase Dashboard 설정만 바꿨다면 앱 재시작 없이 적용됩니다. `.env.local`을 바꿨다면 프론트를 재시작합니다.

## 5. 운영 도메인 적용

예를 들어 운영 주소가 `https://moadam.example`이면:

- Google JavaScript origins: `https://moadam.example`
- Google redirect URI: 위와 같은 Supabase `/auth/v1/callback`
- Supabase Site URL: `https://moadam.example`
- Supabase Redirect URLs: `https://moadam.example/login/callback`

운영은 HTTPS를 사용합니다. 배포된 앱은 Secure 쿠키를 사용합니다. 개발/운영 URL을 같은 Supabase 프로젝트에서 사용할 경우 둘 다 Redirect URLs에 등록할 수 있습니다. 실제 운영 프로젝트·도메인이 정해지면 그 프로젝트의 Google callback을 사용합니다.

## 6. 확인 순서

1. http://localhost:3000 에서 로그아웃한 상태로 Google로 계속하기를 누릅니다.
2. 계정을 선택하고 동의합니다.
3. `/login/callback?code=...`을 거쳐 홈으로 이동하는지 확인합니다.
4. 새로고침 후 로그인 유지, 모임 목록, 로그아웃, 재로그인을 확인합니다.
5. Supabase Authentication → Users에서 Google 로그인 사용자와 연결된 Google identity를 확인합니다.

Google 처음 로그인은 Supabase 신규 사용자 생성을 포함할 수 있습니다. 실제 사용자 계정으로 로그인·동의하는 최종 검증은 설정 완료 후 진행해야 합니다.

## 오류 해결

| 증상 | 확인 |
| --- | --- |
| `Unsupported provider` / `provider is not enabled` | Supabase Google Provider 활성화·저장 |
| `redirect_uri_mismatch` | Google redirect URI가 앱 주소가 아닌 Supabase callback인지, 문자열이 정확히 일치하는지 |
| Google에서 앱 접근 차단 | Audience / Testing / Test users / Client 설정 |
| 홈 대신 다른 주소로 돌아옴 | Supabase Redirect URLs의 전체 앱 callback URL |
| 로그인 요청 만료 | 같은 브라우저·호스트에서 다시 시작, 콜백 직접 열기 금지, 다른 탭 로그인 완료 여부 |
| 로그인 후 API 401 | 프론트·백엔드의 동일 Supabase 프로젝트 및 JWT 검증 설정 |

## 구현·검증

- POST `/api/auth/google`: 동일 origin 확인, `signInWithOAuth({provider:'google'})`, PKCE S256 URL 생성, verifier HttpOnly 쿠키.
- GET `/login/callback`: `exchangeCodeForSession(code)`, access/refresh HttpOnly 쿠키, verifier 삭제, 고정 홈 리다이렉트.
- verifier 유효기간 10분. Supabase auth code는 5분 유효·1회 사용.
- SDK와 verifier storage는 요청마다 생성하고 세션 객체는 브라우저 JSON 응답에 포함하지 않습니다.
- 실패·취소·만료 메시지를 로그인 화면에서 표시합니다.
- TypeScript 검사·production build 통과.
- `node scripts/oauth-smoke.mjs`: 모의 Auth 서버로 cross-origin 차단, S256 verifier 일치, 정확한 callback URL, 실패·취소·성공, 쿠키 설정·삭제 및 외부 redirect 차단 확인. 실제 Google 로그인의 완료를 대신하지 않습니다. 빌드 후 실행합니다.

공식 문서:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
