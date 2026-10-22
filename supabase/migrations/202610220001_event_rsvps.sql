BEGIN;

CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_id text NOT NULL CHECK (event_id = 'headliner-grand-opening'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 99),
  submission_key text NOT NULL CHECK (submission_key ~ '^[A-Za-z0-9_-]{1,160}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id, submission_key)
);
CREATE INDEX event_rsvps_event_created ON public.event_rsvps(tenant_id, event_id, created_at DESC);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_rsvps FROM anon, authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

CREATE FUNCTION public.capture_event_rsvp(p_tenant uuid, p_event text, p_key text, p_name text, p_email text, p_party_size integer)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE saved public.event_rsvps;
BEGIN
  INSERT INTO event_rsvps(tenant_id, event_id, submission_key, name, email, party_size)
  VALUES (p_tenant, p_event, p_key, p_name, p_email, p_party_size)
  ON CONFLICT (tenant_id, event_id, submission_key) DO NOTHING;
  SELECT * INTO STRICT saved FROM event_rsvps
  WHERE tenant_id = p_tenant AND event_id = p_event AND submission_key = p_key;
  IF saved.name IS DISTINCT FROM p_name OR saved.email IS DISTINCT FROM p_email OR saved.party_size IS DISTINCT FROM p_party_size THEN
    RAISE EXCEPTION 'Submission key was already used for different details' USING ERRCODE = '22023';
  END IF;
  RETURN saved.id;
END;
$$;

-- One snapshot for the full guest list and totals; no PostgREST row-limit truncation.
CREATE FUNCTION public.event_rsvp_workspace(p_tenant uuid, p_event text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'parties', count(*),
    'guests', COALESCE(sum(party_size), 0),
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'email', email, 'party_size', party_size, 'created_at', created_at
    ) ORDER BY created_at DESC, id), '[]'::jsonb)
  ) FROM event_rsvps WHERE tenant_id = p_tenant AND event_id = p_event;
$$;
REVOKE ALL ON FUNCTION public.capture_event_rsvp(uuid, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.event_rsvp_workspace(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_event_rsvp(uuid, text, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.event_rsvp_workspace(uuid, text) TO service_role;

COMMIT;