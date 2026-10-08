# 모아AI 스트리밍

질문과 답변 자리를 먼저 표시하고, 답변이 생성되는 대로 글자가 빠르게 이어집니다. `답변 중지`로 전송을 취소할 수 있습니다. 완료 후 Markdown과 검증된 자료 출처를 표시합니다.

## 경로와 최적화

브라우저 → Next `/api/proxy/groups/{group}/chat/sessions/{session}/messages/stream` → Spring → RAG `/query/stream` → 기존 OpenAI 모델의 `stream=true` 호출.

OpenAI의 SSE 조각에서 JSON의 `answer` 문자열만 점진적으로 읽어 내부 `application/x-ndjson`의 `status`, `delta`, `done`, `error` 이벤트로 전달합니다. Spring은 이벤트마다 flush하고 Next는 응답 body를 직접 전달합니다. 모델의 JSON 구문과 내부 검색 메타데이터는 답변 본문에 표시하지 않으며, 서비스 키는 브라우저에 보내지 않습니다.

화면은 약 4ms/문자 속도로 표시하되 `requestAnimationFrame`으로 프레임당 한 번만 갱신합니다. 큰 청크가 쌓이면 표시 속도를 높여 지연을 줄입니다. UTF-8 분할과 JSON 이스케이프·이모지를 복원하고 이전 메시지는 memo로 재렌더링을 줄입니다. 작성 중에는 가벼운 텍스트로 표시하고 완료 후 Markdown을 처리합니다. 위쪽 기록을 읽는 동안은 스크롤 위치를 유지합니다.

모임 변경·뒤로 이동·컴포넌트 해제·답변 중지는 요청을 취소합니다. 실패한 초안은 화면에서 제거하고 질문 입력은 유지합니다. 생성이 완료되고 권한·자료 출처를 재확인한 뒤 질문과 답변을 하나의 트랜잭션으로 저장합니다. 기존 JSON 응답 API도 유지합니다.

RAG는 동시 요청을 4개로 제한하고, Spring은 제한된 스트리밍 실행 풀을 사용합니다. 모델 연결/읽기 제한과 전체 요청 제한을 둡니다. 별도 의존성이나 Supabase migration은 필요하지 않습니다. 현재 `rag/.env`의 provider·키·모델을 사용합니다.

## 운영과 검증

리버스 프록시가 별도로 있다면 채팅 경로의 응답 버퍼링·압축이 작은 청크를 모으지 않도록 설정하세요. 애플리케이션은 `Cache-Control: no-store`, `X-Accel-Buffering: no`를 보냅니다.

```sh
pnpm typecheck
pnpm build
pnpm test:chat-stream
pnpm test:chat-live
```

`test:chat-stream`은 실제 파서의 한글/이모지 바이트 분할, 연결 끊김·에러·취소를 검사하고, 임시 production Next 서버에서 완료 전 전달 및 상위 서버 연결 취소를 검증합니다.

`test:chat-live`는 실행 중인 서비스와 루트 `.env`를 사용합니다. 임시 계정·모임·메모를 생성해 자료 없음 응답, 실제 구성된 모델 답변, 출처, 대화 저장, 타인 대화 접근 거부를 확인한 후 테스트 데이터를 삭제합니다. 설정된 provider가 OpenAI라면 테스트 메모의 임베딩과 답변 1회를 호출합니다.

RAG 테스트는 스트리밍 모델의 조각이 완료 전에 도착하는지, JSON 이스케이프가 복원되는지, 중단된 모델 응답이 완료로 처리되지 않는지도 확인합니다. Spring 테스트는 스트리밍 Content-Type 및 중단 시 저장하지 않는 동작을 검사합니다.

참고: [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse), [Spring MVC 반환 타입](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/return-types.html).
