-- Existing groups keep all members and receive the default capacity of 30.
-- Stop explicitly if legacy data exceeds the supported limit; never remove members.
do $$
begin
  if exists (select 1 from public.group_members group by group_id having count(*) > 30) then
    raise exception 'A group has more than 30 members. Review membership before applying group_capacity.';
  end if;
end $$;

alter table public.groups add column if not exists max_members integer not null default 30;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.groups'::regclass and conname = 'groups_max_members_range') then
    alter table public.groups add constraint groups_max_members_range check (max_members between 1 and 30);
  end if;
end $$;
