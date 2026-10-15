import { z } from 'zod';
import { RecordScope, ExpenseCategory, GoalStatus, AIIntent } from './enums';

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
  googleAccessToken: z.string().optional(),
  sharePrivateExpenses: z.boolean().optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileDtoSchema>;

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    phoneNumber: string | null;
    householdId: string | null;
    avatarUrl?: string | null;
    googleAccessToken?: string | null;
    sharePrivateExpenses?: boolean;
  };
}

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
// Expense DTOs
// -----------------------------------------------------------------------------
export const CreateExpenseDtoSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.number().positive('O valor deve ser maior que zero'),
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.OTHER),
  scope: z.nativeEnum(RecordScope).default(RecordScope.PRIVATE),
  date: z.string().optional(), // ISO date string
  rawSource: z.string().optional(),
});
export type CreateExpenseDto = z.infer<typeof CreateExpenseDtoSchema>;

export const UpdateExpenseDtoSchema = CreateExpenseDtoSchema.partial();
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseDtoSchema>;

export interface ExpenseDto {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  scope: RecordScope;
  rawSource: string | null;
  userId: string;
  householdId: string | null;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesSummaryDto {
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
  isCompleted: boolean;
  scope: RecordScope;
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
}


// -----------------------------------------------------------------------------
// Shopping List DTOs
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
  quantity: string | null;
  category: string | null;
  isCompleted: boolean;
  scope: RecordScope;
  userId: string;
  householdId: string | null;
  createdAt: string;
  updatedAt: string;
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
  attendees: z.string().optional(), // lista ou JSON de emails/convidados
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
// AI Parser DTOs
// -----------------------------------------------------------------------------
export interface ParsedWhatsAppResultDto {
  intent: AIIntent;
  confidence: number;
  data: {
    title: string;
    amount?: number;
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
