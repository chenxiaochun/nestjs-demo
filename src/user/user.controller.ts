import { Controller, Get } from '@nestjs/common';

@Controller('user')
export class UserController {
  @Get()
  getUsers(): any {
    return {
      name: 'cxc',
      age: 18,
      email: 'cxc@gmail.com',
      phone: '1234567890',
    };
  }
}
