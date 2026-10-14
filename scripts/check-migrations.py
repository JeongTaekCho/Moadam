from pathlib import Path

root = Path(__file__).resolve().parents[1]
a = (root / "backend/src/main/resources/db/migration/V1__community.sql").read_text()
b = next((root / "supabase/migrations").glob("*_initial_community.sql")).read_text()
assert a == b, "Flyway and Supabase migrations differ"
assert "vector(1536)" in a
c = (root / "backend/src/main/resources/db/migration/V2__threaded_comments.sql").read_text()
d = next((root / "supabase/migrations").glob("*_threaded_comments.sql")).read_text()
assert c == d, "Threaded comment migration copies differ"
assert (
    root / "backend/src/main/resources/db/migration/V3__ai_daily_usage.sql"
).read_text() == next((root / "supabase/migrations").glob("*_ai_daily_usage.sql")).read_text(), (
    "AI usage migration copies differ"
)
assert (
    root / "backend/src/main/resources/db/migration/V4__durable_document_jobs.sql"
).read_text() == next(
    (root / "supabase/migrations").glob("*_durable_document_jobs.sql")
).read_text(), "Document job migrations differ"
assert (
    root / "backend/src/main/resources/db/migration/V5__ai_token_budget.sql"
).read_text() == next((root / "supabase/migrations").glob("*_ai_token_budget.sql")).read_text(), (
    "Token budget migrations differ"
)
assert (
    root / "backend/src/main/resources/db/migration/V6__foreign_key_indexes.sql"
).read_text() == next(
    (root / "supabase/migrations").glob("*_foreign_key_indexes.sql")
).read_text(), "Foreign key index migration copies differ"
assert (
    root / "backend/src/main/resources/db/migration/V7__group_capacity.sql"
).read_text() == next((root / "supabase/migrations").glob("*_group_capacity.sql")).read_text(), (
    "Group capacity migration copies differ"
)

print("Migration copies and embedding dimensions match")
