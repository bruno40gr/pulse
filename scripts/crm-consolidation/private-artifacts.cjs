// No network or credential handling. Store exports outside repositories.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function privateDirectory(directory) {
  if (!path.isAbsolute(directory)) throw new Error('Private directory must be absolute');
  const resolved = fs.realpathSync(directory);
  if (resolved !== path.resolve(directory)) throw new Error('Symlinked private path refused');
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory() || (stat.mode & 0o077) || stat.uid !== process.getuid()) {
    throw new Error('Directory must be owner-only (0700)');
  }
  for (let ancestor = resolved; ; ancestor = path.dirname(ancestor)) {
    if (fs.existsSync(path.join(ancestor, '.git'))) throw new Error('Repository output refused');
    if (path.dirname(ancestor) === ancestor) break;
  }
  if (/(?:^|\/)(?:Dropbox|OneDrive[^/]*|Google Drive|Mobile Documents|CloudStorage)(?:\/|$)/i.test(resolved)) {
    throw new Error('Known cloud-synced directory refused');
  }
  return resolved;
}

function writeArtifact(directory, name, data) {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) throw new Error('Invalid artifact name');
  const base = privateDirectory(directory);
  const file = path.join(base, name);
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  const disk = fs.readFileSync(file);
  const hash = value => createHash('sha256').update(value).digest('hex');
  if (hash(bytes) !== hash(disk)) throw new Error('Artifact integrity check failed');
  return { file, bytes: disk.length, sha256: hash(disk) };
}

module.exports = { privateDirectory, writeArtifact };