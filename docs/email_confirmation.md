# 모아담 가입 확인 메일

## 적용 파일

- HTML: [confirmation.html](../supabase/templates/confirmation.html)
- 제목: `[모아담] 이메일을 확인하고 우리 모임을 시작하세요`
- 로컬 Supabase: `config.toml`의 이메일 확인과 confirmation template 설정에 연결.

## 운영 Supabase에 적용

로컬 파일을 수정하거나 프론트를 배포하는 것만으로 호스팅된 Supabase 메일 템플릿은 변경되지 않습니다.

1. Supabase 프로젝트 → Authentication → Email Templates (Emails 메뉴로 표시될 수 있음) → **Confirm sign up**.
2. Subject에 위 제목을 입력.
3. Body에 `supabase/templates/confirmation.html`의 HTML 전체를 붙여 넣고 저장.
4. Authentication의 Email provider 설정에서 **Confirm email**을 켬.
5. Authentication → URL Configuration:
   - Site URL: `https://moadam.vercel.app`
   - Redirect URLs: `https://moadam.vercel.app/`, `https://moadam.vercel.app/login/callback`.
   - 로컬 확인을 원하면 `http://localhost:3000/`도 추가.
6. 프론트를 Vercel에 배포하고 이미지 URL 확인:
   - `https://moadam.vercel.app/images/logo.png`
   - `https://moadam.vercel.app/images/moa-ai-icon.png`
7. 새 이메일로 가입 → 확인 메일 → 확인 버튼 → 모아담 → 이메일·비밀번호 로그인.

버튼과 대체 링크는 Supabase의 `{{ .ConfirmationURL }}`을 사용합니다. 이메일 가입 요청은 접속한 프론트 주소를 `redirect_to`로 지정하고 Supabase의 허용 목록과 대조합니다. `/login/callback`은 Google PKCE용이므로 이메일 확인 링크를 그 경로로 고정하지 않습니다. 현재 이메일 가입 흐름은 확인 후 비밀번호로 로그인합니다.

이미지는 HTTPS PNG입니다. 메일 클라이언트가 이미지를 차단해도 설명과 확인 버튼은 유지됩니다. HTML은 인라인 스타일과 table 레이아웃을 사용하고 SVG·스크립트·애니메이션을 포함하지 않습니다.

## 실제 발송 설정

Supabase 기본 발송 서비스는 운영용이 아니며, 공식 문서는 프로젝트 팀에 등록된 이메일 주소로 제한된 발송량을 안내합니다. 일반 사용자의 가입 확인 메일을 위해 Authentication → SMTP Settings에서 커스텀 SMTP를 연결하세요.

메일 제공자의 SMTP host/port/username/password와 검증한 발신 주소를 설정하고 발신 이름을 **모아담**으로 지정합니다. 소유한 발신 도메인의 SPF·DKIM은 메일 제공자 안내를 따릅니다. `vercel.app`은 웹·이미지 주소이며 발신 도메인으로 설정하는 값이 아닙니다.

운영 템플릿/SMTP 변경 및 실제 수신 테스트는 수행하지 않았습니다. 현재 연결 도구에는 Auth 설정 변경 기능이 없고, SMTP 자격증명도 제공되지 않았습니다.

## 닉네임

새 이메일 회원의 기본 닉네임은 `모아 {사용자 UUID 앞 8자리}`입니다. Google 계정의 제공 이름과 직접 수정한 이름은 유지합니다. 기존 `멤버 {동일 UUID 앞 8자리}` 자동 닉네임만 변경합니다. 운영 DB의 해당 자동 닉네임 1개를 변경하고 확인했습니다. migration SQL은 반복 실행해도 이미 변경된 닉네임은 수정하지 않습니다.

## 공식 참고

- [이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates)
- [커스텀 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [리디렉션 허용 목록](https://supabase.com/docs/guides/auth/redirect-urls)

## 검증

- 로그인 화면과 메일 HTML을 1440px / 390px 브라우저에서 확인: 가로 넘침 없음, PNG 이미지·확인 버튼 표시. 실제 메일 클라이언트 수신 테스트는 별도입니다.
- 프론트 TypeScript 검사와 production build, 백엔드 테스트 통과.
- 격리된 가상 인증 서버에서 이메일 가입의 프론트 복귀 URL, 확인 대기 응답, 확인 전 세션 쿠키 미발급을 검증. 기존 Google PKCE 로그인 검사도 통과.
