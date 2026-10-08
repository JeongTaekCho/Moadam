# 모아담 검색 노출 설정

## 적용한 구조

- 공개 홈 `/`과 서비스 소개 `/about`을 검색 대상으로 설정했습니다. 소개 페이지는 서버에서 제목·본문·기능 설명·FAQ를 HTML로 전달합니다.
- `/sitemap.xml`에는 위 두 공개 주소만 포함합니다. 날짜를 임의로 갱신하지 않습니다.
- `/robots.txt`는 공개 페이지 수집을 허용하고 API 및 로그인 콜백 수집을 제한합니다.
- 모임 자료·커뮤니티·채팅·마이페이지·설정 등 앱 화면은 `noindex, nofollow`입니다. 로그인 세션이 있는 홈과 쿼리 문자열이 있는 홈도 검색 제외합니다. 개인 화면은 robots.txt로 차단하지 않고 검색엔진이 HTML의 noindex를 읽도록 합니다. 실제 데이터 보호는 기존 인증·권한 검사로 처리합니다.
- Vercel Preview/Development 빌드는 전체 검색 제외합니다. 환경 구분은 빌드 시점의 VERCEL_ENV를 사용합니다.
- 제목·설명·운영 주소 canonical·한국어 Open Graph·공유 이미지·Twitter 카드·WebSite/Organization JSON-LD를 설정했습니다. 평점이나 사용자 수 등 확인되지 않은 정보는 넣지 않았습니다.
- 공유 이미지 `/opengraph-image`는 빌드 시 생성합니다. 한글 폰트 Nanum Gothic은 app/fonts의 OFL 라이선스를 함께 보관합니다.

## 배포 후 구글 등록

1. [Google Search Console](https://search.google.com/search-console)에 로그인합니다.
2. URL 접두어 속성으로 `https://moadam.vercel.app/`을 등록합니다. 공유 vercel.app 도메인의 DNS 소유권을 전제로 하지 마세요.
3. 소유권 확인 방법에서 HTML 태그를 선택합니다. `<meta name="google-site-verification" content="...">`의 **content 값만** 복사합니다.
4. Vercel 프로젝트 Settings → Environment Variables에 `GOOGLE_SITE_VERIFICATION` 이름으로 Production 환경에 저장하고 다시 배포합니다. 비밀 API 키가 아닌 공개 검증 코드입니다.
5. 운영 HTML에 태그가 나오는지 확인한 뒤 Search Console에서 확인을 누릅니다.
6. Sitemaps에 `https://moadam.vercel.app/sitemap.xml`을 제출합니다.
7. URL 검사에서 홈과 `/about`을 검사하고 필요하면 색인 생성을 요청합니다.

## 배포 후 네이버 등록

1. [네이버 서치어드바이저](https://searchadvisor.naver.com/) 웹마스터 도구에 `https://moadam.vercel.app`을 등록합니다.
2. HTML 태그 확인 방법에서 `<meta name="naver-site-verification" content="...">`의 **content 값만** 복사합니다.
3. Vercel Production 환경 변수 `NAVER_SITE_VERIFICATION`에 저장하고 다시 배포합니다.
4. 소유 확인 후 요청 → 사이트맵 제출에 `https://moadam.vercel.app/sitemap.xml`을 입력합니다.
5. URL 검사/웹페이지 수집 요청에서 홈과 소개 페이지를 확인합니다. 메뉴 명칭은 대시보드에 따라 달라질 수 있습니다.

## 운영 점검

- 홈·소개·robots.txt·sitemap.xml·공유 이미지가 로그인 없이 HTTP 200으로 열려야 합니다.
- 확인 코드를 변경하면 재배포해야 합니다. 현재 코드는 검증 코드가 비어 있으면 태그를 생성하지 않습니다.
- 운영 도메인을 변경할 때 `src/shared/config/site.ts`의 siteUrl과 공유 이미지의 표시 주소를 변경하고 검색 도구에도 새 속성을 등록하세요. 인증 복귀 주소와 메일 템플릿 주소도 별도로 변경해야 합니다.
- 공개 게시글 기능을 추가하기 전에는 모임 콘텐츠를 사이트맵에 넣지 마세요. 회원 전용 데이터는 검색 유입용 콘텐츠가 아닙니다.
- robots.txt와 sitemap은 수집 안내이며 검색 순위나 색인을 보장하지 않습니다. 서비스 소개를 실제 기능에 맞게 유지하고 공개 콘텐츠를 충실하게 제공하세요.
- 이번 작업은 로컬 코드 변경입니다. 운영 배포와 계정 소유권 확인·사이트맵 제출은 아직 수행하지 않았습니다.

참고: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [네이버 robots.txt 안내](https://searchadvisor.naver.com/guide/seo-basic-robots), [네이버 URL 검사](https://searchadvisor.naver.com/guide/url-inspection).
