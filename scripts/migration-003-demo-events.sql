create table if not exists public.demo_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  event_type text not null,
  visitor_id text not null,
  session_id text not null,
  tenant_id uuid null references public.tenants (id) on delete set null,
  path text null,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text null
);

create index if not exists demo_events_created_at_idx on public.demo_events (created_at desc);
create index if not exists demo_events_event_type_idx on public.demo_events (event_type);
create index if not exists demo_events_visitor_id_idx on public.demo_events (visitor_id);
create index if not exists demo_events_tenant_id_idx on public.demo_events (tenant_id);

comment on table public.demo_events is 'Lightweight event log for Hey Cohen demo engagement and unique visitor counts.';
