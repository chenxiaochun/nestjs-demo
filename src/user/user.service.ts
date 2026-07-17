import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  getUsers(): any {
    return {
      name: 'cxc',
      age: 20,
      email: 'cxc@gmail.com',
      phone: '1234567890',
    };
  }
}
