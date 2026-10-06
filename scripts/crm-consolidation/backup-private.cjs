// Explicitly authorized READ-ONLY export only. No restore/import capability.
// Does not load .env or accept credentials in command arguments.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { privateDirectory, writeArtifact } = require('./private-artifacts.cjs');
const { importSql, tables } = require('./transfer.cjs');

function privateFile(file) {
  if (!path.isAbsolute(file) || fs.realpathSync(file) !== path.resolve(file)) {
    throw new Error('Absolute non-symlinked private file required');
  }
  privateDirectory(path.dirname(file));
  const stat = fs.statSync(file);
  if (!stat.isFile() || (stat.mode & 0o077) || stat.uid !== process.getuid()) {
    throw new Error('Owner-only private file required');
  }
  return file;
}

function validateConfig(config, authorizedRef) {
  const keys = ['purpose','projectRef','host','port','database','user','passfile','sslrootcert','binDirectory','outputDirectory'];
  if (!config || Object.keys(config).sort().join(',') !== keys.sort().join(',')) {
    throw new Error('Invalid configuration keys');
  }
  const direct = config.host === `db.${config.projectRef}.supabase.co` && config.user === 'postgres';
  const session = typeof config.host === 'string' &&
    /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(config.host) &&
    config.user === `postgres.${config.projectRef}`;
  if (!['crm','main'].includes(config.purpose) || !/^[a-z]{20}$/.test(config.projectRef) || authorizedRef !== config.projectRef ||
      !(direct || session) || config.port !== 5432 || config.database !== 'postgres') {
    throw new Error('Explicit project authorization/direct or session connection mismatch');
  }
  privateFile(config.passfile);
  privateFile(config.sslrootcert);
  privateDirectory(config.outputDirectory);
  if (!path.isAbsolute(config.binDirectory)) throw new Error('Absolute PostgreSQL binary directory required');
  for (const binary of ['psql','pg_dump','pg_restore']) {
    fs.accessSync(path.join(config.binDirectory, binary), fs.constants.X_OK);
  }
  return config;
}

function backup(config, authorizedRef) {
  validateConfig(config, authorizedRef);
  const directory = fs.mkdtempSync(path.join(config.outputDirectory, 'backup-'));
  fs.chmodSync(directory, 0o700);
  // Deliberately do not inherit PG* variables, PGPASSWORD, service settings, etc.
  const env = {
    PATH: config.binDirectory, LANG: 'C', PGHOST: config.host, PGPORT: String(config.port),
    PGDATABASE: config.database, PGUSER: config.user, PGPASSFILE: config.passfile,
    PGSSLMODE: 'verify-full', PGSSLROOTCERT: config.sslrootcert,
    PGGSSENCMODE: 'disable', PGCONNECT_TIMEOUT: '15', PGCLIENTENCODING: 'UTF8',
    PGOPTIONS: '-c default_transaction_read_only=on -c lock_timeout=10000',
  };
  function capture(binary, args, name, input) {
    const file = path.join(directory, name);
    const fd = fs.openSync(file, 'wx', 0o600);
    let result;
    try {
      result = spawnSync(path.join(config.binDirectory,binary), args, {
        input, env, stdio: ['pipe',fd,'ignore'], timeout: 600000,
      });
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    if (result.error || result.status !== 0) {
      // A partial archive is not a backup. Keep the private run directory for review.
      fs.unlinkSync(file);
      throw new Error('Export command failed; private run is incomplete (no raw errors logged)');
    }
    return file;
  }
  const psqlArgs = ['-X','-q','-t','-A','-w','-v','ON_ERROR_STOP=1'];
  const versionFile = capture('psql', psqlArgs, 'server-version.txt', 'SHOW server_version_num;');
  const version = fs.readFileSync(versionFile,'utf8').trim();
  if (!/^\d+$/.test(version)) throw new Error('Invalid server version result');
  const archive = capture('pg_dump', ['-w','--format=custom','--lock-wait-timeout=10s'], 'database.dump');
  // Validates archive readability, not restore success.
  const listing = spawnSync(path.join(config.binDirectory,'pg_restore'), ['--list',archive], {
    env, stdio: 'ignore', timeout: 60000,
  });
  if (listing.error || listing.status !== 0) throw new Error('Archive inventory validation failed');
  let snapshot;
  const files = [versionFile,archive];
  if (config.purpose === 'crm') {
    const snapshotFile = capture('psql', psqlArgs, 'crm-snapshot.json',
      fs.readFileSync(path.join(__dirname,'03-export-snapshot.sql'),'utf8'));
    try { snapshot = JSON.parse(fs.readFileSync(snapshotFile,'utf8')); }
    catch { throw new Error('Private snapshot parsing failed'); }
    importSql(snapshot); // Validate only; never save or execute generated import SQL.
    files.push(snapshotFile);
  }
  const artifacts = files.map(file => {
    const bytes = fs.readFileSync(file);
    return { name: path.basename(file), bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  writeArtifact(directory,'manifest.json', JSON.stringify({
    purpose: config.purpose, projectRef: config.projectRef, serverVersion: version, completedAt: new Date().toISOString(),
    scope: 'Single-database pg_dump archive; not roles, platform settings, or Storage objects',
    consistency: 'Archive and CRM snapshot are separate transactions; cutover requires writer coordination',
    restoreVerified: false, counts: snapshot ? Object.fromEntries(tables.map(t => [t,snapshot.tables[t].length])) : null, artifacts,
  },null,2));
  return directory;
}

if (require.main === module) {
  try {
    const [configFile, flag, ref, ...extra] = process.argv.slice(2);
    if (!configFile || flag !== '--authorize-read-only' || !ref || extra.length) {
      throw new Error('Usage: node backup-private.cjs PRIVATE_CONFIG --authorize-read-only PROJECT_REF');
    }
    privateFile(configFile);
    let config;
    try { config = JSON.parse(fs.readFileSync(configFile,'utf8')); }
    catch { throw new Error('Private configuration parsing failed'); }
    backup(config,ref);
    console.log('PASS: private read-only export completed. Restore verification still required.');
  } catch {
    console.error('STOP: export not completed. Check private configuration/access; no raw errors printed.');
    process.exitCode=1;
  }
}
module.exports = { privateFile, validateConfig };