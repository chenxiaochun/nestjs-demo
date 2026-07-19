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
      count: z.int().min(1).max(10).optional().describe('返回搜索结果数量，最小 1，最多 10 条'),
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
            .map((page: { title?: string; url?: string; summary?: string; siteName?: string }) =>
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
  }
}
