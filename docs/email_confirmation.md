# 모아담 가입 확인 메일

## 적용 파일

- HTML: [confirmation.html](../supabase/templates/confirmation.html)
- 제목: `[모아담] 이메일 주소를 확인해 주세요`
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
   - `https://moadam.vercel.app/images/email-moa.png`
7. 새 이메일로 가입 → 확인 메일 → 확인 버튼 → 모아담 → 이메일·비밀번호 로그인.

운영용 버튼과 대체 링크는 Supabase의 `{{ .TokenHash }}`를 사용하는 `/auth/v1/verify?token=…&type=signup` 주소이며, `redirect_to`를 `https://moadam.vercel.app/`로 명시합니다. 이 HTML은 현재 운영 프로젝트 전용입니다. 프로젝트나 도메인을 바꾸면 링크도 수정하세요. Supabase의 Redirect URLs 목록에 해당 운영 주소가 반드시 있어야 합니다. 기존 발송 메일의 링크는 수정되지 않으므로 설정 후 새 확인 메일을 받아야 합니다.

가입 API는 `AUTH_SITE_URL`을 우선합니다. Vercel Production 환경변수에 `AUTH_SITE_URL=https://moadam.vercel.app`을 설정하고 재배포하세요. 미설정 시 Vercel Production에서는 같은 운영 주소를 기본 사용합니다. 로컬 개발은 환경변수가 없으면 요청 주소를 사용하지만 이 운영 템플릿은 운영 주소로 복귀합니다. Google `/login/callback` 흐름은 유지합니다. 이메일 확인 후 이메일·비밀번호로 로그인합니다.

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

## 스팸 분류와 이미지 차단

- 메일은 확인 안내 중심으로 줄이고 홍보 문구·기능 소개·추가 로고 링크를 제거했습니다. 캐릭터 이미지는 256px, 약 8KB의 PNG 하나입니다.
- 기존 로고·캐릭터 이미지 URL은 외부 HTTP 검사에서 200/image/png 응답이었습니다. 실제 메일의 HTML 소스 및 이미지 차단 설정 없이는 깨짐 원인을 단정할 수 없습니다.
- 새 `email-moa.png`를 포함한 프론트 배포 후 주소가 200인지 확인하고, Supabase 템플릿을 다시 저장하세요.
- 스팸 폴더의 외부 이미지 차단은 HTML에서 강제로 해제할 수 없습니다. 이미지가 차단돼도 텍스트 서비스명과 확인 버튼을 사용할 수 있도록 구성했습니다.
- Resend Domains에서 발신 도메인의 SPF/DKIM 인증을 확인하고, 도메인 정책에 맞춰 DMARC를 설정합니다. Gmail 메일 원본의 Authentication-Results에서 SPF/DKIM/DMARC 결과를 확인하면 실제 실패를 구분할 수 있습니다. 클릭·오픈 추적은 인증 메일에서 비활성화하는 편이 좋습니다.
- 받은 메일의 스팸 해제는 해당 사용자에게 도움이 될 수 있으나, 전체 수신자의 받은편지함 배달을 보장하지 않습니다. 실제 발신 도메인·메일 원본은 아직 제공되지 않아 DNS 인증 상태는 검증하지 않았습니다.
