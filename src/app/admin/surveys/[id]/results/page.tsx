import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Download, BarChart3, Users, Calendar, Database } from 'lucide-react'
import ResultsTable from './ResultsTable'
import GoogleSheetsExportButton from './GoogleSheetsExportButton'
import HomeButton from '@/components/HomeButton'
import { format } from 'date-fns'

interface ResultsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params
  const survey = await prisma.survey.findUnique({
    where: { id: id },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      },
      responses: {
        include: {
          answers: {
            include: {
              question: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      }
    }
  })

  if (!survey) {
    notFound()
  }

  const exportToCSV = async () => {
    'use server'
    
    const csvData = []
    
    // Header row
    const headers = ['Response ID', 'Player Name', 'Player Email', 'Submitted At']
    survey.questions.forEach(q => headers.push(q.text))
    csvData.push(headers.join(','))
    
    // Data rows
    survey.responses.forEach(response => {
      const row = [
        response.id,
        response.playerName || '',
        response.playerEmail || '',
        format(new Date(response.submittedAt), 'yyyy-MM-dd HH:mm:ss')
      ]
      
      survey.questions.forEach(question => {
        const answer = response.answers.find(a => a.questionId === question.id)
        let value = answer?.value || ''
        
        // Clean up the value for CSV
        if (value.includes(',')) {
          value = `"${value}"`
        }
        row.push(value)
      })
      
      csvData.push(row.join(','))
    })
    
    return csvData.join('\n')
  }

  const csvContent = await exportToCSV()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{survey.title} - Results</h1>
              <p className="mt-2 text-gray-600">View and analyze survey responses</p>
            </div>
            <HomeButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Responses</p>
                <p className="text-2xl font-semibold text-gray-900">{survey.responses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Questions</p>
                <p className="text-2xl font-semibold text-gray-900">{survey.questions.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Latest Response</p>
                <p className="text-sm font-semibold text-gray-900">
                  {survey.responses.length > 0 
                    ? format(new Date(survey.responses[0].submittedAt), 'MMM dd, yyyy')
                    : 'No responses'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Survey Responses</h2>
              <div className="flex space-x-3">
                <a
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`}
                  download={`${survey.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </a>
                <GoogleSheetsExportButton surveyId={survey.id} />
              </div>
            </div>
          </div>

          <ResultsTable responses={survey.responses} />
        </div>
      </div>
    </div>
  )
}
