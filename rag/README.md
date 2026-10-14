# Internal RAG

Python 3.12 환경에서 `pip install -r requirements.lock`. `.env.example`을 `.env`로 복사해 DB·Supabase 서버 키·32자 이상 내부 토큰을 설정하고 `uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log`.

`/health`, `/ready`, `/index`, `/query`는 내부 Bearer 인증이 필요합니다. 입력은 Spring이 검증한 UUID·문서 버전·허용 문서 범위이며 Python은 DB 멤버십·개인 세션을 다시 확인합니다. 문서 내용과 Storage 경로는 DB에서 읽어 클라이언트가 임의 URL/본문을 주입하지 못하게 합니다.

PDF 페이지 단위 1000자 청크/150자 overlap, 1536차원 pgvector, 모임·허용 문서 SQL 필터 후 top-k 검색. 반환은 answer/citations/grounded/confidence/provider/retrieval/request_id입니다. 인용은 document_id/title/page/chunk_id와 source_type/source_id를 포함합니다. 일정·공지 인용의 document_id는 null이며 source_id로 원문을 식별합니다. 동시 처리 4개, 본문 1MB, PDF 20MB·200쪽·전체 100만자, 최대1000청크. OCR 미지원.

모아AI는 문서 검색에 더해 현재 모임의 등록 일정과 커뮤니티 공지를 DB에서 직접 조회합니다. 권한·개인 세션 확인 후 같은 모임의 일정 최대 8개와 공지 최대 6개(본문 총 9,000자 이내)를 모델 근거로 제공합니다. 일반 게시글·댓글은 포함하지 않습니다. 모델 응답 후 원문의 존재·수정 시각과 공지 종류를 재검사하며, 변경·삭제된 원문으로 답변하지 않습니다. 별도 색인·SQL migration은 필요 없습니다.

기본 degraded는 명시적 인덱싱 실패 및 근거 없음 답변. 개발 mock은 결정적 토큰 임베딩/발췌 답변이며 production에서 금지됩니다. OpenAI는 환경변수로 provider/model/key를 설정하고 기존 자료를 재색인합니다. 같은 문서/version 인덱싱은 transaction에서 교체하고 실패 시 기존 동일 version 청크를 보존합니다.

`python -m unittest discover -s tests -v` 실행. 상세 환경변수·계약·검증 범위는 루트 README, docs/architecture.md, docs/verification.md 참고.

## 실제 답변 및 검색 정책

OpenAI 모드에서는 권한이 허용된 ready/current-version 청크만 SQL에서 필터하고 가까운 최대 TOP_K개 후보를 모델에 전달합니다. 고정 유사도 0.3만으로 한국어 표현이 다른 질문을 탈락시키지 않습니다. SIMILARITY_THRESHOLD는 mock 모드의 발췌 검색에 적용됩니다. 실제 모델은 발췌의 관련성과 근거를 판단해 부분 답변·요약·쉬운 설명을 제공하고, 관련 근거가 없으면 유보합니다. 모든 인용은 검색된 실제 청크로 검증됩니다. confidence는 선택된 청크의 코사인 유사도이며 확률이 아닙니다.

mock에서 openai로 전환하면 기존 문서를 반드시 재색인하세요. 키가 입력되어 있어도 RAG_PROVIDER=mock이면 실제 모델은 호출되지 않습니다. 로컬 설정은 rag/.env, Compose 설정은 루트 .env입니다. 다른 모임의 비밀·서버 키 조회 요청은 검색 전에 거부하며, 이 입력 검사와 별개로 모든 쿼리의 모임·멤버십·문서 범위 검사를 유지합니다.

## 대화 맥락과 가독성

동일 모임·개인 세션의 소유권을 확인한 뒤 DB에서 `sequence DESC` 기준 최근 12개 메시지를 조회합니다. 기존 `messages_session(group_id,session_id,sequence)` 인덱스를 사용할 수 있으며 메시지당 1,200자, 총 6,000자로 제한하고 오래된 순으로 모델에 전달합니다. 일반 지식 답변도 후속 질문의 맥락으로 보관하고, 자료 없음·설정 비활성 등 고정 안내만 제외합니다. 이전 답변은 사실 근거로 신뢰하지 않습니다. 대화는 요청 내부에만 보관하며 클라이언트가 대화 내역을 주입하거나 다른 세션의 맥락을 공유하지 않습니다. 이전에 완료·저장된 메시지만 대상입니다.

검색 가능한 모임 자료가 있는 첫 질문과 명확한 새 주제는 한 번 임베딩합니다. 자료가 없는 일반 질문은 검색 임베딩과 검색 질문 보완 없이 답변을 생성합니다. 한국어·영어의 지시어, 재설명 요청, 짧은 후속 질문(예: “그건 언제야?”, “장소는?”, “더 쉽게 설명해줘”)이 감지되면 OpenAI 모드에서 검색 질문 보완을 한 번만 수행합니다. 출력은 200토큰·1,000자로 제한하고 HTTP timeout은 8초, 연결 timeout은 3초입니다. 실패·잘린 JSON·잘못된 형식은 재시도 없이 최근 주제를 붙이는 제한된 검색으로 전환합니다. 일반 질문에서는 보완 호출 비용이 없지만 후속 질문은 추가 모델 호출의 비용과 대기 시간이 발생할 수 있습니다. mock은 모델 호출 없이 제한된 주제를 붙입니다.

