import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { CodeFile } from './models/code-file.model';
import { CodeController } from './controllers/code.controller';
import { HealthController } from './controllers/health.controller';
import { CodeService } from './services/code.service';
import { CodeGateway } from './gateways/code.gateway';
import { CleanupService } from './services/cleanup.service';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      useFactory: () => {
        console.log('🔍 Checking environment variables...');
        console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
        console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
        console.log('All env vars:', process.env);

        const config = process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0
          ? {
              dialect: 'postgres' as const,
              uri: process.env.DATABASE_URL,
              models: [CodeFile],
              autoLoadModels: true,
              synchronize: true,
              dialectOptions: {
                ssl: {
                  require: true,
                  rejectUnauthorized: false,
                },
              },
            }
          : {
              dialect: 'postgres' as const,
              host: process.env.DB_HOST || 'localhost',
              port: parseInt(process.env.DB_PORT || '5432'),
              username: process.env.DB_USERNAME || 'postgres',
              password: process.env.DB_PASSWORD || 'password',
              database: process.env.DB_NAME || 'livecoding',
              models: [CodeFile],
              autoLoadModels: true,
              synchronize: true,
            };

        console.log('🗄️ Database config:', {
          dialect: config.dialect,
          host: 'host' in config ? config.host : 'from URI',
          database: 'database' in config ? config.database : 'from URI'
        });

        return config;
      },
    }),
    SequelizeModule.forFeature([CodeFile]),
    ScheduleModule.forRoot(),
  ],
  controllers: [CodeController, HealthController],
  providers: [CodeService, CodeGateway, CleanupService],
})
export class AppModule {}
