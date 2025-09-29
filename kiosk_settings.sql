-- Create kiosk_settings table
CREATE TABLE IF NOT EXISTS "kiosk_settings" (
  "id" TEXT NOT NULL,
  "password" TEXT NOT NULL DEFAULT '',
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kiosk_settings_pkey" PRIMARY KEY ("id")
);

-- Insert default settings
INSERT INTO "kiosk_settings" ("id", "password", "isEnabled", "createdAt", "updatedAt")
VALUES ('default', '', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
