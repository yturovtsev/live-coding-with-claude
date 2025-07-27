import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return { 
      status: 'ok', 
      service: 'live-coding-backend',
      timestamp: new Date().toISOString() 
    };
  }

  @Get('health')
  health() {
    return { 
      status: 'healthy', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString() 
    };
  }
}