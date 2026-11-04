import { AiParserService } from '../ai-parser/ai-parser.service';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateShoppingItemDto,
  UpdateShoppingItemDto,
  RecordScope,
  ShoppingItemDto,
  TopShoppingItemDto,
  NotificationType,
} from '../../../../packages/shared/src';

export function normalizeShoppingItemName(raw: string): string {
  const base = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) return 'item';

  // Normalização leve de plural em português para agrupar itens idênticos (ex.: "Ovos" e "Ovo", "Bananas" e "Banana")
  const tokens = base.split(' ').map((word) => {
    if (word.length <= 3) return word;
    if (['arroz', 'feijao', 'aveia', 'leite', 'cafe', 'acucar', 'agua', 'queijo', 'presunto', 'macarrao', ' sabao'].includes(word)) {
      return word;
    }
    if (word.endsWith('oes')) return word.slice(0, -3) + 'ao';
    if (word.endsWith('aes')) return word.slice(0, -3) + 'ao';
    if (word.endsWith('is') && word.length > 4) return word.slice(0, -2) + 'l';
    if (word.endsWith('ns') && word.length > 4) return word.slice(0, -2) + 'm';
    if (word.endsWith('s') && !word.endsWith('ss') && !['lapis', 'tenis', 'pires', 'onibus', 'virus'].includes(word)) {
      return word.slice(0, -1);
    }
    return word;
  });

  return tokens.join(' ');
}

