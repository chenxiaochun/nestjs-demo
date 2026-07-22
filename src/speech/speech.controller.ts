import {
  Controller,
  BadRequestException,
  Post,
  UploadedFile,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';
import type { UploadAudio } from './speech.service';

@Controller('speech')
export class SpeechController {
  @Inject(SpeechService)
  private readonly speechService!: SpeechService;

  constructor() {}

  @Post('asr')
  @UseInterceptors(FileInterceptor('audio'))
  async recognize(@UploadedFile() file?: UploadAudio) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('音频文件不能为空');
    }
    const audio: UploadAudio = {
      buffer: file.buffer,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    };
    const result = await this.speechService.recognizeBySentence(audio);
    // 腾讯云返回对象时取 Result；统一给前端 string
    const text =
      typeof result === 'string'
        ? result
        : ((result as { Result?: string; result?: string })?.Result ??
          (result as { result?: string })?.result ??
          '');
    return { text };
  }
}
