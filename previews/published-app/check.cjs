// TypeScript equivalent of the issuer-scoped aliases in next.config.ts.
const ts = require('typescript')
const path = require('node:path')
const integration = '/Users/brunowong/pulse-odeon-integration'
const published = '/Users/brunowong/pulse'
const config = ts.readConfigFile(path.join(__dirname, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, __dirname)
parsed.options.incremental = false
const host = ts.createCompilerHost(parsed.options)
host.resolveModuleNames = (names, containingFile) => names.map(name => {
  const local = ['app', 'components', 'lib'].some(folder => containingFile.startsWith(`${integration}/${folder}/`))
  const options = { ...parsed.options, paths: { '@/*': [`${local ? integration : published}/*`] } }
  return ts.resolveModuleName(name, containingFile, options, host).resolvedModule
})
const program = ts.createProgram(parsed.fileNames, parsed.options, host)
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.length) console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: file => file, getCurrentDirectory: () => __dirname, getNewLine: () => '\n',
}))
else console.log('TypeScript passed: published UI + integration V3, issuer-scoped dependencies')
process.exitCode = diagnostics.length ? 1 : 0