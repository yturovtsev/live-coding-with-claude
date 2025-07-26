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
      origin: process.env.NODE_ENV === 'production' ? 
        ['http://localhost', 'http://localhost:80'] : 
        ['http://localhost:3001', 'http://localhost', 'http://localhost:80'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();