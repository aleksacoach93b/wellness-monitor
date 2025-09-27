# Google Sheets Integration Setup

This guide will help you set up Google Sheets integration for automatic data export to PowerBI.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

## Step 2: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `wellness-monitor-service`
   - Description: `Service account for wellness monitoring app`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

## Step 3: Generate Service Account Key

1. In the Credentials page, find your service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create new key"
5. Choose "JSON" format
6. Download the JSON file

## Step 4: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet
3. Name it "Wellness Monitor Data" (or any name you prefer)
4. Copy the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

## Step 5: Share Sheet with Service Account

1. In your Google Sheet, click "Share"
2. Add the service account email (from the JSON file) as an editor
3. The email looks like: `wellness-monitor-service@your-project.iam.gserviceaccount.com`

## Step 6: Configure Environment Variables

Create a `.env.local` file in your project root with:

```env
# Database
DATABASE_URL="file:./dev.db"

# Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID="your-google-sheet-id-here"

# Enable Google Sheets integration
ENABLE_GOOGLE_SHEETS="true"
```

### Getting the Values:

1. **GOOGLE_SERVICE_ACCOUNT_EMAIL**: From the JSON file, use the `client_email` field
2. **GOOGLE_PRIVATE_KEY**: From the JSON file, use the `private_key` field (keep the \n characters)
3. **GOOGLE_SPREADSHEET_ID**: From the Google Sheets URL

## Step 7: Test the Integration

1. Start your application: `npm run dev`
2. Create a survey and submit a response
3. Check your Google Sheet - you should see the data automatically appear
4. Use the "Export to Google Sheets" button in the admin dashboard for manual exports

## Data Structure in Google Sheets

The exported data will have the following columns:

- **Survey ID**: Unique identifier for the survey
- **Survey Title**: Name of the survey
- **Player ID**: Unique identifier for the player (if registered)
- **Player Name**: Name of the player
- **Player Email**: Email of the player
- **Submitted At**: Timestamp when the response was submitted
- **Question Columns**: One column for each question in the survey

## PowerBI Integration

Once your data is in Google Sheets:

1. Open PowerBI Desktop
2. Click "Get Data" > "More" > "Online Services" > "Google Sheets"
3. Sign in with your Google account
4. Select your wellness monitoring spreadsheet
5. Choose the sheet with your survey data
6. Transform and model the data as needed for your analytics

## Troubleshooting

### Common Issues:

1. **"Permission denied" error**: Make sure the service account email has editor access to the Google Sheet
2. **"Invalid credentials" error**: Check that the private key is correctly formatted with \n characters
3. **"Sheet not found" error**: Verify the spreadsheet ID is correct
4. **No data appearing**: Check that `ENABLE_GOOGLE_SHEETS="true"` in your environment variables

### Debug Mode:

Add this to your `.env.local` to see detailed logs:
```env
DEBUG_GOOGLE_SHEETS="true"
```

## Security Notes

- Never commit the `.env.local` file to version control
- Keep your service account JSON file secure
- Regularly rotate your service account keys
- Use the principle of least privilege for service account permissions

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Check the server logs for detailed error information
3. Verify all environment variables are set correctly
4. Test the Google Sheets API access manually using the Google API Explorer
