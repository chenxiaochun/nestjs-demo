import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        const modelName = configService.get('MODEL_NAME');
        const baseUrl = configService.get('OPENAI_BASE_URL');
        const apiKey = configService.get('OPENAI_API_KEY');
        return new ChatOpenAI({
          apiKey,
          model: modelName,
          configuration: {
            baseURL: baseUrl,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AiModule {}
