import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  
    @Get('health')
  getHealth() {
    return {
      status: 'ok',
      message: 'Secret Stroke Server is ready',
      timestamp: new Date().toISOString(),
    };
  }
}
