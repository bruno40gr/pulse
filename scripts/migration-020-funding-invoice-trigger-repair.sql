-- Migration 020: Ensure funding invoice initialization runs exactly once.
--
-- Migration 018 installed `funding_invoices_initialize`. Migration 019 replaced
-- the trigger function but installed `funding_invoice_initialize` without
-- removing the earlier plural-named trigger. Because both triggers invoked the
-- same function, invoice inserts could create duplicate initial status and case
-- events. Keep one canonical trigger without modifying historical event rows.

BEGIN;

DROP TRIGGER IF EXISTS funding_invoices_initialize ON public.funding_invoices;
DROP TRIGGER IF EXISTS funding_invoice_initialize ON public.funding_invoices;

CREATE TRIGGER funding_invoice_initialize
AFTER INSERT ON public.funding_invoices
FOR EACH ROW EXECUTE FUNCTION public.odeon_initialize_funding_invoice();

COMMIT;