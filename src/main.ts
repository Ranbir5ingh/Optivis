import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { ConfigService } from '@nestjs/config';
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsConfig = configService.get<{ allowedOrigins: string[]; isProd: boolean }>(
    'cors',
  );

  app.use(cookieParser());

app.enableCors({
  origin: (origin, callback) => {

    // Allow server-to-server / curl / mobile apps
    if (!origin) {
      return callback(null, true);
    }

    // ✅ Dashboard + Auth APIs (STRICT)
    if (corsConfig?.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ✅ Tracking SDK (PUBLIC)
    // Browser can call /v1/track, but WITHOUT credentials
    return callback(null, true);
  },

  // 🔐 CRITICAL: credentials are NOT sent cross-origin unless origin is trusted
  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-project-key',
    'x-session-id',
    'x-visitor-id',
  ],

  exposedHeaders: ['Set-Cookie'],
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

  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
