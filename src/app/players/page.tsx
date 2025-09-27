import { prisma } from '@/lib/prisma'
import { User, Search } from 'lucide-react'
import Link from 'next/link'

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' }
    ]
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mobile Header */}
      <div className="bg-gray-800 px-4 py-6">
        <div className="flex items-center space-x-3">
          <User className="h-6 w-6 text-gray-300" />
          <h1 className="text-xl font-bold text-white">Select Your Profile</h1>
        </div>
        <p className="text-gray-300 text-sm mt-2">Choose your name to access your wellness surveys</p>
      </div>

      <div className="px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for your name..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              id="playerSearch"
            />
          </div>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-2 gap-4" id="playersGrid">
          {players.map((player) => (
            <Link
              key={player.id}
              href={`/player/${player.id}`}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3">
                  {player.image ? (
                    <img
                      className="h-16 w-16 rounded-full object-cover border-2 border-gray-600 group-hover:border-gray-500"
                      src={player.image}
                      alt={`${player.firstName} ${player.lastName}`}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-600 flex items-center justify-center border-2 border-gray-500 group-hover:border-gray-400">
                      <User className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                </div>
                <h3 className="text-white font-medium text-sm leading-tight">
                  {player.firstName}
                </h3>
                <h4 className="text-gray-300 font-medium text-sm leading-tight">
                  {player.lastName}
                </h4>
              </div>
            </Link>
          ))}
        </div>

        {players.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No players found</h3>
            <p className="text-gray-400">Contact your coach to get added to the system.</p>
          </div>
        )}
      </div>

      {/* Search Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', function() {
              const searchInput = document.getElementById('playerSearch');
              const playersGrid = document.getElementById('playersGrid');
              const players = Array.from(playersGrid.children);
              
              searchInput.addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                
                players.forEach(player => {
                  const name = player.textContent.toLowerCase();
                  if (name.includes(searchTerm)) {
                    player.style.display = 'block';
                  } else {
                    player.style.display = 'none';
                  }
                });
              });
            });
          `
        }}
      />
    </div>
  )
}
