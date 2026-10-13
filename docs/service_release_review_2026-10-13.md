# 모아담 배포·사용자 이용 점검 보고서

작성일: 2026-10-13 (한국 시간)

후속 상태: 자료 자동 색인·실패 안내·용량/비용 제한·업로드/삭제 복구를 구현하고 실제 로컬 API와 Supabase/OpenAI로 검증했습니다. 운영 백엔드는 90초 요청에서도 시간 초과하며 Render 로그 확인이 필요합니다. 최신 상태는 [수정 기록](issue/2026-10-13_자료_처리_운영안정화.md)을 따릅니다.

모임·AI 한도 구현과 함께 인증 프록시, 자료 업로드·수정·색인·삭제, AI 통신, 배포 설정을 검토했습니다. 코드를 근거로 확인한 문제와 공개 운영 HTTP 요청의 관찰 결과를 구분합니다. Render 관리 설정·실제 RAG 운영 주소·운영 계정의 인증 흐름은 조회하지 못했으므로 모든 운영 기능의 정상 동작을 보장하는 보고서는 아닙니다.

## 이번 작업에서 해결한 내용

- 사용자 소속 모임을 합쳐 최대 3개로 제한하고 동시 생성·참여도 사용자 단위 잠금으로 보호했습니다.
- 초과 요청을 에러 모달로 안내하고, 실패한 참여가 초대 코드를 소비하지 않도록 했습니다.
- AI는 모임별 30회가 아닌 사용자별 하루 통합 30회임을 실제 교차 모임 요청으로 확인했습니다.
- 백엔드 41개 테스트, 프론트 검사·빌드, 모바일·데스크톱 한도 모달, 기존 성능 QA와 실제 API 동시 요청 검증을 통과했습니다. [작업 기록](issue/2026-10-13_모임_3개_통합제한.md)에 상세 결과가 있습니다.

## 추가로 확인한 위험

아래 내용은 초기 점검 당시의 발견 기록입니다. 자료 관련 항목의 후속 수정은 위 링크에 기록했습니다. P1은 운영 사용 전에 우선 해결할 항목, P2는 사용량 증가·특정 실패 조건에서 개선할 항목입니다.

### P1 — 운영 백엔드 응답 지연 또는 연결 실패

공개 `https://moadam.onrender.com/v3/api-docs` 조회가 각각 15초·20초 제한에서 시간 초과했습니다. 프론트 공개 홈은 HTTP 200으로 응답했습니다. 이 관찰만으로 백엔드 중단·무료 플랜·DB 오류 중 하나를 확정할 수는 없습니다.

