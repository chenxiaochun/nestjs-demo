import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { JobService } from 'src/job/job.service';

@Injectable()
export class CronJobToolService {
  public tool;

  @Inject(JobService)
  private readonly jobService!: JobService;

  constructor() {
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
        .describe('执行时间 ISO 字符串，仅 type=at 时可选（与 delayMs 二选一）'),
      delayMs: z
        .number()
        .optional()
        .describe(
          '延迟毫秒，仅 type=at 时可选（与 at 二选一）。例如 30 分钟后传 1800000，由服务器按当前时间计算',
        ),
    });

    this.tool = tool(
      async ({
        action,
        id,
        type,
        instruction,
        corn,
        everyMs,
        at,
        delayMs,
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
            let runAt: Date | undefined;
            if (type === 'at') {
              if (delayMs && delayMs > 0) {
                runAt = new Date(Date.now() + delayMs);
              } else if (at) {
                if (Number.isNaN(new Date(at).getTime())) {
                  return `添加定时任务失败: at 时间格式无效: ${at}`;
                }
                runAt = new Date(at);
              } else {
                return '添加定时任务失败: type=at 时必须提供 at（ISO 时间）或 delayMs（延迟毫秒）';
              }
            }

            const createdJob = await this.jobService.addJob({
              type,
              corn,
              everyMs,
              at: runAt,
              instruction: instruction.trim(),
              isEnabled: true,
            });
            const atInfo =
              createdJob.type === 'at' && createdJob.at
                ? `，执行时间: ${createdJob.at.toISOString()}`
                : '';
            return `定时任务添加成功: ${createdJob.id}，任务类型: ${createdJob.type}，任务描述: ${createdJob.instruction}${atInfo}`;
          }
          case 'list': {
            const jobs = await this.jobService.lisJobs();
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
              const toggledJob = await this.jobService.toggleJob(id);
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
          '定时任务工具。add：按类型添加任务（cron→corn，every→everyMs，at→at 或 delayMs；均需 instruction）。list：列出任务。toggle：按 id 切换启停。「N分钟后提醒」优先用 type=at + delayMs（毫秒），由服务器计算执行时间。',
        schema: cronJobArgsSchema,
      },
    );
  }
}
