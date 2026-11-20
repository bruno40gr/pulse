import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { PageContainer } from '@/components/ui/PageContainer'

export default function DashboardLoading() {
  return <PageContainer><LoadingSkeleton label="Loading page" rows={4} /></PageContainer>
}
