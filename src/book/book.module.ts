import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';

@Module({
  controllers: [BookController],
  providers: [BookService, {
    provide: 'BOOK_REPOSITORY',
    useFactory: () => {
      return {
        findAll2: () => ([{
          id: 1,
          title: 'Book 1',
          author: 'Author 1',
        }, {
          id: 2,
          title: 'Book 2',
          author: 'Author 2',
        }]),
      }
    }
  }],
})
export class BookModule {}
