import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import { randomUUID } from 'crypto';

// Полифилл для crypto.randomUUID
if (!globalThis.crypto) {
  globalThis.crypto = { randomUUID } as any;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') ||
             (process.env.NODE_ENV === 'production' ?
              process.env.FRONTEND_URL :
              ['http://localhost:3001', 'http://127.0.0.1:3001']),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  const port = process.env.PORT || 3000;
  console.log(`🚀 Server starting on port: ${port}`);
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS origins: ${process.env.ALLOWED_ORIGINS || 'default'}`);

  await app.listen(port);
}
bootstrap();
