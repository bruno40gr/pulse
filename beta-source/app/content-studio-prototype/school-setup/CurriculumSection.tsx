'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { BookOpen, FileText, Pencil, Plus } from 'lucide-react'
import { Button } from '@/beta-source/components/ui/Button'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { EmptyState } from '@/beta-source/components/ui/EmptyState'
import { FieldGrid } from '@/beta-source/components/ui/FieldGrid'
import { Input } from '@/beta-source/components/ui/Input'
import { Checkbox } from '@/beta-source/components/ui/Checkbox'
import { ResponsiveDataTable } from '@/beta-source/components/ui/DataGridTable'
import { SectionTitle } from '@/beta-source/components/ui/SectionTitle'
import { levelIds, validateMaterial, type SetupMaterial } from './setup-content'
import styles from './school-setup.module.css'

type Props = {
  levelNames: Record<string, string>
  enabledLevels: string[]
  materials: SetupMaterial[]
  onSave: (names: Record<string, string>, materials: SetupMaterial[], enabled: string[]) => void
  onDirty: (dirty: boolean) => void
}

export default function CurriculumSection({ levelNames, enabledLevels, materials, onSave, onDirty }: Props) {
  const [names, setNames] = useState<Record<string, string> | null>(null)
  const [material, setMaterial] = useState<SetupMaterial | null>(null)
  const [enabled, setEnabled] = useState<string[]>(enabledLevels)
  const scrollPosition = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (scrollPosition.current !== null) { window.scrollTo({ top: scrollPosition.current, behavior: 'instant' }); scrollPosition.current = null }
  }, [material])
  const [error, setError] = useState('')
  const currentNames = names || levelNames
  const levelsDirty = JSON.stringify(currentNames) !== JSON.stringify(levelNames) || JSON.stringify([...enabled].sort()) !== JSON.stringify([...enabledLevels].sort())
  const money = (cost: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cost))
  const cancel = () => { if (material) scrollPosition.current = window.scrollY; setNames(null); setEnabled([...enabledLevels]); setMaterial(null); setError(''); onDirty(false) }
  const editMaterial = (item?: SetupMaterial) => { scrollPosition.current = window.scrollY; setMaterial(item ? { ...item } : { id: '', name: '', cost: '0.00' }); setError(''); onDirty(false) }
  const upload = (file?: File) => {
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { setError('Choose a PDF under 10 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { const url = reader.result; if (typeof url === 'string') { setMaterial(current => current ? { ...current, fileName: file.name, fileUrl: url } : null); onDirty(true) } }
    reader.onerror = () => setError('The PDF could not be read.')
    reader.readAsDataURL(file)
  }
  const materialForm = material && <form id="curriculum-material" className={styles.materialEditor} noValidate onSubmit={event => {
    event.preventDefault()
    const message = validateMaterial(material)
    if (message) { setError(message); return }
    const saved = { ...material, id: material.id || crypto.randomUUID(), name: material.name.trim() }
    onSave(levelNames, material.id ? materials.map(item => item.id === material.id ? saved : item) : [...materials, saved], enabledLevels)
    cancel()
  }}>
    <div className={styles.materialEditorHeader}>
      <SectionTitle as="h3" variant="card">{material.id ? 'Edit material' : 'New material'}</SectionTitle>
      <div className={styles.headerActions}><Button type="button" size="sm" variant="secondary" onClick={cancel}>Cancel material</Button><Button type="submit" size="sm">Save material</Button></div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <FieldGrid><Input label="Book name" required value={material.name} onChange={event => { setMaterial({ ...material, name: event.target.value }); onDirty(true) }} /><Input label="Cost (USD)" required type="number" min={0} step="0.01" value={material.cost} onChange={event => { setMaterial({ ...material, cost: event.target.value }); onDirty(true) }} /></FieldGrid>
    <div className={styles.formSection}><Input label="PDF attachment (optional)" type="file" accept="application/pdf" hint="PDF, up to 10 MB." onChange={event => upload(event.target.files?.[0])} /></div>
    {material.fileUrl && <p className={styles.sectionDescription}><a href={material.fileUrl} target="_blank" rel="noopener noreferrer">{material.fileName}</a></p>}
  </form>
  return <div className={styles.serviceSections}>
    <p className={styles.sectionDescription}>Set the level names used throughout your school and keep books and PDFs in one reusable library. Choose materials for each level when editing a service.</p>
    <DenseSectionPanel title="Set up progression levels" headingLevel="h2" actions={levelsDirty ? <Button type="submit" form="curriculum-levels" size="sm">Save changes</Button> : undefined}>
      <form id="curriculum-levels" noValidate onSubmit={event => {
        event.preventDefault()
        if (!enabled.length) { setError('Enable at least one level.'); return }
        if (enabled.some(id => !currentNames[id]?.trim())) { setError('Enter a name for each enabled level.'); return }
        onSave(Object.fromEntries(Object.entries(currentNames).map(([key, value]) => [key, value.trim()])), materials, levelIds.filter(id => enabled.includes(id)))
        setNames(null); setEnabled(levelIds.filter(id => enabled.includes(id))); setError(''); onDirty(false)
      }}>
        {!material && error && <p role="alert" className={styles.error}>{error}</p>}
        <ResponsiveDataTable rows={levelIds} getRowKey={id => id} minDesktopWidth={0} mobileBreakpoint={0} ariaLabel="Progression levels" emptyContent={null} columns={[
          { id: 'level', header: 'Level', width: '120px', render: id => <Checkbox label={`Level ${levelIds.indexOf(id) + 1}`} disabled={Boolean(material)} checked={enabled.includes(id)} onChange={event => {
            const next = event.target.checked ? [...enabled, id] : enabled.filter(value => value !== id)
            setEnabled(next)
            onDirty(JSON.stringify([...next].sort()) !== JSON.stringify([...enabledLevels].sort()) || JSON.stringify(currentNames) !== JSON.stringify(levelNames))
          }} /> },
          { id: 'name', header: 'Name', width: 'minmax(0, 1fr)', render: id => <Input aria-label={`Level ${levelIds.indexOf(id) + 1} name`} disabled={Boolean(material) || !enabled.includes(id)} required={enabled.includes(id)} value={currentNames[id]} onChange={event => {
            const next = { ...currentNames, [id]: event.target.value }
            setNames(next)
            onDirty(JSON.stringify(next) !== JSON.stringify(levelNames) || JSON.stringify([...enabled].sort()) !== JSON.stringify([...enabledLevels].sort()))
          }} /> },
        ]} />
      </form>
    </DenseSectionPanel>
    <div>
    <DenseSectionPanel title="Books & materials" headingLevel="h2" actions={<Button type="button" size="sm" variant="secondary" disabled={levelsDirty || Boolean(material)} onClick={() => editMaterial()}><Plus size={14} aria-hidden="true" />Add material</Button>}>
      <p className={styles.sectionDescription}>Add the books and PDFs your school uses here. They’ll be available to select for each level when editing a service. Parents will see the required materials and their costs in the parent portal. Assigned materials will be automatically added to the invoice when a student starts each progression level.</p>
      {material && !material.id && materialForm}
        {materials.length ? <ul className={styles.libraryList} aria-label="School material library">{materials.map(item => <li key={item.id} className={styles.libraryRow}>
          <div className={styles.materialLine}>
          <div><span className={styles.materialLabel}>{item.fileName ? <FileText size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}<span>{item.name}, <span className={styles.materialCost}>{money(item.cost)}</span></span></span>{item.publisher && <small className={styles.fileMetadata}>{item.publisher}</small>}</div>
          <ControlButton type="button" kind="icon" disabled={levelsDirty || Boolean(material)} aria-label={`Edit ${item.name}`} onClick={() => editMaterial(item)}><Pencil size={15} aria-hidden="true" /></ControlButton>
          </div>
          {material?.id === item.id && materialForm}
         </li>)}</ul> : !material && <EmptyState variant="embedded" density="compact" icon={<BookOpen size={28} aria-hidden="true" />} title="No materials yet" description="Add books or PDFs here to make them available in every service." />}
    </DenseSectionPanel>
    </div>
  </div>
}
