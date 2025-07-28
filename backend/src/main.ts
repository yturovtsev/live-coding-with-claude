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
              [process.env.FRONTEND_URL, /https:\/\/.*\.railway\.app$/] :
              ['http://localhost:3001', 'http://127.0.0.1:3001']),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  const corsOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(url => url.trim().replace(/\/$/, '')) ||
                   (process.env.NODE_ENV === 'production' ?
                    [process.env.FRONTEND_URL?.replace(/\/$/, ''), /https:\/\/.*\.railway\.app$/].filter(Boolean) :
                    ['http://localhost:3001', 'http://127.0.0.1:3001']);

  const port = process.env.PORT || 3000;
  console.log(`🚀 Server starting on port: ${port}`);
  console.log(`📦 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🌐 ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || 'NOT SET'}`);
  console.log(`🌐 FRONTEND_URL: ${process.env.FRONTEND_URL || 'NOT SET'}`);
  console.log(`🌐 Actual CORS origins:`, corsOrigins);
  console.log(`🗄️ DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`);
  console.log(`🗄️ DB_HOST: ${process.env.DB_HOST || 'default (localhost)'}`);

  await app.listen(port, '0.0.0.0');
  console.log(`✅ Application is running on: 0.0.0.0:${port}`);
  console.log(`🔍 Available routes:`);
  console.log(`   GET  / - Health check`);
  console.log(`   GET  /health - Detailed health`);
  console.log(`   POST /api/code - Create room`);
  console.log(`   GET  /api/code/:id - Get room`);
}
bootstrap();
