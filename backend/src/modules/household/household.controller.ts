import { Controller, Get, Post, Put, Delete, Body } from '@nestjs/common';
import { HouseholdService } from './household.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateHouseholdDto,
  JoinHouseholdDto,
  UpdateHouseholdDto,
} from '../../../../packages/shared/src';

@Controller('household')
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get('current')
  async getCurrent(@CurrentUser('userId') userId: string) {
    return this.householdService.getHousehold(userId);
  }

  @Post('create')
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.householdService.create(userId, dto);
  }

  @Post('join')
  async join(
    @CurrentUser('userId') userId: string,
    @Body() dto: JoinHouseholdDto,
  ) {
    return this.householdService.join(userId, dto);
  }

  @Put('current')
  async update(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateHouseholdDto,
  ) {
    return this.householdService.update(userId, dto);
  }

  @Delete('current')
  async delete(@CurrentUser('userId') userId: string) {
    return this.householdService.delete(userId);
  }

  @Post('leave')
  async leave(@CurrentUser('userId') userId: string) {
    return this.householdService.leave(userId);
  }
}
