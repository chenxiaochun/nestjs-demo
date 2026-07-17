import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AiCornService } from './ai-corn.service';
import { CreateAiCornDto } from './dto/create-ai-corn.dto';
import { UpdateAiCornDto } from './dto/update-ai-corn.dto';

@Controller('ai-corn')
export class AiCornController {
  constructor(private readonly aiCornService: AiCornService) {}

  @Get('chat')
  async runChain(@Query('query') query: string) {
    const answer = await this.aiCornService.runChain(query);
    console.log('answer', answer);
    return { answer };
  }

  @Post()
  create(@Body() createAiCornDto: CreateAiCornDto) {
    return this.aiCornService.create(createAiCornDto);
  }

  @Get()
  findAll() {
    return this.aiCornService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiCornService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAiCornDto: UpdateAiCornDto) {
    return this.aiCornService.update(+id, updateAiCornDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiCornService.remove(+id);
  }
}
