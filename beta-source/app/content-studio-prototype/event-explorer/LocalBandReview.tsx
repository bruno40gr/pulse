'use client'

import { useEffect, useState } from 'react'
import DemoWorkspace from '@/beta-source/app/odeon-demo/DemoWorkspace'
import type { BandReviewData } from '@/lib/band-review-data'
import { getActiveTenantId } from '@/lib/tenant'

export default function LocalBandReview() {
  const [data, setData] = useState<BandReviewData>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/odeon-demo/band-review-data?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store', signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Band review unavailable'); return response.json() })
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [])
  if (failed) return <p role="alert">Could not load the local band review.</p>
  return data ? <DemoWorkspace bandReview={data} /> : <p role="status">Loading band review…</p>
}