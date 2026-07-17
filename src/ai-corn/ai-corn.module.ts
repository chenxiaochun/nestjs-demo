import { Module } from '@nestjs/common';
import { AiCornService } from './ai-corn.service';
import { AiCornController } from './ai-corn.controller';
import { AiModule } from 'src/ai/ai.module';
import { UserService } from 'src/user/user.service';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { UserModule } from 'src/user/user.module';
@Module({
  imports: [AiModule, UserModule],
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
          async ({ userId }: { userId: string }) => {
            const user = userService.findOne(userId);
            if (!user) {
              return '用户不存在';
            }
            return user;
          },
          {
            name: 'queryUser',
            description: '查询用户信息',
            schema: queryUserArgsSchema,
          },
        );
      },
      inject: [UserService],
    },
  ],
})
export class AiCornModule {}
