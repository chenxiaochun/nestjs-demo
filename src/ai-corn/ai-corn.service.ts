import { Inject, Injectable } from '@nestjs/common';
import { CreateAiCornDto } from './dto/create-ai-corn.dto';
import { UpdateAiCornDto } from './dto/update-ai-corn.dto';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { Runnable } from '@langchain/core/runnables';
import { Tool } from '@langchain/core/tools';

const queryUserArgsSchema = z.object({
  userId: z.string().describe('用户ID'),
});

const SYSTEM_PROMPT = [
  '你是一个助手，可以查询用户信息、发送邮件，以及搜索互联网信息。',
  '可用工具：',
  '1. queryUser：按用户ID（如 001/002）查询系统内用户详情。',
  '2. sendMail：发送邮件。',
  '   - 发用户资料：传 to、subject、userId（userId 必须是系统用户ID，不是邮箱）。',
  '   - 发任意内容（如搜索结果）：传 to、subject，以及完整的 html 或 text，不要传 userId。',
  '3. web_search：搜索互联网上的最新信息。',
  '规则：',
  '1. 需要系统用户详情时先调用 queryUser。',
  '2. “搜索并整理成 HTML 发到邮箱”必须分两轮：',
  '   第一轮只调用 web_search；',
  '   第二轮根据搜索结果生成完整 HTML，再调用 sendMail(to, subject, html)。',
  '3. 严禁在同一轮同时调用 web_search 和 sendMail。',
  '4. sendMail 的 html 必须包含真实搜索内容（标题、链接、摘要），禁止空正文或只有一句话说明。',
  '5. 收件人邮箱 ≠ 用户ID；不要把邮箱当成 userId。',
  '6. 涉及新闻、实时信息时必须使用 web_search，不要凭空编造。',
].join('\n');

@Injectable()
export class AiCornService {
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(
    @Inject('CHAT_MODEL') private chatModel: ChatOpenAI,
    @Inject('QUERY_USER_TOOL') private queryUserTool: Tool,
    @Inject('SEND_MAIL_TOOL') private sendMailTool: Tool,
    @Inject('WEB_SEARCH_TOOL') private webSearchTool: Tool,
  ) {
    this.modelWithTools = this.chatModel.bindTools([
      this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
    ]);
  }

  private createMessages(query: string): BaseMessage[] {
    return [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(query)];
  }

  private toToolContent(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }
    if (result == null) {
      return '无结果';
    }
    return JSON.stringify(result);
  }

  /**
   * 执行本轮 tool_calls。
   * 若同轮同时出现 web_search + sendMail，则拒绝发信，迫使模型下一轮再发。
   */
  private async *handleToolCalls(
    toolCalls: NonNullable<AIMessage['tool_calls']>,
    messages: BaseMessage[],
  ): AsyncGenerator<string> {
    const hasWebSearch = toolCalls.some((call) => call.name === 'web_search');

    for (const toolCall of toolCalls) {
      const toolCallId = toolCall.id || '';
      const toolName = toolCall.name;

      yield `\n[进度] 正在执行 ${toolName}…\n`;

      // 同轮既搜索又发信：发信参数里还没有搜索结果，必须拒绝
      if (toolName === 'sendMail' && hasWebSearch) {
        const reject =
          '同一轮不能同时 web_search 和 sendMail。请先查看搜索结果，再单独调用 sendMail，并传入包含完整搜索内容的 html。本次未发送邮件。';
        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolName,
            content: reject,
          }),
        );
        yield `[进度] sendMail 已跳过（需等搜索结果后再发）\n`;
        continue;
      }

      let content = '';

      if (toolName === 'queryUser') {
        const args = queryUserArgsSchema.parse(toolCall.args);
        content = this.toToolContent(
          await this.queryUserTool.invoke({ userId: args.userId }),
        );
      } else if (toolName === 'sendMail') {
        const args = toolCall.args as {
          to?: string;
          subject?: string;
          html?: string;
          text?: string;
          userId?: string;
        };
        // 通用发信时正文太短，视为无效，避免空邮件
        if (
          !args.userId &&
          !(args.html && args.html.trim().length > 80) &&
          !(args.text && args.text.trim().length > 40)
        ) {
          content =
            '邮件未发送：html/text 内容过短或为空。请把完整搜索结果整理进 html 后再调用 sendMail。';
        } else {
          content = this.toToolContent(await this.sendMailTool.invoke(toolCall.args));
        }
      } else if (toolName === 'web_search') {
        content = this.toToolContent(
          await this.webSearchTool.invoke(toolCall.args),
        );
        // 把搜索结果推给前端流式展示
        yield `\n===== 搜索结果 =====\n${content}\n==================\n`;
      } else {
        content = `未知工具: ${toolName}`;
      }

      messages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: toolName,
          content,
        }),
      );

      yield `[进度] ${toolName} 完成\n`;
    }
  }

  async runChain(query: string) {
    const messages = this.createMessages(query);

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      if (!aiMessage.tool_calls?.length) {
        return aiMessage.content;
      }

      // 消费 generator，但不对外流式
      for await (const _ of this.handleToolCalls(aiMessage.tool_calls, messages)) {
        // no-op
      }
    }
  }

  async *runChainStream(query: string) {
    const messages = this.createMessages(query);

    while (true) {
      const stream = await this.modelWithTools.stream(messages);
      let fullAIMessage: AIMessageChunk | null = null;

      for await (const chunk of stream) {
        const messageChunk = chunk as AIMessageChunk;
        fullAIMessage = fullAIMessage
          ? fullAIMessage.concat(messageChunk)
          : messageChunk;

        const hasToolCallChunk = !!messageChunk.tool_call_chunks?.length;

        if (!hasToolCallChunk && messageChunk.content) {
          yield messageChunk.content;
        }
      }

      if (!fullAIMessage) {
        return;
      }

      messages.push(fullAIMessage);

      if (!fullAIMessage.tool_calls?.length) {
        return;
      }

      yield* this.handleToolCalls(fullAIMessage.tool_calls, messages);
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
