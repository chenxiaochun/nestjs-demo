import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [ToolModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
