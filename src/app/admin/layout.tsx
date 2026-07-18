import { ReactNode } from 'react'
import { headers } from 'next/headers'
import { Syne, DM_Sans } from 'next/font/google'
import { getAdminSession } from '@/lib/auth/adminSession'
import { prisma } from '@/lib/prisma'
import AdminChrome from '@/components/admin/AdminChrome'
import './admin.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['500', '600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headersList = await headers()
  const isPublicAuth = headersList.get('x-admin-public') === '1'
  const session = await getAdminSession()

  if (!session || isPublicAuth) {
    return (
      <div className={`${syne.variable} ${dmSans.variable}`}>
        {children}
      </div>
    )
  }

  const team = await prisma.team.findUnique({
    where: { id: session.teamId },
    select: { name: true },
  })

  return (
    <div className={`${syne.variable} ${dmSans.variable}`}>
      <AdminChrome
        teamName={team?.name || 'Team'}
        email={session.email}
        isSuper={session.role === 'SUPER'}
      >
        {children}
      </AdminChrome>
    </div>
  )
}
