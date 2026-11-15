import { ParticipationPolicies } from '@/components/ui/ParticipationPolicies'
import { Button } from '@/components/ui/Button'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Switch } from '@/components/ui/Switch'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { RadioOptionGroup } from '@/components/ui/RadioOptionGroup'
import { WeekdayToggleGroup } from '@/components/ui/WeekdayToggleGroup'
import { colors, spacing, typography } from '@/lib/tokens'
import type { AcademySettings } from '@/beta-source/lib/academy-explorer'
import { eventParticipantQuestions, eventQuestions, eventHasMultipleSessions, eventAgeBounds, eventAges, eventIsPaid, eventPaymentTiming, eventSessionPrice, eventScheduleMode, eventTypeScheduleMode, updateEventSchedule, type ExplorerEvent } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '../school-setup/setup-content'
import ServiceImageSection from '../school-setup/ServiceImageSection'
import styles from './explorer.module.css'

export default function EventFields({ event, academy, section, updateEvent, embedded = false, staff = [], locations = [] }: { event: ExplorerEvent; academy: AcademySettings; section: string; embedded?: boolean; staff?: SetupRecord[]; locations?: SetupRecord[]; updateEvent: (change: Partial<ExplorerEvent>) => void }) {
  const panelStyle = embedded ? { border: 0, padding: 0 } : undefined
  const schedule = event.dailySchedule || { days: [], from: '', to: '' }
  const type = academy.eventTypes.find(type => type.id === event.typeId)
  const singleDay = eventScheduleMode(event) === 'single'
  const changeEventSchedule = (change: Partial<ExplorerEvent>) => updateEvent(updateEventSchedule(event, change))
  const rooms = locations.find(location => location.values.name === event.location)?.rooms || []
  const changeSchedule = (change: Partial<typeof schedule>) => {
    const next = { ...schedule, ...change }
    changeEventSchedule({ dailySchedule: next })
  }
  const questions = eventParticipantQuestions
  const multipleSessions = eventHasMultipleSessions(event)
  const paid = eventIsPaid(event)
  return <>
    {section === 'details' && <>
      <DenseSectionPanel style={panelStyle} title="Overview" headingLevel="h2"><div className={styles.stack}>
        <RadioOptionGroup label="Event type" value={event.typeId || ''} options={academy.eventTypes.filter(type => type.enabled || type.id === event.typeId).map(type => ({ id: type.id, label: type.name, description: type.id === 'event-type-0' && academy.kind === 'music' ? 'A themed program over one or more days, often during a school break.' : type.description }))} onChange={typeId => {
          const selected = academy.eventTypes.find(type => type.id === typeId)
          changeEventSchedule({ typeId, scheduleMode: eventTypeScheduleMode(selected?.name || '') })
        }} />
        <Input label="Event name" value={event.name} onChange={e => updateEvent({ name: e.target.value })} />
        <Textarea label="Description" value={event.description} onChange={e => updateEvent({ description: e.target.value })} />
        <Select label="Location" value={event.location} disabled={locations.length === 1} onChange={e => updateEvent({ location: e.target.value, activities: event.activities.map(activity => ({ ...activity, room: '', rooms: [], multipleRooms: false })) })}><option value="">Choose a location</option>{!locations.some(location => location.values.name === event.location) && event.location && <option>{event.location}</option>}{locations.map(location => <option key={location.id} value={location.values.name}>{location.values.name}</option>)}</Select>
        {type && <section aria-labelledby={`event-schedule-${event.id}`} style={{ display: 'grid', gap: spacing.lg, marginTop: spacing.sm }}>
          <div id={`event-schedule-${event.id}`}><SectionTitle as="h3" variant="card" style={{ marginBottom: 0 }}>Event schedule</SectionTitle></div>
          {/workshop/i.test(type.name) && <Switch label="Runs over multiple days" checked={!singleDay} onChange={e => changeEventSchedule({ scheduleMode: e.target.checked ? 'multiple' : 'single' })} />}
          {singleDay ? <Input label="Event date" type="date" value={event.start} onChange={e => changeEventSchedule({ start: e.target.value })} /> : <>
            <FieldGrid><Input label="Start date" type="date" value={event.start} onChange={e => changeEventSchedule({ start: e.target.value })} /><Input label="End date" type="date" min={event.start} value={event.end} onChange={e => changeEventSchedule({ end: e.target.value })} /></FieldGrid>
            <WeekdayToggleGroup value={schedule.days} onChange={days => changeSchedule({ days })} />
          </>}
          <FieldGrid><Input label="Start time" type="time" value={schedule.from} onChange={e => changeSchedule({ from: e.target.value })} /><Input label="End time" type="time" value={schedule.to} onChange={e => changeSchedule({ to: e.target.value })} /></FieldGrid>

        </section>}
      </div></DenseSectionPanel>
      <ServiceImageSection embedded={embedded} eventImage name={event.name} value={event.image} onChange={image => updateEvent({ image })} />
    </>}
    {section === 'activities' && <>
      <DenseSectionPanel style={panelStyle} title="Event details" headingLevel="h2" actions={multipleSessions ? <Button variant="secondary" onClick={() => updateEvent({ activities: [...event.activities, { id: crypto.randomUUID(), name: '', ages: '', capacity: 12, teacher: '', room: '', schedule: '' }] })}>Add session</Button> : undefined}>
        <Switch label="This event has multiple sessions" description="For example, a multi-day summer camp with five different activities running at the same time." checked={multipleSessions} onChange={e => updateEvent({ multipleSessions: e.target.checked, signup: e.target.checked ? event.signup : 'Whole event', activities: e.target.checked ? event.activities : [{ ...event.activities[0], name: 'Whole event' }] })} />
      </DenseSectionPanel>
      {event.activities.map((activity, index) => {
        const ages = eventAgeBounds(activity.ages)
        const change = (values: Partial<typeof activity>) => updateEvent({ activities: event.activities.map(item => item.id === activity.id ? { ...item, ...values } : item) })
        return <DenseSectionPanel headingLevel="h3" style={{ ...panelStyle, ...(multipleSessions && index > 0 ? { borderTop: `1px solid ${colors.border}`, paddingTop: spacing.lg } : {}) }} key={activity.id} title={multipleSessions ? `Session ${index + 1}` : undefined} actions={multipleSessions && event.activities.length > 1 && <Button variant="ghost" onClick={() => {
          const remaining = event.activities.filter(item => item.id !== activity.id)
          updateEvent({ activities: remaining.map(item => remaining.length === 1 && !item.name.trim() ? { ...item, name: 'Whole event' } : item) })
        }}>Remove session</Button>}><div className={styles.stack}>
          {multipleSessions && <Input label="Session name" value={activity.name} onChange={e => change({ name: e.target.value })} />}
          <FieldGrid><Input label="Minimum age" type="number" min={0} step={1} placeholder="No minimum" value={ages.minimum} onChange={e => { if (e.target.value === '' || (Number.isInteger(Number(e.target.value)) && Number(e.target.value) >= 0)) change({ ages: eventAges(e.target.value, ages.maximum) }) }} /><Input label="Maximum age" type="number" min={0} step={1} placeholder="No maximum" value={ages.maximum} onChange={e => { if (e.target.value === '' || (Number.isInteger(Number(e.target.value)) && Number(e.target.value) >= 0)) change({ ages: eventAges(ages.minimum, e.target.value) }) }} /></FieldGrid>
          <Input label="Capacity" type="number" min={1} step={1} value={activity.capacity} onChange={e => change({ capacity: Number(e.target.value) })} />
          <Select label="Teacher or staff" value={activity.teacher} onChange={e => change({ teacher: e.target.value })}><option value="">Choose teacher or staff</option>{activity.teacher && !staff.some(person => person.values.name === activity.teacher) && <option>{activity.teacher}</option>}{staff.map(person => <option key={person.id} value={person.values.name}>{person.values.name}</option>)}</Select>
          <Switch label="Use multiple rooms" checked={!!activity.multipleRooms} onChange={e => change({ multipleRooms: e.target.checked, rooms: e.target.checked ? activity.rooms?.length ? activity.rooms : [activity.room] : [activity.rooms?.[0] || activity.room], room: activity.rooms?.[0] || activity.room })} />
          {(activity.multipleRooms ? activity.rooms?.length ? activity.rooms : [activity.room] : [activity.room]).map((roomName, roomIndex, assigned) => <div key={roomIndex} className={styles.selectorAction}>
            <Select label={activity.multipleRooms ? `Room ${roomIndex + 1}` : 'Room'} value={roomName} onChange={e => { const next = [...assigned]; next[roomIndex] = e.target.value; change({ rooms: next, room: next[0] }) }}><option value="">Choose a room</option>{roomName && !rooms.some(room => room.name === roomName) && <option>{roomName}</option>}{rooms.map(room => <option key={room.id} value={room.name} disabled={assigned.includes(room.name) && room.name !== roomName}>{room.name}</option>)}</Select>
            {activity.multipleRooms && assigned.length > 1 && <Button variant="ghost" aria-label={`Remove room ${roomIndex + 1}`} onClick={() => { const next = assigned.filter((_, i) => i !== roomIndex); change({ rooms: next, room: next[0] }) }}>Remove room</Button>}
          </div>)}
          {activity.multipleRooms && <Button variant="secondary" onClick={() => change({ rooms: [...(activity.rooms?.length ? activity.rooms : [activity.room]), ''] })}>Add room</Button>}
        </div></DenseSectionPanel>
      })}
    </>}
    {section === 'registration' && <DenseSectionPanel style={panelStyle} title="Pricing" headingLevel="h2"><div className={styles.stack}>
      <div style={{ width: '100%', maxWidth: 220 }}><Input label="Price (USD)" hint="Total per student; enter 0 for a free event." type="number" min={0} value={event.price} onChange={e => updateEvent({ price: e.target.value })} /></div>
      <div style={{ maxWidth: 620, display: 'grid', gap: spacing.lg }}>
        {paid && <>
          <div>
            <RadioOptionGroup label="Payment option" value={event.payment === 'Deposit' ? 'Deposit' : 'Full payment'} options={[{ id: 'Full payment', label: 'Pay upfront' }, { id: 'Deposit', label: 'Require a deposit', description: 'Applied toward the total, not an additional charge.' }]} onChange={payment => updateEvent({ payment })} />
            {event.payment === 'Deposit' && <div style={{ maxWidth: 220, marginTop: spacing.sm }}><Input label="Deposit (USD)" type="number" min={0} value={event.deposit} onChange={e => updateEvent({ deposit: e.target.value })} /></div>}
          </div>
          <div>
            {multipleSessions && <Switch label="Allow payment by session" checked={event.signup !== 'Whole event'} onChange={e => updateEvent({ signup: e.target.checked ? 'Sessions' : 'Whole event' })} />}
            {event.signup !== 'Whole event' && <div style={{ maxWidth: 220, marginTop: spacing.sm }}><Input label="Price per session (USD)" type="number" min={0} value={eventSessionPrice(event)} readOnly /></div>}
          </div>
        </>}
        <Switch label={paid ? 'Require staff approval before payment' : 'Require staff approval'} description={event.approval ? eventPaymentTiming(event) : undefined} checked={event.approval} onChange={e => updateEvent({ approval: e.target.checked })} />
        {paid ? <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>
          <span style={{ ...typography.label, color: colors.text }}>Payment methods</span>
          <p style={{ margin: `${spacing.xs} 0 0` }}>{(event.paymentMethods || ['Card']).join(', ') || 'No payment methods enabled'}</p>
        </div> : <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>No payment is due.</p>}
      </div>
    </div></DenseSectionPanel>}
    {section === 'policies' && <DenseSectionPanel style={panelStyle} title="Policies & forms" headingLevel="h2"><div className={styles.stack}>
      <ParticipationPolicies agreements={[{ id: event.id, title: 'Participation agreement', content: event.waiver }]} onChange={(_id, waiver) => updateEvent({ waiver })} />
      <fieldset style={{ border: 0, margin: 0, padding: 0, maxWidth: 480 }}><legend style={{ ...typography.label, padding: 0, marginBottom: spacing.sm }}>Ask participants for</legend><div style={{ display: 'grid', gap: spacing.sm }}>{questions.map(question => <Switch key={question} label={question} checked={eventQuestions(event).includes(question)} onChange={e => {
        const selected = eventQuestions(event)
        const next = e.target.checked ? [...selected, question] : selected.filter(value => value !== question)
        updateEvent({ questionChoices: next, questions: next.join('; ') })
      }} />)}</div></fieldset>
    </div></DenseSectionPanel>}
  </>
}
