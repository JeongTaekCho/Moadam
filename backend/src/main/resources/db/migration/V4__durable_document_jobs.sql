alter table documents add column if not exists upload_completed boolean not null default true;
alter table documents add column if not exists upload_expires_at timestamptz;
create table if not exists document_jobs (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('index','delete')),
 group_id uuid not null, document_id uuid not null, user_id uuid, version integer not null,
 storage_path text, status text not null default 'queued' check(status in ('queued','running','done','failed')),
 attempts integer not null default 0, run_after timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz, error_code text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(kind,document_id,version)
);
create index if not exists document_jobs_due on document_jobs(run_after) where status in ('queued','running');
create index if not exists document_jobs_group_cleanup on document_jobs(group_id) where kind='delete' and status<>'done';
create index if not exists documents_expired_upload on documents(upload_expires_at) where not upload_completed;
create table if not exists document_daily_usage (
 user_id uuid not null references auth.users(id) on delete cascade, usage_date date not null,
 indexed integer not null default 0 check(indexed>=0), uploaded integer not null default 0 check(uploaded>=0),
 primary key(user_id,usage_date)
);
alter table document_jobs enable row level security;
alter table document_daily_usage enable row level security;
revoke all on document_jobs, document_daily_usage from anon, authenticated;

alter function touch_updated_at() set search_path=public;
