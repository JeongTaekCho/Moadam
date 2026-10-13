# Internal RAG

Python 3.12 환경에서 `pip install -r requirements.lock`. `.env.example`을 `.env`로 복사해 DB·Supabase 서버 키·32자 이상 내부 토큰을 설정하고 `uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log`.

`/health`, `/ready`, `/index`, `/query`는 내부 Bearer 인증이 필요합니다. 입력은 Spring이 검증한 UUID·문서 버전·허용 문서 범위이며 Python은 DB 멤버십·개인 세션을 다시 확인합니다. 문서 내용과 Storage 경로는 DB에서 읽어 클라이언트가 임의 URL/본문을 주입하지 못하게 합니다.

PDF 페이지 단위 1000자 청크/150자 overlap, 1536차원 pgvector, 모임·허용 문서 SQL 필터 후 top-k 검색. 반환은 answer/citations/grounded/confidence/provider/retrieval/request_id, 인용에는 실제 document_id/title/page/chunk_id만 포함합니다. 동시 처리 4개, 본문 1MB, PDF 20MB·200쪽·전체 100만자, 최대1000청크. OCR 미지원.

기본 degraded는 명시적 인덱싱 실패 및 근거 없음 답변. 개발 mock은 결정적 토큰 임베딩/발췌 답변이며 production에서 금지됩니다. OpenAI는 환경변수로 provider/model/key를 설정하고 기존 자료를 재색인합니다. 같은 문서/version 인덱싱은 transaction에서 교체하고 실패 시 기존 동일 version 청크를 보존합니다.

`python -m unittest discover -s tests -v` 실행. 상세 환경변수·계약·검증 범위는 루트 README, docs/architecture.md, docs/verification.md 참고.

## 실제 답변 및 검색 정책

OpenAI 모드에서는 권한이 허용된 ready/current-version 청크만 SQL에서 필터하고 가까운 최대 TOP_K개 후보를 모델에 전달합니다. 고정 유사도 0.3만으로 한국어 표현이 다른 질문을 탈락시키지 않습니다. SIMILARITY_THRESHOLD는 mock 모드의 발췌 검색에 적용됩니다. 실제 모델은 발췌의 관련성과 근거를 판단해 부분 답변·요약·쉬운 설명을 제공하고, 관련 근거가 없으면 유보합니다. 모든 인용은 검색된 실제 청크로 검증됩니다. confidence는 선택된 청크의 코사인 유사도이며 확률이 아닙니다.

mock에서 openai로 전환하면 기존 문서를 반드시 재색인하세요. 키가 입력되어 있어도 RAG_PROVIDER=mock이면 실제 모델은 호출되지 않습니다. 로컬 설정은 rag/.env, Compose 설정은 루트 .env입니다. 다른 모임의 비밀·서버 키 조회 요청은 검색 전에 거부하며, 이 입력 검사와 별개로 모든 쿼리의 모임·멤버십·문서 범위 검사를 유지합니다.

## 대화 맥락과 가독성

동일 모임·개인 세션의 소유권을 확인한 뒤 DB에서 `sequence DESC` 기준 최근 12개 메시지를 조회합니다. 기존 `messages_session(group_id,session_id,sequence)` 인덱스를 사용할 수 있으며 메시지당 1,200자, 총 6,000자로 제한하고 오래된 순으로 모델에 전달합니다. 근거 없는 이전 assistant 답변은 제외합니다. 대화는 요청 내부에만 보관하며 클라이언트가 대화 내역을 주입하거나 다른 세션의 맥락을 공유하지 않습니다. 이전에 완료·저장된 메시지만 대상입니다.

첫 질문과 명확한 새 주제는 기존처럼 한 번 임베딩합니다. 한국어·영어의 지시어, 재설명 요청, 짧은 후속 질문(예: “그건 언제야?”, “장소는?”, “더 쉽게 설명해줘”)이 감지되면 OpenAI 모드에서 검색 질문 보완을 한 번만 수행합니다. 출력은 200토큰·1,000자로 제한하고 HTTP timeout은 8초, 연결 timeout은 3초입니다. 실패·잘린 JSON·잘못된 형식은 재시도 없이 최근 주제를 붙이는 제한된 검색으로 전환합니다. 일반 질문에서는 보완 호출 비용이 없지만 후속 질문은 추가 모델 호출의 비용과 대기 시간이 발생할 수 있습니다. mock은 모델 호출 없이 제한된 주제를 붙입니다.

대화 조회 후 DB 연결을 닫고 보완·임베딩 호출을 수행합니다. 검색 전과 답변 완료 시 멤버십·개인 세션을 다시 확인합니다. 스트리밍 경로의 동기 준비 작업은 기존 threadpool에서 실행합니다. 외부 요청/응답 계약과 문서 권한·현재 버전·인용 검증은 유지합니다.

대화는 질문 대상과 설명 수준을 파악하는 참고 자료이며 사실 근거는 현재 검색한 문서입니다. 현재 질문이 주제를 바꾸면 현재 요청을 우선하고 과거 답변의 인용 ID를 재사용하지 않습니다. 생성 지침은 핵심 답을 먼저 제시하고, 보통 2~3문장씩 문단을 나누며, 문단·목록 앞뒤에 빈 줄과 항목별 줄바꿈을 넣도록 합니다. 화면은 작성 중에도 마크다운 문단·목록·코드블록을 표시합니다.
