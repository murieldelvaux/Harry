import { Controller, Get, Query } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './database/prisma.service';
import { WhatsappService } from './modules/whatsapp/whatsapp.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'Nexo Backend API',
      version: '1.0.3',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('debug/whatsapp')
  async getWhatsappDebug(@Query('testPhone') testPhone?: string) {
    let testResult: any = null;
    if (testPhone) {
      try {
        await this.whatsappService.sendWhatsAppMessage(testPhone, '🧪 Mensagem de teste Nexo WhatsApp!');
        testResult = { success: true, message: `Disparado para ${testPhone}` };
      } catch (e: any) {
        testResult = { success: false, error: e?.message };
      }
    }

    const latestShopping = await this.prisma.shoppingItem.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, phoneNumber: true } } },
    });

    const latestEvents = await this.prisma.processedWebhookEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, email: true, phoneNumber: true },
    });

    return {
      version: '1.0.3',
      timestamp: new Date().toISOString(),
      logs: this.whatsappService.logs,
      testResult,
      latestShopping,
      latestEvents,
      users,
    };
  }
}
