import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatModelToolService {
  public readonly tool: ChatOpenAI;

  constructor(private readonly configService: ConfigService) {
    const modelName = this.configService.get<string>('MODEL_NAME');
    const baseUrl = this.configService.get<string>('OPENAI_BASE_URL');
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.tool = new ChatOpenAI({
      apiKey,
      model: modelName,
      configuration: {
        baseURL: baseUrl,
      },
    });
  }
}
