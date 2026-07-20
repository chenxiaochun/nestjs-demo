import { Module } from '@nestjs/common';
import { AiCornService } from './ai-corn.service';
import { AiCornController } from './ai-corn.controller';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [ToolModule],
  controllers: [AiCornController],
  providers: [AiCornService],
})
export class AiCornModule {}
