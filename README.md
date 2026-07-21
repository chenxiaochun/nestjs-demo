# nestjs-demo

基于 NestJS 的演示项目，集成 LangChain Agent、MySQL、邮件与定时任务，用于探索 AI 工具调用与后端业务结合。

## 功能概览

| 模块 | 说明 |
|------|------|
| `user` | 用户 CRUD（TypeORM + MySQL） |
| `book` | 图书 CRUD 示例 |
| `ai` | 简单 LLM 问答（普通 / SSE 流式） |
| `ai-corn` | 带工具的 Agent：查用户、发邮件、联网搜索、定时任务、获取当前时间 |
| `job` | 定时任务持久化与调度 |
| `tool` | LangChain Tools 封装，供 Agent 调用 |
| `public` | 静态资源（含 SSE 调试页） |

## 技术栈

- NestJS 11 + TypeScript
- TypeORM + MySQL
- LangChain（OpenAI 兼容接口）
- `@nestjs/schedule` 定时任务
- `@nestjs-modules/mailer` 邮件
- Webpack HMR 开发热更新
- oxlint / oxfmt

## 环境要求

- Node.js 18+
- pnpm
- MySQL

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动

```bash
# 开发（Webpack HMR）
pnpm run start:dev

# 普通启动
pnpm run start

# 生产
pnpm run build
pnpm run start:prod
```

默认监听 `http://localhost:3000`。

## 主要接口

### 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/user` | 用户列表 |
| GET | `/user/:id` | 用户详情 |
| POST | `/user` | 创建用户 |
| PUT | `/user/:id` | 更新用户 |
| DELETE | `/user/:id` | 删除用户 |

### AI 问答

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai/chat?question=你好` | 同步问答 |
| GET | `/ai/chat/stream?question=你好` | SSE 流式问答 |

### AI Agent（工具调用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai-corn/chat?query=...` | Agent 同步执行 |
| GET | `/ai-corn/chat/stream?query=...` | Agent SSE 流式执行 |

Agent 可用工具：

- `queryUser` — 按用户 ID 查询
- `dbUserCrud` — 用户数据库增删改查
- `sendMail` — 发送邮件
- `web_search` — 联网搜索（博查）
- `timeNow` — 当前服务器时间
- `cronJob` — 添加 / 列表 / 启停定时任务

示例：

```bash
# 查询用户并说明
curl "http://localhost:3000/ai-corn/chat?query=查询用户001的信息"

# 搜索并整理成邮件（需配置邮件与搜索 Key）
curl "http://localhost:3000/ai-corn/chat?query=搜索今天AI新闻，整理成HTML发到you@example.com"
```

SSE 调试页：启动后访问 `http://localhost:3000/sse-test.html`。

## 脚本

```bash
pnpm run start:dev    # 开发 + HMR
pnpm run build        # 编译
pnpm run start:prod   # 生产运行
pnpm run lint         # oxlint
pnpm run lint:fix    # 自动修复
pnpm run format       # oxfmt
pnpm run test         # 单元测试
pnpm run test:e2e     # e2e
pnpm run test:cov     # 覆盖率
```

## 目录结构

```
src/
├── ai/           # 简单 LLM Chain
├── ai-corn/      # 带工具的 Agent
├── book/         # 图书模块示例
├── job/          # 定时任务
├── tool/         # LangChain Tools
├── user/         # 用户模块
├── app.module.ts
└── main.ts
public/
└── sse-test.html # SSE 调试页
```

## License

UNLICENSED（私有项目）
