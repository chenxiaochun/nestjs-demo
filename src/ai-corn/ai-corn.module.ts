import { Module } from '@nestjs/common';
import { AiCornService } from './ai-corn.service';
import { AiCornController } from './ai-corn.controller';
import { AiModule } from 'src/ai/ai.module';
import { UserService } from 'src/user/user.service';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { UserModule } from 'src/user/user.module';
import { JobModule } from 'src/job/job.module';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [AiModule, UserModule, JobModule, ToolModule],
  controllers: [AiCornController],
  providers: [
    AiCornService,
    {
      provide: 'QUERY_USER_TOOL',
      useFactory: (userService: UserService) => {
        const queryUserArgsSchema = z.object({
          userId: z.string().describe('用户ID'),
        });

        return tool(
          async ({ userId }: { userId: number }) => {
            const user = userService.findOne(userId);
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
      },
      inject: [UserService],
    },
  ],
})
export class AiCornModule {}
