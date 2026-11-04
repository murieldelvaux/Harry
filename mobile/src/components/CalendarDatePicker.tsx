import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';
import { maskTime } from '../utils/format';

export interface CalendarDatePickerProps {
  label?: string;
  placeholder?: string;
  value: string; // DD/MM/AAAA, DD/MM/AAAA HH:MM ou YYYY-MM-DD
  onChange: (formattedValue: string) => void;
  outputFormat?: 'BR' | 'YMD'; // 'BR' -> DD/MM/AAAA (ou com HH:MM), 'YMD' -> YYYY-MM-DD
  includeTime?: boolean;
  defaultTime?: string; // ex: '18:00'
  allowClear?: boolean;
  testID?: string;
  containerStyle?: any;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function extractDateAndTime(raw?: string, fallbackTime = '09:00'): { ymd: string | null; time: string } {
  if (!raw || !raw.trim()) return { ymd: null, time: fallbackTime };
  const trimmed = raw.trim();

  // Caso YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const ymd = trimmed.substring(0, 10);
    const timeMatch = trimmed.match(/(\d{2}:\d{2})/);
    return { ymd, time: timeMatch ? timeMatch[1] : fallbackTime };
  }

  // Caso DD/MM/AAAA [HH:MM]
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
  if (match) {
    const [, d, m, y, t] = match;
    const ymd = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return { ymd, time: t ? t.padStart(5, '0') : fallbackTime };
  }

  return { ymd: null, time: fallbackTime };
}

