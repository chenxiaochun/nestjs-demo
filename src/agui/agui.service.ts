import { Injectable, Inject, Logger } from '@nestjs/common';
import { createAgent } from 'langchain';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { UIMessage, UIMessageChunk } from 'ai';

type AnyPart = Record<string, unknown> & { type?: string };
type StreamEvent = {
  event?: string;
  name?: string;
  run_id?: string;
  data?: {
    input?: unknown;
    output?: unknown;
  };
};

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

  async stream(messages: UIMessage[]): Promise<ReadableStream<UIMessageChunk>> {
    /**
     * Nest 下 agent.stream + streamMode 经常丢 text-delta，因此用 streamEvents 保正文。
     * 但 streamEvents 适配器不会发 tool-input-available，且 tool output 可能是
     * LangChain 序列化对象 —— 会导致下一轮历史缺 args，触发 DashScope NoneType.startswith。
     * 这里补齐 input，并清洗 output。
     */
    const sanitizedUi = this.sanitizeUiMessages(messages);
    const lcMessages = this.sanitizeLcMessages(await toBaseMessages(sanitizedUi));

    this.logger.debug(
      `agui stream ui=${messages.length} lc=${lcMessages.length} types=${lcMessages
        .map((m) => m.getType())
        .join(',')}`,
    );

    const toolInputs = new Map<string, unknown>();
    const eventStream = this.normalizeEventStream(
      this.agent.streamEvents(
        { messages: lcMessages },
        {
          version: 'v2',
          recursionLimit: 30,
        },
      ),
      toolInputs,
    );

    const uiStream = toUIMessageStream(
      // streamEvents 与适配器类型定义不完全对齐，运行时按 StreamEvent 处理
      eventStream as never,
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`agui stream error: ${message}`);
        },
      },
    );

    return this.ensureToolInputAvailable(uiStream, toolInputs);
  }

  private sanitizeUiMessages(messages: UIMessage[]): UIMessage[] {
    return messages.map((message) => ({
      ...message,
      parts: message.parts?.map((part) => {
        const p = part as AnyPart;
        if (!this.isToolPart(p)) {
          return part;
        }
        return {
          ...p,
          input: p.input ?? {},
          output: this.unwrapToolOutput(p.output),
        } as typeof part;
      }),
    }));
  }

  private sanitizeLcMessages(
    messages: Awaited<ReturnType<typeof toBaseMessages>>,
  ) {
    return messages.map((message) => {
      if (AIMessage.isInstance(message) && Array.isArray(message.tool_calls)) {
        return new AIMessage({
          content: message.content,
          tool_calls: message.tool_calls.map((toolCall) => ({
            ...toolCall,
            args: toolCall.args ?? {},
          })),
          id: message.id,
          additional_kwargs: message.additional_kwargs,
          response_metadata: message.response_metadata,
        });
      }

      if (ToolMessage.isInstance(message)) {
        return new ToolMessage({
          content: this.unwrapToolOutput(message.content),
          tool_call_id: message.tool_call_id,
          name: message.name,
          status: message.status,
          id: message.id,
        });
      }

      return message;
    });
  }

  private async *normalizeEventStream(
    eventStream: AsyncIterable<StreamEvent>,
    toolInputs: Map<string, unknown>,
  ): AsyncGenerator<StreamEvent> {
    for await (const event of eventStream) {
      if (event.event === 'on_tool_start' && event.run_id) {
        toolInputs.set(event.run_id, this.parseToolStartInput(event.data?.input));
      }

      if (event.event === 'on_tool_end') {
        yield {
          ...event,
          data: {
            ...event.data,
            output: this.unwrapToolOutput(event.data?.output),
          },
        };
        continue;
      }

      yield event;
    }
  }

  private ensureToolInputAvailable(
    stream: ReadableStream<UIMessageChunk>,
    toolInputs: Map<string, unknown>,
  ): ReadableStream<UIMessageChunk> {
    const unwrap = this.unwrapToolOutput.bind(this);
    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            if (value.type === 'tool-input-start') {
              controller.enqueue(value);
              controller.enqueue({
                type: 'tool-input-available',
                toolCallId: value.toolCallId,
                toolName: value.toolName,
                input: toolInputs.get(value.toolCallId) ?? {},
                dynamic: true,
              });
              continue;
            }

            if (value.type === 'tool-output-available') {
              controller.enqueue({
                ...value,
                output: unwrap(value.output),
              });
              continue;
            }

            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  private parseToolStartInput(input: unknown): Record<string, unknown> {
    if (input == null) {
      return {};
    }
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
      } catch {
        return { value: input };
      }
    }
    if (typeof input === 'object') {
      const record = input as Record<string, unknown>;
      if (typeof record.input === 'string') {
        return this.parseToolStartInput(record.input);
      }
      if (record.input && typeof record.input === 'object') {
        return record.input as Record<string, unknown>;
      }
      return record;
    }
    return {};
  }

  private isToolPart(part: AnyPart): boolean {
    return (
      part.type === 'dynamic-tool' ||
      (typeof part.type === 'string' && part.type.startsWith('tool-'))
    );
  }

  private isLangChainSerialized(value: unknown): boolean {
    return (
      !!value &&
      typeof value === 'object' &&
      'lc' in (value as object) &&
      (value as { lc?: unknown }).lc === 1
    );
  }

  private unwrapToolOutput(value: unknown): string {
    if (value == null) {
      return '';
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('{') && trimmed.includes('"lc":1')) {
        try {
          return this.unwrapToolOutput(JSON.parse(trimmed));
        } catch {
          return value;
        }
      }
      return value;
    }
    if (this.isLangChainSerialized(value)) {
      const kwargs = (value as { kwargs?: { content?: unknown } }).kwargs;
      return this.unwrapToolOutput(kwargs?.content ?? '');
    }
    if (typeof value === 'object' && value !== null && 'content' in value) {
      return this.unwrapToolOutput((value as { content: unknown }).content);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
