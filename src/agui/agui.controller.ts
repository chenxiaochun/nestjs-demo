import { BadRequestException, Body, Controller, Post, Res } from '@nestjs/common';
import { pipeUIMessageStreamToResponse, UIMessage } from 'ai';
import type { Response } from 'express';
import { AguiService } from './agui.service';

@Controller('agui')
export class AguiController {
  constructor(private readonly aguiService: AguiService) {}

  @Post('chat')
  async postChat(
    @Body() body: { messages?: UIMessage[] },
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!body?.messages || !Array.isArray(body.messages)) {
      throw new BadRequestException('Invalid JSON');
    }

    const stream = await this.aguiService.stream(body.messages);
    pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
