import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'
import type { DemoSnapshot } from './odeon-demo-upgrade'

/** User-supplied room roster. Legacy assignments below are sample-only, not a real timetable. */
export const demoRoomNames = ['Carole King', 'Control Room', 'Franz Liszt', 'Green Day', 'Kids n Keys', 'Maroon 5', 'Performance Room', 'Pink Floyd', 'Recording Studio', 'Rolling Stones', 'Stevie Wonder', 'Taylor Swift'] as const
const privateRooms = demoRoomNames.filter(name => name !== 'Kids n Keys' && name !== 'Performance Room')
const legacyRoomNames: Record<string, string> = {
  ...Object.fromEntries(privateRooms.map((name, index) => [`Studio ${index + 1}`, name])),
  'Keys classroom': 'Kids n Keys', 'Early years room': 'Kids n Keys', 'Band room': 'Performance Room',
}
export const demoRoomName = (name: string) => legacyRoomNames[name] || name

/** Rename only untouched sample rooms, retaining IDs and custom names. No live-school migration. */
export function upgradeDemoRoomNames(snapshot: DemoSnapshot, setup: Record<string, SetupRecord[]>) {
  if (!snapshot.data.demoSchool || setup.roomRoster?.[0]?.values.version === '1') return { snapshot, setup }
  const names = new Map<string, string>()
  const ids = new Map<string, string>()
  const locations = (setup.locations || []).map(location => {
    const rooms: NonNullable<SetupRecord['rooms']> = []
    for (const room of location.rooms || []) {
      const name = room.name === room.id ? demoRoomName(room.name) : room.name
      if (name !== room.name) names.set(room.name, name)
      const existing = rooms.find(item => item.name === name)
      if (existing && name !== room.name) {
        ids.set(room.id, existing.id)
        existing.serviceIds = [...new Set([...existing.serviceIds, ...room.serviceIds])]
        existing.capacity = String(Math.max(Number(existing.capacity), Number(room.capacity)))
      } else rooms.push({ ...room, name })
    }
    return { ...location, rooms }
  })
  const data = snapshot.data
  return {
    snapshot: { ...snapshot, data: { ...data,
      lessons: data.lessons.map(lesson => ({ ...lesson, room: names.get(lesson.room) || lesson.room })),
      calendarBookings: data.calendarBookings?.map(booking => ({ ...booking, roomId: ids.get(booking.roomId) || booking.roomId, roomName: booking.roomName ? names.get(booking.roomName) || booking.roomName : booking.roomName })),
    } },
    setup: { ...setup, locations, roomRoster: [{ id: 'room-roster', values: { version: '1' } }] },
  }
}