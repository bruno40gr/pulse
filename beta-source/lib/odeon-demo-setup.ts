import { createOdeonDemo, demoHours, demoServices } from './odeon-demo'
import { createSetupData, normalizePricing, type SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'
import { schedulingDefaults } from './academy-scheduling-policy'
import { demoRoomNames } from './odeon-demo-rooms'

/** Adapter keeps the existing onboarding editor and the public sandbox on one seed. */
export function createDemoSetup(): Record<string, SetupRecord[]> {
  const data = createSetupData('configured'), demo = createOdeonDemo()
  data.school[0].values = { ...data.school[0].values, name: 'Headliner Music Academy', email: 'hello@headliner.example.invalid', phone: '202-555-0100' }
  data.services = demoServices.map(service => ({ id: service.id, values: { name: service.name, capacity: service.format === 'group' ? '8' : '1', durations: ['tiny', 'rockers'].includes(service.id) ? '45' : service.format === 'private' ? '30, 45, 60' : String(service.minutes), formats: JSON.stringify([service.format]), levelIds: '["level1","level2","level3"]', scheduling: '["Recurring appointments"]', planIds: JSON.stringify([service.format === 'private' ? 'demo-private' : 'demo-group']) } }))
  data.plans = [4000, 3500].map((price, index) => ({ id: index === 0 ? 'demo-private' : 'demo-group', values: normalizePricing({ kind: 'Subscription', basis: 'Per scheduled lesson', price: String(price / 100), durationPrices: JSON.stringify([{ minutes: index === 0 ? 30 : 45, price: String(price / 100) }]), cadence: 'Monthly', first: 'Remaining scheduled lessons', visits: '1', fee: '0', deposit: '0' }) }))
  data.locations = [{ id: 'studio', values: { name: 'Headliner Music Academy', address: 'Sample studio address', city: 'Rocklin', state: 'CA', postal: '95765' }, rooms: [...new Map(demo.sessions.map(session => [session.room, { id: session.room, name: session.room, capacity: String(session.capacity), serviceIds: demo.sessions.filter(item => item.room === session.room).map(item => item.serviceId) }])).values()] }]
  data.teachers = demo.teachers.map(teacher => ({ id: teacher.id, values: { name: teacher.name, email: teacher.email, phone: '202-555-0100', assignments: JSON.stringify(teacher.serviceIds.map(serviceId => ({ serviceId, maxLevel: 3 }))), availability: JSON.stringify(teacher.days.map(day => { const hours = demoHours.find(item => item.day === day)!; return { id: `${teacher.id}:${day}`, day: day - 1, from: Number(hours.from.slice(0, 2)) * 60, to: Number(hours.to.slice(0, 2)) * 60 } })), service: teacher.serviceIds[0], location: 'studio', days: teacher.days.map(day => demoHours.find(hours => hours.day === day)!.label).join(', '), from: '12:00', to: '21:00', levelIds: '["level1","level2","level3"]', levels: 'Level 1, Level 2, Level 3', saturday: teacher.days.includes(6) ? '09:00–15:00' : 'Not available' } }))
  data.locations[0].rooms = demoRoomNames.map(name => {
    const sessions = demo.sessions.filter(session => session.room === name)
    return { id: name, name, capacity: String(Math.max(1, ...sessions.map(session => session.capacity))), serviceIds: [...new Set(sessions.map(session => session.serviceId))] }
  })
  data.roomRoster = [{ id: 'room-roster', values: { version: '1' } }]
  data.policies[0].values = { ...data.policies[0].values, ...schedulingDefaults, closure: '', start: '', end: '' }
  return upgradeDemoBookingSetup(data)
}

/** Add only missing mock service/configuration records once. Never restore tester deletions. */
export function upgradeDemoBookingSetup(data: Record<string, SetupRecord[]>) {
  if (data.bookingConfiguration?.[0]?.values.version === '2') return data
  if (data.bookingConfiguration?.[0]?.values.version === '1') return upgradeDemoRoomActivities(data)
  const additional: SetupRecord[] = [
    { id: 'demo-studio-hire', values: { name: 'Studio booking', bookingKind: 'room', durations: '30, 60, 90, 120', formats: '[]', levelIds: '[]', scheduling: '["Single appointments"]', planIds: '[]' } },
    { id: 'demo-rehearsal-space', values: { name: 'Band rehearsal space', bookingKind: 'rehearsal', durations: '', formats: '[]', levelIds: '[]', scheduling: '["Single appointments"]', planIds: '[]' } },
    { id: 'demo-event-space', values: { name: 'Event space', bookingKind: 'event', durations: '', formats: '[]', levelIds: '[]', scheduling: '["Single appointments"]', planIds: '[]' } },
  ]
  const services = [...(data.services || []), ...additional.filter(service => !data.services?.some(item => item.id === service.id))]
  const policy = data.policies?.length ? data.policies.map(record => ({ ...record, values: { ...schedulingDefaults, ...record.values } })) : [{ id: 'policy', values: { name: 'School defaults', ...schedulingDefaults } }]
  return upgradeDemoRoomActivities({ ...data, services, policies: policy })
}

/** One-time demo metadata migration; later tester edits remain authoritative. */
function upgradeDemoRoomActivities(data: Record<string, SetupRecord[]>) {
  const services = (data.services || []).map(service => ['tiny', 'rockers', 'band'].includes(service.id) && !service.values.capacity ? { ...service, values: { ...service.values, capacity: '8' } } : service)
  const locations = (data.locations || []).map(location => ({ ...location, rooms: location.rooms?.map(room => ({ ...room, serviceIds: [...room.serviceIds, ...(/band|rehearsal/i.test(room.name) || room.name === 'Performance Room' ? ['demo-rehearsal-space', 'demo-event-space'] : [])] })) }))
  return { ...data, services, locations, bookingConfiguration: [{ id: 'booking-configuration', values: { version: '2' } }] }
}