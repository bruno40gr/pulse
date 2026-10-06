# Private backup preparation — not live authorization

## What is prepared

`scripts/crm-consolidation/backup-private.cjs` is an explicit read-only export CLI. It does not load `.env`, accept passwords as arguments, restore data, or change production settings. It accepts a named project's direct database host/user or a Supabase session-pooler host with user `postgres.PROJECT_REFERENCE`, database `postgres`, port 5432, and TLS `verify-full` with a private CA certificate file. Transaction-pooler port 6543 is refused. Do not weaken TLS if connectivity or certificate verification fails. Session support is configuration-tested, not live-connection-tested.

It runs `pg_dump --format=custom` for either project. With purpose `crm`, it also obtains the selected-table JSON snapshot. With purpose `main`, it skips that snapshot because the CRM tables are not present yet. It saves a manifest with file sizes, SHA-256 digests, server version, and snapshot counts. It suppresses subprocess errors rather than exposing SQL, records, or credentials. On failure, the private run directory may remain incomplete and must not be treated as a successful backup.

**Live execution has not been tested or authorized.** Only configuration refusal guards and private artifact handling were tested without network access. A separate Docker test exercised actual PostgreSQL dump/restore with synthetic data. Do not mistake that for a restored production backup.

## Security requirements before asking for access

- Confirm disk encryption and a non-shared/non-cloud-synced private directory outside repositories. Code refuses common cloud directory names but cannot prove encryption or detect every sync agent.
- Directory permissions must be 0700; configuration, password file, and certificate must be owner-only (0600 recommended), owned by the current user, with no symlinked path. Existing artifact filenames are never overwritten.
- Database password goes in a private PostgreSQL password file, not JSON config, shell arguments, chat, or Git. Prepare its exact entry interactively with the owner when execution is approved; never print it.
- Obtain the server CA certificate through the project dashboard. Do not invent a certificate or disable server verification.
- Install/locate trusted native PostgreSQL client binaries compatible with the server. The runner does not download or select them automatically. No binaries or live connection details have been set up yet.
- Confirm project reference and allow read-only export explicitly. Authorizing one project does not authorize the other or authorize any live writes.

## Private configuration shape

Create this **outside the repository** only after agreeing access handling. This is a shape illustration, not a usable connection file:

```json
{
  "purpose": "crm",
  "projectRef": "PROJECT_REFERENCE",
  "host": "db.PROJECT_REFERENCE.supabase.co",
  "port": 5432,
  "database": "postgres",
  "user": "postgres",
  "passfile": "/absolute/private/path/password-file",
  "sslrootcert": "/absolute/private/path/server-ca.crt",
  "binDirectory": "/absolute/path/to/postgresql/bin",
  "outputDirectory": "/absolute/private/path/backups"
}
```

For the main database, set purpose to `main` and its own matching project/connection details. No owner credentials should be posted in chat.

Owner supplied CRM session details: host `aws-0-us-west-2.pooler.supabase.com`, port 5432, database `postgres`, user `postgres.xxyncvaulboqytovgfrh`. No password was supplied; owner is unsure whether it is saved. No connection attempt has been made. For session mode use these dashboard-provided host/user values rather than the direct host/user shown in the shape illustration. Locate the password privately before considering a separately approved reset; database passwords and service-role API keys are different credentials.

Execution syntax, **only after explicit live export approval**:

```sh
node /Users/brunowong/pulse/scripts/crm-consolidation/backup-private.cjs /absolute/private/config.json --authorize-read-only PROJECT_REFERENCE
```

## Limits and remaining gates

- This is a single-database logical archive, not a full hosted-service backup: cluster roles, dashboard/Auth configuration, Storage file contents, networking, and secrets are not backed up by this tool.
- Hosted managed schemas/extensions may require compatible roles/extensions and a Supabase-compatible local stack to restore. The synthetic plain-PostgreSQL restore does not establish main-project recovery. Inspect backup scope and prove each real archive restores before declaring recovery covered.
- The dump and selected-table snapshot use separate consistent transactions; their contents can differ when writes occur. Neither is the final migration snapshot until writers are coordinated.
- File digests detect content changes; files remain plaintext and digests are not encryption or proof of authenticity.
- Snapshot validation is not a comparison of live schema definitions. Fresh schema/API/grant checks remain required.
- Production writer coordination and reverse reconciliation after destination writes are not implemented. No live cutover can proceed yet.

## Verified local tests

From `/Users/brunowong/pulse`:

```sh
node --test scripts/crm-consolidation/private-artifacts.test.cjs
node scripts/crm-consolidation/rehearse-transfer.cjs
```

Tests cover private permissions, overwrite/path/symlink/repository/cloud-path refusal, explicit project authorization guards, secret-in-config refusal, binary archive integrity, synthetic full-record restore, restored triggers/RLS/grants, and new inquiry behavior. Temporary synthetic files and Docker volumes are removed; this is not a secure-erasure guarantee for real records.