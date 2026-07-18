import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Plus, User, Mail, Phone, Calendar } from 'lucide-react'
import Image from 'next/image'
import { format } from 'date-fns'
import { Player } from '@prisma/client'
import { getAdminSession } from '@/lib/auth/adminSession'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  let players: Player[] = []

  try {
    players = await prisma.player.findMany({
      where: { teamId: session.teamId },
      orderBy: {
        createdAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Error fetching players:', error)
    players = []
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-kicker">Roster</p>
          <h1 className="admin-title mt-1">Players</h1>
          <p className="admin-sub">Manage athletes, photos, and kiosk access codes.</p>
        </div>
        <Link href="/admin/players/new" className="admin-btn admin-btn-primary">
          <Plus className="h-4 w-4" />
          Add player
        </Link>
      </header>

      <div className="admin-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ad-line)] px-5 py-4 sm:px-6">
          <h2 className="admin-display text-lg font-bold">All players</h2>
          <span className="admin-badge admin-badge-soft">{players.length}</span>
        </div>

        {players.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="admin-tile-icon mx-auto">
              <User className="h-4 w-4" />
            </div>
            <h3 className="admin-display mt-4 text-base font-bold">No players</h3>
            <p className="mt-1 text-sm text-[var(--ad-muted)]">
              Get started by adding your first player.
            </p>
            <Link href="/admin/players/new" className="admin-btn admin-btn-primary mt-6">
              <Plus className="h-4 w-4" />
              Add player
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 sm:p-6">
            {players.map((player) => (
              <div key={player.id} className="admin-tile !gap-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {player.image ? (
                      <Image
                        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-[var(--ad-line)]"
                        src={player.image}
                        alt={`${player.firstName} ${player.lastName}`}
                        width={56}
                        height={56}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ad-accent-soft)]">
                        <User className="h-7 w-7 text-teal-700" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-[var(--ad-ink)]">
                      {player.firstName} {player.lastName}
                    </h3>
                    <div className="mt-1.5 space-y-1">
                      {player.email && (
                        <div className="flex items-center text-xs text-[var(--ad-muted)]">
                          <Mail className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{player.email}</span>
                        </div>
                      )}
                      {player.phone && (
                        <div className="flex items-center text-xs text-[var(--ad-muted)]">
                          <Phone className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          <span>{player.phone}</span>
                        </div>
                      )}
                      {player.dateOfBirth && (
                        <div className="flex items-center text-xs text-[var(--ad-muted)]">
                          <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          <span>{format(new Date(player.dateOfBirth), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--ad-line)] pt-3">
                  <span
                    className={`admin-badge ${player.isActive ? 'admin-badge-ok' : 'admin-badge-soft'}`}
                  >
                    {player.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex gap-3 text-sm font-semibold">
                    <Link
                      href={`/admin/players/${player.id}/edit`}
                      className="text-teal-700 hover:text-teal-900"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
