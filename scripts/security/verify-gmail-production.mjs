import assert from 'node:assert/strict'

// Validate secrets where Vercel can read them, without logging their values.
if (process.env.VERCEL_ENV === 'production') {
  const env = process.env
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'CRM_SUPABASE_URL']) {
    assert.equal(env[name], 'https://jbrntsxmibfldocsuslt.supabase.co', `${name} must target Odeon production`)
  }
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY, 'Production service key is required')
  assert.ok(env.CRM_SUPABASE_SERVICE_ROLE_KEY === env.SUPABASE_SERVICE_ROLE_KEY, 'Database service-key aliases must match')
  assert.equal(env.PULSE_APP_URL?.replace(/\/$/, ''), 'https://app.headlinerma.com', 'Canonical Gmail callback origin must match Google OAuth')
  assert.ok(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET, 'Google OAuth credentials are required')
  assert.equal(Buffer.from(env.GMAIL_TOKEN_ENCRYPTION_KEY || '', 'base64').length, 32, 'Gmail requires a 32-byte encryption key')
  assert.ok(!env.GMAIL_SYNC_SECRET, 'Supervised pilot requires the scheduled worker to remain disabled')
  console.log('Gmail production configuration verified: database aliases, OAuth origin, encryption and disabled scheduler.')
}