-- Explicit production rollout only. Does not enable a job until the worker is deployed.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS odeon_automation;
REVOKE ALL ON SCHEMA odeon_automation FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION odeon_automation.dispatch_gmail_sync()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  signing_secret text;
  stamp text := floor(extract(epoch FROM clock_timestamp()))::bigint::text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO STRICT signing_secret
  FROM vault.decrypted_secrets WHERE name = 'odeon_gmail_sync_secret';
  IF length(signing_secret) < 32 THEN RAISE EXCEPTION 'Gmail scheduler secret is not configured'; END IF;
  SELECT net.http_get(
    url := 'https://app.headlinerma.com/api/internal/gmail-sync',
    headers := jsonb_build_object(
      'x-gmail-sync-timestamp', stamp,
      'x-gmail-sync-signature', encode(extensions.hmac('gmail-sync:' || stamp, signing_secret, 'sha256'), 'hex')
    ),
    timeout_milliseconds := 180000
  ) INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION odeon_automation.dispatch_gmail_sync() FROM PUBLIC, anon, authenticated, service_role;

-- Temporary service-role-only provisioning bridge; drop immediately after use.
CREATE OR REPLACE FUNCTION public.configure_gmail_scheduler_secret(signing_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF length(signing_secret) < 32 OR signing_secret IS NULL THEN RAISE EXCEPTION 'Strong secret required'; END IF;
  SELECT id INTO secret_id FROM vault.secrets WHERE name = 'odeon_gmail_sync_secret';
  IF secret_id IS NULL THEN
    PERFORM vault.create_secret(signing_secret, 'odeon_gmail_sync_secret', 'Odeon Gmail scheduler HMAC key');
  ELSE
    PERFORM vault.update_secret(secret_id, signing_secret);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.configure_gmail_scheduler_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_gmail_scheduler_secret(text) TO service_role;