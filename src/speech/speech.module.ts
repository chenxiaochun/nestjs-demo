import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';
import { AsrClientService } from './asr-client.service';
import { TtsRelayService } from './tts-relay.service';

@Module({
  providers: [SpeechService, AsrClientService, TtsRelayService],
  controllers: [SpeechController],
  exports: [SpeechService, TtsRelayService],
})
export class SpeechModule {}
