import { BadRequestException, Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { pipeUIMessageStreamToResponse, UIMessage } from 'ai';
import type { Response } from 'express';
import { AguiService } from './agui.service';

@Controller('agui')
export class AguiController {
  private readonly logger = new Logger(AguiController.name);

  constructor(private readonly aguiService: AguiService) {}

  @Post('chat')
  async postChat(
    @Body() body: { messages?: UIMessage[] },
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!body?.messages || !Array.isArray(body.messages)) {
      throw new BadRequestException('Invalid JSON');
    }

    try {
      const stream = await this.aguiService.stream(body.messages);
      pipeUIMessageStreamToResponse({
        response: res,
        stream,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`agui/chat failed: ${message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  }
}
