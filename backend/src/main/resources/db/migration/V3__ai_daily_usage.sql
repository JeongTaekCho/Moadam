-- Accepted AI requests are counted per authenticated user, across all groups.
create table public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used integer not null check (used between 1 and 30),
  primary key (user_id, usage_date)
);
alter table public.ai_daily_usage enable row level security;
-- Backend JDBC owns accounting; browsers cannot read or modify counters directly.
revoke all on public.ai_daily_usage from anon, authenticated;
