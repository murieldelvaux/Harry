import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('HarryBootstrap');
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Necessário para validação HMAC do webhook WhatsApp
  });

  const allowedOriginsEnv = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (apps mobile nativos, curl, webhooks)
      if (!origin) {
        return callback(null, true);
      }

      // Se houver domínios especificados em CORS_ORIGINS, valida a correspondência
      if (allowedOriginsEnv.length > 0) {
        const isAllowed = allowedOriginsEnv.some((allowed) =>
          allowed === '*' || allowed === origin || origin.startsWith(allowed),
        );
        if (isAllowed) {
          return callback(null, true);
        }
      }

      // Permite e reflete dinamicamente a origin que fez a requisição
      return callback(null, true);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'x-hub-signature-256',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Disposition'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Harry Backend API running on http://localhost:${port}/api/v1`);
}

bootstrap();
