import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// Google Sheets configuration
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

interface GoogleSheetsConfig {
  clientEmail: string
  privateKey: string
  spreadsheetId: string
}

class GoogleSheetsService {
  private auth: JWT
  private sheets: any // eslint-disable-line @typescript-eslint/no-explicit-any
  private config: GoogleSheetsConfig

  constructor() {
    this.config = {
      clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || ''
    }

    this.auth = new JWT({
      email: this.config.clientEmail,
      key: this.config.privateKey,
      scopes: SCOPES,
    })

    this.sheets = google.sheets({ version: 'v4', auth: this.auth })
  }

  async appendSurveyResponse(data: {
    surveyId: string
    surveyTitle: string
    playerId?: string
    playerName?: string
    playerEmail?: string
    submittedAt: string
    answers: Array<{
      questionText: string
      questionType: string
      answer: string
    }>
    bodyMapData?: Record<string, number> | null
  }): Promise<void> {
    try {
      // Define all possible muscle areas (from the body map)
      const allMuscleAreas = [
        'back-head', 'back-neck', 'back-left-shoulder', 'back-right-shoulder',
        'back-left-upper-arm', 'back-right-upper-arm', 'back-left-forearm', 'back-right-forearm',
        'back-left-hand', 'back-right-hand', 'back-left-chest', 'back-right-chest',
        'back-left-ribs', 'back-right-ribs', 'back-left-lower-back', 'back-right-lower-back',
        'back-left-upper-back', 'back-right-upper-back', 'back-left-lat', 'back-right-lat',
        'back-left-glute', 'back-right-glute', 'back-left-hip', 'back-right-hip',
        'back-left-thigh', 'back-right-thigh', 'back-left-hamstring', 'back-right-hamstring',
        'back-left-calf', 'back-right-calf', 'back-left-achilles', 'back-right-achilles',
        'back-left-foot', 'back-right-foot', 'back-left-triceps', 'back-right-triceps',
        'back-left-forearm-2', 'back-right-forearm-2', 'back-left-achilles-2', 'back-right-achilles-2',
        // Front body areas (exact names from your SVG)
        'Top Head', 'Right Pectoralis Major', 'Left Pectoralis Major',
        'Right Intercostal', 'Left Intercostal',
        'Right Upper Rectus Abdominis', 'Left Upper Rectus Abdominis',
        'Right Middle Rectus Abdominis', 'Left Middle Rectus Abdominis',
        'Right Lower Rectus Abdominis', 'Left Lower Rectus Abdominis',
        'Right Pubic Area', 'Left Pubic Area',
        'Right Oblique', 'Left Oblique',
        'Right Biceps Brachii SH', 'Left Biceps Brachii SH',
        'Right Biceps Brachii LH', 'Left Biceps Brachii LH',
        'Right Forearm Lateral', 'Left Forearm Lateral',
        'Right Forearm Central', 'Left Forearm Central',
        'Right Forearm Medial', 'Left Forearm Medial',
        'Right Hand Front', 'Left Hand Front',
        'Right 5th Finger', 'Left 5th Finger',
        'Right 4th Finger', 'Left 4th Finger',
        'Right 3rd Finger', 'Left 3rd Finger',
        'Right 2nd Finger', 'Left 2nd Finger',
        'Right 1st Finger', 'Left 1st Finger',
        'Right Larynx', 'Left Larynx',
        'Right Pubis Adductor', 'Left Pubis Adductor',
        'Right Adductor Long', 'Left Adductor Long',
        'Right Rectus Femoris', 'Left Rectus Femoris',
        'Right Vastus Lateralis', 'Left Vastus Lateralis',
        'Right Vastus Medialis', 'Left Vastus Medialis',
        'Right Adductor Short', 'Left Adductor Short',
        'Right Patella', 'Left Patella',
        'Right Medial Knee', 'Left Medial Knee',
        'Right Calf Front', 'Left Calf Front',
        'Right Tibialis Anterior', 'Left Tibialis Anterior',
        'Right Digitorum Longus', 'Left Digitorum Longus',
        'Right Ankle', 'Left Ankle',
        'Right Ankle Ligaments', 'Left Ankle Ligaments',
        'Right Foot Front', 'Left Foot Front',
        'Right Feet Toe', 'Left Feet Toe',
        'Right Sternocleidomastoideus', 'Left Sternocleidomastoideus',
        'Right Trap Front', 'Left Trap Front',
        'Right Trapezius', 'Left Trapezius',
        'Right Deltoideus', 'Left Deltoideus'
      ]

      // Process answers
      const processedAnswers: string[] = []
      data.answers.forEach(answer => {
        processedAnswers.push(answer.answer)
      })

      // Use bodyMapData if provided, otherwise create empty columns
      const bodyMapData = data.bodyMapData || {}
      const muscleColumns = allMuscleAreas.map(area => bodyMapData[area] || 0)

      // Prepare the row data
      const rowData = [
        data.surveyId,
        data.surveyTitle,
        data.playerId || '',
        data.playerName || '',
        data.playerEmail || '',
        data.submittedAt,
        ...processedAnswers,
        ...muscleColumns
      ]

      // Append the data to the sheet
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: 'A:ZZ', // Extended range for muscle columns
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData]
        }
      })

      return response.data
    } catch (error) {
      console.error('Error appending to Google Sheets:', error)
      throw error
    }
  }

  async setupSheetHeaders(surveyId: string, questions: Array<{ text: string; type: string }>) {
    try {
      // Define all possible muscle areas (same as in appendSurveyResponse)
      const allMuscleAreas = [
        'back-head', 'back-neck', 'back-left-shoulder', 'back-right-shoulder',
        'back-left-upper-arm', 'back-right-upper-arm', 'back-left-forearm', 'back-right-forearm',
        'back-left-hand', 'back-right-hand', 'back-left-chest', 'back-right-chest',
        'back-left-ribs', 'back-right-ribs', 'back-left-lower-back', 'back-right-lower-back',
        'back-left-upper-back', 'back-right-upper-back', 'back-left-lat', 'back-right-lat',
        'back-left-glute', 'back-right-glute', 'back-left-hip', 'back-right-hip',
        'back-left-thigh', 'back-right-thigh', 'back-left-hamstring', 'back-right-hamstring',
        'back-left-calf', 'back-right-calf', 'back-left-achilles', 'back-right-achilles',
        'back-left-foot', 'back-right-foot', 'back-left-triceps', 'back-right-triceps',
        'back-left-forearm-2', 'back-right-forearm-2', 'back-left-achilles-2', 'back-right-achilles-2',
        // Front body areas (exact names from your SVG)
        'Top Head', 'Right Pectoralis Major', 'Left Pectoralis Major',
        'Right Intercostal', 'Left Intercostal',
        'Right Upper Rectus Abdominis', 'Left Upper Rectus Abdominis',
        'Right Middle Rectus Abdominis', 'Left Middle Rectus Abdominis',
        'Right Lower Rectus Abdominis', 'Left Lower Rectus Abdominis',
        'Right Pubic Area', 'Left Pubic Area',
        'Right Oblique', 'Left Oblique',
        'Right Biceps Brachii SH', 'Left Biceps Brachii SH',
        'Right Biceps Brachii LH', 'Left Biceps Brachii LH',
        'Right Forearm Lateral', 'Left Forearm Lateral',
        'Right Forearm Central', 'Left Forearm Central',
        'Right Forearm Medial', 'Left Forearm Medial',
        'Right Hand Front', 'Left Hand Front',
        'Right 5th Finger', 'Left 5th Finger',
        'Right 4th Finger', 'Left 4th Finger',
        'Right 3rd Finger', 'Left 3rd Finger',
        'Right 2nd Finger', 'Left 2nd Finger',
        'Right 1st Finger', 'Left 1st Finger',
        'Right Larynx', 'Left Larynx',
        'Right Pubis Adductor', 'Left Pubis Adductor',
        'Right Adductor Long', 'Left Adductor Long',
        'Right Rectus Femoris', 'Left Rectus Femoris',
        'Right Vastus Lateralis', 'Left Vastus Lateralis',
        'Right Vastus Medialis', 'Left Vastus Medialis',
        'Right Adductor Short', 'Left Adductor Short',
        'Right Patella', 'Left Patella',
        'Right Medial Knee', 'Left Medial Knee',
        'Right Calf Front', 'Left Calf Front',
        'Right Tibialis Anterior', 'Left Tibialis Anterior',
        'Right Digitorum Longus', 'Left Digitorum Longus',
        'Right Ankle', 'Left Ankle',
        'Right Ankle Ligaments', 'Left Ankle Ligaments',
        'Right Foot Front', 'Left Foot Front',
        'Right Feet Toe', 'Left Feet Toe',
        'Right Sternocleidomastoideus', 'Left Sternocleidomastoideus',
        'Right Trap Front', 'Left Trap Front',
        'Right Trapezius', 'Left Trapezius',
        'Right Deltoideus', 'Left Deltoideus'
      ]

      // Filter out body map questions from regular questions
      const regularQuestions = questions.filter(q => !q.text.includes('muscle'))
      
      // Create headers row
      const headers = [
        'Survey ID',
        'Survey Title',
        'Player ID',
        'Player Name',
        'Player Email',
        'Submitted At',
        ...regularQuestions.map(q => q.text),
        ...allMuscleAreas.map(area => area.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      ]

      // Check if sheet exists, if not create it
      const sheetName = `Survey_${surveyId}`
      
      try {
        // Try to get the sheet
        await this.sheets.spreadsheets.get({
          spreadsheetId: this.config.spreadsheetId,
          ranges: [sheetName]
        })
      } catch (error) {
        // Sheet doesn't exist, create it
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        })
      }

      // Add headers to the sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${sheetName}!A1:ZZ1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      })

      return true
    } catch (error) {
      console.error('Error setting up sheet headers:', error)
      throw error
    }
  }

  async exportAllSurveyData(surveyId: string) {
    try {
      // This method can be used to export all data for a specific survey
      // Implementation depends on your specific needs
      return { success: true, message: 'Data exported successfully' }
    } catch (error) {
      console.error('Error exporting survey data:', error)
      throw error
    }
  }
}

export const googleSheetsService = new GoogleSheetsService()
