"""Bounded, current group facts; caller checks membership and session before use."""

import re
from zoneinfo import ZoneInfo


def source_row(record, kind):
    if kind == "event":
        start = record["starts_at"].astimezone(ZoneInfo("Asia/Seoul")).isoformat()
        end = record["ends_at"].astimezone(ZoneInfo("Asia/Seoul")).isoformat()
        content = (
            f"시작: {start}\n종료: {end}\n장소: {record['location']}\n설명: {record['description']}"
        )
    else:
        content = record["body"]
    return {
        "id": record["id"],
        "document_id": None,
        "source_id": record["id"],
        "source_type": kind,
        "source_version": str(record["updated_at"]),
        "title": record["title"],
        "page_number": None,
        "content": content[:1600],
        "similarity": 1.0,
    }


def load_group_sources(conn, group, question):
    terms = set(re.findall(r"[가-힣A-Za-z0-9]{2,}", question.lower()))
    patterns = [f"%{term}%" for term in sorted(terms)[:12]]
    events = conn.execute(
        """select id,title,left(description,1200) as description,left(location,300) as location,
        starts_at,ends_at,updated_at from events where group_id=%s
        order by ((title||' '||description) ilike any(%s::text[])) desc, (ends_at>=now()) desc,
        case when ends_at>=now() then starts_at end asc,
        case when ends_at<now() then starts_at end desc limit 50""",
        (group, patterns),
    ).fetchall()
    notices = conn.execute(
        """select id,title,left(body,1600) as body,updated_at from posts
        where group_id=%s and kind='notice'
        order by ((title||' '||body) ilike any(%s::text[])) desc,updated_at desc,id limit 40""",
        (group, patterns),
    ).fetchall()

    def choose(records, kind, limit):
        rows = [source_row(record, kind) for record in records]
        rows.sort(
            key=lambda row: sum(
                term in (row["title"] + " " + row["content"]).lower() for term in terms
            ),
            reverse=True,
        )
        return rows[:limit]

    selected = choose(events, "event", 8) + choose(notices, "notice", 6)
    remaining = 9000
    bounded = []
    for row in selected:
        if remaining < 200:
            break
        row["content"] = row["content"][: min(1000, remaining)]
        remaining -= len(row["content"])
        bounded.append(row)
    return bounded


def current_group_sources(conn, group, rows):
    for kind, table in (("event", "events"), ("notice", "posts")):
        selected = [row for row in rows if row.get("source_type") == kind]
        if not selected:
            continue
        # The table is selected from a fixed mapping, never from a request or model.
        condition = " and kind='notice'" if kind == "notice" else ""
        records = conn.execute(
            f"select id,updated_at from {table} where group_id=%s and id=any(%s::uuid[])"
            + condition,
            (group, [row["source_id"] for row in selected]),
        ).fetchall()
        versions = {record["id"]: str(record["updated_at"]) for record in records}
        if any(versions.get(row["source_id"]) != row["source_version"] for row in selected):
            return False
    return True
