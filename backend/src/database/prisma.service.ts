import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conectado ao banco de dados com sucesso.');
    } catch (err: any) {
      this.logger.warn(`Banco de dados offline ou inacessível (${err?.message || err}). O servidor continuará em modo de espera.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

