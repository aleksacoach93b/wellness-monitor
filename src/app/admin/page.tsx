import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/adminSession'
import { redirect } from 'next/navigation'
import {
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
  ArrowUpRight,
  FileText,
  Activity,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  let surveysCount = 0
  let responsesCount = 0
  let playersCount = 0

  try {
    ;[surveysCount, responsesCount, playersCount] = await Promise.all([
      prisma.survey.count({ where: { teamId: session.teamId } }),
      prisma.response.count({ where: { survey: { teamId: session.teamId } } }),
      prisma.player.count({ where: { teamId: session.teamId, isActive: true } }),
    ])
  } catch (error) {
    console.error('Error fetching admin stats:', error)
  }

  const primary = [
    { href: '/admin/ops', label: 'Live Ops', desc: 'Who still needs to check in today', icon: Activity },
    { href: '/admin/surveys/new', label: 'New survey', desc: 'Build a wellness form', icon: FilePlus2 },
    { href: '/admin/players', label: 'Players', desc: 'Roster & access codes', icon: Users },
    { href: '/', label: 'All surveys', desc: 'Results, edit, kiosk links', icon: ClipboardList },
    { href: '/admin/kiosk-settings', label: 'Kiosk', desc: 'Branding & passwords', icon: Settings2 },
  ]

  const secondary = [
    { href: '/admin/session-types', label: 'Session tags', icon: Tags },
    { href: '/admin/qr-code', label: 'QR code', icon: QrCode },
    { href: '/admin/powerbi', label: 'Power BI', icon: BarChart3 },
    { href: '/admin/admin-access', label: 'Kiosk exit password', icon: ShieldCheck },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-kicker">Operations</p>
          <h1 className="admin-title mt-1">Admin dashboard</h1>
          <p className="admin-sub">
            Run surveys, players, kiosk, and exports for your team — clean and fast.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ops" className="admin-btn admin-btn-primary">
            Live Ops
            <Activity className="h-4 w-4" />
          </Link>
          <Link href="/" className="admin-btn admin-btn-ghost">
            View surveys
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="admin-panel admin-stat">
          <p className="admin-stat-label">Surveys</p>
          <p className="admin-stat-value">{surveysCount}</p>
          <FileText className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
        </div>
        <div className="admin-panel admin-stat">
          <p className="admin-stat-label">Active players</p>
          <p className="admin-stat-value">{playersCount}</p>
          <Users className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
        </div>
        <div className="admin-panel admin-stat">
          <p className="admin-stat-label">Responses</p>
          <p className="admin-stat-value">{responsesCount.toLocaleString()}</p>
          <Activity className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="admin-display text-lg font-bold text-[var(--ad-ink)]">Core</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="admin-tile">
                <span className="admin-tile-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-[var(--ad-ink)]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--ad-muted)]">{item.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="admin-panel p-5 lg:col-span-3">
          <h2 className="admin-display text-lg font-bold">Tools</h2>
          <p className="mt-1 text-sm text-[var(--ad-muted)]">Everything else you need day to day.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {secondary.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className="admin-link-row">
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4 text-teal-700" />
                    {item.label}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-40" />
                </Link>
              )
            })}
          </div>
        </div>

        <div className="admin-panel relative overflow-hidden p-5 lg:col-span-2">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-teal-400/20 blur-2xl"
            aria-hidden
          />
          <h2 className="admin-display text-lg font-bold">Platform</h2>
          <p className="mt-1 text-sm text-[var(--ad-muted)]">
            {session.role === 'SUPER'
              ? 'Invite and manage team admins across the platform.'
              : 'Your team workspace is isolated. Contact platform admin for account help.'}
          </p>
          {session.role === 'SUPER' ? (
            <div className="relative mt-5 space-y-2">
              <Link href="/admin/admins" className="admin-btn admin-btn-primary !w-full">
                <UserCog className="h-4 w-4" />
                Manage admins
              </Link>
              <Link href="/admin/invites" className="admin-btn admin-btn-ghost !w-full">
                <MailPlus className="h-4 w-4" />
                Invite admins
              </Link>
            </div>
          ) : (
            <div className="relative mt-5 rounded-xl border border-[var(--ad-line)] bg-white/50 px-3 py-3 text-sm text-[var(--ad-muted)]">
              Signed in as team admin · data stays in your club only
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
