import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, User, Mail, Phone, Calendar } from 'lucide-react'
import Image from 'next/image'
import { format } from 'date-fns'
import HomeButton from '@/components/HomeButton'
import { Player } from '@prisma/client'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  let players: Player[] = []
  
  try {
    players = await prisma.player.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })
  } catch (error) {
    console.error('Error fetching players:', error)
    // Return empty array if database is not available
    players = []
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Players Management</h1>
              <p className="mt-2 text-gray-600">Manage your athletes and team members</p>
            </div>
            <HomeButton />
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">All Players</h2>
              <Link
                href="/admin/players/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Player
              </Link>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {players.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No players</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding your first player.</p>
                <div className="mt-6">
                  <Link
                    href="/admin/players/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Player
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {players.map((player) => (
                  <div key={player.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {player.image ? (
                          <Image
                            className="h-16 w-16 rounded-full object-cover"
                            src={player.image}
                            alt={`${player.firstName} ${player.lastName}`}
                            width={64}
                            height={64}
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="h-8 w-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {player.firstName} {player.lastName}
                        </h3>
                        <div className="mt-2 space-y-1">
                          {player.email && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Mail className="h-4 w-4 mr-2" />
                              <span className="truncate">{player.email}</span>
                            </div>
                          )}
                          {player.phone && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Phone className="h-4 w-4 mr-2" />
                              <span>{player.phone}</span>
                            </div>
                          )}
                          {player.dateOfBirth && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>{format(new Date(player.dateOfBirth), 'MMM dd, yyyy')}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            player.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {player.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <div className="flex space-x-2">
                            <Link
                              href={`/admin/players/${player.id}/edit`}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/admin/players/${player.id}/responses`}
                              className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                            >
                              Responses
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
