import { Controller, Get, Patch, Put, Post, Param, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateNotificationPreferencesDto } from '../../../../packages/shared/src';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser('userId') userId: string) {
    return this.notificationsService.listForUser(userId);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post('push-token')
  async registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body('expoPushToken') expoPushToken: string,
  ) {
    return this.notificationsService.registerPushToken(userId, expoPushToken);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(userId, dto);
  }
}

