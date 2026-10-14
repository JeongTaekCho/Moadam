-- Token accounting is private to the backend and internal RAG database role.
create table public.ai_daily_token_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used_tokens bigint not null default 0 check (used_tokens >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  primary key (user_id, usage_date)
);
create table public.ai_token_requests (
  request_id uuid primary key,
  user_id uuid not null,
  usage_date date not null,
  allocated_tokens integer not null check (allocated_tokens > 0),
  charged_tokens integer not null default 0 check (charged_tokens >= 0),
  estimated boolean not null default false,
  started boolean not null default false,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (user_id, usage_date) references public.ai_daily_token_usage on delete cascade
);
create index ai_token_requests_open on public.ai_token_requests(user_id,usage_date,created_at) where not finished;
alter table public.ai_daily_token_usage enable row level security;
alter table public.ai_token_requests enable row level security;
revoke all on public.ai_daily_token_usage, public.ai_token_requests from anon, authenticated;

create function public.ai_reserve_tokens(p_user uuid,p_request uuid,p_limit integer,p_request_limit integer)
returns table(usage_date date,used_tokens bigint,reserved_tokens bigint,allocated_tokens integer)
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  day date := (current_timestamp at time zone 'Asia/Seoul')::date;
  daily public.ai_daily_token_usage%rowtype;
  ticket public.ai_token_requests%rowtype;
  released bigint;
  allocation integer;
begin
  if p_limit < 1 or p_request_limit < 1 then raise exception 'Invalid token limit'; end if;
  insert into public.ai_daily_token_usage(user_id,usage_date) values(p_user,day) on conflict do nothing;
  select * into daily from public.ai_daily_token_usage d where d.user_id=p_user and d.usage_date=day for update;
  -- Every writer locks the daily row before a ticket to avoid lock-order deadlocks.
  with expired as (
    update public.ai_token_requests r set finished=true
    where r.user_id=p_user and r.usage_date=day and not r.finished and r.created_at < now()-interval '5 minutes'
    returning greatest(r.allocated_tokens-r.charged_tokens,0) as amount
  ) select coalesce(sum(amount),0) into released from expired;
  daily.reserved_tokens := greatest(daily.reserved_tokens-released,0);
  update public.ai_daily_token_usage d set reserved_tokens=daily.reserved_tokens where d.user_id=p_user and d.usage_date=day;
  select * into ticket from public.ai_token_requests r where r.request_id=p_request;
  if found then
    if ticket.user_id<>p_user or ticket.usage_date<>day or ticket.finished then return; end if;
    return query select day,daily.used_tokens,daily.reserved_tokens,ticket.allocated_tokens;
    return;
  end if;
  allocation := least(p_request_limit,greatest(p_limit-daily.used_tokens-daily.reserved_tokens,0));
  if allocation=0 then return; end if;
  insert into public.ai_token_requests(request_id,user_id,usage_date,allocated_tokens) values(p_request,p_user,day,allocation);
  update public.ai_daily_token_usage d set reserved_tokens=d.reserved_tokens+allocation where d.user_id=p_user and d.usage_date=day;
  return query select day,daily.used_tokens,daily.reserved_tokens+allocation,allocation;
end;
$$;

-- A cumulative value makes provider completion/finally retries idempotent.
create function public.ai_charge_tokens(p_request uuid,p_user uuid,p_total integer,p_estimated boolean)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare ticket public.ai_token_requests%rowtype; delta integer; reserve_delta integer;
begin
  if p_total<0 or p_total>1000000 then raise exception 'Invalid token usage'; end if;
  select * into ticket from public.ai_token_requests r where r.request_id=p_request and r.user_id=p_user;
  if not found then raise exception 'Token reservation not found'; end if;
  perform 1 from public.ai_daily_token_usage d where d.user_id=p_user and d.usage_date=ticket.usage_date for update;
  select * into ticket from public.ai_token_requests r where r.request_id=p_request for update;
  delta := p_total-ticket.charged_tokens;
  reserve_delta := case when ticket.finished then 0 else greatest(ticket.allocated_tokens-ticket.charged_tokens,0)-greatest(ticket.allocated_tokens-p_total,0) end;
  update public.ai_daily_token_usage d set used_tokens=d.used_tokens+delta,reserved_tokens=greatest(d.reserved_tokens-reserve_delta,0) where d.user_id=p_user and d.usage_date=ticket.usage_date;
  update public.ai_token_requests r set charged_tokens=p_total,estimated=p_estimated where r.request_id=p_request;
end;
$$;

create function public.ai_finish_tokens(p_request uuid,p_user uuid,p_only_unstarted boolean default false)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare ticket public.ai_token_requests%rowtype;
begin
  select * into ticket from public.ai_token_requests r where r.request_id=p_request and r.user_id=p_user;
  if not found then return; end if;
  perform 1 from public.ai_daily_token_usage d where d.user_id=p_user and d.usage_date=ticket.usage_date for update;
  select * into ticket from public.ai_token_requests r where r.request_id=p_request for update;
  if ticket.finished or (p_only_unstarted and ticket.started) then return; end if;
  update public.ai_daily_token_usage d set reserved_tokens=greatest(d.reserved_tokens-greatest(ticket.allocated_tokens-ticket.charged_tokens,0),0) where d.user_id=p_user and d.usage_date=ticket.usage_date;
  update public.ai_token_requests r set finished=true where r.request_id=p_request;
end;
$$;
revoke all on function public.ai_reserve_tokens(uuid,uuid,integer,integer), public.ai_charge_tokens(uuid,uuid,integer,boolean), public.ai_finish_tokens(uuid,uuid,boolean) from public,anon,authenticated;
