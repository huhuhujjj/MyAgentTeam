# MyAgentTeam · V1 单页 Demo

> **🎯 项目定位（先读这一句）**
> 这是一个**个人作品 / 工程能力展示项目**，不是商业产品。核心价值在于 **30+ 个 F+ 迭代编号 + [BLOG.md](./BLOG.md) 6 幕工程心路**——真实记录了"撤回、bug 复发、与生产对话"的迭代过程。
> 架构刻意选择 **0 后端 · 浏览器直连厂商 API**：你的 Key 只在本地 localStorage，不经任何中间服务器。这是隐私优先的设计取舍，也意味着它**不以商业化为目标**（无订阅、无锁定）。
> 适合：求职作品集 / 学 multi-agent 编排 / 自带 Key 的中度用户。**不适合**：要求生产级 SLA 的商业场景。

> 设计档案 v4.5 V1 范围的可运行实现。一个 HTML + 一个 CSS + 一个 JS（拆为 26 模块），浏览器直接打开。

> **F+12.2 起底场景 + 项目空间 + 生产稳定**：新增 🔍 起底场景（人/物/事客观档案，3 搜证 Agent + 档案整理 9 段强制 web_search + 永不下结论）+ 项目空间完全隔离多主题（📌 项目上下文 / 👤 用户画像 / 🧠 Agent 记忆 / 📜 历史按项目过滤）+ 每项目独立颜色标识 + 决策场景实战压测修复 13+ 国内模型 bug + UI 看不清修复（dropdown 用未定义 CSS 变量退白底）→ 见 [CHANGELOG.md](./CHANGELOG.md) F+1~F+12.2 与 [TECHNICAL_MANUAL §16](./TECHNICAL_MANUAL.md)。

