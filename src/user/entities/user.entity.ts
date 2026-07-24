import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  // 必须显式声明 type：string | undefined 的反射类型是 Object，MySQL 不支持
  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  email!: string;

  // bcrypt 哈希固定约 60 字符，length:50 会被 MySQL 截断/写空导致无法登录
  @Column({ type: 'varchar', length: 100 })
  password!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
