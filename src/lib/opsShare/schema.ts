import { prisma } from "@/lib/prisma";
let ready: Promise<void> | null = null;
/** Additive sharing-only tables; never modifies existing wellness tables. */
export function ensureOpsShareSchema() {
  if (!ready)
    ready = prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(673891122)");
          await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "public"."ops_share_settings" (
    "teamId" TEXT NOT NULL,
    "ownerAdminId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "sessionHours" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_share_settings_pkey" PRIMARY KEY ("teamId")
);`);
          await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "public"."ops_share_links" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_share_links_pkey" PRIMARY KEY ("id")
);`);
          await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "public"."ops_share_sessions" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ops_share_sessions_pkey" PRIMARY KEY ("id")
);`);
          await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "public"."ops_share_events" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "linkId" TEXT,
    "sessionId" TEXT,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_share_events_pkey" PRIMARY KEY ("id")
);`);
          await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "public"."ops_share_blocked_ips" (
    "teamId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_share_blocked_ips_pkey" PRIMARY KEY ("teamId","ip")
);`);
          await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "public"."ops_share_auth_windows" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_share_auth_windows_pkey" PRIMARY KEY ("key")
);`);
          await tx.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "ops_share_links_token_key" ON "public"."ops_share_links"("token");`,
          );
          await tx.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "ops_share_links_teamId_createdAt_idx" ON "public"."ops_share_links"("teamId", "createdAt");`,
          );
          await tx.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "ops_share_sessions_tokenHash_key" ON "public"."ops_share_sessions"("tokenHash");`,
          );
          await tx.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "ops_share_sessions_linkId_createdAt_idx" ON "public"."ops_share_sessions"("linkId", "createdAt");`,
          );
          await tx.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "ops_share_events_teamId_createdAt_id_idx" ON "public"."ops_share_events"("teamId", "createdAt", "id");`,
          );
          await tx.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "ops_share_auth_windows_expiresAt_idx" ON "public"."ops_share_auth_windows"("expiresAt");`,
          );
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN ALTER TABLE "public"."ops_share_settings" ADD CONSTRAINT "ops_share_settings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
          );
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN ALTER TABLE "public"."ops_share_links" ADD CONSTRAINT "ops_share_links_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."ops_share_settings"("teamId") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
          );
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN ALTER TABLE "public"."ops_share_sessions" ADD CONSTRAINT "ops_share_sessions_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "public"."ops_share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
          );
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN ALTER TABLE "public"."ops_share_events" ADD CONSTRAINT "ops_share_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
          );
          await tx.$executeRawUnsafe(
            `DO $$ BEGIN ALTER TABLE "public"."ops_share_blocked_ips" ADD CONSTRAINT "ops_share_blocked_ips_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
          );
        },
        { timeout: 20000 },
      )
      .catch((e) => {
        ready = null;
        throw e;
      });
  return ready;
}
