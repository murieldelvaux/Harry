import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

import { Button } from './Button';

interface CalendarRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  initialStartDate?: string; // YYYY-MM-DD or DD/MM/YYYY
  initialEndDate?: string;   // YYYY-MM-DD or DD/MM/YYYY
  onApply: (startDate: string, endDate: string) => void;
  onClear?: () => void;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function normalizeToYmd(dateStr?: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function formatYmdToBr(ymd?: string | null): string {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function CalendarRangePickerModal({
  visible,
  onClose,
  initialStartDate,
  initialEndDate,
  onApply,
  onClear,
}: CalendarRangePickerModalProps) {
  const { theme, isDark } = useTheme();
  const today = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const parsedStart = normalizeToYmd(initialStartDate);
      const parsedEnd = normalizeToYmd(initialEndDate);
      setStartDate(parsedStart);
      setEndDate(parsedEnd);

      if (parsedStart) {
        const [y, m] = parsedStart.split('-').map(Number);
        setCurrentYear(y);
        setCurrentMonth(m);
      } else {
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth() + 1);
      }
    }
  }, [visible, initialStartDate, initialEndDate, today]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (ymd: string) => {
    if (!startDate || (startDate && endDate)) {
      // Começar nova seleção
      setStartDate(ymd);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (ymd < startDate) {
        // Selecionou data anterior: inverte
        setEndDate(startDate);
        setStartDate(ymd);
      } else {
        setEndDate(ymd);
      }
    }
  };

  // Presets rápidos (estilo MUI DateRangePicker)
  const applyPreset = (preset: 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH') => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYmd = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    if (preset === 'TODAY') {
      const ymd = toYmd(d);
      setStartDate(ymd);
      setEndDate(ymd);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth() + 1);
    } else if (preset === 'LAST_7') {
      const endYmd = toYmd(d);
      const past = new Date(d);
      past.setDate(past.getDate() - 6);
      const startYmd = toYmd(past);
      setStartDate(startYmd);
      setEndDate(endYmd);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth() + 1);
    } else if (preset === 'THIS_MONTH') {
      const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(lastDay)}`;
      setStartDate(start);
      setEndDate(end);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth() + 1);
    } else if (preset === 'LAST_MONTH') {
      const prevM = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const start = `${prevM.getFullYear()}-${pad(prevM.getMonth() + 1)}-01`;
      const lastDay = new Date(prevM.getFullYear(), prevM.getMonth() + 1, 0).getDate();
      const end = `${prevM.getFullYear()}-${pad(prevM.getMonth() + 1)}-${pad(lastDay)}`;
      setStartDate(start);
      setEndDate(end);
      setCurrentYear(prevM.getFullYear());
      setCurrentMonth(prevM.getMonth() + 1);
    }
  };

  const handleConfirm = () => {
    if (startDate) {
      const s = formatYmdToBr(startDate);
      const e = formatYmdToBr(endDate || startDate);
      onApply(s, e);
      onClose();
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    if (onClear) onClear();
    onClose();
  };

  // Construção dos dias do mês corrente
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Dom
    const daysInMonth = new Date(currentYear, currentMonth - 1 + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      ymd: string;
      isCurrentMonth: boolean;
    } | null> = [];

    // Preenchimento de dias vazios antes do dia 1
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Dias do mês
    for (let d = 1; d <= daysInMonth; d++) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const ymd = `${currentYear}-${pad(currentMonth)}-${pad(d)}`;
      days.push({
        dayNumber: d,
        ymd,
        isCurrentMonth: true,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Selecionar Período</Text>
              <Text style={[styles.headerSubtitle, { color: theme.primary }]}>
                {startDate
                  ? `${formatYmdToBr(startDate)} ${endDate ? 'até ' + formatYmdToBr(endDate) : '(selecione o fim)'}`
                  : 'Toque para escolher início e fim'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Presets Rápidos */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                onPress={() => applyPreset('TODAY')}
              >
                <Text style={[styles.presetText, { color: theme.textSecondary }]}>Hoje</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                onPress={() => applyPreset('LAST_7')}
              >
                <Text style={[styles.presetText, { color: theme.textSecondary }]}>7 Dias</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                onPress={() => applyPreset('THIS_MONTH')}
              >
                <Text style={[styles.presetText, { color: theme.textSecondary }]}>Este Mês</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                onPress={() => applyPreset('LAST_MONTH')}
              >
                <Text style={[styles.presetText, { color: theme.textSecondary }]}>Mês Anterior</Text>
              </TouchableOpacity>
            </View>

            {/* Navegação de Mês (Estilo MUI) */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity onPress={handlePrevMonth} style={[styles.arrowBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Text style={[styles.arrowText, { color: theme.primary }]}>◀</Text>
              </TouchableOpacity>

              <Text style={[styles.currentMonthLabel, { color: theme.textPrimary }]}>
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </Text>

              <TouchableOpacity onPress={handleNextMonth} style={[styles.arrowBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Text style={[styles.arrowText, { color: theme.primary }]}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Cabeçalho dos Dias da Semana */}
            <View style={styles.weekDaysRow}>
              {WEEK_DAYS.map((wd) => (
                <View key={wd} style={styles.weekDayCell}>
                  <Text style={[styles.weekDayText, { color: theme.textMuted }]}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Grid dos Dias */}
            <View style={styles.daysGrid}>
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
                }

                const isStart = item.ymd === startDate;
                const isEnd = item.ymd === endDate;
                const isInRange =
                  startDate &&
                  endDate &&
                  item.ymd > startDate &&
                  item.ymd < endDate;
                const isToday = item.ymd === todayYmd;

                return (
                  <View
                    key={item.ymd}
                    style={[
                      styles.dayCellWrapper,
                      isInRange && styles.dayCellRangeMid,
                      isStart && endDate && styles.dayCellRangeStart,
                      isEnd && startDate && styles.dayCellRangeEnd,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleSelectDay(item.ymd)}
                      style={[
                        styles.dayBtn,
                        isToday && styles.dayBtnToday, { borderColor: theme.primary },
                        (isStart || isEnd) && styles.dayBtnActive, { backgroundColor: theme.primary },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText, { color: theme.textPrimary },
                          isToday && styles.dayTextToday, { color: theme.primary },
                          isInRange && styles.dayTextRange, { color: theme.textPrimary },
                          (isStart || isEnd) && styles.dayTextActive,
                        ]}
                      >
                        {item.dayNumber}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Rodapé com Ações */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <Text style={[styles.clearBtnText, { color: theme.textSecondary }]}>Limpar</Text>
            </TouchableOpacity>

            <View style={styles.actionsRight}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={onClose}
                style={{ height: 42, marginRight: 8 }}
              />
              <Button
                title="Aplicar"
                onPress={handleConfirm}
                disabled={!startDate}
                style={{ height: 42, minWidth: 100 }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    width: '100%',
    maxWidth: 380,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '500',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  currentMonthLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  arrowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  dayCellWrapper: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellRangeMid: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
  },
  dayCellRangeStart: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  dayCellRangeEnd: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  dayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBtnToday: {
    borderWidth: 1.5,
  },
  dayBtnActive: {
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dayTextToday: {
    fontWeight: '700',
  },
  dayTextRange: {
    fontWeight: '600',
  },
  dayTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 13.5,
  },
  actionsRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
});