-- DRAFT / LOCAL REHEARSAL ONLY. Do not execute in Supabase yet.
-- Intended location: main database, outside the four frozen CRM tables.
-- Stores restricted PII. Never log payloads; define purge after accepted replay.
-- Replay must apply database effects AND completion in ONE transaction on this DB.
-- Separate HTTP requests to select/apply/complete are NOT a safe replay worker.
BEGIN;
CREATE TABLE public.odeon_crm_cutover_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kind text NOT NULL CHECK (kind IN ('intake', 'inbound_sms', 'voice_status')),
  delivery_key text NOT NULL CHECK (length(delivery_key) BETWEEN 1 AND 200),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, kind, delivery_key)
);
CREATE INDEX odeon_crm_cutover_queue_pending
  ON public.odeon_crm_cutover_queue (received_at, id)
  WHERE completed_at IS NULL;
ALTER TABLE public.odeon_crm_cutover_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odeon_crm_cutover_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.odeon_crm_cutover_queue TO service_role;

CREATE FUNCTION public.odeon_crm_capture(
  p_tenant_id uuid, p_kind text, p_delivery_key text, p_payload jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE saved public.odeon_crm_cutover_queue;
BEGIN
  INSERT INTO public.odeon_crm_cutover_queue(tenant_id, kind, delivery_key, payload)
    VALUES (p_tenant_id, p_kind, p_delivery_key, p_payload)
    ON CONFLICT (tenant_id, kind, delivery_key) DO NOTHING
    RETURNING * INTO saved;
  IF saved.id IS NULL THEN
    SELECT * INTO saved FROM public.odeon_crm_cutover_queue
      WHERE tenant_id=p_tenant_id AND kind=p_kind AND delivery_key=p_delivery_key;
    IF saved.id IS NULL OR saved.payload IS DISTINCT FROM p_payload THEN
      RAISE EXCEPTION 'Capture key conflict; reconciliation required';
    END IF;
  END IF;
  RETURN saved.id;
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_capture(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_capture(uuid, text, text, jsonb)
  TO service_role;
COMMIT;