import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { useTheme } from '../../src/theme/ThemeContext';
import { useCalendar } from '../../src/hooks/useCalendar';
import { useGoogleCalendarAuth } from '../../src/hooks/useGoogleCalendarAuth';
import { maskTime } from '../../src/utils/format';
import { RecordScope, CalendarEventDto } from '../../../packages/shared/src';

export function extractMeetLink(location?: string | null, description?: string | null): string | null {
  const combined = `${location || ''} ${description || ''}`;
  const match = combined.match(/https?:\/\/(?:meet\.google\.com\/[a-z0-9-]+|[a-z0-9-]+\.zoom\.us\/j\/[a-z0-9-]+|teams\.microsoft\.com\/[^\s]+)/i);
  return match ? match[0] : null;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function CalendarScreen() {
  const { theme, isDark } = useTheme();
  const {
    connectCalendar,
    connectDevSimulated,
    isConnecting: isConnectingGoogle,
    statusMessage: googleAuthStatus,
    hasGoogleConnected,
  } = useGoogleCalendarAuth();
  const {
    events,
    isLoading,
    isRefetching,
    refetch,
    sharedCalendars,
    isLoadingSharedCalendars,
    refetchSharedCalendars,
    createEvent,
    isCreating,
    updateEvent,
    isUpdating,
    deleteEvent,
    syncGoogle,
    isSyncingGoogle,
  } = useCalendar();

  // Data atual de referência
  const today = useMemo(() => new Date(), []);

  // Mês e ano em exibição no grid
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Data selecionada pelo usuário (padrão: hoje no formato YYYY-MM-DD)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Modal Novo Evento
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStartDateStr, setNewStartDateStr] = useState(selectedDateStr);
  const [newEndDateStr, setNewEndDateStr] = useState(selectedDateStr);
  const [newIsMultiDay, setNewIsMultiDay] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [newMeetLink, setNewMeetLink] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsAllDay, setNewIsAllDay] = useState(false);
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newScope, setNewScope] = useState<RecordScope>(RecordScope.SHARED);
  const [newAttendees, setNewAttendees] = useState('');
  const [newCreateMeetLink, setNewCreateMeetLink] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Modal Editar Evento
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventDto | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDateStr, setEditStartDateStr] = useState('');
  const [editEndDateStr, setEditEndDateStr] = useState('');
  const [editIsMultiDay, setEditIsMultiDay] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [editMeetLink, setEditMeetLink] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsAllDay, setEditIsAllDay] = useState(false);
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('10:00');
  const [editScope, setEditScope] = useState<RecordScope>(RecordScope.SHARED);
  const [editAttendees, setEditAttendees] = useState('');
  const [editCreateMeetLink, setEditCreateMeetLink] = useState(false);


  // Navegação de mês
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = String(today.getDate()).padStart(2, '0');
    setCurrentYear(y);
    setCurrentMonth(m);
    setSelectedDateStr(`${y}-${String(m + 1).padStart(2, '0')}-${d}`);
  };

  // Gerar matriz de dias do mês
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Domingo
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Dias do mês anterior para preencher a primeira semana
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Preenche início
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        month: prevM,
        year: prevY,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Dias do mês atual
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
      });
    }

    // Completa a última semana
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        month: nextM,
        year: nextY,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [currentYear, currentMonth, today]);

  // Mapa de eventos por dia para indicadores rápidos (pontinhos)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventDto[]>();
    for (const ev of events) {
      const s = new Date(ev.startDate);
      const e = ev.endDate ? new Date(ev.endDate) : s;

      const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());

      const current = new Date(startDay.getTime());
      let safetyCounter = 0;
      while (current <= endDay && safetyCounter < 90) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;

        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(ev);

        current.setDate(current.getDate() + 1);
        safetyCounter++;
      }
    }
    return map;
  }, [events]);

  // Eventos do dia selecionado
  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(selectedDateStr) || [];
  }, [eventsByDate, selectedDateStr]);

  // Formatação da data selecionada em texto bonito
  const selectedDateFormatted = useMemo(() => {
    const parts = selectedDateStr.split('-');
    if (parts.length !== 3) return selectedDateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    return dt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [selectedDateStr]);

  // Ação de Sincronizar com Google Agenda
  const handleSyncGoogle = async () => {
    try {
      setSyncStatusMsg("Sincronizando com Google Agenda...");
      const res = await syncGoogle();
      if (res.success) {
        setSyncStatusMsg(
          `Sincronizado! +${res.importedFromGoogle || 0} recebido(s), +${res.exportedToGoogle || 0} enviado(s).`
        );
      } else if (res.needsActivation) {
        const actUrl = res.activationUrl || "https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=163978455295";
        setSyncStatusMsg("⚠️ Google Calendar API desativada no Google Cloud! Abrindo link para Ativar...");
        if (Platform.OS === "web") {
          window.open(actUrl, "_blank");
        } else {
          Linking.openURL(actUrl);
        }
      } else if (res.needsConnect) {
        setSyncStatusMsg(res.message);
        if (Platform.OS === "web") {
          if (window.confirm("Você precisa autorizar o acesso ao Google Agenda. Deseja conectar sua conta agora?")) {
            connectCalendar();
          }
        } else {
          Alert.alert(
            "Conectar Google Agenda",
            "Sua conta Google precisa autorizar o acesso à agenda. Deseja conectar agora?",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Conectar", onPress: connectCalendar },
            ]
          );
        }
      } else {
        setSyncStatusMsg(res.message || "Verifique as permissões de acesso ao Google Agenda.");
      }
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (e: any) {
      setSyncStatusMsg("Erro ao conectar com Google Agenda.");
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  const handleOpenNewEvent = () => {
    setNewTitle('');
    setNewStartDateStr(selectedDateStr);
    setNewEndDateStr(selectedDateStr);
    setNewIsMultiDay(false);
    setNewLocation('');
    setNewMeetLink('');
    setNewAttendees('');
    setNewCreateMeetLink(false);
    setNewDescription('');
    setNewIsAllDay(false);
    setNewStartTime('09:00');
    setNewEndTime('10:00');
    setNewScope(RecordScope.SHARED);
    setModalVisible(true);
  };

  // Salvar Novo Evento
  const handleSaveEvent = async () => {
    if (!newTitle.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Informe o título do compromisso');
      } else {
        Alert.alert('Atenção', 'Informe o título do compromisso');
      }
      return;
    }

    try {
      const startDay = newStartDateStr || selectedDateStr;
      const endDay = newIsMultiDay && newEndDateStr >= startDay ? newEndDateStr : startDay;

      let startDateIso: string;
      let endDateIso: string | undefined;

      if (newIsAllDay) {
        startDateIso = new Date(`${startDay}T00:00:00-03:00`).toISOString();
        endDateIso = new Date(`${endDay}T23:59:59-03:00`).toISOString();
      } else {
        startDateIso = new Date(`${startDay}T${newStartTime}:00-03:00`).toISOString();
        endDateIso = new Date(`${endDay}T${newEndTime}:00-03:00`).toISOString();
      }

      let finalLocation = newLocation.trim();
      if (newMeetLink.trim()) {
        const link = newMeetLink.trim();
        if (!finalLocation) {
          finalLocation = link;
        } else if (!finalLocation.includes(link)) {
          finalLocation = `${finalLocation} | ${link}`;
        }
      }

      await createEvent({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        location: finalLocation || undefined,
        startDate: startDateIso,
        endDate: endDateIso,
        isAllDay: newIsAllDay,
        scope: newScope,
        attendees: newAttendees.trim() || undefined,
        createMeetLink: newCreateMeetLink,
      });

      setModalVisible(false);
      setNewTitle('');
      setNewLocation('');
      setNewMeetLink('');
      setNewAttendees('');
      setNewCreateMeetLink(false);
      setNewDescription('');
      setNewIsAllDay(false);
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível cadastrar o evento');
    }
  };

  const handleOpenEdit = (event: CalendarEventDto) => {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDescription(event.description || '');
    setEditIsAllDay(event.isAllDay);
    setEditScope(event.scope);

    const s = new Date(event.startDate);
    const startStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    setEditStartDateStr(startStr);

    const e = event.endDate ? new Date(event.endDate) : s;
    const endStr = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
    setEditEndDateStr(endStr);
    setEditIsMultiDay(endStr !== startStr);

    const detectedMeet = extractMeetLink(event.location, event.description);
    setEditMeetLink(detectedMeet || '');

    let cleanLoc = event.location || '';
    if (detectedMeet && cleanLoc.includes(detectedMeet)) {
      cleanLoc = cleanLoc.replace(detectedMeet, '').replace(/\|\s*$/, '').trim();
    }
    setEditLocation(cleanLoc);

    if (event.attendees) {
      try {
        const parsed = JSON.parse(event.attendees);
        if (Array.isArray(parsed)) {
          setEditAttendees(parsed.map((a: any) => (typeof a === 'string' ? a : a.email || a.displayName)).join(', '));
        } else {
          setEditAttendees(event.attendees);
        }
      } catch {
        setEditAttendees(event.attendees);
      }
    } else {
      setEditAttendees('');
    }
    setEditCreateMeetLink(false);

    const startH = String(s.getHours()).padStart(2, '0') + ':' + String(s.getMinutes()).padStart(2, '0');
    setEditStartTime(startH);

    if (event.endDate) {
      const endH = String(e.getHours()).padStart(2, '0') + ':' + String(e.getMinutes()).padStart(2, '0');
      setEditEndTime(endH);
    } else {
      setEditEndTime('10:00');
    }

    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEvent || !editTitle.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Informe o título do compromisso');
      } else {
        Alert.alert('Atenção', 'Informe o título do compromisso');
      }
      return;
    }

    try {
      const startDay = editStartDateStr || selectedDateStr;
      const endDay = editIsMultiDay && editEndDateStr >= startDay ? editEndDateStr : startDay;

      let startDateIso: string;
      let endDateIso: string | undefined;

      if (editIsAllDay) {
        startDateIso = new Date(`${startDay}T00:00:00-03:00`).toISOString();
        endDateIso = new Date(`${endDay}T23:59:59-03:00`).toISOString();
      } else {
        startDateIso = new Date(`${startDay}T${editStartTime}:00-03:00`).toISOString();
        endDateIso = new Date(`${endDay}T${editEndTime}:00-03:00`).toISOString();
      }

      let finalLocation = editLocation.trim();
      if (editMeetLink.trim()) {
        const link = editMeetLink.trim();
        if (!finalLocation) {
          finalLocation = link;
        } else if (!finalLocation.includes(link)) {
          finalLocation = `${finalLocation} | ${link}`;
        }
      }

      await updateEvent({
        id: editingEvent.id,
        dto: {
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
          location: finalLocation || undefined,
          startDate: startDateIso,
          endDate: endDateIso,
          isAllDay: editIsAllDay,
          scope: editScope,
          attendees: editAttendees.trim() || undefined,
          createMeetLink: editCreateMeetLink,
        },
      });

      setEditModalVisible(false);
      setEditingEvent(null);
      setSyncStatusMsg('Evento atualizado e sincronizado com Google! ✅');
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o evento.');
    }
  };

  // Excluir Evento
  const handleDeleteEvent = (event: CalendarEventDto) => {
    const doDelete = async () => {
      try {
        await deleteEvent(event.id);
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível excluir o evento.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja excluir o evento "${event.title}"?`)) {
        doDelete();
      }
      return;
    }

    Alert.alert('Excluir Evento', `Deseja remover "${event.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Agenda & Calendário"
        subtitle="Eventos e Google Agenda"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BANNER DE SINCRONIZAÇÃO COM GOOGLE AGENDA */}
        <View
          style={[
            styles.syncBanner,
            {
              backgroundColor: theme.surface,
              borderColor: hasGoogleConnected ? "#10B981" : theme.border,
            },
            theme.cardShadow,
          ]}
        >
          <View style={styles.syncBannerLeft}>
            <Text style={styles.googleIcon}>🗓️</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.syncTitle, { color: theme.textPrimary }]}>
                  Google Agenda
                </Text>
                <View
                  style={[
                    styles.connBadge,
                    {
                      backgroundColor: hasGoogleConnected
                        ? isDark ? "#064E3B" : "#DCFCE7"
                        : isDark ? "#451A03" : "#FEF3C7",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.connBadgeText,
                      {
                        color: hasGoogleConnected
                          ? isDark ? "#6EE7B7" : "#15803D"
                          : isDark ? "#FCD34D" : "#B45309",
                      },
                    ]}
                  >
                    {hasGoogleConnected ? "● Conectado" : "○ Não vinculado"}
                  </Text>
                </View>
              </View>

              <Text style={[styles.syncSubtitle, { color: theme.textSecondary }]}>
                {hasGoogleConnected
                  ? "Sincronização bidirecional ativa em tempo real."
                  : "Autorize o acesso para sincronizar compromissos entre o Nexo e sua agenda."}
              </Text>

              {syncStatusMsg || googleAuthStatus ? (
                <Text style={[styles.syncFeedback, { color: theme.primary }]}>
                  {syncStatusMsg || googleAuthStatus}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            {hasGoogleConnected ? (
              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                onPress={handleSyncGoogle}
                disabled={isSyncingGoogle}
                activeOpacity={0.7}
              >
                {isSyncingGoogle ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={[styles.syncBtnText, { color: theme.primary }]}>
                    🔄 Sincronizar
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectBtn, { backgroundColor: "#4285F4" }]}
                onPress={connectCalendar}
                disabled={isConnectingGoogle}
                activeOpacity={0.8}
              >
                {isConnectingGoogle ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.connectBtnText}>
                    🔗 Conectar Google
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {!hasGoogleConnected && (
              <TouchableOpacity
                onPress={connectDevSimulated}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 10, color: theme.textMuted }}>
                  (ou teste simulação)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* CARROSSEL DE CALENDÁRIOS GOOGLE (INCLUSIVE COMPARTILHADOS) COM CORES ORIGINAIS */}
        {hasGoogleConnected && sharedCalendars && sharedCalendars.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 8, paddingHorizontal: 4 }}>
              SUAS AGENDAS SINCRONIZADAS EM TEMPO REAL:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {sharedCalendars.map((cal) => (
                <View
                  key={cal.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: theme.surface,
                    borderWidth: 1.5,
                    borderColor: cal.colors.background || theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: cal.colors.background || '#4285F4',
                    }}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textPrimary }}>
                    {cal.name}
                  </Text>
                  {!cal.isPrimary && (
                    <Text style={{ fontSize: 10, color: cal.colors.background || theme.primary, fontWeight: '700' }}>
                      (Compartilhada)
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CONTROLES DO MÊS */}
        <View style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
          <View style={styles.monthHeader}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={[styles.arrowBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.arrowText, { color: theme.textPrimary }]}>‹</Text>
            </TouchableOpacity>

            <View style={styles.monthTitleContainer}>
              <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
              <TouchableOpacity
                onPress={handleGoToday}
                style={[styles.todayPill, { backgroundColor: theme.primaryLight }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.todayPillText, { color: theme.primary }]}>Hoje</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={[styles.arrowBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.arrowText, { color: theme.textPrimary }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* CABEÇALHO DOS DIAS DA SEMANA */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((w, idx) => (
              <Text
                key={w}
                style={[
                  styles.weekdayLabel,
                  { color: idx === 0 || idx === 6 ? theme.primary : theme.textSecondary },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* GRID DE DIAS */}
          <View style={styles.daysGrid}>
            {calendarDays.map((item, index) => {
              const isSelected = item.dateStr === selectedDateStr;
              const dayEvents = eventsByDate.get(item.dateStr) || [];
              const hasSharedEvent = dayEvents.some((e) => e.scope === RecordScope.SHARED);
              const hasPrivateEvent = dayEvents.some((e) => e.scope === RecordScope.PRIVATE);

              return (
                <TouchableOpacity
                  key={`${item.dateStr}-${index}`}
                  style={[
                    styles.dayCell,
                    isSelected && {
                      backgroundColor: theme.primary,
                      borderRadius: 14,
                    },
                    item.isToday && !isSelected && {
                      borderWidth: 1.5,
                      borderColor: theme.primary,
                      borderRadius: 14,
                    },
                  ]}
                  onPress={() => setSelectedDateStr(item.dateStr)}
                  activeOpacity={0.65}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : item.isCurrentMonth
                            ? theme.textPrimary
                            : theme.textMuted,
                        fontWeight: item.isToday || isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {item.day}
                  </Text>

                  {/* Indicador de Eventos (dots) */}
                  <View style={styles.dotContainer}>
                    {hasSharedEvent && (
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: isSelected ? '#FFFFFF' : '#3B82F6' },
                        ]}
                      />
                    )}
                    {hasPrivateEvent && (
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: isSelected ? '#93C5FD' : '#8B5CF6' },
                        ]}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* LISTAGEM DE COMPROMISSOS DO DIA SELECIONADO */}
        <View style={styles.agendaSection}>
          <View style={styles.agendaHeader}>
            <View>
              <Text style={[styles.agendaSectionTitle, { color: theme.textPrimary }]}>
                {selectedDateFormatted.charAt(0).toUpperCase() + selectedDateFormatted.slice(1)}
              </Text>
              <Text style={[styles.agendaSubtitle, { color: theme.textSecondary }]}>
                {selectedDayEvents.length === 0
                  ? 'Nenhum compromisso agendado'
                  : `${selectedDayEvents.length} compromisso${selectedDayEvents.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
          ) : selectedDayEvents.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                theme.cardShadow,
              ]}
            >
              <Text style={styles.emptyIcon}>☕</Text>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                Dia livre ou sem eventos
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                Você pode adicionar eventos por aqui ou enviar áudio, foto de convite ou mensagem no WhatsApp do Nexo!
              </Text>
            </View>
          ) : (
            selectedDayEvents.map((item) => {
              const start = new Date(item.startDate);
              const end = item.endDate ? new Date(item.endDate) : start;

              const isMultiDayEvent =
                start.getFullYear() !== end.getFullYear() ||
                start.getMonth() !== end.getMonth() ||
                start.getDate() !== end.getDate();

              const multiDayLabel = isMultiDayEvent
                ? `📆 ${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} até ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                : null;

              const timeString = item.isAllDay
                ? 'Dia Inteiro'
                : start.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

              const isShared = item.scope === RecordScope.SHARED;
              const meetUrl = extractMeetLink(item.location, item.description);

              // Remove link do Meet da localização para não duplicar visualmente
              let displayLocation = item.location || '';
              if (meetUrl && displayLocation.includes(meetUrl)) {
                displayLocation = displayLocation
                  .replace(meetUrl, '')
                  .replace(/\|\s*$/, '')
                  .replace(/^\s*\|\s*/, '')
                  .trim();
              }

              return (
                <View
                  key={item.id}
                  style={[
                    styles.eventCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderLeftColor: item.color || (isShared ? '#3B82F6' : '#8B5CF6'),
                      borderLeftWidth: 5,
                    },
                    theme.cardShadow,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.eventCardContent}
                    onPress={() => handleOpenEdit(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.eventTimeRow}>
                      <Text style={[styles.eventTime, { color: theme.primary }]}>
                        ⏰ {timeString}
                      </Text>

                      <View style={styles.badgeRow}>
                        {multiDayLabel ? (
                          <View
                            style={[
                              styles.scopeBadge,
                              {
                                backgroundColor: isDark ? '#451A03' : '#FEF3C7',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.scopeBadgeText,
                                {
                                  color: isDark ? '#FCD34D' : '#B45309',
                                  fontWeight: '700',
                                },
                              ]}
                            >
                              {multiDayLabel}
                            </Text>
                          </View>
                        ) : null}

                        {item.googleEventId ? (
                          <View
                            style={[
                              styles.scopeBadge,
                              {
                                backgroundColor: item.color ? `${item.color}22` : '#E0F2FE',
                                borderColor: item.color || '#0369A1',
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 4,
                                backgroundColor: item.color || '#4285F4',
                                marginRight: 4,
                              }}
                            />
                            <Text style={[styles.scopeBadgeText, { color: item.color || '#0369A1', fontWeight: '700' }]}>
                              {item.googleCalendarId && item.googleCalendarId !== 'primary' ? '👥 Compartilhada' : '🗓️ Google'}
                            </Text>
                          </View>
                        ) : null}

                        <View
                          style={[
                            styles.scopeBadge,
                            {
                              backgroundColor: isShared
                                ? isDark ? '#1E293B' : '#EFF6FF'
                                : isDark ? '#2E1065' : '#FAF5FF',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.scopeBadgeText,
                              {
                                color: isShared
                                  ? isDark ? '#93C5FD' : '#1D4ED8'
                                  : isDark ? '#D8B4FE' : '#6B21A8',
                              },
                            ]}
                          >
                            {isShared ? '🏠 Compartilhado' : '🔒 Pessoal'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.eventTitle, { color: theme.textPrimary }]}>
                      {item.title}
                    </Text>

                    {/* BOTÃO PROEMINENTE DO GOOGLE MEET */}
                    {meetUrl && (
                      <TouchableOpacity
                        style={[
                          styles.meetCallBtn,
                          {
                            backgroundColor: isDark ? '#064E3B' : '#DCFCE7',
                            borderColor: '#10B981',
                          },
                        ]}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            window.open(meetUrl, '_blank');
                          } else {
                            Linking.openURL(meetUrl);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.meetCallBtnText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                          🎥 Entrar no Google Meet
                        </Text>
                        <Text style={[styles.meetCallBtnSub, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                          ↗ Acessar chamada
                        </Text>
                      </TouchableOpacity>
                    )}

                    {displayLocation ? (
                      <Text style={[styles.eventLocation, { color: theme.textSecondary }]}>
                        📍 {displayLocation}
                      </Text>
                    ) : null}

                    {item.description ? (
                      <Text style={[styles.eventDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}

                    {/* CONVIDADOS / ATTENDEES */}
                    {item.attendees ? (() => {
                      let parsedAttendees: Array<{ email: string; displayName?: string; responseStatus?: string }> = [];
                      try {
                        const parsed = JSON.parse(item.attendees);
                        if (Array.isArray(parsed)) parsedAttendees = parsed;
                      } catch {
                        parsedAttendees = item.attendees.split(/[,;\n]/).map((e) => ({ email: e.trim() })).filter((e) => e.email.includes('@'));
                      }
                      if (parsedAttendees.length === 0) return null;
                      return (
                        <View style={styles.attendeesContainer}>
                          <Text style={[styles.attendeesLabel, { color: theme.textSecondary }]}>
                            👥 Convidados ({parsedAttendees.length}):
                          </Text>
                          <View style={styles.attendeesList}>
                            {parsedAttendees.map((att, idx) => {
                              const statusIcon = att.responseStatus === 'accepted' ? '✓' : att.responseStatus === 'declined' ? '✕' : '⏳';
                              const statusColor = att.responseStatus === 'accepted' ? '#10B981' : att.responseStatus === 'declined' ? '#EF4444' : '#F59E0B';
                              return (
                                <View
                                  key={idx}
                                  style={[
                                    styles.attendeeChip,
                                    {
                                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                      borderColor: theme.border,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.attendeeChipText, { color: theme.textPrimary }]}>
                                    {att.displayName || att.email}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: statusColor, fontWeight: '700' }}>
                                    {statusIcon}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })() : null}
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleOpenEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleDeleteEvent(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.deleteBtnText, { color: theme.danger }]}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB FLUTUANTE NA ZONA DO POLEGAR (PADRÃO DAS OUTRAS TELAS) */}
      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: theme.primary }, theme.fabShadow]}
        onPress={handleOpenNewEvent}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Novo Evento</Text>
      </TouchableOpacity>

      {/* MODAL: NOVO EVENTO */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              theme.cardShadow,
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                📅 Novo Compromisso
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceSubtle }]}
              >
                <Text style={{ fontSize: 16, color: theme.textPrimary, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Título do Evento</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ex: Reunião com arquiteto, Dentista..."
                placeholderTextColor={theme.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* DURAÇÃO: MÚLTIPLOS DIAS */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                    Duração de múltiplos dias
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    O evento dura mais de um dia consecutivo
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: newIsMultiDay ? theme.primary : theme.surfaceSubtle },
                  ]}
                  onPress={() => {
                    const next = !newIsMultiDay;
                    setNewIsMultiDay(next);
                    if (!next) {
                      setNewEndDateStr(newStartDateStr);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      newIsMultiDay && { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* DATAS DE INÍCIO E TÉRMINO */}
              <View style={[styles.timeRow, { gap: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Data de Início
                  </Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={newStartDateStr}
                      onChange={(e: any) => {
                        const val = e.target.value;
                        setNewStartDateStr(val);
                        if (!newIsMultiDay || newEndDateStr < val) {
                          setNewEndDateStr(val);
                        }
                      }}
                      style={{
                        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                        color: isDark ? '#F1F5F9' : '#0F172A',
                        colorScheme: isDark ? 'dark' : 'light',
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: '10px 12px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        width: '100%',
                        height: 44,
                        minWidth: 0,
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        display: 'block',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        textAlign: 'left',
                      }}
                    />
                  ) : (
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.textPrimary }]}
                      value={newStartDateStr}
                      onChangeText={setNewStartDateStr}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={theme.textMuted}
                    />
                  )}
                </View>

                {newIsMultiDay && (
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Data de Término
                    </Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={newEndDateStr}
                        min={newStartDateStr}
                        onChange={(e: any) => setNewEndDateStr(e.target.value)}
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                          color: isDark ? '#F1F5F9' : '#0F172A',
                          colorScheme: isDark ? 'dark' : 'light',
                          border: `1px solid ${theme.border}`,
                          borderRadius: 12,
                          padding: '10px 12px',
                          fontSize: 14,
                          fontFamily: 'inherit',
                          outline: 'none',
                          width: '100%',
                          height: 44,
                          minWidth: 0,
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          display: 'block',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          textAlign: 'left',
                        }}
                      />
                    ) : (
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.textPrimary }]}
                        value={newEndDateStr}
                        onChangeText={setNewEndDateStr}
                        placeholder="AAAA-MM-DD"
                        placeholderTextColor={theme.textMuted}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Toggle Dia Inteiro */}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                  Dia inteiro
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: newIsAllDay ? theme.primary : theme.surfaceSubtle },
                  ]}
                  onPress={() => setNewIsAllDay(!newIsAllDay)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      newIsAllDay && { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {!newIsAllDay && (
                <View style={[styles.timeRow, { gap: 12 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Início (HH:MM)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={newStartTime}
                      onChangeText={(t) => setNewStartTime(maskTime(t))}
                      placeholder="09:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Término (HH:MM)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={newEndTime}
                      onChangeText={(t) => setNewEndTime(maskTime(t))}
                      placeholder="10:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              )}

              {/* GERAR GOOGLE MEET AUTOMÁTICO */}
              <View style={[styles.switchRow, { marginTop: 14 }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                    🎥 Gerar sala Google Meet
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    Cria automaticamente uma sala real no Google Calendar
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: newCreateMeetLink ? theme.primary : theme.surfaceSubtle },
                  ]}
                  onPress={() => setNewCreateMeetLink(!newCreateMeetLink)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      newCreateMeetLink && { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* LINK DO MEET MANUAL (SE DESEJAR COLAR OUTRO LINK) */}
              {!newCreateMeetLink && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    🎥 Link do Meet / Videochamada (Opcional)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="https://meet.google.com/xyz-abcd-efg"
                    placeholderTextColor={theme.textMuted}
                    value={newMeetLink}
                    onChangeText={setNewMeetLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              {/* CONVIDADOS */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  👥 Convidados (e-mails)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceSubtle,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Ex: ana@gmail.com, lucas@empresa.com"
                  placeholderTextColor={theme.textMuted}
                  value={newAttendees}
                  onChangeText={setNewAttendees}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                  Separe múltiplos e-mails por vírgula. Convites oficiais serão enviados se conectado ao Google.
                </Text>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Local Físico (Opcional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ex: Consultório, Sala de Reunião, Casa..."
                placeholderTextColor={theme.textMuted}
                value={newLocation}
                onChangeText={setNewLocation}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Escopo do Evento
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    newScope === RecordScope.SHARED && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setNewScope(RecordScope.SHARED)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: newScope === RecordScope.SHARED ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    🏠 Compartilhado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    newScope === RecordScope.PRIVATE && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setNewScope(RecordScope.PRIVATE)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: newScope === RecordScope.PRIVATE ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    🔒 Pessoal
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Notas / Descrição
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                    height: 60,
                  },
                ]}
                placeholder="Detalhes ou observações..."
                placeholderTextColor={theme.textMuted}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveEvent}
                disabled={isCreating}
                activeOpacity={0.8}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Adicionar à Agenda</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDITAR EVENTO */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              theme.cardShadow,
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                ✏️ Editar Compromisso
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceSubtle }]}
              >
                <Text style={{ fontSize: 16, color: theme.textPrimary, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Título do Evento</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ex: Reunião, Dentista..."
                placeholderTextColor={theme.textMuted}
                value={editTitle}
                onChangeText={setEditTitle}
              />

              {/* DURAÇÃO: MÚLTIPLOS DIAS */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                    Duração de múltiplos dias
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    O evento dura mais de um dia consecutivo
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: editIsMultiDay ? theme.primary : theme.surfaceSubtle },
                  ]}
                  onPress={() => {
                    const next = !editIsMultiDay;
                    setEditIsMultiDay(next);
                    if (!next) {
                      setEditEndDateStr(editStartDateStr);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      editIsMultiDay && { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* DATAS DE INÍCIO E TÉRMINO */}
              <View style={[styles.timeRow, { gap: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Data de Início
                  </Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={editStartDateStr}
                      onChange={(e: any) => {
                        const val = e.target.value;
                        setEditStartDateStr(val);
                        if (!editIsMultiDay || editEndDateStr < val) {
                          setEditEndDateStr(val);
                        }
                      }}
                      style={{
                        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                        color: isDark ? '#F1F5F9' : '#0F172A',
                        colorScheme: isDark ? 'dark' : 'light',
                        border: `1px solid ${theme.border}`,
                        borderRadius: 12,
                        padding: '10px 12px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        width: '100%',
                        height: 44,
                        minWidth: 0,
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        display: 'block',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        textAlign: 'left',
                      }}
                    />
                  ) : (
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.textPrimary }]}
                      value={editStartDateStr}
                      onChangeText={setEditStartDateStr}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={theme.textMuted}
                    />
                  )}
                </View>

                {editIsMultiDay && (
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                      Data de Término
                    </Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="date"
                        value={editEndDateStr}
                        min={editStartDateStr}
                        onChange={(e: any) => setEditEndDateStr(e.target.value)}
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                          color: isDark ? '#F1F5F9' : '#0F172A',
                          colorScheme: isDark ? 'dark' : 'light',
                          border: `1px solid ${theme.border}`,
                          borderRadius: 12,
                          padding: '10px 12px',
                          fontSize: 14,
                          fontFamily: 'inherit',
                          outline: 'none',
                          width: '100%',
                          height: 44,
                          minWidth: 0,
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          display: 'block',
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          textAlign: 'left',
                        }}
                      />
                    ) : (
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, color: theme.textPrimary }]}
                        value={editEndDateStr}
                        onChangeText={setEditEndDateStr}
                        placeholder="AAAA-MM-DD"
                        placeholderTextColor={theme.textMuted}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Toggle Dia Inteiro */}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                  Dia inteiro
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: editIsAllDay ? theme.primary : theme.surfaceSubtle },
                  ]}
                  onPress={() => setEditIsAllDay(!editIsAllDay)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      editIsAllDay && { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {!editIsAllDay && (
                <View style={[styles.timeRow, { gap: 12 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Início (HH:MM)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={editStartTime}
                      onChangeText={(t) => setEditStartTime(maskTime(t))}
                      placeholder="09:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Término (HH:MM)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surfaceSubtle,
                          borderColor: theme.border,
                          color: theme.textPrimary,
                        },
                      ]}
                      value={editEndTime}
                      onChangeText={(t) => setEditEndTime(maskTime(t))}
                      placeholder="10:00"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                </View>
              )}

              {/* GERAR GOOGLE MEET AUTOMÁTICO */}
              <View style={[styles.switchRow, { marginTop: 14 }]}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.switchLabel, { color: theme.textPrimary }]}>
                    🎥 Gerar sala Google Meet
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    Cria automaticamente uma sala real no Google Calendar
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: editCreateMeetLink ? theme.primary : theme.surfaceSubtle },
                  ]}
                  onPress={() => setEditCreateMeetLink(!editCreateMeetLink)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      editCreateMeetLink && { alignSelf: 'flex-end', backgroundColor: '#FFFFFF' },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {/* LINK DO MEET MANUAL (SE DESEJAR COLAR OUTRO LINK) */}
              {!editCreateMeetLink && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    🎥 Link do Meet / Videochamada (Opcional)
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceSubtle,
                        borderColor: theme.border,
                        color: theme.textPrimary,
                      },
                    ]}
                    placeholder="https://meet.google.com/xyz-abcd-efg"
                    placeholderTextColor={theme.textMuted}
                    value={editMeetLink}
                    onChangeText={setEditMeetLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              {/* CONVIDADOS */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  👥 Convidados (e-mails)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceSubtle,
                      borderColor: theme.border,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="Ex: ana@gmail.com, lucas@empresa.com"
                  placeholderTextColor={theme.textMuted}
                  value={editAttendees}
                  onChangeText={setEditAttendees}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                  Separe múltiplos e-mails por vírgula. Convites oficiais serão enviados se conectado ao Google.
                </Text>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Local Físico (Opcional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="Ex: Consultório, Google Meet, Casa..."
                placeholderTextColor={theme.textMuted}
                value={editLocation}
                onChangeText={setEditLocation}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Escopo do Evento
              </Text>
              <View style={styles.scopeSelector}>
                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    editScope === RecordScope.SHARED && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setEditScope(RecordScope.SHARED)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: editScope === RecordScope.SHARED ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    🏠 Compartilhado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeOption,
                    editScope === RecordScope.PRIVATE && {
                      backgroundColor: theme.primaryLight,
                      borderColor: theme.primary,
                    },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => setEditScope(RecordScope.PRIVATE)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.scopeOptionText,
                      { color: editScope === RecordScope.PRIVATE ? theme.primary : theme.textSecondary },
                    ]}
                  >
                    🔒 Pessoal
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                Notas / Descrição
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                    height: 60,
                  },
                ]}
                placeholder="Detalhes ou observações..."
                placeholderTextColor={theme.textMuted}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveEdit}
                disabled={isUpdating}
                activeOpacity={0.8}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>💾 Salvar e Sincronizar com Google</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  newEventHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  newEventHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  syncBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  googleIcon: {
    fontSize: 28,
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  syncSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  syncFeedback: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  syncBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: -2,
  },
  monthTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  dayNumber: {
    fontSize: 14,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  agendaSection: {
    marginTop: 4,
  },
  agendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  agendaSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  agendaSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addEventInlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addEventInlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 5,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  eventCardContent: {
    flex: 1,
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  scopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scopeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  eventDesc: {
    fontSize: 11,
    marginTop: 4,
  },
  deleteBtn: {
    padding: 8,
  },
  actionIconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#94A3B8',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  scopeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  scopeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  scopeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  connBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  connBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  connectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  meetCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  meetCallBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  meetCallBtnSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  multiDayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  multiDayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 26,
    gap: 8,
    zIndex: 99,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  attendeesContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  attendeesLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  attendeesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  attendeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  attendeeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
