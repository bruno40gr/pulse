-- Additive: existing notes, completion history, replies and participants are retained.
BEGIN;

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS follow_up JSONB;
ALTER TABLE public.notes ADD CONSTRAINT notes_follow_up_shape CHECK (
  follow_up IS NULL OR (
    jsonb_typeof(follow_up) = 'object'
    AND follow_up ?& ARRAY['description', 'ownerId', 'dueDate', 'personId']
    AND jsonb_typeof(follow_up->'description') = 'string'
    AND length(trim(follow_up->>'description')) BETWEEN 1 AND 20000
    AND jsonb_typeof(follow_up->'ownerId') = 'string'
    AND (follow_up->>'ownerId') ~ '^[0-9a-fA-F-]{36}$'
    AND jsonb_typeof(follow_up->'dueDate') = 'string'
    AND (follow_up->>'dueDate') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (follow_up->'personId' = 'null'::jsonb OR (
      jsonb_typeof(follow_up->'personId') = 'string'
      AND (follow_up->>'personId') ~ '^(contact|lead):[0-9a-fA-F-]{36}$'
    ))
  )
);
CREATE INDEX IF NOT EXISTS idx_notes_task_owner ON public.notes (tenant_id, (follow_up->>'ownerId')) WHERE follow_up IS NOT NULL;

-- Task assignment and private access are one transaction: never persist an owner
-- who cannot open the private conversation. Invoked only by the authorized API.
CREATE OR REPLACE FUNCTION public.save_note_task(
  p_tenant_id UUID, p_note_id UUID, p_actor_membership_id UUID,
  p_task JSONB, p_title TEXT DEFAULT NULL, p_body TEXT DEFAULT NULL
) RETURNS SETOF public.notes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target public.notes;
  owner_id UUID;
BEGIN
  SELECT * INTO target FROM public.notes WHERE id = p_note_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE id = p_actor_membership_id AND tenant_id = p_tenant_id AND status IN ('unclaimed', 'invited', 'active')) THEN
    RAISE EXCEPTION 'Invalid actor';
  END IF;
  IF target.is_private AND NOT EXISTS (SELECT 1 FROM public.note_participants WHERE note_id = p_note_id AND tenant_id = p_tenant_id AND membership_id = p_actor_membership_id) THEN
    RAISE EXCEPTION 'Note not found';
  END IF;
  owner_id := (p_task->>'ownerId')::UUID;
  IF owner_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE id = owner_id AND tenant_id = p_tenant_id AND status IN ('unclaimed', 'invited', 'active')) THEN
    RAISE EXCEPTION 'Invalid task owner';
  END IF;
  IF target.is_private THEN
    INSERT INTO public.note_participants (tenant_id, note_id, membership_id)
      VALUES (p_tenant_id, p_note_id, owner_id) ON CONFLICT (note_id, membership_id) DO NOTHING;
  END IF;
  RETURN QUERY UPDATE public.notes SET follow_up = p_task,
    title = CASE WHEN p_title IS NULL THEN title ELSE NULLIF(trim(p_title), '') END,
    body = COALESCE(p_body, body), updated_at = now()
    WHERE id = p_note_id AND tenant_id = p_tenant_id RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.save_note_task(UUID, UUID, UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_note_task(UUID, UUID, UUID, JSONB, TEXT, TEXT) TO service_role;
COMMIT;