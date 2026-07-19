import { Injectable, Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Job as JobEntity } from './entities/job.entity';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';

@Injectable()
export class JobService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobService.name);

  @Inject(EntityManager)
  private readonly entityManager!: EntityManager;

  @Inject(SchedulerRegistry)
  private readonly schedulerRegistry!: SchedulerRegistry;

  async onApplicationBootstrap() {
    const enabledJobs = await this.entityManager.find(JobEntity, {
      where: { isEnabled: true },
    });

    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervalJobs = this.schedulerRegistry.getIntervals();
    const timeoutJobs = this.schedulerRegistry.getTimeouts();

    for (const job of enabledJobs) {
      const jobId = String(job.id);
      const alreadyRegistered =
        (job.type === 'cron' && cronJobs.has(jobId)) ||
        (job.type === 'every' && intervalJobs.includes(jobId)) ||
        (job.type === 'at' && timeoutJobs.includes(jobId));
      if (alreadyRegistered) {
        continue;
      }
      await this.startRunTime(job);
    }
  }

  async lisJobs() {
    const jobs = await this.entityManager.find(JobEntity, {
      order: {
        createdAt: 'DESC',
      },
    });

    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervalJobs = this.schedulerRegistry.getIntervals();
    const timeoutJobs = this.schedulerRegistry.getTimeouts();

    return jobs.map((job) => {
      const running =
        job.isEnabled &&
        ((job.type === 'cron' && cronJobs.has(String(job.id))) ||
          (job.type === 'every' && intervalJobs.includes(String(job.id))) ||
          (job.type === 'at' && timeoutJobs.includes(String(job.id))));

      return {
        ...job,
        running,
      };
    });
  }

  async addJob(input: {
    type: 'cron' | 'every' | 'at';
    corn?: string;
    everyMs?: number;
    at?: Date;
    instruction: string;
    isEnabled: boolean;
  }) {
    const now = new Date();
    const entity = this.entityManager.create(JobEntity, {
      instruction: input.instruction,
      isEnabled: input.isEnabled,
      type: input.type,
      corn: input.type === 'cron' ? input.corn : undefined,
      everyMs: input.type === 'every' ? input.everyMs : undefined,
      at: input.type === 'at' ? input.at : undefined,
      lastRun: null,
      createdAt: now,
      updatedAt: null,
    });

    const saved = await this.entityManager.save(entity);
    if (saved.isEnabled) {
      await this.startRunTime(saved);
    }
    return saved;
  }

  /** 切换启停；未传 isEnabled 时取反 */
  async toggleJob(id: string | number, isEnabled?: boolean) {
    const job = await this.entityManager.findOne(JobEntity, {
      where: { id: id as JobEntity['id'] },
    });
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }
    job.isEnabled = isEnabled ?? !job.isEnabled;
    job.updatedAt = new Date();
    const saved = await this.entityManager.save(job);
    if (saved.isEnabled) {
      await this.startRunTime(saved);
    }
    return saved;
  }

  /** 按任务类型注册到 SchedulerRegistry，并在触发时更新 lastRun */
  async startRunTime(job: JobEntity) {
    const name = String(job.id);

    const onTick = async () => {
      await this.entityManager.update(JobEntity, { id: job.id }, { lastRun: new Date() });
      this.logger.log(`Job ${name} executed: ${job.instruction}`);
    };

    if (job.type === 'cron') {
      if (!job.corn) {
        throw new Error(`Job ${name} missing corn expression`);
      }
      const cronJob = new CronJob(job.corn, () => {
        void onTick();
      });
      this.schedulerRegistry.addCronJob(name, cronJob);
      cronJob.start();
      this.logger.log(`Registered cron job ${name}: ${job.corn}`);
      return;
    }

    if (job.type === 'every') {
      if (!job.everyMs || job.everyMs <= 0) {
        throw new Error(`Job ${name} missing valid everyMs`);
      }
      const intervalId = setInterval(() => {
        void onTick();
      }, job.everyMs);
      this.schedulerRegistry.addInterval(name, intervalId);
      this.logger.log(`Registered interval job ${name}: every ${job.everyMs}ms`);
      return;
    }

    if (job.type === 'at') {
      if (!job.at) {
        throw new Error(`Job ${name} missing at timestamp`);
      }
      const delay = new Date(job.at).getTime() - Date.now();
      if (delay <= 0) {
        await onTick();
        return;
      }
      const timeoutId = setTimeout(() => {
        void onTick();
      }, delay);
      this.schedulerRegistry.addTimeout(name, timeoutId);
      this.logger.log(`Registered timeout job ${name}: at ${job.at.toISOString()}`);
      return;
    }

    throw new Error(`Unsupported job type: ${(job as JobEntity).type}`);
  }
}
