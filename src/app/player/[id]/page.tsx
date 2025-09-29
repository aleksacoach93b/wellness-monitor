import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { User, Calendar, Mail, Phone, FileText, Clock } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import Image from 'next/image'
import { Player, Survey, Response } from '@prisma/client'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

interface PlayerPageProps {
  params: {
    id: string
  }
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  let player: (Player & {
    responses: (Response & {
      survey: Survey
    })[]
  }) | null = null
  
  try {
    player = await prisma.player.findUnique({
      where: { id: params.id },
      include: {
        responses: {
          include: {
            survey: true
          },
          orderBy: { submittedAt: 'desc' }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching player:', error)
    notFound()
  }

  if (!player) {
    notFound()
  }

  let activeSurveys: (Survey & {
    _count: {
      questions: number
    }
  })[] = []
  try {
    activeSurveys = await prisma.survey.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            questions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching active surveys:', error)
    // Use empty array if database is not available
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Mobile Header */}
      <div className="bg-gray-800 px-4 py-6">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {player.image ? (
              <Image
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-600"
                src={player.image}
                alt={`${player.firstName} ${player.lastName}`}
                width={64}
                height={64}
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gray-600 flex items-center justify-center border-2 border-gray-500">
                <User className="h-8 w-8 text-gray-300" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              {player.firstName} {player.lastName}
            </h1>
            <p className="text-gray-300 text-sm">Player Dashboard</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Player Info Card */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
          <div className="space-y-3">
            {player.email && (
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">{player.email}</span>
              </div>
            )}
            {player.phone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">{player.phone}</span>
              </div>
            )}
            {player.dateOfBirth && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">
                  Born {format(new Date(player.dateOfBirth), 'MMMM dd, yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Available Surveys */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Available Surveys</h2>
          {activeSurveys.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No surveys available at the moment</p>
          ) : (
            <div className="space-y-3">
              {activeSurveys.map((survey) => {
                const hasResponded = player.responses.some(r => r.surveyId === survey.id)
                const lastResponse = player.responses.find(r => r.surveyId === survey.id)
                
                return (
                  <Link
                    key={survey.id}
                    href={`/survey/${survey.id}?playerId=${player.id}`}
                    className="block bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{survey.title}</h3>
                        {survey.description && (
                          <p className="text-gray-400 text-sm mt-1">{survey.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
                          <span>{survey._count.questions} questions</span>
                          {hasResponded && lastResponse && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>Last: {format(new Date(lastResponse.submittedAt), 'MMM dd')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {hasResponded ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Pending
                          </span>
                        )}
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Responses */}
        {player.responses.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Responses</h2>
            <div className="space-y-3">
              {player.responses.slice(0, 3).map((response) => (
                <div key={response.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">{response.survey.title}</h3>
                      <p className="text-gray-400 text-sm">
                        Submitted {format(new Date(response.submittedAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Completed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
