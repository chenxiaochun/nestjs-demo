import { tool } from '@langchain/core/tools';
import { MailerService } from '@nestjs-modules/mailer';
import { Inject, Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { z } from 'zod';

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

@Injectable()
export class SendMailToolService {
  public tool;

  @Inject(UserService)
  private readonly userService!: UserService;

  @Inject(MailerService)
  private readonly mailerService!: MailerService;

  constructor() {
    this.tool = tool(
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
          const user = await this.userService.findOne(userId);
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
          await this.mailerService.sendMail({
            to,
            subject,
            text: userText,
            html: html || undefined,
          });
          return `邮件已发送至 ${to}，正文已包含用户 ${userId} 的完整信息`;
        }

        // 通用发信：直接使用模型提供的 html/text（如搜索结果）
        await this.mailerService.sendMail({
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
  }
}
