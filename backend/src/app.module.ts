import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { CodeFile } from './models/code-file.model';
import { CodeController } from './controllers/code.controller';
import { CodeService } from './services/code.service';
import { CodeGateway } from './gateways/code.gateway';
import { CleanupService } from './services/cleanup.service';

@Module({
  imports: [
    SequelizeModule.forRoot(
      process.env.DATABASE_URL
        ? {
            dialect: 'postgres',
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
            dialect: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'livecoding',
            models: [CodeFile],
            autoLoadModels: true,
            synchronize: true,
          }
    ),
    SequelizeModule.forFeature([CodeFile]),
    ScheduleModule.forRoot(),
  ],
  controllers: [CodeController],
  providers: [CodeService, CodeGateway, CleanupService],
})
export class AppModule {}