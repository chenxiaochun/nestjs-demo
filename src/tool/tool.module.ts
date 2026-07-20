import { Module } from '@nestjs/common';
import { SendMailToolService } from './send-mail-tool.service';
import { UserModule } from 'src/user/user.module';
import { WebSearchToolService } from './web-search-tool.service';
import { CronJobToolService } from './corn-job-tool.service';
import { DbUserCrudService } from './db-user-crud.service';
import { QueryUserToolService } from './query-user-tool.service';
import { JobModule } from 'src/job/job.module';
import { ChatModelToolService } from './chat-model-tool.service';
import { TimeNowToolService } from './time-now-tool.service';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [UserModule, forwardRef(() => JobModule)],
  providers: [
    SendMailToolService,
    WebSearchToolService,
    CronJobToolService,
    QueryUserToolService,
    DbUserCrudService,
    ChatModelToolService,
    TimeNowToolService,
    {
      provide: 'CHAT_MODEL_TOOL',
      useFactory: (chatModelToolService: ChatModelToolService) => {
        return chatModelToolService.tool;
      },
      inject: [ChatModelToolService],
    },
    {
      provide: 'TIME_NOW_TOOL',
      useFactory: (timeNowToolService: TimeNowToolService) => {
        return timeNowToolService.tool;
      },
      inject: [TimeNowToolService],
    },
    {
      provide: 'SEND_MAIL_TOOL',
      useFactory: (sendMailToolService: SendMailToolService) => {
        return sendMailToolService.tool;
      },
      inject: [SendMailToolService],
    },
    {
      provide: 'WEB_SEARCH_TOOL',
      useFactory: (webSearchToolService: WebSearchToolService) => {
        return webSearchToolService.tool;
      },
      inject: [WebSearchToolService],
    },
    {
      provide: 'CRON_JOB_TOOL',
      useFactory: (cronJobToolService: CronJobToolService) => {
        return cronJobToolService.tool;
      },
      inject: [CronJobToolService],
    },
    {
      provide: 'QUERY_USER_TOOL',
      useFactory: (queryUserToolService: QueryUserToolService) => {
        return queryUserToolService.tool;
      },
      inject: [QueryUserToolService],
    },
    {
      provide: 'DB_USER_CRUD_TOOL',
      useFactory: (dbUserCrudService: DbUserCrudService) => {
        return dbUserCrudService.tool;
      },
      inject: [DbUserCrudService],
    },
  ],
  exports: [
    'CHAT_MODEL_TOOL',
    'SEND_MAIL_TOOL',
    'WEB_SEARCH_TOOL',
    'CRON_JOB_TOOL',
    'DB_USER_CRUD_TOOL',
    'QUERY_USER_TOOL',
    'TIME_NOW_TOOL',
  ],
})
export class ToolModule {}
