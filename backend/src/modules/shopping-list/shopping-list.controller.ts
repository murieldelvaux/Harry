import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateShoppingItemDto,
  UpdateShoppingItemDto,
  RecordScope,
} from '../../../../packages/shared/src';

@Controller('shopping-list')
export class ShoppingListController {
  constructor(private readonly service: ShoppingListService) {}

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateShoppingItemDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Post('batch')
  async createBatch(
    @CurrentUser('userId') userId: string,
    @Body('items') items: Array<{ name: string; quantity?: string; category?: string; scope?: RecordScope }>,
  ) {
    return this.service.createBatch(userId, items || []);
  }

  @Post('import')
  async importSpreadsheet(
    @CurrentUser('userId') userId: string,
    @Body() dto: { text?: string; fileBase64?: string; filename?: string; scope?: RecordScope },
  ) {
    return this.service.importSpreadsheet(userId, dto);
  }

  @Get('analytics/top-items')
  async getTopItems(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getTopItems(userId, limit ? Number(limit) : 15);
  }

  @Post('readd')
  async readdItem(
    @CurrentUser('userId') userId: string,
    @Body() dto: { name: string; category?: string; quantity?: string; scope?: RecordScope },
  ) {
    return this.service.readdItem(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query('scope') scope?: RecordScope,
  ) {
    return this.service.findAll(userId, scope);
  }

  @Patch(':id/toggle')
  async toggleComplete(@Param('id') id: string) {
    return this.service.toggleComplete(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShoppingItemDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete('completed')
  async clearCompleted(@CurrentUser('userId') userId: string) {
    return this.service.clearCompleted(userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
