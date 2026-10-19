import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from '../../../../packages/shared/src';

import { DailyBriefingService } from './daily-briefing.service';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly dailyBriefingService: DailyBriefingService,
  ) {}

  @Post('daily-briefing/trigger')
  async triggerDailyBriefing(@CurrentUser('userId') userId: string) {
    return this.dailyBriefingService.triggerUserDailyBriefing(userId);
  }

  @Get()
  async findAll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('householdId') householdId: string | null,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.calendarService.findAll(userId, householdId, start, end);
  }

  @Get('list-calendars')
  async listCalendars(@CurrentUser('userId') userId: string) {
    return this.calendarService.listCalendars(userId);
  }

  @Get('context7-anchor')
  async getContext7Anchor() {
    return {
      anchor: this.calendarService.getContext7Anchor(),
    };
  }

  @Post('watch')
  async setupWatch(
    @CurrentUser('userId') userId: string,
    @Body('callbackBaseUrl') callbackBaseUrl: string,
    @Req() req: Request,
  ) {
    const host = callbackBaseUrl || `${req.protocol}://${req.get('host')}/api`;
    return this.calendarService.setupPushNotifications(userId, host);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleGooglePushNotification(@Headers() headers: Record<string, string>) {
    return this.calendarService.handlePushNotification(headers);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @CurrentUser('householdId') householdId: string | null,
    @Param('id') id: string,
  ) {
    return this.calendarService.findOne(id, userId, householdId);
  }

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @CurrentUser('householdId') householdId: string | null,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.create(userId, householdId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(userId, id, dto);
  }

  @Delete(':id')
  async delete(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.calendarService.delete(userId, id);
  }

  @Post('sync-google')
  async syncWithGoogle(
    @CurrentUser('userId') userId: string,
    @CurrentUser('householdId') householdId: string | null,
  ) {
    return this.calendarService.syncWithGoogle(userId, householdId);
  }
}
