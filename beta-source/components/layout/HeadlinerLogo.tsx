'use client'

/**
 * Headliner wordmark for white surfaces.
 *
 * Mirrors tenant_settings.logo_on_white_url for the Headliner tenant. Sandbox
 * surfaces read it from this constant because they make no operational API calls.
 */
export const HEADLINER_LOGO_ON_WHITE = 'https://res.cloudinary.com/diy08lj9x/image/upload/v1780713493/Asset_1_2x_a5hm0v.png'

export default function HeadlinerLogo({ height = 24, className }: { height?: number; className?: string }) {
  return (
    <img
      src={HEADLINER_LOGO_ON_WHITE}
      alt="Headliner"
      className={className}
      style={{ height, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
    />
  )
}
