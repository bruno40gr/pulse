/* eslint-disable @typescript-eslint/no-require-imports -- Offline timestamp formatting tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const domain = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib/message-timestamp.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: domain, Date })
const format = domain.formatMessageTimestamp
const now = new Date(2026, 10, 4, 10, 30, 30)
const stamp = (day, hour, minute, second = 0) => new Date(2026, 10, day, hour, minute, second).toISOString()

test('chat timestamps use moment, today, yesterday and exact dates without seconds', () => {
  assert.equal(format(stamp(4, 10, 30, 5), now), 'A moment ago')
  assert.equal(format(stamp(4, 9, 5, 42), now), 'Today · 09:05 AM')
  assert.equal(format(stamp(3, 14, 10, 35), now), 'Yesterday · 02:10 PM')
  assert.equal(format(stamp(2, 9, 5, 42), now), 'Nov 2, 2026 · 09:05 AM')
  assert.equal(format(stamp(4, 0, 0), now), 'Today · 12:00 AM')
  assert.equal(format(stamp(4, 12, 0), now), 'Today · 12:00 PM')
})

test('chat dates respect calendar boundaries and do not treat future messages as recent', () => {
  assert.equal(format(stamp(4, 10, 31), now), 'Today · 10:31 AM')
  assert.equal(format('invalid', now), '')
  const midnight = new Date(2026, 10, 1, 0, 1)
  assert.equal(format(new Date(2026, 9, 31, 23, 58).toISOString(), midnight), 'Yesterday · 11:58 PM')
})