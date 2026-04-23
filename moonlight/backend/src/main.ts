import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import * as dotenv from 'dotenv';
import compression from 'compression';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // gzip: large JSON responses (insights, heatmap, history, leaderboard)
  // see ~50-70% size reduction in typical payloads.
  app.use(
    compression({
      threshold: 1024,
      level: 6,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // leave false: legacy clients pass extra fields
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors();
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env.PORT || 8001;
  await app.listen(port);

  // Graceful shutdown wiring — run a best-effort soft stop on SIGTERM/SIGINT.
  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully…`);
    try {
      await app.close();
      logger.warn('HTTP + Nest context closed, exiting (0)');
      process.exit(0);
    } catch (err) {
      logger.error(`Graceful shutdown failed: ${String(err)}`);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.log(`[MoonLight Backend] Server running on port ${port}`);
  logger.log(`[MoonLight Backend] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`[MoonLight Backend] Timezone: ${process.env.TZ || 'UTC'}`);
  logger.log(
    `[MoonLight Backend] MoonLight Environment: ${process.env.MOONLIGHT_ENVIRONMENT || 'SANDBOX'}`,
  );
  logger.log(
    `[MoonLight Backend] Hardware Profile: ${process.env.HARDWARE_PROFILE || 'SAFE'}`,
  );
}

bootstrap();
