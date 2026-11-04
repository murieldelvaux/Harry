import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { CalendarDatePicker } from '../../src/components/CalendarDatePicker';
import { LoadingState } from '../../src/components/LoadingState';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/hooks/useAuth';
import { useWorkouts } from '../../src/hooks/useWorkouts';
import { formatDate } from '../../src/utils/format';
import {
  WorkoutModality,
  FitnessProvider,
  RecordScope,
  StrengthExerciseDto,
} from '../../../packages/shared/src';

const MFIT_PRESET_SHEETS: Array<{
  id: 'A' | 'B' | 'C';
  title: string;
  durationMinutes: number;
  calories: number;
  notes: string;
  exercises: StrengthExerciseDto[];
}> = [
  {
    id: 'A',
    title: 'Treino A — Superiores & Core (MFIT Personal)',
    durationMinutes: 55,
    calories: 380,
    notes: 'Ficha A do MFIT Personal • Peito, Costas, Ombros e Abdômen',
    exercises: [
      { name: 'Supino Inclinado com Halteres', sets: 4, reps: 10, weightKg: 26 },
      { name: 'Remada Curvada Pronada', sets: 4, reps: 10, weightKg: 50 },
      { name: 'Desenvolvimento com Halteres', sets: 4, reps: 12, weightKg: 18 },
      { name: 'Tríceps Pulley Corda', sets: 3, reps: 12, weightKg: 22 },
    ],
  },
  {
    id: 'B',
    title: 'Treino B — Inferiores Completo (MFIT Personal)',
    durationMinutes: 60,
    calories: 460,
    notes: 'Ficha B do MFIT Personal • Quadríceps, Posterior e Panturrilha',
    exercises: [
      { name: 'Agachamento Livre', sets: 4, reps: 10, weightKg: 80 },
      { name: 'Leg Press 45°', sets: 4, reps: 12, weightKg: 180 },
      { name: 'Stiff com Barra', sets: 4, reps: 10, weightKg: 60 },
      { name: 'Panturrilha Sentado', sets: 4, reps: 15, weightKg: 45 },
    ],
  },
  {
    id: 'C',
    title: 'Treino C — Costas, Bíceps & Posterior de Ombro (MFIT Personal)',
    durationMinutes: 50,
    calories: 350,
    notes: 'Ficha C do MFIT Personal • Dorsais, Bíceps e Core',
    exercises: [
      { name: 'Puxada Frontal Aberta', sets: 4, reps: 12, weightKg: 55 },
      { name: 'Remada Baixa Triângulo', sets: 4, reps: 10, weightKg: 50 },
      { name: 'Crucifixo Inverso Máquina', sets: 3, reps: 15, weightKg: 35 },
      { name: 'Rosca Direta Barra W', sets: 4, reps: 10, weightKg: 28 },
    ],
  },
];

