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

  // Injetar token no localStorage para o web client
  if (currentUser) {
    await page.addInitScript(() => {
      localStorage.setItem('harry_auth_token', 'mock-jwt-token-muriel');
      localStorage.setItem('nexo_auth_token', 'mock-jwt-token-muriel');
    });
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem('harry_auth_token');
      localStorage.removeItem('nexo_auth_token');
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
        json: currentUser?.household || {
          id: 'household-nexo-1',
          name: 'Nossa Casa',
          inviteCode: 'NEXO-2026',
          members: [defaultMockUser, defaultMockPartner],
        },
      });
    }

    // Default fallback
    return route.fulfill({ status: 200, json: { message: 'OK' } });
  });
}
