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
print("Migration copies and embedding dimensions match")
