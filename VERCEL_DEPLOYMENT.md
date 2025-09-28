# Vercel Deployment Guide

## Problem Fixed
The build was failing because the application was trying to connect to the database during the build process. This has been resolved by:

1. Adding `export const dynamic = 'force-dynamic'` to all pages that use Prisma
2. Adding proper error handling for database connections
3. Making all database-dependent pages render dynamically instead of statically
4. Removed Google Sheets integration (replaced with Power BI integration)

## Environment Variables Setup

### 1. Supabase Database Setup
1. Go to [Supabase](https://supabase.com) and create a new project
2. Go to Settings > Database
3. Copy the connection string (it looks like: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)
4. Replace `[PASSWORD]` with your actual database password

### 2. Vercel Environment Variables
1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variable:

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

### 3. Database Migration
After setting up the environment variables, you need to run the database migration:

1. Go to your Vercel project dashboard
2. Navigate to **Deployments** tab
3. Click on the latest deployment
4. Go to **Functions** tab
5. Create a new function or use the existing API route to run:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

Alternatively, you can run these commands locally and push the changes:

```bash
# Set your production DATABASE_URL locally
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Commit and push
git add .
git commit -m "Add database migration"
git push
```

## Changes Made

### Pages Updated with Dynamic Rendering:
- `/src/app/page.tsx` - Home page
- `/src/app/players/page.tsx` - Players selection page
- `/src/app/admin/page.tsx` - Admin dashboard
- `/src/app/admin/players/page.tsx` - Admin players management
- `/src/app/survey/[id]/page.tsx` - Survey page
- `/src/app/player/[id]/page.tsx` - Player profile page

### Error Handling Added:
- All database calls now have try-catch blocks
- Pages gracefully handle database connection failures
- Default values are provided when database is unavailable

## Testing the Deployment

1. After setting up environment variables, trigger a new deployment
2. The build should now complete successfully
3. Test the application functionality:
   - Home page should load (may show empty state if no data)
   - Players page should load
   - Admin pages should load
   - Survey functionality should work

## Troubleshooting

If you still encounter issues:

1. **Check Environment Variables**: Ensure all required variables are set in Vercel
2. **Database Connection**: Verify your Supabase connection string is correct
3. **Build Logs**: Check Vercel build logs for any remaining errors
4. **Database Migration**: Ensure the database schema is properly migrated

## Power BI Integration

### Connecting Power BI to Supabase
1. Open Power BI Desktop
2. Click **Get Data** → **Database** → **PostgreSQL database**
3. Enter connection details:
   - **Server**: `db.anxxbhyujbxyiwnutfwd.supabase.co`
   - **Database**: `postgres`
   - **Data Connectivity mode**: DirectQuery (recommended for real-time data)
4. Click **OK** and enter credentials:
   - **Username**: `postgres`
   - **Password**: `Teodor2025.`
5. Select tables you want to import:
   - `players` - Player information
   - `surveys` - Survey definitions
   - `questions` - Survey questions
   - `responses` - Survey responses
   - `answers` - Individual answers

### Power BI Data Model
- **Players** ↔ **Responses** (One-to-Many)
- **Surveys** ↔ **Questions** (One-to-Many)
- **Surveys** ↔ **Responses** (One-to-Many)
- **Responses** ↔ **Answers** (One-to-Many)
- **Questions** ↔ **Answers** (One-to-Many)

### Recommended Visualizations
1. **Player Performance Dashboard**
   - Response trends over time
   - Body map pain visualization
   - Survey completion rates

2. **Survey Analytics**
   - Question response distributions
   - Most/least answered questions
   - Response patterns by player

3. **Health Monitoring**
   - Pain level trends
   - Body area analysis
   - Wellness score tracking

## Next Steps

1. Set up your Supabase database
2. Configure Vercel environment variables
3. Run database migrations
4. Deploy and test the application
5. Connect Power BI to Supabase for data visualization
