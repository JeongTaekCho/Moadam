import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { vector, pgcrypto } });
await db.exec(`create schema auth;create schema storage;create schema extensions;create extension vector with schema extensions;set search_path=public,extensions;create role anon;create role authenticated;
create table auth.users(id uuid primary key);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
await db.exec(
  await readFile(
    new URL(
      "../../backend/src/main/resources/db/migration/V1__community.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
let checks = 0;
const query = (sql, args = []) => db.query(sql, args);
const id = () => crypto.randomUUID();
const g1 = id(),
  g2 = id(),
  u1 = id(),
  u2 = id(),
  p1 = id(),
  p2 = id(),
  e = id(),
  d1 = id(),
  d2 = id(),
  session = id();
await query("insert into auth.users values($1),($2)", [u1, u2]);
await query("insert into groups(id,name) values($1,'A'),($2,'B')", [g1, g2]);
await query(
  "insert into group_members(group_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')",
  [g1, u1, g2, u2],
);
await query(
  "insert into posts(id,group_id,author_id,title,body,kind) values($1,$2,$3,'A post','A text','general'),($4,$5,$6,'B post','B text','general')",
  [p1, g1, u1, p2, g2, u2],
);
assert.equal(
  (await query("select * from posts where group_id=$1", [g1])).rows.length,
  1,
);
checks++;
await assert.rejects(
  query(
    "insert into comments(group_id,post_id,author_id,body) values($1,$2,$3,$4)",
    [g1, p2, u1, "cross group"],
  ),
);
checks++;
await query(
  "insert into events(id,group_id,author_id,title,starts_at,ends_at) values($1,$2,$3,'meeting','2026-10-07T01:00Z','2026-10-07T02:00Z')",
  [e, g1, u1],
);
await assert.rejects(
  query("insert into event_attendees values($1,$2,$3,'going',now())", [
    g1,
    e,
    u2,
  ]),
);
checks++;
await query(
  "insert into event_attendees(group_id,event_id,user_id,status) values($1,$2,$3,'going') on conflict(group_id,event_id,user_id) do update set status=excluded.status",
  [g1, e, u1],
);
await query(
  "insert into event_attendees(group_id,event_id,user_id,status) values($1,$2,$3,'maybe') on conflict(group_id,event_id,user_id) do update set status=excluded.status",
  [g1, e, u1],
);
assert.equal(
  (
    await query(
      "select status from event_attendees where group_id=$1 and event_id=$2",
      [g1, e],
    )
  ).rows[0].status,
  "maybe",
);
checks++;
await assert.rejects(
  query(
    "insert into events(group_id,author_id,title,starts_at,ends_at) values($1,$2,'invalid',now(),now()-interval '1 hour')",
    [g1, u1],
  ),
);
checks++;
await query(
  "insert into documents(id,group_id,author_id,title,kind,text_content,status) values($1,$2,$3,'A doc','memo','A content','ready'),($4,$5,$6,'B doc','memo','B content','ready')",
  [d1, g1, u1, d2, g2, u2],
);
const embedding = "[" + [1, ...Array(1535).fill(0)].join(",") + "]";
await query(
  "insert into document_chunks(group_id,document_id,version,chunk_index,page_number,content,embedding) values($1,$2,1,0,1,'A content',$3::vector),($4,$5,1,0,2,'B SECRET',$3::vector)",
  [g1, d1, embedding, g2, d2],
);
const found = await query(
  `select c.content,c.document_id from document_chunks c join documents d on d.group_id=c.group_id and d.id=c.document_id and d.version=c.version where c.group_id=$1 and d.status='ready' and c.document_id=any($2::uuid[]) order by c.embedding <=> $3::vector limit 5`,
  [g1, [d1, d2], embedding],
);
assert.equal(found.rows.length, 1);
assert.equal(found.rows[0].content, "A content");
checks++;
assert.equal(
  (
    await query(
      "select * from document_chunks where group_id=$1 and document_id=any($2::uuid[])",
      [g1, [d2]],
    )
  ).rows.length,
  0,
);
checks++;
await assert.rejects(
  db.transaction(async (tx) => {
    await tx.query(
      "delete from document_chunks where group_id=$1 and document_id=$2",
      [g1, d1],
    );
    throw new Error("embedding failure");
  }),
);
assert.equal(
  (
    await query(
      "select count(*)::int n from document_chunks where group_id=$1 and document_id=$2",
      [g1, d1],
    )
  ).rows[0].n,
  1,
);
checks++;
await query("set role authenticated");
await assert.rejects(query("select * from posts"));
await query("reset role");
checks++;
await query("insert into chat_sessions(id,group_id,user_id) values($1,$2,$3)", [
  session,
  g1,
  u1,
]);
await query(
  "insert into chat_messages(group_id,session_id,role,content) values($1,$2,'user','private')",
  [g1, session],
);
assert.equal(
  (
    await query(
      "select * from chat_sessions where group_id=$1 and user_id=$2",
      [g1, u2],
    )
  ).rows.length,
  0,
);
checks++;
await query("delete from group_members where group_id=$1 and user_id=$2", [
  g1,
  u1,
]);
assert.equal(
  (await query("select count(*)::int n from chat_messages")).rows[0].n,
  0,
);
assert.equal(
  (await query("select count(*)::int n from event_attendees")).rows[0].n,
  0,
);
assert.equal(
  (await query("select count(*)::int n from posts where group_id=$1", [g1]))
    .rows[0].n,
  1,
);
checks++;
await query("delete from documents where group_id=$1 and id=$2", [g1, d1]);
assert.equal(
  (
    await query(
      "select count(*)::int n from document_chunks where group_id=$1",
      [g1],
    )
  ).rows[0].n,
  0,
);
checks++;
await query("delete from groups where id=$1", [g2]);
assert.equal(
  (await query("select count(*)::int n from document_chunks")).rows[0].n,
  0,
);
checks++;
await db.close();
console.log(
  `${checks} PostgreSQL/pgvector migration and isolation checks passed (PGlite; Supabase auth/storage tables stubbed).`,
);
