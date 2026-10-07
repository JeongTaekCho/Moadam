-- Execute via psql after signing up two real users.
-- psql "$RAG_DATABASE_URL" -v owner_id=REAL_UUID -v member_id=REAL_UUID -f scripts/seed-demo.sql
-- Do not run against a production project. Does not insert or alter auth credentials.
begin;
insert into groups(id,name,timezone) values('11111111-1111-4111-8111-111111111111','주말 독서 모임','Asia/Seoul') on conflict(id) do nothing;
insert into group_members(group_id,user_id,role) values
 ('11111111-1111-4111-8111-111111111111',:'owner_id'::uuid,'owner'),
 ('11111111-1111-4111-8111-111111111111',:'member_id'::uuid,'member') on conflict do nothing;
insert into posts(id,group_id,author_id,title,body,kind) values
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',:'owner_id'::uuid,'우리 모임에 오신 것을 환영해요','함께 읽은 책의 감상과 다음 모임 일정을 공유해 주세요.','notice') on conflict do nothing;
insert into events(id,group_id,author_id,title,description,location,starts_at,ends_at) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',:'owner_id'::uuid,'다음 독서 모임','각자 인상 깊었던 구절을 준비해 주세요.','동네 도서관',now()+interval '7 days',now()+interval '7 days 2 hours') on conflict do nothing;
insert into documents(id,group_id,author_id,title,kind,text_content) values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',:'owner_id'::uuid,'모임 운영 안내','memo','독서 모임은 매월 첫째 주 토요일 오후 2시에 동네 도서관에서 만납니다. 회비는 월 1만원입니다.') on conflict do nothing;
commit;
-- Open the seeded memo in the app and press 재색인 (mock or openai mode).
