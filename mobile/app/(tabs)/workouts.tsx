import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { CalendarDatePicker } from '../../src/components/CalendarDatePicker';
import { LoadingState } from '../../src/components/LoadingState';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/hooks/useAuth';
import { useWorkouts } from '../../src/hooks/useWorkouts';
import { useStravaAuth } from '../../src/hooks/useStravaAuth';
import { formatDate } from '../../src/utils/format';
import {
  WorkoutModality,
  FitnessProvider,
  WorkoutStatus,
  RecordScope,
  StrengthExerciseDto,
  WorkoutActivityDto,
  RunningWorkoutStepDto,
} from '../../../packages/shared/src';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

interface WeekBucket {
  weekNumber: number;
  label: string;
  rangeLabel: string;
  startDate: Date;
  endDate: Date;
  days: Date[];
  isCurrentWeek: boolean;
}

function buildMonthWeeks(year: number, monthIndex: number): WeekBucket[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const buckets: WeekBucket[] = [];
  const today = new Date();

  let currentDay = 1;
  let weekNum = 1;

  while (currentDay <= daysInMonth) {
    const start = new Date(year, monthIndex, currentDay, 0, 0, 0, 0);
    const startDayOfWeek = start.getDay(); // 0 (Dom) .. 6 (Sáb)
    const daysRemainingInWeek = 6 - startDayOfWeek;
    const endDay = Math.min(daysInMonth, currentDay + daysRemainingInWeek);
    const end = new Date(year, monthIndex, endDay, 23, 59, 59, 999);

    const days: Date[] = [];
    for (let d = currentDay; d <= endDay; d++) {
      days.push(new Date(year, monthIndex, d, 12, 0, 0, 0));
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const mStr = pad(monthIndex + 1);
    const rangeLabel = `${pad(currentDay)}/${mStr} – ${pad(endDay)}/${mStr}`;
    const isCurrentWeek = today >= start && today <= end;

    buckets.push({
      weekNumber: weekNum,
      label: `Semana ${weekNum}`,
      rangeLabel,
      startDate: start,
      endDate: end,
      days,
      isCurrentWeek,
    });

    currentDay = endDay + 1;
    weekNum++;
  }

  return buckets;
}

export default function WorkoutsScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const {
    dashboard,
    workouts,
    integrations,
    weeklyStats,
    isLoading,
    createWorkout,
    isCreating,
    disconnectProvider,
    isDisconnecting,
    syncProvider,
    isSyncing,
    syncAll,
    isSyncingAll,
    syncGarminCalendar,
    isSyncingGarminCalendar,
    syncGarminCalendarViaApi,
    isSyncingGarminCalendarViaApi,
    completeWorkout,
    isCompleting,
    cheerWorkout,
    isCheering,
    deleteWorkout,
  } = useWorkouts();

  const garminIntegration = integrations.find((i) => i.provider === FitnessProvider.GARMIN);

  const {
    startStravaOAuth,
    isAuthenticating,
    statusMessage: oauthStatusMessage,
    errorMessage: oauthErrorMessage,
  } = useStravaAuth();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | 'ALL'>('ALL');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const [filterModality, setFilterModality] = useState<'ALL' | WorkoutModality>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | WorkoutStatus>('ALL');
  const [filterPerson, setFilterPerson] = useState<'ALL' | string>('ALL');
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Record<string, boolean>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [garminCalendarModalVisible, setGarminCalendarModalVisible] = useState(false);
  const [garminCalendarTab, setGarminCalendarTab] = useState<'API' | 'ICAL'>('API');
  const [garminEmailInput, setGarminEmailInput] = useState(user?.email || 'muridelvaux@gmail.com');
  const [garminPasswordInput, setGarminPasswordInput] = useState('');
  const [garminCalendarUrlInput, setGarminCalendarUrlInput] = useState(
    'https://connect.garmin.com/modern/calendar/export/6598bdd3c8cc4692b231a9fba423b693',
  );
  const [garminIcsContentInput, setGarminIcsContentInput] = useState('');
  const [cheerToast, setCheerToast] = useState<string | null>(null);

  useEffect(() => {
    if (garminIntegration?.calendarUrl) {
      setGarminCalendarUrlInput(garminIntegration.calendarUrl);
    }
  }, [garminIntegration?.calendarUrl]);

  // Estados do modal de registro manual de treino
  const [modality, setModality] = useState<WorkoutModality>(WorkoutModality.RUNNING);
  const [workoutStatusForm, setWorkoutStatusForm] = useState<WorkoutStatus>(
    WorkoutStatus.COMPLETED,
  );
  const [title, setTitle] = useState('');
  const [workoutType, setWorkoutType] = useState('Base Aeróbica (Z2)');
  const [targetPace, setTargetPace] = useState('5:15 - 5:30 /km');
  const [startedAtDate, setStartedAtDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [distanceKm, setDistanceKm] = useState('6.0');
  const [calories, setCalories] = useState('410');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<StrengthExerciseDto[]>([
    { name: 'Supino Reto', sets: 4, reps: 10, weightKg: 30 },
    { name: 'Remada Curvada', sets: 4, reps: 10, weightKg: 40 },
  ]);

  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('4');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('25');

  const monthWeeks = useMemo(
    () => buildMonthWeeks(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  // Semana ativa para exibir a tira de 7 dias do calendário semanal
  const activeCalendarWeek = useMemo(() => {
    if (selectedWeekNumber !== 'ALL') {
      return (
        monthWeeks.find((w) => w.weekNumber === selectedWeekNumber) || monthWeeks[0]
      );
    }
    return monthWeeks.find((w) => w.isCurrentWeek) || monthWeeks[0];
  }, [monthWeeks, selectedWeekNumber]);

  // Atividades filtradas pelo Mês selecionado e pela pessoa (Casal / Eu / Parceiro)
  const monthWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      if (filterPerson !== 'ALL' && w.userId !== filterPerson) return false;
      const d = new Date(w.startedAt);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [workouts, selectedYear, selectedMonth, filterPerson]);

  // Membros do casal (Você primeiro, depois o parceiro)
  const coupleMembers = useMemo(() => {
    const list = weeklyStats.map((s) => ({ id: s.userId, name: s.userName }));
    return list.sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0));
  }, [weeklyStats, user?.id]);

  // Constância semanal individual: dias ativos na semana do calendário selecionada
  const individualConsistency = useMemo(() => {
    const week = activeCalendarWeek;
    if (!week) return [];
    return weeklyStats
      .filter((st) => filterPerson === 'ALL' || st.userId === filterPerson)
      .sort((a, b) => (a.userId === user?.id ? -1 : b.userId === user?.id ? 1 : 0))
      .map((st) => {
        const personWeek = workouts.filter((w) => {
          const d = new Date(w.startedAt);
          return w.userId === st.userId && d >= week.startDate && d <= week.endDate;
        });
        const completed = personWeek.filter((w) => w.status !== WorkoutStatus.PLANNED);
        const planned = personWeek.filter((w) => w.status === WorkoutStatus.PLANNED);
        const sameDay = (a: Date, b: Date) =>
          a.getFullYear() === b.getFullYear() &&
          a.getMonth() === b.getMonth() &&
          a.getDate() === b.getDate();
        const days = week.days.map((day) => {
          const doneHere = completed.filter((w) => sameDay(new Date(w.startedAt), day));
          const plannedHere = planned.filter((w) => sameDay(new Date(w.startedAt), day));
          return {
            day,
            done: doneHere.length > 0,
            planned: plannedHere.length > 0,
            hasRun: doneHere.some((w) => w.modality === WorkoutModality.RUNNING),
            hasStrength: doneHere.some((w) => w.modality === WorkoutModality.STRENGTH),
          };
        });
        const activeDays = days.filter((d) => d.done).length;
        const runningKm = Number(
          completed
            .filter((w) => w.modality === WorkoutModality.RUNNING)
            .reduce((acc, w) => acc + (Number(w.distanceKm) || 0), 0)
            .toFixed(1),
        );
        const plannedKm = Number(
          planned.reduce((acc, w) => acc + (Number(w.distanceKm) || 0), 0).toFixed(1),
        );
        const totalMinutes = completed.reduce(
          (acc, w) => acc + (Number(w.durationMinutes) || 0),
          0,
        );
        const goal = st.weeklyGoalTarget || 4;
        return {
          userId: st.userId,
          userName: st.userName,
          isMe: st.userId === user?.id,
          days,
          activeDays,
          goal,
          pct: Math.min(100, Math.round((activeDays / goal) * 100)),
          completedCount: completed.length,
          plannedCount: planned.length,
          runningCount: completed.filter((w) => w.modality === WorkoutModality.RUNNING).length,
          strengthCount: completed.filter((w) => w.modality === WorkoutModality.STRENGTH).length,
          runningKm,
          plannedKm,
          totalMinutes,
        };
      });
  }, [activeCalendarWeek, weeklyStats, workouts, filterPerson, user?.id]);

  // Atividades filtradas por Semana, Dia, Modalidade e Status (Concluído vs Planejado)
  const filteredWorkouts = useMemo(() => {
    return monthWorkouts.filter((w) => {
      const d = new Date(w.startedAt);
      const dateKey = d.toISOString().slice(0, 10);

      if (selectedDayKey && dateKey !== selectedDayKey) return false;

      if (selectedWeekNumber !== 'ALL') {
        const wkBucket = monthWeeks.find((b) => b.weekNumber === selectedWeekNumber);
        if (wkBucket && (d < wkBucket.startDate || d > wkBucket.endDate)) {
          return false;
        }
      }

      if (filterModality !== 'ALL' && w.modality !== filterModality) return false;
      if (filterStatus !== 'ALL' && w.status !== filterStatus) return false;

      return true;
    });
  }, [
    monthWorkouts,
    selectedDayKey,
    selectedWeekNumber,
    monthWeeks,
    filterModality,
    filterStatus,
  ]);

  // Agrupamento das atividades por Semana do Mês (Ordem Cronológica da Semana)
  const groupedByWeek = useMemo(() => {
    const groups: Array<{
      bucket: WeekBucket;
      plannedRuns: WorkoutActivityDto[];
      completedWorkouts: WorkoutActivityDto[];
      allItems: WorkoutActivityDto[];
    }> = [];

    for (const bucket of monthWeeks) {
      if (selectedWeekNumber !== 'ALL' && bucket.weekNumber !== selectedWeekNumber) {
        continue;
      }

      const itemsInWeek = filteredWorkouts.filter((w) => {
        const d = new Date(w.startedAt);
        return d >= bucket.startDate && d <= bucket.endDate;
      });

      if (itemsInWeek.length > 0 || selectedWeekNumber === bucket.weekNumber) {
        const plannedRuns = itemsInWeek
          .filter((w) => w.status === WorkoutStatus.PLANNED)
          .sort(
            (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
          );
        const completedWorkouts = itemsInWeek
          .filter((w) => w.status !== WorkoutStatus.PLANNED)
          .sort(
            (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          );

        groups.push({
          bucket,
          plannedRuns,
          completedWorkouts,
          allItems: itemsInWeek,
        });
      }
    }

    return groups;
  }, [monthWeeks, filteredWorkouts, selectedWeekNumber]);

  if (isLoading) return <LoadingState />;

  const stravaIntegration = integrations.find((i) => i.provider === FitnessProvider.STRAVA);

  const monthCompletedKm = Number(
    monthWorkouts
      .filter((w) => w.status === WorkoutStatus.COMPLETED && w.modality === WorkoutModality.RUNNING)
      .reduce((acc, w) => acc + (Number(w.distanceKm) || 0), 0)
      .toFixed(1),
  );
  const monthPlannedKm = Number(
    monthWorkouts
      .filter((w) => w.status === WorkoutStatus.PLANNED && w.modality === WorkoutModality.RUNNING)
      .reduce((acc, w) => acc + (Number(w.distanceKm) || 0), 0)
      .toFixed(1),
  );
  const monthPlannedCount = monthWorkouts.filter(
    (w) => w.status === WorkoutStatus.PLANNED,
  ).length;
  const monthCompletedCount = monthWorkouts.filter(
    (w) => w.status === WorkoutStatus.COMPLETED,
  ).length;

  const formatPace = (secPerKm?: number | null) => {
    if (!secPerKm || secPerKm <= 0) return null;
    const mins = Math.floor(secPerKm / 60);
    const secs = String(secPerKm % 60).padStart(2, '0');
    return `${mins}:${secs} /km`;
  };

  const formatWeekdayAndDate = (isoDate: string) => {
    const d = new Date(isoDate);
    const dayName = WEEKDAY_FULL_PT[d.getDay()];
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    return `${dayName}, ${dayNum}/${monthNum}`;
  };

  const formatNotesDisplay = (rawNotes?: string | null): string => {
    if (!rawNotes) return '';
    let formatted = rawNotes.trim();
    if (formatted.includes('\n')) return formatted;

    // Quebra etapas numeradas " 2. " -> "\n\n2. "
    formatted = formatted.replace(/\s+(\d+\.\s+)/g, '\n\n$1');
    // Quebra rodapé de detalhes " --- Detalhes do Treino--- "
    formatted = formatted.replace(/\s*(---|===)\s*Detalhes do Treino\s*(---|===)\s*/gi, '\n\n📋 Detalhes do Treino:\n');
    // Quebra campos em tópicos
    formatted = formatted.replace(/\s+Modalidade:/gi, '\n• Modalidade:');
    formatted = formatted.replace(/\s+Distancia:/gi, '\n• Distância Mínima:');
    formatted = formatted.replace(/\s+Distancia Maxima:/gi, '\n• Distância Máxima:');
    formatted = formatted.replace(/\s+(Tempo Minimo|Tempo Estimado):/gi, '\n• Tempo Estimado:');

    return formatted;
  };

  const showToast = (msg: string) => {
    setCheerToast(msg);
    setTimeout(() => setCheerToast(null), 4500);
  };

  const handlePrevMonth = () => {
    setSelectedDayKey(null);
    setSelectedWeekNumber('ALL');
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDayKey(null);
    setSelectedWeekNumber('ALL');
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const toggleWorkoutDetails = (id: string) => {
    setExpandedWorkoutIds((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isWorkoutExpanded = (wk: WorkoutActivityDto) => {
    if (expandedWorkoutIds[wk.id] !== undefined) {
      return expandedWorkoutIds[wk.id];
    }
    // Por padrão, corridas da semana com etapas do Garmin já vêm com os detalhes abertos!
    return Boolean(
      (wk.runningSteps && wk.runningSteps.length > 0) ||
      wk.status === WorkoutStatus.PLANNED,
    );
  };

  const handleOpenCreateModal = (initialModality: WorkoutModality = WorkoutModality.RUNNING) => {
    setModality(initialModality);
    setWorkoutStatusForm(WorkoutStatus.COMPLETED);
    setTitle(
      initialModality === WorkoutModality.RUNNING
        ? 'Corrida no Parque'
        : 'Treino de Musculação Superior',
    );
    setWorkoutType(
      initialModality === WorkoutModality.RUNNING
        ? 'Base Aeróbica (Z2)'
        : 'Hipertrofia & Força',
    );
    setTargetPace('5:15 - 5:30 /km');
    setStartedAtDate('');
    setDurationMinutes(initialModality === WorkoutModality.RUNNING ? '35' : '50');
    setDistanceKm('6.0');
    setCalories('390');
    setNotes('');
    setCreateModalVisible(true);
  };

  const handleAddExercise = () => {
    if (!exName.trim()) return;
    setExercises((prev) => [
      ...prev,
      {
        name: exName.trim(),
        sets: Number(exSets) || 3,
        reps: Number(exReps) || 10,
        weightKg: Number(exWeight) || 20,
      },
    ]);
    setExName('');
  };

  const handleRemoveExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateWorkout = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Informe o título do treino.');
      return;
    }

    let isoStart: string | undefined = undefined;
    if (startedAtDate) {
      const parts = startedAtDate.split('/');
      if (parts.length === 3) {
        isoStart = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00.000Z`).toISOString();
      }
    }

    const defaultRunningSteps: RunningWorkoutStepDto[] | undefined =
      modality === WorkoutModality.RUNNING
        ? [
          {
            phase: 'WARMUP',
            phaseLabel: 'Aquecimento',
            durationOrDistance: '1.0 km',
            targetPace: '5:50 /km',
            targetHeartRateZone: 'Zona 2',
          },
          {
            phase: 'MAIN',
            phaseLabel: workoutType || 'Bloco Principal',
            durationOrDistance: `${Number(distanceKm) || 5} km`,
            targetPace: targetPace || '5:15 /km',
            targetHeartRateZone: 'Zona 3',
          },
        ]
        : undefined;

    try {
      await createWorkout({
        modality,
        provider: FitnessProvider.MANUAL,
        status: workoutStatusForm,
        workoutType: workoutType.trim() || undefined,
        targetPace:
          modality === WorkoutModality.RUNNING ? targetPace.trim() || undefined : undefined,
        title: title.trim(),
        notes: notes.trim() || undefined,
        startedAt: isoStart,
        durationMinutes: Number(durationMinutes) || 30,
        calories: Number(calories) || undefined,
        distanceKm:
          modality === WorkoutModality.RUNNING ? Number(distanceKm) || 5 : undefined,
        exercisesJson:
          modality === WorkoutModality.STRENGTH ? exercises : undefined,
        runningSteps: defaultRunningSteps,
        scope: RecordScope.SHARED,
      });
      setCreateModalVisible(false);
      showToast(
        workoutStatusForm === WorkoutStatus.PLANNED
          ? '📅 Corrida planejada adicionada ao calendário da semana!'
          : '✅ Treino registrado e compartilhado com seu par!',
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o treino.');
    }
  };

  const handleSyncStrava = async () => {
    try {
      const res = await syncProvider(FitnessProvider.STRAVA);
      showToast(
        `✅ Strava sincronizado! ${res.syncedCount} atividade(s) importada(s).`,
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'Não foi possível sincronizar atividades do Strava.';
      Alert.alert('Sincronização Strava', msg);
    }
  };

  const handleSyncGarmin = async () => {
    try {
      const res = await syncProvider(FitnessProvider.GARMIN);
      showToast(
        `⌚ Garmin Connect sincronizado! ${res.syncedCount} corrida(s) carregadas.`,
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'Não foi possível sincronizar com o Garmin Connect.';
      Alert.alert('Sincronização Garmin', msg);
    }
  };

  const handleGarminLogin = () => {
    const loginUrl = 'https://connect.garmin.com/signin';
    if (Platform.OS === 'web') {
      window.open(loginUrl, '_blank');
    } else {
      Linking.openURL(loginUrl);
    }
    showToast('Redirecionando para login no Garmin Connect...');
  };

  const handleUnifiedSync = async () => {
    if (!garminIntegration?.isActive) {
      handleGarminLogin();
      return;
    }

    try {
      const res = await syncAll({
        calendarUrl: garminCalendarUrlInput.trim() || undefined,
      });
      setGarminCalendarModalVisible(false);
      showToast(`🚀 ${res.message || 'Treinos e Agenda sincronizados com sucesso!'}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível sincronizar os treinos.';
      Alert.alert('Sincronização', msg);
    }
  };

  const handleSyncGarminCalendar = async () => {
    if (!garminCalendarUrlInput.trim() && !garminIcsContentInput.trim()) {
      Alert.alert(
        'Atenção',
        'Informe o link iCal do Garmin Connect ou cole o conteúdo do calendário (.ics).',
      );
      return;
    }

    try {
      const res = await syncGarminCalendar({
        calendarUrl: garminCalendarUrlInput.trim() || undefined,
        icsContent: garminIcsContentInput.trim() || undefined,
      });
      setGarminCalendarModalVisible(false);
      showToast(`📅 ${res.message || 'Calendário do Garmin sincronizado com sucesso!'}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível sincronizar o calendário do Garmin.';
      Alert.alert('Calendário Garmin', msg);
    }
  };

  const handleSyncGarminCalendarViaApi = async () => {
    if (!garminPasswordInput.trim()) {
      Alert.alert(
        'Atenção',
        'Informe a senha da sua conta Garmin Connect para autenticar na API do Calendário.',
      );
      return;
    }

    try {
      const res = await syncGarminCalendarViaApi({
        email: garminEmailInput.trim() || undefined,
        password: garminPasswordInput.trim(),
        year: selectedYear,
        month: selectedMonth,
      });
      setGarminCalendarModalVisible(false);
      setGarminPasswordInput('');
      showToast(`🚀 ${res.message || 'Treinos do calendário Garmin sincronizados com sucesso via API!'}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível sincronizar o calendário via API do Garmin Connect.';
      Alert.alert('API Garmin Connect', msg);
    }
  };

  const handleCompletePlannedWorkout = async (wk: WorkoutActivityDto) => {
    try {
      await completeWorkout(wk.id);
      showToast(`✅ Parabéns! "${wk.title}" marcada como concluída na semana!`);
    } catch {
      Alert.alert('Erro', 'Não foi possível marcar o treino como concluído.');
    }
  };

  const handleDisconnectProvider = async (provider: FitnessProvider) => {
    try {
      await disconnectProvider(provider);
      showToast(
        `🔌 ${provider === FitnessProvider.GARMIN ? 'Garmin Connect' : 'Strava'} desconectado.`,
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível desconectar.');
    }
  };

  const handleCheer = async (workoutId: string, ownerName: string) => {
    try {
      await cheerWorkout({ id: workoutId });
      showToast(`👏 Incentivo enviado para ${ownerName.split(' ')[0]}!`);
    } catch {
      // ignora
    }
  };

  const activeBannerMsg = cheerToast || oauthStatusMessage;

  const getStepBadgeStyle = (phase: RunningWorkoutStepDto['phase']) => {
    switch (phase) {
      case 'WARMUP':
        return { icon: '🔥', bg: 'rgba(245, 158, 11, 0.15)', color: '#D97706', label: 'AQUECIMENTO' };
      case 'INTERVAL':
        return { icon: '⚡', bg: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', label: 'TIROS / FORTE' };
      case 'RECOVERY':
        return { icon: '💧', bg: 'rgba(6, 182, 212, 0.15)', color: '#0891B2', label: 'RECUPERAÇÃO' };
      case 'COOLDOWN':
        return { icon: '❄️', bg: 'rgba(139, 92, 246, 0.15)', color: '#7C3AED', label: 'DESAQUECIMENTO' };
      default:
        return { icon: '🏃', bg: 'rgba(16, 185, 129, 0.15)', color: '#059669', label: 'PRINCIPAL' };
    }
  };

  const renderWorkoutCard = (wk: WorkoutActivityDto, index: number) => {
    const isRunning = wk.modality === WorkoutModality.RUNNING;
    const isPlanned = wk.status === WorkoutStatus.PLANNED;
    const expanded = isWorkoutExpanded(wk);

    const providerBadge =
      wk.provider === FitnessProvider.GARMIN
        ? { label: '⌚ GARMIN', color: '#007CC3' }
        : wk.provider === FitnessProvider.STRAVA
          ? { label: '🟠 STRAVA', color: '#FC4C02' }
          : { label: '✍️ MANUAL', color: theme.primary };

    return (
      <View
        key={wk.id}
        testID={`workout-card-${wk.id}`}
        style={[
          styles.workoutCard,
          {
            backgroundColor: theme.surface,
            borderColor: isPlanned ? '#0EA5E9' : theme.border,
            borderLeftWidth: 4,
            borderLeftColor: isPlanned
              ? '#0EA5E9'
              : isRunning
                ? '#10B981'
                : '#8B5CF6',
          },
          theme.cardShadow,
        ]}
      >
        {/* TOPO: STATUS (CONCLUÍDO vs PLANEJADO) + PROVEDOR + TIPO */}
        <View style={styles.statusRowTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: isPlanned
                    ? 'rgba(14, 165, 233, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '800',
                  color: isPlanned ? '#0284C7' : '#059669',
                }}
              >
                {isPlanned ? '📅 PLANEJADO (A REALIZAR)' : '✅ CONCLUÍDO'}
              </Text>
            </View>

            {wk.workoutType ? (
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: theme.surfaceSubtle },
                ]}
              >
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textPrimary }}>
                  🎯 {wk.workoutType}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: providerBadge.color }}>
              {providerBadge.label}
            </Text>
          </View>
        </View>

        {/* TÍTULO E DATA/DIA DA SEMANA */}
        <View style={styles.workoutCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Text style={{ fontSize: 24 }}>{isRunning ? '🏃' : '🏋️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
                {wk.title}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 }}>
                📆 {formatWeekdayAndDate(wk.startedAt)} • 👤 {wk.user?.name || 'Parceiro'}
              </Text>
            </View>
          </View>
        </View>

        {/* PÍLULAS DE MÉTRICAS (DISTÂNCIA, PACE ALVO/REAL, FC, CADÊNCIA, VOLUME) */}
        <View style={styles.workoutMetricsRow}>
          <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary }}>
              ⏱️ {wk.durationMinutes} min
            </Text>
          </View>

          {isRunning && wk.distanceKm ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FC4C02' }}>
                📍 {wk.distanceKm} km
              </Text>
            </View>
          ) : null}

          {isRunning && wk.targetPace ? (
            <View
              style={[
                styles.workoutMetricPill,
                { backgroundColor: 'rgba(14, 165, 233, 0.12)' },
              ]}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0284C7' }}>
                🎯 Pace Alvo: {wk.targetPace}
              </Text>
            </View>
          ) : null}

          {isRunning && !isPlanned && wk.paceSecondsPerKm ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary }}>
                ⚡ Pace Real: {formatPace(wk.paceSecondsPerKm)}
              </Text>
            </View>
          ) : null}

          {wk.averageHeartRate ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EF4444' }}>
                ❤️ {wk.averageHeartRate} bpm méd
                {wk.maxHeartRate ? ` (${wk.maxHeartRate} máx)` : ''}
              </Text>
            </View>
          ) : wk.targetHrZone ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EF4444' }}>
                ❤️ Alvo: {wk.targetHrZone}
              </Text>
            </View>
          ) : null}

          {wk.cadenceSpm ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textSecondary }}>
                👟 {wk.cadenceSpm} spm
              </Text>
            </View>
          ) : null}

          {!isRunning && wk.setsCount ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8B5CF6' }}>
                🔢 {wk.setsCount} séries
              </Text>
            </View>
          ) : null}

          {!isRunning && wk.totalVolumeKg ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary }}>
                🏋️ Volume: {wk.totalVolumeKg} kg
              </Text>
            </View>
          ) : null}

          {wk.calories ? (
            <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textSecondary }}>
                🔥 {wk.calories} kcal
              </Text>
            </View>
          ) : null}
        </View>

        {/* BOTÃO DE EXPANSÃO DOS DETALHES DA CORRIDA (GARMIN / STRAVA) */}
        {((wk.runningSteps && wk.runningSteps.length > 0) ||
          (wk.splits && wk.splits.length > 0)) && (
            <TouchableOpacity
              testID={`toggle-workout-details-${wk.id}`}
              onPress={() => toggleWorkoutDetails(wk.id)}
              style={[
                styles.detailsToggleBtn,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                {expanded
                  ? '🔼 Ocultar Detalhes do Treino'
                  : '🔽 Ver Detalhes do Treino (Etapas, Ritmos & Parciais)'}
              </Text>
            </TouchableOpacity>
          )}

        {/* LISTA DE EXERCÍCIOS DE MUSCULAÇÃO */}
        {Array.isArray(wk.exercisesJson) && wk.exercisesJson.length > 0 && (
          <View
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              backgroundColor: theme.surfaceSubtle,
              gap: 4,
            }}
          >
            {wk.exercisesJson.map((ex, i) => (
              <View
                key={`${ex.name}-${i}`}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textPrimary }}>
                  • {ex.name}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>
                  {ex.sets}x{ex.reps} ({ex.weightKg}kg)
                </Text>
              </View>
            ))}
          </View>
        )}

        {wk.notes ? (
          <View
            testID={`workout-notes-box-${wk.id}`}
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(0, 124, 195, 0.08)' : '#F0F9FF',
              borderColor: isDark ? 'rgba(0, 124, 195, 0.28)' : '#BAE6FD',
              borderWidth: 1,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: '#0284C7',
                  letterSpacing: 0.5,
                }}
              >
                📝 Descrição do Treino (Notes)
              </Text>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: '700',
                  color: isDark ? '#7DD3FC' : '#0369A1',
                }}
              >
                {wk.provider === FitnessProvider.GARMIN ? '⌚ Garmin Connect • SisRUN' : 'Strava'}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 12.5,
                lineHeight: 19,
                color: theme.textPrimary,
                fontWeight: '500',
              }}
            >
              {formatNotesDisplay(wk.notes)}
            </Text>
          </View>
        ) : null}

        {/* RODAPÉ: MARCAR COMO CONCLUÍDA (SE PLANEJADA) + INCENTIVAR + EXCLUIR */}
        <View style={styles.workoutCardFooter}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {isPlanned && (
              <TouchableOpacity
                testID={`complete-workout-btn-${wk.id}`}
                onPress={() => handleCompletePlannedWorkout(wk)}
                disabled={isCompleting}
                style={[
                  styles.completeBtn,
                  { backgroundColor: '#10B981' },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                  ✅ Marcar como Concluída
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              testID={index === 0 ? 'cheer-workout-btn' : `cheer-workout-btn-${wk.id}`}
              onPress={() => handleCheer(wk.id, wk.user?.name || 'Parceiro')}
              disabled={isCheering}
              style={[
                styles.cheerBtn,
                { backgroundColor: theme.primaryLight, borderColor: theme.primary },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                👏 Incentivar Parceiro(a)
              </Text>
            </TouchableOpacity>
          </View>

          {wk.userId === user?.id && (
            <TouchableOpacity
              testID={`delete-workout-btn-${wk.id}`}
              onPress={() => deleteWorkout(wk.id)}
              style={{ padding: 6 }}
            >
              <Text style={{ fontSize: 13 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader title="Harry" subtitle="Calendário de Treinos" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Calendário de Treinos & Corridas 💪
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Garmin Connect (Corridas da Semana: Concluídas & Planejadas) • Strava OAuth2
            </Text>
          </View>
        </View>

        {activeBannerMsg && (
          <View
            testID="workout-toast-banner"
            style={[
              styles.toastBox,
              { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderColor: '#10B981' },
            ]}
          >
            <Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>
              {activeBannerMsg}
            </Text>
          </View>
        )}

        {oauthErrorMessage && (
          <View
            testID="workout-error-banner"
            style={[
              styles.toastBox,
              { backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: '#EF4444' },
            ]}
          >
            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13 }}>
              ⚠️ {oauthErrorMessage}
            </Text>
          </View>
        )}

        {/* INTEGRAÇÕES OFICIAIS: GARMIN CONNECT (PLANILHA DA SEMANA) & STRAVA OAUTH2 */}
        <View
          testID="fitness-integrations-section"
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            theme.cardShadow,
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            🔗 Conexões de Treino (Garmin Connect & Strava OAuth2)
          </Text>

          <View style={{ gap: 12 }}>
            {/* GARMIN CONNECT - PLANILHA DE CORRIDAS DA SEMANA (CONCLUÍDAS + PLANEJADAS) */}
            <View
              testID="integration-card-garmin"
              style={[
                styles.integrationCard,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: garminIntegration?.isActive ? '#007CC3' : theme.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.garminBrandBadge}>
                    <Text style={{ fontSize: 20 }}>⌚</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.textPrimary }}>
                      Garmin Connect (Corridas da Semana)
                    </Text>
                    <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                      Sincroniza corridas concluídas e treinos planejados da semana com etapas de ritmo/FC
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: garminIntegration?.isActive
                      ? 'rgba(0, 124, 195, 0.15)'
                      : theme.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: garminIntegration?.isActive ? '#007CC3' : theme.textMuted,
                    }}
                  >
                    {garminIntegration?.isActive ? '● CONECTADO' : '○ DESCONECTADO'}
                  </Text>
                </View>
              </View>

              {garminIntegration?.athleteId ? (
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginTop: 8 }}>
                  ⌚ Dispositivo / Conta: {garminIntegration.athleteId}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  testID="sync-activities-btn"
                  onPress={() => setGarminCalendarModalVisible(true)}
                  style={[
                    styles.garminPrimaryBtn,
                    { flex: 1, backgroundColor: '#007CC3' },
                  ]}
                >
                  <Text style={styles.stravaPrimaryBtnText}>
                    🔄 Sincronizar atividades
                  </Text>
                </TouchableOpacity>

                {garminIntegration?.isActive && (
                  <TouchableOpacity
                    testID="disconnect-garmin-btn"
                    onPress={() => handleDisconnectProvider(FitnessProvider.GARMIN)}
                    disabled={isDisconnecting}
                    style={{ paddingHorizontal: 10, paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.danger }}>
                      Desconectar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* STRAVA OAUTH2 - CORRIDA & MUSCULAÇÃO */}
            <View
              testID="integration-card-strava"
              style={[
                styles.integrationCard,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: stravaIntegration?.isActive ? '#FC4C02' : theme.border,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.stravaBrandBadge}>
                    <Text style={{ fontSize: 20 }}>🟠</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.textPrimary }}>
                      Strava (Corrida & Musculação)
                    </Text>
                    <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                      Autorização segura via OAuth2 • Importa todas as suas atividades realizadas
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: stravaIntegration?.isActive
                      ? 'rgba(252, 76, 2, 0.15)'
                      : theme.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: stravaIntegration?.isActive ? '#FC4C02' : theme.textMuted,
                    }}
                  >
                    {stravaIntegration?.isActive ? '● CONECTADO' : '○ DESCONECTADO'}
                  </Text>
                </View>
              </View>

              {stravaIntegration?.isActive ? (
                <View style={{ marginTop: 10 }}>
                  {stravaIntegration?.athleteId ? (
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textPrimary }}>
                      🏅 Atleta conectado: {stravaIntegration.athleteId}
                    </Text>
                  ) : null}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      testID="sync-strava-btn"
                      onPress={handleSyncStrava}
                      disabled={isSyncing || isAuthenticating}
                      style={[
                        styles.stravaPrimaryBtn,
                        { flex: 1, opacity: isSyncing ? 0.7 : 1 },
                      ]}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.stravaPrimaryBtnText}>
                          🔄 Sincronizar Atividades Strava
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="disconnect-strava-btn"
                      onPress={() => handleDisconnectProvider(FitnessProvider.STRAVA)}
                      disabled={isDisconnecting}
                      style={[
                        styles.disconnectBtn,
                        { borderColor: theme.border, backgroundColor: theme.surface },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.danger }}>
                        Desconectar
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <TouchableOpacity
                    testID="connect-strava-oauth-btn"
                    onPress={startStravaOAuth}
                    disabled={isAuthenticating}
                    style={[
                      styles.stravaPrimaryBtn,
                      { opacity: isAuthenticating ? 0.75 : 1 },
                    ]}
                  >
                    {isAuthenticating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.stravaPrimaryBtnText}>
                        🟠 Conectar com o Strava (OAuth2)
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* CALENDÁRIO DE TREINOS POR MÊS E SEMANA */}
        <View
          testID="workout-calendar-card"
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            theme.cardShadow,
          ]}
        >
          {/* SELETOR DE MÊS */}
          <View style={styles.monthSelectorRow}>
            <TouchableOpacity
              testID="workout-month-prev"
              onPress={handlePrevMonth}
              style={[styles.monthNavBtn, { backgroundColor: theme.surfaceSubtle }]}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
                ◀
              </Text>
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text
                testID="workout-month-label"
                style={{ fontSize: 17, fontWeight: '800', color: theme.textPrimary }}
              >
                📅 {MONTH_NAMES_PT[selectedMonth]} de {selectedYear}
              </Text>
              <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                ✅ {monthCompletedCount} concluído(s) ({monthCompletedKm} km) • 📅 {monthPlannedCount} planejado(s) ({monthPlannedKm} km)
              </Text>
            </View>

            <TouchableOpacity
              testID="workout-month-next"
              onPress={handleNextMonth}
              style={[styles.monthNavBtn, { backgroundColor: theme.surfaceSubtle }]}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
                ▶
              </Text>
            </TouchableOpacity>
          </View>

          {/* SELETOR DE SEMANAS DO MÊS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12, marginBottom: 12 }}
            contentContainerStyle={{ gap: 8 }}
          >
            <TouchableOpacity
              testID="week-tab-ALL"
              onPress={() => {
                setSelectedWeekNumber('ALL');
                setSelectedDayKey(null);
              }}
              style={[
                styles.weekChip,
                {
                  backgroundColor:
                    selectedWeekNumber === 'ALL' ? theme.primary : theme.surfaceSubtle,
                  borderColor:
                    selectedWeekNumber === 'ALL' ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: selectedWeekNumber === 'ALL' ? '#FFFFFF' : theme.textPrimary,
                }}
              >
                🗓️ Mês Inteiro ({monthWorkouts.length})
              </Text>
            </TouchableOpacity>

            {monthWeeks.map((wb) => {
              const isSelected = selectedWeekNumber === wb.weekNumber;
              const countInWeek = monthWorkouts.filter((w) => {
                const d = new Date(w.startedAt);
                return d >= wb.startDate && d <= wb.endDate;
              }).length;

              return (
                <TouchableOpacity
                  key={wb.weekNumber}
                  testID={`week-tab-${wb.weekNumber}`}
                  onPress={() => {
                    setSelectedWeekNumber(wb.weekNumber);
                    setSelectedDayKey(null);
                  }}
                  style={[
                    styles.weekChip,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : wb.isCurrentWeek
                          ? 'rgba(14, 165, 233, 0.12)'
                          : theme.surfaceSubtle,
                      borderColor: isSelected
                        ? theme.primary
                        : wb.isCurrentWeek
                          ? '#0EA5E9'
                          : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: isSelected
                        ? '#FFFFFF'
                        : wb.isCurrentWeek
                          ? '#0284C7'
                          : theme.textPrimary,
                    }}
                  >
                    {wb.label} {wb.isCurrentWeek ? '• Atual' : ''} ({countInWeek})
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: isSelected ? 'rgba(255,255,255,0.85)' : theme.textSecondary,
                    }}
                  >
                    {wb.rangeLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* GRADE DIÁRIA DA SEMANA ATIVA (CALENDÁRIO DE DOM A SÁB) */}
          {activeCalendarWeek && (
            <View
              testID="weekly-calendar-strip"
              style={[
                styles.weekDaysStrip,
                { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textPrimary }}>
                  📆 Visão Diária — {activeCalendarWeek.label} ({activeCalendarWeek.rangeLabel})
                </Text>
                {selectedDayKey && (
                  <TouchableOpacity onPress={() => setSelectedDayKey(null)}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.primary }}>
                      Ver semana toda
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                {activeCalendarWeek.days.map((dayDate) => {
                  const dKey = dayDate.toISOString().slice(0, 10);
                  const isDaySelected = selectedDayKey === dKey;
                  const dayWorkouts = monthWorkouts.filter(
                    (w) => new Date(w.startedAt).toISOString().slice(0, 10) === dKey,
                  );
                  const hasCompleted = dayWorkouts.some(
                    (w) => w.status === WorkoutStatus.COMPLETED,
                  );
                  const hasPlanned = dayWorkouts.some(
                    (w) => w.status === WorkoutStatus.PLANNED,
                  );

                  return (
                    <TouchableOpacity
                      key={dKey}
                      testID={`calendar-day-${dKey}`}
                      onPress={() =>
                        setSelectedDayKey(isDaySelected ? null : dKey)
                      }
                      style={[
                        styles.dayCell,
                        {
                          backgroundColor: isDaySelected
                            ? theme.primary
                            : hasPlanned
                              ? 'rgba(14, 165, 233, 0.12)'
                              : hasCompleted
                                ? 'rgba(16, 185, 129, 0.12)'
                                : theme.surface,
                          borderColor: isDaySelected
                            ? theme.primary
                            : hasPlanned
                              ? '#0EA5E9'
                              : hasCompleted
                                ? '#10B981'
                                : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: isDaySelected ? '#FFFFFF' : theme.textSecondary,
                        }}
                      >
                        {WEEKDAY_SHORT_PT[dayDate.getDay()]}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: '800',
                          color: isDaySelected ? '#FFFFFF' : theme.textPrimary,
                          marginVertical: 2,
                        }}
                      >
                        {String(dayDate.getDate()).padStart(2, '0')}
                      </Text>
                      <Text style={{ fontSize: 11 }}>
                        {hasCompleted && hasPlanned
                          ? '✅📅'
                          : hasCompleted
                            ? '✅'
                            : hasPlanned
                              ? '📅'
                              : '—'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* RESUMO SEMANAL DO CASAL */}
        <View
          testID="workout-weekly-consistency-card"
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            theme.cardShadow,
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            🔥 Constância Semanal Individual
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: -4, marginBottom: 10 }}>
            {activeCalendarWeek
              ? `${activeCalendarWeek.label} • ${activeCalendarWeek.rangeLabel}`
              : ''}
            {filterPerson === 'ALL'
              ? ' • Casal'
              : filterPerson === user?.id
                ? ' • Somente você'
                : ` • Somente ${coupleMembers.find((m) => m.id === filterPerson)?.name.split(' ')[0] || 'parceiro(a)'}`}
          </Text>

          {individualConsistency.length === 0 ? (
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>
              Nenhum dado de constância para esta seleção.
            </Text>
          ) : null}

          {individualConsistency.map((ic) => (
            <View
              key={ic.userId}
              testID={`individual-consistency-${ic.isMe ? 'ME' : 'PARTNER'}`}
              accessibilityLabel={`Constância de ${ic.userName}: ${ic.activeDays} de ${ic.goal} dias ativos`}
              style={[
                styles.partnerStatRow,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: ic.isMe ? '#7C3AED' : theme.border,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textPrimary }}>
                  👤 {ic.userName} {ic.isMe ? '(Você)' : ''}
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '800',
                    color: ic.activeDays >= ic.goal ? '#059669' : theme.primary,
                  }}
                >
                  {ic.activeDays}/{ic.goal} dias ativos{ic.activeDays >= ic.goal ? ' 🏆' : ''}
                </Text>
              </View>

              {/* Tira de 7 dias individual */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {ic.days.map((d) => (
                  <View
                    key={d.day.toISOString()}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: d.done ? '#10B981' : d.planned ? '#0EA5E9' : theme.border,
                      backgroundColor: d.done
                        ? 'rgba(16, 185, 129, 0.15)'
                        : d.planned
                          ? 'rgba(14, 165, 233, 0.12)'
                          : theme.surface,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textSecondary }}>
                      {WEEKDAY_SHORT_PT[d.day.getDay()]}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textPrimary }}>
                      {String(d.day.getDate()).padStart(2, '0')}
                    </Text>
                    <Text style={{ fontSize: 11 }}>
                      {d.done
                        ? `${d.hasRun ? '🏃' : ''}${d.hasStrength ? '🏋️' : ''}` || '✅'
                        : d.planned
                          ? '📅'
                          : '—'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.max(6, ic.pct)}%`,
                      backgroundColor: ic.isMe ? '#7C3AED' : theme.primary,
                    },
                  ]}
                />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                  ✅ {ic.completedCount} treino(s) • ⏱️ {ic.totalMinutes} min
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                  🏃 {ic.runningCount} corrida(s) ({ic.runningKm} km)
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                  🏋️ {ic.strengthCount} musculação
                </Text>
                {ic.plannedCount ? (
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0284C7' }}>
                    📅 {ic.plannedCount} a fazer ({ic.plannedKm} km)
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        {/* FILTRO POR PESSOA (CASAL / EU / PARCEIRO) — afeta calendário, constância e lista */}
        <View
          testID="workout-person-filter"
          accessibilityRole="radiogroup"
          accessibilityLabel="Filtrar treinos por pessoa"
          style={[styles.filterRow, { marginBottom: 12 }]}
        >
          {[
            { id: 'ALL', label: '👫 Casal (Ambos)' },
            ...coupleMembers.map((m) => ({
              id: m.id,
              label: m.id === user?.id ? `🙋 Só eu (${m.name.split(' ')[0]})` : `💑 Só ${m.name.split(' ')[0]}`,
            })),
          ].map((p) => {
            const active = filterPerson === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                testID={`person-filter-${p.id === 'ALL' ? 'ALL' : p.id === user?.id ? 'ME' : 'PARTNER'}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={p.label}
                onPress={() => {
                  setFilterPerson(p.id);
                  setSelectedDayKey(null);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? '#7C3AED' : theme.surface,
                    borderColor: active ? '#7C3AED' : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '800',
                    color: active ? '#FFFFFF' : theme.textSecondary,
                  }}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* FILTROS DE MODALIDADE E STATUS (JÁ FORAM vs AINDA NÃO FORAM) */}
        <View style={{ gap: 8, marginBottom: 14 }}>
          <View style={styles.filterRow}>
            {(
              [
                { id: 'ALL', label: 'Todos Status' },
                { id: WorkoutStatus.PLANNED, label: '📅 Ainda Não Foram (Planejadas)' },
                { id: WorkoutStatus.COMPLETED, label: '✅ Já Foram (Concluídas)' },
              ] as const
            ).map((st) => {
              const active = filterStatus === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  testID={`status-filter-${st.id}`}
                  onPress={() => setFilterStatus(st.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? '#0284C7' : theme.surface,
                      borderColor: active ? '#0284C7' : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: active ? '#FFFFFF' : theme.textSecondary,
                    }}
                  >
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filterRow}>
            {(
              [
                { id: 'ALL', label: 'Todas Modalidades' },
                { id: WorkoutModality.RUNNING, label: '🏃 Corridas (Garmin & Strava)' },
                { id: WorkoutModality.STRENGTH, label: '🏋️ Musculação' },
              ] as const
            ).map((f) => {
              const active = filterModality === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  testID={`workout-filter-${f.id}`}
                  onPress={() => setFilterModality(f.id)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surface,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? '#FFFFFF' : theme.textSecondary,
                    }}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* LISTAGEM AGRUPADA POR SEMANA DO MÊS */}
        {groupedByWeek.length === 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border, alignItems: 'center' },
            ]}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>
              Nenhuma atividade encontrada para este período/filtro.
            </Text>
          </View>
        ) : (
          groupedByWeek.map((group) => (
            <View
              key={`week-group-${group.bucket.weekNumber}`}
              testID={`week-section-${group.bucket.weekNumber}`}
              style={{ marginBottom: 18 }}
            >
              {/* CABEÇALHO DA SEMANA */}
              <View
                style={[
                  styles.weekSectionHeader,
                  {
                    backgroundColor: group.bucket.isCurrentWeek
                      ? 'rgba(14, 165, 233, 0.14)'
                      : theme.surfaceSubtle,
                    borderColor: group.bucket.isCurrentWeek ? '#0EA5E9' : theme.border,
                  },
                ]}
              >
                <View>
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.textPrimary }}>
                    🗓️ {group.bucket.label} de {MONTH_NAMES_PT[selectedMonth]} ({group.bucket.rangeLabel})
                    {group.bucket.isCurrentWeek ? ' • SEMANA ATUAL' : ''}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 2 }}>
                    ✅ {group.completedWorkouts.length} já realizado(s) • 📅 {group.plannedRuns.length} planejado(s) para correr
                  </Text>
                </View>
              </View>

              {/* SUB-SEÇÃO 1: CORRIDAS QUE AINDA NÃO FORAM (PLANEJADAS NA SEMANA PELO GARMIN) */}
              {group.plannedRuns.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: '#0284C7',
                      marginBottom: 8,
                    }}
                  >
                    📅 Corridas da Semana que Ainda Não Foram ({group.plannedRuns.length})
                  </Text>
                  {group.plannedRuns.map((wk, idx) => renderWorkoutCard(wk, idx))}
                </View>
              )}

              {/* SUB-SEÇÃO 2: CORRIDAS E TREINOS QUE JÁ FORAM (CONCLUÍDOS NA SEMANA) */}
              {group.completedWorkouts.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: '#059669',
                      marginBottom: 8,
                    }}
                  >
                    ✅ Atividades da Semana que Já Foram ({group.completedWorkouts.length})
                  </Text>
                  {group.completedWorkouts.map((wk, idx) =>
                    renderWorkoutCard(wk, group.plannedRuns.length + idx),
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB REGISTRAR TREINO MANUAL */}
      <TouchableOpacity
        testID="new-workout-fab"
        style={[styles.fabButton, { backgroundColor: theme.primary }, theme.fabShadow]}
        onPress={() => handleOpenCreateModal(WorkoutModality.RUNNING)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Registrar / Planejar</Text>
      </TouchableOpacity>

      {/* MODAL DE REGISTRO / PLANEJAMENTO DE TREINO */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay} testID="workout-modal">
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Registrar ou Planejar Treino
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Status no Calendário da Semana
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  testID="status-select-COMPLETED"
                  onPress={() => setWorkoutStatusForm(WorkoutStatus.COMPLETED)}
                  style={[
                    styles.modalityBtn,
                    {
                      backgroundColor:
                        workoutStatusForm === WorkoutStatus.COMPLETED
                          ? 'rgba(16, 185, 129, 0.15)'
                          : theme.surfaceSubtle,
                      borderColor:
                        workoutStatusForm === WorkoutStatus.COMPLETED
                          ? '#10B981'
                          : theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: '800', color: theme.textPrimary, fontSize: 12.5 }}>
                    ✅ Já Realizado
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="status-select-PLANNED"
                  onPress={() => setWorkoutStatusForm(WorkoutStatus.PLANNED)}
                  style={[
                    styles.modalityBtn,
                    {
                      backgroundColor:
                        workoutStatusForm === WorkoutStatus.PLANNED
                          ? 'rgba(14, 165, 233, 0.15)'
                          : theme.surfaceSubtle,
                      borderColor:
                        workoutStatusForm === WorkoutStatus.PLANNED
                          ? '#0EA5E9'
                          : theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: '800', color: theme.textPrimary, fontSize: 12.5 }}>
                    📅 Planejado na Semana
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Modalidade
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  testID="modality-select-RUNNING"
                  onPress={() => {
                    setModality(WorkoutModality.RUNNING);
                    setTitle('Corrida no Parque');
                  }}
                  style={[
                    styles.modalityBtn,
                    {
                      backgroundColor:
                        modality === WorkoutModality.RUNNING
                          ? theme.primaryLight
                          : theme.surfaceSubtle,
                      borderColor:
                        modality === WorkoutModality.RUNNING ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>🏃</Text>
                  <Text style={{ fontWeight: '800', color: theme.textPrimary }}>
                    Corrida
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="modality-select-STRENGTH"
                  onPress={() => {
                    setModality(WorkoutModality.STRENGTH);
                    setTitle('Treino de Musculação');
                  }}
                  style={[
                    styles.modalityBtn,
                    {
                      backgroundColor:
                        modality === WorkoutModality.STRENGTH
                          ? theme.primaryLight
                          : theme.surfaceSubtle,
                      borderColor:
                        modality === WorkoutModality.STRENGTH ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>🏋️</Text>
                  <Text style={{ fontWeight: '800', color: theme.textPrimary }}>
                    Musculação
                  </Text>
                </TouchableOpacity>
              </View>

              <Input
                testID="workout-title-input"
                label="Título do Treino"
                placeholder="Ex: Tiros 5x800m / Longão 12km"
                value={title}
                onChangeText={setTitle}
              />

              <CalendarDatePicker
                testID="workout-date-picker"
                label="Data no Calendário"
                placeholder="Hoje (Toque para escolher no calendário)"
                value={startedAtDate}
                onChange={setStartedAtDate}
                outputFormat="BR"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    testID="workout-duration-input"
                    label="Duração (min)"
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    testID="workout-calories-input"
                    label="Calorias (kcal)"
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {modality === WorkoutModality.RUNNING ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        testID="workout-distance-input"
                        label="Distância (km)"
                        placeholder="6.0"
                        value={distanceKm}
                        onChangeText={setDistanceKm}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        testID="workout-target-pace-input"
                        label="Pace Alvo (/km)"
                        placeholder="5:15 /km"
                        value={targetPace}
                        onChangeText={setTargetPace}
                      />
                    </View>
                  </View>
                  <Input
                    testID="workout-type-input"
                    label="Tipo de Treino de Corrida"
                    placeholder="Ex: Intervalado / Tiros, Base Z2, Longão"
                    value={workoutType}
                    onChangeText={setWorkoutType}
                  />
                </>
              ) : (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Exercícios ({exercises.length})
                  </Text>
                  {exercises.map((ex, idx) => (
                    <View
                      key={`${ex.name}-${idx}`}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 8,
                        borderRadius: 10,
                        backgroundColor: theme.surfaceSubtle,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                        {ex.name} — {ex.sets}x{ex.reps} ({ex.weightKg}kg)
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveExercise(idx)}>
                        <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 12 }}>
                          Remover
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
                    <View style={{ flex: 2 }}>
                      <Input
                        placeholder="Exercício (ex: Agachamento)"
                        value={exName}
                        onChangeText={setExName}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        placeholder="Kg"
                        value={exWeight}
                        onChangeText={setExWeight}
                        keyboardType="numeric"
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleAddExercise}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: theme.primary,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Input
                testID="workout-notes-input"
                label="Observações / Detalhes do Treino"
                placeholder="Ex: Aquecimento 10min + Tiros + Desaquecimento"
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                testID="save-workout-btn"
                title="Salvar no Calendário da Semana"
                onPress={handleCreateWorkout}
                isLoading={isCreating}
                style={{ marginTop: 10, marginBottom: 36 }}
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL DE SINCRONIZAR ATIVIDADES & CALENDÁRIO GARMIN */}
      <Modal visible={garminCalendarModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay} testID="garmin-calendar-modal">
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                🔄 Sincronizar Atividades & Calendário
              </Text>
              <TouchableOpacity
                testID="close-garmin-calendar-modal"
                onPress={() => setGarminCalendarModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 18, color: theme.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              {/* STATUS DA CONEXÃO GARMIN */}
              <View
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: garminIntegration?.isActive
                    ? (isDark ? 'rgba(0, 124, 195, 0.12)' : '#EFF6FF')
                    : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2'),
                  borderColor: garminIntegration?.isActive ? '#007CC3' : '#EF4444',
                  borderWidth: 1,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: garminIntegration?.isActive ? '#007CC3' : '#EF4444',
                    }}
                  >
                    {garminIntegration?.isActive ? '⌚ Garmin Connect Conectado' : '⚠️ Garmin Connect Desconectado'}
                  </Text>
                  {garminIntegration?.isActive ? (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>● Ativo</Text>
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: theme.textPrimary, lineHeight: 18 }}>
                  {garminIntegration?.isActive
                    ? `Conta vinculada: ${garminIntegration.athleteId || 'Muriel Delvaux Daher'}. As atividades concluídas e os treinos planejados da semana serão sincronizados diretamente com a sua Agenda no Harry.`
                    : 'Caso você ainda não tenha feito login na sua conta Garmin Connect, clique no botão abaixo para autorizar com segurança e retornar ao Harry.'}
                </Text>

                <TouchableOpacity
                  testID="garmin-login-btn"
                  onPress={handleGarminLogin}
                  style={{
                    marginTop: 10,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 8,
                    backgroundColor: garminIntegration?.isActive ? 'rgba(0, 124, 195, 0.15)' : '#007CC3',
                    borderWidth: 1,
                    borderColor: '#007CC3',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: garminIntegration?.isActive ? '#007CC3' : '#FFFFFF',
                    }}
                  >
                    {garminIntegration?.isActive ? '🔑 Alterar Conta / Login Garmin Connect' : '🔑 Fazer Login no Garmin Connect'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* BOTÃO PRINCIPAL: SINCRONIZAR AGORA */}
              <Button
                testID="modal-sync-action-btn"
                title="🚀 Sincronizar Agora"
                onPress={handleUnifiedSync}
                isLoading={isSyncingAll}
                style={{ marginBottom: 18 }}
              />

              {/* CAMPO DE LINK DO CALENDÁRIO (OPCIONAL) */}
              <View
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: theme.border,
                  borderWidth: 1,
                  marginBottom: 30,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 }}>
                  📅 Link do Calendário (Opcional)
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textSecondary, marginBottom: 12, lineHeight: 17 }}>
                  Opcional. Se seus treinos vêm de uma assessoria esportiva (ex.: SisRUN, TrainingPeaks, Treinus) sincronizada com o seu Garmin Connect, cole aqui o link de exportação do calendário (iCal ou Webcal).
                </Text>

                <Input
                  testID="modal-calendar-url-input"
                  label="Link do Calendário Garmin / SisRUN (iCal ou Webcal)"
                  placeholder="https://connect.garmin.com/modern/calendar/export/... ou webcal://..."
                  value={garminCalendarUrlInput}
                  onChangeText={setGarminCalendarUrlInput}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  garminCalendarActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 90,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  toastBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  monthSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDaysStrip: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  dayCell: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekSectionHeader: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  coupleTotalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10.5,
    marginTop: 2,
    textAlign: 'center',
  },
  partnerStatRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  progressBarBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  integrationCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  garminBrandBadge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 124, 195, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaBrandBadge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(252, 76, 2, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garminPrimaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: '#007CC3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaPrimaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: '#FC4C02',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  disconnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  workoutCard: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  workoutMetricPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailsToggleBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepsContainer: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  stepRow: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  splitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 82,
    alignItems: 'center',
  },
  workoutCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  completeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  cheerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
