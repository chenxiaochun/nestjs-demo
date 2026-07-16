import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [UserModule, BookModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
