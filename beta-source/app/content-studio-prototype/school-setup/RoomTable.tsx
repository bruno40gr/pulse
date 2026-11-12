'use client'

import { ResponsiveDataTable } from '@/beta-source/components/ui/DataGridTable'
import { EmptyState } from '@/beta-source/components/ui/EmptyState'
import type { SetupRecord, SetupRoom } from './setup-content'

export default function RoomTable({ rooms, services, locationName }: { rooms: SetupRoom[]; services: SetupRecord[]; locationName: string }) {
  return <ResponsiveDataTable
    ariaLabel={`${locationName} rooms`}
    rows={rooms}
    getRowKey={room => room.id}
    minDesktopWidth={560}
    mobileBreakpoint={0}
    emptyContent={<EmptyState variant="embedded" density="compact" title="No rooms yet" description="Add rooms to set their capacity and available services." />}
    columns={[
      { id: 'name', header: 'Room', width: 'minmax(140px, 1fr)', render: room => <strong>{room.name}</strong> },
      { id: 'capacity', header: 'Capacity', width: '90px', render: room => room.capacity },
      { id: 'services', header: 'Services', width: 'minmax(180px, 1.5fr)', render: room => room.allServices ? 'All services' : [...new Set(room.serviceIds.map(id => services.find(service => service.id === id)?.values.name).filter(Boolean))].join(', ') || 'No services assigned' },
      { id: 'link', header: 'Online link', width: '110px', render: room => room.conferenceUrl ? <a href={room.conferenceUrl} target="_blank" rel="noopener noreferrer">Open link</a> : '—' },
    ]}
  />
}