export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  expenses: {
    all: ['expenses'] as const,
    list: (filters: { month?: string; scope?: string; type?: string; category?: string; startDate?: string; endDate?: string }) =>
      ['expenses', 'list', filters] as const,
    detail: (id: string) => ['expenses', 'detail', id] as const,
  },
  goals: {
    all: ['goals'] as const,
    list: () => ['goals', 'list'] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: () => ['tasks', 'list'] as const,
  },
  shoppingList: {
    all: ['shoppingList'] as const,
    list: (scope?: string) => ['shoppingList', 'list', scope] as const,
  },
  calendar: {
    all: ['calendar'] as const,
    list: (start?: string, end?: string) => ['calendar', 'list', { start, end }] as const,
    sharedCalendars: ['calendar', 'shared-calendars'] as const,
  },
  household: {
    current: ['household', 'current'] as const,
  },
};
