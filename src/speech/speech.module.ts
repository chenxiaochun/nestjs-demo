import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';
import { AsrClientService } from './asr-client.service';

@Module({
  providers: [SpeechService, AsrClientService],
  controllers: [SpeechController],
  exports: [SpeechService],
})
export class SpeechModule {}
