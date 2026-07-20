import { Inject, Injectable } from '@nestjs/common';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Runnable } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class AiService {
  private readonly chain: Runnable;

  constructor(@Inject('CHAT_MODEL_TOOL') private chatModel: ChatOpenAI) {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题\n\n{question}');
    this.chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());
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
