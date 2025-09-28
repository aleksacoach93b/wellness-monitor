import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check if survey exists
    const survey = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, title: true }
    })
    
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }
    
    // Power BI configuration
    const powerBiConfig = {
      // Option 1: Direct Power BI URL (if you have a published report)
      directUrl: process.env.POWER_BI_REPORT_URL 
        ? `${process.env.POWER_BI_REPORT_URL}?filter=Survey/survey_id eq '${id}'`
        : null,
      
      // Option 2: Embed URL (if you have Power BI embedded)
      embedUrl: process.env.POWER_BI_EMBED_URL
        ? `${process.env.POWER_BI_EMBED_URL}?filter=Survey/survey_id eq '${id}'`
        : null,
      
      // Option 3: CSV Export for Power BI import
      csvExportUrl: `/api/surveys/${id}/export/powerbi`,
      
      // Option 4: JSON Export for Power BI
      jsonExportUrl: `/api/surveys/${id}/export/json`,
      
      // Survey info
      survey: {
        id: survey.id,
        title: survey.title
      }
    }
    
    // If no Power BI URL is configured, redirect to setup instructions
    if (!powerBiConfig.directUrl && !powerBiConfig.embedUrl) {
      return NextResponse.json({
        message: 'Power BI not configured yet',
        setup: {
          instructions: 'Please configure Power BI integration',
          steps: [
            '1. Create Power BI report with Supabase connection',
            '2. Set POWER_BI_REPORT_URL environment variable',
            '3. Configure survey filter in Power BI',
            '4. Publish report and get URL'
          ],
          exportOptions: {
            csv: powerBiConfig.csvExportUrl,
            json: powerBiConfig.jsonExportUrl
          }
        }
      })
    }
    
    // Return Power BI configuration
    return NextResponse.json(powerBiConfig)
    
  } catch (error) {
    console.error('Error getting Power BI config:', error)
    return NextResponse.json(
      { error: 'Failed to get Power BI configuration' },
      { status: 500 }
    )
  }
}
