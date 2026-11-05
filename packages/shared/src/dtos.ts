import { z } from 'zod';
import {
  RecordScope,
  TransactionType,
  ExpenseCategory,
  GoalStatus,
  AIIntent,
  NotificationType,
  NotificationCategory,
  SettlementStatus,
  WorkoutModality,
  FitnessProvider,
  WorkoutStatus,
} from './enums';

// -----------------------------------------------------------------------------
// Auth DTOs
// -----------------------------------------------------------------------------
export const RegisterDtoSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  phoneNumber: z.string().optional(),
});
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
});
export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

export const GoogleAuthDtoSchema = z.object({
  accessToken: z.string().min(1, "Token do Google obrigatório"),
});
export type GoogleAuthDto = z.infer<typeof GoogleAuthDtoSchema>;

export const ForgotPasswordDtoSchema = z.object({
  email: z.string().email("Email inválido"),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

export const ResetPasswordDtoSchema = z.object({
  email: z.string().email("Email inválido"),
  code: z.string().min(4, "Código inválido"),
  newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;

export const UpdateProfileDtoSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().optional(),
  phoneNumber: z.string().optional(),
  dailySummaryTime: z.string().optional(),
  enableDailySummary: z.boolean().optional(),
  periodicSummaryType: z.string().optional(),
  periodicSummaryDay: z.number().optional(),
  periodicSummaryTime: z.string().optional(),
  timezone: z.string().optional(),
  expoPushToken: z.string().optional(),
  googleAccessToken: z.string().optional(),
  sharePrivateExpenses: z.boolean().optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileDtoSchema>;

export interface AuthResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    name: string;
    phoneNumber: string | null;
    householdId: string | null;
    avatarUrl?: string | null;
    googleAccessToken?: string | null;
    sharePrivateExpenses?: boolean;
    dailySummaryTime?: string | null;
    enableDailySummary?: boolean;
    periodicSummaryType?: string | null;
    periodicSummaryDay?: number | null;
    periodicSummaryTime?: string | null;
    timezone?: string | null;
  };
}

// -----------------------------------------------------------------------------
// Notification DTOs (Task 2)
// -----------------------------------------------------------------------------
export interface NotificationDto {
  id: string;
  userId: string;
  actorId?: string | null;
  actorName?: string | null;
  householdId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  deepLink?: string | null;
  metadata?: Record<string, any> | null;
  channels: string[];
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  id?: string;
  category: NotificationCategory | string;
  enableInApp: boolean;
  enablePush: boolean;
  enableWhatsapp: boolean;
}

export const UpdateNotificationPreferencesDtoSchema = z.object({
  preferences: z.array(
    z.object({
      category: z.string(),
      enableInApp: z.boolean(),
      enablePush: z.boolean(),
      enableWhatsapp: z.boolean(),
    }),
  ),
});
export type UpdateNotificationPreferencesDto = z.infer<typeof UpdateNotificationPreferencesDtoSchema>;

// -----------------------------------------------------------------------------
// Household DTOs
// -----------------------------------------------------------------------------
export const CreateHouseholdDtoSchema = z.object({
  name: z.string().min(2).default('Nossa Casa'),
});
export type CreateHouseholdDto = z.infer<typeof CreateHouseholdDtoSchema>;

export const JoinHouseholdDtoSchema = z.object({
  inviteCode: z.string().min(4, 'Código de convite inválido'),
});
export type JoinHouseholdDto = z.infer<typeof JoinHouseholdDtoSchema>;

export const UpdateHouseholdDtoSchema = z.object({
  name: z.string().min(1, 'Nome do espaço não pode ficar vazio'),
});
export type UpdateHouseholdDto = z.infer<typeof UpdateHouseholdDtoSchema>;

export interface HouseholdDetailDto {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: Array<{
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    avatarUrl?: string | null;
    sharePrivateExpenses?: boolean;
  }>;
}

// -----------------------------------------------------------------------------
// Expense, Settlement & Analytics DTOs (Tasks 3, 4, 5, 6)
// -----------------------------------------------------------------------------
export const CreateExpenseDtoSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.number().positive('O valor deve ser maior que zero'),
  type: z.nativeEnum(TransactionType).default(TransactionType.EXPENSE),
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.OTHER),
  scope: z.nativeEnum(RecordScope).default(RecordScope.PRIVATE),
  date: z.string().optional(), // ISO date string
  rawSource: z.string().optional(),
  paidByUserId: z.string().optional(),
});
export type CreateExpenseDto = z.infer<typeof CreateExpenseDtoSchema>;

