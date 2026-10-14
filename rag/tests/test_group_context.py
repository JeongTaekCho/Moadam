import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from test_rag import FakeConnection

import app as rag


class GroupConnection(FakeConnection):
    def __init__(self, group, user, session):
        super().__init__(group, user, session, uuid4())
        stamp = datetime(2026, 10, 14, tzinfo=timezone.utc)
        self.events = [
            dict(
                id=uuid4(),
                title="가상 정기모임",
                starts_at=stamp,
                ends_at=stamp + timedelta(hours=2),
                location="가상 회의실",
                description="노트 준비",
                updated_at=stamp,
            )
        ]
        self.notices = [
            dict(id=uuid4(), title="가상 회비 공지", body="회비는 5천원", updated_at=stamp)
        ]

    def execute(self, sql, args=()):
        if "from events" in sql or "from posts" in sql:
            records = self.events if "from events" in sql else self.notices
            self.result = records if args[0] == self.group else []
            if "id=any" in sql:
                self.result = [record for record in self.result if record["id"] in args[1]]
            return self
        return super().execute(sql, args)


class GroupContextTests(unittest.TestCase):
    def setUp(self):
        self.group, self.user, self.session = uuid4(), uuid4(), uuid4()
        self.conn = GroupConnection(self.group, self.user, self.session)
        self.req = rag.QueryRequest(
            group_id=self.group,
            user_id=self.user,
            session_id=self.session,
            question="다음 모임 일정과 회비 공지 알려줘",
            allowed_document_ids=[],
            request_id=uuid4(),
        )

    def test_current_events_and_only_notices_work_without_uploaded_documents(self):
        with patch.object(rag, "db", return_value=self.conn), patch.object(rag, "embed") as embed:
            rows = rag.prepare_query(self.req)
            embed.assert_not_called()
            self.assertEqual([row["source_type"] for row in rows], ["event", "notice"])
            self.assertIn("+09:00", rows[0]["content"])
            self.assertIn("가상 회의실", rows[0]["content"])
            payload = rag.generation_payload(self.req, rows)
            self.assertIn("current_time_kst", payload["messages"][1]["content"])
            result = rag.finish_query(
                self.req,
                rows,
                dict(
                    answer="**회비**는 5천원입니다.",
                    grounded=True,
                    chunk_ids=[str(row["id"]) for row in rows],
                ),
            )
        self.assertTrue(result.grounded)
        self.assertIsNone(result.citations[0].document_id)
        self.assertEqual(result.citations[0].source_type, "event")
        self.assertEqual(result.citations[1].source_type, "notice")

    def test_deleted_or_edited_sources_cannot_back_an_answer(self):
        with patch.object(rag, "db", return_value=self.conn):
            rows = rag.prepare_query(self.req)
            self.conn.notices[0]["updated_at"] = datetime(2026, 10, 15, tzinfo=timezone.utc)
            result = rag.finish_query(
                self.req, rows, dict(answer="회비", grounded=True, chunk_ids=[str(rows[1]["id"])])
            )
            self.assertFalse(result.grounded)
            self.assertEqual(result.retrieval["reason"], "documents_changed")
            self.conn.events = []
            result = rag.finish_query(
                self.req, rows, dict(answer="일정", grounded=True, chunk_ids=[str(rows[0]["id"])])
            )
            self.assertFalse(result.grounded)

    def test_other_groups_cannot_load_sources(self):
        from group_context import load_group_sources

        self.assertEqual(load_group_sources(self.conn, uuid4(), "회비"), [])

    def test_streaming_returns_event_and_notice_citations(self):
        from fastapi.testclient import TestClient

        with (
            patch.object(rag, "db", return_value=self.conn),
            patch.object(rag.settings, "rag_provider", "mock"),
        ):
            response = TestClient(rag.app).post(
                "/query/stream",
                json=self.req.model_dump(mode="json"),
                headers={"Authorization": "Bearer " + rag.settings.rag_internal_token},
            )
        self.assertEqual(response.status_code, 200)
        events = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual(events[-1]["type"], "done")
        self.assertEqual(
            {citation["source_type"] for citation in events[-1]["result"]["citations"]},
            {"event", "notice"},
        )
