-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sharePrivateExpenses" BOOLEAN NOT NULL DEFAULT false;
