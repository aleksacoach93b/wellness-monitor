# Power BI Integracija - Setup Guide

## 1. Power BI Direct Query sa Supabase

### Korak 1: Supabase Connection String
```
Host: your-project.supabase.co
Database: postgres
Port: 5432
Username: postgres
Password: your-password
SSL Mode: require
```

### Korak 2: Power BI Data Source
1. Otvori Power BI Desktop
2. Get Data → PostgreSQL database
3. Unesi connection string
4. Izaberi tabele: `Survey`, `Question`, `Response`, `Answer`, `Player`

### Korak 3: Kreiranje Dashboard-a
```sql
-- Glavni view za sve survey rezultate
CREATE VIEW survey_results_view AS
SELECT 
    s.id as survey_id,
    s.title as survey_title,
    s.description as survey_description,
    s.createdAt as survey_created,
    s.isRecurring,
    s.startDate,
    s.endDate,
    s.dailyStartTime,
    s.dailyEndTime,
    r.id as response_id,
    r.playerId,
    r.playerName,
    r.submittedAt,
    q.id as question_id,
    q.text as question_text,
    q.type as question_type,
    a.value as answer_value
FROM "Survey" s
LEFT JOIN "Question" q ON s.id = q."surveyId"
LEFT JOIN "Response" r ON s.id = r."surveyId"
LEFT JOIN "Answer" a ON r.id = a."responseId" AND q.id = a."questionId"
WHERE s."isActive" = true;
```

### Korak 4: Power BI Measures
```DAX
-- Broj odgovora po survey-u
Total Responses = COUNTROWS(FILTER(survey_results_view, survey_results_view[response_id] <> BLANK()))

-- Broj igrača koji su odgovorili
Unique Players = DISTINCTCOUNT(survey_results_view[playerId])

-- Prosečan rating (za RATING_SCALE i RPE)
Average Rating = 
AVERAGEX(
    FILTER(survey_results_view, 
        survey_results_view[question_type] IN ("RATING_SCALE", "RPE") && 
        ISNUMBER(VALUE(survey_results_view[answer_value]))
    ),
    VALUE(survey_results_view[answer_value])
)

-- Body Map analiza
Body Map Pain = 
COUNTROWS(
    FILTER(survey_results_view, 
        survey_results_view[question_type] = "BODY_MAP" &&
        survey_results_view[answer_value] CONTAINS "path-"
    )
)
```

## 2. Automatski Power BI Link Generator

### API Endpoint za Power BI Link
```typescript
// /api/surveys/[id]/powerbi
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  
  // Power BI embed URL template
  const powerBiUrl = `https://app.powerbi.com/view?r=${process.env.POWER_BI_REPORT_ID}&filter=Survey/survey_id eq '${id}'`;
  
  return NextResponse.json({
    surveyId: id,
    powerBiUrl: powerBiUrl,
    embedUrl: powerBiUrl,
    directQuery: true
  });
}
```

## 3. Power BI Report Template

### Glavni Dashboard Elementi:
1. **Survey Overview**
   - Survey title i description
   - Broj odgovora
   - Broj igrača
   - Period aktivnosti

2. **Question Analysis**
   - Grafik po tipu pitanja
   - Prosečni odgovori
   - Trend analiza

3. **Player Insights**
   - Top igrači po broju odgovora
   - Geografski prikaz (ako imaš lokaciju)
   - Vremenski trend

4. **Body Map Visualization**
   - Heat map tela
   - Najčešći problemi
   - Intenzitet bola

## 4. Deployment Setup

### Environment Variables
```env
# Power BI
POWER_BI_REPORT_ID=your-report-id
POWER_BI_WORKSPACE_ID=your-workspace-id
POWER_BI_CLIENT_ID=your-client-id
POWER_BI_CLIENT_SECRET=your-client-secret
POWER_BI_TENANT_ID=your-tenant-id

# Supabase (već imaš)
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

### Vercel Deployment
1. Dodaj environment variables u Vercel
2. Power BI report mora biti public ili shared
3. Embed URL će raditi sa filter parametrima

## 5. Korisnički Interface

### Admin Panel - Power BI Link
```typescript
// U survey results page
<Link
  href={`/api/surveys/${survey.id}/powerbi`}
  target="_blank"
  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
>
  <BarChart3 className="h-4 w-4 mr-2" />
  View in Power BI
</Link>
```

## 6. Alternativni Pristup - CSV Export sa Power BI

### Ako ne možeš Direct Query:
1. CSV export iz admin panel-a
2. Power BI import CSV fajlova
3. Scheduled refresh (manual)

### CSV Export API
```typescript
// /api/surveys/[id]/export/powerbi
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  
  // Export sve podatke za survey
  const data = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: true,
      responses: {
        include: {
          answers: true
        }
      }
    }
  });
  
  // Format za Power BI
  const powerBiData = formatForPowerBI(data);
  
  return new Response(JSON.stringify(powerBiData), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="survey-${id}-powerbi.json"`
    }
  });
}
```

## 7. Preporučeni Workflow

1. **Setup**: Power BI + Supabase connection
2. **Template**: Kreiraj jedan master report template
3. **Automation**: Svaki novi survey automatski dobija filter
4. **Sharing**: Public link za svaki survey
5. **Embedding**: Možeš embed-ovati u admin panel

## 8. Cost Optimization

- **Power BI Free**: Do 1GB data, 8 refreshes/day
- **Power BI Pro**: $10/user/month, unlimited data
- **Supabase**: Free tier do 500MB, $25/month za 8GB

## 9. Security

- Power BI report može biti public (read-only)
- Supabase RLS (Row Level Security) za data protection
- API keys u environment variables
