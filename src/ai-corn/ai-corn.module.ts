import { Module } from '@nestjs/common';
import { AiCornService } from './ai-corn.service';
import { AiCornController } from './ai-corn.controller';
import { AiModule } from 'src/ai/ai.module';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [AiModule, ToolModule],
  controllers: [AiCornController],
  providers: [AiCornService],
})
export class AiCornModule {}
