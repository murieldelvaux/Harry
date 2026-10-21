import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  RecordScope,
  TransactionType,
  ExpenseCategory,
} from '../../../../packages/shared/src';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    const isShared = dto.scope === RecordScope.SHARED;
    if (isShared && !user?.householdId) {
      // Se o usuário não está em um casal, força como privado
      dto.scope = RecordScope.PRIVATE;
    }

    const expense = await this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        type: (dto.type as any) || TransactionType.EXPENSE,
        category: (dto.category as any) || ExpenseCategory.OTHER,
        scope: (dto.scope as any) || RecordScope.PRIVATE,
        date: dto.date ? new Date(dto.date) : new Date(),
        rawSource: dto.rawSource || 'manual_app',
        userId,
        householdId: isShared ? user?.householdId : null,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return this.mapExpense(expense);
  }

  async findAll(
    userId: string,
    filters?: {
      month?: string;
      startDate?: string;
      endDate?: string;
      scope?: string;
      type?: string;
      category?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true, sharePrivateExpenses: true },
    });

    const householdId = user?.householdId;

    let allowedPartnerIds: string[] = [];
    if (householdId) {
      const partnersSharing = await this.prisma.user.findMany({
        where: {
          householdId,
          id: { not: userId },
          sharePrivateExpenses: true,
        },
        select: { id: true },
      });
      allowedPartnerIds = partnersSharing.map((p) => p.id);
    }

    // Filtro de data: por período explícito (startDate / endDate) ou por mês ("YYYY-MM")
    let dateFilter: any = undefined;
    if (filters?.startDate || filters?.endDate) {
      let gte: Date | undefined;
      let lte: Date | undefined;

      if (filters.startDate) {
        gte = new Date(filters.startDate.includes('T') ? filters.startDate : filters.startDate + 'T00:00:00.000Z');
      }
      if (filters.endDate) {
        lte = new Date(filters.endDate.includes('T') ? filters.endDate : filters.endDate + 'T23:59:59.999Z');
      }
      dateFilter = { ...(gte && { gte }), ...(lte && { lte }) };
    } else if (filters?.month) {
      const [yearStr, monthStr] = filters.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      dateFilter = { gte: startDate, lte: endDate };
    }

    // Regra de Isolamento de Escopo
    let scopeWhere: any = {};
    if (filters?.scope === 'PRIVATE') {
      if (allowedPartnerIds.length > 0) {
        scopeWhere = {
          OR: [
            { userId, scope: RecordScope.PRIVATE },
            { userId: { in: allowedPartnerIds }, scope: RecordScope.PRIVATE },
          ],
        };
      } else {
        scopeWhere = { userId, scope: RecordScope.PRIVATE };
      }
    } else if (filters?.scope === 'SHARED') {
      if (!householdId) {
        return {
          summary: {
            myIncome: 0,
            myPrivateExpenses: 0,
            myShareOfSharedExpenses: 0,
            myTotalExpenses: 0,
            myBalance: 0,
            jointIncome: 0,
            jointExpenses: 0,
            jointBalance: 0,
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            totalPrivate: 0,
            totalShared: 0,
            userShareOfShared: 0,
            partnerPrivate: 0,
            month: filters?.month || '',
          },
          items: [],
        };
      }
      scopeWhere = { householdId, scope: RecordScope.SHARED };
    } else {
      // ALL: Privados do usuário + Compartilhados do casal + Privados compartilhados do par
      if (householdId) {
        scopeWhere = {
          OR: [
            { userId, scope: RecordScope.PRIVATE },
            { householdId, scope: RecordScope.SHARED },
            ...(allowedPartnerIds.length > 0
              ? [{ userId: { in: allowedPartnerIds }, scope: RecordScope.PRIVATE }]
              : []),
          ],
        };
      } else {
        scopeWhere = { userId };
      }
    }

    const where: any = {
      ...scopeWhere,
      ...(dateFilter && { date: dateFilter }),
      ...(filters?.category && { category: filters.category }),
    };

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Calcular Totais, Balanço Individual e Balanço em Conjunto
    let myIncome = 0;
    let partnerIncome = 0;
    let sharedIncome = 0;

    let myPrivateExpenses = 0;
    let partnerPrivate = 0;
    let totalShared = 0;

    for (const exp of expenses) {
      const val = Number(exp.amount);
      const isIncome = exp.type === TransactionType.INCOME;

      if (isIncome) {
        if (exp.scope === RecordScope.PRIVATE) {
          if (exp.userId === userId) {
            myIncome += val;
          } else {
            partnerIncome += val;
          }
        } else if (exp.scope === RecordScope.SHARED) {
          sharedIncome += val;
          myIncome += val / 2;
        }
      } else {
        if (exp.scope === RecordScope.PRIVATE) {
          if (exp.userId === userId) {
            myPrivateExpenses += val;
          } else {
            partnerPrivate += val;
          }
        } else if (exp.scope === RecordScope.SHARED) {
          totalShared += val;
        }
      }
    }

    const userShareOfShared = totalShared / 2;

    // 1. BALANÇO INDIVIDUAL (Apenas o que pertence ao usuário)
    // O usuário responde pelos seus gastos pessoais + sua cota dos gastos compartilhados
    // Os gastos privados do parceiro NUNCA são cobrados ou descontados daqui!
    const myTotalExpenses = myPrivateExpenses + userShareOfShared;
    const myBalance = myIncome - myTotalExpenses;

    // 2. BALANÇO EM CONJUNTO (Visão Casal / Casa)
    // Rendas da casa vs Gastos compartilhados da casa
    const jointIncome = sharedIncome > 0 ? sharedIncome : (myIncome + partnerIncome);
    const jointExpenses = totalShared;
    const jointBalance = jointIncome - jointExpenses;

    // 3. TOTAIS GERAIS
    const totalIncome = myIncome + partnerIncome + (sharedIncome > 0 ? sharedIncome / 2 : 0);
    const totalExpense = myPrivateExpenses + partnerPrivate + totalShared;
    const balance = myBalance;

    // Filtrar itens por tipo se especificado
    let filteredItems = expenses;
    if (filters?.type && filters.type !== 'ALL') {
      filteredItems = expenses.filter((e) => e.type === filters.type);
    }

    return {
      summary: {
        myIncome: Number(myIncome.toFixed(2)),
        myPrivateExpenses: Number(myPrivateExpenses.toFixed(2)),
        myShareOfSharedExpenses: Number(userShareOfShared.toFixed(2)),
        myTotalExpenses: Number(myTotalExpenses.toFixed(2)),
        myBalance: Number(myBalance.toFixed(2)),
        jointIncome: Number(jointIncome.toFixed(2)),
        jointExpenses: Number(jointExpenses.toFixed(2)),
        jointBalance: Number(jointBalance.toFixed(2)),
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        balance: Number(balance.toFixed(2)),
        totalPrivate: Number(myPrivateExpenses.toFixed(2)),
        totalShared: Number(totalShared.toFixed(2)),
        userShareOfShared: Number(userShareOfShared.toFixed(2)),
        partnerPrivate: Number(partnerPrivate.toFixed(2)),
        month: filters?.month || new Date().toISOString().slice(0, 7),
      },
      items: filteredItems.map(this.mapExpense),
    };
  }

  async findOne(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, householdId: true, sharePrivateExpenses: true } },
      },
    });

    if (!expense) {
      throw new NotFoundException('Gasto não encontrado');
    }

    // Verificar se o usuário tem permissão para ver
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    const isOwner = expense.userId === userId;
    const isHouseholdShared =
      expense.scope === RecordScope.SHARED &&
      expense.householdId &&
      expense.householdId === user?.householdId;
    const isHouseholdPartnerPrivateAllowed =
      expense.scope === RecordScope.PRIVATE &&
      user?.householdId &&
      expense.user.householdId === user.householdId &&
      expense.user.sharePrivateExpenses === true;

    if (!isOwner && !isHouseholdShared && !isHouseholdPartnerPrivateAllowed) {
      throw new ForbiddenException('Acesso não permitido a este registro');
    }

    return this.mapExpense(expense);
  }

  async update(id: string, userId: string, dto: UpdateExpenseDto) {
    const existing = await this.findOne(id, userId); // Valida existência e permissão

    if (existing.scope === RecordScope.PRIVATE && existing.userId !== userId) {
      throw new ForbiddenException('Apenas o autor pode editar este gasto pessoal');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    let householdId: string | null | undefined = undefined;
    if (dto.scope !== undefined) {
      if (dto.scope === RecordScope.SHARED) {
        householdId = user?.householdId || null;
      } else {
        householdId = null;
      }
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.category !== undefined && { category: dto.category as any }),
        ...(dto.scope !== undefined && { scope: dto.scope as any }),
        ...(householdId !== undefined && { householdId }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return this.mapExpense(updated);
  }

  async delete(id: string, userId: string) {
    const existing = await this.findOne(id, userId); // Valida permissão

    if (existing.scope === RecordScope.PRIVATE && existing.userId !== userId) {
      throw new ForbiddenException('Apenas o autor pode excluir este gasto pessoal');
    }

    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  private mapExpense(exp: any) {
    return {
      id: exp.id,
      description: exp.description,
      amount: Number(exp.amount),
      type: exp.type || TransactionType.EXPENSE,
      category: exp.category,
      date: exp.date.toISOString(),
      scope: exp.scope,
      rawSource: exp.rawSource,
      userId: exp.userId,
      householdId: exp.householdId,
      author: {
        id: exp.user.id,
        name: exp.user.name,
      },
      createdAt: exp.createdAt.toISOString(),
      updatedAt: exp.updatedAt.toISOString(),
    };
  }
}
