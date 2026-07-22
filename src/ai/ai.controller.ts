import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';
import { from, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, type AiTtsStreamEvent } from 'src/speech/stream-events';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('chat')
  async chat(@Query('question') question: string, @Query('query') query?: string) {
    return await this.aiService.runChain(query || question);
  }

  @Sse('chat/stream')
  streamChat(
    @Query('query') query: string,
    @Query('question') question: string,
    @Query('ttsSessionId') ttsSessionId?: string,
  ) {
    const prompt = (query || question || '').trim();
    const sessionId = ttsSessionId?.trim() || undefined;
    if (sessionId) {
      const startEvent: AiTtsStreamEvent = {
        type: 'start',
        sessionId,
        query: prompt,
      };
      this.eventEmitter.emit(AI_TTS_STREAM_EVENT, startEvent);
    }

    return from(this.aiService.streamChain(prompt, sessionId)).pipe(
      map((chunk) => ({
        data: chunk,
      })),
    );
  }

  @Post()
  create(@Body() createAiDto: CreateAiDto) {
    return this.aiService.create(createAiDto);
  }

  @Get()
  findAll() {
    return this.aiService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAiDto: UpdateAiDto) {
    return this.aiService.update(+id, updateAiDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiService.remove(+id);
  }
}
