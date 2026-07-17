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
  align?: 'left' | 'center' | 'right'
  /** Show logo only (no club name text). Full crest with object-fit contain. */
  logoOnly?: boolean
}

export default function KioskClubBrand({
  clubName,
  clubLogo,
  showBranding = true,
  kioskTheme,
  size = 'md',
  className = '',
  align = 'left',
  logoOnly = true,
}: KioskClubBrandProps) {
  const name = clubName?.trim() || ''
  const logo = clubLogo?.trim() || ''
  if (!showBranding || (!name && !logo)) return null

  const text = kioskTextTokens(kioskTheme)
  // Tall crest logos need height room; width is flexible with contain
  const box =
    size === 'lg'
      ? { w: 96, h: 112 }
      : size === 'sm'
        ? { w: 44, h: 52 }
        : { w: 64, h: 76 }
  const nameClass =
    size === 'lg'
      ? 'text-2xl sm:text-4xl'
      : size === 'sm'
        ? 'text-base sm:text-lg'
        : 'text-xl sm:text-2xl'

  const justify =
    align === 'center' ? 'justify-center text-center' : align === 'right' ? 'justify-end text-right' : 'justify-start text-left'

  return (
    <div className={`flex items-center gap-3 sm:gap-4 ${justify} ${className}`}>
      {logo ? (
        <div
          className="relative shrink-0 rounded-xl bg-white/95 p-1 shadow-lg ring-1 ring-black/5"
          style={{ width: box.w, height: box.h }}
          title={name || 'Club logo'}
        >
          <Image
            src={logo}
            alt={name || 'Club logo'}
            width={box.w}
            height={box.h}
            unoptimized
            className="h-full w-full object-contain"
          />
        </div>
      ) : null}

      {!logoOnly && name ? (
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

      {/* Fallback when logo missing but name exists and logoOnly requested */}
      {logoOnly && !logo && name ? (
        <p className={`font-semibold tracking-[0.04em] ${text.textStrong} ${nameClass} drop-shadow-sm leading-tight`}>
          {name}
        </p>
      ) : null}
    </div>
  )
}
