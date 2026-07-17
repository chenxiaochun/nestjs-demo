import { Injectable, NotFoundException } from '@nestjs/common';

type User = {
  name: string;
  age: number;
  email: string;
  phone: string;
};

@Injectable()
export class UserService {
  private readonly users = new Map<string, User>([
    [
      '001',
      {
        name: '张三',
        age: 18,
        email: 'zhangsan@gmail.com',
        phone: '1234567890',
      },
    ],
    [
      '002',
      {
        name: '李四',
        age: 20,
        email: 'lisi@gmail.com',
        phone: '1234567890',
      },
    ],
    [
      '003',
      {
        name: '王五',
        age: 22,
        email: 'wangwu@gmail.com',
        phone: '1234567890',
      },
    ],
    [
      '004',
      {
        name: '赵六',
        age: 24,
        email: 'zhaoliu@gmail.com',
        phone: '1234567890',
      },
    ],
  ]);

  findAll(): User[] {
    return Array.from(this.users.values());
  }

  findOne(id: string) {
    return this.users.get(id);
  }

  update(id: string, partial: Omit<User, 'id'>) {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.users.set(id, { ...user, ...partial });
    return this.users.get(id);
  }

  remove(id: string) {
    return this.users.delete(id);
  }
}
