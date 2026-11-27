-- Additive non-destructive migration for Google OAuth token expiry and Calendar webhook secret
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "GoogleCalendarSyncState" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncState_expiration_idx" ON "GoogleCalendarSyncState"("expiration");
