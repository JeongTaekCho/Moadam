# 배포 환경의 모아AI 연결 복구

## 2026-10-13 확인 결과

운영 프론트는 `https://moadam.vercel.app`, Spring API는 `https://moadam.onrender.com`입니다. Vercel 운영 배포 `af9b70a`가 READY 상태이며 Spring도 스트리밍 API를 제공합니다.

실제 운영 인증을 사용하는 임시 진단 계정·모임·대화로 동일 요청을 Vercel 경유와 Spring 직접 호출에 각각 실행했습니다. 진단 질문은 빈 모임 자료 확인이며 기존 회원 데이터나 문서를 사용하지 않았습니다.

| 경로            | HTTP         | 첫 이벤트  | 최종 이벤트                        | 총 시간    |
| --------------- | ------------ | ---------- | ---------------------------------- | ---------- |
| Vercel → Spring | 200 / NDJSON | retrieving | error / 답변을 완료하지 못했습니다 | 약 1,033ms |
| Spring 직접     | 200 / NDJSON | retrieving | 같은 error                         | 약 492ms   |

두 경로 모두 텍스트 delta 및 완료 done이 없습니다. Vercel 프록시는 상태·오류 이벤트를 정상 전달합니다. **Spring의 조회/RAG 호출 이후 단계에서 실패합니다.** 배포된 Spring의 내부 RAG 주소·토큰 또는 RAG 로그에는 현재 접근할 수 없으므로 연결 주소 누락·인증 불일치·잘못된 경로 중 어느 것인지는 아직 확정하지 않았습니다. Vercel runtime logs에서 이 요청의 별도 함수 예외도 발견되지 않았습니다.

진단 종료 후 임시 모임과 계정을 삭제했습니다. 답변이 완료되지 않았으므로 진단 질문·답변은 저장되지 않았으며, 자료가 없는 요청은 정상 RAG에서도 외부 모델을 호출하지 않습니다.

## 필요한 배포 구성

브라우저 → Next.js/Vercel → Spring/Render → Python FastAPI RAG → Supabase/OpenAI 흐름입니다. Python은 별도 실행 서비스이므로 Spring Dockerfile만 배포하면 Python이 함께 실행되지 않습니다. 기존 Docker Compose에서는 RAG_URL을 `http://rag:8000`으로 연결하지만 Render의 별도 서비스에서는 배포된 Python 서비스의 주소를 사용합니다.

### RAG 서비스가 이미 있는 경우

1. Python 서비스의 실제 Render 주소와 배포 상태를 확인합니다.
2. Spring 서비스 Environment의 `RAG_URL`에 Python 서비스의 base URL을 입력합니다.
3. Spring/Python의 `RAG_INTERNAL_TOKEN`을 동일하게 설정합니다. 토큰 값은 채팅이나 로그에 공개하지 않습니다.
4. Python의 `/healthz`는 인증 없이 `{"status":"ok"}`만 반환합니다. `/health`, `/ready`, `/query/stream`, `/index`는 내부 Bearer 인증을 계속 요구합니다.
5. 아래 진단 명령으로 내부 인증 및 DB 준비 상태를 확인한 뒤 최신 Spring/프론트를 배포합니다.

### RAG 서비스가 아직 없는 경우

[render.yaml](../render.yaml)은 Python RAG 서비스 하나를 배포하는 Blueprint입니다. Render의 New → Blueprint에서 저장소를 연결해 파일을 사용하거나 New → Web Service에서 동일 설정을 직접 입력합니다.

| 설정                 | 값                                                     |
| -------------------- | ------------------------------------------------------ |
| Name                 | moadam-rag (기존 RAG 서비스가 있으면 그 서비스를 사용) |
| Root Directory       | rag                                                    |
| Runtime              | Docker                                                 |
| Dockerfile Path      | ./Dockerfile                                           |
| Docker Build Context | .                                                      |
| Health Check Path    | /healthz                                               |

환경변수는 아래와 같습니다. Render 입력란에는 값 자체를 입력하며 값을 따옴표로 둘러싸지 않습니다.

