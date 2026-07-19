/**
 * Runtime self-heal for Live Ops tables when production skipped prisma db push.
 * Safe to call repeatedly (IF NOT EXISTS).
 */

import { prisma } from '@/lib/prisma'

let ensurePromise: Promise<void> | null = null

async function createOpsTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ops_rules" (
      "id" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "surveyId" TEXT,
      "name" TEXT NOT NULL,
      "metric" TEXT NOT NULL,
      "operator" TEXT NOT NULL,
      "threshold" DOUBLE PRECISION NOT NULL,
      "severity" TEXT NOT NULL DEFAULT 'WATCH',
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ops_rules_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ops_rules_teamId_idx" ON "ops_rules"("teamId");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ops_rules_teamId_enabled_idx" ON "ops_rules"("teamId", "enabled");
  `)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "ops_rules"
        ADD CONSTRAINT "ops_rules_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ops_interventions" (
      "id" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "surveyId" TEXT,
      "ruleId" TEXT NOT NULL,
      "playerId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "severity" TEXT NOT NULL,
      "metric" TEXT NOT NULL,
      "value" DOUBLE PRECISION,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "note" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "acknowledgedAt" TIMESTAMP(3),
      "resolvedAt" TIMESTAMP(3),
      CONSTRAINT "ops_interventions_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ops_interventions_ruleId_playerId_date_key"
      ON "ops_interventions"("ruleId", "playerId", "date");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ops_interventions_teamId_date_idx"
      ON "ops_interventions"("teamId", "date");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ops_interventions_teamId_status_idx"
      ON "ops_interventions"("teamId", "status");
  `)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "ops_interventions"
        ADD CONSTRAINT "ops_interventions_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "ops_interventions"
        ADD CONSTRAINT "ops_interventions_ruleId_fkey"
        FOREIGN KEY ("ruleId") REFERENCES "ops_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ops_metrics" (
      "id" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "surveyId" TEXT,
      "name" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "config" JSONB NOT NULL,
      "formatting" JSONB,
      "showInTable" BOOLEAN NOT NULL DEFAULT true,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ops_metrics_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ops_metrics_teamId_key_key"
      ON "ops_metrics"("teamId", "key");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ops_metrics_teamId_idx" ON "ops_metrics"("teamId");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ops_metrics_teamId_enabled_idx"
      ON "ops_metrics"("teamId", "enabled");
  `)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "ops_metrics"
        ADD CONSTRAINT "ops_metrics_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
}

/** Ensure Live Ops rule/metric tables exist (once per process). */
export async function ensureOpsSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = createOpsTables().catch((err) => {
      ensurePromise = null
      throw err
    })
  }
  await ensurePromise
}
