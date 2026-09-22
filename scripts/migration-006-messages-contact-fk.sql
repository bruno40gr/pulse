-- Fix outbound message recording.
--
-- `messages.contact_id` currently has a foreign key to the legacy `contacts`
-- table (which is empty for the Headliner tenant), but the application now uses
-- `people` as the canonical contact table. As a result, every outbound message
-- insert fails with a 23503 FK violation and messages never appear in the inbox.
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_contact_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.people(id) ON DELETE SET NULL;