function formatYmdToBr(ymd?: string | null): string {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function CalendarDatePicker({
  label,
  placeholder = 'Selecionar data no calendário',
  value,
  onChange,
  outputFormat = 'BR',
  includeTime = false,
  defaultTime = '09:00',
  allowClear = true,
  testID = 'calendar-date-picker',
  containerStyle,
}: CalendarDatePickerProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayYmd = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>(defaultTime);

  useEffect(() => {
    if (visible) {
      const { ymd, time } = extractDateAndTime(value, defaultTime);
      const activeYmd = ymd || todayYmd;
      setSelectedYmd(activeYmd);
      setSelectedTime(time);
      const [y, m] = activeYmd.split('-').map(Number);
      if (y && m) {
        setCurrentYear(y);
        setCurrentMonth(m);
      }
    }
  }, [visible, value, defaultTime, todayYmd]);

  const displayValue = useMemo(() => {
    const { ymd, time } = extractDateAndTime(value, defaultTime);
    if (!ymd) return '';
    const br = formatYmdToBr(ymd);
    if (includeTime) {
      const hasExplicitTime = /\d{2}:\d{2}/.test(value);
      return hasExplicitTime ? `${br} às ${time}` : br;
    }
    return br;
  }, [value, includeTime, defaultTime]);

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

  const applyQuickDay = (offsetDays: number, presetTime?: string) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const pad = (n: number) => String(n).padStart(2, '0');
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setSelectedYmd(ymd);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth() + 1);
    if (presetTime) {
      setSelectedTime(presetTime);
    }
  };

  const emitSelection = (ymdToEmit: string, timeToEmit: string) => {
    if (outputFormat === 'YMD') {
      onChange(ymdToEmit);
    } else {
      const br = formatYmdToBr(ymdToEmit);
      if (includeTime && timeToEmit) {
        onChange(`${br} ${timeToEmit}`);
      } else {
        onChange(br);
      }
    }
  };

  const handleConfirm = () => {
    const finalYmd = selectedYmd || todayYmd;
    emitSelection(finalYmd, selectedTime);
    setVisible(false);
  };

  const handleClear = () => {
    onChange('');
    setVisible(false);
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{ dayNumber: number; ymd: string } | null> = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        dayNumber: d,
        ymd: `${currentYear}-${pad(currentMonth)}-${pad(d)}`,
      });
    }
    return days;
  }, [currentYear, currentMonth]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}

      <TouchableOpacity
        testID={testID}
        accessibilityLabel={label || placeholder}
        style={[
          styles.triggerBtn,
          {
            backgroundColor: theme.inputBg || theme.surfaceSubtle,
            borderColor: theme.inputBorder || theme.border,
          },
        ]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.triggerLeft}>
          <Text style={styles.calendarEmoji}>📅</Text>
          <Text
            style={[
              styles.triggerText,
              { color: displayValue ? theme.textPrimary : theme.textMuted },
            ]}
          >
            {displayValue || placeholder}
          </Text>
        </View>

        <View style={styles.triggerRight}>
          {allowClear && displayValue ? (
            <TouchableOpacity
              testID={`${testID}-clear-inline`}
              onPress={(e) => {
                e.stopPropagation?.();
                onChange('');
              }}
              style={styles.inlineClearBtn}
            >
              <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>Calendário</Text>
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            testID={`${testID}-modal`}
            style={[
              styles.modalContent,
              { backgroundColor: theme.surface, borderColor: theme.border },
              theme.cardShadow,
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  {label || 'Escolher Data'}
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.primary }]}>
                  {selectedYmd ? formatYmdToBr(selectedYmd) : 'Selecione um dia no calendário'}
                  {includeTime && selectedTime ? ` • ${selectedTime}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                testID={`${testID}-close`}
                onPress={() => setVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Atalhos Rápidos */}
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  testID={`${testID}-preset-today`}
                  style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                  onPress={() => applyQuickDay(0)}
                >
                  <Text style={[styles.presetText, { color: theme.textPrimary }]}>Hoje</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`${testID}-preset-tomorrow`}
                  style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                  onPress={() => applyQuickDay(1)}
                >
                  <Text style={[styles.presetText, { color: theme.textPrimary }]}>Amanhã</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`${testID}-preset-plus7`}
                  style={[styles.presetBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                  onPress={() => applyQuickDay(7)}
                >
                  <Text style={[styles.presetText, { color: theme.textPrimary }]}>+7 Dias</Text>
                </TouchableOpacity>
              </View>

              {/* Navegação de Mês */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  testID={`${testID}-prev-month`}
                  onPress={handlePrevMonth}
                  style={[styles.arrowBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                >
                  <Text style={[styles.arrowText, { color: theme.primary }]}>◀</Text>
                </TouchableOpacity>

                <Text style={[styles.currentMonthLabel, { color: theme.textPrimary }]}>
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </Text>

                <TouchableOpacity
                  testID={`${testID}-next-month`}
                  onPress={handleNextMonth}
                  style={[styles.arrowBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
                >
                  <Text style={[styles.arrowText, { color: theme.primary }]}>▶</Text>
                </TouchableOpacity>
              </View>

              {/* Dias da Semana */}
              <View style={styles.weekDaysRow}>
                {WEEK_DAYS.map((wd) => (
                  <View key={wd} style={styles.weekDayCell}>
                    <Text style={[styles.weekDayText, { color: theme.textMuted }]}>{wd}</Text>
                  </View>
                ))}
              </View>

              {/* Grid de Dias */}
              <View style={styles.daysGrid}>
                {calendarDays.map((item, idx) => {
                  if (!item) {
                    return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;
                  }

                  const isSelected = item.ymd === selectedYmd;
                  const isToday = item.ymd === todayYmd;

                  return (
                    <View key={item.ymd} style={styles.dayCellWrapper}>
                      <TouchableOpacity
                        testID={`${testID}-day-${item.dayNumber}`}
                        onPress={() => setSelectedYmd(item.ymd)}
                        style={[
                          styles.dayBtn,
                          isToday && { borderWidth: 1.5, borderColor: theme.primary },
                          isSelected && { backgroundColor: theme.primary },
                        ]}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            { color: theme.textPrimary },
                            isToday && !isSelected && { color: theme.primary, fontWeight: '700' },
                            isSelected && { color: '#FFFFFF', fontWeight: '700' },
                          ]}
                        >
                          {item.dayNumber}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* Seletor de Horário (Quando aplicável) */}
              {includeTime && (
                <View style={[styles.timeSection, { borderTopColor: theme.border }]}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
                    ⏰ Horário do Lembrete / Compromisso:
                  </Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      testID={`${testID}-time-input`}
                      style={[
                        styles.timeInput,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={selectedTime}
                      onChangeText={(t) => setSelectedTime(maskTime(t))}
                      placeholder="09:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                    <View style={styles.timePresets}>
                      {['08:00', '12:00', '18:00', '20:00'].map((tp) => (
                        <TouchableOpacity
                          key={tp}
                          style={[
                            styles.timeChip,
                            {
                              backgroundColor: selectedTime === tp ? theme.primary : theme.surfaceSubtle,
                              borderColor: selectedTime === tp ? theme.primary : theme.border,
                            },
                          ]}
                          onPress={() => setSelectedTime(tp)}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: selectedTime === tp ? '#FFFFFF' : theme.textSecondary,
                            }}
                          >
                            {tp}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Rodapé */}
            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              {allowClear ? (
                <TouchableOpacity
                  testID={`${testID}-clear`}
                  onPress={handleClear}
                  style={styles.clearBtn}
                >
                  <Text style={[styles.clearBtnText, { color: theme.textSecondary }]}>Limpar</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              <View style={styles.actionsRight}>
                <Button
                  title="Cancelar"
                  variant="ghost"
                  onPress={() => setVisible(false)}
                  style={{ height: 40, marginRight: 8 }}
                />
                <Button
                  testID={`${testID}-confirm`}
                  title="Confirmar Data"
                  onPress={handleConfirm}
                  style={{ height: 40, minWidth: 130 }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  calendarEmoji: {
    fontSize: 18,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineClearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
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
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
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
    gap: 8,
    marginBottom: 14,
  },
  presetBadge: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    marginBottom: 6,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 38,
  },
  dayCellWrapper: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  timeSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    width: 80,
    height: 38,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  timePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  clearBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

