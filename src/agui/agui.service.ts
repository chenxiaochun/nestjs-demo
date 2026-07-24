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
        '你是AI助手，需要最新信息或者联网查询信息时，请使用 webSearch 工具查询之后再进行回答',
    });
  }

  async stream(messages: UIMessage[]) {
    /**
     * 因为 agent 是用 langchain 实现的，所以需要将 messages 转换为 langchain 的 messages 格式，然后才能传给 agent
     * 然后 agent 会根据 messages 和 tools 进行推理，并返回推理结果
     * 最后将推理结果转换为 UIMessage 格式，并返回给前端
     */
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
