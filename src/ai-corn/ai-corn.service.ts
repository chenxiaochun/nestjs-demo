import { Inject, Injectable } from '@nestjs/common';
import { CreateAiCornDto } from './dto/create-ai-corn.dto';
import { UpdateAiCornDto } from './dto/update-ai-corn.dto';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import {
  AIMessage,
  ToolMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { Runnable } from '@langchain/core/runnables';

const database = {
  users: {
    '001': {
      id: '001',
      name: '张三',
      email: 'zhangsan@example.com',
      role: 'admin',
    },
    '002': {
      id: '002',
      name: '李四',
      email: 'lisi@example.com',
      role: 'user',
    },
    '003': {
      id: '003',
      name: '王五',
      email: 'wangwu@example.com',
      role: 'user',
    },
  },
};

const queryUserArgsSchema = z.object({
  userId: z.string().describe('用户ID'),
});

type QueryUserArgs = {
  userId: string;
};

const queryUserTool = tool(
  async ({ userId }: QueryUserArgs) => {
    const user = database.users[userId];
    if (!user) {
      return `用户不存在: ${userId}`;
    }
    // ToolMessage.content 必须是 string，不能直接传对象
    return JSON.stringify(user);
  },
  {
    name: 'queryUser',
    description: '查询用户信息',
    schema: queryUserArgsSchema,
  },
);

@Injectable()
export class AiCornService {
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(@Inject('CHAT_MODEL') private chatModel: ChatOpenAI) {
    this.modelWithTools = this.chatModel.bindTools([queryUserTool]);
  }

  async runChain(query: string) {
    const messages: BaseMessage[] = [
      new SystemMessage('你是一个助手，负责查询用户信息'),
      new HumanMessage(query),
    ];

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      if (!aiMessage.tool_calls?.length) {
        return aiMessage.content;
      }

      for (const toolCall of aiMessage.tool_calls) {
        const toolCallId = toolCall.id;
        const toolName = toolCall.name;

        if (toolName === 'queryUser') {
          const args = queryUserArgsSchema.parse(toolCall.args);
          const result = await queryUserTool.invoke({ userId: args.userId });
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId || '',
              name: toolName,
              content: typeof result === 'string' ? result : JSON.stringify(result),
            }),
          );
        }
      }
    }
  }

  create(createAiCornDto: CreateAiCornDto) {
    return 'This action adds a new aiCorn';
  }

  findAll() {
    return `This action returns all aiCorn`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiCorn`;
  }

  update(id: number, updateAiCornDto: UpdateAiCornDto) {
    return `This action updates a #${id} aiCorn`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiCorn`;
  }
}
