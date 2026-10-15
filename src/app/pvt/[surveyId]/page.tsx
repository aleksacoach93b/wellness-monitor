import { Suspense } from 'react'
import PvtPlayer from '@/components/pvt/PvtPlayer'

export default async function PvtPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params
  return <main className="min-h-svh bg-[#0b1220] px-5 py-6 text-white"><div className="mx-auto max-w-md"><Suspense fallback={<p>Loading…</p>}><PvtPlayer surveyId={surveyId} /></Suspense></div></main>
}
