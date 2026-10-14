# RAG Vercel Python 프로젝트 배포 오류

- 작성일: 2026-10-14 (한국 시간)
- 상태: 코드 수정·로컬 빌드 단계 검증 완료 / 운영 재배포 확인 대기
- 영향 범위: RAG Vercel 의존성 설치, Python 런타임 및 FastAPI 진입점

## 증상과 확인된 원인

운영 RAG 배포에서 `uv lock --python /vercel/path0/rag/.vercel/python/.venv/bin/python`이 실행됐지만 다음 오류로 중단됐다.

```text
error: No `project` table found in: /vercel/path0/rag/pyproject.toml
```

기존 `pyproject.toml`은 Ruff 도구 설정만 포함했으며 `[project]`가 없었다. Vercel은 이 파일을 Python 프로젝트 파일로 사용했고, uv가 프로젝트 이름·버전·의존성을 읽을 수 없어 실패했다.

별도로 `requirements.txt`의 축약 목록에는 새 토큰 계산 모듈이 사용하는 `tiktoken`도 빠져 있었다. Docker 설치는 `requirements.lock`을 사용하므로 로컬/Docker와 Vercel의 의존성 선언이 서로 달랐다.

## 수정

- `pyproject.toml`에 `[project]`, 프로젝트 이름·버전·Python `>=3.12,<3.13` 및 기존 운영 lock과 동일한 고정 의존성을 추가했다. 기존 운영 패키지 버전을 바꾸지 않았다.
- 패키지 배포가 아닌 FastAPI 앱이므로 `[tool.uv] package = false`를 설정하고, `[tool.vercel] entrypoint = "app:app"`을 명시했다.
- `uv.lock`을 생성해 Vercel의 의존성 해석을 재현 가능하게 했다.
- `requirements.txt`를 `-r requirements.lock`으로 통일했다. Docker와 requirements 방식에서도 같은 의존성을 설치한다.
- `scripts/check-rag-dependencies.py`를 `make conventions`에 연결해 프로젝트 메타데이터·진입점·고정 의존성 불일치를 검사한다. 의존성 변경 지침도 갱신했다.

## 검증

- uv 0.13.0 / Python 3.12에서 배포 오류와 같은 `uv lock --python .venv/bin/python`: 성공, 28개 패키지 해석.
- `uv lock --check --python .venv/bin/python`: 성공.
- 별도 새 가상환경의 `uv sync --locked`: 성공. 실행 중인 로컬 RAG 가상환경은 변경하지 않았다.
- 새 설치 환경에서 `app`, `group_context`, `tiktoken` import 성공. ASGI `/healthz` 200, 내부 `/health`·`/query` 인증 없는 요청 401을 확인했다. 원격 DB나 유료 모델을 호출하지 않았다.
- 기존 RAG unittest 52개, Ruff check/format, 의존성 일치 및 `git diff --check`: 통과.

## 운영 적용

추가 SQL이나 DB migration은 필요 없다. 코드와 lockfile을 포함한 버전으로 RAG를 다시 배포해야 한다. 이 작업에서 운영 배포는 실행하지 않았고 Vercel의 전체 원격 빌드 성공까지 확인한 것은 아니다.

RAG 운영 주소가 바뀌었다면 Spring의 `RAG_URL`이 해당 RAG 서비스를 가리키는지도 확인해야 한다. 프론트와 Spring의 최신 코드만 배포돼도 RAG 배포가 실패하면 새 일정·공지 참조 경로는 운영에 반영되지 않는다.

공식 근거: [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python), [uv project configuration](https://docs.astral.sh/uv/concepts/projects/config/).
