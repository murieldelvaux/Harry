import { Page } from '@playwright/test';
import { RecordScope, TransactionType, GoalStatus } from '../../packages/shared/src';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  householdId?: string;
  household?: {
    id: string;
    name: string;
    inviteCode: string;
  };
}

export interface SetupMockApiOptions {
  user?: MockUser | null;
  expenses?: any[];
  goals?: any[];
  tasks?: any[];
  shoppingItems?: any[];
  calendarEvents?: any[];
}

export const defaultMockUser: MockUser = {
  id: 'user-muriel-123',
  name: 'Muriel',
  email: 'muriel@harry.app',
  phoneNumber: '+5511988881111',
  householdId: 'household-nexo-1',
  household: {
    id: 'household-nexo-1',
    name: 'Nossa Casa',
    inviteCode: 'NEXO-2026',
  },
};

export const defaultMockPartner: MockUser = {
  id: 'user-lucas-456',
  name: 'Lucas',
  email: 'parceiro@harry.app',
  phoneNumber: '+5511977772222',
  householdId: 'household-nexo-1',
};

export async function setupMockApi(page: Page, options: SetupMockApiOptions = {}) {
  let currentUser = options.user === undefined ? defaultMockUser : options.user;

  let expenses = options.expenses
    ? [...options.expenses]
    : [
        {
          id: 'exp-1',
          description: 'Supermercado Mensal',
          amount: 450.0,
          category: 'FOOD_MARKET',
          scope: RecordScope.SHARED,
          type: TransactionType.EXPENSE,
          date: new Date().toISOString(),
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
        },
        {
          id: 'exp-2',
          description: 'Internet Fibra',
          amount: 150.0,
          category: 'UTILITIES',
          scope: RecordScope.SHARED,
          type: TransactionType.EXPENSE,
          date: new Date().toISOString(),
          userId: defaultMockPartner.id,
          householdId: 'household-nexo-1',
        },
        {
          id: 'exp-3',
          description: 'Curso Online',
          amount: 89.9,
          category: 'OTHER',
          scope: RecordScope.PRIVATE,
          type: TransactionType.EXPENSE,
          date: new Date().toISOString(),
          userId: defaultMockUser.id,
        },
        {
          id: 'exp-4',
          description: 'Salário Mensal',
          amount: 5000.0,
          category: 'SALARY',
          scope: RecordScope.PRIVATE,
          type: TransactionType.INCOME,
          date: new Date().toISOString(),
          userId: defaultMockUser.id,
        },
      ];

  let goals = options.goals
    ? [...options.goals]
    : [
        {
          id: 'goal-1',
          title: 'Viagem de Férias',
          targetAmount: 12000.0,
          currentAmount: 4800.0,
          status: GoalStatus.IN_PROGRESS,
          scope: RecordScope.SHARED,
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
          targetDate: '2026-12-20',
        },
        {
          id: 'goal-2',
          title: 'Reserva de Emergência',
          targetAmount: 15000.0,
          currentAmount: 9000.0,
          status: GoalStatus.IN_PROGRESS,
          scope: RecordScope.PRIVATE,
          userId: defaultMockUser.id,
        },
      ];

  let tasks = options.tasks
    ? [...options.tasks]
    : [
        {
          id: 'task-1',
          title: 'Pagar conta de energia',
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          isCompleted: false,
          scope: RecordScope.SHARED,
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
        },
        {
          id: 'task-2',
          title: 'Comprar ração do gato',
          dueDate: new Date().toISOString(),
          isCompleted: true,
          scope: RecordScope.SHARED,
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
        },
      ];

  let shoppingItems = options.shoppingItems
    ? [...options.shoppingItems]
    : [
        {
          id: 'shop-1',
          name: 'Café em grãos',
          quantity: 1,
          isCompleted: false,
          scope: RecordScope.SHARED,
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
        },
        {
          id: 'shop-2',
          name: 'Azeite de oliva extra virgem',
          quantity: 2,
          isCompleted: true,
          scope: RecordScope.SHARED,
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
        },
      ];

  let calendarEvents = options.calendarEvents
    ? [...options.calendarEvents]
    : [
        {
          id: 'evt-1',
          title: 'Jantar em Família',
          description: 'Restaurante italiano',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7200000).toISOString(),
          isAllDay: false,
          userId: defaultMockUser.id,
          householdId: 'household-nexo-1',
        },
      ];

  let settlements: any[] = [];
  let workouts: any[] = [
    {
      id: 'wk-garmin-planned-1',
      userId: defaultMockUser.id,
      userName: defaultMockUser.name,
      householdId: 'household-nexo-1',
      provider: 'GARMIN',
      modality: 'RUNNING',
      status: 'PLANNED',
      workoutType: 'Intervalado / Tiros',
      targetPace: '4:30 - 4:40 /km',
      targetHrZone: 'Zona 4-5',
      title: 'Tiros de Velocidade 5x 800m VO2Max (Garmin Coach)',
      durationMinutes: 45,
      distanceKm: 7.5,
      calories: 510,
      runningSteps: [
        {
          phase: 'WARMUP',
          phaseLabel: 'Aquecimento',
          durationOrDistance: '15 min (2.5 km)',
          targetPace: '5:50 /km',
          targetHeartRateZone: 'Zona 2',
        },
        {
          phase: 'INTERVAL',
          phaseLabel: 'Bloco Principal — 5x 800m Forte',
          durationOrDistance: '5x 800m',
          targetPace: '4:30 - 4:40 /km',
          targetHeartRateZone: 'Zona 5',
        },
      ],
      notes: 'Planejado na planilha da semana',
      startedAt: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      id: 'wk-1',
      userId: defaultMockUser.id,
      userName: defaultMockUser.name,
      householdId: 'household-nexo-1',
      provider: 'STRAVA',
      modality: 'STRENGTH',
      status: 'COMPLETED',
      title: 'Treino de Força — Superiores & Core',
      durationMinutes: 52,
      setsCount: 14,
      totalVolumeKg: 3840,
      calories: 360,
      exercises: [
        { name: 'Supino Inclinado', sets: 4, reps: '10', weightKg: 24 },
        { name: 'Puxada Frontal', sets: 4, reps: '12', weightKg: 45 },
      ],
      notes: 'Sincronizado via Strava (WeightTraining) • Garmin Connect',
      startedAt: new Date().toISOString(),
    },
    {
      id: 'wk-2',
      userId: defaultMockPartner.id,
      userName: defaultMockPartner.name,
      householdId: 'household-nexo-1',
      provider: 'GARMIN',
      modality: 'RUNNING',
      status: 'COMPLETED',
      workoutType: 'Base Aeróbica (Z2)',
      title: 'Corrida Base Aeróbica Z2 (Garmin Forerunner)',
      durationMinutes: 33,
      distanceKm: 6.2,
      paceSecondsPerKm: 319,
      averageHeartRate: 148,
      calories: 415,
      notes: 'Sincronizado via Garmin Connect',
      startedAt: new Date().toISOString(),
    },
  ];
  let fitnessIntegrations: any[] = [
    {
      id: 'int-garmin',
      userId: defaultMockUser.id,
      provider: 'GARMIN',
      athleteId: 'Muriel Delvaux (Garmin Connect)',
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    },
    {
      id: 'int-strava',
      userId: defaultMockUser.id,
      provider: 'STRAVA',
      athleteId: null,
      isActive: false,
      lastSyncedAt: null,
    },
  ];

  // Injetar token no localStorage para o web client
  if (currentUser) {
    await page.addInitScript(() => {
      localStorage.setItem('harry_auth_token', 'mock-jwt-token-muriel');
      localStorage.setItem('nexo_auth_token', 'mock-jwt-token-muriel');
      localStorage.setItem('harry_refresh_token', 'mock-refresh-token-muriel');
    });
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem('harry_auth_token');
      localStorage.removeItem('nexo_auth_token');
      localStorage.removeItem('harry_refresh_token');
    });
  }

  // Interceptar todas as rotas de API da aplicação
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname.replace(/^.*\/api\/v1/, '');

    // 1. Auth routes
    if (pathname === '/auth/me') {
      const authHeader = route.request().headers()['authorization'];
      if (!currentUser || !authHeader) {
        return route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      }
      return route.fulfill({ status: 200, json: currentUser });
    }

    if (pathname === '/auth/login' && method === 'POST') {
      const body = route.request().postDataJSON();
      currentUser = {
        ...defaultMockUser,
        email: body.email,
      };
      return route.fulfill({
        status: 200,
        json: {
          accessToken: 'mock-jwt-token-muriel',
          user: currentUser,
        },
      });
    }

    if (pathname === '/auth/register' && method === 'POST') {
      const body = route.request().postDataJSON();
      currentUser = {
        id: 'new-user-' + Date.now(),
        name: body.name || 'Novo Usuário',
        email: body.email,
        phoneNumber: body.phoneNumber,
      };
      return route.fulfill({
        status: 201,
        json: {
          accessToken: 'mock-jwt-token-new',
          user: currentUser,
        },
      });
    }

    if (pathname === '/auth/forgot-password' && method === 'POST') {
      return route.fulfill({
        status: 200,
        json: { success: true, message: 'Código de recuperação enviado para o email!', devCode: '123456' },
      });
    }

    if (pathname === '/auth/profile' && method === 'PUT') {
      const body = route.request().postDataJSON();
      if (currentUser) {
        currentUser = { ...currentUser, ...body };
      }
      return route.fulfill({ status: 200, json: currentUser });
    }

    if (pathname === '/auth/phone' && method === 'PUT') {
      const body = route.request().postDataJSON();
      if (currentUser) {
        currentUser = { ...currentUser, phoneNumber: body.phoneNumber };
      }
      return route.fulfill({ status: 200, json: currentUser });
    }

    // 2. Expenses routes
    if (pathname === '/expenses' && method === 'GET') {
      let filtered = [...expenses];
      const type = url.searchParams.get('type');
      const scope = url.searchParams.get('scope');

      if (type) {
        filtered = filtered.filter((e) => (e.type || 'EXPENSE') === type);
      }
      if (scope && scope !== 'ALL') {
        filtered = filtered.filter((e) => e.scope === scope);
      }

      const totalExpense = expenses
        .filter((e) => (e.type || 'EXPENSE') === 'EXPENSE')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const totalIncome = expenses
        .filter((e) => e.type === 'INCOME')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const myIncome = totalIncome;
      const myPrivateExpenses = expenses
        .filter((e) => (e.type || 'EXPENSE') === 'EXPENSE' && e.scope === RecordScope.PRIVATE)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const totalShared = expenses
        .filter((e) => (e.type || 'EXPENSE') === 'EXPENSE' && e.scope === RecordScope.SHARED)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const myShareOfSharedExpenses = totalShared / 2;
      const myTotalExpenses = myPrivateExpenses + myShareOfSharedExpenses;
      const myBalance = myIncome - myTotalExpenses;

      return route.fulfill({
        status: 200,
        json: {
          items: filtered,
          summary: {
            myIncome,
            myPrivateExpenses,
            myShareOfSharedExpenses,
            myTotalExpenses,
            myBalance,
            jointIncome: totalIncome,
            jointExpenses: totalExpense,
            jointBalance: totalIncome - totalExpense,
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            totalPrivate: myPrivateExpenses,
            totalShared,
            userShareOfShared: myShareOfSharedExpenses,
            partnerPrivate: 0,
            month: new Date().toISOString().slice(0, 7),
          },
        },
      });
    }

    if (pathname === '/expenses' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newExpense = {
        id: 'exp-' + Date.now(),
        ...body,
        userId: currentUser?.id,
        householdId: currentUser?.householdId,
        date: body.date || new Date().toISOString(),
      };
      expenses.unshift(newExpense);
      return route.fulfill({ status: 201, json: newExpense });
    }

    if (pathname.match(/^\/expenses\/[a-zA-Z0-9_-]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      expenses = expenses.filter((e) => e.id !== id);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 3. Goals routes
    if (pathname === '/goals' && method === 'GET') {
      return route.fulfill({ status: 200, json: goals });
    }

    if (pathname === '/goals' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newGoal = {
        id: 'goal-' + Date.now(),
        ...body,
        status: GoalStatus.IN_PROGRESS,
        userId: currentUser?.id,
        householdId: currentUser?.householdId,
      };
      goals.unshift(newGoal);
      return route.fulfill({ status: 201, json: newGoal });
    }

    if (pathname.match(/^\/goals\/[a-zA-Z0-9_-]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      goals = goals.filter((g) => g.id !== id);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 4. Tasks routes
    if (pathname === '/tasks' && method === 'GET') {
      return route.fulfill({ status: 200, json: tasks });
    }

    if (pathname === '/tasks' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newTask = {
        id: 'task-' + Date.now(),
        ...body,
        isCompleted: false,
        userId: currentUser?.id,
        householdId: currentUser?.householdId,
      };
      tasks.unshift(newTask);
      return route.fulfill({ status: 201, json: newTask });
    }

    if (pathname.match(/^\/tasks\/[a-zA-Z0-9_-]+\/toggle$/) && method === 'PUT') {
      const id = pathname.split('/')[2];
      tasks = tasks.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
      const updated = tasks.find((t) => t.id === id);
      return route.fulfill({ status: 200, json: updated });
    }

    if (pathname.match(/^\/tasks\/[a-zA-Z0-9_-]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      tasks = tasks.filter((t) => t.id !== id);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 5. Shopping List routes
    if (pathname === '/shopping-list' && method === 'GET') {
      return route.fulfill({ status: 200, json: shoppingItems });
    }

    if (pathname === '/shopping-list' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newItem = {
        id: 'shop-' + Date.now(),
        ...body,
        isCompleted: false,
        userId: currentUser?.id,
        householdId: currentUser?.householdId,
      };
      shoppingItems.unshift(newItem);
      return route.fulfill({ status: 201, json: newItem });
    }

    if (pathname.match(/^\/shopping-list\/[a-zA-Z0-9_-]+\/toggle$/) && method === 'PUT') {
      const id = pathname.split('/')[2];
      shoppingItems = shoppingItems.map((s) => (s.id === id ? { ...s, isCompleted: !s.isCompleted } : s));
      const updated = shoppingItems.find((s) => s.id === id);
      return route.fulfill({ status: 200, json: updated });
    }

    if (pathname === '/shopping-list/completed' && method === 'DELETE') {
      shoppingItems = shoppingItems.filter((s) => !s.isCompleted);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    if (pathname.match(/^\/shopping-list\/[a-zA-Z0-9_-]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      shoppingItems = shoppingItems.filter((s) => s.id !== id);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 6. Calendar routes
    if (pathname === '/calendar' && method === 'GET') {
      return route.fulfill({ status: 200, json: calendarEvents });
    }

    if (pathname === '/calendar' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newEvent = {
        id: 'evt-' + Date.now(),
        ...body,
        userId: currentUser?.id,
        householdId: currentUser?.householdId,
      };
      calendarEvents.unshift(newEvent);
      return route.fulfill({ status: 201, json: newEvent });
    }

    if (pathname.match(/^\/calendar\/[a-zA-Z0-9_-]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      calendarEvents = calendarEvents.filter((c) => c.id !== id);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 7. Household routes
    if (pathname === '/household/current' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          id: 'household-nexo-1',
          name: 'Nossa Casa',
          inviteCode: 'NEXO-2026',
          members: [defaultMockUser, defaultMockPartner],
          ...(currentUser?.household || {}),
        },
      });
    }

    // 8. Refresh Token & Logout routes (Task 1)
    if (pathname === '/auth/refresh' && method === 'POST') {
      return route.fulfill({
        status: 200,
        json: {
          accessToken: 'mock-jwt-token-refreshed',
          refreshToken: 'mock-refresh-token-rotated',
          user: currentUser || defaultMockUser,
        },
      });
    }

    if (pathname === '/auth/logout' && method === 'POST') {
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 9. Notifications routes (Task 2)
    if (pathname === '/notifications' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          unreadCount: 2,
          items: [
            {
              id: 'notif-1',
              userId: currentUser?.id || defaultMockUser.id,
              type: 'EXPENSE_SHARED_CREATED',
              category: 'FINANCES',
              title: '💸 Nova despesa compartilhada: Supermercado Mensal',
              body: 'Lucas registrou R$ 450,00.',
              deepLink: '/(tabs)/expenses',
              channelsSent: ['IN_APP', 'PUSH'],
              readAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
    }

    if (pathname === '/notifications/preferences' && (method === 'GET' || method === 'PUT')) {
      return route.fulfill({
        status: 200,
        json: [
          { category: 'FINANCES', enableInApp: true, enablePush: true, enableWhatsApp: true },
          { category: 'CALENDAR', enableInApp: true, enablePush: true, enableWhatsApp: true },
          { category: 'SHOPPING', enableInApp: true, enablePush: true, enableWhatsApp: false },
          { category: 'WORKOUTS', enableInApp: true, enablePush: true, enableWhatsApp: false },
        ],
      });
    }

    if (pathname === '/notifications/read-all' && method === 'PATCH') {
      return route.fulfill({ status: 200, json: { success: true } });
    }

    // 10. Settlements & Analytics routes (Tasks 4, 5, 6)
    if (pathname === '/expenses/settlements/preview' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          totalShared: 600,
          quotaPerMember: 300,
          expensesCount: 2,
          expenses: expenses.filter((e) => e.scope === RecordScope.SHARED),
          membersBreakdown: [
            { userId: defaultMockUser.id, name: defaultMockUser.name, paidTotal: 450, quotaShare: 300, netBalance: 150 },
            { userId: defaultMockPartner.id, name: defaultMockPartner.name, paidTotal: 150, quotaShare: 300, netBalance: -150 },
          ],
          transferInstruction: {
            fromUserId: defaultMockPartner.id,
            fromUserName: defaultMockPartner.name,
            toUserId: defaultMockUser.id,
            toUserName: defaultMockUser.name,
            amount: 150,
            isEven: false,
          },
        },
      });
    }

    if (pathname === '/expenses/settlements' && method === 'GET') {
      return route.fulfill({ status: 200, json: settlements });
    }

    if (pathname === '/expenses/settlements' && method === 'POST') {
      const newSettlement = {
        id: 'settle-' + Date.now(),
        householdId: 'household-nexo-1',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
        totalShared: 600,
        breakdown: [
          { userId: defaultMockUser.id, name: defaultMockUser.name, paidTotal: 450, quotaShare: 300, netBalance: 150 },
          { userId: defaultMockPartner.id, name: defaultMockPartner.name, paidTotal: 150, quotaShare: 300, netBalance: -150 },
        ],
        fromUserId: defaultMockPartner.id,
        fromUser: { id: defaultMockPartner.id, name: defaultMockPartner.name },
        toUserId: defaultMockUser.id,
        toUser: { id: defaultMockUser.id, name: defaultMockUser.name },
        transferAmount: 150,
        status: 'PENDING',
        closedByUserId: defaultMockUser.id,
        settledAt: null,
        expensesCount: 2,
        createdAt: new Date().toISOString(),
      };
      settlements.unshift(newSettlement);
      return route.fulfill({ status: 201, json: newSettlement });
    }

    if (pathname.match(/^\/expenses\/settlements\/[a-zA-Z0-9_-]+\/settle$/) && method === 'PATCH') {
      const id = pathname.split('/')[3];
      settlements = settlements.map((s) =>
        s.id === id ? { ...s, status: 'SETTLED', settledAt: new Date().toISOString() } : s,
      );
      const updated = settlements.find((s) => s.id === id);
      return route.fulfill({ status: 200, json: updated });
    }

    if (pathname.match(/^\/expenses\/settlements\/[a-zA-Z0-9_-]+$/) && method === 'DELETE') {
      const id = pathname.split('/').pop();
      settlements = settlements.filter((s) => s.id !== id);
      return route.fulfill({ status: 200, json: { success: true } });
    }

    if (pathname === '/expenses/analytics' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          periodLabel: '2026-11',
          totalExpenses: 689.9,
          previousPeriodTotal: 520,
          variationPercent: 32.6,
          byCategory: [
            { category: 'FOOD_MARKET', total: 450, count: 1, percentage: 65.2 },
            { category: 'UTILITIES', total: 150, count: 1, percentage: 21.7 },
          ],
          monthlyEvolution: [
            { month: '2026-10', total: 520, sharedTotal: 400, privateTotal: 120 },
            { month: '2026-11', total: 689.9, sharedTotal: 600, privateTotal: 89.9 },
          ],
          topOffenders: expenses.slice(0, 3),
        },
      });
    }

    // 11. Shopping List Analytics & Re-add (Task 10)
    if (pathname === '/shopping-list/analytics/top-items' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: [
          {
            normalizedName: 'cafe em grao',
            displayName: 'Café em grãos',
            category: 'Mercearia',
            purchaseCount: 4,
            completedCount: 3,
            lastAddedAt: new Date().toISOString(),
            frequencyLabel: 'Semanal',
            currentlyPending: false,
          },
        ],
      });
    }

    if (pathname === '/shopping-list/readd' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newItem = {
        id: 'shop-' + Date.now(),
        name: body.name,
        quantity: '1',
        isCompleted: false,
        scope: RecordScope.SHARED,
        userId: currentUser?.id,
      };
      shoppingItems.unshift(newItem);
      return route.fulfill({ status: 201, json: newItem });
    }

    // 12. Workouts routes (Task 11)
    if (pathname === '/workouts' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          workouts,
          weeklyStats: [
            {
              userId: defaultMockUser.id,
              userName: defaultMockUser.name,
              workoutCount: workouts.filter((w) => w.userId === defaultMockUser.id).length,
              weeklyGoalTarget: 4,
              runningWorkouts: workouts.filter((w) => w.userId === defaultMockUser.id && w.modality === 'RUNNING').length,
              totalRunningKm: 6,
              strengthWorkouts: 1,
              totalStrengthSets: 14,
              totalStrengthVolumeKg: 3840,
              totalDurationMinutes: 52,
              activeDaysCount: 2,
            },
            {
              userId: defaultMockPartner.id,
              userName: defaultMockPartner.name,
              workoutCount: 1,
              weeklyGoalTarget: 4,
              runningWorkouts: 1,
              totalRunningKm: 5.5,
              strengthWorkouts: 0,
              totalStrengthSets: 0,
              totalStrengthVolumeKg: 0,
              totalDurationMinutes: 29,
              activeDaysCount: 1,
            },
          ],
          coupleTotalWorkoutsWeek: workouts.length,
          coupleTotalRunningKmWeek: 5.5,
          coupleTotalStrengthVolumeWeek: 3840,
          integrations: fitnessIntegrations,
        },
      });
    }

    if (pathname === '/workouts/integrations/strava/auth-url' && method === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          authUrl: 'https://www.strava.com/oauth/authorize?client_id=STRAVA_CLIENT_ID',
          clientId: 'STRAVA_CLIENT_ID',
          redirectUri: 'http://localhost:3000/api/v1/workouts/integrations/strava/callback',
          isConfigured: true,
        },
      });
    }

    if (pathname === '/workouts/integrations/connect' && method === 'POST') {
      const body = route.request().postDataJSON();
      const updatedIntegration = {
        id: 'int-' + body.provider,
        userId: currentUser?.id || defaultMockUser.id,
        provider: body.provider,
        athleteId: body.athleteId || body.mfitEmail || `${body.provider}_connected`,
        isActive: true,
        lastSyncedAt: new Date().toISOString(),
      };
      fitnessIntegrations = [
        ...fitnessIntegrations.filter((i) => i.provider !== body.provider),
        updatedIntegration,
      ];
      return route.fulfill({ status: 201, json: updatedIntegration });
    }

    if (pathname === '/workouts' && method === 'POST') {
      const body = route.request().postDataJSON();
      const newWorkout = {
        id: 'wk-' + Date.now(),
        userId: currentUser?.id || defaultMockUser.id,
        user: { id: currentUser?.id || defaultMockUser.id, name: currentUser?.name || defaultMockUser.name },
        provider: body.provider || 'MANUAL',
        ...body,
        startedAt: body.startedAt || new Date().toISOString(),
      };
      workouts.unshift(newWorkout);
      return route.fulfill({ status: 201, json: newWorkout });
    }

    if (pathname === '/workouts/integrations/sync' && method === 'POST') {
      const body = route.request().postDataJSON();
      const synced = {
        id: 'wk-sync-' + Date.now(),
        userId: currentUser?.id || defaultMockUser.id,
        user: { id: currentUser?.id || defaultMockUser.id, name: currentUser?.name || defaultMockUser.name },
        provider: body.provider,
        modality: body.provider === 'STRAVA' ? 'RUNNING' : 'STRENGTH',
        title:
          body.provider === 'STRAVA'
            ? 'Corrida Matinal no Parque (Strava)'
            : 'Treino B — Inferiores Completo (MFIT)',
        durationMinutes: 35,
        distanceKm: body.provider === 'STRAVA' ? 6.0 : null,
        setsCount: body.provider === 'MFIT' ? 16 : null,
        totalVolumeKg: body.provider === 'MFIT' ? 4200 : null,
        startedAt: new Date().toISOString(),
      };
      workouts.unshift(synced);
      fitnessIntegrations = [
        ...fitnessIntegrations.filter((i) => i.provider !== body.provider),
        {
          id: 'int-' + body.provider,
          userId: currentUser?.id || defaultMockUser.id,
          provider: body.provider,
          isActive: true,
          lastSyncedAt: new Date().toISOString(),
        },
      ];
      return route.fulfill({
        status: 201,
        json: {
          syncedCount: 1,
          provider: body.provider,
          workouts: [synced],
          lastSyncedAt: new Date().toISOString(),
        },
      });
    }

    if (pathname.match(/^\/workouts\/[a-zA-Z0-9_-]+\/cheer$/) && method === 'POST') {
      return route.fulfill({ status: 201, json: { success: true, message: 'Incentivo enviado!' } });
    }

    // Default fallback
    return route.fulfill({ status: 200, json: { message: 'OK' } });
  });
}
