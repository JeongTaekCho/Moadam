"""Paid provider QA with synthetic content and an in-memory DB fixture only."""

import asyncio
import json
import re
import sys
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import app as rag


class FixtureConnection:
    def __init__(self, group, user, session, document):
        self.group, self.user, self.session, self.document = group, user, session, document
        self.history = []
        self.usage = []
        self.chunk = uuid4()

    def execute(self, sql, args=()):
        if "from group_members" in sql:
            self.rows = [{"role": "member"}]
        elif "from chat_sessions" in sql:
            self.rows = [{"id": self.session}]
        elif "ai_token_requests" in sql:
            self.rows = [{"allocated_tokens": 20000}]
        elif "ai_charge_tokens" in sql:
            self.usage.append({"tokens": args[2], "estimated": args[3]})
            self.rows = []
        elif "ai_finish_tokens" in sql:
            self.rows = []
        elif "from chat_messages" in sql:
            self.rows = self.history
        elif "select c.id from document_chunks" in sql:
            self.rows = [{"id": self.chunk}]
        elif "from document_chunks" in sql:
            self.rows = [
                {
                    "id": self.chunk,
                    "document_id": self.document,
                    "page_number": 1,
                    "title": "가상 모임 안내",
                    "content": "가상 모임의 정기 회의는 매주 금요일 오후 7시입니다. 장소는 2층 회의실이며 준비물은 노트와 필기구입니다.",
                    "similarity": 0.8,
                }
            ]
        else:
            raise AssertionError("Unexpected fixture query")
        return self

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def main(only_advice=False):
    if not rag.settings.openai_api_key:
        raise RuntimeError("OpenAI API key is required for explicitly requested live QA")
    group, user, session, document = (uuid4() for _ in range(4))
    conn = FixtureConnection(group, user, session, document)
    cases = [
        ("explanation", "광합성이 무엇인지 핵심 내용을 쉽게 설명해줘.", False),
        ("steps", "독서 습관을 만드는 방법을 단계별로 알려줘.", False),
        ("comparison", "TCP와 UDP의 차이를 쉽게 비교해줘.", False),
        ("code", "파이썬에서 리스트의 중복을 제거하는 방법을 코드 예시와 함께 설명해줘.", False),
        ("document", "우리 모임의 정기 회의 일정과 준비물을 정리해줘.", True),
        ("document_followup", "그럼 장소와 준비물만 다시 짧게 정리해줘.", True),
        (
            "general_followup",
            "방금 설명한 광합성을 초등학생도 이해할 수 있게 더 쉽게 설명해줘.",
            False,
        ),
        (
            "missing_group_fact",
            "우리 모임 회비는 얼마야? 확인되지 않은 금액을 추측하지 말아줘.",
            False,
        ),
    ]
    cases.append(
        ("group_advice", "우리 모임에서 사람들이 서로 친해질 수 있는 활동을 추천해줘.", False)
    )
    if only_advice:
        cases = [case for case in cases if case[0] == "group_advice"]
    reports = []
    for kind, question, documents in cases:
        if kind == "document_followup":
            previous = reports[-1]
            conn.history = [
                {"role": "assistant", "content": previous["answer"], "grounded": True},
                {"role": "user", "content": previous["question"], "grounded": False},
            ]
        elif kind == "general_followup":
            previous = reports[0]
            conn.history = [
                {"role": "assistant", "content": previous["answer"], "grounded": False},
                {"role": "user", "content": previous["question"], "grounded": False},
            ]
        else:
            conn.history = []
        conn.usage = []
        req = rag.QueryRequest(
            group_id=group,
            user_id=user,
            session_id=session,
            question=question,
            allowed_document_ids=[document] if documents else [],
            request_id=uuid4(),
            token_budget=20000,
        )
        with (
            patch.object(rag, "db", return_value=conn),
            patch.object(rag.settings, "app_env", "development"),
            patch.object(rag.settings, "rag_provider", "openai"),
        ):
            result = rag.query(req)
        answer = result.answer
        outside_code = re.sub(r"(?ms)^```.*?^```[ \t]*$", "", answer)
        strong = len(re.findall(r"\*\*[^*\n]+\*\*", outside_code))
        paragraphs = len([block for block in answer.split("\n\n") if block.strip()])
        checks = {
            "strong": strong > 0,
            "paragraph_breaks": paragraphs >= 2
            or len(re.findall(r"(?m)^\s*(?:[-*]|\d+[.)])\s+", answer)) >= 2
            or len(answer) < 100,
            "code_block": "```python" in answer if kind == "code" else True,
            "scope": result.grounded == documents,
            "actual_token_usage": bool(conn.usage) and not conn.usage[-1]["estimated"],
        }
        if kind == "group_advice":
            checks["general_advice"] = result.retrieval.get("reason") == "general"
        reports.append(
            {
                "kind": kind,
                "question": question,
                "answer": answer,
                "strong_count": strong,
                "paragraphs": paragraphs,
                "tokens": req._meter.total,
                "checks": checks,
            }
        )
        print(
            json.dumps(
                {
                    "kind": kind,
                    "tokens": req._meter.total,
                    "strong": strong,
                    "paragraphs": paragraphs,
                    "checks": checks,
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
    path = Path("/tmp/moadam-markdown-live-report.json")
    report = (
        json.loads(path.read_text())
        if only_advice and path.exists()
        else {"model": rag.settings.llm_model, "cases": []}
    )
    report["cases"] = [
        case for case in report["cases"] if case["kind"] not in {item["kind"] for item in reports}
    ] + reports
    report["total_tokens"] = sum(case["tokens"] for case in report["cases"])
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    if not all(all(case["checks"].values()) for case in reports):
        raise AssertionError("Markdown live QA needs attention; inspect the synthetic report")
    print(f"PASS: {len(reports)} actual model questions; report={path}")


def stream_smoke():
    group, user, session, document = (uuid4() for _ in range(4))
    conn = FixtureConnection(group, user, session, document)
    req = rag.QueryRequest(
        group_id=group,
        user_id=user,
        session_id=session,
        question="광합성이 무엇인지 쉬운 말로 설명해줘.",
        allowed_document_ids=[],
        request_id=uuid4(),
        token_budget=20000,
    )

    async def check():
        assert rag.slots.acquire(blocking=False)
        events = [json.loads(line) async for line in rag.query_events(req)]
        assert events[-1]["type"] == "done"
        deltas = "".join(event["text"] for event in events if event["type"] == "delta")
        assert deltas
        result = events[-1]["result"]
        assert result["retrieval"]["reason"] == "general"
        assert conn.usage and conn.usage[-1]["estimated"] is False
        return {
            "answer": result["answer"],
            "delta_answer": deltas,
            "tokens": req._meter.total,
            "estimated": False,
            "checks": {"streaming_deltas": True, "provider_usage": True, "general_answer": True},
        }

    with (
        patch.object(rag, "db", return_value=conn),
        patch.object(rag.settings, "app_env", "development"),
        patch.object(rag.settings, "rag_provider", "openai"),
    ):
        report = asyncio.run(check())
    path = Path("/tmp/moadam-markdown-live-report.json")
    existing = json.loads(path.read_text())
    existing["streaming"] = report
    path.write_text(json.dumps(existing, ensure_ascii=False, indent=2))
    print(
        json.dumps(
            {"streaming_tokens": report["tokens"], "checks": report["checks"]}, ensure_ascii=False
        )
    )


if __name__ == "__main__":
    if "--stream-only" in sys.argv:
        stream_smoke()
    else:
        main(only_advice="--advice-only" in sys.argv)
