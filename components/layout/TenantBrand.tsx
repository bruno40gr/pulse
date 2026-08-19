'use client'

import { useEffect, useState } from 'react'
import { getActiveTenantId, getTenantBrand } from '@/lib/tenant'

interface TenantBrandProps {
  height?: number
  maxWidth?: number | string
  width?: string
}

export default function TenantBrand({ height = 24, maxWidth = '100%', width = '100%' }: TenantBrandProps) {
  const [brand, setBrand] = useState(() => getTenantBrand('00000000-0000-0000-0000-000000000001'))

  useEffect(() => {
    setBrand(getTenantBrand(getActiveTenantId()))
  }, [])

  return (
    <img
      src={brand.logoUrl}
      alt={`${brand.name} logo`}
      style={{
        height: `${height}px`,
        width,
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        objectFit: 'contain',
        display: 'block',
      }}
    />
  )
}