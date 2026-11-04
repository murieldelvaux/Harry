import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * Motor relacional em memória de fallback para desenvolvimento local e validação E2E
 * quando a instância PostgreSQL local (localhost:5432) não está ativa no host.
 * Ativado exclusivamente se `prisma.$connect()` falhar em `PrismaService.onModuleInit()`.
 */
export function createInMemoryPrismaStore() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0);

  // Hash padrão para "123456"
  const defaultPasswordHash = bcrypt.hashSync('123456', 8);

  const tables: Record<string, any[]> = {
    household: [
      {
        id: 'hh-1',
        name: 'Nossa Casa',
        inviteCode: 'HARRY-CASAL',
        googleAccessToken: null,
        createdAt: threeDaysAgo,
        updatedAt: now,
      },
    ],
    user: [
      {
        id: 'user-1',
        email: 'muriel@harry.app',
        name: 'Muriel Daher',
        passwordHash: defaultPasswordHash,
        phoneNumber: '+5511999999999',
        householdId: 'hh-1',
        avatarUrl: null,
        googleId: null,
        googleAccessToken: null,
        sharePrivateExpenses: false,
        dailySummaryTime: '07:30',
        enableDailySummary: true,
        periodicSummaryType: 'WEEKLY',
        periodicSummaryDay: 1,
        periodicSummaryTime: '08:30',
        timezone: 'America/Sao_Paulo',
        lastDailySentAt: null,
        lastDigestSentAt: null,
        expoPushToken: null,
        resetToken: null,
        resetExpires: null,
        createdAt: threeDaysAgo,
        updatedAt: now,
      },
      {
        id: 'user-2',
        email: 'parceiro@harry.app',
        name: 'Lucas Silva',
        passwordHash: defaultPasswordHash,
        phoneNumber: '+5511988888888',
        householdId: 'hh-1',
        avatarUrl: null,
        googleId: null,
        googleAccessToken: null,
        sharePrivateExpenses: false,
        dailySummaryTime: '08:00',
        enableDailySummary: true,
        periodicSummaryType: 'BIWEEKLY',
        periodicSummaryDay: 0,
        periodicSummaryTime: '09:00',
        timezone: 'America/Sao_Paulo',
        lastDailySentAt: null,
        lastDigestSentAt: null,
        expoPushToken: null,
        resetToken: null,
        resetExpires: null,
        createdAt: threeDaysAgo,
        updatedAt: now,
      },
    ],
    refreshToken: [],
    notification: [
      {
        id: 'notif-1',
        userId: 'user-1',
        actorId: 'user-2',
        householdId: 'hh-1',
        type: 'SHARED_EXPENSE_CREATED',
        title: '💸 Nova despesa compartilhada: Supermercado Pão de Açúcar',
        body: 'Lucas registrou R$ 420,00 (Pago por Lucas Silva).',
        deepLink: '/(tabs)/expenses',
        metadata: { expenseId: 'exp-1' },
        channels: ['IN_APP', 'PUSH'],
        readAt: null,
        createdAt: yesterday,
      },
      {
        id: 'notif-2',
        userId: 'user-1',
        actorId: 'user-2',
        householdId: 'hh-1',
        type: 'WORKOUT_LOGGED',
        title: '🏃 Treino concluído: Corrida no Ibirapuera',
        body: 'Lucas registrou "Corrida no Ibirapuera" (5.5 km em 29 min). Mande um incentivo!',
        deepLink: '/(tabs)/workouts',
        metadata: { workoutId: 'wk-2' },
        channels: ['IN_APP'],
        readAt: null,
        createdAt: twoDaysAgo,
      },
    ],
    notificationPreference: [],
    expense: [
      {
        id: 'exp-1',
        description: 'Supermercado Pão de Açúcar',
        amount: 420.0,
        type: 'EXPENSE',
        category: 'FOOD',
        date: yesterday,
        scope: 'SHARED',
        rawSource: 'manual',
        userId: 'user-1',
        paidByUserId: 'user-1',
        householdId: 'hh-1',
        settlementId: null,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: 'exp-2',
        description: 'Conta de Energia Enel',
        amount: 180.0,
        type: 'EXPENSE',
        category: 'HOUSING',
        date: twoDaysAgo,
        scope: 'SHARED',
        rawSource: 'manual',
        userId: 'user-2',
        paidByUserId: 'user-2',
        householdId: 'hh-1',
        settlementId: null,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        id: 'exp-3',
        description: 'Jantar Aniversário de Namoro',
        amount: 260.0,
        type: 'EXPENSE',
        category: 'LEISURE',
        date: now,
        scope: 'SHARED',
        rawSource: 'manual',
        userId: 'user-1',
        paidByUserId: 'user-1',
        householdId: 'hh-1',
        settlementId: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'exp-4',
        description: 'Supermercado Mês Passado',
        amount: 510.0,
        type: 'EXPENSE',
        category: 'FOOD',
        date: lastMonth,
        scope: 'SHARED',
        rawSource: 'manual',
        userId: 'user-1',
        paidByUserId: 'user-1',
        householdId: 'hh-1',
        settlementId: null,
        createdAt: lastMonth,
        updatedAt: lastMonth,
      },
    ],
    settlement: [],
    goal: [
      {
        id: 'goal-1',
        title: 'Viagem para a Itália',
        targetAmount: 15000,
        currentAmount: 4500,
        targetDate: new Date(now.getFullYear(), 11, 20),
        status: 'IN_PROGRESS',
        scope: 'SHARED',
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: threeDaysAgo,
        updatedAt: now,
      },
    ],
    task: [
      {
        id: 'task-1',
        title: 'Pagar condomínio até dia 10',
        dueDate: new Date(now.getTime() + 30 * 60 * 1000),
        hasSpecificTime: true,
        reminderSent: false,
        isCompleted: false,
        scope: 'SHARED',
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ],
    shoppingItem: [
      {
        id: 'shop-1',
        name: 'Leite Integral',
        normalizedName: 'leite integral',
        quantity: '2 caixas',
        category: 'Laticínios',
        isCompleted: false,
        scope: 'SHARED',
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'shop-2',
        name: 'Leite Integral',
        normalizedName: 'leite integral',
        quantity: '4 caixas',
        category: 'Laticínios',
        isCompleted: true,
        scope: 'SHARED',
        userId: 'user-2',
        householdId: 'hh-1',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
      {
        id: 'shop-3',
        name: 'Leite Integral',
        normalizedName: 'leite integral',
        quantity: '2 caixas',
        category: 'Laticínios',
        isCompleted: true,
        scope: 'SHARED',
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
      {
        id: 'shop-4',
        name: 'Ovos Caipiras',
        normalizedName: 'ovo caipira',
        quantity: '2 dúzias',
        category: 'Mercearia',
        isCompleted: true,
        scope: 'SHARED',
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: 'shop-5',
        name: 'Ovo Caipira',
        normalizedName: 'ovo caipira',
        quantity: '1 dúzia',
        category: 'Mercearia',
        isCompleted: true,
        scope: 'SHARED',
        userId: 'user-2',
        householdId: 'hh-1',
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
      {
        id: 'shop-6',
        name: 'Café Especial em Grãos',
        normalizedName: 'cafe especial em grao',
        quantity: '500g',
        category: 'Mercearia',
        isCompleted: true,
        scope: 'SHARED',
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
    ],
    calendarEvent: [
      {
        id: 'ev-1',
        title: 'Jantar do Casal',
        description: 'Reserva às 20h',
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0),
        isAllDay: false,
        location: 'Restaurante Italiano',
        googleEventId: null,
        googleCalendarId: 'primary',
        color: '#8B5CF6',
        colorId: null,
        etag: null,
        scope: 'SHARED',
        attendees: null,
        reminderSent: false,
        userId: 'user-1',
        householdId: 'hh-1',
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ],
    googleCalendarSyncState: [],
    processedWebhookEvent: [],
    workoutActivity: [
      {
        id: 'wk-1',
        userId: 'user-1',
        householdId: 'hh-1',
        modality: 'STRENGTH',
        provider: 'MFIT',
        externalId: 'mfit-seed-1',
        title: 'Treino A — Superiores & Core (MFIT)',
        notes: 'Sincronizado via MFIT Personal',
        startedAt: yesterday,
        durationMinutes: 52,
        calories: 360,
        distanceKm: null,
        paceSecondsPerKm: null,
        elevationGainM: null,
        totalVolumeKg: 3840,
        setsCount: 14,
        exercisesJson: [
          { name: 'Supino Inclinado', sets: 4, reps: 10, weightKg: 24 },
          { name: 'Puxada Frontal', sets: 4, reps: 12, weightKg: 45 },
          { name: 'Desenvolvimento', sets: 3, reps: 10, weightKg: 16 },
        ],
        scope: 'SHARED',
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: 'wk-2',
        userId: 'user-2',
        householdId: 'hh-1',
        modality: 'RUNNING',
        provider: 'STRAVA',
        externalId: 'strava-seed-1',
        title: 'Corrida no Ibirapuera (Strava)',
        notes: 'Sincronizado via Strava • Pace 5:16/km',
        startedAt: twoDaysAgo,
        durationMinutes: 29,
        calories: 390,
        distanceKm: 5.5,
        paceSecondsPerKm: 316,
        elevationGainM: 32,
        totalVolumeKg: null,
        setsCount: null,
        exercisesJson: null,
        scope: 'SHARED',
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      },
    ],
    fitnessIntegration: [
      {
        id: 'fit-1',
        userId: 'user-1',
        provider: 'MFIT',
        accessToken: 'tok_mfit',
        refreshToken: null,
        apiKey: 'key_mfit_demo',
        athleteId: 'mfit_muriel',
        isActive: true,
        lastSyncedAt: yesterday,
        createdAt: threeDaysAgo,
        updatedAt: yesterday,
      },
    ],
  };

  function matchCondition(row: any, where: any): boolean {
    if (!where || Object.keys(where).length === 0) return true;

    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;

      if (key === 'OR' && Array.isArray(cond)) {
        if (!cond.some((sub) => matchCondition(row, sub))) return false;
        continue;
      }
      if (key === 'AND' && Array.isArray(cond)) {
        if (!cond.every((sub) => matchCondition(row, sub))) return false;
        continue;
      }
      if (key === 'NOT') {
        if (matchCondition(row, cond)) return false;
        continue;
      }

      // Chave composta do Prisma (ex: userId_category, userId_provider, provider_externalId)
      if (key.includes('_') && cond && typeof cond === 'object' && !(cond instanceof Date)) {
        const subKeys = Object.keys(cond);
        if (subKeys.length >= 2 && subKeys.every((sk) => sk in row)) {
          if (!matchCondition(row, cond)) return false;
          continue;
        }
      }

      const val = row[key];

      if (cond === null) {
        if (val !== null && val !== undefined) return false;
        continue;
      }

      if (typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
        if ('in' in cond && Array.isArray(cond.in)) {
          if (!cond.in.includes(val)) return false;
        }
        if ('notIn' in cond && Array.isArray(cond.notIn)) {
          if (cond.notIn.includes(val)) return false;
        }
        if ('not' in cond) {
          if (cond.not === null) {
            if (val === null || val === undefined) return false;
          } else if (val === cond.not) {
            return false;
          }
        }
        const rowTime = val instanceof Date ? val.getTime() : typeof val === 'number' ? val : new Date(val).getTime();
        if ('gte' in cond && cond.gte !== undefined) {
          const cmp = cond.gte instanceof Date ? cond.gte.getTime() : Number(cond.gte);
          if (val === null || val === undefined || rowTime < cmp) return false;
        }
        if ('gt' in cond && cond.gt !== undefined) {
          const cmp = cond.gt instanceof Date ? cond.gt.getTime() : Number(cond.gt);
          if (val === null || val === undefined || rowTime <= cmp) return false;
        }
        if ('lte' in cond && cond.lte !== undefined) {
          const cmp = cond.lte instanceof Date ? cond.lte.getTime() : Number(cond.lte);
          if (val === null || val === undefined || rowTime > cmp) return false;
        }
        if ('lt' in cond && cond.lt !== undefined) {
          const cmp = cond.lt instanceof Date ? cond.lt.getTime() : Number(cond.lt);
          if (val === null || val === undefined || rowTime >= cmp) return false;
        }
        continue;
      }

      if (val !== cond) return false;
    }

    return true;
  }

  function hydrateRelations(modelName: string, row: any, includeOrSelect?: any): any {
    if (!row) return null;
    const result = { ...row };

    const findUser = (id?: string | null) =>
      id ? tables.user.find((u) => u.id === id) || null : null;

    if (modelName === 'user') {
      if (includeOrSelect?.household) {
        const hh = result.householdId
          ? tables.household.find((h) => h.id === result.householdId) || null
          : null;
        if (hh) {
          result.household = {
            ...hh,
            members: tables.user.filter((u) => u.householdId === hh.id),
          };
        } else {
          result.household = null;
        }
      }
    } else if (modelName === 'household') {
      result.members = tables.user.filter((u) => u.householdId === result.id);
    } else if (modelName === 'expense') {
      result.user = findUser(result.userId);
      result.paidBy = findUser(result.paidByUserId || result.userId);
      result.paidByUser = result.paidBy;
    } else if (modelName === 'settlement') {
      result.fromUser = findUser(result.fromUserId);
      result.toUser = findUser(result.toUserId);
      result.closedBy = findUser(result.closedByUserId);
      const linkedExpenses = tables.expense
        .filter((e) => e.settlementId === result.id)
        .map((e) => hydrateRelations('expense', e));
      result.expenses = linkedExpenses;
      result._count = { expenses: linkedExpenses.length };
    } else if (modelName === 'notification') {
      result.actor = findUser(result.actorId);
      result.user = findUser(result.userId);
    } else if (modelName === 'workoutActivity') {
      result.user = findUser(result.userId);
    } else if (modelName === 'calendarEvent' || modelName === 'task') {
      result.user = findUser(result.userId);
    }

    return result;
  }

  function sortRows(rows: any[], orderBy: any): any[] {
    if (!orderBy) return rows;
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const ord of orders) {
        const [field, dir] = Object.entries(ord)[0] || [];
        if (!field) continue;
        const va = a[field] instanceof Date ? a[field].getTime() : a[field];
        const vb = b[field] instanceof Date ? b[field].getTime() : b[field];
        if (va === vb) continue;
        const cmp = va > vb ? 1 : -1;
        return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  function createDelegate(modelName: string) {
    if (!tables[modelName]) tables[modelName] = [];

    return {
      async findUnique(args: any = {}) {
        const row = tables[modelName].find((r) => matchCondition(r, args.where));
        return row ? hydrateRelations(modelName, row, args.include || args.select) : null;
      },
      async findFirst(args: any = {}) {
        let filtered = tables[modelName].filter((r) => matchCondition(r, args.where));
        if (args.orderBy) filtered = sortRows(filtered, args.orderBy);
        const row = filtered[0];
        return row ? hydrateRelations(modelName, row, args.include || args.select) : null;
      },
      async findMany(args: any = {}) {
        let filtered = tables[modelName].filter((r) => matchCondition(r, args.where));
        if (args.orderBy) filtered = sortRows(filtered, args.orderBy);
        if (typeof args.take === 'number') filtered = filtered.slice(0, args.take);
        return filtered.map((r) => hydrateRelations(modelName, r, args.include || args.select));
      },
      async count(args: any = {}) {
        return tables[modelName].filter((r) => matchCondition(r, args?.where)).length;
      },
      async create(args: any = {}) {
        const ts = new Date();
        const rawData = { ...(args.data || {}) };

        // Trata relações connect (ex: members: { connect: { id } })
        const membersConnect = rawData.members?.connect;
        delete rawData.members;

        const record: any = {
          id: rawData.id || randomUUID(),
          createdAt: rawData.createdAt || ts,
          updatedAt: rawData.updatedAt || ts,
          ...rawData,
        };

        if (modelName === 'expense') {
          if (!record.date) record.date = ts;
          if (record.settlementId === undefined) record.settlementId = null;
        }
        if (modelName === 'shoppingItem') {
          if (record.isCompleted === undefined) record.isCompleted = false;
        }
        if (modelName === 'notification') {
          if (record.readAt === undefined) record.readAt = null;
        }
        if (modelName === 'refreshToken') {
          if (record.revokedAt === undefined) record.revokedAt = null;
        }

        tables[modelName].push(record);

        if (modelName === 'household' && membersConnect?.id) {
          const u = tables.user.find((x) => x.id === membersConnect.id);
          if (u) u.householdId = record.id;
        }

        return hydrateRelations(modelName, record, args.include || args.select);
      },
      async update(args: any = {}) {
        const idx = tables[modelName].findIndex((r) => matchCondition(r, args.where));
        if (idx === -1) {
          throw new Error(`Record not found in ${modelName}`);
        }
        const updated = {
          ...tables[modelName][idx],
          ...(args.data || {}),
          updatedAt: new Date(),
        };
        tables[modelName][idx] = updated;
        return hydrateRelations(modelName, updated, args.include || args.select);
      },
      async updateMany(args: any = {}) {
        let count = 0;
        tables[modelName] = tables[modelName].map((r) => {
          if (matchCondition(r, args.where)) {
            count++;
            return { ...r, ...(args.data || {}), updatedAt: new Date() };
          }
          return r;
        });
        return { count };
      },
      async upsert(args: any = {}) {
        const existingIdx = tables[modelName].findIndex((r) => matchCondition(r, args.where));
        if (existingIdx !== -1) {
          const updated = {
            ...tables[modelName][existingIdx],
            ...(args.update || {}),
            updatedAt: new Date(),
          };
          tables[modelName][existingIdx] = updated;
          return hydrateRelations(modelName, updated, args.include || args.select);
        }
        const ts = new Date();
        const created = {
          id: randomUUID(),
          createdAt: ts,
          updatedAt: ts,
          ...(args.create || {}),
        };
        tables[modelName].push(created);
        return hydrateRelations(modelName, created, args.include || args.select);
      },
      async delete(args: any = {}) {
        const idx = tables[modelName].findIndex((r) => matchCondition(r, args.where));
        if (idx === -1) return null;
        const [removed] = tables[modelName].splice(idx, 1);
        return removed;
      },
      async deleteMany(args: any = {}) {
        const before = tables[modelName].length;
        tables[modelName] = tables[modelName].filter((r) => !matchCondition(r, args?.where));
        return { count: before - tables[modelName].length };
      },
    };
  }

  const delegates: Record<string, any> = {};
  for (const model of Object.keys(tables)) {
    delegates[model] = createDelegate(model);
  }

  return {
    delegates,
    async $transaction(arg: any) {
      if (typeof arg === 'function') {
        return arg(delegates);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    },
  };
}
