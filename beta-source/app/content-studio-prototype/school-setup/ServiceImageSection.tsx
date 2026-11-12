'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/beta-source/components/ui/Button'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { Input } from '@/beta-source/components/ui/Input'
import { serviceImages, suggestedServiceImages } from './service-images'
import styles from './school-setup.module.css'

export default function ServiceImageSection({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  const [error, setError] = useState('')
  const [browse, setBrowse] = useState(false)
  const request = useRef(0)
  const suggested = suggestedServiceImages(name)
  const images = browse || !suggested.length ? serviceImages : suggested
  const selected = serviceImages.find(image => image.src === value)
  const choose = (src: string) => { request.current++; setError(''); onChange(src) }
  const upload = (file?: File) => {
    if (!file) return
    const currentRequest = ++request.current
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size >= 5 * 1024 * 1024) { setError('Choose a PNG, JPEG or WebP image under 5 MB.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      if (request.current !== currentRequest || typeof reader.result !== 'string') return
      const src = reader.result
      const image = new window.Image()
      image.onload = () => { if (request.current === currentRequest) onChange(src) }
      image.onerror = () => { if (request.current === currentRequest) setError('This image could not be opened. Choose another file.') }
      image.src = src
    }
    reader.onerror = () => { if (request.current === currentRequest) setError('The image could not be read. Try another file.') }
    reader.readAsDataURL(file)
  }
  return <DenseSectionPanel title="Service image" headingLevel="h2" actions={value && <Button type="button" size="sm" variant="secondary" onClick={() => choose('')}>Remove image</Button>}>
    <p className={styles.sectionDescription}>Upload your own image or choose a royalty-free photo. Suggestions are based on the service name.</p>
    {value && <div className={styles.serviceImagePreview}><Image src={value} alt={`${name || 'Service'} image`} width={640} height={360} unoptimized />{selected && <a href={selected.source} target="_blank" rel="noopener noreferrer">Photo on Pexels</a>}</div>}
    <Input label="Upload service image" type="file" accept="image/png,image/jpeg,image/webp" hint="PNG, JPEG or WebP, under 5 MB." error={error || undefined} onChange={event => { upload(event.target.files?.[0]); event.target.value = '' }} />
    <div className={styles.materialEditorHeader}>
      <p className={styles.sectionDescription}>{!browse && suggested.length ? `Suggested for ${name}` : 'Royalty-free image library'}</p>
      {suggested.length > 0 && <ControlButton type="button" kind="link" onClick={() => setBrowse(!browse)}>{browse ? 'Show suggestions' : 'Browse all images'}</ControlButton>}
    </div>
    <div className={styles.serviceImageChoices} role="group" aria-label="Service image library">{images.map(image => <ControlButton key={image.id} type="button" kind="toggle" className={styles.serviceImageChoice} selected={value === image.src} aria-pressed={value === image.src} aria-label={`Use ${image.title}`} onClick={() => choose(image.src)}>
      <Image src={image.src} alt="" width={240} height={135} unoptimized /><span>{image.title}</span>
    </ControlButton>)}</div>
    <p className={styles.sectionDescription}>Photos from Pexels · <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">License</a></p>
  </DenseSectionPanel>
}