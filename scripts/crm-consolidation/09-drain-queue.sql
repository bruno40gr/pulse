-- DRAFT / LOCAL ONLY. Install after replay functions 05 through 08.
-- One oldest item per call; effects and completion remain atomic. Never skip a
-- failed item. Exceptions are replaced with a fixed code to avoid exposing PII.
BEGIN;
CREATE FUNCTION public.odeon_crm_drain_next()
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  q public.odeon_crm_cutover_queue;
  result_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(8675310);
  SELECT * INTO q FROM public.odeon_crm_cutover_queue
    WHERE completed_at IS NULL ORDER BY received_at, id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','empty'); END IF;
  BEGIN
    CASE q.kind
      WHEN 'intake' THEN result_id := public.odeon_crm_replay_inquiry(q.id);
      WHEN 'inbound_sms' THEN
        PERFORM public.odeon_crm_persist_captured_sms(q.id);
        result_id := public.odeon_crm_replay_sms_history(q.id);
      WHEN 'voice_status' THEN result_id := public.odeon_crm_replay_voice_status(q.id);
      ELSE RAISE EXCEPTION 'Unsupported kind';
    END CASE;
    IF NOT EXISTS (SELECT 1 FROM public.odeon_crm_cutover_queue
      WHERE id=q.id AND completed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Replay completion missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Subtransaction rolls back all effects of this attempt; source payload stays.
    RETURN jsonb_build_object('status','blocked','queue_id',q.id,'kind',q.kind,
      'reason','reconciliation_required');
  END;
  RETURN jsonb_build_object('status','completed','queue_id',q.id,'kind',q.kind,
    'record_id',result_id);
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_drain_next() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_drain_next() TO service_role;
COMMIT;