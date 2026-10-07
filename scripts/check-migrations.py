from pathlib import Path
root=Path(__file__).resolve().parents[1]
a=(root/'backend/src/main/resources/db/migration/V1__community.sql').read_text()
b=next((root/'supabase/migrations').glob('*_initial_community.sql')).read_text()
assert a==b, 'Flyway and Supabase migrations differ'
assert 'vector(1536)' in a
print('Migration copies and embedding dimensions match')
