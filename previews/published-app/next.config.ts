import type { NextConfig } from 'next'

// Resolve the actual published components through the symlinks in this host.
const config: NextConfig = {
  devIndicators: false,
  experimental: { externalDir: true },
  webpack(config, { webpack }) {
    // Each source tree must retain its own dependency versions. In particular,
    // V3 uses newer enrollment models; the published table must not use them.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\//, (resource: { context: string; request: string }) => {
      const root = '/Users/brunowong/pulse-odeon-integration'
      if (['/app/', '/components/', '/lib/'].some(folder => resource.context.startsWith(root + folder))) {
        resource.request = `${root}/${resource.request.slice(2)}`
      }
    }))
    return config
  },
}
export default config