-- AlterTable
ALTER TABLE "WorkoutActivity" ADD COLUMN     "calendarEventId" TEXT;

-- CreateIndex
CREATE INDEX "WorkoutActivity_calendarEventId_idx" ON "WorkoutActivity"("calendarEventId");

-- AddForeignKey
ALTER TABLE "WorkoutActivity" ADD CONSTRAINT "WorkoutActivity_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
