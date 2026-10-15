-- AlterTable CalendarEvent
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT DEFAULT 'primary';
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "colorId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "etag" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_googleCalendarId_idx" ON "CalendarEvent"("googleCalendarId");

-- CreateTable GoogleCalendarSyncState
CREATE TABLE IF NOT EXISTS "GoogleCalendarSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "calendarName" TEXT,
    "backgroundColor" TEXT,
    "foregroundColor" TEXT,
    "channelId" TEXT,
    "resourceId" TEXT,
    "expiration" TIMESTAMP(3),
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleCalendarSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarSyncState_channelId_key" ON "GoogleCalendarSyncState"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarSyncState_userId_calendarId_key" ON "GoogleCalendarSyncState"("userId", "calendarId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncState_userId_idx" ON "GoogleCalendarSyncState"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncState_channelId_idx" ON "GoogleCalendarSyncState"("channelId");
