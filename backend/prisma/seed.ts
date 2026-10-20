import { PrismaClient } from '@prisma/client';
import { RecordScope, ExpenseCategory, GoalStatus } from '../../packages/shared/src';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for Nexo...');

  // Limpar tabelas existentes
  await prisma.expense.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  await prisma.household.deleteMany();

  // 1. Criar Household do casal
  const household = await prisma.household.create({
    data: {
      name: 'Nossa Casa',
      inviteCode: 'NEXO-2026',
    },
  });

  const passwordHash = await bcrypt.hash('123456', 10);

  // 2. Criar Usuário A (Muriel)
  const userA = await prisma.user.create({
    data: {
      email: 'muriel@harry.app',
      name: 'Muriel',
      passwordHash,
      phoneNumber: '+5511988881111',
      householdId: household.id,
    },
  });

  // 3. Criar Usuário B (Namorado)
  const userB = await prisma.user.create({
    data: {
      email: 'parceiro@harry.app',
      name: 'Lucas',
      passwordHash,
      phoneNumber: '+5511977772222',
      householdId: household.id,
    },
  });

  // 4. Criar Gastos de Exemplo
  await prisma.expense.createMany({
    data: [
      {
        description: 'Supermercado Semanal',
        amount: 342.80,
        category: ExpenseCategory.FOOD_MARKET,
        scope: RecordScope.SHARED,
        rawSource: 'whatsapp_message',
        userId: userA.id,
        householdId: household.id,
        date: new Date(),
      },
      {
        description: 'Internet Fibra 600MB',
        amount: 149.90,
        category: ExpenseCategory.UTILITIES,
        scope: RecordScope.SHARED,
        rawSource: 'manual_app',
        userId: userB.id,
        householdId: household.id,
        date: new Date(),
      },
      {
        description: 'Almoço Executivo',
        amount: 38.50,
        category: ExpenseCategory.RESTAURANT,
        scope: RecordScope.PRIVATE,
        rawSource: 'whatsapp_message',
        userId: userA.id,
        date: new Date(),
      },
      {
        description: 'Assinatura Spotify',
        amount: 21.90,
        category: ExpenseCategory.SUBSCRIPTIONS,
        scope: RecordScope.PRIVATE,
        rawSource: 'manual_app',
        userId: userB.id,
        date: new Date(),
      },
    ],
  });

  // 5. Criar Metas de Exemplo
  await prisma.goal.createMany({
    data: [
      {
        title: 'Viagem de Férias (Portugal)',
        targetAmount: 18000.00,
        currentAmount: 4500.00,
        status: GoalStatus.IN_PROGRESS,
        scope: RecordScope.SHARED,
        userId: userA.id,
        householdId: household.id,
        targetDate: new Date('2026-12-20'),
      },
      {
        title: 'Reserva de Emergência Individual',
        targetAmount: 10000.00,
        currentAmount: 7200.00,
        status: GoalStatus.IN_PROGRESS,
        scope: RecordScope.PRIVATE,
        userId: userA.id,
      },
    ],
  });

  // 6. Criar Lembretes de Rotina
  await prisma.task.createMany({
    data: [
      {
        title: 'Pagar taxa de condomínio',
        dueDate: new Date(Date.now() + 86400000 * 5),
        isCompleted: false,
        scope: RecordScope.SHARED,
        userId: userA.id,
        householdId: household.id,
      },
      {
        title: 'Comprar cápsulas de café',
        isCompleted: false,
        scope: RecordScope.SHARED,
        userId: userB.id,
        householdId: household.id,
      },
    ],
  });

  console.log('✅ Seed finalizado com sucesso!');
  console.log(`Household Invite Code: ${household.inviteCode}`);
  console.log(`Usuário 1: muriel@harry.app / 123456`);
  console.log(`Usuário 2: parceiro@harry.app / 123456`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
