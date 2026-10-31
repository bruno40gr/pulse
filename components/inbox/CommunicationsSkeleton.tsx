'use client'

import { ResponsiveDataTable } from '@/components/ui/DataGridTable'

/** Match the communications list geometry rather than profile-card loading blocks. */
export function CommunicationsSkeleton() {
  return <div role="status" aria-label="Loading communications" aria-busy="true">
    <ResponsiveDataTable rows={[]} getRowKey={() => ''} loading skeletonRows={8}
      ariaLabel="Communications" minDesktopWidth={360} alignToSelectionInset stickyHeaderOffset={0} emptyContent=""
      columns={[
        { id: 'name', header: 'Name', width: 'minmax(220px, 2fr)', render: () => null },
        { id: 'time', header: 'Last contacted', width: 'minmax(180px, 1fr)', render: () => null },
      ]} />
  </div>
}