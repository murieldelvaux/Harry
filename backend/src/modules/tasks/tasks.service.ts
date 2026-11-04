import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  RecordScope,
  NotificationType,
} from '../../../../packages/shared/src';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private realtimeService: RealtimeService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true },
    });

    const isShared = dto.scope === RecordScope.SHARED && !!user?.householdId;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const hasSpecificTime =
      dto.hasSpecificTime !== undefined
        ? dto.hasSpecificTime
        : dueDate
          ? !(dueDate.getHours() === 0 && dueDate.getMinutes() === 0)
          : false;

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        dueDate,
        hasSpecificTime,
        scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
        userId,
        householdId: isShared ? user?.householdId : null,
      },
    });

    this.realtimeService.emit({
      type: 'TASK_UPDATED',
      userId,
      householdId: task.householdId,
      data: task,
    });

    if (isShared && user?.householdId) {
      const dueLabel = dueDate
        ? ` para ${dueDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}`
        : '';

      await this.notificationsService.notifyHouseholdPartners({
        actorUserId: userId,
        householdId: user.householdId,
        type: NotificationType.SHARED_TASK_CREATED,
        title: '📌 Novo Lembrete Compartilhado',
        body: `${user.name || 'Seu par'} adicionou o lembrete "${task.title}"${dueLabel}.`,
        deepLink: '/(tabs)/tasks',
        metadata: { taskId: task.id },
      });
    }

    return this.mapTask(task);
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    const tasks = await this.prisma.task.findMany({
      where: user?.householdId
        ? {
            OR: [
              { userId, scope: RecordScope.PRIVATE },
              { householdId: user.householdId, scope: RecordScope.SHARED },
            ],
          }
        : { userId },
      orderBy: [{ isCompleted: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return tasks.map(this.mapTask);
  }

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Lembrete não encontrado');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    const updatedScope = dto.scope !== undefined ? dto.scope : task.scope;
    const isShared = updatedScope === RecordScope.SHARED && !!user?.householdId;

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          reminderSent: false,
        }),
        ...(dto.hasSpecificTime !== undefined && { hasSpecificTime: dto.hasSpecificTime }),
        ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
        ...(dto.scope !== undefined && {
          scope: isShared ? RecordScope.SHARED : RecordScope.PRIVATE,
          householdId: isShared ? user?.householdId : null,
        }),
      },
    });

    this.realtimeService.emit({
      type: 'TASK_UPDATED',
      userId,
      householdId: updated.householdId,
      data: updated,
    });

    return this.mapTask(updated);
  }

  async toggleComplete(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Lembrete não encontrado');

    const updated = await this.prisma.task.update({
      where: { id },
      data: { isCompleted: !task.isCompleted },
    });

    this.realtimeService.emit({
      type: 'TASK_UPDATED',
      userId: updated.userId,
      householdId: updated.householdId,
      data: updated,
    });

    return this.mapTask(updated);
  }

  async delete(id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    await this.prisma.task.delete({ where: { id } });
    if (existing) {
      this.realtimeService.emit({
        type: 'TASK_UPDATED',
        userId: existing.userId,
        householdId: existing.householdId,
      });
    }
    return { success: true };
  }

  private mapTask(task: any) {
    return {
      id: task.id,
      title: task.title,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      hasSpecificTime: task.hasSpecificTime,
      isCompleted: task.isCompleted,
      scope: task.scope,
      userId: task.userId,
      householdId: task.householdId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
