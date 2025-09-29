import Link from 'next/link'
import { BarChart3, Database, ExternalLink, Download, Settings } from 'lucide-react'
import HomeButton from '@/components/HomeButton'

export default function PowerBISetupPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Power BI Integration</h1>
              <p className="mt-2 text-gray-600">Setup and manage Power BI analytics for your surveys</p>
            </div>
            <HomeButton />
          </div>
        </div>

        {/* Setup Status */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center mb-4">
            <Settings className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Setup Status</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center p-4 border border-gray-200 rounded-lg">
              <Database className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Database Connection</p>
                <p className="text-sm text-green-600">✓ Connected to Supabase</p>
              </div>
            </div>
            
            <div className="flex items-center p-4 border border-yellow-200 rounded-lg bg-yellow-50">
              <BarChart3 className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Power BI Report</p>
                <p className="text-sm text-yellow-600">⚠ Needs Configuration</p>
              </div>
            </div>
            
            <div className="flex items-center p-4 border border-gray-200 rounded-lg">
              <ExternalLink className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">API Endpoints</p>
                <p className="text-sm text-green-600">✓ Ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Setup Instructions</h2>
          
          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-gray-900">Step 1: Create Power BI Report</h3>
              <p className="text-gray-600 mt-1">
                Create a new Power BI report and connect it to your Supabase database using the connection string below.
              </p>
              <div className="mt-2 p-3 bg-gray-100 rounded text-sm font-mono">
                Host: your-project.supabase.co<br/>
                Database: postgres<br/>
                Port: 5432<br/>
                Username: postgres<br/>
                Password: [your-password]<br/>
                SSL Mode: require
              </div>
            </div>
            
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-gray-900">Step 2: Import Data</h3>
              <p className="text-gray-600 mt-1">
                Import the following tables: Survey, Question, Response, Answer, Player
              </p>
              <div className="mt-2 flex space-x-2">
                <Link
                  href="/api/surveys/export/schema"
                  target="_blank"
                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Schema
                </Link>
              </div>
            </div>
            
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-gray-900">Step 3: Configure Environment</h3>
              <p className="text-gray-600 mt-1">
                Add your Power BI report URL to environment variables:
              </p>
              <div className="mt-2 p-3 bg-gray-100 rounded text-sm font-mono">
                POWER_BI_REPORT_URL=https://app.powerbi.com/view?r=YOUR_REPORT_ID
              </div>
            </div>
            
            <div className="border-l-4 border-orange-500 pl-4">
              <h3 className="font-medium text-gray-900">Step 4: Test Integration</h3>
              <p className="text-gray-600 mt-1">
                Once configured, each survey will have a Power BI button that opens the report with the correct filter.
              </p>
            </div>
          </div>
        </div>

        {/* Alternative: CSV Export */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Alternative: CSV Export</h2>
          <p className="text-gray-600 mb-4">
            If you prefer to import data manually, you can export CSV files for each survey and import them into Power BI.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">CSV Export Features:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Complete survey data with all responses</li>
              <li>• Body Map data with muscle names</li>
              <li>• Player information and timestamps</li>
              <li>• Ready for Power BI import</li>
            </ul>
          </div>
        </div>

        {/* Power BI Resources */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Power BI Resources</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Recommended Visualizations</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Response trends over time</li>
                <li>• Question type distribution</li>
                <li>• Player participation rates</li>
                <li>• Body Map heat visualization</li>
                <li>• Rating scale averages</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Useful DAX Measures</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Total responses per survey</li>
                <li>• Average rating scores</li>
                <li>• Most common body pain areas</li>
                <li>• Response completion rates</li>
                <li>• Time-based trends</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600">
              Check the <code className="bg-gray-200 px-1 rounded">POWER_BI_SETUP.md</code> file in your project root for detailed setup instructions and examples.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
