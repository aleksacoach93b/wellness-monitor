-- Additive operational tracking only. Existing answer/export tables are untouched.
CREATE TABLE IF NOT EXISTS "rhr_observations" (
 "id" TEXT PRIMARY KEY,
 "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "surveyId" TEXT NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "questionId" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "localDate" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "finishedAt" TIMESTAMP(3),
 "status" TEXT NOT NULL,
 "source" TEXT NOT NULL,
 "position" TEXT,
 "protocolVersion" TEXT NOT NULL,
 "acquisitionVersion" TEXT,
 "platform" TEXT NOT NULL,
 "browser" TEXT NOT NULL,
 "reason" TEXT,
 "bpm" INTEGER,
 "fps" DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS "rhr_observations_teamId_surveyId_localDate_idx" ON "rhr_observations"("teamId","surveyId","localDate");
CREATE INDEX IF NOT EXISTS "rhr_observations_playerId_surveyId_localDate_idx" ON "rhr_observations"("playerId","surveyId","localDate");
