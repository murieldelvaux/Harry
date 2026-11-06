import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  CreateSettlementDto,
} from '../../../../packages/shared/src';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('scope') scope?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    return this.expensesService.findAll(userId, { month, startDate, endDate, scope, type, category });
  }

  @Get('analytics')
  async getAnalytics(
    @CurrentUser('userId') userId: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('scope') scope?: string,
  ) {
    return this.expensesService.getAnalytics(userId, { month, startDate, endDate, scope });
  }

  @Get('settlements/preview')
  async getSettlementPreview(
    @CurrentUser('userId') userId: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.getSettlementPreview(userId, { month, startDate, endDate });
  }

  @Get('settlements')
  async listSettlements(@CurrentUser('userId') userId: string) {
    return this.expensesService.listSettlements(userId);
  }

  @Post('settlements')
  async createSettlement(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.expensesService.createSettlement(userId, dto);
  }

  @Patch('settlements/:id/settle')
  async settleAccountClosing(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.markSettlementAsPaid(userId, id);
  }

  @Delete('settlements/:id')
  async reopenSettlement(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.reopenSettlement(userId, id);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, userId, dto);
  }

  @Delete(':id')
  async delete(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.delete(id, userId);
  }
}
