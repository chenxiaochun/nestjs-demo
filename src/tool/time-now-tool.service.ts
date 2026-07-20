import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

@Injectable()
export class TimeNowToolService {
  public tool;

  constructor() {
    this.tool = tool(
      async () => {
        const now = new Date();
        return JSON.stringify({
          iso: now.toISOString(),
          timestamp: now.getTime(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      },
      {
        name: 'timeNow',
        description: '获取当前服务器时间（ISO 格式、时间戳、时区）。创建相对时间定时任务前必须先调用。',
        schema: z.object({}),
      },
    );
  }
}
