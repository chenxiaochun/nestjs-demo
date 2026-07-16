import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('cxc')
  getCxc(): any {
    return {
      name: 'cxc',
      age: 18,
      email: 'cxc@gmail.com',
      phone: '1234567890',
      address: '1234567890',
      city: '1234567890',
      state: '1234567890',
      zip: '1234567890',
      country: '1234567890',
    };
  }
}
