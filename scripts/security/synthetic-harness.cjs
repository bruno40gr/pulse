/* Synthetic route execution: no .env loading, network, database, or provider access. */
/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in test runner executes these CommonJS fixtures directly. */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { webcrypto } = require('node:crypto')

const root = path.resolve(__dirname, '../..')
const HEAD = '00000000-0000-0000-0000-000000000001'
const DEMO = '00000000-0000-0000-0000-000000000002'

class SyntheticResponse extends Response {
  static next() { return new SyntheticResponse(null, { status: 200, headers: { 'x-synthetic-next': 'true' } }) }
  static redirect(url) { return new SyntheticResponse(null, { status: 307, headers: { location: String(url) } }) }
  static json(body, options) {
    return new SyntheticResponse(JSON.stringify(body), {
      ...options, headers: { 'content-type': 'application/json', ...options?.headers },
    })
  }
}

function createHarness() {
  const cache = new Map()
  let scenario = {}
  let queries = []
  function client(database) {
    return {
      async rpc(name, payload) {
        queries.push({ database, table: name, operation: 'rpc', filters: [], payload })
        return { data: scenario.rpcResults?.[name] ?? null, error: scenario.rpcErrors?.[name] || null }
      },
      from(table) {
        const filters = []
        let operation = 'select'
        let payload
        let single = false
        let limit
        let builder
        const result = () => {
          queries.push({ database, table, operation, filters: [...filters], payload })
          const error = scenario.errors?.[table] || null
          let data = structuredClone(scenario.fixtures?.[table] || [])
          if (operation === 'insert' || operation === 'upsert') {
            data = (Array.isArray(payload) ? payload : [payload]).map((row, i) => ({ id: `synthetic-${table}-${i}`, ...row }))
          } else {
            for (const [method, key, value] of filters) {
              if (method === 'eq') data = data.filter(row => row[key] === value)
              if (method === 'in') data = data.filter(row => value.includes(row[key]))
            }
          }
          if (limit !== undefined) data = data.slice(0, limit)
          if (single) data = data[0] || null
          return { data: error ? null : data, error, count: Array.isArray(data) ? data.length : 0 }
        }
        builder = new Proxy({}, {
          get(_, method) {
            if (method === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
            return (...args) => {
              if (['insert', 'upsert', 'update', 'delete'].includes(method)) {
                operation = method
                payload = args[0]
              }
              if (method === 'single' || method === 'maybeSingle') single = true
              if (method === 'limit') limit = args[0]
              filters.push([method, ...args])
              return builder
            }
          },
        })
        return builder
      },
      auth: { getUser: async () => ({ data: { user: scenario.authUser || null }, error: null }) },
    }
  }
  const primary = client('primary')
  const crm = client('crm')
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const loadedModule = { exports: {} }
    cache.set(file, loadedModule)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    const localRequire = id => {
      if (id === 'next/server') return { NextResponse: SyntheticResponse }
      if (id === '@/lib/supabase/admin') return { supabaseAdmin: primary }
      if (id === '@/lib/supabase/crm-admin') return { crmSupabaseAdmin: crm }
      if (id === '@supabase/ssr') return { createServerClient: () => primary }
      if (id === '@/lib/access') return {
        ...load(path.join(root, 'lib/access.ts')),
        getRequestActor: async () => scenario.actor || null,
      }
      if (id === '@anthropic-ai/sdk') return class {
        constructor() {
          this.messages = { create: async () => {
            if (!scenario.allowSyntheticAI) throw new Error('AI calls blocked in synthetic tests')
            return { content: [{ type: 'text', text: '{"insights":[],"body":"Synthetic copy"}' }] }
          } }
        }
      }
      // The installed parser is pure local code; no environment loading or IO.
      if (id === 'papaparse') return require('papaparse')
      if (id === 'twilio') {
        const provider = () => ({ calls: { create: async payload => {
          if (!scenario.allowSyntheticCalls) throw new Error('Provider calls blocked in synthetic tests')
          queries.push({ database: 'provider', table: 'calls', operation: 'create', filters: [], payload })
          return { sid: `CA${'2'.repeat(32)}`, status: 'queued' }
        } } })
        provider.validateRequest = require('twilio').validateRequest
        return provider
      }
      if (id.startsWith('@/') || id.startsWith('.')) {
        const candidate = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(file), id)
        for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
          if (fs.existsSync(candidate + suffix) && fs.statSync(candidate + suffix).isFile()) return load(candidate + suffix)
        }
      }
      throw new Error(`Blocked dependency: ${id}`)
    }
    const blockedFetch = () => { throw new Error('Network blocked in synthetic tests') }
    const context = vm.createContext({
      require: localRequire, module: loadedModule, exports: loadedModule.exports,
      process: { env: { PULSE_SESSION_SECRET: 'synthetic-only-key', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-only', ANTHROPIC_API_KEY: 'synthetic-only', ...scenario.env } },
      console: { log() {}, info() {}, warn() {}, error() {} }, fetch: blockedFetch,
      Request, Response, URL, TextEncoder, TextDecoder, crypto: webcrypto,
      btoa, atob, setTimeout, clearTimeout,
    })
    new vm.Script(code, { filename: file }).runInContext(context)
    return loadedModule.exports
  }
  return {
    load: file => load(path.join(root, file)),
    setScenario(input) { scenario = input; queries = [] },
    getQueries: () => queries,
    getWrites: () => queries.filter(query => query.operation !== 'select'),
  }
}

module.exports = { createHarness, HEAD, DEMO }