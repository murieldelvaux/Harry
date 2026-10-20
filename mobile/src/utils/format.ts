export function formatCurrency(amount: number): string {
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    HOUSING: '🏠 Moradia',
    FOOD_MARKET: '🛒 Mercado',
    RESTAURANT: '🍽️ Restaurante / Delivery',
    TRANSPORTATION: '🚗 Transporte / Uber',
    HEALTH: '💊 Saúde',
    LEISURE: '🎉 Lazer & Viagem',
    UTILITIES: '💡 Contas & Luz',
    SUBSCRIPTIONS: '📱 Assinaturas',
    SALARY: '💼 Salário & Renda',
    INVESTMENT: '📈 Investimentos',
    FREELANCE: '⚡ Freelance & Extra',
    SALE: '🏷️ Venda de Item',
    OTHER: '📦 Outros',
  };
  return map[category] || '📦 Outros';
}

export * from './masks';
