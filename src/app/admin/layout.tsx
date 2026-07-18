import { ReactNode } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getAdminSession } from '@/lib/auth/adminSession'
import AdminLogoutButton from '@/components/AdminLogoutButton'
import { prisma } from '@/lib/prisma'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headersList = await headers()
  const isPublicAuth = headersList.get('x-admin-public') === '1'
  const session = await getAdminSession()

  if (!session || isPublicAuth) {
    return <>{children}</>
  }

  const team = await prisma.team.findUnique({
    where: { id: session.teamId },
    select: { name: true },
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/admin" className="text-sm font-bold text-slate-900">
              Wellness Admin
            </Link>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {team?.name || 'Team'}
            </span>
            {session.role === 'SUPER' && (
              <>
                <Link
                  href="/admin/admins"
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  Manage admins
                </Link>
                <Link
                  href="/admin/invites"
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  Invite
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{session.email}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
