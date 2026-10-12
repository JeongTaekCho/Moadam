alter table comments alter column post_id drop not null;
alter table comments add column event_id uuid;
alter table comments add column parent_id uuid;
alter table comments add column deleted boolean not null default false;
alter table comments add constraint comments_target_check check ((post_id is not null) <> (event_id is not null));
alter table comments add constraint comments_event_fk foreign key(group_id,event_id) references events(group_id,id) on delete cascade;
alter table comments add constraint comments_group_id_unique unique(group_id,id);
alter table comments add constraint comments_parent_fk foreign key(group_id,parent_id) references comments(group_id,id) on delete cascade;
alter table comments add constraint comments_not_self check(parent_id is null or parent_id <> id);
create index comments_group_event on comments(group_id,event_id,created_at,id) where event_id is not null;
create index comments_parent on comments(group_id,parent_id) where parent_id is not null;
create function validate_comment_parent() returns trigger language plpgsql set search_path=public as $$
declare parent comments%rowtype;
begin
  if TG_OP = 'UPDATE' and (new.parent_id is distinct from old.parent_id or new.post_id is distinct from old.post_id or new.event_id is distinct from old.event_id or new.group_id is distinct from old.group_id) then
    raise exception 'Comment target and parent cannot change' using errcode='23514';
  end if;
  if TG_OP = 'INSERT' and new.parent_id is not null then
    select * into parent from comments where group_id=new.group_id and id=new.parent_id for update;
    if not found or parent.parent_id is not null or parent.deleted or parent.post_id is distinct from new.post_id or parent.event_id is distinct from new.event_id then
      raise exception 'Invalid comment parent' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger comments_parent_check before insert or update on comments for each row execute function validate_comment_parent();
revoke all on function validate_comment_parent() from public, anon, authenticated;