export const UpdateExpenseDtoSchema = CreateExpenseDtoSchema.partial();
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseDtoSchema>;

export interface ExpenseDto {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: ExpenseCategory;
  date: string;
  scope: RecordScope;
  rawSource: string | null;
  userId: string;
  paidByUserId?: string | null;
  paidBy?: {
    id: string;
    name: string;
  } | null;
  settlementId?: string | null;
  householdId: string | null;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesSummaryDto {
  // Balanço Individual (Visão Pessoal do Usuário)
  myIncome: number;
  myPrivateExpenses: number;
  myShareOfSharedExpenses: number;
  myTotalExpenses: number;
  myBalance: number;

  // Balanço em Conjunto (Visão Casal / Casa)
  jointIncome: number;
  jointExpenses: number;
  jointBalance: number;

  // Totais Gerais
  totalIncome: number;
  totalExpense: number;
  balance: number;
  totalPrivate: number;
  totalShared: number;
  userShareOfShared: number;
  partnerPrivate?: number;
  month: string;
}

export interface ExpensesListResponseDto {
  summary: ExpensesSummaryDto;
  items: ExpenseDto[];
}

export interface MemberSettlementBreakdownDto {
  userId: string;
  name: string;
  paidAmount: number;
  quotaAmount: number;
  netBalance: number; // positivo = tem a receber; negativo = deve pagar
}

export interface SettlementPreviewDto {
  householdId: string;
  periodStart: string;
  periodEnd: string;
  totalShared: number;
  quotaPerPartner: number;
  pendingExpensesCount: number;
  expenses: ExpenseDto[];
  membersBreakdown: MemberSettlementBreakdownDto[];
  transferInstruction: {
    fromUserId: string | null;
    fromUserName: string | null;
    toUserId: string | null;
    toUserName: string | null;
    amount: number;
    isEven: boolean;
  };
}

export const CreateSettlementDtoSchema = z.object({
  periodStart: z.string().min(1, 'Data inicial obrigatória'),
  periodEnd: z.string().min(1, 'Data final obrigatória'),
  notes: z.string().optional(),
});
export type CreateSettlementDto = z.infer<typeof CreateSettlementDtoSchema>;

export interface SettlementDto {
  id: string;
  householdId: string;
  periodStart: string;
  periodEnd: string;
  totalShared: number;
  breakdown: MemberSettlementBreakdownDto[];
  fromUserId: string | null;
  fromUser?: { id: string; name: string } | null;
  toUserId: string | null;
  toUser?: { id: string; name: string } | null;
  transferAmount: number;
  status: SettlementStatus;
  closedByUserId: string;
  closedBy?: { id: string; name: string } | null;
  settledAt?: string | null;
  notes?: string | null;
  expensesCount?: number;
  createdAt: string;
}

export interface ExpenseAnalyticsDto {
  periodLabel: string;
  totalExpenses: number;
  previousPeriodTotal: number;
  variationPercent: number;
  byCategory: Array<{
    category: ExpenseCategory;
    total: number;
    count: number;
    percentage: number;
  }>;
  monthlyEvolution: Array<{
    month: string;
    total: number;
    sharedTotal: number;
    privateTotal: number;
  }>;
  topOffenders: ExpenseDto[];
}

// -----------------------------------------------------------------------------
// Goal DTOs
// -----------------------------------------------------------------------------
export const CreateGoalDtoSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  targetAmount: z.number().positive('Meta deve ser maior que zero'),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.string().optional(),
  scope: z.nativeEnum(RecordScope).default(RecordScope.SHARED),
});
export type CreateGoalDto = z.infer<typeof CreateGoalDtoSchema>;

export const UpdateGoalProgressDtoSchema = z.object({
  amountToAdd: z.number(),
});
export type UpdateGoalProgressDto = z.infer<typeof UpdateGoalProgressDtoSchema>;