| 환경변수                  | 입력 값                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| APP_ENV                   | production                                                                                        |
| RAG_PROVIDER              | openai                                                                                            |
| DATABASE_URL              | 로컬 루트 .env의 RAG_DATABASE_URL과 같은 PostgreSQL 연결 문자열. Python용 `postgresql://...` 형식 |
| SUPABASE_URL              | 기존 Spring과 같은 Supabase 프로젝트 주소                                                         |
| SUPABASE_SERVICE_ROLE_KEY | 기존 서버용 service role 키                                                                       |
| RAG_INTERNAL_TOKEN        | 기존 Spring에 설정한 동일한 내부 토큰 (32자 이상)                                                 |
| OPENAI_API_KEY            | 유효한 OpenAI API 키                                                                              |

배포 완료 후 Render에 실제로 표시된 RAG 서비스 URL을 Spring의 `RAG_URL`로 설정하고 Spring을 재배포합니다. Blueprint는 기존 Spring/Vercel을 배포하거나 환경변수를 자동 변경하지 않습니다. 무료 Web Service로 선언했으며 비용·휴면 정책은 Render의 현재 요금제에서 확인합니다.

공식 안내: [FastAPI 배포](https://render.com/docs/deploy-fastapi), [Blueprint 설정](https://render.com/docs/blueprint-spec), [Health checks](https://render.com/docs/health-checks).

## 읽기 전용 진단 명령

프로젝트 루트에서 실행합니다. 기존 .env에는 내부 토큰이 있어야 합니다. 실제 신뢰하는 Python 서비스 URL만 지정합니다.

```bash
RAG_URL=https://YOUR_RAG_SERVICE.onrender.com node --env-file=.env scripts/check-ai-deployment.mjs
```

스크립트는 `/health`와 `/ready`를 조회하며 질문 생성·모델 과금·DB 쓰기는 수행하지 않습니다. `AI_AUTH_FAILED`이면 내부 토큰, `AI_ENDPOINT_MISSING`이면 서비스 URL/경로, `AI_CONNECTION_FAILED`이면 서비스 실행/연결, `AI_PROVIDER_DISABLED`이면 provider 설정을 확인합니다. localhost는 배포 진단에서 기본 거절하며 로컬 확인에만 `AI_CHECK_ALLOW_LOCAL=1`을 추가합니다. readiness 성공은 실제 모델 키의 유효성까지 보장하지 않으므로 마지막으로 앱에서 질문/응답을 확인해야 합니다.

## 코드 보완

- RagClient: base URL의 끝 슬래시·공백 정리, 연결/시간 초과/401·403/404/429/상위 서비스 오류 분류.
- AiService: 안전한 오류 code/message를 NDJSON으로 반환하고 코드/예외 종류만 로그에 기록. 토큰·호스트·응답 본문·질문은 기록하지 않습니다. 실패한 질문/답변은 저장하지 않습니다.
- ChatView: 모아AI 모달 안에 오류 안내를 표시. 실패 시 질문 초안을 유지하고 다시 전송할 수 있습니다.
- Vercel BFF: Node runtime과 180초 함수 실행 한도를 명시. 기존 요청/스트림 timeout 및 취소를 유지합니다.
- Python: 공개 정보가 없는 `/healthz` liveness 추가. 내부 준비/업무 API는 인증 유지. Docker는 Render의 PORT를 사용하며 로컬 기본값은 8000입니다.

## 검증

운영 진단은 위의 실제 HTTP 재현 결과입니다. 수정 이후의 테스트는 별도 격리 환경입니다.

- Maven: 상위 상태 분류, 네트워크 실패, 실패한 대화 저장 방지 및 기존 전체 테스트.
- RAG unittest: 공개 liveness와 비공개 health 인증 포함 17개 테스트.
- `pnpm test:chat-stream`: UTF-8, 조각·오류·취소, BFF의 완료 전 전달.
- `pnpm test:ai-errors`: 1440/390px 모달 내 오류 가시성, 초안 보존, 재시도 후 성공 응답.
- `render.yaml`: Render 공식 2020-12 JSON Schema 검증 통과.

운영 RAG 서비스의 실제 주소 및 연결 설정 확인/적용이 남아 있으며, 운영 복구 완료로 간주하지 않습니다.
