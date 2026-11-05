-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('COMPLETED', 'PLANNED');

-- AlterTable
ALTER TABLE "CalendarEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FitnessIntegration" ADD COLUMN     "calendarUrl" TEXT;

-- AlterTable
ALTER TABLE "GoogleCalendarSyncState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShoppingItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkoutActivity" ADD COLUMN     "status" "WorkoutStatus" NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE INDEX "WorkoutActivity_status_startedAt_idx" ON "WorkoutActivity"("status", "startedAt");
