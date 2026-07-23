import { Injectable, Inject } from '@nestjs/common';
import { createAgent, AIMessageChunk } from 'langchain';
import { Tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { UIMessage } from 'ai';

@Injectable()
export class AguiService {
  private readonly agent: ReturnType<typeof createAgent>;

  constructor(
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: Tool,
    @Inject('CHAT_MODEL_TOOL') private readonly chatModel: ChatOpenAI,
  ) {
    this.agent = createAgent({
      model: chatModel,
      tools: [this.webSearchTool],
      systemPrompt:
        '你是AI助手，需要最新信息或者联网查询信息时，请使用WEB_SEARCH_TOOL工具查询之后再进行回答',
    });
  }

  async stream(messages: UIMessage[]) {
    const lcMessages = await toBaseMessages(messages);
    const lgStream = await this.agent.stream(
      { messages: lcMessages },
      {
        streamMode: ['messages', 'values'],
        recursionLimit: 30,
      },
    );

    return toUIMessageStream(lgStream as AsyncIterable<AIMessageChunk>);
  }
}
