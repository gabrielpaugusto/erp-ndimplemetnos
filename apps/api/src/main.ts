import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // B3 — CERT_ENCRYPTION_KEY must be set before API accepts traffic
  if (!process.env.CERT_ENCRYPTION_KEY) {
    logger.warn(
      'CERT_ENCRYPTION_KEY não configurada — operações com certificado digital estarão indisponíveis.',
    );
  }

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port);
  logger.log(`ERP API rodando em http://localhost:${port}/api`);
}
bootstrap();
