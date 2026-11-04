-- CreateEnum (Idempotent)
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('SHARED_EXPENSE_CREATED', 'ACCOUNT_CLOSING_CREATED', 'ACCOUNT_CLOSING_SETTLED', 'SHARED_EVENT_CREATED', 'SHARED_TASK_CREATED', 'EVENT_REMINDER', 'TASK_REMINDER', 'WORKOUT_LOGGED', 'WORKOUT_CHEER', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkoutModality" AS ENUM ('RUNNING', 'STRENGTH', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FitnessProvider" AS ENUM ('MANUAL', 'STRAVA', 'MFIT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "periodicSummaryTime" TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS "lastDailySentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastDigestSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expoPushToken" TEXT;

-- AlterTable Household
ALTER TABLE "Household"
  ADD COLUMN IF NOT EXISTS "periodicSummaryTime" TEXT DEFAULT '08:00';

-- AlterTable Expense
ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "paidByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "settlementId" TEXT;

-- AlterTable ShoppingItem
ALTER TABLE "ShoppingItem"
  ADD COLUMN IF NOT EXISTS "normalizedName" TEXT;

-- AlterTable CalendarEvent
ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Settlement
CREATE TABLE IF NOT EXISTS "Settlement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalShared" DECIMAL(10,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "transferAmount" DECIMAL(10,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "closedByUserId" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable RefreshToken
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "householdId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "metadata" JSONB,
    "channels" TEXT[],
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable NotificationPreference
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enableInApp" BOOLEAN NOT NULL DEFAULT true,
    "enablePush" BOOLEAN NOT NULL DEFAULT true,
    "enableWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable WorkoutActivity
CREATE TABLE IF NOT EXISTS "WorkoutActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" TEXT,
    "modality" "WorkoutModality" NOT NULL,
    "provider" "FitnessProvider" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMinutes" INTEGER NOT NULL,
    "calories" INTEGER,
    "distanceKm" DECIMAL(6,2),
    "paceSecondsPerKm" INTEGER,
    "elevationGainM" INTEGER,
    "totalVolumeKg" DECIMAL(10,2),
    "setsCount" INTEGER,
    "exercisesJson" JSONB,
    "scope" "RecordScope" NOT NULL DEFAULT 'SHARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable FitnessIntegration
CREATE TABLE IF NOT EXISTS "FitnessIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "FitnessProvider" NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "apiKey" TEXT,
    "athleteId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_paidByUserId_idx" ON "Expense"("paidByUserId");
CREATE INDEX IF NOT EXISTS "Expense_settlementId_idx" ON "Expense"("settlementId");
CREATE INDEX IF NOT EXISTS "ShoppingItem_householdId_normalizedName_idx" ON "ShoppingItem"("householdId", "normalizedName");
CREATE INDEX IF NOT EXISTS "Settlement_householdId_status_idx" ON "Settlement"("householdId", "status");
CREATE INDEX IF NOT EXISTS "Settlement_householdId_periodStart_periodEnd_idx" ON "Settlement"("householdId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutActivity_provider_externalId_key" ON "WorkoutActivity"("provider", "externalId");
CREATE INDEX IF NOT EXISTS "WorkoutActivity_householdId_startedAt_idx" ON "WorkoutActivity"("householdId", "startedAt");
CREATE INDEX IF NOT EXISTS "WorkoutActivity_userId_startedAt_idx" ON "WorkoutActivity"("userId", "startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "FitnessIntegration_userId_provider_key" ON "FitnessIntegration"("userId", "provider");

-- AddForeignKey (Idempotent)
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkoutActivity" ADD CONSTRAINT "WorkoutActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkoutActivity" ADD CONSTRAINT "WorkoutActivity_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FitnessIntegration" ADD CONSTRAINT "FitnessIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

