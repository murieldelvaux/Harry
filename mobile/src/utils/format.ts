export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount as number)) {
    return (0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const val = typeof amount === 'number' ? amount : Number(amount) || 0;
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return '';
  }
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function getCategoryLabel(category?: string | null): string {
  if (!category) return '📦 Outros';
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
