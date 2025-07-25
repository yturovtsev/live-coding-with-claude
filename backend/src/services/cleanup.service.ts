import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CodeService } from './code.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private codeService: CodeService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredFiles() {
    this.logger.log('Running cleanup task for expired files');
    try {
      const deletedCount = await this.codeService.deleteExpiredFiles();
      this.logger.log(`Cleaned up ${deletedCount} expired files`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired files', error);
    }
  }
}