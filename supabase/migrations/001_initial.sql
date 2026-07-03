-- Contacts table
create table contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  service_type text, -- 'private', 'group', 'semi-private'
  instrument text, -- 'piano', 'guitar', 'drums', 'voice', 'bass', etc.
  lesson_day text, -- 'monday', 'tuesday', etc.
  lesson_time text,
  instructor text,
  plan_name text,
  session_name text,
  client_status text default 'active', -- 'active', 'inactive'
  last_attended date,
  tags text[],
  opted_out boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns table
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text,
  channel text not null, -- 'sms', 'email'
  message text not null,
  media_url text, -- for MMS
  filter_query text, -- the natural language query used
  recipient_count integer,
  status text default 'draft', -- 'draft', 'sending', 'sent', 'failed'
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Messages table (individual sends)
create table messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  contact_id uuid references contacts(id),
  channel text not null,
  direction text not null, -- 'outbound', 'inbound'
  body text,
  media_url text,
  status text, -- 'queued', 'sent', 'delivered', 'failed', 'received'
  twilio_sid text,
  error_message text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table contacts enable row level security;
alter table campaigns enable row level security;
alter table messages enable row level security;

-- RLS policies (service role bypasses these)
create policy "Service role full access contacts" on contacts for all to service_role using (true) with check (true);
create policy "Service role full access campaigns" on campaigns for all to service_role using (true) with check (true);
create policy "Service role full access messages" on messages for all to service_role using (true) with check (true);