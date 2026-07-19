import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User as UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  @Inject(EntityManager)
  private readonly entityManager!: EntityManager;

  create(createUserDto: CreateUserDto) {
    const user = this.entityManager.create(UserEntity, createUserDto);
    return this.entityManager.save(user);
  }

  findAll() {
    return this.entityManager.find(UserEntity);
  }

  findOne(id: number) {
    return this.entityManager.findOne(UserEntity, { where: { id } });
  }

  update(id: number, partial: Omit<UserEntity, 'id'>) {
    const user = this.entityManager.findOne(UserEntity, { where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.entityManager.update(UserEntity, { id }, partial);
    return this.entityManager.findOne(UserEntity, { where: { id } });
  }

  remove(id: number) {
    return this.entityManager.delete(UserEntity, { id });
  }
}
