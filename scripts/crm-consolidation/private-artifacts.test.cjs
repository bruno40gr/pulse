const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { privateDirectory, writeArtifact } = require('./private-artifacts.cjs');
const { privateFile, validateConfig } = require('./backup-private.cjs');

test('private artifacts: permissions, integrity, and refusal guards', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'odeon-artifacts-test-'));
  fs.chmodSync(dir, 0o700);
  try {
    const artifact = writeArtifact(dir, 'synthetic.dump', Buffer.from([0,1,255,10]));
    assert.equal(artifact.bytes, 4);
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
    assert.equal(fs.statSync(artifact.file).mode & 0o777, 0o600);
    assert.equal(privateFile(artifact.file),artifact.file);
    assert.throws(() => validateConfig({},'anything'), /configuration/);
    const config = { purpose: 'crm', projectRef: 'a'.repeat(20), host: 'db.'+'a'.repeat(20)+'.supabase.co',
      port: 5432, database: 'postgres', user: 'postgres', passfile: artifact.file,
      sslrootcert: artifact.file, binDirectory: '/nonexistent', outputDirectory: dir };
    assert.throws(() => validateConfig(config,'b'.repeat(20)), /authorization/);
    assert.throws(() => validateConfig({...config, host:'localhost'},config.projectRef), /authorization/);
    assert.throws(() => validateConfig({...config,password:'do-not-accept'},config.projectRef), /configuration/);
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin, { mode: 0o700 });
    for (const name of ['psql','pg_dump','pg_restore']) {
      fs.writeFileSync(path.join(bin,name),'#!/bin/sh\nexit 0\n',{ mode: 0o700 });
    }
    const session = {...config, binDirectory:bin,
      host:'aws-0-us-west-2.pooler.supabase.com',user:`postgres.${config.projectRef}`};
    assert.equal(validateConfig(session,config.projectRef),session);
    assert.equal(validateConfig({...config,binDirectory:bin},config.projectRef).host,config.host);
    assert.throws(() => validateConfig({...session,port:6543},config.projectRef), /authorization/);
    assert.throws(() => validateConfig({...session,user:'postgres.'+'b'.repeat(20)},config.projectRef), /authorization/);
    assert.throws(() => validateConfig({...session,host:session.host+'.evil.example'},config.projectRef), /authorization/);
    fs.chmodSync(artifact.file,0o644);
    assert.throws(() => privateFile(artifact.file), /Owner-only/);
    fs.chmodSync(artifact.file,0o600);
    assert.throws(() => writeArtifact(dir, 'synthetic.dump', 'overwrite'));
    assert.throws(() => writeArtifact(dir, '../escape', 'bad'));
    assert.throws(() => privateDirectory('.'));
    fs.chmodSync(dir, 0o755);
    assert.throws(() => privateDirectory(dir), /owner-only/);
    fs.chmodSync(dir, 0o700);
    const link = path.join(dir, 'link');
    fs.symlinkSync(dir, link);
    assert.throws(() => privateDirectory(link), /Symlinked/);
    fs.mkdirSync(path.join(dir, '.git'));
    assert.throws(() => privateDirectory(dir), /Repository/);
    fs.rmdirSync(path.join(dir, '.git'));
    const cloud = path.join(dir, 'Dropbox');
    fs.mkdirSync(cloud, { mode: 0o700 });
    assert.throws(() => privateDirectory(cloud), /cloud-synced/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});