export const UpdateGoalDtoSchema = CreateGoalDtoSchema.partial().extend({
  status: z.nativeEnum(GoalStatus).optional(),
});
export type UpdateGoalDto = z.infer<typeof UpdateGoalDtoSchema>;

export interface GoalDto {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  status: GoalStatus;
  scope: RecordScope;
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Task / Reminder DTOs
// -----------------------------------------------------------------------------
export const CreateTaskDtoSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  dueDate: z.string().optional(),
  hasSpecificTime: z.boolean().optional(),
  scope: z.nativeEnum(RecordScope).default(RecordScope.SHARED),
});
export type CreateTaskDto = z.infer<typeof CreateTaskDtoSchema>;

export const UpdateTaskDtoSchema = CreateTaskDtoSchema.partial().extend({
  isCompleted: z.boolean().optional(),
});
export type UpdateTaskDto = z.infer<typeof UpdateTaskDtoSchema>;

export interface TaskDto {
  id: string;
  title: string;
  dueDate: string | null;
  hasSpecificTime?: boolean;
  isCompleted: boolean;
  scope: RecordScope;
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Shopping List & Analytics DTOs (Task 10)
// -----------------------------------------------------------------------------
export const CreateShoppingItemDtoSchema = z.object({
  name: z.string().min(1, 'Nome do item obrigatório'),
  quantity: z.string().optional(),
  category: z.string().optional(),
  scope: z.nativeEnum(RecordScope).default(RecordScope.SHARED),
});
export type CreateShoppingItemDto = z.infer<typeof CreateShoppingItemDtoSchema>;

export const UpdateShoppingItemDtoSchema = CreateShoppingItemDtoSchema.partial().extend({
  isCompleted: z.boolean().optional(),
});
export type UpdateShoppingItemDto = z.infer<typeof UpdateShoppingItemDtoSchema>;

export interface ShoppingItemDto {
  id: string;
  name: string;
  normalizedName?: string | null;
  quantity: string | null;
  category: string | null;
  isCompleted: boolean;
  scope: RecordScope;
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopShoppingItemDto {
  normalizedName: string;
  displayName: string;
  category: string;
  purchaseCount: number;
  completedCount: number;
  lastAddedAt: string;
  frequencyLabel?: string;
  isCurrentlyInList: boolean;
}

// -----------------------------------------------------------------------------
// Calendar / Event DTOs
// -----------------------------------------------------------------------------
export const CreateCalendarEventDtoSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Data de início obrigatória'),
  endDate: z.string().optional(),
  isAllDay: z.boolean().default(false),
  location: z.string().optional(),
  googleCalendarId: z.string().optional(),
  color: z.string().optional(),
  colorId: z.string().optional(),
  scope: z.nativeEnum(RecordScope).default(RecordScope.SHARED),
  attendees: z.string().optional(),
  createMeetLink: z.boolean().optional(),
});
export type CreateCalendarEventDto = z.infer<typeof CreateCalendarEventDtoSchema>;

export const UpdateCalendarEventDtoSchema = CreateCalendarEventDtoSchema.partial();
export type UpdateCalendarEventDto = z.infer<typeof UpdateCalendarEventDtoSchema>;

