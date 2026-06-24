# AI 知识助手

> 基于 Claude API 的全栈 AI 知识问答平台，支持多轮对话、会话管理与知识库文档管理。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite |
| 后端 | Node.js + Express + Prisma ORM |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） |
| AI | Anthropic Claude API |
| 状态管理 | Zustand |

## 核心功能

- 🤖 **AI 对话** — 基于 Claude 的流式多轮对话，支持 Markdown 渲染
- 💬 **会话管理** — 创建、切换、删除对话历史
- 📚 **知识库** — 上传/创建文档，支持 .txt / .md / .json
- 🔐 **用户系统** — 注册/登录，JWT 认证

## 快速开始

### 1. 后端启动

```bash
cd backend
cp .env.example .env          # 填写 ANTHROPIC_API_KEY
npm install
npm run prisma:migrate        # 初始化数据库
npm run dev                   # http://localhost:3001
```

### 2. 前端启动

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## 项目结构

```
ai-knowledge-assistant/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express 入口
│   │   ├── lib/prisma.ts     # Prisma 客户端
│   │   ├── middleware/       # 错误处理、JWT 认证
│   │   └── routes/           # auth / sessions / chat / documents
│   └── prisma/schema.prisma  # 数据库模型
└── frontend/
    └── src/
        ├── pages/            # Login / Register / Chat / Documents
        ├── components/       # Layout
        ├── store/            # Zustand stores
        ├── lib/api.ts        # Axios API 客户端
        └── types/            # TypeScript 类型定义
```

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET  | /api/auth/me | 获取当前用户 |
| GET  | /api/sessions | 会话列表 |
| POST | /api/sessions | 创建会话 |
| POST | /api/chat/:sessionId/message | 发送消息（流式） |
| GET  | /api/documents | 文档列表 |
| POST | /api/documents | 上传/创建文档 |
