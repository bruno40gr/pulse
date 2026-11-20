import { notFound } from 'next/navigation'
import { bandWorkspaceEnabled } from '@/lib/band-feature'
import ProductionBandsWorkspace from '@/components/bands/ProductionBandsWorkspace'

export default function BandsPage() {
  if (!bandWorkspaceEnabled()) notFound()
  return <ProductionBandsWorkspace />
}