/* eslint-disable @typescript-eslint/no-require-imports -- Offline sample room migration checks. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('../security/synthetic-harness.cjs')
const h = createHarness()
const { demoRoomNames, upgradeDemoRoomNames } = h.load('beta-source/lib/odeon-demo-rooms.ts')
const { createDemoSetup } = h.load('beta-source/lib/odeon-demo-setup.ts')
const { createDemoWorkspace } = h.load('beta-source/lib/odeon-demo-workspace.ts')
const plain = value => JSON.parse(JSON.stringify(value))

test('the twelve supplied rooms appear once and every sample lesson has a configured room', () => {
  const setup = createDemoSetup(), snapshot = createDemoWorkspace()
  const rooms = setup.locations.flatMap(location => location.rooms)
  assert.deepEqual(plain(rooms.map(room => room.name)), plain(demoRoomNames))
  assert.equal(new Set(rooms.map(room => room.name)).size, 12)
  assert.ok(snapshot.data.lessons.every(lesson => rooms.some(room => room.name === lesson.room)))
  const performance = rooms.find(room => room.name === 'Performance Room')
  assert.ok(performance.serviceIds.includes('demo-rehearsal-space'))
  assert.ok(performance.serviceIds.includes('demo-event-space'))
})

test('saved sample rename preserves identities, configuration, custom names and booking references', () => {
  const snapshot = createDemoWorkspace()
  snapshot.data.lessons = [{ ...snapshot.data.lessons[0], room: 'Studio 1' }, { ...snapshot.data.lessons[1], room: 'Custom room' }]
  snapshot.data.calendarBookings = [{ id: 'booking', roomId: 'Early years room', roomName: 'Early years room' }]
  const setup = { locations: [{ id: 'studio', values: { name: 'School' }, rooms: [
    { id: 'Studio 1', name: 'Studio 1', capacity: '2', serviceIds: ['piano'] },
    { id: 'Studio 2', name: 'Custom room', capacity: '3', serviceIds: ['voice'] },
    { id: 'Keys classroom', name: 'Keys classroom', capacity: '8', serviceIds: ['tiny'] },
    { id: 'Early years room', name: 'Early years room', capacity: '10', serviceIds: ['rockers'] },
  ] }] }
  const before = JSON.stringify({ snapshot, setup })
  const next = upgradeDemoRoomNames(snapshot, setup)
  const rooms = next.setup.locations[0].rooms
  assert.equal(rooms[0].id, 'Studio 1')
  assert.equal(rooms[0].name, 'Carole King')
  assert.equal(rooms[1].name, 'Custom room')
  assert.equal(rooms.length, 3)
  assert.equal(rooms[2].name, 'Kids n Keys')
  assert.equal(rooms[2].capacity, '10')
  assert.deepEqual(plain(rooms[2].serviceIds), ['tiny', 'rockers'])
  assert.equal(next.snapshot.data.lessons[0].room, 'Carole King')
  assert.equal(next.snapshot.data.lessons[1].room, 'Custom room')
  assert.equal(next.snapshot.data.calendarBookings[0].roomId, 'Keys classroom')
  assert.equal(next.snapshot.data.calendarBookings[0].roomName, 'Kids n Keys')
  assert.equal(next.snapshot.data.lessons[0].id, snapshot.data.lessons[0].id)
  assert.equal(JSON.stringify({ snapshot, setup }), before, 'migration does not mutate the saved state')
  assert.equal(upgradeDemoRoomNames(next.snapshot, next.setup).snapshot, next.snapshot)
  assert.equal(upgradeDemoRoomNames(next.snapshot, next.setup).setup, next.setup)
})

test('live-school data is never renamed', () => {
  const snapshot = createDemoWorkspace(), setup = createDemoSetup()
  snapshot.data.demoSchool = false
  assert.equal(upgradeDemoRoomNames(snapshot, setup).snapshot, snapshot)
  assert.equal(upgradeDemoRoomNames(snapshot, setup).setup, setup)
})