# Supabase 설정·마이그레이션 지침

루트 지침과 개발 규칙을 따른다. 실제 프로젝트 설정을 바꾸는 작업과 설정 예시/SQL 파일 작성 작업을 구분한다.

- 이미 적용한 migration은 수정하지 않는다. 새로운 스키마 변경은 설치된 Supabase CLI의 `migration new`로 생성한다.
- 초기 migration과 backend Flyway 복사본의 일치를 유지한다. `python scripts/check-migrations.py`와 프론트 `pnpm test:db`로 격리 검증한다.
- 모임 범위 FK/RLS/권한과 비공개 Storage 버킷을 유지한다. service_role은 서버 전용이다.
- 템플릿의 변수는 Supabase 템플릿 문법을 유지한다. 신규 가입 이메일 확인·운영 복귀 주소·SMTP 안내는 `../docs/email_confirmation.md`를 함께 확인한다.
- 도구 명령과 Auth API는 현재 CLI 도움말/공식 문서를 확인한다. 실제 migration 적용·환경 변경은 사용자가 요청한 범위에서만 수행하고 적용 여부를 정확히 보고한다.
