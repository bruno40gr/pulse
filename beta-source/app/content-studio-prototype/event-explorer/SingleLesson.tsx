'use client'

import { useState } from 'react'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { availableGroupTrials, lessonTotal, type AcademySettings } from '@/beta-source/lib/academy-explorer'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import styles from './explorer.module.css'

export default function SingleLesson({ academy, people, onChange }: { academy: AcademySettings; people: ExplorerPerson[]; onChange: (value: AcademySettings) => void }) {
  const [format, setFormat] = useState('Individual')
  const [person, setPerson] = useState(people[0]?.id || '')
  const [groupId, setGroupId] = useState(academy.groups[0]?.id || '')
  const [date, setDate] = useState('2027-05-18')
  const [price, setPrice] = useState('40')
  const [discount, setDiscount] = useState('None')
  const saved = academy.singleLessons
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const group = academy.groups.find(item => item.id === groupId)
  const groupBookings = saved.filter(item => item.groupId === groupId && item.date === date)
  const remaining = group ? Math.max(0, group.capacity - group.memberIds.length - groupBookings.length) : 0
  const trialSlots = group ? Math.min(remaining, availableGroupTrials(group, groupBookings.filter(item => item.trial).length)) : 0
  let total: number | null = null
  try { total = lessonTotal(Number(price), discount === 'Trial discount' ? academy.trialDiscount : 0) } catch { /* Show validation on save. */ }
  function save() {
    if (!person || !date || !price.trim() || total === null) { setError('Choose a participant, date and valid price.'); return }
    if (format === 'Group' && (!group || remaining === 0 || discount === 'Trial discount' && trialSlots === 0)) { setError('No space is available for this single lesson.'); return }
    if (format === 'Group' && group?.memberIds.includes(person)) { setError('This participant is already a regular member of this group.'); return }
    if (saved.some(item => item.personId === person && item.date === date && item.groupId === (format === 'Group' ? groupId : 'individual'))) { setError('This participant already has this session booked.'); return }
    onChange({ ...academy, singleLessons: [...saved, { groupId: format === 'Group' ? groupId : 'individual', personId: person, date, trial: discount === 'Trial discount' }] }); setError(''); setNotice('Single lesson booked.')
  }
  return <>{notice && <Notice variant="success">{notice}</Notice>}{error && <Notice variant="error">{error}</Notice>}<DenseSectionPanel title="Single lesson" headingLevel="h2" actions={<Button onClick={save}>Book single lesson</Button>}><div className={styles.stack}><FieldGrid><Select label="Lesson format" value={format} onChange={event => setFormat(event.target.value)}><option>Individual</option><option>Group</option></Select><Select label="Participant" value={person} onChange={event => setPerson(event.target.value)}>{people.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></FieldGrid>{format === 'Group' && <><Select label="Existing group" value={groupId} onChange={event => setGroupId(event.target.value)}>{academy.groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><p className={styles.muted}>{remaining} spaces available · Up to {trialSlots} trial visitors · {group?.schedule}</p></>}<Input label="Session date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div></DenseSectionPanel><DenseSectionPanel title="Pricing & billing" headingLevel="h2"><div className={styles.stack}><FieldGrid><Input label="Lesson price (USD)" type="number" min={0} value={price} onChange={event => setPrice(event.target.value)} /><Select label="Discount" value={discount} onChange={event => setDiscount(event.target.value)}><option>None</option><option>Trial discount</option></Select></FieldGrid>{discount === 'Trial discount' && <p>Trial discount · {academy.trialDiscount}%</p>}<strong>Total · {total === null ? 'Check price' : `USD ${total.toFixed(2)}`}</strong></div></DenseSectionPanel></>
}
