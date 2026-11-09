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
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'UTC',
      });
    }
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

/**
 * Converte data ISO (ex: "2026-11-10T12:00:00.000Z" ou "2026-11-10")
 * em formato brasileiro "DD/MM/AAAA", imune a shifts de fuso horário.
 */
export function parseIsoToBrDate(isoString?: string | null): string {
  if (!isoString) return '';
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Converte data brasileira "DD/MM/AAAA" para string ISO normalizada às 12:00:00 UTC,
 * prevenindo qualquer decréscimo de dia por timezone (UTC-11 a UTC+12).
 */
export function parseBrDateToIso(brDate?: string | null): string | undefined {
  if (!brDate || !brDate.trim()) return undefined;
  const parts = brDate.trim().split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      return `${y}-${m}-${d}T12:00:00.000Z`;
    }
  }
  return undefined;
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
