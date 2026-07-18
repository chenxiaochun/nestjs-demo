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

@Module({
  imports: [AiModule, UserModule],
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
          async ({ userId }: { userId: string }) => {
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
          html: z
            .string()
            .optional()
            .describe('可选。HTML 正文，例如搜索结果整理成的 HTML'),
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
            userId?: string;
            html?: string;
            text?: string;
          }) => {
            if (!userId && !html && !text) {
              return '邮件未发送：请提供 html、text，或在发送用户资料时提供 userId';
            }

            // 发用户资料：按 userId 查库组装正文
            if (userId) {
              const user = userService.findOne(userId);
              if (!user) {
                return `用户不存在: ${userId}，邮件未发送。若只是发任意内容到邮箱，请改用 html/text，不要传 userId。`;
              }
              const userText = [
                `用户 ${userId} 的信息如下：`,
                `姓名：${user.name}`,
                `年龄：${user.age}`,
                `邮箱：${user.email}`,
                `电话：${user.phone}`,
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
                  (page: {
                    title?: string;
                    url?: string;
                    summary?: string;
                    siteName?: string;
                  }) =>
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
  ],
})
export class AiCornModule {}
