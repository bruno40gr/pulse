'use client'

import { useState } from 'react'
import { BookOpen, FileText, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Checkbox } from '@/components/ui/Checkbox'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { levelIds, defaultLevelNames, lessonFormats, schedulingChoices, selection, pricingSummary, type SetupCurriculum, type SetupMaterial, type SetupRecord } from './setup-content'
import styles from './school-setup.module.css'
import ServiceImageSection from './ServiceImageSection'

type Props = {
  values: Record<string, string>
  levelNames: Record<string, string>
  enabledLevels?: string[]
  curriculum: SetupCurriculum
  materials: SetupMaterial[]
  plans?: SetupRecord[]
  onValue: (key: string, value: string) => void
  onCurriculum: (curriculum: SetupCurriculum) => void
}

const money = (cost: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cost))

function MaterialLabel({ material }: { material: SetupMaterial }) {
  const Icon = material.fileName || material.fileUrl ? FileText : BookOpen
  const text = <><Icon size={17} aria-hidden="true" /><span>{material.name}, <span className={styles.materialCost}>{money(material.cost)}</span></span></>
  return material.fileUrl
    ? <a className={styles.materialLabel} href={material.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`${material.name}, ${money(material.cost)}, PDF`}>{text}</a>
    : <span className={styles.materialLabel}>{text}</span>
}

export default function ServiceEditor({ values, levelNames, enabledLevels = levelIds.slice(0, 3), curriculum, materials, plans = [], onValue, onCurriculum }: Props) {
  const [picker, setPicker] = useState<string | null>(null)
  const toggle = (key: string, id: string, checked: boolean) => {
    const selected = selection(values[key])
    onValue(key, JSON.stringify(checked ? [...selected, id] : selected.filter(value => value !== id)))
  }
  const attach = (id: string) => {
    if (!picker) return
    onCurriculum({ ...curriculum, [picker]: [...new Set([...(curriculum[picker] || []), id])] })
    setPicker(null)
  }
  const durations = [...new Set(['30', '45', '60', ...values.durations.split(',').map(value => value.trim()).filter(Boolean)])]

  return <div className={styles.serviceSections}>
    <section aria-label="Service details">
      <SectionTitle>Service name</SectionTitle>
      <FieldGrid columns={1}><Input label="Service name" required value={values.name} onChange={event => onValue('name', event.target.value)} /></FieldGrid>
    </section>
    <ServiceImageSection name={values.name} value={values.image || ''} onChange={value => onValue('image', value)} />
    <div className={styles.serviceSettings}>
      <section aria-label="Lesson lengths">
        <SectionTitle>Lesson length</SectionTitle>
        <div className={styles.stackedChoices}>{durations.map(duration => <Checkbox key={duration} label={`${duration} min`} checked={values.durations.split(',').map(value => value.trim()).includes(duration)} onChange={event => {
          const selected = values.durations.split(',').map(value => value.trim()).filter(Boolean)
          onValue('durations', (event.target.checked ? [...selected, duration] : selected.filter(value => value !== duration)).join(', '))
        }} />)}</div>
      </section>
      <section aria-label="Lesson formats">
        <SectionTitle>Lesson format</SectionTitle>
        <div className={styles.stackedChoices}>{lessonFormats.map(format => <Checkbox key={format.id} label={format.label} checked={selection(values.formats).includes(format.id)} onChange={event => toggle('formats', format.id, event.target.checked)} />)}</div>
      </section>
      <section aria-label="Scheduling">
        <SectionTitle>Scheduling</SectionTitle>
        <div className={styles.schedulingChoices}>{schedulingChoices.map(option => <Checkbox key={option.value} label={option.label} aria-label={option.label} description={option.description} checked={selection(values.scheduling).includes(option.value)} onChange={event => toggle('scheduling', option.value, event.target.checked)} />)}</div>
      </section>
    </div>
    <section aria-label="Pricing models">
      <SectionTitle>Pricing models</SectionTitle>
      <p className={styles.sectionDescription}>Choose the pricing models available for this service. Manage their prices and billing rules in Plans &amp; prices. The same model can be offered across multiple services.</p>
      {plans.length ? <div className={styles.stackedChoices}>{plans.map(plan => <Checkbox key={plan.id} label={plan.values.name} aria-label={plan.values.name} description={pricingSummary(plan.values)} checked={selection(values.planIds).includes(plan.id)} onChange={event => toggle('planIds', plan.id, event.target.checked)} />)}</div> : <EmptyState variant="embedded" density="compact" title="No pricing models yet" description="Create a model in Plans & prices, then select it here." />}
    </section>
    <section aria-label="Levels">
      <SectionTitle>Levels</SectionTitle>
      <div className={styles.records}>{enabledLevels.map(id => {
        const index = levelIds.indexOf(id)
        const name = levelNames[id] || defaultLevelNames[id]
        const offered = selection(values.levelIds).includes(id)
        const assigned = (curriculum[id] || []).flatMap(materialId => materials.find(item => item.id === materialId) || [])
        return <DenseSectionPanel key={id}
          title={<Checkbox label={<SectionTitle as="h3" style={{ marginBottom: 0 }}>{name}</SectionTitle>} checked={offered} onChange={event => toggle('levelIds', id, event.target.checked)} />}
          actions={offered ? <Button type="button" variant="secondary" size="sm" aria-label={`Add material to Level ${index + 1}`} aria-expanded={picker === id} onClick={() => setPicker(picker === id ? null : id)}><Plus size={16} aria-hidden="true" />Add material</Button> : undefined}>
          {offered && <div className={styles.levelMaterials}><FieldLabel>Books &amp; materials</FieldLabel>
          {assigned.length ? <ul className={styles.materialList} aria-label={`${name} materials`}>{assigned.map(item => <li className={styles.materialLine} key={item.id}>
            <MaterialLabel material={item} />
            <ControlButton type="button" kind="icon" aria-label={`Remove ${item.name} from ${name}`} onClick={() => onCurriculum({ ...curriculum, [id]: (curriculum[id] || []).filter(value => value !== item.id) })}><Trash2 size={16} aria-hidden="true" /></ControlButton>
          </li>)}</ul> : <EmptyState variant="embedded" density="compact" icon={<BookOpen size={28} aria-hidden="true" />} title="No materials selected" description="Add a book or PDF from the library for this level." />}
          {picker === id && offered && <section aria-label={`Level ${index + 1} material library`} className={styles.materialSearch}>
            <SearchSelect label="Search materials" closeLabel="Close material picker" options={materials.map(item => ({ value: item.id, label: `${item.name}, ${money(item.cost)} ${item.fileName || ''}`, content: <span className={styles.materialLabel}>{item.fileName ? <FileText size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}<span>{item.name}, <span className={styles.materialCost}>{money(item.cost)}</span></span></span>, disabled: (curriculum[id] || []).includes(item.id) }))} onSelect={attach} onClose={() => setPicker(null)} />
          </section>}
          </div>}
        </DenseSectionPanel>
      })}</div>
    </section>
  </div>
}
