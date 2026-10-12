'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/Input'
import styles from './studio.module.css'

type Place = { displayName?: string; formattedAddress?: string; fetchFields(options: { fields: string[] }): Promise<unknown> }
type PlacesLibrary = { PlaceAutocompleteElement: new (options: { includedRegionCodes: string[] }) => HTMLElement }
type MapsWindow = Window & { google?: { maps?: { importLibrary(name: string): Promise<PlacesLibrary> } }; pulsePlacesReady?: () => void }
let loading: Promise<PlacesLibrary> | undefined

function loadPlaces(key: string) {
  if (loading) return loading
  loading = new Promise<PlacesLibrary>((resolve, reject) => {
    const target = window as MapsWindow
    const ready = () => {
      if (!target.google?.maps) { reject(new Error('Places unavailable')); return }
      target.google.maps.importLibrary('places').then(resolve, reject)
    }
    if (target.google?.maps) { ready(); return }
    target.pulsePlacesReady = ready
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=pulsePlacesReady`
    script.async = true
    script.onerror = () => { loading = undefined; reject(new Error('Places unavailable')) }
    document.head.appendChild(script)
  })
  return loading
}

export default function LocationField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const change = useRef(onChange)
  change.current = onChange
  const [error, setError] = useState('')
  useEffect(() => {
    const key = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : undefined
    if (!key) return
    let active = true
    let widget: HTMLElement | undefined
    let selection = 0
    const selected = async (event: Event) => {
      const request = ++selection
      try {
        const place = (event as Event & { placePrediction: { toPlace(): Place } }).placePrediction.toPlace()
        await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })
        if (active && request === selection) { change.current([place.displayName, place.formattedAddress].filter(Boolean).join(' · ')); setError('') }
      } catch { if (active) setError('Could not retrieve this place. Enter the location below.') }
    }
    loadPlaces(key).then(library => {
      if (!active || !container.current) return
      widget = new library.PlaceAutocompleteElement({ includedRegionCodes: ['us'] })
      widget.setAttribute('aria-label', 'Search Google Places')
      widget.addEventListener('gmp-select', selected)
      widget.addEventListener('gmp-error', () => { if (active) setError('Place search is unavailable. Enter the location below.') })
      container.current.appendChild(widget)
    }).catch(() => { if (active) setError('Place search is unavailable. Enter the location below.') })
    return () => { active = false; widget?.removeEventListener('gmp-select', selected); widget?.remove() }
  }, [])
  return <div><label htmlFor="studio-location">Location</label><div className={styles.placeSearch} ref={container} /><Input id="studio-location" value={value} onChange={event => onChange(event.target.value)} />{error && <p role="alert" className={styles.errors}>{error}</p>}</div>
}