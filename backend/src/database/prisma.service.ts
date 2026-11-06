import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createInMemoryPrismaStore } from './in-memory-prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public isUsingInMemoryFallback = false;

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conectado ao banco de dados PostgreSQL com sucesso.');
    } catch (err: any) {
      this.logger.warn(
        `Banco de dados PostgreSQL inacessível (${err?.message || err}). Ativando store relacional em memória para execução local/E2E.`,
      );
      this.enableInMemoryFallback();
    }
  }

  private enableInMemoryFallback() {
    this.isUsingInMemoryFallback = true;
    const store = createInMemoryPrismaStore();
    for (const [modelName, delegate] of Object.entries(store.delegates)) {
      Object.defineProperty(this, modelName, {
        value: delegate,
        writable: true,
        configurable: true,
      });
    }
    Object.defineProperty(this, '$transaction', {
      value: store.$transaction.bind(store),
      writable: true,
      configurable: true,
    });
  }

  async onModuleDestroy() {
    if (!this.isUsingInMemoryFallback) {
      await this.$disconnect();
    }
  }
}