대화 조회 후 DB 연결을 닫고 보완·임베딩 호출을 수행합니다. 검색 전과 답변 완료 시 멤버십·개인 세션을 다시 확인합니다. 스트리밍 경로의 동기 준비 작업은 기존 threadpool에서 실행합니다. 외부 요청/응답 계약과 문서 권한·현재 버전·인용 검증은 유지합니다.

대화는 질문 대상과 설명 수준을 파악하는 참고 자료이며 사실 근거는 현재 검색한 문서입니다. 현재 질문이 주제를 바꾸면 현재 요청을 우선하고 과거 답변의 인용 ID를 재사용하지 않습니다. 생성 지침은 핵심 답을 먼저 제시하고, 보통 1~2문장씩 문단을 나누며, 문단·목록 앞뒤에 빈 줄과 항목별 줄바꿈을 넣도록 합니다. 화면은 작성 중에도 마크다운 문단·목록·코드블록을 표시합니다.

## 토큰 예산과 일반 답변

Spring은 사용자별 한국 날짜 기준 `AI_DAILY_TOKEN_BUDGET=120000`을 100%로 표시하고, 질문마다 최대 `AI_REQUEST_TOKEN_BUDGET=20000`을 잔액 안에서 예약합니다. 내부 QueryRequest의 `request_id`는 예약 ID이며 `token_budget`을 함께 전달합니다. production에서는 예약 없는 생성 요청을 거부합니다. 새 V5/Flyway와 대응 Supabase migration이 필요합니다.

RAG의 `token_usage.py`는 임베딩·검색 질문 보완·답변 생성의 실제 `usage.total_tokens`를 합산하고 `ai_charge_tokens`로 요청별 누적 사용량을 저장합니다. 스트리밍은 `stream_options.include_usage=true`를 사용합니다. 모델 입력/출력·대화 내역·문서 발췌·JSON 출력 토큰까지 포함하며 캐시 입력도 토큰 수 기준으로 포함합니다. 연결 전 실패와 명확한 HTTP 거부는 토큰을 차감하지 않습니다. 중단/읽기 시간 초과로 최종 usage가 없으면 tiktoken으로 입력·받은 출력의 토큰을 추정하고 원장에 estimated=true로 남깁니다. 강제 프로세스 종료나 provider가 전송하지 않은 출력의 정확한 사용량까지 복원하는 기능은 없습니다.

생성 전에 남은 요청 예산으로 입력과 출력 상한을 검사합니다. 각 요청의 안전 여유는 64토큰이며 최소 출력 여유가 부족하면 추가 모델 호출 없이 짧은 안내를 반환합니다. API의 실제 사용량은 추정치보다 우선합니다. 모델 교체 시 tokenizer와 입력 프로토콜 추정의 여유가 충분한지 검증해야 합니다. 완료·오류·취소 후 사용하지 않은 예약을 해제하고, 프로세스 중단으로 남은 예약은 다음 예약 시 현재 날짜의 5분 만료로 회수합니다. 자정을 넘긴 정산은 요청을 시작한 날짜에 기록합니다.

모델 출력의 `answer_kind`는 general/documents/clarification/unavailable입니다. general은 grounded=false·빈 인용으로 저장하며 모임 내부 사실은 문서 근거가 필요합니다. `answer_format.py`는 한 줄에 붙은 일반 설명의 문장 사이를 문단으로 나눕니다. fenced 코드·인라인 코드·강조·기존 목록은 보호합니다. 최종 서식 정리로 작성 중 텍스트와 차이가 생기면 프론트의 기존 done 처리로 최종 답변을 반영합니다.

실제 모델 서식 검사는 명시적으로 `cd rag && .venv/bin/python markdown-live-smoke.py`를 실행합니다. 유료 provider를 사용하지만 DB는 메모리 fixture로 대체해 운영 DB를 읽거나 쓰지 않습니다. 결과는 `/tmp/moadam-markdown-live-report.json`이며 `MOADAM_MARKDOWN_REPORT=/tmp/moadam-markdown-live-report.json pnpm test:ai-errors`로 프론트에서 실제 생성된 답변의 화면 서식을 재생 검증할 수 있습니다. 기본 CI 검사는 모델을 호출하지 않습니다.

RAG는 예약을 한 번만 시작하도록 claim하고 일반/스트리밍 finally에서 정산 후 종료합니다. 백엔드의 실패 취소는 아직 시작하지 않은 예약만 해제합니다. 시간 초과 후 RAG 작업이 진행 중인 경우 예약을 유지해 새 요청이 같은 예산을 재사용하지 않습니다. 강조가 없는 모델 답변은 코드와 기존 서식을 보호하면서 짧은 목록 레이블·정의의 주제·정보 부족 구절을 보완합니다.
