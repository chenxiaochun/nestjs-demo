import { Injectable, Inject, Logger } from '@nestjs/common';
import { createAgent } from 'langchain';
import { Tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { UIMessage } from 'ai';

@Injectable()
export class AguiService {
  private readonly logger = new Logger(AguiService.name);
  private readonly agent: ReturnType<typeof createAgent>;

  constructor(
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: Tool,
    @Inject('CHAT_MODEL_TOOL') private readonly chatModel: ChatOpenAI,
  ) {
    this.agent = createAgent({
      model: this.chatModel,
      tools: [this.webSearchTool],
      systemPrompt:
        '你是AI助手，需要最新信息或者联网查询信息时，请使用 webSearch 工具查询之后再进行回答',
    });
  }

  async stream(messages: UIMessage[]) {
    /**
     * UIMessage → LangChain messages → agent.streamEvents → UIMessageStream
     * 使用 streamEvents（而非 stream + streamMode）更稳定，AI SDK 适配器能正确解析文本增量。
     */
    const lcMessages = await toBaseMessages(messages);
    this.logger.debug(`agui stream messages=${lcMessages.length}`);

    const eventStream = this.agent.streamEvents(
      { messages: lcMessages },
      {
        version: 'v2',
        recursionLimit: 30,
      },
    );

    return toUIMessageStream(eventStream, {
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`agui stream error: ${message}`);
        return message;
      },
    });
  }
}
