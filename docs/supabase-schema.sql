-- People Action Check — Supabase schema
-- Run this in the Supabase SQL editor (supabase.com → your project → SQL editor)

create table if not exists pac_cases (
  case_id           text        primary key,
  manager_id        text        not null,
  scenario          text        not null,
  scenarios         jsonb       not null default '[]',
  ref_name          text        not null default '',
  risk              text        not null check (risk in ('good','warn','risk')),
  state             text        not null,
  source            text        not null default 'slack',
  answers           jsonb       not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  hr_notified       boolean     not null default false,
  hr_channel_id     text,
  hr_channel_ts     text,
  dm_ts             text,
  dm_channel_id     text,
  followup_count    integer     not null default 0,
  attachments       jsonb       not null default '[]',
  audit_log         jsonb       not null default '[]'
);

-- Indexes for the query patterns PAC uses
create index if not exists idx_pac_cases_manager   on pac_cases (manager_id);
create index if not exists idx_pac_cases_updated   on pac_cases (updated_at desc);
create index if not exists idx_pac_cases_hr        on pac_cases (hr_notified, updated_at desc);
create index if not exists idx_pac_cases_state     on pac_cases (state);

-- Auto-update updated_at on any row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pac_cases_updated_at
  before update on pac_cases
  for each row execute procedure set_updated_at();

-- Row-level security (optional but recommended for multi-tenant use)
-- Enable RLS: alter table pac_cases enable row level security;
-- Then add policies scoped to your auth setup.

-- Useful views for HR reporting
create or replace view pac_open_cases as
  select * from pac_cases
  where state not in ('CLOSED','ARCHIVED')
  order by updated_at desc;

create or replace view pac_hr_queue as
  select * from pac_cases
  where hr_notified = true
    and state not in ('CLOSED','ARCHIVED')
  order by
    case risk when 'risk' then 1 when 'warn' then 2 else 3 end,
    updated_at desc;
