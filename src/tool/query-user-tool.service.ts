import { Inject, Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { UserService } from 'src/user/user.service';

@Injectable()
export class QueryUserToolService {
  public tool;

  @Inject(UserService)
  private readonly userService!: UserService;

  constructor() {
    const queryUserArgsSchema = z.object({
      userId: z.string().describe('用户ID'),
    });

    this.tool = tool(
      async ({ userId }: { userId: number }) => {
        const user = this.userService.findOne(userId);
        if (!user) {
          return '用户不存在';
        }
        // ToolMessage.content 必须是 string
        return JSON.stringify({ id: userId, ...user });
      },
      {
        name: 'queryUser',
        description: '根据用户ID查询用户详细信息（姓名、年龄、邮箱、电话）',
        schema: queryUserArgsSchema,
      },
    );
  }
}