export interface CalendarEventDto {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isAllDay: boolean;
  location: string | null;
  googleEventId: string | null;
  googleCalendarId: string | null;
  color: string | null;
  colorId: string | null;
  etag: string | null;
  scope: RecordScope;
  attendees: string | null;
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleCalendarItemDto {
  id: string;
  name: string;
  description?: string | null;
  isPrimary: boolean;
  accessRole: string;
  colors: {
    background: string;
    foreground: string;
  };
  selected?: boolean;
}

// -----------------------------------------------------------------------------
// Workouts & Fitness Integration DTOs (Task 11)
// -----------------------------------------------------------------------------
export interface StrengthExerciseDto {
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
}

export interface RunningWorkoutStepDto {
  phase: 'WARMUP' | 'MAIN' | 'INTERVAL' | 'RECOVERY' | 'COOLDOWN';
  phaseLabel: string;
  durationOrDistance: string;
  targetPace?: string;
  targetHeartRateZone?: string;
  notes?: string;
}

export interface RunningSplitDto {
  km: number;
  pace: string;
  heartRate?: number;
  elevationM?: number;
}

export const CreateWorkoutDtoSchema = z.object({
  modality: z.nativeEnum(WorkoutModality),
  provider: z.nativeEnum(FitnessProvider).default(FitnessProvider.MANUAL),
  status: z.nativeEnum(WorkoutStatus).optional(),
  workoutType: z.string().optional(),
  targetPace: z.string().optional(),
  targetHrZone: z.string().optional(),
  averageHeartRate: z.number().optional(),
  maxHeartRate: z.number().optional(),
  cadenceSpm: z.number().optional(),
  externalId: z.string().optional(),
  title: z.string().min(1, 'Título do treino obrigatório'),
  notes: z.string().optional(),
  startedAt: z.string().optional(),
  durationMinutes: z.number().positive('Duração deve ser maior que zero'),
  calories: z.number().optional(),
  distanceKm: z.number().optional(),
  paceSecondsPerKm: z.number().optional(),
  elevationGainM: z.number().optional(),
  totalVolumeKg: z.number().optional(),
  setsCount: z.number().optional(),
  exercisesJson: z.array(
    z.object({
      name: z.string(),
      sets: z.number(),
      reps: z.number(),
      weightKg: z.number(),
    }),
  ).optional(),
  runningSteps: z.array(
    z.object({
      phase: z.enum(['WARMUP', 'MAIN', 'INTERVAL', 'RECOVERY', 'COOLDOWN']),
      phaseLabel: z.string(),
      durationOrDistance: z.string(),
      targetPace: z.string().optional(),
      targetHeartRateZone: z.string().optional(),
      notes: z.string().optional(),
    }),
  ).optional(),
  splits: z.array(
    z.object({
      km: z.number(),
      pace: z.string(),
      heartRate: z.number().optional(),
      elevationM: z.number().optional(),
    }),
  ).optional(),
  scope: z.nativeEnum(RecordScope).default(RecordScope.SHARED),
});
export type CreateWorkoutDto = z.infer<typeof CreateWorkoutDtoSchema>;

export interface ConnectFitnessProviderDto {
  provider: FitnessProvider;
  authCode?: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  athleteId?: string;
  garminCalendarUrl?: string;
  garminEmail?: string;
}

export interface WorkoutActivityDto {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  householdId: string | null;
  modality: WorkoutModality;
  provider: FitnessProvider;
  status: WorkoutStatus;
  workoutType?: string | null;
  targetPace?: string | null;
  targetHrZone?: string | null;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  cadenceSpm?: number | null;
  externalId?: string | null;
  title: string;
  notes?: string | null;
  startedAt: string;
  durationMinutes: number;
  calories?: number | null;
  distanceKm?: number | null;
  paceSecondsPerKm?: number | null;
  elevationGainM?: number | null;
  totalVolumeKg?: number | null;
  setsCount?: number | null;
  exercisesJson?: StrengthExerciseDto[] | null;
  runningSteps?: RunningWorkoutStepDto[] | null;
  splits?: RunningSplitDto[] | null;
  scope: RecordScope;
  createdAt: string;
}

export interface FitnessIntegrationDto {
  id: string;
  provider: FitnessProvider;
  athleteId?: string | null;
  calendarUrl?: string | null;
  isActive: boolean;
  lastSyncedAt?: string | null;
}

// -----------------------------------------------------------------------------
// AI Parser DTOs
// -----------------------------------------------------------------------------
export interface ParsedWhatsAppResultDto {
  intent: AIIntent;
  confidence: number;
  data: {
    title: string;
    amount?: number;
    transactionType?: TransactionType;
    category?: ExpenseCategory;
    scope: RecordScope;
    dueDate?: string;
    hasSpecificTime?: boolean;
    notes?: string;
    items?: Array<{ name: string; quantity?: string; category?: string }>;
    startDate?: string;
    endDate?: string;
    isAllDay?: boolean;
    location?: string;
    queryPeriod?: 'today' | 'tomorrow' | 'week' | 'specific_date';
  };
}
