import { Injectable } from '@nestjs/common';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Runnable } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private readonly chain: Runnable;

  constructor(private readonly configService: ConfigService) {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题\n\n{question}');
    const model = new ChatOpenAI({
      modelName: this.configService.get('MODEL_NAME'),
      apiKey: this.configService.get('OPENAI_API_KEY'),
      configuration: {
        baseURL: this.configService.get('OPENAI_BASE_URL'),
      },
    });

    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async runChain(question: string) {
    const answer = await this.chain.invoke({ question });
    return { answer };
  }

  async *streamChain(question: string) {
    const stream = await this.chain.stream({ question });
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  create(createAiDto: CreateAiDto) {
    return 'This action adds a new ai';
  }

  findAll() {
    return `This action returns all ai`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ai`;
  }

  update(id: number, updateAiDto: UpdateAiDto) {
    return `This action updates a #${id} ai`;
  }

  remove(id: number) {
    return `This action removes a #${id} ai`;
  }
}
