'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  FilePlus2,
  QrCode,
  BarChart3,
  Settings2,
  Tags,
  ShieldCheck,
  UserCog,
  MailPlus,
  ClipboardList,
  Menu,
  X,
} from 'lucide-react'
import AdminLogoutButton from '@/components/AdminLogoutButton'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  superOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/', label: 'Surveys', icon: ClipboardList },
  { href: '/admin/players', label: 'Players', icon: Users },
  { href: '/admin/surveys/new', label: 'New survey', icon: FilePlus2 },
  { href: '/admin/session-types', label: 'Session tags', icon: Tags },
  { href: '/admin/kiosk-settings', label: 'Kiosk', icon: Settings2 },
  { href: '/admin/admin-access', label: 'Kiosk exit', icon: ShieldCheck },
  { href: '/admin/qr-code', label: 'QR code', icon: QrCode },
  { href: '/admin/powerbi', label: 'Power BI', icon: BarChart3 },
  { href: '/admin/admins', label: 'Manage admins', icon: UserCog, superOnly: true },
  { href: '/admin/invites', label: 'Invite admins', icon: MailPlus, superOnly: true },
]

function navActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminChrome({
  teamName,
  email,
  isSuper,
  children,
}: {
  teamName: string
  email: string
  isSuper: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const items = NAV.filter((n) => !n.superOnly || isSuper)

  const NavList = (
    <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
      {items.map((item, i) => {
        const Icon = item.icon
        const active = navActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            style={{ animationDelay: `${i * 30}ms` }}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'bg-white/12 text-white shadow-[inset_3px_0_0_0_#2dd4bf]'
                : 'text-white/65 hover:bg-white/6 hover:text-white'
            }`}
          >
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                active ? 'bg-teal-400/20 text-teal-300' : 'bg-white/5 text-white/55 group-hover:text-teal-200'
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="admin-shell">
      <div className="admin-bg-mesh" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-white/5 bg-[#0b1220] text-white lg:flex">
          <div className="px-5 pb-4 pt-6">
            <p className="admin-kicker !text-teal-300/90">Wellness Monitor</p>
            <h1 className="admin-display mt-1 text-xl font-bold tracking-tight text-white">
              Control
            </h1>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="truncate text-xs font-semibold text-white/90">{teamName}</p>
              <p className="mt-0.5 truncate text-[11px] text-white/45">{email}</p>
            </div>
          </div>
          {NavList}
          <div className="mt-auto border-t border-white/8 px-4 py-4">
            <AdminLogoutButton className="admin-btn admin-btn-ghost !w-full !border-white/10 !bg-white/5 !text-white/80 hover:!bg-white/10" />
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
              Wellness
            </p>
            <p className="truncate text-sm font-bold text-slate-900">{teamName}</p>
          </div>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-[280px] flex-col bg-[#0b1220] pt-16 text-white shadow-2xl">
              {NavList}
              <div className="mt-auto border-t border-white/8 px-4 py-4">
                <AdminLogoutButton className="admin-btn admin-btn-ghost !w-full !border-white/10 !bg-white/5 !text-white/80" />
              </div>
            </aside>
          </div>
        )}

        <div className="admin-main min-w-0 flex-1 px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </div>
    </div>
  )
}
