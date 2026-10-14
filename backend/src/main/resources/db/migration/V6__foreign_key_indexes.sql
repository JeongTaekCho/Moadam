-- Cover referencing columns for user/member lookups and foreign-key cleanup.
create index if not exists chat_sessions_user on public.chat_sessions(user_id);
create index if not exists comments_author on public.comments(author_id);
create index if not exists event_attendees_member on public.event_attendees(group_id,user_id);
create index if not exists event_attendees_user on public.event_attendees(user_id);
create index if not exists events_author on public.events(author_id);
create index if not exists group_invites_creator on public.group_invites(created_by);
