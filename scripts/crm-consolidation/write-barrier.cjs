// SQL builders only. No live execution, credentials, or connections.
// Not a queue: rejected requests need independent durable capture before use.
const { tables } = require('./transfer.cjs');
const trigger = 'odeon_crm_cutover_write_barrier';
function freezeSql() {
  return `BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE ${tables.map(t => `public.${t}`).join(',')} IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION public.odeon_crm_cutover_refuse_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $barrier$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'CRM cutover write barrier active';
END;
$barrier$;
REVOKE ALL ON FUNCTION public.odeon_crm_cutover_refuse_write() FROM PUBLIC;
${tables.map(t => `CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
  ON public.${t} FOR EACH STATEMENT EXECUTE FUNCTION public.odeon_crm_cutover_refuse_write();
ALTER TABLE public.${t} ENABLE ALWAYS TRIGGER ${trigger};`).join('\n')}
COMMIT;`;
}
function unfreezeSql() {
  return `BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE ${tables.map(t => `public.${t}`).join(',')} IN ACCESS EXCLUSIVE MODE;
${tables.map(t => `DROP TRIGGER ${trigger} ON public.${t};`).join('\n')}
DROP FUNCTION public.odeon_crm_cutover_refuse_write();
COMMIT;`;
}
module.exports = { freezeSql, unfreezeSql };