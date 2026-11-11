'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function TeacherPhoto({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [error, setError] = useState('')
  const request = useRef(0)
  return <div>
    {value && <Image src={value} alt="Teacher profile photo" width={88} height={88} unoptimized style={{ objectFit: 'cover', borderRadius: '50%' }} />}
    <Input label={value ? 'Replace profile photo' : 'Upload profile photo'} hint="PNG, JPEG or WebP, under 5 MB." type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
      const id = ++request.current
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size >= 5 * 1024 * 1024) { setError('Choose a PNG, JPEG or WebP photo under 5 MB.'); return }
      const reader = new FileReader(); setError('')
      reader.onload = () => {
        if (typeof reader.result !== 'string' || request.current !== id) return
        const src = reader.result, image = new window.Image()
        image.onload = () => { if (request.current === id) onChange(src) }
        image.onerror = () => { if (request.current === id) setError('This photo could not be opened.') }
        image.src = src
      }
      reader.onerror = () => { if (request.current === id) setError('This photo could not be read.') }
      reader.readAsDataURL(file)
    }} />
    {value && <Button type="button" variant="ghost" onClick={() => { request.current++; setError(''); onChange('') }}>Remove profile photo</Button>}
    {error && <p role="alert">{error}</p>}
  </div>
}