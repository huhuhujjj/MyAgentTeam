# MyAgentTeam

MyAgentTeam 是一个运行在浏览器中的个人多 Agent 工作台。用户可以选择内置场景或自定义团队，让多个角色按顺序、分阶段或并行协作，并查看过程、成本与任务记录。

项目目前是个人作品和可运行的 V1 Demo，适合体验多 Agent 编排、研究前端架构和作为个人作品集。它不提供托管模型额度、账号系统、团队协作服务或生产级 SLA。真实模型调用需要用户自行配置厂商 API Key；不配置 Key 时可以使用模拟模式。

## 功能概览

- 内置规划、分析、学习、创意、决策、写作和起底等场景，另有自定义团队及多种编排模式。
- 多家模型接入：OpenAI、Anthropic、通义千问、DeepSeek、豆包和 Gemini；具体模型以应用内选择器为准。
- 动态模型发现：保存 API Key 后自动拉取厂商 `/v1/models`，新模型自动出现、退役模型自动隐藏，结果本地缓存 24 小时；手动填写的自定义模型始终保留。
- Agent 流式输出、工具调用、联网搜索、任务历史、项目空间和跨会话记忆。
- Token 与成本估算、预算限制、暂停/继续/取消、错误提示和超时处理。
- 浏览器本地数据持久化；首次保存 API Key 时会引导设置主密码，用 Web Crypto API（PBKDF2 + AES-GCM 256）加密 API Key 与记忆库，也可选择跳过。
- 模拟模式无需 API Key，可用于无费用地体验主要交互。

## 快速开始

### 本地运行

需要 Node.js 和 npm。安装依赖后启动静态文件服务器：

```bash
npm ci
npm run serve
```

打开 `http://localhost:5173`。部分浏览器功能和 Web Crypto API 需要安全上下文，建议使用 localhost 或 HTTPS，不要依赖 `file://` 直接打开。

不需要构建前端 bundle。页面通过 `index.html` 按顺序加载 `src/` 下的浏览器脚本。

### 配置模型

在应用设置中填入相应模型厂商的 API Key 和模型 ID。模型 API 由浏览器直接请求厂商；豆包 Ark 在已部署环境下通过 `api/proxy/ark.js` 做同源流式透传，以解决浏览器跨域限制。此代理会转发用户提供的 Authorization 请求头，因此部署者应将其视为经过服务端网络的一次 API 请求，不应将其描述为“请求完全不经过服务器”。

联网搜索工具还需要 Tavily Key。未配置真实 API Key 时，应用会使用模拟响应。

### 本地加密

首次保存真实 API Key 时，应用会引导设置主密码（可跳过）。设置后，API Key、项目上下文与记忆库会以 `ENC1:` 密文写入 localStorage（PBKDF2 10 万次派生 + AES-GCM 256），会话密钥缓存在 sessionStorage。新会话打开时会要求输入主密码解锁；忘记主密码无法恢复这些加密数据。可在设置面板随时开启或关闭加密（关闭后回到明文存储）。测试环境下用 `npm test` 验证，当前 77 项单测全通过。

### 部署

项目包含 `vercel.json` 与 Vercel Edge Function。连接 Vercel 后，可使用：

```bash
npx vercel
npx vercel --prod
```

其他静态托管平台可托管前端文件；豆包 Ark 的生产请求还需要部署兼容的同源代理。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，无 React/Vue 构建链。
- 模块：`src/` 下采用 IIFE 和 `window.MAT_*` 命名空间，依赖由 `index.html` 中的 script 顺序明确控制。
- 模型：浏览器 `fetch`、厂商 REST API 与 SSE 流解析。
- 服务端：仅有 `api/proxy/ark.js` 这条 Vercel Edge 透传路径，不承担 Agent 编排或持久化。
- 持久化：浏览器 `localStorage`、`sessionStorage` 和 IndexedDB。
- 测试：Vitest 单元测试、Playwright 浏览器测试，以及页面内 smoke runner。

详细模块图、调用流程、数据边界、修改指南和已知维护事项见 [ARCHITECTURE.md](./ARCHITECTURE.md)。设计背景、实现细节和阶段记录见 [DESIGN_DOC.md](./DESIGN_DOC.md)、[TECHNICAL_MANUAL.md](./TECHNICAL_MANUAL.md)、[BLOG.md](./BLOG.md) 与 [CHANGELOG.md](./CHANGELOG.md)。

## 数据与安全边界

- 项目没有自己的用户账号或云数据库。任务、配置、记忆和 API Key 默认保存在当前浏览器配置文件中。
- Web Crypto 加密是本地静态数据保护措施，不是 XSS 防护，也不能防止当前页面运行时的恶意脚本读取解密后的数据。浏览器扩展、恶意依赖或设备被控制时仍可能暴露数据。
- 普通模型请求由用户浏览器直接发送给模型厂商；Ark 代理请求会经过部署者的 Edge Function。联网搜索会把查询发送给 Tavily。
- 使用前应阅读对应模型和搜索服务的条款，并为 API Key 设置额度限制。不要在共享或不可信设备保存密钥。
- `api/proxy/ark.js` 是公开部署端点。当前配置依赖 Ark Key 才可转发，但上线前仍应检查平台限流、允许来源、错误响应和日志策略。

## 开发与维护

```bash
npm test                 # Vitest 单测
npm run test:e2e         # Playwright 浏览器测试
npm run test:e2e:install # 首次安装 Playwright Chromium
```

运行测试前确认本地 Python 可用于 Playwright 配置中的静态服务器。维护时优先阅读 [ARCHITECTURE.md](./ARCHITECTURE.md)，新增浏览器模块时同步更新 `index.html` 的脚本顺序，并为纯逻辑新增或更新单元测试。

## 许可

仓库当前未声明开源许可证。除非仓库所有者添加明确的 LICENSE 文件，否则请将代码视为保留所有权利，不应假设可以再分发或用于商业用途。
