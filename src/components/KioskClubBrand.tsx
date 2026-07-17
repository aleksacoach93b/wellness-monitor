'use client'

import Image from 'next/image'
import type { KioskTheme } from '@/lib/kioskThemes'
import { kioskTextTokens } from '@/lib/kioskThemes'

interface KioskClubBrandProps {
  clubName?: string | null
  clubLogo?: string | null
  showBranding?: boolean
  kioskTheme: KioskTheme
  /** larger mark for password / splash screens */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  align?: 'left' | 'center'
}

export default function KioskClubBrand({
  clubName,
  clubLogo,
  showBranding = true,
  kioskTheme,
  size = 'md',
  className = '',
  align = 'left',
}: KioskClubBrandProps) {
  const name = clubName?.trim() || ''
  const logo = clubLogo?.trim() || ''
  if (!showBranding || (!name && !logo)) return null

  const text = kioskTextTokens(kioskTheme)
  const logoSize = size === 'lg' ? 88 : size === 'sm' ? 44 : 64
  const nameClass =
    size === 'lg'
      ? 'text-2xl sm:text-4xl'
      : size === 'sm'
        ? 'text-base sm:text-lg'
        : 'text-xl sm:text-2xl'

  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 ${
        align === 'center' ? 'justify-center text-center' : 'justify-start text-left'
      } ${className}`}
    >
      {logo ? (
        <div className="relative shrink-0">
          <div
            className="absolute -inset-2 rounded-full bg-gradient-to-br from-white/25 via-white/5 to-transparent blur-md"
            aria-hidden
          />
          <div
            className="relative overflow-hidden rounded-full border border-white/25 bg-white/10 shadow-2xl ring-1 ring-white/10"
            style={{ width: logoSize, height: logoSize }}
          >
            <Image
              src={logo}
              alt={name || 'Club logo'}
              width={logoSize}
              height={logoSize}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      ) : null}

      {name ? (
        <div className={`min-w-0 ${align === 'center' && !logo ? 'w-full' : ''}`}>
          <p
            className={`font-semibold tracking-[0.04em] ${text.textStrong} ${nameClass} drop-shadow-sm leading-tight truncate`}
          >
            {name}
          </p>
          <div
            className={`mt-1.5 h-0.5 rounded-full bg-gradient-to-r from-white/50 via-white/20 to-transparent ${
              align === 'center' ? 'mx-auto w-16' : 'w-14 sm:w-20'
            }`}
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  )
}
