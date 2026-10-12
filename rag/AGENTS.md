# 내부 RAG 지침

루트 지침과 `../docs/development/conventions.md`의 RAG 절을 따른다.

- Python 3.12, FastAPI, Pydantic, psycopg/httpx를 사용한다. 진입점은 `app:app`이다.
- `requirements.lock`은 운영 의존성 원본이고 `requirements-dev.txt`는 검사 도구를 추가한다. 의존성을 바꾸면 lockfile도 함께 검토한다.
- `app.py`의 ASGI 및 기존 공개 함수 계약을 유지한다. 요청한 책임 분리가 필요할 때만 역할 모듈로 나눈다.
- 내부 Bearer, 모임 멤버십, 개인 세션, 허용 문서/current version 검사와 인용 검증을 유지한다.
- async 답변 스트림에서 동기 DB 작업은 threadpool로 보낸다. UTF-8/한글/이모지와 완료·오류·취소 계약을 유지한다.
- mock provider는 개발/test용이며 production에서 허용하지 않는다. 실데이터·모델 키를 fixture에 넣지 않는다.
- `python -m ruff check .`, `python -m ruff format --check .`, `python -m unittest discover -s tests -v`를 실행한다.