export default function WorkoutsScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ strava?: string }>();
  const {
    dashboard,
    workouts,
    integrations,
    weeklyStats,
    isLoading,
    createWorkout,
    isCreating,
    connectProvider,
    isConnecting,
    disconnectProvider,
    isDisconnecting,
    getStravaAuthUrl,
    syncProvider,
    isSyncing,
    cheerWorkout,
    isCheering,
    deleteWorkout,
  } = useWorkouts();

  const [filterModality, setFilterModality] = useState<'ALL' | WorkoutModality>('ALL');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [cheerToast, setCheerToast] = useState<string | null>(null);

  // Modal de configuração Strava (OAuth2 + API v3)
  const [stravaModalVisible, setStravaModalVisible] = useState(false);
  const [stravaClientId, setStravaClientId] = useState('');
  const [stravaClientSecret, setStravaClientSecret] = useState('');
  const [stravaAuthCode, setStravaAuthCode] = useState('');
  const [stravaAccessToken, setStravaAccessToken] = useState('');
  const [stravaRefreshToken, setStravaRefreshToken] = useState('');

  // Modal de configuração MFIT Personal (Conta de Aluno + Fichas A/B/C)
  const [mfitModalVisible, setMfitModalVisible] = useState(false);
  const [mfitEmail, setMfitEmail] = useState(user?.email || '');
  const [mfitPassword, setMfitPassword] = useState('');
  const [mfitSheetUrl, setMfitSheetUrl] = useState('');
  const [selectedMfitSheetId, setSelectedMfitSheetId] = useState<'A' | 'B' | 'C'>('A');

  // Form states (Manual workout modal)
  const [modality, setModality] = useState<WorkoutModality>(WorkoutModality.RUNNING);
  const [title, setTitle] = useState('');
  const [startedAtDate, setStartedAtDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [distanceKm, setDistanceKm] = useState('5.0');
  const [calories, setCalories] = useState('350');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<StrengthExerciseDto[]>([
    { name: 'Supino Reto', sets: 4, reps: 10, weightKg: 30 },
    { name: 'Remada Curvada', sets: 4, reps: 10, weightKg: 40 },
  ]);

  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('4');
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('25');

  useEffect(() => {
    if (params?.strava === 'connected') {
      setCheerToast('✅ Conta do Strava conectada via OAuth2 e corridas sincronizadas!');
      setTimeout(() => setCheerToast(null), 4500);
    } else if (params?.strava === 'error') {
      setCheerToast('⚠️ Não foi possível concluir o OAuth do Strava. Verifique seu Client ID / Token.');
      setTimeout(() => setCheerToast(null), 4500);
    }
  }, [params?.strava]);

  if (isLoading) return <LoadingState />;

  const stravaIntegration = integrations.find((i) => i.provider === FitnessProvider.STRAVA);
  const mfitIntegration = integrations.find((i) => i.provider === FitnessProvider.MFIT);

  const filteredWorkouts = workouts.filter((w) =>
    filterModality === 'ALL' ? true : w.modality === filterModality,
  );

  const formatPace = (secPerKm?: number | null) => {
    if (!secPerKm || secPerKm <= 0) return null;
    const mins = Math.floor(secPerKm / 60);
    const secs = String(secPerKm % 60).padStart(2, '0');
    return `${mins}:${secs} /km`;
  };

  const showToast = (msg: string) => {
    setCheerToast(msg);
    setTimeout(() => setCheerToast(null), 4000);
  };

  const handleOpenCreateModal = (initialModality: WorkoutModality = WorkoutModality.RUNNING) => {
    setModality(initialModality);
    setTitle(
      initialModality === WorkoutModality.RUNNING
        ? 'Corrida no Parque'
        : 'Treino de Musculação Superior',
    );
    setStartedAtDate('');
    setDurationMinutes(initialModality === WorkoutModality.RUNNING ? '35' : '50');
    setDistanceKm('5.0');
    setCalories('360');
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

    try {
      await createWorkout({
        modality,
        provider: FitnessProvider.MANUAL,
        title: title.trim(),
        notes: notes.trim() || undefined,
        startedAt: isoStart,
        durationMinutes: Number(durationMinutes) || 30,
        calories: Number(calories) || undefined,
        distanceKm:
          modality === WorkoutModality.RUNNING ? Number(distanceKm) || 5 : undefined,
        exercisesJson:
          modality === WorkoutModality.STRENGTH ? exercises : undefined,
        scope: RecordScope.SHARED,
      });
      setCreateModalVisible(false);
      showToast('✅ Treino registrado e compartilhado com seu par!');
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o treino.');
    }
  };

  const handleSync = async (provider: FitnessProvider) => {
    try {
      const res = await syncProvider(provider);
      showToast(
        `✅ ${
          provider === FitnessProvider.STRAVA ? 'Strava (Corrida)' : 'MFIT Personal (Musculação)'
        } sincronizado (${res.syncedCount} atividades)!`,
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || `Não foi possível sincronizar com ${provider}.`;
      Alert.alert('Erro na Sincronização', msg);
    }
  };

  // --- AÇÕES STRAVA (OAUTH2 + API V3) ---
  const handleStartStravaOAuth = async () => {
    try {
      const data = await getStravaAuthUrl(stravaClientId.trim() || undefined);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(data.authUrl, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(data.authUrl);
      }
      showToast('🔗 Janela de autorização OAuth2 do Strava aberta!');
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar a URL de autorização do Strava.');
    }
  };

  const handleConnectStravaCredentials = async () => {
    if (!stravaAccessToken.trim() && !stravaAuthCode.trim()) {
      Alert.alert(
        'Credenciais do Strava',
        'Informe seu Access Token da API do Strava (em strava.com/settings/api) ou o código OAuth2.',
      );
      return;
    }

    try {
      await connectProvider({
        provider: FitnessProvider.STRAVA,
        clientId: stravaClientId.trim() || undefined,
        clientSecret: stravaClientSecret.trim() || undefined,
        authCode: stravaAuthCode.trim() || undefined,
        accessToken: stravaAccessToken.trim() || undefined,
        refreshToken: stravaRefreshToken.trim() || undefined,
      });
      const syncRes = await syncProvider(FitnessProvider.STRAVA);
      setStravaModalVisible(false);
      showToast(
        `✅ Strava conectado e ${syncRes.syncedCount} corrida(s) importada(s) da API v3!`,
      );
    } catch (err: any) {
      Alert.alert(
        'Erro ao Conectar Strava',
        err?.response?.data?.message ||
          'Verifique se o Access Token ou Código OAuth2 do Strava está válido.',
      );
    }
  };

  const handleConnectStravaSandbox = async () => {
    try {
      await connectProvider({
        provider: FitnessProvider.STRAVA,
        accessToken: `dev_token_strava_${user?.id || 'demo'}`,
        athleteId: `${user?.name || 'Atleta'} (Strava GPS)`,
      });
      const res = await syncProvider(FitnessProvider.STRAVA);
      setStravaModalVisible(false);
      showToast(`✅ Strava conectado (${res.syncedCount} corridas sincronizadas)!`);
    } catch {
      Alert.alert('Erro', 'Falha ao conectar Strava.');
    }
  };

  // --- AÇÕES MFIT PERSONAL (ALUNO + FICHAS A/B/C) ---
  const handleConnectMfitAccount = async () => {
    if (!mfitEmail.trim() && !mfitSheetUrl.trim()) {
      Alert.alert(
        'Atenção',
        'Informe seu e-mail de aluno MFIT Personal ou o link da sua ficha de treino.',
      );
      return;
    }

    try {
      await connectProvider({
        provider: FitnessProvider.MFIT,
        mfitEmail: mfitEmail.trim() || undefined,
        mfitPassword: mfitPassword || undefined,
        mfitSheetUrl: mfitSheetUrl.trim() || undefined,
        athleteId: mfitEmail.trim()
          ? `${user?.name?.split(' ')[0] || 'Aluno'} (${mfitEmail.trim()})`
          : 'Ficha MFIT Vinculada',
      });
      const res = await syncProvider(FitnessProvider.MFIT);
      setMfitModalVisible(false);
      showToast(`✅ Conta MFIT Personal vinculada (${res.syncedCount} fichas sincronizadas)!`);
    } catch (err: any) {
      Alert.alert(
        'Erro ao Conectar MFIT',
        err?.response?.data?.message || 'Não foi possível vincular sua conta MFIT Personal.',
      );
    }
  };

  const handleLogMfitSheetToday = async () => {
    const sheet =
      MFIT_PRESET_SHEETS.find((s) => s.id === selectedMfitSheetId) || MFIT_PRESET_SHEETS[0];

    try {
      await connectProvider({
        provider: FitnessProvider.MFIT,
        mfitEmail: mfitEmail.trim() || user?.email || undefined,
        athleteId: mfitEmail.trim() || user?.email || 'Aluno MFIT',
      });
      await createWorkout({
        modality: WorkoutModality.STRENGTH,
        provider: FitnessProvider.MFIT,
        title: sheet.title,
        notes: sheet.notes,
        durationMinutes: sheet.durationMinutes,
        calories: sheet.calories,
        exercisesJson: sheet.exercises,
        scope: RecordScope.SHARED,
      });
      setMfitModalVisible(false);
      showToast(`🏋️ ${sheet.title} registrado no feed do casal!`);
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar a ficha do MFIT.');
    }
  };

  const handleDisconnectProvider = async (provider: FitnessProvider) => {
    try {
      await disconnectProvider(provider);
      if (provider === FitnessProvider.STRAVA) setStravaModalVisible(false);
      if (provider === FitnessProvider.MFIT) setMfitModalVisible(false);
      showToast(
        `🔌 ${provider === FitnessProvider.STRAVA ? 'Strava' : 'MFIT Personal'} desconectado.`,
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível desconectar a integração.');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader title="Harry" subtitle="Treinos do Casal" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Treinos & Constância 💪
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Corrida (Strava API v3) • Musculação (MFIT Personal) • Incentivo mútuo
            </Text>
          </View>
        </View>

        {cheerToast && (
          <View
            testID="workout-toast-banner"
            style={[
              styles.toastBox,
              { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderColor: '#10B981' },
            ]}
          >
            <Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>
              {cheerToast}
            </Text>
          </View>
        )}

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
            🔥 Constância Semanal do Casal (Últimos 7 dias)
          </Text>

          <View style={styles.coupleTotalsRow}>
            <View style={[styles.metricBox, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.metricValue, { color: theme.primary }]}>
                {dashboard?.coupleTotalWorkoutsWeek || 0}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Treinos na Semana
              </Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.metricValue, { color: '#F97316' }]}>
                {dashboard?.coupleTotalRunningKmWeek || 0} km
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Corrida (Strava)
              </Text>
            </View>
            <View style={[styles.metricBox, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.metricValue, { color: '#8B5CF6' }]}>
                {dashboard?.coupleTotalStrengthVolumeWeek || 0} kg
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Volume (MFIT)
              </Text>
            </View>
          </View>

          {weeklyStats.map((st) => {
            const pct = Math.min(100, Math.round((st.workoutCount / (st.weeklyGoalTarget || 4)) * 100));
            return (
              <View
                key={st.userId}
                style={[
                  styles.partnerStatRow,
                  { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: theme.textPrimary }}>
                    👤 {st.userName} {st.userId === user?.id ? '(Você)' : ''}
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.primary }}>
                    {st.workoutCount}/{st.weeklyGoalTarget} treinos ({st.activeDaysCount} dias ativos)
                  </Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.max(6, pct)}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                  <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                    🏃 {st.runningWorkouts} corrida(s) ({st.totalRunningKm} km)
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                    🏋️ {st.strengthWorkouts} musculação ({st.totalStrengthSets} séries)
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* INTEGRAÇÕES COM APPS DE TREINO: STRAVA (CORRIDA) & MFIT (MUSCULAÇÃO) */}
        <View
          testID="fitness-integrations-section"
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            theme.cardShadow,
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
            🔗 Integrações de Treino (Corrida & Musculação)
          </Text>

          <View style={styles.integrationsGrid}>
            {/* STRAVA - CORRIDA */}
            <View
              testID="integration-card-strava"
              style={[
                styles.integrationCard,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: stravaIntegration?.isActive ? '#F97316' : theme.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 22 }}>🏃</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textPrimary }}>
                      Strava (Corrida)
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      OAuth2 Oficial • API v3 (/athlete/activities) & Webhook
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: stravaIntegration?.isActive
                      ? 'rgba(249, 115, 22, 0.15)'
                      : theme.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: stravaIntegration?.isActive ? '#F97316' : theme.textMuted,
                    }}
                  >
                    {stravaIntegration?.isActive ? '● CONECTADO' : '○ DESCONECTADO'}
                  </Text>
                </View>
              </View>

              {stravaIntegration?.athleteId ? (
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary, marginTop: 6 }}>
                  🏅 Conta vinculada: {stravaIntegration.athleteId}
                </Text>
              ) : null}

              {stravaIntegration?.lastSyncedAt && (
                <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                  Última sincronização: {formatDate(stravaIntegration.lastSyncedAt)}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  testID="open-strava-config-btn"
                  onPress={() => setStravaModalVisible(true)}
                  style={[
                    styles.configBtn,
                    { borderColor: '#F97316', backgroundColor: theme.surface },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#F97316' }}>
                    ⚙️ {stravaIntegration?.isActive ? 'Configurar / OAuth' : 'Conectar Conta'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="sync-strava-btn"
                  onPress={() => handleSync(FitnessProvider.STRAVA)}
                  disabled={isSyncing}
                  style={[
                    styles.syncBtn,
                    { flex: 1, marginTop: 0, backgroundColor: '#F97316' },
                  ]}
                >
                  <Text style={styles.syncBtnText}>
                    {stravaIntegration?.isActive
                      ? '🔄 Sincronizar Strava'
                      : '⚡ Sincronizar Agora'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* MFIT - MUSCULAÇÃO */}
            <View
              testID="integration-card-mfit"
              style={[
                styles.integrationCard,
                {
                  backgroundColor: theme.surfaceSubtle,
                  borderColor: mfitIntegration?.isActive ? '#8B5CF6' : theme.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 22 }}>🏋️</Text>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: theme.textPrimary }}>
                      MFIT Personal (Musculação)
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                      Portal do Aluno • Fichas A/B/C, Séries, Cargas & Volume
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: mfitIntegration?.isActive
                      ? 'rgba(139, 92, 246, 0.15)'
                      : theme.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: '800',
                      color: mfitIntegration?.isActive ? '#8B5CF6' : theme.textMuted,
                    }}
                  >
                    {mfitIntegration?.isActive ? '● CONECTADO' : '○ DESCONECTADO'}
                  </Text>
                </View>
              </View>

              {mfitIntegration?.athleteId ? (
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary, marginTop: 6 }}>
                  📋 Aluno(a) vinculado: {mfitIntegration.athleteId}
                </Text>
              ) : null}

              {mfitIntegration?.lastSyncedAt && (
                <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                  Última sincronização: {formatDate(mfitIntegration.lastSyncedAt)}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  testID="open-mfit-config-btn"
                  onPress={() => setMfitModalVisible(true)}
                  style={[
                    styles.configBtn,
                    { borderColor: '#8B5CF6', backgroundColor: theme.surface },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#8B5CF6' }}>
                    📋 {mfitIntegration?.isActive ? 'Fichas & Conta MFIT' : 'Vincular Aluno MFIT'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="sync-mfit-btn"
                  onPress={() => handleSync(FitnessProvider.MFIT)}
                  disabled={isSyncing}
                  style={[
                    styles.syncBtn,
                    { flex: 1, marginTop: 0, backgroundColor: '#8B5CF6' },
                  ]}
                >
                  <Text style={styles.syncBtnText}>
                    {mfitIntegration?.isActive
                      ? '🔄 Sincronizar MFIT'
                      : '⚡ Sincronizar Fichas'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* FILTRO DE MODALIDADE */}
        <View style={styles.filterRow}>
          {(
            [
              { id: 'ALL', label: 'Todos os Treinos' },
              { id: WorkoutModality.RUNNING, label: '🏃 Corrida' },
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
                    fontSize: 12.5,
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

        {/* FEED DE TREINOS DO CASAL */}
        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginBottom: 10 }]}>
          🏅 Feed de Atividades do Casal ({filteredWorkouts.length})
        </Text>

        {filteredWorkouts.map((wk, index) => {
          const isRunning = wk.modality === WorkoutModality.RUNNING;
          const providerBadge =
            wk.provider === FitnessProvider.STRAVA
              ? { label: 'STRAVA', color: '#F97316' }
              : wk.provider === FitnessProvider.MFIT
              ? { label: 'MFIT', color: '#8B5CF6' }
              : { label: 'MANUAL', color: theme.primary };

          return (
            <View
              key={wk.id}
              testID={`workout-card-${wk.id}`}
              style={[
                styles.workoutCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
                theme.cardShadow,
              ]}
            >
              <View style={styles.workoutCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontSize: 22 }}>{isRunning ? '🏃' : '🏋️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.textPrimary }}>
                      {wk.title}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>
                      👤 {wk.user?.name || 'Parceiro'} • {formatDate(wk.startedAt)}
                    </Text>
                  </View>
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

              {/* MÉTRICAS DO TREINO */}
              <View style={styles.workoutMetricsRow}>
                <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary }}>
                    ⏱️ {wk.durationMinutes} min
                  </Text>
                </View>

                {isRunning && wk.distanceKm ? (
                  <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#F97316' }}>
                      📍 {wk.distanceKm} km
                    </Text>
                  </View>
                ) : null}

                {isRunning && wk.paceSecondsPerKm ? (
                  <View style={[styles.workoutMetricPill, { backgroundColor: theme.surfaceSubtle }]}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textPrimary }}>
                      ⚡ Pace {formatPace(wk.paceSecondsPerKm)}
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

              {/* LISTA DE EXERCÍCIOS DE MUSCULAÇÃO (MFIT / MANUAL) */}
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
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>
                  💬 {wk.notes}
                </Text>
              ) : null}

              <View style={styles.workoutCardFooter}>
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
        })}
      </ScrollView>

      {/* FAB REGISTRAR TREINO */}
      <TouchableOpacity
        testID="new-workout-fab"
        style={[styles.fabButton, { backgroundColor: theme.primary }, theme.fabShadow]}
        onPress={() => handleOpenCreateModal(WorkoutModality.RUNNING)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>＋</Text>
        <Text style={styles.fabText}>Registrar Treino</Text>
      </TouchableOpacity>

      {/* MODAL DE CONFIGURAÇÃO STRAVA (OAUTH2 + API V3) */}
      <Modal visible={stravaModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay} testID="strava-config-modal">
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                🏃 Conectar Strava (OAuth2 & API v3)
              </Text>
              <TouchableOpacity
                testID="close-strava-modal-btn"
                onPress={() => setStravaModalVisible(false)}
              >
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(249, 115, 22, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(249, 115, 22, 0.35)',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#F97316', marginBottom: 4 }}>
                  Integração Oficial Strava API v3
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textSecondary, lineHeight: 17 }}>
                  1. Autorize via OAuth2 no navegador ou cole seu Access Token obtido em{' '}
                  <Text style={{ fontWeight: '700' }}>strava.com/settings/api</Text> (escopo{' '}
                  <Text style={{ fontWeight: '700' }}>activity:read_all</Text>).{'\n'}
                  2. O Harry importa automaticamente distância (km), pace (/km), elevação (m) e calorias de todas as suas corridas.
                </Text>
              </View>

              <TouchableOpacity
                testID="strava-oauth-redirect-btn"
                onPress={handleStartStravaOAuth}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#F97316',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  🟠 Autorizar com Strava no Navegador (OAuth2)
                </Text>
              </TouchableOpacity>

              <Input
                testID="strava-access-token-input"
                label="Strava Access Token (Bearer Token API v3)"
                placeholder="Ex: a1b2c3d4e5f6... (de strava.com/settings/api)"
                value={stravaAccessToken}
                onChangeText={setStravaAccessToken}
              />

              <Input
                testID="strava-refresh-token-input"
                label="Strava Refresh Token (Opcional - Renovação Automática)"
                placeholder="Ex: r9f8e7d6..."
                value={stravaRefreshToken}
                onChangeText={setStravaRefreshToken}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    testID="strava-client-id-input"
                    label="Client ID (Opcional)"
                    placeholder="Ex: 123456"
                    value={stravaClientId}
                    onChangeText={setStravaClientId}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    testID="strava-auth-code-input"
                    label="Código OAuth (Opcional)"
                    placeholder="code=..."
                    value={stravaAuthCode}
                    onChangeText={setStravaAuthCode}
                  />
                </View>
              </View>

              <Button
                testID="strava-connect-token-btn"
                title="🔗 Salvar Token & Sincronizar Strava API v3"
                onPress={handleConnectStravaCredentials}
                isLoading={isConnecting || isSyncing}
                style={{ marginTop: 4 }}
              />

              <TouchableOpacity
                testID="strava-connect-sandbox-btn"
                onPress={handleConnectStravaSandbox}
                style={{
                  marginTop: 10,
                  paddingVertical: 11,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceSubtle,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textPrimary }}>
                  🧪 Conectar em Modo Demonstração (Atividades GPS de Teste)
                </Text>
              </TouchableOpacity>

              {stravaIntegration?.isActive && (
                <TouchableOpacity
                  testID="disconnect-strava-btn"
                  onPress={() => handleDisconnectProvider(FitnessProvider.STRAVA)}
                  disabled={isDisconnecting}
                  style={{
                    marginTop: 12,
                    marginBottom: 30,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.danger }}>
                    🔌 Desconectar Conta do Strava
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL DE CONFIGURAÇÃO MFIT PERSONAL (CONTA DO ALUNO & FICHAS A/B/C) */}
      <Modal visible={mfitModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay} testID="mfit-config-modal">
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                🏋️ MFIT Personal — Aluno & Fichas de Treino
              </Text>
              <TouchableOpacity
                testID="close-mfit-modal-btn"
                onPress={() => setMfitModalVisible(false)}
              >
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
              <View
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(139, 92, 246, 0.35)',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#8B5CF6', marginBottom: 4 }}>
                  Sincronização de Fichas do MFIT Personal
                </Text>
                <Text style={{ fontSize: 11.5, color: theme.textSecondary, lineHeight: 17 }}>
                  Vincule seu e-mail de aluno ou o link de compartilhamento da sua ficha do{' '}
                  <Text style={{ fontWeight: '700' }}>MFIT Personal</Text>, ou selecione abaixo qual ficha (Treino A, B ou C) você concluiu hoje para registrar séries, cargas e volume total (kg).
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                1. Concluir Ficha MFIT de Hoje em 1 Toque
              </Text>
              <View style={{ gap: 8, marginBottom: 14 }}>
                {MFIT_PRESET_SHEETS.map((sheet) => {
                  const selected = selectedMfitSheetId === sheet.id;
                  return (
                    <TouchableOpacity
                      key={sheet.id}
                      testID={`select-mfit-sheet-${sheet.id}`}
                      onPress={() => setSelectedMfitSheetId(sheet.id)}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: selected ? '#8B5CF6' : theme.border,
                        backgroundColor: selected
                          ? 'rgba(139, 92, 246, 0.12)'
                          : theme.surfaceSubtle,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textPrimary }}>
                          {selected ? '● ' : '○ '}
                          {sheet.title}
                        </Text>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#8B5CF6' }}>
                          {sheet.durationMinutes} min
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                        {sheet.exercises.map((e) => `${e.name} (${e.sets}x${e.reps} ${e.weightKg}kg)`).join(' • ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                testID="mfit-log-sheet-btn"
                onPress={handleLogMfitSheetToday}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: '#8B5CF6',
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  ✅ Concluir e Registrar Ficha {selectedMfitSheetId} de Hoje
                </Text>
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                2. Vincular Conta de Aluno / Link da Ficha MFIT
              </Text>

              <Input
                testID="mfit-email-input"
                label="E-mail de Aluno no MFIT Personal"
                placeholder="seu@email.com"
                value={mfitEmail}
                onChangeText={setMfitEmail}
              />

              <Input
                testID="mfit-password-input"
                label="Senha ou Token do Aluno MFIT (Opcional)"
                placeholder="Sua senha do app MFIT Aluno"
                value={mfitPassword}
                onChangeText={setMfitPassword}
                secureTextEntry
              />

              <Input
                testID="mfit-sheet-url-input"
                label="Link da Ficha Web / Endpoint JSON MFIT (Opcional)"
                placeholder="https://app.mfitpersonal.com.br/..."
                value={mfitSheetUrl}
                onChangeText={setMfitSheetUrl}
              />

              <Button
                testID="mfit-connect-account-btn"
                title="🔗 Vincular Conta MFIT & Sincronizar Fichas"
                onPress={handleConnectMfitAccount}
                isLoading={isConnecting || isSyncing}
                style={{ marginTop: 4, marginBottom: 16 }}
              />

              {mfitIntegration?.isActive && (
                <TouchableOpacity
                  testID="disconnect-mfit-btn"
                  onPress={() => handleDisconnectProvider(FitnessProvider.MFIT)}
                  disabled={isDisconnecting}
                  style={{
                    marginBottom: 30,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: theme.danger }}>
                    🔌 Desconectar Conta MFIT Personal
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL DE REGISTRO DE TREINO MANUAL */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay} testID="workout-modal">
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Registrar Novo Treino
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 20 }}>
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
                        modality === WorkoutModality.RUNNING ? theme.primaryLight : theme.surfaceSubtle,
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
                        modality === WorkoutModality.STRENGTH ? theme.primaryLight : theme.surfaceSubtle,
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
                placeholder="Ex: Corrida 5km / Treino A Superiores"
                value={title}
                onChangeText={setTitle}
              />

              <CalendarDatePicker
                testID="workout-date-picker"
                label="Data do Treino"
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
                <Input
                  testID="workout-distance-input"
                  label="Distância Percorrida (km)"
                  placeholder="5.0"
                  value={distanceKm}
                  onChangeText={setDistanceKm}
                  keyboardType="numeric"
                />
              ) : (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    Exercícios da Ficha ({exercises.length})
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
                label="Observações / Sensação do Treino"
                placeholder="Ex: Ótimo ritmo hoje!"
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                testID="save-workout-btn"
                title="Salvar Treino & Notificar Par"
                onPress={handleCreateWorkout}
                isLoading={isCreating}
                style={{ marginTop: 10, marginBottom: 36 }}
              />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 22,
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
  integrationsGrid: {
    gap: 12,
  },
  integrationCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  configBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  workoutCard: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
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
  workoutCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
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
    borderRadius: 14,
    borderWidth: 1.5,
  },
});
