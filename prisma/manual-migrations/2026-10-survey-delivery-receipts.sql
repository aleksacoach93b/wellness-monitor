-- Additive delivery ledger. Existing responses, answers and CSV columns are unchanged.
CREATE TABLE IF NOT EXISTS "survey_submission_receipts" (
 "id" TEXT PRIMARY KEY, "surveyId" TEXT NOT NULL, "playerId" TEXT,
 "sessionType" TEXT, "requestHash" TEXT NOT NULL, "responseId" TEXT NOT NULL,
 "clientCreatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "survey_submission_receipts_surveyId_playerId_createdAt_idx" ON "survey_submission_receipts"("surveyId","playerId","createdAt");
