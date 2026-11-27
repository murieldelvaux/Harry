import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { DailyBriefingService } from './daily-briefing.service';
import { DatabaseModule } from '../../database/database.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, WhatsappModule, AuthModule],
  controllers: [CalendarController],
  providers: [CalendarService, DailyBriefingService],
  exports: [CalendarService, DailyBriefingService],
})
export class CalendarModule {}
