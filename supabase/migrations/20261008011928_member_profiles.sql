alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
-- Display data only; these fields never determine authorization.
insert into public.profiles(id,display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'),''),nullif(btrim(raw_user_meta_data->>'name'),''),'멤버 '||left(id::text,8)),30)
from auth.users on conflict(id) do nothing;
create index if not exists posts_author_created on public.posts(author_id,created_at desc,id);
create index if not exists documents_author_created on public.documents(author_id,created_at desc,id);
create index if not exists members_user_group on public.group_members(user_id,group_id);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',false,2097152,array['image/png'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png'];
-- Access is mediated by the authenticated backend; no public Storage policies.
