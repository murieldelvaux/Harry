import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  RecordScope,
  TransactionType,
  ExpenseCategory,
  NotificationType,
  SettlementStatus,
  CreateSettlementDto,
  SettlementPreviewDto,
  SettlementDto,
  ExpenseAnalyticsDto,
  MemberSettlementBreakdownDto,
} from '../../../../packages/shared/src';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private realtimeService: RealtimeService,
  ) {}

  async create(userId: string, dto: CreateExpenseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true },
    });

    const isShared = dto.scope === RecordScope.SHARED;
    if (isShared && !user?.householdId) {
      dto.scope = RecordScope.PRIVATE;
    }

    const effectivePaidByUserId =
      dto.scope === RecordScope.SHARED && dto.paidByUserId
        ? dto.paidByUserId
        : userId;

    const isInstallment = dto.totalInstallments && dto.totalInstallments > 1;

    if (isInstallment) {
      const N = dto.totalInstallments!;
      const totalAmount = Number(dto.amount);
      const baseInstallmentAmount = Math.floor((totalAmount / N) * 100) / 100;
      const remainder = Math.round((totalAmount - (baseInstallmentAmount * N)) * 100) / 100;
      const installmentGroupId = randomUUID();
      const baseDate = dto.date ? new Date(dto.date) : new Date();

      const createdExpenses = [];

      for (let i = 1; i <= N; i++) {
        const instDate = new Date(baseDate.getTime());
        const originalDay = baseDate.getDate();
        instDate.setMonth(baseDate.getMonth() + (i - 1));
        if (instDate.getDate() !== originalDay) {
          instDate.setDate(0);
        }

        const currentAmount = i === 1 ? (baseInstallmentAmount + remainder) : baseInstallmentAmount;
        const currentDesc = dto.description.includes('(')
          ? dto.description
          : `${dto.description} (${i}/${N})`;

        const exp = await this.prisma.expense.create({
          data: {
            description: currentDesc,
            amount: currentAmount,
            type: (dto.type as any) || TransactionType.EXPENSE,
            category: (dto.category as any) || ExpenseCategory.OTHER,
            scope: (dto.scope as any) || RecordScope.PRIVATE,
            date: instDate,
            rawSource: dto.rawSource || 'manual_app',
            userId,
            paidByUserId: effectivePaidByUserId,
            householdId: dto.scope === RecordScope.SHARED ? user?.householdId : null,
            installmentGroupId,
            installmentNumber: i,
            totalInstallments: N,
          },
          include: {
            user: { select: { id: true, name: true } },
            paidBy: { select: { id: true, name: true } },
          },
        });

        createdExpenses.push(exp);

        this.realtimeService.emit({
          type: 'EXPENSE_CREATED',
          userId,
          householdId: exp.householdId,
          data: this.mapExpense(exp),
        });
      }

      if (dto.scope === RecordScope.SHARED && user?.householdId) {
        const formattedTotal = totalAmount.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });
        const formattedParcel = baseInstallmentAmount.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });
        const payerName = createdExpenses[0].paidBy?.name || user?.name || 'Seu par';

        await this.notificationsService.notifyHouseholdPartners({
          actorUserId: userId,
          householdId: user.householdId,
          type: NotificationType.SHARED_EXPENSE_CREATED,
          title: '💳 Nova Compra Parcelada Lançada',
          body: `${user?.name || 'Seu par'} lançou "${dto.description}" parcelado em ${N}x de ~${formattedParcel} (Total: ${formattedTotal}) — Pago por: ${payerName}.`,
          deepLink: '/(tabs)/expenses',
          metadata: {
            installmentGroupId,
            totalInstallments: N,
            amount: totalAmount,
            paidByUserId: effectivePaidByUserId,
          },
        });
      }

      return this.mapExpense(createdExpenses[0]);
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
        paidByUserId: effectivePaidByUserId,
        householdId: dto.scope === RecordScope.SHARED ? user?.householdId : null,
      },
      include: {
        user: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });

    this.realtimeService.emit({
      type: 'EXPENSE_CREATED',
      userId,
      householdId: expense.householdId,
      data: this.mapExpense(expense),
    });

    if (expense.scope === RecordScope.SHARED && expense.householdId) {
      const formattedVal = Number(expense.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const payerName = expense.paidBy?.name || user?.name || 'Seu par';

      await this.notificationsService.notifyHouseholdPartners({
        actorUserId: userId,
        householdId: expense.householdId,
        type: NotificationType.SHARED_EXPENSE_CREATED,
        title: '💸 Nova Conta Compartilhada Lançada',
        body: `${user?.name || 'Seu par'} lançou "${expense.description}" (${formattedVal}) — Pago por: ${payerName}.`,
        deepLink: '/(tabs)/expenses',
        metadata: {
          expenseId: expense.id,
          amount: Number(expense.amount),
          paidByUserId: expense.paidByUserId,
        },
      });
    }

    return this.mapExpense(expense);
  }

  private buildDateFilter(filters?: {
    month?: string;
    startDate?: string;
    endDate?: string;
  }) {
    if (filters?.startDate || filters?.endDate) {
      let gte: Date | undefined;
      let lte: Date | undefined;

      if (filters.startDate) {
        gte = new Date(
          filters.startDate.includes('T')
            ? filters.startDate
            : filters.startDate + 'T00:00:00.000Z',
        );
      }
      if (filters.endDate) {
        lte = new Date(
          filters.endDate.includes('T')
            ? filters.endDate
            : filters.endDate + 'T23:59:59.999Z',
        );
      }
      return { ...(gte && { gte }), ...(lte && { lte }) };
    } else if (filters?.month) {
      const [yearStr, monthStr] = filters.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      return { gte: startDate, lte: endDate };
    }
    return undefined;
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

    const dateFilter = this.buildDateFilter(filters);

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
        paidBy: { select: { id: true, name: true } },
      },
    });

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
    const myTotalExpenses = myPrivateExpenses + userShareOfShared;
    const myBalance = myIncome - myTotalExpenses;

    const jointIncome = sharedIncome > 0 ? sharedIncome : myIncome + partnerIncome;
    const jointExpenses = totalShared;
    const jointBalance = jointIncome - jointExpenses;

    const totalIncome = myIncome + partnerIncome + (sharedIncome > 0 ? sharedIncome / 2 : 0);
    const totalExpense = myPrivateExpenses + partnerPrivate + totalShared;
    const balance = myBalance;

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
      items: filteredItems.map((e) => this.mapExpense(e)),
    };
  }

  /**
   * Task 4 & Task 5: Pré-visualização determinística do Fechamento de Contas (50/50)
   * Calcula quem pagou quanto e quem deve transferir exatamente quanto para quem.
   */
  async getSettlementPreview(
    userId: string,
    query: { month?: string; startDate?: string; endDate?: string },
  ): Promise<SettlementPreviewDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        household: {
          include: {
            members: {
              select: { id: true, name: true, email: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!user?.householdId || !user.household) {
      return {
        householdId: '',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
        totalShared: 0,
        quotaPerPartner: 0,
        pendingExpensesCount: 0,
        expenses: [],
        membersBreakdown: [],
        transferInstruction: {
          fromUserId: null,
          fromUserName: null,
          toUserId: null,
          toUserName: null,
          amount: 0,
          isEven: true,
        },
      };
    }

    let periodStart: Date;
    let periodEnd: Date;

    if (query.startDate && query.endDate) {
      periodStart = new Date(
        query.startDate.includes('T') ? query.startDate : `${query.startDate}T00:00:00.000Z`,
      );
      periodEnd = new Date(
        query.endDate.includes('T') ? query.endDate : `${query.endDate}T23:59:59.999Z`,
      );
    } else {
      const mStr = query.month || new Date().toISOString().slice(0, 7);
      const [y, m] = mStr.split('-').map(Number);
      periodStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    }

    // Buscar despesas compartilhadas de saída AINDA NÃO FECHADAS (settlementId: null) no período
    const pendingExpenses = await this.prisma.expense.findMany({
      where: {
        householdId: user.householdId,
        scope: RecordScope.SHARED,
        type: TransactionType.EXPENSE,
        settlementId: null,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const members = user.household.members;
    const paidCentsByMember = new Map<string, number>();
    for (const member of members) {
      paidCentsByMember.set(member.id, 0);
    }

    let totalSharedCents = 0;
    for (const exp of pendingExpenses) {
      const cents = Math.round(Number(exp.amount) * 100);
      totalSharedCents += cents;
      const payerId = exp.paidByUserId || exp.userId;
      paidCentsByMember.set(payerId, (paidCentsByMember.get(payerId) || 0) + cents);
    }

    // Divisão 50/50 determinística em centavos
    const memberCount = Math.max(1, members.length);
    const baseQuotaCents = Math.floor(totalSharedCents / memberCount);
    const remainderCents = totalSharedCents - baseQuotaCents * memberCount;

    const membersBreakdown: MemberSettlementBreakdownDto[] = members.map((m, idx) => {
      const paidCents = paidCentsByMember.get(m.id) || 0;
      const quotaCents = baseQuotaCents + (idx === 0 ? remainderCents : 0);
      const netCents = paidCents - quotaCents; // > 0 = pagou a mais (credor); < 0 = pagou a menos (devedor)
      return {
        userId: m.id,
        name: m.name,
        paidAmount: Number((paidCents / 100).toFixed(2)),
        quotaAmount: Number((quotaCents / 100).toFixed(2)),
        netBalance: Number((netCents / 100).toFixed(2)),
      };
    });

    // Identificar Devedor (menor netBalance < 0) e Credor (maior netBalance > 0)
    const sorted = [...membersBreakdown].sort((a, b) => a.netBalance - b.netBalance);
    const debtor = sorted[0];
    const creditor = sorted[sorted.length - 1];

    const transferAmount =
      debtor && creditor && debtor.userId !== creditor.userId && debtor.netBalance < -0.004
        ? Number(Math.abs(debtor.netBalance).toFixed(2))
        : 0;

    return {
      householdId: user.householdId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalShared: Number((totalSharedCents / 100).toFixed(2)),
      quotaPerPartner: Number((totalSharedCents / memberCount / 100).toFixed(2)),
      pendingExpensesCount: pendingExpenses.length,
      expenses: pendingExpenses.map((e) => this.mapExpense(e)),
      membersBreakdown,
      transferInstruction: {
        fromUserId: transferAmount > 0 ? debtor.userId : null,
        fromUserName: transferAmount > 0 ? debtor.name : null,
        toUserId: transferAmount > 0 ? creditor.userId : null,
        toUserName: transferAmount > 0 ? creditor.name : null,
        amount: transferAmount,
        isEven: transferAmount === 0,
      },
    };
  }

  /**
   * Task 4: Executar Fechamento de Contas (vinculando despesas com settlementId)
   */
  async createSettlement(userId: string, dto: CreateSettlementDto): Promise<SettlementDto> {
    const preview = await this.getSettlementPreview(userId, {
      startDate: dto.periodStart,
      endDate: dto.periodEnd,
    });

    if (!preview.householdId) {
      throw new BadRequestException('Você precisa estar em um espaço compartilhado para fechar contas.');
    }

    if (preview.pendingExpensesCount === 0) {
      throw new BadRequestException('Não há despesas compartilhadas pendentes neste período para fechar.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    const expenseIds = preview.expenses.map((e) => e.id);

    const settlement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.settlement.create({
        data: {
          householdId: preview.householdId,
          periodStart: new Date(preview.periodStart),
          periodEnd: new Date(preview.periodEnd),
          totalShared: preview.totalShared,
          breakdown: preview.membersBreakdown as any,
          fromUserId: preview.transferInstruction.fromUserId,
          toUserId: preview.transferInstruction.toUserId,
          transferAmount: preview.transferInstruction.amount,
          status:
            preview.transferInstruction.amount === 0
              ? SettlementStatus.SETTLED
              : SettlementStatus.PENDING,
          settledAt: preview.transferInstruction.amount === 0 ? new Date() : null,
          closedByUserId: userId,
          notes: dto.notes || null,
        },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
        },
      });

      await tx.expense.updateMany({
        where: { id: { in: expenseIds } },
        data: { settlementId: created.id },
      });

      return created;
    });

    this.realtimeService.emit({
      type: 'SETTLEMENT_UPDATED',
      userId,
      householdId: preview.householdId,
      data: { settlementId: settlement.id },
    });

    const formattedTransfer = Number(settlement.transferAmount).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const transferSummary =
      Number(settlement.transferAmount) > 0
        ? `${preview.transferInstruction.fromUserName} deve transferir ${formattedTransfer} para ${preview.transferInstruction.toUserName}.`
        : 'As contas ficaram 100% empatadas!';

    await this.notificationsService.notifyHouseholdPartners({
      actorUserId: userId,
      householdId: preview.householdId,
      type: NotificationType.ACCOUNT_CLOSING_CREATED,
      title: '⚖️ Fechamento de Contas Realizado!',
      body: `${user?.name || 'Seu par'} fechou o ciclo financeiro (${preview.pendingExpensesCount} contas). ${transferSummary}`,
      deepLink: '/(tabs)/expenses?tab=closing',
      metadata: { settlementId: settlement.id },
    });

    return this.mapSettlement(settlement, expenseIds.length);
  }

  async listSettlements(userId: string): Promise<SettlementDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId) return [];

    const settlements = await this.prisma.settlement.findMany({
      where: { householdId: user.householdId },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        _count: { select: { expenses: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return settlements.map((s) => this.mapSettlement(s, s._count?.expenses || 0));
  }

  /**
   * Task 5: Marcar o fechamento como pago/liquidado
   */
  async markSettlementAsPaid(userId: string, settlementId: string): Promise<SettlementDto> {
    const existing = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        _count: { select: { expenses: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Fechamento não encontrado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true },
    });

    if (!user?.householdId || user.householdId !== existing.householdId) {
      throw new ForbiddenException('Sem permissão para liquidar este fechamento');
    }

    const updated = await this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.SETTLED,
        settledAt: new Date(),
      },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });

    this.realtimeService.emit({
      type: 'SETTLEMENT_UPDATED',
      userId,
      householdId: existing.householdId,
      data: { settlementId: updated.id, status: 'SETTLED' },
    });

    const formattedVal = Number(updated.transferAmount).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    await this.notificationsService.notifyHouseholdPartners({
      actorUserId: userId,
      householdId: existing.householdId,
      type: NotificationType.ACCOUNT_CLOSING_SETTLED,
      title: '✅ Encontro de Contas Liquidado!',
      body: `${user.name} confirmou o pagamento de ${formattedVal} referente ao fechamento de contas.`,
      deepLink: '/(tabs)/expenses?tab=closing',
      metadata: { settlementId: updated.id },
    });

    return this.mapSettlement(updated, existing._count?.expenses || 0);
  }

  /**
   * Permite reabrir um fechamento caso o casal queira incluir/editar despesas daquele período
   */
  async reopenSettlement(userId: string, settlementId: string) {
    const existing = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });
    if (!existing) throw new NotFoundException('Fechamento não encontrado');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });
    if (!user?.householdId || user.householdId !== existing.householdId) {
      throw new ForbiddenException('Sem permissão');
    }

    await this.prisma.$transaction([
      this.prisma.expense.updateMany({
        where: { settlementId },
        data: { settlementId: null },
      }),
      this.prisma.settlement.delete({
        where: { id: settlementId },
      }),
    ]);

    this.realtimeService.emit({
      type: 'SETTLEMENT_UPDATED',
      userId,
      householdId: existing.householdId,
    });

    return { success: true };
  }

  /**
   * Task 6: Análise dos principais gastos (por categoria, comparativo entre períodos, evolução temporal e ofensores)
   */
  async getAnalytics(
    userId: string,
    query: { month?: string; startDate?: string; endDate?: string; scope?: string },
  ): Promise<ExpenseAnalyticsDto> {
    const currentData = await this.findAll(userId, {
      ...query,
      type: TransactionType.EXPENSE,
    });

    const expenseItems = currentData.items.filter((e) => e.type === TransactionType.EXPENSE);
    const totalExpenses = expenseItems.reduce((sum, e) => sum + Number(e.amount), 0);

    // Calcular período anterior equivalente para comparativo
    let prevStart: Date;
    let prevEnd: Date;
    let periodLabel = query.month || new Date().toISOString().slice(0, 7);

    if (query.startDate && query.endDate) {
      const s = new Date(query.startDate);
      const e = new Date(query.endDate);
      const diffMs = Math.max(86400000, e.getTime() - s.getTime());
      prevEnd = new Date(s.getTime() - 1000);
      prevStart = new Date(prevEnd.getTime() - diffMs);
      periodLabel = `${query.startDate} a ${query.endDate}`;
    } else {
      const mStr = query.month || new Date().toISOString().slice(0, 7);
      const [y, m] = mStr.split('-').map(Number);
      prevStart = new Date(Date.UTC(y, m - 2, 1, 0, 0, 0));
      prevEnd = new Date(Date.UTC(y, m - 1, 0, 23, 59, 59, 999));
    }

    const prevData = await this.findAll(userId, {
      startDate: prevStart.toISOString(),
      endDate: prevEnd.toISOString(),
      scope: query.scope,
      type: TransactionType.EXPENSE,
    });

    const previousPeriodTotal = prevData.items
      .filter((e) => e.type === TransactionType.EXPENSE)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const variationPercent =
      previousPeriodTotal > 0
        ? Number((((totalExpenses - previousPeriodTotal) / previousPeriodTotal) * 100).toFixed(1))
        : 0;

    // Agrupamento por categoria
    const catMap = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const item of expenseItems) {
      const cur = catMap.get(item.category) || { total: 0, count: 0 };
      cur.total += Number(item.amount);
      cur.count += 1;
      catMap.set(item.category, cur);
    }

    const byCategory = Array.from(catMap.entries())
      .map(([category, stats]) => ({
        category,
        total: Number(stats.total.toFixed(2)),
        count: stats.count,
        percentage:
          totalExpenses > 0 ? Number(((stats.total / totalExpenses) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Evolução dos últimos 6 meses
    const now = new Date();
    const sixMonthsAgo = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0));
    const allRecent = await this.findAll(userId, {
      startDate: sixMonthsAgo.toISOString(),
      endDate: now.toISOString(),
      scope: query.scope,
      type: TransactionType.EXPENSE,
    });

    const monthBuckets = new Map<string, { total: number; sharedTotal: number; privateTotal: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      monthBuckets.set(key, { total: 0, sharedTotal: 0, privateTotal: 0 });
    }

    for (const item of allRecent.items) {
      if (item.type !== TransactionType.EXPENSE) continue;
      const mKey = item.date.slice(0, 7);
      const bucket = monthBuckets.get(mKey);
      if (bucket) {
        const val = Number(item.amount);
        bucket.total += val;
        if (item.scope === RecordScope.SHARED) {
          bucket.sharedTotal += val;
        } else {
          bucket.privateTotal += val;
        }
      }
    }

    const monthlyEvolution = Array.from(monthBuckets.entries()).map(([month, b]) => ({
      month,
      total: Number(b.total.toFixed(2)),
      sharedTotal: Number(b.sharedTotal.toFixed(2)),
      privateTotal: Number(b.privateTotal.toFixed(2)),
    }));

    // Top 5 Maiores Ofensores do Orçamento
    const topOffenders = [...expenseItems]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);

    return {
      periodLabel,
      totalExpenses: Number(totalExpenses.toFixed(2)),
      previousPeriodTotal: Number(previousPeriodTotal.toFixed(2)),
      variationPercent,
      byCategory,
      monthlyEvolution,
      topOffenders,
    };
  }

  async findOne(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, householdId: true, sharePrivateExpenses: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      throw new NotFoundException('Gasto não encontrado');
    }

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
    const existing = await this.findOne(id, userId);

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
        ...(dto.paidByUserId !== undefined && { paidByUserId: dto.paidByUserId }),
        ...(householdId !== undefined && { householdId }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
      include: {
        user: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });

    this.realtimeService.emit({
      type: 'EXPENSE_UPDATED',
      userId,
      householdId: updated.householdId,
      data: this.mapExpense(updated),
    });

    return this.mapExpense(updated);
  }

  async delete(id: string, userId: string, deleteAllInstallments?: boolean) {
    const existing = await this.findOne(id, userId);

    if (existing.scope === RecordScope.PRIVATE && existing.userId !== userId) {
      throw new ForbiddenException('Apenas o autor pode excluir este gasto pessoal');
    }

    if (deleteAllInstallments && (existing as any).installmentGroupId) {
      await this.prisma.expense.deleteMany({
        where: { installmentGroupId: (existing as any).installmentGroupId },
      });
      return { success: true };
    }

    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  private mapExpense(exp: any) {
    const paidByObj = exp.paidBy
      ? { id: exp.paidBy.id, name: exp.paidBy.name }
      : exp.user
        ? { id: exp.user.id, name: exp.user.name }
        : null;

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
      paidByUserId: exp.paidByUserId || exp.userId,
      paidBy: paidByObj,
      settlementId: exp.settlementId || null,
      householdId: exp.householdId,
      installmentGroupId: exp.installmentGroupId || null,
      installmentNumber: exp.installmentNumber || null,
      totalInstallments: exp.totalInstallments || null,
      author: {
        id: exp.user ? exp.user.id : exp.userId,
        name: exp.user ? exp.user.name : 'Usuário',
      },
      createdAt: exp.createdAt.toISOString(),
      updatedAt: exp.updatedAt.toISOString(),
    };
  }

  private mapSettlement(s: any, expensesCount: number): SettlementDto {
    return {
      id: s.id,
      householdId: s.householdId,
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      totalShared: Number(s.totalShared),
      breakdown: Array.isArray(s.breakdown) ? s.breakdown : [],
      fromUserId: s.fromUserId,
      fromUser: s.fromUser ? { id: s.fromUser.id, name: s.fromUser.name } : null,
      toUserId: s.toUserId,
      toUser: s.toUser ? { id: s.toUser.id, name: s.toUser.name } : null,
      transferAmount: Number(s.transferAmount),
      status: s.status,
      closedByUserId: s.closedByUserId,
      closedBy: s.closedBy ? { id: s.closedBy.id, name: s.closedBy.name } : null,
      settledAt: s.settledAt ? s.settledAt.toISOString() : null,
      notes: s.notes || null,
      expensesCount,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
