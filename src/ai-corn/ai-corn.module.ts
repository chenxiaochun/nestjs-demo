import { Module } from '@nestjs/common';
import { AiCornService } from './ai-corn.service';
import { AiCornController } from './ai-corn.controller';
import { AiModule } from 'src/ai/ai.module';
import { UserService } from 'src/user/user.service';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { UserModule } from 'src/user/user.module';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/user/entities/user.entity';
import { JobModule } from 'src/job/job.module';
import { JobService } from 'src/job/job.service';

@Module({
  imports: [AiModule, UserModule, JobModule],
  controllers: [AiCornController],
  providers: [
    AiCornService,
    {
      provide: 'QUERY_USER_TOOL',
      useFactory: (userService: UserService) => {
        const queryUserArgsSchema = z.object({
          userId: z.string().describe('用户ID'),
        });

        return tool(
          async ({ userId }: { userId: number }) => {
            const user = userService.findOne(userId);
            if (!user) {
              return '用户不存在';
            }
            // ToolMessage.content 必须是 string
            return JSON.stringify({ id: userId, ...user });
          },
          {
            name: 'queryUser',
            description: '根据用户ID查询用户详细信息（姓名、年龄、邮箱、电话）',
            schema: queryUserArgsSchema,
          },
        );
      },
      inject: [UserService],
    },
    {
      provide: 'SEND_MAIL_TOOL',
      useFactory: (mailerService: MailerService, userService: UserService) => {
        const sendMailArgsSchema = z.object({
          to: z.string().describe('收件人邮箱'),
          subject: z.string().describe('邮件主题'),
          userId: z
            .string()
            .optional()
            .describe('可选。仅当要发送系统内用户资料时传入用户ID（如 001），不是邮箱'),
          html: z.string().optional().describe('可选。HTML 正文，例如搜索结果整理成的 HTML'),
          text: z.string().optional().describe('可选。纯文本正文'),
        });

        return tool(
          async ({
            to,
            subject,
            userId,
            html,
            text,
          }: {
            to: string;
            subject: string;
            userId?: number;
            html?: string;
            text?: string;
          }) => {
            if (!userId && !html && !text) {
              return '邮件未发送：请提供 html、text，或在发送用户资料时提供 userId';
            }

            // 发用户资料：按 userId 查库组装正文
            if (userId) {
              const user = await userService.findOne(userId);
              if (!user) {
                return `用户不存在: ${userId}，邮件未发送。若只是发任意内容到邮箱，请改用 html/text，不要传 userId。`;
              }
              const userText = [
                `用户 ${userId} 的信息如下：`,
                `姓名：${user.name}`,
                `邮箱：${user.email}`,
                `出生日期：${user.createdAt}`,
                `创建日期：${user.createdAt}`,
                `更新日期：${user.updatedAt}`,
              ].join('\n');
              await mailerService.sendMail({
                to,
                subject,
                text: userText,
                html: html || undefined,
              });
              return `邮件已发送至 ${to}，正文已包含用户 ${userId} 的完整信息`;
            }

            // 通用发信：直接使用模型提供的 html/text（如搜索结果）
            await mailerService.sendMail({
              to,
              subject,
              text: text || undefined,
              html: html || undefined,
            });
            return `邮件已发送至 ${to}`;
          },
          {
            name: 'sendMail',
            description:
              '发送邮件。场景1：发系统用户资料 → to、subject、userId。场景2：发搜索结果等任意内容 → to、subject，以及完整 html（必须含标题/链接/摘要等实质内容），不要传 userId。禁止与 web_search 同一轮调用；禁止空 html。',
            schema: sendMailArgsSchema,
          },
        );
      },
      inject: [MailerService, UserService],
    },
    {
      provide: 'WEB_SEARCH_TOOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const webSearchArgsSchema = z.object({
          query: z.string().min(1).describe('搜索关键词'),
          count: z.int().min(1).max(10).optional().describe('返回搜索结果数量，最小 1，最多 10 条'),
        });

        return tool(
          async ({ query, count }: { query: string; count?: number }) => {
            const apiKey = configService.get('BOCHA_API_KEY');
            if (!apiKey) {
              return '搜索失败：缺少 BOCHA_API_KEY';
            }

            const url = 'https://api.bochaai.com/v1/web-search';
            const body = {
              query,
              freshness: 'noLimit',
              summary: true,
              count: count || 10,
            };

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            }).catch((error: Error) => {
              console.error(error);
              throw new Error(`搜索请求失败: ${error.message}`);
            });

            if (!response.ok) {
              const errorText = await response.text();
              return `搜索失败: HTTP ${response.status} ${errorText}`;
            }

            const json = await response.json();
            // 博查可能返回数字 200 或字符串 "200"
            if ((json.code === 200 || json.code === '200') && json.data) {
              const webPages = json.data.webPages?.value ?? [];
              if (!webPages.length) {
                return '搜索无结果';
              }
              return webPages
                .map(
                  (page: { title?: string; url?: string; summary?: string; siteName?: string }) =>
                    [
                      `标题：${page.title ?? ''}`,
                      `URL: ${page.url ?? ''}`,
                      `摘要：${page.summary ?? ''}`,
                      `网站名称：${page.siteName ?? ''}`,
                    ].join('\n'),
                )
                .join('\n\n');
            }

            return `搜索失败: ${JSON.stringify(json)}`;
          },
          {
            name: 'web_search',
            description:
              '搜索互联网上的信息。适用于新闻、天气、实时资讯、公开网页内容等需要联网查询的问题。',
            schema: webSearchArgsSchema,
          },
        );
      },
    },
    {
      provide: 'DB_USER_CRUD_TOOL',
      inject: [UserService],
      useFactory: (userService: UserService) => {
        const dbUserCrudArgsSchema = z.object({
          action: z
            .enum(['create', 'list', 'update', 'delete'])
            .describe('操作类型,create:创建用户,list:查询用户列表,update:更新用户,delete:删除用户'),
          id: z.number().optional().describe('用户ID,仅在update和delete时需要'),
          name: z.string().optional().describe('用户姓名,仅在create和update时需要'),
          email: z.string().optional().describe('用户邮箱,仅在create和update时需要'),
        });

        return tool(
          async ({ action, id, name, email }: z.infer<typeof dbUserCrudArgsSchema>) => {
            switch (action) {
              case 'create':
                if (!name || !email) {
                  return '创建用户失败: 缺少姓名或邮箱';
                }
                const created = await userService.create({ name, email });
                if (created) {
                  return `用户创建成功: ${created.id}，姓名: ${created.name}，邮箱: ${created.email}`;
                }
              case 'list':
                const users = await userService.findAll();
                if (users.length > 0) {
                  return users
                    .map((user) => `用户ID: ${user.id}，姓名: ${user.name}，邮箱: ${user.email}`)
                    .join('\n');
                }
              case 'update':
                if (!id || !name || !email) {
                  return '更新用户失败: 缺少用户ID或姓名或邮箱';
                }

                const user = await userService.findOne(id);
                const payload = {
                  ...user,
                  name,
                  email,
                };

                const updated = await userService.update(id, payload as Omit<User, 'id'>);
                if (updated) {
                  return `用户更新成功: ${updated.id}，姓名: ${updated.name}，邮箱: ${updated.email}`;
                }
                return '更新用户失败: 用户不存在';

              case 'delete':
                if (!id) {
                  return '删除用户失败: 缺少用户ID';
                }
                const deleted = await userService.remove(id);
                if (deleted) {
                  return `用户删除成功: ${id}`;
                }
                return '删除用户失败: 用户不存在';
            }
          },
          {
            name: 'dbUserCrud',
            description:
              '数据库用户操作工具,create:创建用户,list:查询用户列表,update:更新用户,delete:删除用户',
            schema: dbUserCrudArgsSchema,
          },
        );
      },
    },
    {
      provide: 'CRON_JOB_TOOL',
      inject: [JobService],
      useFactory: (jobService: JobService) => {
        const cronJobArgsSchema = z.object({
          action: z
            .enum(['add', 'list', 'toggle'])
            .describe('操作类型,add:添加定时任务,list:查询定时任务列表,toggle:开关定时任务'),
          id: z.string().optional().describe('任务ID,仅在toggle时需要'),
          type: z
            .enum(['cron', 'every', 'at'])
            .optional()
            .describe(
              '任务类型。cron:按 cron 表达式重复；every:按间隔毫秒重复；at:在指定时间执行一次。例如「10秒后提醒」用 type=at',
            ),
          instruction: z
            .string()
            .optional()
            .describe('任务描述/提醒内容，如「提醒我喝水」。add 时必填'),
          corn: z.string().optional().describe('cron 表达式，仅 type=cron 时需要，如 "0 9 * * *"'),
          everyMs: z
            .number()
            .optional()
            .describe('间隔毫秒，仅 type=every 时需要，如 60000 表示每分钟'),
          at: z
            .string()
            .optional()
            .describe(
              '执行时间 ISO 字符串，仅 type=at 时需要。例如 10 秒后：把当前时间加 10 秒后的 ISO 时间传入',
            ),
        });

        return tool(
          async ({
            action,
            id,
            type,
            instruction,
            corn,
            everyMs,
            at,
          }: z.infer<typeof cronJobArgsSchema>) => {
            switch (action) {
              case 'add': {
                if (!type || !instruction?.trim()) {
                  return '添加定时任务失败: 缺少任务类型(type)或任务描述(instruction)';
                }
                if (type === 'cron' && !corn) {
                  return '添加定时任务失败: type=cron 时必须提供 corn 表达式';
                }
                if (type === 'every' && (!everyMs || everyMs <= 0)) {
                  return '添加定时任务失败: type=every 时必须提供有效的 everyMs（毫秒）';
                }
                if (type === 'at' && !at) {
                  return '添加定时任务失败: type=at 时必须提供 at（ISO 时间）';
                }
                if (type === 'at' && at && Number.isNaN(new Date(at).getTime())) {
                  return `添加定时任务失败: at 时间格式无效: ${at}`;
                }

                const createdJob = await jobService.addJob({
                  type,
                  corn,
                  everyMs,
                  at: type === 'at' && at ? new Date(at) : undefined,
                  instruction: instruction.trim(),
                  isEnabled: true,
                });
                return `定时任务添加成功: ${createdJob.id}，任务类型: ${createdJob.type}，任务描述: ${createdJob.instruction}`;
              }
              case 'list': {
                const jobs = await jobService.lisJobs();
                if (jobs.length === 0) {
                  return '暂无定时任务';
                }
                return jobs
                  .map(
                    (job) =>
                      `任务ID: ${job.id}，任务类型: ${job.type}，任务描述: ${job.instruction}，启用: ${job.isEnabled}，运行中: ${job.running}`,
                  )
                  .join('\n');
              }
              case 'toggle': {
                if (!id) {
                  return '开关定时任务失败: 缺少任务ID';
                }
                try {
                  const toggledJob = await jobService.toggleJob(id);
                  return `定时任务开关成功: ${toggledJob.id}，启用: ${toggledJob.isEnabled}，任务描述: ${toggledJob.instruction}`;
                } catch {
                  return '开关定时任务失败: 任务不存在';
                }
              }
              default:
                return `不支持的操作: ${action as string}`;
            }
          },
          {
            name: 'cronJob',
            description:
              '定时任务工具。add：按类型添加任务（三种类型互斥字段：cron→corn，every→everyMs，at→at；均需 instruction）。list：列出任务。toggle：按 id 切换启停。「N秒后提醒」用 type=at + 未来 ISO 时间，不要用 every。',
            schema: cronJobArgsSchema,
          },
        );
      },
    },
  ],
})
export class AiCornModule {}