권장 조치: Render의 서비스 이벤트·기동 로그·DB 연결 로그를 확인하고 인증 없는 가벼운 liveness와 의존성 readiness 경로, 가동 상태 감시를 마련합니다. RAG Blueprint는 `plan: free`이며, Render 무료 서비스는 유휴 후 정지·재기동 지연이 있을 수 있습니다. 실제 Spring 운영 플랜은 확인하지 못했습니다. [Render 공식 무료 서비스 안내](https://render.com/docs/free)를 참고해 응답 시간 목표에 맞는 플랜을 정해야 합니다.

관련 파일: [render.yaml](../render.yaml), [Spring 설정](../backend/src/main/resources/application.yml). 기존 [운영 AI 연결 이슈](issue/2026-10-13_배포환경_모아AI_응답실패.md)의 최종 RAG 복구도 별도 확인이 필요합니다.

### P1 — 메모 수정 후 AI 검색에서 자료가 빠짐

`NoteRepository.updateMemo()`가 버전을 올리고 상태를 `pending`으로 바꾸지만, 프론트 `saveEditor()`의 `documentEdit`는 PATCH만 수행합니다. `NoteRetriever`는 ready 자료만 검색하므로 사용자가 별도 재처리를 하지 않으면 수정된 메모가 AI 검색 대상에서 빠집니다. 재처리 UI는 있으나 자동 갱신은 없습니다.

권장 조치: 수정 후 색인을 예약하고 진행·실패 상태를 표시하거나, 저장 직후 명시적으로 재색인하도록 연결합니다. 사용자에게 저장 성공과 AI 반영 완료를 구분해 안내해야 합니다.

근거: [NoteRepository](../backend/src/main/java/com/moadam/note/repository/NoteRepository.java), [편집 저장 흐름](../frontend/src/features/content-editor/api/save-editor.ts), [자료 목록](../frontend/src/_pages/workspace/ui/documents-view.tsx).

### P1 — 색인 실패를 등록 성공으로 안내할 수 있음

RAG `/index`는 처리 오류를 `status: failed` 결과로 HTTP 200에 담아 반환할 수 있습니다. Spring은 해당 HTTP 응답만 확인한 뒤 자료 상태를 반환하며, 프론트 저장 흐름은 반환된 `status`를 검사하지 않습니다. 따라서 OCR이 필요한 PDF, 임베딩 오류 등에서 사용자가 “등록했습니다” 안내를 받지만 AI가 자료를 사용하지 못할 수 있습니다.

권장 조치: 파일 저장 결과와 색인 결과를 분리하고, `failed`이면 에러 사유와 재시도 동작을 표시합니다. 스캔 PDF의 OCR 미지원은 업로드 전에 또는 처리 결과에서 분명히 안내합니다.

근거: [RAG index](../rag/app.py), [RagClient.index](../backend/src/main/java/com/moadam/ai/client/RagClient.java), [편집 저장 흐름](../frontend/src/features/content-editor/api/save-editor.ts).

### P2 — 저장 공간·색인 비용의 누적 한도 없음

PDF 1개에 20MB 제한과 RAG 동시 처리 4개 제한은 있지만, 사용자·모임별 파일 총량, 일일 등록·재색인 횟수 제한은 없습니다. 질문 30회 제한은 문서 임베딩 요청에 적용되지 않습니다. 관리자 계정이 반복 업로드·재색인하면 저장 공간과 임베딩 비용이 늘어날 수 있습니다.

권장 조치: 모임별 저장 용량·자료 개수와 사용자별 색인 빈도 제한, 동일 버전 중복 색인 방지 및 비용 알림을 추가합니다. 운영 예산에 맞춰 수치를 정해야 합니다.

근거: [NoteUploadRequest](../backend/src/main/java/com/moadam/note/dto/NoteUploadRequest.java), [NoteService](../backend/src/main/java/com/moadam/note/service/NoteService.java), [RAG](../rag/app.py).

### P2 — DB와 Storage 삭제가 하나의 트랜잭션이 아님

자료·모임 삭제는 Storage 파일을 먼저 지운 뒤 DB를 삭제합니다. 파일 삭제 성공 후 DB 처리에 실패하면 DB 트랜잭션이 롤백되어도 파일은 복구되지 않습니다. 여러 PDF를 가진 모임 삭제 중 중간 실패가 나면 일부 파일만 삭제된 상태가 남을 수 있습니다.

권장 조치: 삭제 대기 상태와 outbox 작업을 사용해 DB와 외부 파일 삭제를 재시도 가능한 흐름으로 관리합니다. 파일이 이미 없는 경우에도 삭제 재시도가 성공하도록 합니다.

근거: [GroupService.deleteGroup](../backend/src/main/java/com/moadam/group/service/GroupService.java), [NoteService.deleteDocument](../backend/src/main/java/com/moadam/note/service/NoteService.java).

### P2 — 업로드 중단 시 미완료 자료와 파일 정리 필요

서명 업로드 URL 발급 때 DB 자료 행을 먼저 생성하고, 브라우저 업로드 후 complete를 호출합니다. 브라우저 종료·네트워크 실패 시 pending 자료가 남습니다. 업로드 성공 후 complete 실패 시 미완료 파일도 남을 수 있습니다. 현재 프론트는 사용자가 삭제하고 재시도하도록 안내하며 자동 정리 작업은 없습니다.

권장 조치: 만료된 미완료 업로드 정리 작업과 업로드 재개·완료 재시도를 추가합니다. 새 자료를 만들기 전에 기존 업로드를 재사용할 수 있도록 요청 식별자를 관리합니다.

근거: [NoteService.upload](../backend/src/main/java/com/moadam/note/service/NoteService.java), [PDF 저장 흐름](../frontend/src/features/content-editor/api/save-editor.ts).

### P2 — 긴 색인이 HTTP 요청 시간에 묶임

자료 색인은 동기 HTTP 요청이며 Spring의 RAG 요청은 90초, BFF의 상위 요청은 120초 제한입니다. 큰 PDF나 느린 임베딩 처리에서는 브라우저가 실패를 받아도 상위 작업이 진행되거나 사용자가 중복 재시도할 수 있습니다. 색인 작업을 별도 큐로 관리하는 구조는 없습니다.

권장 조치: 색인 접수는 빠르게 반환하고 별도 작업자가 처리하며, 화면에서는 작업 상태를 조회하도록 바꿉니다. 작업별 중복 실행 방지와 실패 재시도가 필요합니다.

근거: [RagClient](../backend/src/main/java/com/moadam/ai/client/RagClient.java), [BFF 프록시](../frontend/app/api/proxy/[...path]/route.ts), [RAG index](../rag/app.py).

## 적용 우선순위

1. 운영 백엔드·RAG 실제 가동과 버전·설정 확인, 이번 모임 한도 코드 배포.
2. 메모 수정 자동 색인과 색인 실패 UX 보완.
3. 자료 용량·색인 비용 한도 및 중복 작업 방지.
4. 삭제·미완료 업로드 정리와 비동기 색인 작업 도입.

이번 모임 제한에는 새 마이그레이션이 없습니다. AI 카운터 테이블은 로컬 서버가 연결하는 DB에 존재함을 확인했으나, Render 운영 설정을 직접 확인한 것은 아닙니다. 운영 반영 여부는 서비스별 배포·설정과 로그인 후 실제 흐름으로 확인해야 합니다.
