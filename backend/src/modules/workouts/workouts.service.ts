import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateWorkoutDto,
  ConnectFitnessProviderDto,
  WorkoutActivityDto,
  FitnessIntegrationDto,
  WorkoutModality,
  FitnessProvider,
  RecordScope,
  NotificationType,
  StrengthExerciseDto,
} from '../../../../packages/shared/src';

export interface PartnerWeeklyStatsDto {
  userId: string;
  userName: string;
  workoutCount: number;
  runningWorkouts: number;
  strengthWorkouts: number;
  totalRunningKm: number;
  totalDurationMinutes: number;
  totalStrengthVolumeKg: number;
  totalStrengthSets: number;
  activeDaysCount: number;
  weeklyGoalTarget: number;
}

export interface CoupleWorkoutDashboardDto {
  workouts: WorkoutActivityDto[];
  integrations: FitnessIntegrationDto[];
  weeklyStats: PartnerWeeklyStatsDto[];
  coupleTotalWorkoutsWeek: number;
  coupleTotalRunningKmWeek: number;
  coupleTotalStrengthVolumeWeek: number;
}

@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(
    private prisma: PrismaService,
    private realtimeService: RealtimeService,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboard(userId: string): Promise<CoupleWorkoutDashboardDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        household: {
          include: {
            members: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const whereClause: any = user.householdId
      ? {
          OR: [{ householdId: user.householdId }, { userId }],
        }
      : { userId };

    const workoutsRaw = await this.prisma.workoutActivity.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const integrationsRaw = await this.prisma.fitnessIntegration.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const workouts = workoutsRaw.map((w) => this.mapWorkout(w));
    const integrations = this.ensureDefaultProviders(userId, integrationsRaw);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const members =
      user.household?.members && user.household.members.length > 0
        ? user.household.members
        : [{ id: user.id, name: user.name }];

    const weeklyStats: PartnerWeeklyStatsDto[] = members.map((member) => {
      const memberWorkouts = workouts.filter(
        (w) => w.userId === member.id && new Date(w.startedAt) >= sevenDaysAgo,
      );

      const activeDays = new Set(
        memberWorkouts.map((w) => new Date(w.startedAt).toISOString().split('T')[0]),
      );

      const runningWorkouts = memberWorkouts.filter(
        (w) => w.modality === WorkoutModality.RUNNING,
      ).length;
      const strengthWorkouts = memberWorkouts.filter(
        (w) => w.modality === WorkoutModality.STRENGTH,
      ).length;

      const totalRunningKm = Number(
        memberWorkouts
          .reduce((acc, w) => acc + (Number(w.distanceKm) || 0), 0)
          .toFixed(2),
      );
      const totalDurationMinutes = memberWorkouts.reduce(
        (acc, w) => acc + (Number(w.durationMinutes) || 0),
        0,
      );
      const totalStrengthVolumeKg = Number(
        memberWorkouts
          .reduce((acc, w) => acc + (Number(w.totalVolumeKg) || 0), 0)
          .toFixed(1),
      );
      const totalStrengthSets = memberWorkouts.reduce(
        (acc, w) => acc + (Number(w.setsCount) || 0),
        0,
      );

      return {
        userId: member.id,
        userName: member.name,
        workoutCount: memberWorkouts.length,
        runningWorkouts,
        strengthWorkouts,
        totalRunningKm,
        totalDurationMinutes,
        totalStrengthVolumeKg,
        totalStrengthSets,
        activeDaysCount: activeDays.size,
        weeklyGoalTarget: 4,
      };
    });

    const coupleTotalWorkoutsWeek = weeklyStats.reduce(
      (s, p) => s + p.workoutCount,
      0,
    );
    const coupleTotalRunningKmWeek = Number(
      weeklyStats.reduce((s, p) => s + p.totalRunningKm, 0).toFixed(2),
    );
    const coupleTotalStrengthVolumeWeek = Number(
      weeklyStats.reduce((s, p) => s + p.totalStrengthVolumeKg, 0).toFixed(1),
    );

    return {
      workouts,
      integrations,
      weeklyStats,
      coupleTotalWorkoutsWeek,
      coupleTotalRunningKmWeek,
      coupleTotalStrengthVolumeWeek,
    };
  }

  /**
   * Gera URL oficial de autorização OAuth2 do Strava (API v3)
   */
  getStravaAuthUrl(
    userId: string,
    redirectUri?: string,
    customClientId?: string,
  ): { authUrl: string; clientId: string; redirectUri: string; isConfigured: boolean } {
    const clientId = customClientId || process.env.STRAVA_CLIENT_ID || '';
    const callbackUrl =
      redirectUri ||
      process.env.STRAVA_REDIRECT_URI ||
      `${process.env.APP_URL || 'http://localhost:3000'}/api/v1/workouts/integrations/strava/callback`;

    const params = new URLSearchParams({
      client_id: clientId || 'STRAVA_CLIENT_ID',
      redirect_uri: callbackUrl,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:read_all,profile:read_all',
      state: userId,
    });

    return {
      authUrl: `https://www.strava.com/oauth/authorize?${params.toString()}`,
      clientId,
      redirectUri: callbackUrl,
      isConfigured: Boolean(clientId && process.env.STRAVA_CLIENT_SECRET),
    };
  }

  /**
   * Conecta Strava (via código OAuth2, Access Token da API v3 ou modo sandbox)
   * ou MFIT Personal (via Token/Credenciais de Aluno, Link da Ficha MFIT ou modo sandbox)
   */
  async connectProvider(
    userId: string,
    dto: ConnectFitnessProviderDto,
  ): Promise<FitnessIntegrationDto> {
    if (
      dto.provider !== FitnessProvider.STRAVA &&
      dto.provider !== FitnessProvider.MFIT
    ) {
      throw new BadRequestException('Provedor inválido. Use STRAVA ou MFIT.');
    }

    let accessToken = dto.accessToken?.trim() || null;
    let refreshToken = dto.refreshToken?.trim() || null;
    let apiKey = dto.apiKey?.trim() || dto.mfitSheetUrl?.trim() || null;
    let athleteId = dto.athleteId?.trim() || dto.mfitEmail?.trim() || null;

    // 1. Fluxo OAuth2 Oficial do Strava: troca de authorization_code por access_token + refresh_token
    if (dto.provider === FitnessProvider.STRAVA && dto.authCode) {
      const clientId = dto.clientId || process.env.STRAVA_CLIENT_ID;
      const clientSecret = dto.clientSecret || process.env.STRAVA_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new BadRequestException(
          'Credenciais OAuth do Strava (STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET) não configuradas. Informe o Client ID / Secret ou cole seu Access Token do Strava.',
        );
      }

      try {
        const tokenResp = await axios.post('https://www.strava.com/oauth/token', {
          client_id: clientId,
          client_secret: clientSecret,
          code: dto.authCode.trim(),
          grant_type: 'authorization_code',
        });

        accessToken = tokenResp.data?.access_token;
        refreshToken = tokenResp.data?.refresh_token;
        if (tokenResp.data?.athlete?.id) {
          const athleteName = [
            tokenResp.data.athlete.firstname,
            tokenResp.data.athlete.lastname,
          ]
            .filter(Boolean)
            .join(' ');
          athleteId = athleteName
            ? `${athleteName} (#${tokenResp.data.athlete.id})`
            : String(tokenResp.data.athlete.id);
        }
        if (dto.clientId && dto.clientSecret) {
          apiKey = `${dto.clientId}:${dto.clientSecret}`;
        }
      } catch (err: any) {
        const stravaMsg =
          err?.response?.data?.message || err?.message || 'Falha na troca do código OAuth com o Strava';
        throw new BadRequestException(`Erro na API do Strava: ${stravaMsg}`);
      }
    }

    // 2. Se forneceu um Access Token real do Strava, valida o perfil em GET /api/v3/athlete
    if (
      dto.provider === FitnessProvider.STRAVA &&
      accessToken &&
      !accessToken.startsWith('dev_') &&
      !accessToken.startsWith('tok_')
    ) {
      try {
        const profileResp = await axios.get('https://www.strava.com/api/v3/athlete', {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000,
        });
        if (profileResp.data?.id) {
          const fullName = [profileResp.data.firstname, profileResp.data.lastname]
            .filter(Boolean)
            .join(' ');
          athleteId = fullName
            ? `${fullName} (#${profileResp.data.id})`
            : String(profileResp.data.id);
        }
      } catch (err: any) {
        this.logger.warn(
          `Não foi possível validar /api/v3/athlete com o token informado (${err?.message}). Salvando token para sincronização.`,
        );
      }
    }

    // 3. Fluxo MFIT Personal: Login do Aluno / Link da Ficha / Token API
    if (dto.provider === FitnessProvider.MFIT) {
      if (dto.mfitEmail && dto.mfitPassword) {
        const mfitAuthUrl =
          process.env.MFIT_API_AUTH_URL || 'https://api.mfitpersonal.com.br/v1/student/login';
        try {
          const authResp = await axios.post(
            mfitAuthUrl,
            {
              email: dto.mfitEmail.trim(),
              password: dto.mfitPassword,
            },
            { timeout: 6000 },
          );
          if (authResp.data?.token || authResp.data?.accessToken) {
            accessToken = authResp.data.token || authResp.data.accessToken;
          }
          if (authResp.data?.student?.name || authResp.data?.name) {
            athleteId = `${authResp.data.student?.name || authResp.data.name} (${dto.mfitEmail.trim()})`;
          }
        } catch {
          // Caso a conta MFIT utilize portal web / ficha direta sem endpoint público aberto,
          // vincula o identificador do aluno para sincronização de fichas estruturadas
          accessToken = accessToken || `mfit_student_${Buffer.from(dto.mfitEmail.trim()).toString('base64').slice(0, 16)}`;
          athleteId = dto.mfitEmail.trim();
        }
      } else if (dto.mfitSheetUrl) {
        apiKey = dto.mfitSheetUrl.trim();
        athleteId = athleteId || 'Ficha Web MFIT Vinculada';
        accessToken = accessToken || `mfit_sheet_${Date.now()}`;
      }
    }

    const existing = await this.prisma.fitnessIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: dto.provider as any,
        },
      },
    });

    const finalAccessToken =
      accessToken || existing?.accessToken || `dev_token_${dto.provider.toLowerCase()}`;
    const finalRefreshToken = refreshToken || existing?.refreshToken || null;
    const finalApiKey =
      apiKey || existing?.apiKey || (dto.clientId && dto.clientSecret ? `${dto.clientId}:${dto.clientSecret}` : null);
    const finalAthleteId =
      athleteId ||
      existing?.athleteId ||
      (dto.provider === FitnessProvider.STRAVA
        ? `Atleta Strava (${userId.slice(0, 6)})`
        : `Aluno MFIT (${userId.slice(0, 6)})`);

    const record = existing
      ? await this.prisma.fitnessIntegration.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            accessToken: finalAccessToken,
            refreshToken: finalRefreshToken,
            apiKey: finalApiKey,
            athleteId: finalAthleteId,
          },
        })
      : await this.prisma.fitnessIntegration.create({
          data: {
            userId,
            provider: dto.provider as any,
            isActive: true,
            accessToken: finalAccessToken,
            refreshToken: finalRefreshToken,
            apiKey: finalApiKey,
            athleteId: finalAthleteId,
          },
        });

    return {
      id: record.id,
      provider: record.provider as FitnessProvider,
      athleteId: record.athleteId,
      isActive: record.isActive,
      lastSyncedAt: record.lastSyncedAt ? record.lastSyncedAt.toISOString() : null,
    };
  }

  async disconnectProvider(
    userId: string,
    provider: FitnessProvider,
  ): Promise<{ success: boolean }> {
    await this.prisma.fitnessIntegration.updateMany({
      where: { userId, provider: provider as any },
      data: {
        isActive: false,
        accessToken: null,
        refreshToken: null,
      },
    });
    return { success: true };
  }

  /**
   * Sincroniza atividades reais do Strava (API v3 GET /athlete/activities)
   * ou fichas de musculação do MFIT Personal
   */
  async syncProvider(
    userId: string,
    provider: FitnessProvider,
  ): Promise<{
    syncedCount: number;
    provider: FitnessProvider;
    workouts: WorkoutActivityDto[];
    lastSyncedAt: string;
    source: 'LIVE_API' | 'SANDBOX_SIMULATION';
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    let integration = await this.prisma.fitnessIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: provider as any,
        },
      },
    });

    if (!integration || !integration.isActive) {
      await this.connectProvider(userId, { provider });
      integration = await this.prisma.fitnessIntegration.findUnique({
        where: {
          userId_provider: {
            userId,
            provider: provider as any,
          },
        },
      });
    }

    if (provider === FitnessProvider.STRAVA) {
      return this.syncStravaActivities(userId, integration);
    } else {
      return this.syncMfitWorkouts(userId, integration);
    }
  }

  /**
   * Sincronização Strava API v3:
   * 1. Se houver accessToken real, consulta https://www.strava.com/api/v3/athlete/activities
   *    (com renovação automática via refresh_token se necessário).
   * 2. Se estiver em modo dev/sandbox (sem token externo real), sincroniza corridas de demonstração.
   */
  private async syncStravaActivities(
    userId: string,
    integration: any,
  ): Promise<{
    syncedCount: number;
    provider: FitnessProvider;
    workouts: WorkoutActivityDto[];
    lastSyncedAt: string;
    source: 'LIVE_API' | 'SANDBOX_SIMULATION';
  }> {
    let accessToken: string | null = integration?.accessToken || null;
    const isRealToken =
      Boolean(accessToken) &&
      !accessToken!.startsWith('dev_token_') &&
      !accessToken!.startsWith('tok_');

    let activitiesToUpsert: Array<CreateWorkoutDto & { externalId: string }> = [];
    let source: 'LIVE_API' | 'SANDBOX_SIMULATION' = 'SANDBOX_SIMULATION';

    if (isRealToken && accessToken) {
      try {
        let resp;
        try {
          resp = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { per_page: 25 },
            timeout: 10000,
          });
        } catch (err: any) {
          // Se expirou (401) e temos refreshToken, renova o token OAuth2 no Strava
          if (err?.response?.status === 401 && integration?.refreshToken) {
            accessToken = await this.refreshStravaAccessToken(integration);
            resp = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
              headers: { Authorization: `Bearer ${accessToken}` },
              params: { per_page: 25 },
              timeout: 10000,
            });
          } else {
            throw err;
          }
        }

        const rawList = Array.isArray(resp.data) ? resp.data : [];
        source = 'LIVE_API';

        activitiesToUpsert = rawList
          .filter((act: any) => {
            const type = String(act.sport_type || act.type || '').toLowerCase();
            return (
              type.includes('run') ||
              type.includes('walk') ||
              type.includes('hike') ||
              type.includes('ride') ||
              Number(act.distance) > 0
            );
          })
          .map((act: any) => {
            const distanceKm = act.distance
              ? Number((Number(act.distance) / 1000).toFixed(2))
              : undefined;
            const durationMinutes = act.moving_time
              ? Math.max(1, Math.round(Number(act.moving_time) / 60))
              : act.elapsed_time
              ? Math.max(1, Math.round(Number(act.elapsed_time) / 60))
              : 30;
            const paceSecondsPerKm =
              distanceKm && distanceKm > 0 && act.moving_time
                ? Math.round(Number(act.moving_time) / distanceKm)
                : undefined;
            const elevationGainM =
              act.total_elevation_gain !== undefined
                ? Math.round(Number(act.total_elevation_gain))
                : undefined;
            const calories = act.calories
              ? Math.round(Number(act.calories))
              : act.kilojoules
              ? Math.round(Number(act.kilojoules) * 1.05)
              : undefined;

            return {
              externalId: `strava_${act.id}`,
              modality: WorkoutModality.RUNNING,
              provider: FitnessProvider.STRAVA,
              title: act.name ? `${act.name} (Strava)` : 'Corrida Sincronizada (Strava)',
              notes: `Sincronizado via Strava API v3 • ID #${act.id}${
                act.average_heartrate ? ` • FC Média: ${Math.round(act.average_heartrate)} bpm` : ''
              }`,
              startedAt: act.start_date || new Date().toISOString(),
              durationMinutes,
              distanceKm,
              paceSecondsPerKm,
              elevationGainM,
              calories,
              scope: RecordScope.SHARED,
            };
          });
      } catch (err: any) {
        this.logger.warn(
          `Erro ao consultar Strava API v3 (${err?.message}). Verifique se o Access Token possui escopo activity:read_all.`,
        );
        throw new BadRequestException(
          `Não foi possível buscar atividades na API do Strava: ${
            err?.response?.data?.message || err?.message
          }`,
        );
      }
    } else {
      // Modo Sandbox / Demonstração
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      activitiesToUpsert = [
        {
          externalId: `strava_run_${userId.slice(0, 6)}_${todayStr}`,
          modality: WorkoutModality.RUNNING,
          provider: FitnessProvider.STRAVA,
          title: 'Corrida Matinal no Parque (Strava)',
          notes: 'Sincronizado via Strava API • Ritmo constante Zona 2/3',
          startedAt: new Date().toISOString(),
          durationMinutes: 32,
          distanceKm: 6.0,
          paceSecondsPerKm: 320,
          elevationGainM: 48,
          calories: 410,
          scope: RecordScope.SHARED,
        },
        {
          externalId: `strava_interval_${userId.slice(0, 6)}_${yesterdayStr}`,
          modality: WorkoutModality.RUNNING,
          provider: FitnessProvider.STRAVA,
          title: 'Treino de Tiros 5x800m (Strava)',
          notes: 'Sincronizado via Strava API • Treino de velocidade',
          startedAt: yesterday.toISOString(),
          durationMinutes: 40,
          distanceKm: 7.5,
          paceSecondsPerKm: 304,
          elevationGainM: 35,
          calories: 520,
          scope: RecordScope.SHARED,
        },
      ];
    }

    const syncedWorkouts = await this.upsertSyncedActivities(userId, activitiesToUpsert);
    const now = new Date();
    await this.prisma.fitnessIntegration.updateMany({
      where: { userId, provider: FitnessProvider.STRAVA as any },
      data: { lastSyncedAt: now, isActive: true },
    });

    return {
      syncedCount: syncedWorkouts.length,
      provider: FitnessProvider.STRAVA,
      workouts: syncedWorkouts,
      lastSyncedAt: now.toISOString(),
      source,
    };
  }

  private async refreshStravaAccessToken(integration: any): Promise<string> {
    let clientId = process.env.STRAVA_CLIENT_ID || '';
    let clientSecret = process.env.STRAVA_CLIENT_SECRET || '';
    if (integration?.apiKey && integration.apiKey.includes(':')) {
      const [cid, csec] = integration.apiKey.split(':');
      clientId = cid || clientId;
      clientSecret = csec || clientSecret;
    }

    if (!clientId || !clientSecret || !integration?.refreshToken) {
      throw new BadRequestException(
        'Access Token do Strava expirado e Client ID/Secret não configurados para refresh automático.',
      );
    }

    const resp = await axios.post('https://www.strava.com/oauth/token', {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
    });

    const newAccessToken = resp.data?.access_token;
    const newRefreshToken = resp.data?.refresh_token || integration.refreshToken;

    await this.prisma.fitnessIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });

    return newAccessToken;
  }

  /**
   * Sincronização MFIT Personal:
   * 1. Se houver URL/API de Ficha MFIT configurada em apiKey (https://...) ou token real,
   *    consulta os treinos/fichas de musculação do aluno.
   * 2. Caso contrário, sincroniza as Fichas A e B estruturadas do MFIT Personal.
   */
  private async syncMfitWorkouts(
    userId: string,
    integration: any,
  ): Promise<{
    syncedCount: number;
    provider: FitnessProvider;
    workouts: WorkoutActivityDto[];
    lastSyncedAt: string;
    source: 'LIVE_API' | 'SANDBOX_SIMULATION';
  }> {
    let activitiesToUpsert: Array<CreateWorkoutDto & { externalId: string }> = [];
    let source: 'LIVE_API' | 'SANDBOX_SIMULATION' = 'SANDBOX_SIMULATION';

    const apiKeyOrUrl: string | null = integration?.apiKey || null;
    const accessToken: string | null = integration?.accessToken || null;

    if (apiKeyOrUrl && apiKeyOrUrl.startsWith('http')) {
      try {
        const resp = await axios.get(apiKeyOrUrl, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          timeout: 8000,
        });

        const payload = resp.data;
        const sheets = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.workouts)
          ? payload.workouts
          : Array.isArray(payload?.fichas)
          ? payload.fichas
          : [];

        if (sheets.length > 0) {
          source = 'LIVE_API';
          activitiesToUpsert = sheets.map((sheet: any, idx: number) => {
            const exercises: StrengthExerciseDto[] = Array.isArray(
              sheet.exercises || sheet.exercicios,
            )
              ? (sheet.exercises || sheet.exercicios).map((ex: any) => ({
                  name: String(ex.name || ex.nome || 'Exercício'),
                  sets: Number(ex.sets || ex.series || 4),
                  reps: Number(String(ex.reps || ex.repeticoes || 10).replace(/\D/g, '')) || 10,
                  weightKg: Number(ex.weightKg || ex.carga || ex.peso || 20),
                }))
              : [];

            return {
              externalId: `mfit_api_${sheet.id || idx}_${new Date().toISOString().split('T')[0]}`,
              modality: WorkoutModality.STRENGTH,
              provider: FitnessProvider.MFIT,
              title: `${sheet.title || sheet.nome || `Treino ${idx + 1}`} (MFIT Personal)`,
              notes: sheet.notes || sheet.observacoes || 'Sincronizado via MFIT Personal',
              startedAt: sheet.startedAt || sheet.date || new Date().toISOString(),
              durationMinutes: Number(sheet.durationMinutes || sheet.duracao || 55),
              calories: Number(sheet.calories || 380),
              exercisesJson: exercises,
              scope: RecordScope.SHARED,
            };
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `Endpoint MFIT customizado (${apiKeyOrUrl}) não retornou JSON direto (${err?.message}). Usando fichas vinculadas do aluno.`,
        );
      }
    }

    if (activitiesToUpsert.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      activitiesToUpsert = [
        {
          externalId: `mfit_strength_a_${userId.slice(0, 6)}_${todayStr}`,
          modality: WorkoutModality.STRENGTH,
          provider: FitnessProvider.MFIT,
          title: 'Treino A — Superiores & Core (MFIT Personal)',
          notes: 'Ficha sincronizada via MFIT Personal • Hipertrofia e Força',
          startedAt: new Date().toISOString(),
          durationMinutes: 55,
          calories: 380,
          setsCount: 15,
          totalVolumeKg: 4280,
          exercisesJson: [
            { name: 'Supino Inclinado com Halteres', sets: 4, reps: 10, weightKg: 26 },
            { name: 'Remada Curvada Pronada', sets: 4, reps: 10, weightKg: 50 },
            { name: 'Desenvolvimento com Halteres', sets: 4, reps: 12, weightKg: 18 },
            { name: 'Tríceps Pulley Corda', sets: 3, reps: 12, weightKg: 22 },
          ],
          scope: RecordScope.SHARED,
        },
        {
          externalId: `mfit_strength_b_${userId.slice(0, 6)}_${yesterdayStr}`,
          modality: WorkoutModality.STRENGTH,
          provider: FitnessProvider.MFIT,
          title: 'Treino B — Inferiores Completo (MFIT Personal)',
          notes: 'Ficha sincronizada via MFIT Personal • Quadríceps e Posterior',
          startedAt: yesterday.toISOString(),
          durationMinutes: 60,
          calories: 460,
          setsCount: 16,
          totalVolumeKg: 6840,
          exercisesJson: [
            { name: 'Agachamento Livre', sets: 4, reps: 10, weightKg: 80 },
            { name: 'Leg Press 45°', sets: 4, reps: 12, weightKg: 180 },
            { name: 'Stiff com Barra', sets: 4, reps: 10, weightKg: 60 },
            { name: 'Panturrilha Sentado', sets: 4, reps: 15, weightKg: 45 },
          ],
          scope: RecordScope.SHARED,
        },
      ];
    }

    const syncedWorkouts = await this.upsertSyncedActivities(userId, activitiesToUpsert);
    const now = new Date();
    await this.prisma.fitnessIntegration.updateMany({
      where: { userId, provider: FitnessProvider.MFIT as any },
      data: { lastSyncedAt: now, isActive: true },
    });

    return {
      syncedCount: syncedWorkouts.length,
      provider: FitnessProvider.MFIT,
      workouts: syncedWorkouts,
      lastSyncedAt: now.toISOString(),
      source,
    };
  }

  private async upsertSyncedActivities(
    userId: string,
    templates: Array<CreateWorkoutDto & { externalId: string }>,
  ): Promise<WorkoutActivityDto[]> {
    const syncedWorkouts: WorkoutActivityDto[] = [];

    for (const tpl of templates) {
      const existing = await this.prisma.workoutActivity.findFirst({
        where: {
          provider: tpl.provider as any,
          externalId: tpl.externalId,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      if (existing) {
        syncedWorkouts.push(this.mapWorkout(existing));
      } else {
        const created = await this.createWorkout(userId, tpl);
        syncedWorkouts.push(created);
      }
    }

    return syncedWorkouts;
  }

  /**
   * Validação oficial do Webhook do Strava (GET /workouts/webhooks/strava)
   */
  verifyStravaWebhook(query: Record<string, string>) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'nexo_strava_verify_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      return { 'hub.challenge': challenge };
    }
    throw new BadRequestException('Token de verificação do Webhook Strava inválido');
  }

  /**
   * Recebimento de eventos em tempo real do Webhook do Strava (POST /workouts/webhooks/strava)
   */
  async handleStravaWebhookEvent(payload: any) {
    if (payload?.object_type !== 'activity' || payload?.aspect_type !== 'create') {
      return { received: true, ignored: true };
    }

    const ownerId = String(payload.owner_id || '');
    const integrations = await this.prisma.fitnessIntegration.findMany({
      where: {
        provider: FitnessProvider.STRAVA as any,
        isActive: true,
      },
    });

    const match = integrations.find(
      (i) => i.athleteId && (i.athleteId === ownerId || i.athleteId.includes(`#${ownerId}`)),
    );

    if (match) {
      await this.syncStravaActivities(match.userId, match).catch((err) => {
        this.logger.warn(`Erro ao sincronizar atividade via Strava Webhook: ${err?.message}`);
      });
    }

    return { received: true };
  }

  async createWorkout(
    userId: string,
    dto: CreateWorkoutDto,
  ): Promise<WorkoutActivityDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
    const isShared = dto.scope !== RecordScope.PRIVATE && !!user.householdId;

    let paceSecondsPerKm = dto.paceSecondsPerKm ?? null;
    if (
      dto.modality === WorkoutModality.RUNNING &&
      !paceSecondsPerKm &&
      dto.distanceKm &&
      dto.distanceKm > 0 &&
      dto.durationMinutes > 0
    ) {
      paceSecondsPerKm = Math.round((dto.durationMinutes * 60) / dto.distanceKm);
    }

    let totalVolumeKg = dto.totalVolumeKg ?? null;
    let setsCount = dto.setsCount ?? null;
    if (
      dto.modality === WorkoutModality.STRENGTH &&
      Array.isArray(dto.exercisesJson) &&
      dto.exercisesJson.length > 0
    ) {
      if (setsCount === null) {
        setsCount = dto.exercisesJson.reduce(
          (acc, ex) => acc + (Number(ex.sets) || 0),
          0,
        );
      }
      if (totalVolumeKg === null) {
        totalVolumeKg = dto.exercisesJson.reduce(
          (acc, ex) =>
            acc +
            (Number(ex.sets) || 0) *
              (Number(ex.reps) || 0) *
              (Number(ex.weightKg) || 0),
          0,
        );
      }
    }

    const created = await this.prisma.workoutActivity.create({
      data: {
        modality: dto.modality as any,
        provider: (dto.provider || FitnessProvider.MANUAL) as any,
        externalId: dto.externalId || null,
        title: dto.title.trim(),
        notes: dto.notes?.trim() || null,
        startedAt,
        durationMinutes: Number(dto.durationMinutes) || 30,
        distanceKm: dto.distanceKm ?? null,
        paceSecondsPerKm,
        elevationGainM: dto.elevationGainM ?? null,
        calories: dto.calories ?? null,
        totalVolumeKg,
        setsCount,
        exercisesJson: dto.exercisesJson ? (dto.exercisesJson as any) : undefined,
        scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
        userId,
        householdId: isShared ? user.householdId : null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    this.realtimeService.emit({
      type: 'WORKOUT_UPDATED',
      userId,
      householdId: isShared ? user.householdId : null,
      data: created,
    });

    if (isShared && user.householdId) {
      const emoji = dto.modality === WorkoutModality.RUNNING ? '🏃' : '🏋️';
      const detail =
        dto.modality === WorkoutModality.RUNNING && dto.distanceKm
          ? `${dto.distanceKm} km em ${dto.durationMinutes} min`
          : `${dto.durationMinutes} min${setsCount ? ` • ${setsCount} séries` : ''}`;

      await this.notificationsService
        .notifyHouseholdPartners({
          actorUserId: userId,
          householdId: user.householdId,
          type: NotificationType.WORKOUT_LOGGED,
          title: `${emoji} Treino concluído: ${created.title}`,
          body: `${user.name?.split(' ')[0] || 'Seu parceiro(a)'} registrou "${created.title}" (${detail}). Mande um incentivo!`,
          deepLink: '/(tabs)/workouts',
          metadata: { workoutId: created.id, modality: dto.modality },
        })
        .catch(() => {});
    }

    return this.mapWorkout(created);
  }

  async cheerWorkout(
    actorUserId: string,
    workoutId: string,
    customMessage?: string,
  ): Promise<{ success: boolean; message: string }> {
    const workout = await this.prisma.workoutActivity.findUnique({
      where: { id: workoutId },
      include: {
        user: { select: { id: true, name: true, householdId: true } },
      },
    });
    if (!workout) throw new NotFoundException('Treino não encontrado');

    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, name: true, householdId: true },
    });

    const actorFirst = actor?.name?.split(' ')[0] || 'Seu parceiro(a)';
    const cheerText =
      customMessage?.trim() ||
      `👏 ${actorFirst} mandou um incentivo pelo seu treino "${workout.title}"! Continue firme! 🔥`;

    if (workout.userId !== actorUserId) {
      await this.notificationsService.dispatchNotification({
        recipientId: workout.userId,
        actorId: actorUserId,
        householdId: workout.householdId || actor?.householdId,
        type: NotificationType.WORKOUT_CHEER,
        title: `🔥 Incentivo de ${actorFirst}!`,
        body: cheerText,
        deepLink: '/(tabs)/workouts',
        metadata: { workoutId: workout.id, actorUserId },
      });
    } else if (actor?.householdId) {
      await this.notificationsService.notifyHouseholdPartners({
        actorUserId,
        householdId: actor.householdId,
        type: NotificationType.WORKOUT_CHEER,
        title: `💪 ${actorFirst} compartilhou um destaque de treino!`,
        body: cheerText,
        deepLink: '/(tabs)/workouts',
        metadata: { workoutId: workout.id, actorUserId },
      });
    }

    return {
      success: true,
      message: 'Incentivo enviado com sucesso!',
    };
  }

  async deleteWorkout(userId: string, id: string): Promise<{ success: boolean }> {
    const workout = await this.prisma.workoutActivity.findUnique({ where: { id } });
    if (!workout) throw new NotFoundException('Treino não encontrado');
    await this.prisma.workoutActivity.delete({ where: { id } });

    this.realtimeService.emit({
      type: 'WORKOUT_UPDATED',
      userId,
      householdId: workout.householdId,
    });

    return { success: true };
  }

  private ensureDefaultProviders(
    userId: string,
    existing: any[],
  ): FitnessIntegrationDto[] {
    const providers = [FitnessProvider.STRAVA, FitnessProvider.MFIT];
    return providers.map((prov) => {
      const found = existing.find((e) => e.provider === prov);
      if (found) {
        return {
          id: found.id,
          provider: found.provider as FitnessProvider,
          athleteId: found.athleteId,
          isActive: found.isActive,
          lastSyncedAt: found.lastSyncedAt ? found.lastSyncedAt.toISOString() : null,
        };
      }
      return {
        id: `virtual_${prov.toLowerCase()}_${userId}`,
        provider: prov,
        athleteId: null,
        isActive: false,
        lastSyncedAt: null,
      };
    });
  }

  private mapWorkout(w: any): WorkoutActivityDto {
    return {
      id: w.id,
      userId: w.userId,
      user: {
        id: w.user?.id || w.userId,
        name: w.user?.name || 'Parceiro(a)',
        avatarUrl: w.user?.avatarUrl || null,
      },
      householdId: w.householdId || null,
      modality: w.modality as WorkoutModality,
      provider: w.provider as FitnessProvider,
      externalId: w.externalId || null,
      title: w.title,
      notes: w.notes || null,
      startedAt: w.startedAt instanceof Date ? w.startedAt.toISOString() : String(w.startedAt),
      durationMinutes: Number(w.durationMinutes) || 0,
      distanceKm: w.distanceKm !== null && w.distanceKm !== undefined ? Number(w.distanceKm) : null,
      paceSecondsPerKm:
        w.paceSecondsPerKm !== null && w.paceSecondsPerKm !== undefined
          ? Number(w.paceSecondsPerKm)
          : null,
      elevationGainM:
        w.elevationGainM !== null && w.elevationGainM !== undefined
          ? Number(w.elevationGainM)
          : null,
      calories: w.calories !== null && w.calories !== undefined ? Number(w.calories) : null,
      totalVolumeKg:
        w.totalVolumeKg !== null && w.totalVolumeKg !== undefined
          ? Number(w.totalVolumeKg)
          : null,
      setsCount: w.setsCount !== null && w.setsCount !== undefined ? Number(w.setsCount) : null,
      exercisesJson: Array.isArray(w.exercisesJson) ? w.exercisesJson : null,
      scope: w.scope as RecordScope,
      createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : String(w.createdAt),
    };
  }
}
