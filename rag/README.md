# Internal RAG

Python 3.12 환경에서 `pip install -r requirements.lock`. `.env.example`을 `.env`로 복사해 DB·Supabase 서버 키·32자 이상 내부 토큰을 설정하고 `uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log`.

`/health`, `/ready`, `/index`, `/query`는 내부 Bearer 인증이 필요합니다. 입력은 Spring이 검증한 UUID·문서 버전·허용 문서 범위이며 Python은 DB 멤버십·개인 세션을 다시 확인합니다. 문서 내용과 Storage 경로는 DB에서 읽어 클라이언트가 임의 URL/본문을 주입하지 못하게 합니다.

PDF 페이지 단위 1000자 청크/150자 overlap, 1536차원 pgvector, 모임·허용 문서 SQL 필터 후 top-k 검색. 반환은 answer/citations/grounded/confidence/provider/retrieval/request_id, 인용에는 실제 document_id/title/page/chunk_id만 포함합니다. 동시 처리 4개, 본문 1MB, PDF 20MB·200쪽·전체 100만자, 최대1000청크. OCR 미지원.

기본 degraded는 명시적 인덱싱 실패 및 근거 없음 답변. 개발 mock은 결정적 토큰 임베딩/발췌 답변이며 production에서 금지됩니다. OpenAI는 환경변수로 provider/model/key를 설정하고 기존 자료를 재색인합니다. 같은 문서/version 인덱싱은 transaction에서 교체하고 실패 시 기존 동일 version 청크를 보존합니다.

`python -m unittest discover -s tests -v` 실행. 상세 환경변수·계약·검증 범위는 루트 README, docs/architecture.md, docs/verification.md 참고.

## 실제 답변 및 검색 정책

OpenAI 모드에서는 권한이 허용된 ready/current-version 청크만 SQL에서 필터하고 가까운 최대 TOP_K개 후보를 모델에 전달합니다. 고정 유사도 0.3만으로 한국어 표현이 다른 질문을 탈락시키지 않습니다. SIMILARITY_THRESHOLD는 mock 모드의 발췌 검색에 적용됩니다. 실제 모델은 발췌의 관련성과 근거를 판단해 부분 답변·요약·쉬운 설명을 제공하고, 관련 근거가 없으면 유보합니다. 모든 인용은 검색된 실제 청크로 검증됩니다. confidence는 선택된 청크의 코사인 유사도이며 확률이 아닙니다.

mock에서 openai로 전환하면 기존 문서를 반드시 재색인하세요. 키가 입력되어 있어도 RAG_PROVIDER=mock이면 실제 모델은 호출되지 않습니다. 로컬 설정은 rag/.env, Compose 설정은 루트 .env입니다. 다른 모임의 비밀·서버 키 조회 요청은 검색 전에 거부하며, 이 입력 검사와 별개로 모든 쿼리의 모임·멤버십·문서 범위 검사를 유지합니다.
