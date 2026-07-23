import { Module } from '@nestjs/common';
import { AguiService } from './agui.service';
import { ToolModule } from '../tool/tool.module';
import { AguiController } from './agui.controller';

@Module({
  imports: [ToolModule],
  providers: [AguiService],
  controllers: [AguiController],
})
export class AguiModule {}
