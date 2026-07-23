import { ConfigService } from '@nestjs/config';
import { Inject, Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

@Injectable()
export class WebSearchToolService {
  public tool;

  @Inject(ConfigService)
  private readonly configService!: ConfigService;

  constructor() {
    const webSearchArgsSchema = z.object({
      query: z.string().min(1).describe('搜索关键词'),
      // 博查在 count 过小时，部分结果被过滤后可能返回空 value；下限 5 更稳妥
      count: z
        .int()
        .min(5)
        .max(10)
        .optional()
        .describe('返回搜索结果数量，默认 10，最少 5，最多 10 条'),
    });

    this.tool = tool(
      async ({ query, count }: { query: string; count?: number }) => {
        const apiKey = this.configService.get('BOCHA_API_KEY');
        if (!apiKey) {
          return '搜索失败：缺少 BOCHA_API_KEY';
        }

        const url = 'https://api.bochaai.com/v1/web-search';
        const body = {
          query,
          freshness: 'noLimit',
          summary: true,
          // 避免模型传 count=1 时被过滤后变成空结果
          count: Math.max(count ?? 10, 5),
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
          // 博查字段是 name，不是 title
          return webPages
            .map(
              (page: {
                name?: string;
                title?: string;
                url?: string;
                summary?: string;
                snippet?: string;
                siteName?: string;
              }) =>
                [
                  `标题：${page.name ?? page.title ?? ''}`,
                  `URL: ${page.url ?? ''}`,
                  `摘要：${page.summary ?? page.snippet ?? ''}`,
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
  }
}