> **F+13 工程化重构 Sprint 1/1.5/2/3**：单文件 7,140 行 → **20 modules · -49%** + 58 浏览器内 smoke tests + 17 @typedef 类型定义 + SCENE_CONFIGS 抽象（加新场景从 180 行 → 30 行 config）+ src/state/state.js 单一定义源 + jsconfig.json IntelliSense 接入。`?test=1` URL 触发测试，0 生产影响。详见 [TECHNICAL_MANUAL §17](./TECHNICAL_MANUAL.md#17-f13-工程化重构sprint-1--1.5--2--3)。

> **🎯 当前状态：F+22 · 30+ 个生产稳定 F+ 修复 · Sprint 4 模块化完成 · 26 个模块**

## 最近迭代亮点（F+13 → F+22）

- **F+17 系列 16 步 · 模型下拉用户驱动演化** ⭐⭐⭐
  从智能感知（🔑/⚠/✓）→ 自定义 model ID → 删除/永久移除/重置后门反复 → 完全砍掉 hardcode 列表 → 按 vendor 分组。**13 次用户反馈推着改**，最终落地"hardcode = 数据会过期 / ✏️ 填自定义入口 = 机制永远活"。

- **F+18 / F+18.1 · 历史任务全面升级（12 项）**
  ✏️ 编辑后重跑 + 场景/时间 chip 筛选 + 📋 复制 + 📥 导出 .md + ⭐ 收藏置顶 + ☑ 批量 + 👁 加载到主区 + 搜索范围切换。

- **F+14 系列 · ARK CORS hybrid 透明代理 + server.message 显示**
  豆包 ARK 不返 CORS → 80 行 Vercel Edge Function pass-through，localhost 直连 / 生产 same-origin。F+14.3 通用提取 vendor error.message → 错误诊断从"猜"变"看"。

- **F+16 · multi-phase critical bug**
  `content: []` 被 OpenAI/Claude 宽容掩盖，**豆包严格校验直接暴露** → multi-vendor 架构 = 自我免疫系统。

- **F+20 · 运行中任务可查看 + 明确停止入口**
  runningBadge HTML 写了但 0 处切换 visible → 用户找不到回任务的入口。"← 返回"按钮实际 abort 但文字不暗示 → 改 ⏹ 停止并返回。

- **F+21 · API Key 👁 显示/隐藏切换**
  通用 JS 自动给所有 type=password 加 toggle，0 处改 HTML。

- **F+22 Sprint 4 · 模块化精细化** ⭐
  按 git blame 频率拆 3 块 hot zone（model_picker.js / history.js / memory/learning.js）。**app.js 4498 → 3519 行（-22%）· 26 模块**。runMemoryHygiene 等强耦合代码**不拆** ——"完美模块化"是工程师 ego，"够用"是产品判断。

> 完整迭代见 [CHANGELOG.md](./CHANGELOG.md) F+1 ~ F+22（30+ 编号）· 工程心路叙事见 [BLOG.md](./BLOG.md)（6 幕 5000+ 字）。

## 一句话

用一句话指挥多 Agent 群聊完成任务——开箱即用，3 分钟内完成首个多 Agent 协作。

## 怎么跑

### 本地打开
直接双击 `index.html` 用 Chrome / Edge / Firefox 打开即可。无需 npm install、无需后端。

> ⚠️ 用 `file://` 协议打开就行，不需要起本地服务器。CDN 加载的 marked / DOMPurify 需要联网。

### 部署到 Vercel（让外部用户也能访问）

设计档案 §5 指定的方案。一条命令：

```bash
cd C:\Users\zxh18\MyAgentTeam
npx vercel
```

首次运行会提示：
1. **登录**：选 GitHub / Email，点确认链接即可
2. **Set up and deploy**：回车（用当前目录）
3. **Which scope**：选你的账户
4. **Link to existing project**：N
5. **Project name**：回车用 `myagentteam`（或自定）
6. **Directory**：回车用 `./`
7. **Modify settings**：N

完成后会输出 `https://myagentteam-xxx.vercel.app` —— 这就是公网 URL。

后续更新只需：

```bash
npx vercel --prod
```

### 外部访问的安全提醒

外部用户访问公网 URL 时：
- **API Key 由每个用户自己输入**（不存在你的服务器上）
- Key 仅存在**该用户自己浏览器**的 localStorage，不上传
- LLM 请求由**用户浏览器直连** OpenAI / Anthropic，不经过你的 Vercel 服务器
- 所以你不会承担任何用户的 Token 费用 ✅

如果想让用户无需 Key 也能体验：默认模拟模式已覆盖此场景。

### 备选方案

- **快速分享 / 临时演示**（30 分钟内）：`cloudflared tunnel --url http://localhost:5173`，得到 trycloudflare.com 临时 URL，关机即失效
- **GitHub Pages**：`git init && git remote add origin <repo> && git push`，在仓库 Settings → Pages 开启
- **Netlify / Cloudflare Pages**：把项目拖到 https://app.netlify.com/drop 或用 `npx wrangler pages deploy .`

## 两种模式

| 模式 | 触发条件 | 行为 |
|------|---------|------|
| **真实 API 模式** | 在「设置」中填入 OpenAI / Anthropic / 通义千问 任一 API Key | 浏览器直连 LLM 厂商，真实流式输出，真实计费 |
| **模拟模式** | 不填 Key（默认） | 使用预脚本 Agent 回复，模拟流式打字，**无任何 API 调用、无任何费用** |

### 支持的模型

| 厂商 | 模型 | 输入价 | 输出价 | 上下文 | Key 格式 |
|------|------|--------|--------|--------|----------|
| OpenAI | gpt-4o-mini | $0.15/M | $0.60/M | 128K | `sk-...` |
| OpenAI | gpt-5-mini ⚡ | $0.25/M | $2.00/M | 256K | `sk-...` |
| OpenAI | gpt-4o | $2.50/M | $10.00/M | 128K | `sk-...` |
| OpenAI | gpt-5 ⚡ | $1.25/M | $10.00/M | 256K | `sk-...` |
| OpenAI | o3-mini ⚡ | $1.10/M | $4.40/M | 200K | `sk-...` |
| OpenAI | o3 ⚡ | $2.00/M | $8.00/M | 200K | `sk-...` |
| Anthropic | claude-haiku-4-5 ⚡ | $1.00/M | $5.00/M | 200K | `sk-ant-...` |
| Anthropic | claude-sonnet-4-5 ⚡ | $3.00/M | $15.00/M | 200K | `sk-ant-...` |
| Anthropic | claude-opus-4-5 ⚡★ | $15.00/M | $75.00/M | 200K | `sk-ant-...` |
| Anthropic | claude-3-5-sonnet | $3.00/M | $15.00/M | 200K | `sk-ant-...` |
| Anthropic | claude-3-5-haiku | $0.80/M | $4.00/M | 200K | `sk-ant-...` |
| 阿里通义千问 | qwen3-turbo ⚡ | $0.05/M | $0.20/M | 128K | `sk-...` |
| 阿里通义千问 | qwen3-plus ⚡ | $0.40/M | $1.60/M | 128K | `sk-...` |
| 阿里通义千问 | qwen3-max ⚡ | $1.60/M | $6.40/M | 256K | `sk-...` |
| 阿里通义千问 | qwen-turbo | $0.042/M | $0.084/M | 8K | `sk-...` |
| 阿里通义千问 | qwen-plus | $0.112/M | $0.280/M | 128K | `sk-...` |
| 阿里通义千问 | qwen-max | $0.336/M | $1.344/M | 32K | `sk-...` |
| 阿里通义千问 | qwen-long | $0.070/M | $0.280/M | 10M | `sk-...` |
| DeepSeek | deepseek-chat（V3）| $0.27/M | $1.10/M | 64K | `sk-...` |
| DeepSeek | deepseek-reasoner（R1）| $0.55/M | $2.19/M | 64K | `sk-...` |
| 豆包（火山引擎） | doubao-seed-2-0-lite-260428 ⚡ | $0.042/M | $0.084/M | 32K | ARK 密钥 |
| 豆包（火山引擎） | doubao-seed-2-0-pro-260215 ⚡ | $0.112/M | $0.280/M | 256K | ARK 密钥 |
| Google Gemini | gemini-2.5-flash-lite ⚡ | $0.10/M | $0.40/M | 1M | `AIza...` |
| Google Gemini | gemini-2.5-flash ⚡ | $0.30/M | $2.50/M | 1M | `AIza...` |
| Google Gemini | gemini-2.5-pro ⚡ | $1.25/M | $10.00/M | 2M | `AIza...` |
| Google Gemini | gemini-2.0-flash-lite | $0.075/M | $0.30/M | 1M | `AIza...` |
| Google Gemini | gemini-2.0-flash | $0.10/M | $0.40/M | 1M | `AIza...` |

> 通义千问 Key 在 [DashScope 控制台](https://dashscope.console.aliyun.com/apiKey) 申请，Qwen 走 DashScope **OpenAI 兼容模式**（`https://dashscope.aliyuncs.com/compatible-mode/v1`）。
>
> DeepSeek Key 在 [DeepSeek 平台](https://platform.deepseek.com/api_keys) 申请，走官方 **OpenAI 兼容 API**（`https://api.deepseek.com/v1`）。
>
> **R1（deepseek-reasoner）的思考过程**会以引用块（`> 🧠 R1 思考过程`）形式实时流式展示，再接最终输出 —— 让用户看到完整推理链，便于评估证据质量（决策场景尤其有用）。
>
> 4 家厂商的 Key 前缀都以 `sk-` 开头（Anthropic 是 `sk-ant-`），但**互不通用**，需各自申请、独立填入。

Demo 的所有功能（场景路由、6 场景对话、决策场景分阶段、用户介入、Token 追踪、成本熔断、错误处理）在两种模式下都能完整体验。模拟模式适合先看交互，再决定要不要接真模型。

## 3 个内置场景（F+11 聚焦 · F+12 起底替换写作）

| 场景 | Agent 组合 | 示例输入 |
|------|-----------|----------|
| 📋 规划 | PM ⇄ 顾问（Reflection × 3）| "规划一个上线方案" |
| ⚖️ 决策 | 3 信息 Agent + 协调（Multi-phase）| "该选 React 还是 Vue" |
| 🔍 起底 | 3 搜证 Agent + 档案整理（Multi-phase）| "起底 xxx 公司 / 查查这个产品 / xxx 是什么来头" |

> **写作场景已从直接选移除**：经 F+12 产品聚焦后写作走自定义团队（5 种编排模式 + 11 预设含完整 4 工序写作 Pipeline）。后台 `runWritingPipeline` 调度函数 + writing_planner/drafter/polisher/proofreader 4 Agent 完整保留，自定义团队可直接引用。

> **🔍 起底场景（F+12）** 是 MyAgentTeam 唯一一个**强制不下结论**的场景。3 个搜证 Agent 分工互补：基础事实档案员（身份/履历/财务/法律记录）+ 时间线整理员（关键事件按时序）+ 第三方记录员（监管/学术/媒体/关联方）；2 轮交叉核验专找矛盾与缺口；最终档案整理员输出 9 段事实档案（主体识别 / 已核实事实 / 时间线 / 公开陈述 / 第三方记录 / 矛盾冲突 / 未核实争议 / 信息缺口 / 来源清单），每条事实必含「事实/来源URL/时间/置信度/类型」五要素。**不评价、不结论、不站队** —— 用户拿到的是一面镜子，自己判断。

> 需要其他场景：用「🛠️ 自定义团队」装配，5 编排模式 + 11 预设可选。底层 SCENE_FLOWS 仍保留分析/学习/创意配置以兼容旧存档。

场景路由会基于关键词自动识别。如果未命中 / 多个匹配 / 置信度不足，会弹出确认对话框。

## V1 实现清单（对应设计档案章节）

- ✅ 单一输入框（不变量「输入框永远在」）
- ✅ 6 场景模板硬编码（设计档案 §4 / §8）
- ✅ 场景路由器（关键词匹配 + 否定词 + "还是"二选一 + 优先级，§15）
- ✅ Agent 群聊顺序模式（场景 1-5，4 轮）
- ✅ **分阶段独立会话**（场景 6，Phase1 3 路并行 → Phase2 群聊 → Phase3 协调裁决，§6）
- ✅ L1 正则校验 + L2 交叉引用校验（§6.3）
- ✅ 协调 Agent 强制结构化输出（§6.5）
- ✅ 上下文溢出策略（场景 6 Phase1 报告摘要注入，§5.1）
- ✅ Token 追踪 + 实时成本面板 + Agent 拆解（§14）
- ✅ 任务前预估对话框 + 任务后实算（§14.2, 14.5）
- ✅ **单任务成本硬熔断**（场景 1-5 $1 / 场景 6 $2，§14.7）
- ✅ Token 预算熔断（场景 1-5 30K / 场景 6 80K，§8.0）
- ✅ 用户介入（最多 3 次） + 决策场景特殊规则（Phase1/3 禁止介入，§16）
- ✅ 暂停 / 继续 / 取消
- ✅ Agent 循环检测（连续 2 轮 < 50 字自动终止，§8.0 V1 简化版）
- ✅ **超时分层**（连接 10s / 单 Agent 60s / Phase1 单 Agent 90s / 整体 3min 或 5min，§10.1）
- ✅ 错误处理 6 种场景（Key 无效 / 超时 / 限流 / 重试 / 网络 / 循环，§10）
- ✅ 流式输出（SSE 解析 OpenAI / Anthropic，§5）
- ✅ Markdown 渲染（DOMPurify 防 XSS，§17.2）
- ✅ Prompt 注入防护（用户输入 `<user_input>` 标签包裹 + 输入长度 ≤ 2000 字，§17.3）
- ✅ API Key mask（仅显示 sk-…xxxx，§17.1）
- ✅ V1 安全声明横幅（§17 V1 底线）
- ✅ localStorage 配置持久化（§9）
- ✅ 累计成本统计（本浏览器）

## V1 不做的事

- ❌ 故障转移 / 自动切换备用模型（V2）
- ❌ 任务断点恢复（V2）
- ❌ 渐进式配置第 2/3 层（V2/V3）
- ❌ LLM 驱动的场景推荐（V3）
- ❌ 后端持久化（localStorage 即可，V2 → SQLite）
- ❌ 月度累计提醒横幅（V2）
- ❌ HollowConsensusDetector / EvidenceQualityAnalyzer（V2，aragora-debate）

## 4 条不变量是否守住

| 不变量 | 实现 |
|--------|------|
| 输入框永远在 | 首屏 textarea 始终存在；任务运行期底部介入输入框可见 |
| 失败不沉默 | 所有错误（API、超时、熔断、循环）均有面向用户的明确文字提示 |
| 配置最小化 | 默认进入模拟模式可直接体验；真实 API 仅需 1 个 Key |
| 结果可追溯 | 结果页保留「查看讨论」入口，可回看完整 Agent 发言；侧栏实时 Agent Token 拆解 |

## 文件结构

```
MyAgentTeam/
├── index.html      # 页面骨架（~210 行）
├── styles.css      # 样式系统 + Agent 配色（~610 行）
├── app.js          # 全部业务逻辑（~1630 行）
└── README.md       # 本文件
```

## 安全声明

V1 的安全边界（设计档案 §17）：

- API Key 以**明文**形式存储于浏览器 localStorage —— 不要在公共设备使用
- Key 仅在浏览器 → LLM 厂商之间直接传输，不经过任何中间服务器
- 所有 Markdown 输出经 DOMPurify 清洗（禁用 `<script>` / `<iframe>` / `on*` 属性）
- 用户输入用 `<user_input>` 标签包裹，prompt 中明确要求 Agent 忽略其内部的指令性内容
- 单次输入长度上限 2000 字

V2 计划升级：HttpOnly Cookie 存储 Key、PBKDF2 加密、敏感信息检测、CORS 配置化。

## 已知限制

- Anthropic 直连浏览器需要 `anthropic-dangerous-direct-browser-access` 头（这是 V1 的过渡方案，V2 会迁到后端代理）
- 模拟模式的 Agent 回复是预脚本的，不会真的"理解"输入 —— 仅用于演示交互
- Token 估算使用粗粒度规则（中文 1 字≈1.5 token，英文 4 字符≈1 token），真实 API 模式下以 LLM 返回的 usage 字段为准
