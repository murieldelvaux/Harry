import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { WorkoutsService } from './workouts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateWorkoutDto,
  ConnectFitnessProviderDto,
  FitnessProvider,
} from '../../../../packages/shared/src';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get()
  async getDashboard(@CurrentUser('userId') userId: string) {
    return this.workoutsService.getDashboard(userId);
  }

  @Post()
  async createWorkout(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workoutsService.createWorkout(userId, dto);
  }

  @Get('integrations/strava/auth-url')
  async getStravaAuthUrl(
    @CurrentUser('userId') userId: string,
    @Query('redirectUri') redirectUri?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.workoutsService.getStravaAuthUrl(userId, redirectUri, clientId);
  }

  @Public()
  @Get('integrations/strava/callback')
  async handleStravaOAuthCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    if (!code || !userId) {
      return res.redirect(`${frontendUrl}/workouts?strava=error`);
    }

    try {
      await this.workoutsService.connectProvider(userId, {
        provider: FitnessProvider.STRAVA,
        authCode: code,
      });
      await this.workoutsService.syncProvider(userId, FitnessProvider.STRAVA);
      return res.redirect(`${frontendUrl}/workouts?strava=connected`);
    } catch {
      return res.redirect(`${frontendUrl}/workouts?strava=error`);
    }
  }

  @Public()
  @Get('webhooks/strava')
  verifyStravaWebhook(@Query() query: Record<string, string>) {
    return this.workoutsService.verifyStravaWebhook(query);
  }

  @Public()
  @Post('webhooks/strava')
  @HttpCode(HttpStatus.OK)
  async handleStravaWebhookEvent(@Body() payload: any) {
    return this.workoutsService.handleStravaWebhookEvent(payload);
  }

  @Post('integrations/connect')
  async connectProvider(
    @CurrentUser('userId') userId: string,
    @Body() dto: ConnectFitnessProviderDto,
  ) {
    return this.workoutsService.connectProvider(userId, dto);
  }

  @Post('integrations/sync')
  async syncProvider(
    @CurrentUser('userId') userId: string,
    @Body('provider') provider: FitnessProvider,
  ) {
    return this.workoutsService.syncProvider(
      userId,
      provider || FitnessProvider.STRAVA,
    );
  }

  @Delete('integrations/:provider')
  async disconnectProvider(
    @CurrentUser('userId') userId: string,
    @Param('provider') provider: FitnessProvider,
  ) {
    return this.workoutsService.disconnectProvider(userId, provider);
  }

  @Post(':id/cheer')
  async cheerWorkout(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body('message') message?: string,
  ) {
    return this.workoutsService.cheerWorkout(userId, id, message);
  }

  @Delete(':id')
  async deleteWorkout(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.workoutsService.deleteWorkout(userId, id);
  }
}
