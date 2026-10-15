-- Apply explicitly to the reviewed target database; builds never execute this file.
BEGIN;

-- CreateTable
CREATE TABLE "public"."pvt_configs" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "durationSeconds" INTEGER NOT NULL DEFAULT 180,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pvt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pvt_sessions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "practice" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "localDate" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "raw" JSONB,
    "summary" JSONB,

    CONSTRAINT "pvt_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pvt_auth_windows" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pvt_auth_windows_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "pvt_configs_surveyId_key" ON "public"."pvt_configs"("surveyId");

-- CreateIndex
CREATE INDEX "pvt_configs_teamId_idx" ON "public"."pvt_configs"("teamId");

-- CreateIndex
CREATE INDEX "pvt_sessions_teamId_localDate_idx" ON "public"."pvt_sessions"("teamId", "localDate");

-- CreateIndex
CREATE INDEX "pvt_sessions_playerId_surveyId_startedAt_idx" ON "public"."pvt_sessions"("playerId", "surveyId", "startedAt");

-- CreateIndex
CREATE INDEX "pvt_auth_windows_expiresAt_idx" ON "public"."pvt_auth_windows"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."pvt_configs" ADD CONSTRAINT "pvt_configs_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pvt_configs" ADD CONSTRAINT "pvt_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pvt_sessions" ADD CONSTRAINT "pvt_sessions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pvt_sessions" ADD CONSTRAINT "pvt_sessions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pvt_sessions" ADD CONSTRAINT "pvt_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."players"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
