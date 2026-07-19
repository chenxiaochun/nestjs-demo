import { UserService } from 'src/user/user.service';

import { Inject, Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class DbUserCrudService {
  public tool;

  @Inject(UserService)
  private readonly userService!: UserService;

  constructor() {
    const dbUserCrudArgsSchema = z.object({
      action: z
        .enum(['create', 'list', 'update', 'delete'])
        .describe('操作类型,create:创建用户,list:查询用户列表,update:更新用户,delete:删除用户'),
      id: z.number().optional().describe('用户ID,仅在update和delete时需要'),
      name: z.string().optional().describe('用户姓名,仅在create和update时需要'),
      email: z.string().optional().describe('用户邮箱,仅在create和update时需要'),
    });

    this.tool = tool(
      async ({ action, id, name, email }: z.infer<typeof dbUserCrudArgsSchema>) => {
        switch (action) {
          case 'create':
            if (!name || !email) {
              return '创建用户失败: 缺少姓名或邮箱';
            }
            const created = await this.userService.create({ name, email });
            if (created) {
              return `用户创建成功: ${created.id}，姓名: ${created.name}，邮箱: ${created.email}`;
            }
          case 'list':
            const users = await this.userService.findAll();
            if (users.length > 0) {
              return users
                .map((user) => `用户ID: ${user.id}，姓名: ${user.name}，邮箱: ${user.email}`)
                .join('\n');
            }
          case 'update':
            if (!id || !name || !email) {
              return '更新用户失败: 缺少用户ID或姓名或邮箱';
            }

            const user = await this.userService.findOne(id);
            const payload = {
              ...user,
              name,
              email,
            };

            const updated = await this.userService.update(id, payload as Omit<User, 'id'>);
            if (updated) {
              return `用户更新成功: ${updated.id}，姓名: ${updated.name}，邮箱: ${updated.email}`;
            }
            return '更新用户失败: 用户不存在';

          case 'delete':
            if (!id) {
              return '删除用户失败: 缺少用户ID';
            }
            const deleted = await this.userService.remove(id);
            if (deleted) {
              return `用户删除成功: ${id}`;
            }
            return '删除用户失败: 用户不存在';
        }
      },
      {
        name: 'dbUserCrud',
        description:
          '数据库用户操作工具,create:创建用户,list:查询用户列表,update:更新用户,delete:删除用户',
        schema: dbUserCrudArgsSchema,
      },
    );
  }
}
