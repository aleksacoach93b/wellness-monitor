import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, BarChart3, Users, FileText, Clock, Calendar, Settings, ExternalLink } from 'lucide-react'
import DeleteSurveyButton from './DeleteSurveyButton'
import HomeButton from '@/components/HomeButton'
import { Survey } from '@prisma/client'
import { formatRecurringInfo } from '@/lib/recurringSurvey'
import CSVLinkModal from './admin/surveys/[id]/results/CSVLinkModal'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

const actionLink =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2'

export default async function HomePage() {
  let surveys: (Survey & {
    _count: {
      questions: number
      responses: number
    }
  })[] = []
  let databaseUnavailable = false

  try {
    surveys = await prisma.survey.findMany({
      include: {
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Error fetching surveys:', error)
    surveys = []
    databaseUnavailable = true
  }

  const totalResponses = surveys.reduce((sum, survey) => sum + survey._count.responses, 0)
  const activeCount = surveys.filter((s) => s.isActive).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {databaseUnavailable ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Database connection failed</p>
            <p className="mt-1 text-amber-900/90">
              This deployment cannot reach your Postgres database, so surveys show as empty.
              Your data is not deleted — open the working production URL or fix{' '}
              <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> in Vercel Environment Variables.
              Working app:{' '}
              <a
                className="font-semibold underline underline-offset-2"
                href="https://wellness-monitor-tan.vercel.app/"
                target="_blank"
                rel="noreferrer"
              >
                wellness-monitor-tan.vercel.app
              </a>
            </p>
          </div>
        ) : null}
        <header className="mb-10 border-b border-slate-200/80 pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/90">Admin overview</p>
              <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">Survey Monitor</h1>
              <p className="mt-2 max-w-xl text-base text-slate-600">
                Create and manage surveys for your team
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2 sm:justify-end">
              <Link
                href="/admin"
                className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                title="Go to Admin Dashboard"
              >
                <Settings className="mr-2 h-4 w-4 text-slate-500" aria-hidden />
                Admin
              </Link>
              <HomeButton />
            </div>
          </div>

          <nav className="mt-8 flex flex-wrap gap-3" aria-label="Primary admin actions">
            <Link
              href="/admin"
              className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-slate-900/15 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              <Settings className="mr-2 h-4 w-4" aria-hidden />
              Admin Dashboard
            </Link>
            <Link
              href="/admin/players"
              className={actionLink}
            >
              <Users className="h-4 w-4 text-slate-500" aria-hidden />
              Manage Players
            </Link>
            <Link
              href="/admin/surveys/new"
              className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-900/15 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New Survey
            </Link>
          </nav>
        </header>

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-sm shadow-slate-900/[0.04] backdrop-blur-sm ring-1 ring-slate-900/[0.03] transition hover:border-slate-300/90 hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-600">
                <FileText className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">Total Surveys</p>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{surveys.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-sm shadow-slate-900/[0.04] backdrop-blur-sm ring-1 ring-slate-900/[0.03] transition hover:border-slate-300/90 hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600">
                <Users className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">Total Responses</p>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{totalResponses}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-sm shadow-slate-900/[0.04] backdrop-blur-sm ring-1 ring-slate-900/[0.03] transition hover:border-slate-300/90 hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600">
                <BarChart3 className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">Active Surveys</p>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{activeCount}</p>
              </div>
            </div>
          </div>
        </div>

        <section
          aria-labelledby="survey-list-heading"
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.05] backdrop-blur-sm ring-1 ring-slate-900/[0.03]"
        >
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
            <div>
              <h2 id="survey-list-heading" className="text-lg font-semibold text-slate-900">
                Your Surveys
              </h2>
              <p className="mt-1 text-sm text-slate-500">{surveys.length} survey{surveys.length === 1 ? '' : 's'} in workspace</p>
            </div>
            <Link
              href="/admin/surveys/new"
              className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-900/15 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New Survey
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {surveys.length === 0 ? (
              <div className="px-6 py-16 text-center sm:px-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <FileText className="h-7 w-7" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">No surveys yet</h3>
                <p className="mt-2 text-sm text-slate-600">Create a survey to collect wellness data from players.</p>
                <div className="mt-8">
                  <Link
                    href="/admin/surveys/new"
                    className="inline-flex items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    New Survey
                  </Link>
                </div>
              </div>
            ) : (
              surveys.map((survey) => (
                <article
                  key={survey.id}
                  className="px-6 py-6 transition hover:bg-slate-50/80 sm:px-8 md:py-8"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 gap-y-2">
                        <h3 className="text-base font-semibold text-slate-900">{survey.title}</h3>
                        {survey.isRecurring ? (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                            <Clock className="mr-1 h-3 w-3" aria-hidden />
                            Recurring
                          </span>
                        ) : null}
                        {survey.isActive ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      {survey.description ? (
                        <p className="text-sm leading-relaxed text-slate-600">{survey.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                        <span>{survey._count.questions} questions</span>
                        <span className="hidden sm:inline" aria-hidden>
                          •
                        </span>
                        <span>{survey._count.responses} responses</span>
                        <span className="hidden sm:inline" aria-hidden>
                          •
                        </span>
                        <span>Created {new Date(survey.createdAt).toLocaleDateString()}</span>
                      </div>
                      {survey.isRecurring ? (
                        <div className="flex items-start gap-1.5 rounded-lg border border-sky-100 bg-sky-50/70 px-2.5 py-1.5 text-xs font-medium text-sky-900">
                          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
                          <span>{formatRecurringInfo(survey)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 lg:max-w-xl lg:border-t-0 lg:pt-0">
                      <Link href={`/admin/surveys/${survey.id}/edit`} className={actionLink}>
                        Edit
                      </Link>
                      <CSVLinkModal surveyId={survey.id} surveyTitle={survey.title} />
                      <Link
                        href={`/survey/${survey.id}`}
                        className={`${actionLink} text-emerald-800`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                        <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                      </Link>
                      <Link href={`/admin/surveys/${survey.id}/results`} className={`${actionLink} border-violet-200/90 text-violet-800 hover:bg-violet-50`}>
                        Results
                      </Link>
                      <Link
                        href={`/kiosk/${survey.id}`}
                        className={`${actionLink} border-amber-200/90 text-amber-900 hover:bg-amber-50`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Kiosk
                        <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                      </Link>
                      <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
