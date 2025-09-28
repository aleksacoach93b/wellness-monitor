-- Migration script for recurring survey functionality
-- Run this in Supabase SQL Editor

-- Add recurring survey columns to surveys table
ALTER TABLE surveys 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_start_time TEXT,
ADD COLUMN IF NOT EXISTS daily_end_time TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Belgrade';

-- Add comments for documentation
COMMENT ON COLUMN surveys.is_recurring IS 'Whether this survey repeats daily';
COMMENT ON COLUMN surveys.start_date IS 'When the recurring survey period starts';
COMMENT ON COLUMN surveys.end_date IS 'When the recurring survey period ends';
COMMENT ON COLUMN surveys.daily_start_time IS 'Daily start time in HH:MM format (e.g., 06:00)';
COMMENT ON COLUMN surveys.daily_end_time IS 'Daily end time in HH:MM format (e.g., 11:00)';
COMMENT ON COLUMN surveys.timezone IS 'Timezone for the survey (default: Europe/Belgrade)';

-- Create index for better performance on recurring surveys
CREATE INDEX IF NOT EXISTS idx_surveys_recurring ON surveys(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_surveys_active_recurring ON surveys(is_active, is_recurring) WHERE is_recurring = true;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'surveys' 
AND column_name IN ('is_recurring', 'start_date', 'end_date', 'daily_start_time', 'daily_end_time', 'timezone')
ORDER BY ordinal_position;
