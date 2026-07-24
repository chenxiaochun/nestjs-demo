import { Tool } from '@langchain/core/tools';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  SystemMessage,
  HumanMessage,
  ToolMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';

const JOB_SYSTEM_PROMPT = [
  '你是定时任务执行助手。请完整执行用户指令，必要时调用工具。',
  '可用工具：',
  '1. sendMail：发送邮件。参数 to、subject，以及 html 或 text（正文必须有实质内容）。',
  '2. webSearch：搜索互联网信息。',
  '3. timeNow：获取当前服务器时间。',
  '规则：',
  '1. 若指令要求发邮件，必须调用 sendMail，且 to 使用指令中的邮箱。',
  '2. 笑话/提醒等内容可直接生成并放入 html/text，不必先搜索。',
  '3. 不要创建新的定时任务；不要调用不存在的工具。',
  '4. 任务完成后用一句话确认结果即可。',
].join('\n');

@Injectable()
export class JobAgentService {
  private readonly logger = new Logger(JobAgentService.name);
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;
  private readonly maxRounds = 6;

  constructor(
    @Inject('CHAT_MODEL_TOOL') private chatModel: ChatOpenAI,
    @Inject('SEND_MAIL_TOOL') private sendMailTool: Tool,
    @Inject('WEB_SEARCH_TOOL') private webSearchTool: Tool,
    @Inject('TIME_NOW_TOOL') private timeNowTool: Tool,
  ) {
    this.modelWithTools = this.chatModel.bindTools([
      this.sendMailTool,
      this.webSearchTool,
      this.timeNowTool,
    ]);
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

  private async invokeTool(toolName: string, args: unknown): Promise<string> {
    try {
      if (toolName === 'sendMail') {
        return this.toToolContent(await this.sendMailTool.invoke(args));
      }
      if (toolName === 'webSearch') {
        return this.toToolContent(await this.webSearchTool.invoke(args));
      }
      if (toolName === 'timeNow') {
        return this.toToolContent(await this.timeNowTool.invoke(args));
      }
      return `未知或不允许的工具: ${toolName}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`JobAgent tool failed: ${toolName}`, error);
      return `工具执行失败: ${message}`;
    }
  }

  /** 定时任务到点后执行 instruction（发邮件、搜索等） */
  async runJob(instruction: string) {
    this.logger.log(`JobAgent start: ${instruction}`);
    const messages: BaseMessage[] = [
      new SystemMessage(JOB_SYSTEM_PROMPT),
      new HumanMessage(instruction),
    ];

    for (let round = 0; round < this.maxRounds; round++) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];
      if (!toolCalls.length) {
        const result = this.toToolContent(aiMessage.content);
        this.logger.log(`JobAgent done: ${result}`);
        return result;
      }

      for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        this.logger.log(`JobAgent tool: ${toolName}`);
        const content = await this.invokeTool(toolName, toolCall.args);
        messages.push(
          new ToolMessage({
            tool_call_id: toolCall.id || '',
            name: toolName,
            content,
          }),
        );
      }
    }

    this.logger.warn(`JobAgent stopped after ${this.maxRounds} rounds`);
    return `任务未在 ${this.maxRounds} 轮内完成`;
  }
}