@Injectable()
export class ShoppingListService {
  constructor(
    private prisma: PrismaService,
    private aiParser: AiParserService,
    private realtimeService: RealtimeService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateShoppingItemDto): Promise<ShoppingItemDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true, name: true },
    });

    const isShared = dto.scope === RecordScope.SHARED && !!user?.householdId;
    const cleanName = dto.name.trim();
    const normalizedName = normalizeShoppingItemName(cleanName);

    const item = await this.prisma.shoppingItem.create({
      data: {
        name: cleanName,
        normalizedName,
        quantity: dto.quantity ? dto.quantity.trim() : '1',
        category: dto.category ? dto.category.trim() : 'Geral',
        scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
        userId,
        householdId: isShared ? user?.householdId : null,
      },
    });

    this.realtimeService.emit({
      type: 'SHOPPING_UPDATED',
      userId,
      householdId: isShared ? user?.householdId : null,
      data: item,
    });

    if (isShared && user?.householdId) {
      await this.notificationsService
        .notifyHouseholdPartners({
          actorUserId: userId,
          householdId: user.householdId,
          type: NotificationType.SYSTEM,
          title: `🛒 Lista de compras: ${cleanName}`,
          body: `${user.name?.split(' ')[0] || 'Seu parceiro(a)'} adicionou "${cleanName}" (${item.quantity || '1'}) na lista compartilhada.`,
          deepLink: '/(tabs)/shopping-list',
          metadata: { shoppingItemId: item.id, normalizedName },
        })
        .catch(() => {});
    }

    return this.mapItem(item);
  }

  async createBatch(
    userId: string,
    items: Array<{ name: string; quantity?: string; category?: string; scope?: RecordScope }>,
  ): Promise<ShoppingItemDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true, name: true },
    });

    const createdItems: ShoppingItemDto[] = [];

    for (const raw of items) {
      if (!raw.name || !raw.name.trim()) continue;
      const isShared = raw.scope !== RecordScope.PRIVATE && !!user?.householdId;
      const cleanName = raw.name.trim();

      const created = await this.prisma.shoppingItem.create({
        data: {
          name: cleanName,
          normalizedName: normalizeShoppingItemName(cleanName),
          quantity: raw.quantity ? raw.quantity.trim() : '1',
          category: raw.category ? raw.category.trim() : 'Geral',
          scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
          userId,
          householdId: isShared ? user?.householdId : null,
        },
      });
      createdItems.push(this.mapItem(created));
    }

    if (createdItems.length > 0) {
      this.realtimeService.emit({
        type: 'SHOPPING_UPDATED',
        userId,
        householdId: user?.householdId || null,
      });
    }

    return createdItems;
  }

  async findAll(userId: string, scope?: RecordScope): Promise<ShoppingItemDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    let whereClause: any;

    if (user?.householdId) {
      if (scope === RecordScope.SHARED) {
        whereClause = { householdId: user.householdId, scope: RecordScope.SHARED };
      } else if (scope === RecordScope.PRIVATE) {
        whereClause = { userId, scope: RecordScope.PRIVATE };
      } else {
        whereClause = {
          OR: [
            { userId, scope: RecordScope.PRIVATE },
            { householdId: user.householdId, scope: RecordScope.SHARED },
          ],
        };
      }
    } else {
      whereClause = { userId };
    }

    const items = await this.prisma.shoppingItem.findMany({
      where: whereClause,
      orderBy: [{ isCompleted: 'asc' }, { createdAt: 'desc' }],
    });

    return items.map((it) => this.mapItem(it));
  }

  /**
   * Task 10: Ranking inteligente dos itens mais comprados/adicionados pelo casal
   */
  async getTopItems(userId: string, limit = 15): Promise<TopShoppingItemDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    const whereClause: any = user?.householdId
      ? {
          OR: [
            { householdId: user.householdId, scope: RecordScope.SHARED },
            { userId, scope: RecordScope.PRIVATE },
          ],
        }
      : { userId };

    const allItems = await this.prisma.shoppingItem.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    const groups = new Map<
      string,
      {
        normalizedName: string;
        displayName: string;
        category: string;
        purchaseCount: number;
        completedCount: number;
        lastAddedAt: Date;
        firstAddedAt: Date;
        isCurrentlyInPendingList: boolean;
      }
    >();

    for (const item of allItems) {
      const norm = item.normalizedName
        ? normalizeShoppingItemName(item.normalizedName)
        : normalizeShoppingItemName(item.name);

      const existing = groups.get(norm);
      if (!existing) {
        groups.set(norm, {
          normalizedName: norm,
          displayName: item.name,
          category: item.category || 'Geral',
          purchaseCount: 1,
          completedCount: item.isCompleted ? 1 : 0,
          lastAddedAt: item.createdAt,
          firstAddedAt: item.createdAt,
          isCurrentlyInPendingList: !item.isCompleted,
        });
      } else {
        existing.purchaseCount += 1;
        if (item.isCompleted) existing.completedCount += 1;
        if (item.createdAt > existing.lastAddedAt) {
          existing.lastAddedAt = item.createdAt;
          existing.displayName = item.name;
          if (item.category) existing.category = item.category;
        }
        if (item.createdAt < existing.firstAddedAt) {
          existing.firstAddedAt = item.createdAt;
        }
        if (!item.isCompleted) {
          existing.isCurrentlyInPendingList = true;
        }
      }
    }

    const computeFrequencyLabel = (count: number, firstDate: Date, lastDate: Date): string => {
      if (count >= 6) return 'Toda semana';
      if (count >= 4) return 'Muito frequente';
      if (count >= 2) {
        const diffDays = Math.max(
          1,
          Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)),
        );
        const avgDays = diffDays / (count - 1);
        if (avgDays <= 9) return 'Semanal';
        if (avgDays <= 20) return 'Quinzenal';
        return 'Recorrente';
      }
      return '1x na lista';
    };

    return Array.from(groups.values())
      .sort((a, b) => {
        if (b.purchaseCount !== a.purchaseCount) return b.purchaseCount - a.purchaseCount;
        if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
        return b.lastAddedAt.getTime() - a.lastAddedAt.getTime();
      })
      .slice(0, limit)
      .map((g) => ({
        normalizedName: g.normalizedName,
        displayName: g.displayName,
        category: g.category,
        purchaseCount: g.purchaseCount,
        completedCount: g.completedCount,
        lastAddedAt: g.lastAddedAt.toISOString(),
        frequencyLabel: computeFrequencyLabel(g.purchaseCount, g.firstAddedAt, g.lastAddedAt),
        isCurrentlyInList: g.isCurrentlyInPendingList,
      }));
  }

  /**
   * Task 10: Adicionar novamente à lista a partir do ranking de mais comprados
   */
  async readdItem(
    userId: string,
    dto: { name: string; category?: string; quantity?: string; scope?: RecordScope },
  ): Promise<ShoppingItemDto> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Informe o nome do item para adicionar novamente.');
    }

    return this.create(userId, {
      name: dto.name.trim(),
      category: dto.category || 'Geral',
      quantity: dto.quantity || '1',
      scope: dto.scope || RecordScope.SHARED,
    });
  }

  async toggleComplete(id: string): Promise<ShoppingItemDto> {
    const item = await this.prisma.shoppingItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item da lista de compras não encontrado');

    const updated = await this.prisma.shoppingItem.update({
      where: { id },
      data: { isCompleted: !item.isCompleted },
    });

    this.realtimeService.emit({
      type: 'SHOPPING_UPDATED',
      userId: updated.userId,
      householdId: updated.householdId,
      data: updated,
    });

    return this.mapItem(updated);
  }

  async update(id: string, dto: UpdateShoppingItemDto): Promise<ShoppingItemDto> {
    const item = await this.prisma.shoppingItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item da lista de compras não encontrado');

    const updated = await this.prisma.shoppingItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
          normalizedName: normalizeShoppingItemName(dto.name.trim()),
        }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity ? dto.quantity.trim() : null }),
        ...(dto.category !== undefined && { category: dto.category ? dto.category.trim() : null }),
        ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
        ...(dto.scope !== undefined && { scope: dto.scope as any }),
      },
    });

    return this.mapItem(updated);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    await this.prisma.shoppingItem.delete({ where: { id } });
    return { success: true };
  }

  async clearCompleted(userId: string): Promise<{ count: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    const whereClause: any = {
      isCompleted: true,
      ...(user?.householdId
        ? {
            OR: [
              { userId, scope: RecordScope.PRIVATE },
              { householdId: user.householdId, scope: RecordScope.SHARED },
            ],
          }
        : { userId }),
    };

    const result = await this.prisma.shoppingItem.deleteMany({
      where: whereClause,
    });

    return { count: result.count };
  }

  async importSpreadsheet(
    userId: string,
    dto: { text?: string; base64?: string; filename?: string; mimeType?: string; scope?: RecordScope },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    let parsedResult;
    if (dto.base64) {
      const buffer = Buffer.from(dto.base64, 'base64');
      parsedResult = await this.aiParser.parseMedia(
        buffer,
        dto.mimeType || 'image/jpeg',
        dto.filename,
      );
    } else if (dto.text) {
      parsedResult = await this.aiParser.parseMessage(
        'Adicionar na lista de compras os itens da seguinte planilha:\n' + dto.text,
      );
    } else {
      throw new BadRequestException('Envie o texto ou arquivo da planilha.');
    }

    const rawItems = parsedResult.data.items || [];
    let itemsToCreate = rawItems;

    if (itemsToCreate.length === 0 && parsedResult.data.title) {
      const parts = parsedResult.data.title
        .replace(/^(?:comprar|adicionar\s+(?:na\s+)?lista\s*(?:de\s*compras)?)\s*/i, '')
        .split(/(?:,|[\n•-])+|\be\b/i)
        .map((s) => s.trim())
        .filter(Boolean);
      itemsToCreate = parts.map((name) => ({ name, quantity: '1', category: 'Geral' }));
    }

    const isShared = (dto.scope === RecordScope.SHARED || user?.householdId) && !!user?.householdId;
    const itemScope = isShared ? RecordScope.SHARED : RecordScope.PRIVATE;

    const createdList: ShoppingItemDto[] = [];
    for (const it of itemsToCreate) {
      if (!it.name || !it.name.trim()) continue;
      const cleanName = it.name.trim();
      const created = await this.prisma.shoppingItem.create({
        data: {
          name: cleanName,
          normalizedName: normalizeShoppingItemName(cleanName),
          quantity: it.quantity ? String(it.quantity).trim() : '1',
          category: it.category ? String(it.category).trim() : 'Geral',
          scope: itemScope,
          userId,
          householdId: isShared ? user?.householdId : null,
        },
      });
      createdList.push(this.mapItem(created));
    }

    return {
      success: true,
      count: createdList.length,
      items: createdList,
    };
  }

  private mapItem(item: any): ShoppingItemDto {
    return {
      id: item.id,
      name: item.name,
      normalizedName: item.normalizedName || normalizeShoppingItemName(item.name),
      quantity: item.quantity,
      category: item.category,
      isCompleted: item.isCompleted,
      scope: item.scope,
      userId: item.userId,
      householdId: item.householdId,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
    };
  }
}
