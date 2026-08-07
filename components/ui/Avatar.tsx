'use client'
import { useState } from 'react'
import { typography } from '@/lib/tokens'

const AVATAR_COLORS = ['#C8392B', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2']

interface AvatarProps {
  firstName: string
  lastName: string
  size?: number
  src?: string
  style?: React.CSSProperties
}

export function getAvatarColor(firstName: string, lastName: string): string {
  return AVATAR_COLORS[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % AVATAR_COLORS.length]
}

export function Avatar({ firstName, lastName, size = 36, src, style }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const color = getAvatarColor(firstName, lastName)

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        width={size}
        height={size}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div style={{
      width: size,
      height: size,
      background: color,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.38),
      fontWeight: 600,
      color: 'white',
      fontFamily: typography.fontSans,
      flexShrink: 0,
      userSelect: 'none',
      ...style,
    }}>
      {firstName[0]}{lastName[0]}
    </div>
  )
}
