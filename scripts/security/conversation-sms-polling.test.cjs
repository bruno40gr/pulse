/* eslint-disable @typescript-eslint/no-require-imports -- Execute actual component callbacks with synthetic requests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../../components/inbox/Conversations.tsx'), 'utf8')
const callback = source.slice(source.indexOf('  const loadSms ='), source.indexOf('  useEffect(() => {\n    if (!tenantId) return', source.indexOf('  const loadSms =')))
function loadHarness(requestJson) {
  const writes = []
  const context = { requestJson, tenantId: 'synthetic-tenant', campaignId: '', useCallback: fn => fn,
    setPeople: value => writes.push(['people', value]), setThreads: value => writes.push(['threads', value]), setLoadError: value => writes.push(['error', value]) }
  const code = ts.transpileModule(`${callback}\nglobalThis.load = loadSms`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(code, context)
  return { load: context.load, writes }
}
test('SMS directory and inbox share the poller abort signal; aborted results never update state', async () => {
  const requests = [], pending = []
  const h = loadHarness((url, options) => { requests.push({ url, options }); return new Promise(resolve => pending.push(resolve)) })
  const controller = new AbortController()
  const loading = h.load(controller.signal)
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request => request.options.signal === controller.signal))
  controller.abort()
  pending[0]({ people: [] }); pending[1]([])
  await loading
  assert.equal(h.writes.length, 0)
})
test('successful SMS refresh updates history and preserves email through its state updater', async () => {
  const h = loadHarness(async url => url.startsWith('/api/conversations') ? { people: [] } : [])
  await h.load(new AbortController().signal)
  assert.deepEqual(h.writes.map(([key]) => key), ['people', 'threads', 'error'])
  const email = { id: 'email', channel: 'email' }
  const update = h.writes.find(([key]) => key === 'threads')[1]
  assert.equal(update([email, { id: 'old-sms', channel: 'sms' }])[0], email)
  assert.equal(update([email]).length, 1)
})
test('every SMS refresh entry point uses the shared visible single-flight poller', () => {
  assert.match(source, /const refreshSms = useCallback\(\(\) => \{ smsPoller.current\?\.refresh\(\) \}, \[\]\)/)
  assert.match(source, /const poller = startVisiblePolling\(async signal =>/)
  assert.match(source, /try \{ await loadSms\(signal\) \}/)
  assert.match(source, /stopped = true; poller.stop\(\); smsPoller.current = null/)
  assert.match(source, /finally \{ if \(!stopped\) setLoading\(false\) \}/)
  assert.doesNotMatch(source, /setInterval\([^\n]*refreshSms|refreshSms\(\)\.catch/)
  assert.equal((source.match(/await loadSms\(/g) || []).length, 1)
})