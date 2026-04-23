import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors();

  // Global /api prefix so backend routes line up with the standard
  // Kubernetes ingress (which forwards /api/* to this service).
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 8001;
  await app.listen(port);

  console.log(`[MoonLight Backend] Server running on port ${port}`);
  console.log(`[MoonLight Backend] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[MoonLight Backend] Timezone: ${process.env.TZ || 'UTC'}`);
  console.log(`[MoonLight Backend] MoonLight Environment: ${process.env.MOONLIGHT_ENVIRONMENT || 'SANDBOX'}`);
  console.log(`[MoonLight Backend] Hardware Profile: ${process.env.HARDWARE_PROFILE || 'SAFE'}`);
}

bootstrap();
