import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import {
  CreateHouseholdDto,
  JoinHouseholdDto,
  UpdateHouseholdDto,
} from '../../../../packages/shared/src';

@Injectable()
export class HouseholdService {
  constructor(
    private prisma: PrismaService,
    private realtimeService: RealtimeService,
  ) {}

  async create(userId: string, dto: CreateHouseholdDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const inviteCode = 'HARRY-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const household = await this.prisma.household.create({
      data: {
        name: dto.name || 'Nossa Casa',
        inviteCode,
        members: {
          connect: { id: userId },
        },
      },
      include: {
        members: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true, sharePrivateExpenses: true },
        },
      },
    });

    return household;
  }

  async join(userId: string, dto: JoinHouseholdDto) {
    const household = await this.prisma.household.findUnique({
      where: { inviteCode: dto.inviteCode.trim().toUpperCase() },
      include: { members: true },
    });

    if (!household) {
      throw new NotFoundException('Espaço não encontrado com este código');
    }

    if (household.members.length >= 2) {
      // No MVP o casal é limitado a 2 membros
      const isAlreadyMember = household.members.some((m: any) => m.id === userId);
      if (!isAlreadyMember) {
        throw new BadRequestException('Este espaço já possui 2 membros cadastrados');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { householdId: household.id },
    });

    return this.getHousehold(userId);
  }

  async getHousehold(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        household: {
          include: {
            members: {
              select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true, sharePrivateExpenses: true },
            },
          },
        },
      },
    });

    if (!user?.household) {
      return null;
    }

    if (user.googleAccessToken && user.household.googleAccessToken !== user.googleAccessToken) {
      await this.prisma.household.update({
        where: { id: user.household.id },
        data: { googleAccessToken: user.googleAccessToken },
      });
      user.household.googleAccessToken = user.googleAccessToken;
    }

    return user.household;
  }

  async update(userId: string, dto: UpdateHouseholdDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.householdId) {
      throw new NotFoundException('Você não pertence a nenhum espaço compartilhado');
    }

    const updated = await this.prisma.household.update({
      where: { id: user.householdId },
      data: {
        name: dto.name.trim(),
      },
      include: {
        members: {
          select: { id: true, name: true, email: true, phoneNumber: true, avatarUrl: true, sharePrivateExpenses: true },
        },
      },
    });

    this.realtimeService.emit({
      type: 'REFETCH',
      householdId: user.householdId,
      data: { action: 'HOUSEHOLD_UPDATED', household: updated },
    });

    return updated;
  }

  async delete(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.householdId) {
      throw new NotFoundException('Você não pertence a nenhum espaço compartilhado');
    }

    const householdId = user.householdId;

    // Notificar membros via realtime antes da exclusão
    this.realtimeService.emit({
      type: 'REFETCH',
      householdId,
      data: { action: 'HOUSEHOLD_DELETED' },
    });

    // Desconecta todos os membros do espaço
    await this.prisma.user.updateMany({
      where: { householdId },
      data: { householdId: null },
    });

    // Exclui o espaço e dados em cascata
    await this.prisma.household.delete({
      where: { id: householdId },
    });

    return { success: true, message: 'Espaço compartilhado excluído com sucesso' };
  }

  async leave(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.householdId) {
      throw new NotFoundException('Você não pertence a nenhum espaço compartilhado');
    }

    const householdId = user.householdId;

    // Desconecta o usuário do espaço
    await this.prisma.user.update({
      where: { id: userId },
      data: { householdId: null },
    });

    // Notifica os outros membros do espaço
    this.realtimeService.emit({
      type: 'REFETCH',
      householdId,
      userId,
      data: { action: 'MEMBER_LEFT', memberId: userId },
    });

    // Se não restou ninguém no espaço, exclui o espaço
    const remainingMembers = await this.prisma.user.count({
      where: { householdId },
    });

    if (remainingMembers === 0) {
      await this.prisma.household.delete({
        where: { id: householdId },
      });
    }

    return { success: true, message: 'Você saiu do espaço compartilhado' };
  }
}
