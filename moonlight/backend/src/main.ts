import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import * as dotenv from 'dotenv';
import compression from 'compression';

dotenv.config();

// ---------------------------------------------------------------------------
// Top-level safety net: we NEVER want the backend to crash silently when
// running inside the packaged Electron spawn. Log loudly and let the
// Electron BackendManager decide whether to restart us.
// ---------------------------------------------------------------------------
const topLogger = new Logger('Process');
process.on('unhandledRejection', (reason) => {
  topLogger.error(
    `UnhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
  );
});
process.on('uncaughtException', (err) => {
  topLogger.error(`UncaughtException: ${err.stack || err.message}`);
  // Exit non-zero so the parent (Electron BackendManager) can react.
  process.exit(1);
});

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

bootstrap().catch((err) => {
  // Bootstrap itself failed (e.g. module DI error, port in use).
  // Print and exit 1 so the Electron BackendManager logs + retries.
  // eslint-disable-next-line no-console
  console.error('[bootstrap] FATAL:', err);
  process.exit(1);
});
