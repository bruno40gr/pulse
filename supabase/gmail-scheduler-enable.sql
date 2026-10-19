-- Run only after the production worker and Vault key have been verified.
-- Named scheduling updates an existing job rather than creating duplicates.
SELECT cron.schedule('odeon-gmail-sync', '*/5 * * * *',
  'SELECT odeon_automation.dispatch_gmail_sync();');
SELECT cron.schedule('odeon-gmail-sync-history-cleanup', '23 3 * * *',
  $job$DELETE FROM cron.job_run_details
  WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname IN ('odeon-gmail-sync', 'odeon-gmail-sync-history-cleanup'))
  AND end_time < now() - interval '7 days';$job$);

-- Rollback automatic capture only (manual Sync and captured notes remain):
-- SELECT cron.unschedule('odeon-gmail-sync');
-- SELECT cron.unschedule('odeon-gmail-sync-history-cleanup');
-- DROP FUNCTION odeon_automation.dispatch_gmail_sync();
-- DELETE FROM vault.secrets WHERE name = 'odeon_gmail_sync_secret';
-- Do not drop shared extensions.