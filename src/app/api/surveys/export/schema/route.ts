import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Database schema for Power BI setup
    const schema = {
      tables: [
        {
          name: 'Survey',
          description: 'Survey definitions and metadata',
          columns: [
            { name: 'id', type: 'string', description: 'Unique survey identifier' },
            { name: 'title', type: 'string', description: 'Survey title' },
            { name: 'description', type: 'string', description: 'Survey description' },
            { name: 'isActive', type: 'boolean', description: 'Whether survey is active' },
            { name: 'isRecurring', type: 'boolean', description: 'Whether survey is recurring' },
            { name: 'startDate', type: 'date', description: 'Survey start date' },
            { name: 'endDate', type: 'date', description: 'Survey end date' },
            { name: 'dailyStartTime', type: 'time', description: 'Daily start time for recurring surveys' },
            { name: 'dailyEndTime', type: 'time', description: 'Daily end time for recurring surveys' },
            { name: 'createdAt', type: 'datetime', description: 'Survey creation timestamp' },
            { name: 'updatedAt', type: 'datetime', description: 'Survey last update timestamp' }
          ]
        },
        {
          name: 'Question',
          description: 'Survey questions',
          columns: [
            { name: 'id', type: 'string', description: 'Unique question identifier' },
            { name: 'surveyId', type: 'string', description: 'Reference to Survey table' },
            { name: 'text', type: 'string', description: 'Question text' },
            { name: 'type', type: 'string', description: 'Question type (TEXT, NUMBER, RATING_SCALE, RPE, BODY_MAP, etc.)' },
            { name: 'options', type: 'string', description: 'JSON string of question options' },
            { name: 'required', type: 'boolean', description: 'Whether question is required' },
            { name: 'order', type: 'number', description: 'Question order in survey' },
            { name: 'createdAt', type: 'datetime', description: 'Question creation timestamp' }
          ]
        },
        {
          name: 'Response',
          description: 'Survey responses from players',
          columns: [
            { name: 'id', type: 'string', description: 'Unique response identifier' },
            { name: 'surveyId', type: 'string', description: 'Reference to Survey table' },
            { name: 'playerId', type: 'string', description: 'Reference to Player table' },
            { name: 'playerName', type: 'string', description: 'Player name at time of response' },
            { name: 'playerEmail', type: 'string', description: 'Player email at time of response' },
            { name: 'submittedAt', type: 'datetime', description: 'Response submission timestamp' }
          ]
        },
        {
          name: 'Answer',
          description: 'Individual answers to questions',
          columns: [
            { name: 'id', type: 'string', description: 'Unique answer identifier' },
            { name: 'responseId', type: 'string', description: 'Reference to Response table' },
            { name: 'questionId', type: 'string', description: 'Reference to Question table' },
            { name: 'value', type: 'string', description: 'Answer value (can be JSON for complex types like BODY_MAP)' }
          ]
        },
        {
          name: 'Player',
          description: 'Player information',
          columns: [
            { name: 'id', type: 'string', description: 'Unique player identifier' },
            { name: 'firstName', type: 'string', description: 'Player first name' },
            { name: 'lastName', type: 'string', description: 'Player last name' },
            { name: 'email', type: 'string', description: 'Player email' },
            { name: 'phone', type: 'string', description: 'Player phone number' },
            { name: 'isActive', type: 'boolean', description: 'Whether player is active' },
            { name: 'createdAt', type: 'datetime', description: 'Player creation timestamp' }
          ]
        }
      ],
      relationships: [
        {
          from: 'Survey',
          to: 'Question',
          type: 'one-to-many',
          description: 'One survey can have many questions'
        },
        {
          from: 'Survey',
          to: 'Response',
          type: 'one-to-many',
          description: 'One survey can have many responses'
        },
        {
          from: 'Response',
          to: 'Answer',
          type: 'one-to-many',
          description: 'One response can have many answers'
        },
        {
          from: 'Question',
          to: 'Answer',
          type: 'one-to-many',
          description: 'One question can have many answers'
        },
        {
          from: 'Player',
          to: 'Response',
          type: 'one-to-many',
          description: 'One player can have many responses'
        }
      ],
      powerBiSetup: {
        connectionString: 'postgresql://postgres:[password]@[host]:5432/postgres',
        recommendedMeasures: [
          'Total Responses = COUNTROWS(Response)',
          'Unique Players = DISTINCTCOUNT(Response[playerId])',
          'Average Rating = AVERAGE(VALUE(Answer[value]))',
          'Response Rate = DIVIDE(COUNTROWS(Response), COUNTROWS(Player))',
          'Daily Responses = COUNTROWS(FILTER(Response, Response[submittedAt] >= TODAY()))'
        ],
        recommendedVisualizations: [
          'Response trends over time',
          'Question type distribution',
          'Player participation rates',
          'Body Map heat visualization',
          'Rating scale averages and distributions'
        ]
      }
    }
    
    return NextResponse.json(schema, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="wellness-monitor-schema.json"'
      }
    })
    
  } catch (error) {
    console.error('Error exporting schema:', error)
    return NextResponse.json(
      { error: 'Failed to export schema' },
      { status: 500 }
    )
  }
}
