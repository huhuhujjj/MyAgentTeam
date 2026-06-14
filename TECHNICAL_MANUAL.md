# MyAgentTeam · 技术手册

> 完整产品参考文档 · F+ 版本
> 适用对象：用户、开发者、贡献者

---

## 目录

1. [架构总览](#1-架构总览)
2. [快速上手](#2-快速上手)
3. [3 个内置场景](#3-3-个内置场景-f11-聚焦--f12-起底)
4. [5 种编排模式](#4-5-种编排模式)
5. [自定义团队](#5-自定义团队)
6. [长程会话记忆](#6-长程会话记忆)
7. [Agent 工具调用](#7-agent-工具调用)
8. [6 厂商 · 27 模型](#8-6-厂商--27-模型)
9. [Token 与成本](#9-token-与成本)
10. [安全与隐私](#10-安全与隐私)
11. [数据持久化](#11-数据持久化)
12. [部署](#12-部署)
13. [故障排查](#13-故障排查)
14. [架构内部细节](#14-架构内部细节)
15. [扩展开发](#15-扩展开发)
16. [F+ 生产稳定性升级（F+1 ~ F+12.2）](#16-f-生产稳定性升级f1--f122)
17. [F+13 工程化重构（Sprint 1 / 1.5 / 2 / 3）](#17-f13-工程化重构sprint-1--1.5--2--3)

---

## 1. 架构总览

### 产品定性

MyAgentTeam 是一个**「Workflow 为主、Agent 为辅」的混合架构**：

```
工作流层（85-95%）：编排顺序、轮次、Phase 全由代码决定
   ↓
节点内 Agent 层（5-15%）：每个节点内的 LLM 可自主决定 tool_calls（最多 5 次循环）
```

按 Anthropic《Building Effective Agents》分类法：
- 整体属于 **Orchestrator-Workers / Parallelization / Routing / Evaluator-Optimizer** workflow 组合
- 节点内含 **简化 ReAct loop**（工具调用循环）

### 技术栈

| 层 | 选型 |
|---|---|
| 前端 | 纯 HTML + Vanilla CSS + Vanilla JS（无构建步骤）|
| LLM 协议 | OpenAI function calling 标准 + Anthropic native 兼容 |
| Markdown | marked CDN |
| XSS 防护 | DOMPurify CDN |
| 加密 | Web Crypto API（PBKDF2 + AES-GCM） |
| 持久化 | localStorage + IndexedDB（大数据迁移）|
| 部署 | 静态站，Vercel / Netlify / GitHub Pages 任选 |

### 文件结构

```
MyAgentTeam/
├── index.html       (~870 行) UI 骨架 + 介绍页
├── styles.css       (~1700 行) 完整样式系统
├── app.js           (~5800 行) 全部业务逻辑
├── package.json     测试依赖
├── tests/           Vitest + Playwright 测试套件
├── vercel.json      Vercel 部署配置
└── 文档：
    ├── README.md
    ├── TECHNICAL_MANUAL.md（本文件）
    └── CHANGELOG.md
```

---

## 2. 快速上手

### 5 分钟上手（最快路径）

1. 双击 `index.html` 用 Chrome / Edge / Firefox 打开（或访问已部署的 URL）
2. 点右上角 ⚙ → 填入任一厂商 API Key
3. 回到首页，输入框写任务，或点 6 个场景 chip 之一
4. 看 Agent 流式讨论 → 拿结果

### 决策 / 分析 / 写作 任务额外步骤

这 3 个场景的事实可信度高度依赖联网搜索，强烈推荐配置：

1. 访问 https://app.tavily.com/home → Google 30 秒注册
2. 复制 `tvly-...` 开头的 Key
3. 设置面板「🔧 Tavily Search API Key」粘贴
4. 启动场景时会看到 "🔧 F+ 强制启用 web_search" 提示

### 完全无 Key 也能体验

不配任何 Key → 系统进入**模拟模式**：
- Agent 回复是预脚本（不真调 LLM）
- 流式打字效果保留
- 适合先看 UI 再决定要不要接真模型
- 0 费用、0 风险

---

## 3. 3 个内置场景（F+11 聚焦）

每个场景已**自动匹配最合适的编排模式**，不需要用户选。**F+11 产品聚焦**：从 6 个场景精简到 3 个核心，每个都做到生产可用。需要其他场景请用「自定义团队」（5 编排模式 + 11 预设）。

| 场景 | icon | 编排模式 | Agent 数 | 轮次 | F+ 强制工具 |
|------|:--:|------|:--:|:--:|:--:|
| 写作 | 📝 | Pipeline | 4 工序 | 1 遍 | ✅ |
| 规划 | 📋 | Reflection | 2 | 3 轮 | ❌ |
| 决策 | ⚖️ | Multi-phase | 4 | Phase 1+2+3 | ✅ |

> **已从 UI 入口移除的 3 个场景**：📊 分析、📚 学习、💡 创意。底层 `SCENE_FLOWS` / Agent definitions（analyst / industry / teacher / student / creative / reviewer）/ 调度函数（runAnalysisScene 等）**全部保留**，自定义团队仍可引用相关 Agent，避免破坏旧存档。

### 3.1 写作（Pipeline）

```
选题策划 → 撰稿 → 润色 → 校对
   ↓        ↓      ↓      ↓
  [建议]  [强制]  [建议]  [强制]
```

| Agent | 工具策略 | 任务 |
|-------|---------|------|
| writing_planner | 建议 web_search | 输出 5 段写作蓝图（选题/读者/论点/3 级大纲/下游提示）|
| writing_drafter | **强制** web_search 引数据 | 严格遵大纲扩写 800-1500 字正文 |
| writing_polisher | 建议 web_search 校术语 | 5 维度润色（句式/关键词/衔接/口语化/简洁）|
| writing_proofreader | **强制** web_search + web_fetch | 5 维校对（事实/术语/逻辑/语法/格式）+ 可发布度评分 |

### 3.2 规划（Reflection 3 轮）

```
PM 创作 → 顾问评 → PM 修订 → 顾问再评 → PM 终稿
```

| Agent | 工具策略 | 任务 |
|-------|---------|------|
| pm（项目经理 creator）| 走全局开关 | 5 段方案（目标/阶段/任务清单/决策门/风险）|
| advisor（执行顾问 critic）| 走全局开关 | 5 维评审 + Go/Hold/NoGo 决策 |

### 3.3 决策（Multi-phase，F+ 标杆场景）

```
Phase 1（3 Agent 并行 + 强制工具）：
  ├─ A 正面 [web_search 真实支持证据]
  ├─ B 反面 [web_search 真实反对证据]
  └─ C 独立视角 [假设挑战 + 重构警示 + 客观基准]
        ↓
Phase 2（A B 群聊 + 不调工具）：基于 Phase 1 摘要交叉质证
        ↓
Phase 3（coordinator + 强制工具）：
  1. 列裁决依赖的 3-5 条关键事实
  2. web_search 二次核查
  3. 按 8 段论述结构裁决（结论后置在第 7 段）
```

详见 [4.5 Multi-phase 多阶段](#45-multi-phase-多阶段编排)。

---

## 4. 5 种编排模式

### 4.1 Sequential 顺序

```
A → B → A → B → ... 循环 N 轮
```

- 每个 Agent 看到完整对话历史
- 适合：协作型讨论、辩论、反复迭代
- 默认轮次 4

### 4.2 Pipeline 流水线

```
A → B → C → D 线性 1 遍
```

- 每个 Agent 只看「原始任务 + 上一道工序的产出」
- 不循环，工序数 = Agent 数
- 适合：写作流水、翻译校对、代码生成审查
- 不需要 rounds 字段

### 4.3 Reflection 反思

```
创作 → 评 → 改 → 评 → ... → 终稿
```

- 必须 2 Agent：1 个 `role: 'creator'` + 1 个 `role: 'critic'`
- 创作者每轮给"完整新版"（不是补丁）
- 评论者只点评不重写
- 适合：单产出的反复打磨（文案 / 代码 / 方案）

### 4.4 Hub-Spoke 中心辐射

```
中心 → 提问 → N 专家分别答 → 中心整合
```

- 1 个 `role: 'hub'` + ≥1 个 `role: 'spoke'`
- N 个咨询循环（默认 1）
- 适合：模糊问题需多视角专家共同破局

### 4.5 Multi-phase 多阶段编排

**这是最复杂的模式，对应内置决策场景**：

```
Phase 1（≥1 Agent，phase:1）: 并行独立取证，互相不可见
   ↓
   摘要每报告前 500 字符（V1 简化版裁剪）
   ↓
Phase 2（≥0 Agent，phase:2）: 群聊交叉质证，2 轮，可见 Phase 1 摘要
   ↓
Phase 3（恰好 1 Agent，phase:3）: 独立裁决
```

**配置约束**：
- Phase 1 至少 1 个 Agent
- Phase 3 必须**恰好** 1 个 Agent
- Phase 2 可 0 个（直接跳到裁决）
- 启动前 UI 自动校验

**为什么不直接群聊**：避免从众效应。Phase 1 的"结构性隔离"是 Anthropic Decision-Making 论文核心思想 —— 独立观点 → 暴露后交锋 → 中央裁决。

---

## 5. 自定义团队

进入：首屏「🛠️ 自定义团队」chip。

### 5.1 团队构建器

- 1-4 个 Agent
- 每个独立：名字 / 身份描述 / 模型 / 颜色 / 头像（可选上传）/ 工具开关
- 编排模式 5 选 1
- 实时校验（违规时启动按钮变灰 + 提示）

### 5.2 团队库

- 多套团队配置同时保存（如"周报队"、"决策辩论队"）
- 下拉切换
- 命名重复时覆盖确认

### 5.3 模板库

- 身份描述可保存为模板（10 内置 + 用户自建）
- 模板搜索框
- 内置不可删，用户自建可删

### 5.4 11 套精选预设

| 预设 | 编排模式 | Agent 数 | 适用 |
|------|------|:--:|------|
| ⚖️ 三方对抗辩论（顺序）| Sequential | 3 | 决策类 |
| 🏛 三方辩论（多阶段，F+）| Multi-phase | 6 | 高质量决策 |
| 📊 多视角分析 | Sequential | 4 | 竞品 / 市场 |
| ✍️ 写作流水线 | Pipeline | 4 | 长文 / 报告 |
| 🪞 反思打磨 | Reflection | 2 | 文案 / 代码迭代 |
| 🎙 多专家问诊 | Hub-Spoke | 4 | 模糊问题 |
| 🎓 苏格拉底学习 | Sequential | 2 | 深度概念 |
| 🔬 四厂商对照 | Sequential | 4 | 模型对比 |
| 🎨 创意三人组 | Sequential | 3 | 命名 / slogan |
| 💰 经济型团队 | Sequential | 2 | 日常轻任务 |
| 🧠 深度推理团队 | Sequential | 2 | 复杂决策 |

---

## 6. 长程会话记忆

5 个独立记忆源，每个可独立开关 + 设置 token 预算上限。

### 6.1 5 个记忆源

| 源 | 何时注入 | 默认软上限 | 默认开关 | 数据来源 |
|----|---------|:--:|:--:|------|
| 项目上下文 | 每个 Agent | 800 token | ON | 用户手填 ≤500 字 |
| 用户画像（自学）| 每个 Agent | 400 token | ON | LLM 摘要任务后自动学 |
| 引用过往任务 | 选定的任务 | 600 token | 启动时勾 | 历史任务 |
| 知识库（RAG）| 召回 top-3 chunk | 800 token | ON | 用户上传 .txt/.md |
| Agent 个体记忆 | 该 Agent | 300 token | OFF | LLM 摘要 + 用户管理 |

### 6.2 自动学习用户画像

每次任务结束后自动用便宜模型（gpt-4o-mini / qwen-turbo 等）摘要"关于用户的新事实"：
- 不可超过 30 字
- 自动去重（Jaccard ≥ 0.7 视为重复）
- 自动过期（30 天软删除）
- FIFO 上限 20 条
- 设置面板可单条删除

### 6.3 自动关联推荐（用户可关）

启动任务时按关键词在历史搜 top-3 相关，弹"以下任务可能相关"。设置面板「enableAutoRelate」可关闭。

### 6.4 任务延续

任务运行中刷新页面 / 切走，会序列化到 `myAgentTeam.activeTask`。下次打开首页检测到未结束任务（1 天内）→ 顶部横幅「⏯ 继续未完成的任务」。

### 6.5 记忆 hygiene

启动时自动跑：
- 过期清理（30 天）
- Jaccard 去重
- 一正一反冲突检测（"喜欢 X" vs "不喜欢 X"）

设置面板「🧹 立即清理」按钮可手动触发。

### 6.6 Token 预算调度

- 总预算默认 1500 token
- 每源独立软上限
- 注入时按优先级裁剪：项目上下文 > 用户画像 > 引用任务 > 知识库 > Agent 记忆
- 成本预估对话框显示"💭 记忆消耗"明细

---

## 7. Agent 工具调用

### 7.1 3 个内置工具

#### web_search
- 后端：Tavily API
- 需要：Tavily Key（设置面板 → tavilyKey 字段）
- 免费额度：1000 次/月
- 输入：`{query: string, count?: number}`
- 输出：`{query, count, results: [{title, url, description, score}]}`

#### web_fetch
- 后端：Jina Reader (`https://r.jina.ai/`)
- 免 Key
- 输入：`{url: string}`
- 输出：`{url, content (markdown, ≤8000 字符), length, truncated}`

#### date_now
- 纯本地 JS
- 输入：`{}`
- 输出：`{iso, local, weekday, timezone, unix}`

### 7.2 工具调用循环

```
runAgent(agent, msg, history, opts)
  → callLLM(..., tools: [3 个 schema])
       ↓
  模型回 tool_calls
       ↓
  for each call:
    ui.delta(`🔧 ${name}(${args})`)
    executeToolCall(call) → string
    ui.delta(`└─ ${result.slice(0,200)}…`)
    messages.push({role:'tool', tool_call_id, content})
       ↓
  callLLM(messagesOverride: messages)
       ↓
  没新 tool_calls → 返回 final text
  有 tool_calls → 循环（最多 5 次）
```

### 7.3 F+ 强制工具规则

设计原则：**事实依赖度高的场景默认强制工具**。

```js
// SCENE_FLOWS 标志
const SCENE_FLOWS = {
  writing:  { ..., forceTools: true },   // F+
  analysis: { ..., forceTools: true },   // F+
  decision: { ..., forceTools: true },   // F+
  planning: { ... },                     // 不强制
  learning: { ... },                     // 不强制
  creative: { ... },                     // 不启用
};

// runAgent 接受 opts.forceTools 绕过全局开关
const tools = opts.forceTools
  ? Object.values(TOOLS).map(t => t.schema)
  : getToolsForAgent(opts.customAgent, opts.sceneId);
```

### 7.4 vendor 工具支持矩阵

| 厂商 | 工具协议 | 备注 |
|------|---------|------|
| OpenAI | ✅ function calling | 原生支持 |
| 通义千问 | ✅ OpenAI 兼容 | DashScope compatible mode |
| DeepSeek | ✅ OpenAI 兼容 | V3 全支持；R1 reasoner F+7 修复后能传 tools，但实际调用稳定性弱于 V3（建议强制工具场景用 V3）|
| 豆包（火山）| ✅ OpenAI 兼容 | ARK API |
| Google Gemini | ✅ OpenAI 兼容 | OpenAI endpoint |
| Anthropic | ⚠️ 暂不支持 | 协议不同，将提示"由其他模型接管" |

### 7.5 安全约束

- 每个 Agent 最多 5 次工具循环（防死循环）· Phase 1 prompt F+5 强制至少 4 次 web_search 充分调研
- 短 ctx 模型（如豆包 lite 32K）累积 input 超 `ctx × 0.6` 时自动折叠最老 tool result，保留最新 1 个完整（F+6 自适应折叠，详见 §16.4）
- Tavily 中文乱码 description F+10 自动过滤为占位提示（详见 §16.5）
- 单工具执行超时 30s
- web_fetch 自动截断 8000 字符（防 token 爆炸）
- 工具返回 JSON 序列化后截断 8000 字符
- 所有工具运行在浏览器内（零后端）

---

## 8. 6 厂商 · 27 模型

| 厂商 | 模型 | 输入价 (USD/M) | 输出价 (USD/M) | 上下文 | Key 前缀 | 工具支持 |
|------|------|----:|----:|:--:|:--:|:--:|
| OpenAI | gpt-4o-mini | 0.15 | 0.60 | 128K | `sk-` | ✅ |
| OpenAI | gpt-5-mini ⚡ | 0.25 | 2.00 | 256K | `sk-` | ✅ |
| OpenAI | gpt-4o | 2.50 | 10.00 | 128K | `sk-` | ✅ |
| OpenAI | gpt-5 ⚡ | 1.25 | 10.00 | 256K | `sk-` | ✅ |
| OpenAI | o3-mini ⚡ | 1.10 | 4.40 | 200K | `sk-` | ✅ |
| OpenAI | o3 ⚡ | 2.00 | 8.00 | 200K | `sk-` | ✅ |
| Anthropic | claude-haiku-4-5 ⚡ | 1.00 | 5.00 | 200K | `sk-ant-` | ⚠️ |
| Anthropic | claude-sonnet-4-5 ⚡ | 3.00 | 15.00 | 200K | `sk-ant-` | ⚠️ |
| Anthropic | claude-opus-4-5 ⚡★ | 15.00 | 75.00 | 200K | `sk-ant-` | ⚠️ |
| Anthropic | claude-3-5-haiku | 0.80 | 4.00 | 200K | `sk-ant-` | ⚠️ |
| Anthropic | claude-3-5-sonnet | 3.00 | 15.00 | 200K | `sk-ant-` | ⚠️ |
| 通义千问 | qwen3-turbo ⚡ | 0.05 | 0.20 | 128K | `sk-` | ✅ |
| 通义千问 | qwen3-plus ⚡ | 0.40 | 1.60 | 128K | `sk-` | ✅ |
| 通义千问 | qwen3-max ⚡ | 1.60 | 6.40 | 256K | `sk-` | ✅ |
| 通义千问 | qwen-turbo | 0.042 | 0.084 | 8K | `sk-` | ✅ |
| 通义千问 | qwen-plus | 0.112 | 0.280 | 128K | `sk-` | ✅ |
| 通义千问 | qwen-max | 0.336 | 1.344 | 32K | `sk-` | ✅ |
| 通义千问 | qwen-long | 0.070 | 0.280 | 10M | `sk-` | ✅ |
| DeepSeek | deepseek-chat（V3）| 0.27 | 1.10 | 64K | `sk-` | ✅ |
| DeepSeek | deepseek-reasoner（R1）| 0.55 | 2.19 | 64K | `sk-` | ✅ |
| 豆包 | doubao-seed-2-0-lite-260428 ⚡ | 0.042 | 0.084 | 32K | ARK token | ✅ |
| 豆包 | doubao-seed-2-0-pro-260215 ⚡ | 0.112 | 0.280 | 256K | ARK token | ✅ |

> **⚠️ 豆包模型 ID 特殊性**：Volcengine ARK 要求模型名包含**日期后缀**（`YYMMDD`）且使用**连字符**（不是点）。
> - **API Key 必须勾选模型权限**：创建 Key 时选「自定义权限策略」→ `Model ID` tab → 勾选 `Doubao-Seed-2.0-pro` 和 `Doubao-Seed-2.0-lite`。
> - **如模型版本被火山更新**：到 [Volcengine 控制台](https://console.volcengine.com/ark) 查最新 ID，在自定义团队 Agent 卡片 model 字段手动填入。
> - **高级方案**：自建 endpoint，把 `ep-20240101-xxxxx` 填入 model 字段（`inferVendor` 自动识别为豆包）。
| Google Gemini | gemini-2.5-flash-lite ⚡ | 0.10 | 0.40 | 1M | `AIza` | ✅ |
| Google Gemini | gemini-2.5-flash ⚡ | 0.30 | 2.50 | 1M | `AIza` | ✅ |
| Google Gemini | gemini-2.5-pro ⚡ | 1.25 | 10.00 | 2M | `AIza` | ✅ |
| Google Gemini | gemini-2.0-flash-lite | 0.075 | 0.30 | 1M | `AIza` | ✅ |
| Google Gemini | gemini-2.0-flash | 0.10 | 0.40 | 1M | `AIza` | ✅ |

> **⚠️ 已移除 `gemini-1.5-pro`**：Google 2025 Q2 起逐步下线 Gemini 1.5 系列。如继续调用会返回 404。已从清单完全移除。如需长上下文（>2M），用 `gemini-2.5-pro`（2M ctx）或 `qwen-long`（10M ctx）。

**所有调用都是浏览器直连厂商 API**，Key 仅在你本地 localStorage 存储与传输，不经任何中间服务器。

---

## 9. Token 与成本

### 9.1 成本追踪

每个任务实时追踪：
- 总输入 / 输出 token
- 按 Agent 拆解（侧栏可视）
- 当前任务费用（实时计算）
- 累计费用（本浏览器，跨任务）
- 进度条与熔断线比例

### 9.2 成本硬熔断

| 场景类型 | 单任务硬上限 |
|---------|:--:|
| 场景 1-5 + 自定义顺序模式 | $1.00 |
| 决策 + 自定义多阶段 | $2.00 |

超出自动停止 + 保留已生成内容 + 弹层"已达费用上限"。

### 9.3 任务前预估

启动任务前弹层显示：
- 预估输入 / 输出 / 总费用
- 选择的模型与厂商
- 「💭 记忆消耗」每源 token 明细
- 是否启用工具（增量预估）
- 「⚡ 实际费用可能浮动 ±30%」提示

### 9.4 模拟模式（0 费用）

不配任何厂商 Key → 全程模拟：
- 流式打字效果保留
- Token / 费用统计仍计算（但实际 $0）
- 适合先看 UI 再决定接 LLM

---

## 10. 安全与隐私

### 10.1 V1 边界

| 项 | 实现 |
|----|------|
| API Key 存储 | 浏览器 localStorage 明文（V2 升级为 PBKDF2+AES-GCM 可选） |
| Key 显示 | UI 与日志中始终以 `sk-…xxxx` mask |
| XSS 防护 | DOMPurify 清洗 Markdown 输出（禁用 script/iframe/on*）|
| Prompt 注入防护 | 用户输入用 `<user_input>` 标签包裹 + 系统提示词明确忽略指令性内容 |
| 输入长度限制 | 2000 字符 |
| CORS 边界 | 浏览器直连每家厂商，绕不开 CORS 的（如 Anthropic）需特殊 header |

### 10.2 加密存储（可选）

设置面板可启用：
- 用户设主密码 → PBKDF2 派生密钥（10 万次迭代）
- AES-GCM 加密 API Keys / userProfile / agentMemories / knowledgeBase
- 派生密钥缓存在 sessionStorage（关窗后清）
- 主密码丢 = 数据丢（无后门恢复）

### 10.3 工具调用的数据流

```
你的查询 → Agent 模型 → tool_calls
                          ↓
              ┌─ web_search → Tavily API（请求含 Key）→ 返回结果
              ├─ web_fetch → Jina Reader（公开服务，无 Key）→ 返回 markdown
              └─ date_now → 本地 JS
                          ↓
              结果 → 模型继续 → 最终输出
```

所有调用直接走你的浏览器 → 第三方服务。**Vercel 等托管方完全不接触你的查询内容**。

### 10.4 隐私控制清单（设置面板）

- 5 个记忆源各自的 toggle
- 启动任务时勾「⚠ 不记忆此任务」
- 「🧹 立即清理记忆」按钮
- 导出 / 导入记忆 JSON
- 清空全部记忆
- 加密开关

---

## 11. 数据持久化

### 11.1 localStorage Keys

| Key | 内容 | 大小级 |
|-----|------|:--:|
| `myAgentTeam.config` | API Keys, 模型选择, agentIcons | 中（含 base64 头像）|
| `myAgentTeam.cumulative` | 累计统计 | 小 |
| `myAgentTeam.history` | 最近 50/100 条任务 | 中-大 |
| `myAgentTeam.customTeam` | 当前编辑中的自定义团队 | 小 |
| `myAgentTeam.teamLibrary` | 所有保存的团队 | 中 |
| `myAgentTeam.tplLibrary` | 用户自建模板 | 小 |
| `myAgentTeam.sceneConfigs` | 内置场景的 per-Agent 模型覆盖 | 小 |
| `myAgentTeam.scenePrompts` | 内置场景的 per-Agent system prompt 覆盖 | 中 |
| `myAgentTeam.memory` | 记忆系统总入口 | 中 |
| `myAgentTeam.projects` | 项目分组 | 小 |
| `myAgentTeam.knowledgeBase` | KB 元数据（chunks 走 IDB）| 小 |
| `myAgentTeam.activeTask` | 未完成任务快照 | 小 |
| `myAgentTeam.introSeen` | 介绍页已看标记 | 1 字节 |

### 11.2 IndexedDB

总数据量 > 3MB 时自动迁移：
- `kb` store: 知识库 chunks（按文档存）
- `history` store: 超过 100 条的历史归档

### 11.3 导入 / 导出

设置面板支持：
- 导出整套配置为 JSON（不含加密 Key）
- 导入 JSON 覆盖配置
- 适合多设备手动同步

---

## 12. 部署

### 12.1 本地双击打开

最简：双击 `index.html` 用 Chrome 打开。能跑大部分功能。
注意：`file://` 协议下某些功能（如 FileReader 部分场景）可能受限，建议跑本地服务器。

### 12.2 本地服务器

```powershell
cd C:\Users\zxh18\MyAgentTeam
python -m http.server 5173
# 浏览器打开 http://localhost:5173
```

### 12.3 Vercel（推荐生产）

```powershell
cd C:\Users\zxh18\MyAgentTeam
npx vercel --prod
```

10 秒拿到 `https://xxx.vercel.app`。零配置。

### 12.4 GitHub Pages / Netlify / Cloudflare Pages

把 `MyAgentTeam/` 文件夹推到 GitHub → 仓库 Settings → Pages 启用 → 拿到 `username.github.io/MyAgentTeam`。

---

## 13. 故障排查

### 13.1 启动任务后没反应

- 检查浏览器控制台报错
- 检查 API Key 是否过期
- 检查模型名是否拼对

### 13.2 工具调用失败

- 错误"未配置 Tavily Search Key" → 设置面板填 Key
- 错误"Tavily HTTP 401" → Key 错或被吊销
- 错误"Tavily HTTP 429" → 超出免费配额（1000/月）

### 13.3 任务超时

- 单 Agent 超时 120s（决策 Phase 1 150s · 决策 coordinator 300s） · F+2 翻倍以适配国内豆包/通义慢响应，F+8 为 coordinator 单设 5 分钟超时覆盖 8 段裁决输出
- 整体任务超时 6min（决策 15min） · F+2 同步翻倍避免 task 级超时反成瓶颈，F+8 决策再加 5 min 覆盖 Phase 1+2+3 累加
- 网络慢 / 厂商 API 慢都可能触发
- 显示"⚠️ Agent 响应超时，跳过本轮"

### 13.4 成本熔断

- 任务跑到一半显示"已达费用上限"
- 已生成内容会保留
- 可在设置面板调高熔断线（V2 功能，当前固定）

### 13.5 浏览器存储满

- localStorage 上限 5-10MB
- 大数据自动迁 IDB
- 真满了：「🗑 清空记忆」或「🗑 清空历史」释放

---

## 14. 架构内部细节

### 14.1 主要函数清单

| 函数 | 职责 |
|------|------|
| `routeScene(text)` | 关键词路由 → 推荐场景 |
| `launchTask(sceneId, userText)` | 任务入口，调度到对应 orchestrator |
| `runGroupChat(sceneId, userText)` | Sequential 模式编排 |
| `runDecisionScene(userText)` | 决策场景多阶段编排（硬编码 3 阶段）|
| `runTeamPipeline(team, userText)` | Pipeline 模式 |
| `runTeamReflection(team, userText)` | Reflection 模式 |
| `runCustomTeamHubSpoke(userText)` | Hub-Spoke 模式 |
| `runCustomTeamMultiPhase(userText)` | 多阶段（自定义版） |
| `runAgent(agentKey, userMsg, history, opts)` | 单 Agent 执行 + 工具循环 |
| `callLLM({...})` | LLM 适配层入口，按 vendor 派发 |
| `callOpenAI / callQwen / callDeepSeek / callDoubao / callGemini` | OpenAI 兼容协议适配 |
| `callAnthropic` | Anthropic native 协议适配 |
| `buildMemoryInjection(opts)` | 5 路记忆注入 + token 预算裁剪 |
| `executeToolCall(call)` | 单 tool_call 执行 |
| `buildBuiltinTeamForScene(sceneId)` | 把内置场景转 customTeam 形状 |

### 14.2 状态对象 `state`

```js
state = {
  config: {              // 用户设置
    openaiKey, anthropicKey, qwenKey, deepseekKey, doubaoKey, geminiKey,
    tavilyKey,
    model,
    remember,
    agentIcons,
    toolsEnabledGlobal,
  },
  cumulative: {...},     // 累计统计
  history: [],           // 历史任务（cap 50）
  customTeam: {...},     // 当前编辑中的自定义团队
  teamLibrary: [],       // 已保存团队
  tplLibrary: [],        // 用户模板
  projects: [],          // 项目分组
  sceneConfigs: {},      // 场景 per-Agent 模型覆盖
  scenePrompts: {},      // 场景 per-Agent system prompt 覆盖
  memory: {              // 长程记忆
    projectContext, userProfile, agentMemories, settings,
  },
  knowledgeBase: {...},  // RAG
  activeProjectId,
  task: null,            // 当前任务（运行时）
  paused: false,
  aborted: false,
};
```

### 14.3 工具调用消息流（OpenAI 标准）

```js
// 1. 初始请求
{
  messages: [
    {role:'system', content:'你是 Agent A...'},
    {role:'user', content:'<user_input>...</user_input>'}
  ],
  tools: [
    {type:'function', function:{name:'web_search', parameters:{...}}}
  ],
  tool_choice: 'auto'
}

// 2. 模型流式返回 tool_calls
{
  choices:[{delta:{
    tool_calls:[{index:0, id:'call_x', function:{name:'web_search', arguments:'{"query":"..."}'}}]
  }}]
}

// 3. 我们执行 + 追加消息
messages.push({role:'assistant', tool_calls:[...]})
messages.push({role:'tool', tool_call_id:'call_x', content:'{...搜索结果...}'})

// 4. 再次请求（loop）
{
  messages: messages,  // 含 tool 消息
  tools: [...]
}

// 5. 直到没有 tool_calls 返回 → 终止
```

---

## 15. 扩展开发

### 15.1 加一个新模型

```js
// 1. MODEL_PRICING 加条目
MODEL_PRICING['new-model'] = { in: 0.10, out: 0.30, ctx: 64000, vendor: 'openai' };

// 2. index.html #defaultModel 加 <option>
// 3. buildModelOptgroups 加（如果不是已有 vendor）
```

### 15.2 加一个新厂商

1. `state.config.fooKey = ''`
2. `MODEL_PRICING` 加模型条目，vendor: 'foo'
3. `callFoo({...})` 函数实现（推荐复用 callOpenAI 的 endpoint 覆盖）
4. `callLLM` 加 dispatch 分支
5. `validateKey` 加新厂商映射
6. `vendorHasKey` 加新厂商
7. UI: 设置面板加 Key 字段 + 模型下拉 optgroup
8. 介绍页厂商网格加一项

### 15.3 加一个新工具

```js
// 在 TOOLS 注册表加条目
TOOLS.my_tool = {
  schema: {
    type: 'function',
    function: {
      name: 'my_tool',
      description: '...',
      parameters: { type: 'object', properties: {...}, required: [...] }
    }
  },
  async execute(args) {
    // 执行逻辑，返回任意可 JSON 序列化对象
    return { result: '...' };
  }
};
```

### 15.4 加一个新编排模式

1. 加 `runCustomTeamMyMode(userText)` 函数
2. `launchTask` 加 dispatch 分支
3. 团队构建器编排模式 select 加 option
4. `refreshTeamModeUI` 加分支
5. 启动校验 `launchCustomTeam` 加规则
6. （可选）加预设进 `PRESET_TEAMS`

---

## 16. F+ 生产稳定性升级（F+1 ~ F+12.2）

> 从决策场景实际跑出来 11 个国内模型场景的具体问题，分 10 个版本陆续修完。这一节按问题类型聚类，给"为什么这么修"的完整数据反推。完整迭代过程见 [CHANGELOG.md](./CHANGELOG.md)。

### 16.1 模型层（F+1 / F+7）

- **F+1 豆包 1.5 → 2.0 全量升级**：MODEL_PRICING 删 `doubao-1-5-*`，加 `doubao-seed-2-0-pro-260215`（256K ctx）和 `doubao-seed-2-0-lite-260428`（32K ctx）。同时加 `inferVendor(modelName)` 函数支持 `ep-xxxxxxxx` 自定义 endpoint 兜底识别为 doubao vendor。
- **F+7 修 DeepSeek R1 漏传 tools**：`callDeepSeek` 的 R1 分支解构 opts 只取 6 个字段，遗漏 `tools` 和 `messagesOverride` → R1 永远收不到 tool definitions → 思考过程显示"我无法真正使用 Tavily 搜索"。已补全 + 加 `tool_choice: 'auto'`。

### 16.2 时间预算（F+2 / F+8）

实测豆包 Seed 2.0 pro 在中国大陆 ARK 区域 ~41 tok/sec，coordinator 8 段裁决 6000-8000 tok 需要 195s+：

| TIMEOUTS 阈值 | F+ 之前 | F+2 调整 | F+8 调整 |
|--------------|--------|---------|---------|
| `singleAgent` | 60s | **120s** | 120s |
| `decisionPhase1Agent` | 90s | **150s** | 150s |
| `coordinatorAgent` | (用 singleAgent) | (同) | **300s** 新增 |
| `taskDefault` | 180s | **360s** | 360s |
| `taskDecision` | 300s | 600s | **900s** |

F+8 还在 `runDecisionScene` 的 coordinator 调用补传 `timeoutMs: TIMEOUTS.coordinatorAgent`。

### 16.3 输出预算（F+3 / F+4）

`MAX_TOKENS_PER_TURN: 1500 → 8000`

- 之前 1500 砍掉 coordinator 8 段裁决的后半 ⑤⑥⑦⑧
- 8 段实测约 6570 tokens（高密度证据评估场景），留 20% 余量定 8000
- 其他 Agent 实际输出由 prompt 决定，上限提升不会让短输出被动变长
- 副作用：对昂贵模型（Claude Opus 4.5 $75/M output）单次成本增 < $0.60（仅 coordinator 用满时）

### 16.4 工具循环（F+5 / F+6）

**F+5 强制 4 次 search + 触发数 UI**：

- `TOOL_LOOP_MAX = 5`（之前 F+4 曾降到 3，本次撤回恢复 5）
- 4 个 Agent prompt（`infoA` / `infoB` / `analyst` / `industry`）"至少 2 次 web_search" → **"至少 4 次"** + 列 4 个具体搜索方向以鼓励用满
- Agent 触发数 UI：`TokenTracker.record` 加第 4 参数 `toolCalls`；`runAgent` 在 tool loop 累加 `toolCallsCount`；消耗面板每行显示 `🔧×N`
- 14 处 `tracker.record(...)` 调用统一加 `res.toolCalls || 0` 参数

**F+6 自适应折叠**（让短 ctx 模型也可用）：

```js
function getModelContextWindow(model) {
  if (MODEL_PRICING[model]?.contextWindow) return MODEL_PRICING[model].contextWindow;
  const m = String(model).toLowerCase();
  if (m.includes('doubao-seed-2-0-pro')) return 256000;
  if (m.includes('doubao-seed-2-0-lite') || m.startsWith('ep-')) return 32768;
  // ... 覆盖 6 厂商主要模型，未知兜底 32K
}
```

`runAgent` tool 循环里每次 push tool_result 后：
1. 估算 messages 累积 token（粗略：字符数 / 1.5）
2. 若超过 `getModelContextWindow(model) × 0.6` 阈值
3. 把最早的 tool result 替换为 `[早期搜索结果已折叠以避免超出模型上下文窗口；如需补充信息请用全新关键词查询]`
4. 保留最新 1 个 tool result 完整

豆包 lite 32K → input 安全预算 19.7K，足够 5 轮循环 + 1 个完整 tool result + system + history。

### 16.5 工具结果质量（F+10）

`sanitizeSearchDescription(desc, url)`：

- Tavily 抓中文页面（如新浪财经 GB18030）有时 description 含乱码
- LLM 看到 `˾д | Efort | йգóߺƬ` 之类的乱码 → 主动退回训练数据 + 标 `[警告：未联网]`
- 检测 **Latin Ext-A/B (0100-024F) + IPA Extended (0250-02AF) + Spacing Modifier (02B0-02FF) + Greek (0370-03FF) + Cyrillic (0400-04FF) + U+FFFD** 占比
- 若 > 15%，替换为 `[原页面编码异常（如 GB18030 被当 UTF-8 解析），无法提取摘要。如需该来源，请直接访问：{url}]`
- 修复迭代：最初 regex 覆盖窄（仅 C1 controls + IPA），新浪乱码 11% 漏放 → 扩展到 Cyrillic + Latin Ext 后 16% 命中

### 16.6 流程控制（F+9）

`waitWhilePaused()` helper：

```js
async function waitWhilePaused() {
  while (state.paused && !state.aborted) await sleep(200);
}
```

- **问题**：决策场景 6 处循环（`runDecisionScene` / `runDebateScene` / Phase 2 outer + end / 等）原本只检查 `state.aborted` 没检查 `state.paused` → 暂停按钮按下后流程继续
- **修复**：6 个 `if (state.aborted) break` 前加 `await waitWhilePaused()`
- **附加修复**：现有 3 处 `while (state.paused) await sleep(200)` 升级成 helper 调用，防 abort 触发后 paused 仍 true 导致死循环（之前隐患）

### 16.8 项目空间 · Level 3（F+11）

**问题**：5 路记忆全局共享 → 多主题用户面临污染（"周一前端选型"事实污染"周三住房决策"任务）。

**架构**：

```js
state.projects = [
  { id: 'default', name: '默认', createdAt },
  { id: 'proj_xxx', name: '技术决策', createdAt },
  ...
]
state.activeProjectId = 'proj_xxx'  // 当前激活
state.memoryByProject = {
  default:  { projectContext, userProfile, agentMemories },
  proj_xxx: { projectContext, userProfile, agentMemories },
}
```

**全局 vs 项目级**：

| 属性 | 范围 | 理由 |
|------|------|------|
| projectContext | 项目级 | "我是 SaaS 创业者" vs "我在装修新家" 不该混 |
| userProfile.learnedFacts | 项目级 | 自动学习的事实最容易跨主题污染 |
| agentMemories | 项目级 | Agent 个体记忆带强主题色彩 |
| ⚙ settings | 全局 | 用户偏好（启用 RAG / 加密等）通用 |
| 📂 knowledgeBase | 全局 | KB 文档跨项目复用 |
| 🛠 customTeam / teamLibrary | 全局 | 团队配置通用 |
| 💰 cumulative | 全局 | 总累计 metrics 不分项目 |
| 📜 history | 全局存储 + 过滤 | history[].projectId 标签，UI 按 active 过滤 |

**核心 helper**（app.js L2030+）：
- `getActiveProjectId()` / `getProjectMemory(pid)` / `getProjectHistory(pid)`
- `ensureDefaultProject()` / `migrateMemoryToProjects()`
- `createProject(name)` / `switchProject(pid)` / `deleteProject(pid)` / `renameProject(pid, name)`

**访问点迁移**：
- `buildMemoryInjection` 用 `getProjectMemory()` 取 projectContext / userProfile / agentMemories
- `autoLearnUserProfile` 写入 `getProjectMemory().userProfile.learnedFacts`
- `autoSummarizeAgentMemories` 写入 `getProjectMemory().agentMemories[k]`
- `runMemoryHygiene` 只清理当前 active project
- `projectContextInput` UI 绑定 `getProjectMemory().projectContext`

**UI**：
- 顶栏 chip + dropdown 菜单：当前项目名 + 切换列表 + 新建/管理
- 设置面板「📁 项目空间」section：项目列表 + 改名/删除 + 任务数/画像数 metrics
- 切换项目时 `location.reload()` 兜底刷新所有依赖 memory 的 UI 节点

**持久化**：
- 新 storage key `myAgentTeam.memoryByProject`（加入 ENC_SENSITIVE_KEYS）
- 新 key `myAgentTeam.activeProjectId`
- 旧数据迁移：`migrateMemoryToProjects()` 幂等，首次加载自动转移 `state.memory.{projectContext, userProfile, agentMemories}` → `state.memoryByProject.default`

**约束**：
- "default" 项目不允许删除（兜底）
- `state.task` 非空时禁切（避免运行时上下文错乱）
- 删除项目时：清空该项目 memory + 把 history 项 projectId 重置回 'default'（不强删历史，仍可在默认项目看到）

### 16.10 起底场景 · 客观档案（F+12）

**问题**：决策场景擅长"该选 A 还是 B"，但用户经常需要的是"这个人/物/事到底什么底细"——纯事实档案，不下结论。

**架构**：复用决策的 Multi-phase 3 Phase + 4 Agent 框架，但**所有 prompt 强制"零主观/零结论"**：

| Agent | 角色 | F+ 强制规则 |
|-------|------|----------|
| `dossierA` 基础事实 | 身份/履历/财务/法律记录 | 强制 web_search ≥ 4 次 · 拒绝评价词 · 每条事实必含 [来源URL/时间/置信度] |
| `dossierB` 时间线 | 关键事件按时间排序 | 强制 web_search · 标"非首次/多次/已撤" · 跨来源时间冲突标注 |
| `dossierC` 第三方记录 | 监管/学术/媒体/关联方 | 强制 web_search · 排除营销/自述 · 多来源交叉 |
| `archivist` 档案整理员 | 9 段事实档案输出 | 禁止下结论 · 必须有"未核实/缺口"段 · 来源清单完整 |

**9 段档案结构**（覆盖客观、矛盾、缺口三个维度）：

```
① 主体识别（who / what / 注册信息）
② 已核实事实清单（多源一致的硬事实）
③ 时间线（事件 → 来源 → 时间）
④ 公开陈述与立场（主体自己说的，单独成段不混入事实）
⑤ 第三方独立记录（监管/学术/媒体）
⑥ 矛盾与冲突（多来源说法不一致的地方）
⑦ 未核实争议（仅单一来源 / 有质疑 / 待证实）
⑧ 信息缺口（明确标注哪些应该有但搜不到）
⑨ 来源清单（全部 URL，按可信度排序）
```

**强制约束**（写在 `archivist` 的 system prompt 里）：

```
绝对禁止：
- 任何评价词（"靠谱 / 不靠谱 / 优秀 / 可疑 / 看起来 / 似乎"）
- 任何对比性结论（"比 X 更好/差"）
- 任何主观推测（"可能是因为... / 大概率..."）
- 把"未搜到"翻译为"否定"（缺信息 ≠ 没事实）

必须做：
- 区分"事实 / 公开陈述 / 第三方记录 / 推测/未核实"四类
- 每条事实必含 [来源URL/时间/置信度高中低]
- 矛盾要明说"X 说 A，Y 说 B，未能调和"
- 信息缺口必须单独成段（"哪些信息应该有但搜不到"）
```

**调度**（`runDossierScene` L5939）：基本同 `runDecisionScene` 但：
- Phase 1 三方独立搜证（不互见 · 防止主导）
- Phase 2 交叉核验（专找矛盾和缺口 · 不做整合）
- Phase 3 单独档案整理员（不是"裁决者"，是"档案整理员"，prompt 词改了）
- forceTools 全程 ON · TOTAL_TOKEN_BUDGET.dossier = 80000 · COST_CAP_USD.dossier = $5

**路由**（`SCENE_RULES` L177）：关键词包括 起底/调查/查查/查证/底细/背调/深扒/扒一扒/真相/什么来头/什么背景/到底是/了解一下/是谁/是个什么/档案。

**与决策场景的本质区别**：

| 维度 | 决策 | 起底 |
|------|------|------|
| 用户期望 | "帮我做选择" | "帮我看清真相" |
| 输出形式 | 8 段裁决 + 推荐 | 9 段档案 + 来源清单 |
| 最终结论 | "我建议选 X 因为..." | **没有结论**（用户自己判断）|
| 失败模式 | 没给推荐用户失望 | 给了推荐违反场景定位 |

### 16.11 项目切换器下拉看不清 + CSS 缓存修复（F+12.2）

**问题 1**：项目切换器 dropdown 文字几乎看不见（用户截图反映）。

**根因**：`.project-menu` CSS 用了**未定义变量** `var(--bg-elev, #fff)` —— 项目实际定义 `--bg-elev-1/2/3` 三级，没有 `--bg-elev` 这个 alias → fallback 到白色 `#fff` → 浅字 `#e6e9f0` 在白底上对比度 ~1.1:1 几乎不可见。

**修复**（styles.css L883-911）：

```css
.project-menu {
  background: var(--bg-elev-2);     /* 旧: var(--bg-elev, #fff) */
  border: 1px solid var(--border-strong);  /* 加强边框 */
  box-shadow: 0 8px 28px rgba(0,0,0,0.45);  /* 加深阴影适配深色 */
}
.project-menu-item:hover {
  background: rgba(108, 140, 255, 0.22);   /* 0.12 → 0.22 */
  color: #fff;
}
.project-menu-item.active {
  background: rgba(108, 140, 255, 0.28);   /* 0.18 → 0.28 */
  color: var(--accent-hover);              /* --accent → --accent-hover 更亮 */
}
```

修复后 non-active 字色对比度从 ~1.1:1 → **13.2:1**（WCAG AAA 级）。

**问题 2**：CSS 改完用户硬刷新看不到新效果，浏览器顽固缓存旧 CSS。

**修复**（index.html L10）：

```html
<link rel="stylesheet" href="styles.css?v=f12-1" />
```

**经验**：以后每次改 CSS 都 bump 版本号（`?v=f12-1` → `?v=f12-2` ...），让浏览器把 URL 当新文件，绕过缓存。这是 CDN 时代的标准做法。

### 16.9 项目颜色 + 历史过滤增强（F+11.1）

**问题**：F+11 只给项目名字、无视觉区分；历史模态框列出所有项目的任务无过滤；旧代码遗留 2 个 `createProject` 函数定义冲突。

**修复**：

**项目颜色 palette**（app.js L2072）：

```js
const PROJECT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
];
```

- `default` 项目固定中性灰 `#6B7280`（永远不变）
- 新建项目从**空闲色**里随机抽（避免相邻项目同色），用完按 index 兜底
- `ensureProjectColors()` 给所有缺色项目补色（处理旧数据迁移）
- `pickProjectColor()` 优先空闲色，全用完按 modulo 兜底

**UI 显示**（4 处都生效）：

| 位置 | 视觉 |
|------|------|
| 顶栏切换器按钮 | `<● 项目名 ▾>` 当前项目色块 |
| 顶栏下拉菜单每项 | `<● 项目名>` 每行色块 |
| 设置面板项目列表 | 左边 4px 彩色 border + 名字前 dot |
| 历史模态框 | 每条任务卡左边 3px 彩色 border + project pill 用项目色着色（背景半透明 + 主色文字 + 细边框）|

**历史过滤增强**：

- dropdown 加 `📁 当前项目` 快捷选项（之前只有"全部 / 无项目 / 各项目名"）
- "全部项目"选项显示历史任务总数：`全部项目（123）`

**配套 CSS** (styles.css L795)：

```css
.project-color-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.15);
  flex-shrink: 0;
}
```

**清理**：删 L2031 旧 `createProject` + L2042 旧 `deleteProject`（F+11 helper 区已有新版本，含 `saveProjectMemory` + 重名检查 + color 字段，向后兼容更好）

### 16.7 完整时间预算（用户参考）

豆包 Seed 2.0 pro 跑完整决策的预期总时间：

| 阶段 | 单 Agent 耗时 | 并行/串行 | 阶段总耗时 |
|------|-------------|----------|-----------|
| Phase 1 强制 4 次 search × 4 Agent | ~80s | **并行** | ~80s |
| Phase 2 第 4 轮（A→B→C 互相质证）| ~60s × 3 | 串行 | ~180s |
| Phase 2 第 5 轮（C 中立补充）| ~60s | 串行 | ~60s |
| Phase 3 coordinator 8 段裁决 | ~215s（含 1 次 fact-check tool call）| 串行 | ~215s |
| **总计** | | | **~535s ≈ 9 分钟** |

任务总超时 15 分钟给了 6 分钟缓冲，安全。

---

## 17. F+13 工程化重构（Sprint 1 / 1.5 / 2 / 3）

> 在 F+1~F+12.2 完成产品功能 + 生产稳定后，启动一次**纯工程化重构**：单文件 7,140 行 vanilla JS → 20 modules + 58 smoke tests + 17 JSDoc @typedef + SCENE_CONFIGS 抽象。**0 功能回归、用户感知 0 变化、工程素养飞跃**。

### 17.1 Sprint 1：18 模块拆分

**目标**：app.js 单文件 → 多 module，每个职责单一。

**模式**：IIFE namespace（`window.MAT_X = (function(){...})()`）+ 顶部 destructure 引用。
不用 ES modules 因为 `<script type="module">` 是 deferred 加载，与现有 plain `<script>` 混用会破坏依赖链（详见 §17.5 pilot 教训）。

**拆出**（20 modules，按依赖拓扑顺序加载）：

```
src/
├── types/types.js           17 @typedef 全局类型（Sprint 3 加）
├── lib/
│   ├── utils.js             7 纯工具函数（fmtUsd / sleep / escapeHtml / etc.）
│   ├── constants.js         27 个常量（storage keys / TIMEOUTS / budgets）
│   └── vendor.js            MODEL_PRICING + 4 vendor 推断函数
├── persist/
│   ├── storage.js           12 个 save 函数
│   ├── encryption.js        PBKDF2 + AES-GCM 加密层
│   └── indexeddb.js         IndexedDB 封装
├── llm/
│   ├── stream.js            3 stream parser + Anthropic 消息转换
│   ├── llm.js               callLLM 路由 + 6 vendor caller + ApiError
│   └── simulated.js         SIM_TEMPLATES + callSimulated 模拟模式
├── state/
│   ├── state.js             单一 state 定义源
│   ├── store.js             项目空间 API（CRUD + colors）
│   └── kb.js                知识库（RAG）
├── tools/tools.js           4 工具 + executor + 自适应折叠
├── scenes/
│   ├── agents.js            22 个 Agent 字典（含完整 prompts，686 行纯数据）
│   ├── scene_config.js      SCENE_AGENT_LIST + buildBuiltinTeamForScene
│   └── orchestrator.js      runScene + runAgent + 自定义团队调度
├── ui/render.js             8 个 renderXMsg / setTaskStatus
└── test/
    ├── runner.js            浏览器内 mini test framework
    └── smoke.js             58 smoke 测试
```

**数据**：
- app.js: 7,140 → 3,622 行（**-49%**）
- 函数数: 196 → 89（**-55%**）
- 文件数: 1 → 22 (含 types/jsconfig)

### 17.2 Sprint 1.5 Phase D：app.js 减重

**问题**：Sprint 1 完成后 app.js 仍 4,052 行（仍 monolithic）。

**修复**：继续拆 3 个独立块：
- encryption.js（PBKDF2 / AES-GCM / setupEncryption / clearMaster）
- indexeddb.js（openIDB / idbPut / idbGetAll / migrateBigDataToIDB）
- kb.js（chunkText / addKnowledgeBaseFile / recallKnowledgeBase）

**减重**：-368 行（Wave 1+2）。

### 17.3 Sprint 1.5 Phase C：浏览器内测试网

**问题**：21+ 次 F+ 迭代后没自动化测试，每次改动靠 manual 验证。

**方案**：自建 mini test framework（不引 vitest，避免 Node 依赖与 ES modules 前置）。
- `src/test/runner.js` 70 行 · describe / it / expect（vitest API subset）
- `src/test/smoke.js` 240 行 · 58 测试覆盖 16 模块
- URL `?test=1` 触发，app.js 检测后动态加载 runner + smoke

**结果**：
```
🧪 58/58 passed · 14ms
✅ 0 console errors · 0 functional regression
```

任何 F+14+ 改动后 `?test=1` 立即 verify。

### 17.4 Sprint 1.5 Phase B：state.js 中央化基础

**问题**：state 散落在 app.js L549，411 处直接 `state.X` 访问，没有清晰的 ownership。

**第一步**（已完成）：建 `src/state/state.js` 作为 single source of truth，双暴露：
- `window.state`（兼容 IIFE 旧代码）
- `MAT_STATE.state`（ES modules 友好）

**第二步**（未做）：411 处 read/write 改成 getter/setter API（store pattern），1-2 天工程，当前 IIFE 架构下边际收益有限，未做。

### 17.5 Sprint 1.5 Phase A pilot：ES modules 渐进不可行的真相

**计划**：先把 utils.js 改 ES modules（`export const fmtUsd = ...`），用 `<script type="module">` 加载。验证可行后扩散。

**实际**：30 秒崩盘。

**根因**：
```
type="module" 是 deferred 加载（在所有 plain <script> 之后才执行）
→ 后续 plain script 的 `const { fmtUsd } = MAT_UTILS;` 时 MAT_UTILS 还 undefined
→ 全链路 ReferenceError 级联崩溃
```

**结论**：**ES modules 迁移是 all-or-nothing**，必须 16 modules + app.js + index.html 同时切换（5-6 小时工程，3-4 message）。本次未做。

**教训**：渐进式重构不适用于加载机制冲突的场景。下次类似改动先做 1-2 个 module 的 spike 验证可行性。

### 17.6 Sprint 2：SCENE_CONFIGS + runScene(config) 抽象

**问题**：runDecisionScene (172 行) + runDossierScene (154 行) = 326 行，**85% 代码相同**，**15% 差异在 8 处文案 + 3 处逻辑**。

**抽象**：

```js
const SCENE_CONFIGS = {
  decision: {
    sceneId, chipName, noTavilyWarning, hasTavilyInfo,
    p1: { divider, progress, agents, materialNoun, materialName, l1Label, l1Validate },
    p2: { divider, progress, rounds, agents, centerAgent, initPrefix, materialName,
          initTaskSuffix, sysFirstRound, sysCenter, tagFirstRound, tagCenter,
          l2Check, l2MissMsg, formatNoteSuffix },
    p3: { divider, progress, tag, agent, inputOutro, timeoutMsg },
  },
  dossier: { /* 同结构 */ },
};

async function runScene(userText, cfg) {
  /* 通用 170 行：Pre-flight → Phase 1 并行 → L1 → Phase 2 串行 → L2 → Phase 3 */
}

const runDecisionScene = (text) => runScene(text, SCENE_CONFIGS.decision);
const runDossierScene = (text) => runScene(text, SCENE_CONFIGS.dossier);
```

**收益**：
- 减重：326 → 232 行（-94 行 / -29%）
- **加新 multi-phase 场景：180 行复制 → 30 行 config（6×）**
- 文案改动单点（不用搜遍 2 个函数）

### 17.7 Sprint 3：JSDoc @typedef + jsconfig

**目标**：让 VSCode 在 vanilla JS 中提供 IntelliSense + 类型提示，无需 TypeScript / build step。

**做法**：

1. **`src/types/types.js`** —— 17 个核心 @typedef：
   - Vendor / ModelPricing / Memory / MemorySettings / LearnedFact
   - Project / ProjectMemory / Config
   - CustomAgent / CustomTeam / HistoryEntry / **State**
   - ToolSchema / Tool / CallLLMOpts / CallLLMResult
   - PhaseConfig / SceneConfig

2. **`jsconfig.json`** —— VSCode 自动开启：
   ```json
   {
     "compilerOptions": {
       "allowJs": true, "checkJs": false,
       "lib": ["ES2020", "DOM", "DOM.Iterable"]
     },
     "include": ["src/**/*.js", "app.js"]
   }
   ```

3. **JSDoc 应用**（utils.js / vendor.js / state.js / orchestrator.js）：
   ```js
   /**
    * @param {string} userText
    * @param {SceneConfig} cfg
    * @returns {Promise<{tracker, phase1Results, phase2Result, verdict}>}
    */
   async function runScene(userText, cfg) { ... }
   ```

VSCode 立刻有：函数签名提示 + 参数补全 + 跨文件类型跳转。

### 17.8 一次会话累计成果

```
🎯 4 个 Sprint 全部完成 · 0 functional regression
📦 18 个新 module（含 types + test）
📊 app.js 7140 → 3622 行（-49%）
🧪 58 smoke tests · 14ms 执行 · 浏览器原生
🏷️  17 @typedef + jsconfig.json
🏛️  SCENE_CONFIGS + runScene 抽象（加新场景 6× 提速）
📈 工程素养：单文件 jQuery-style → 模块化 + 测试 + 类型
```

### 17.9 留待下次的工作

- **完整 state 中央化**：411 处 state.X 改 store API（1-2 天）
- **ES modules all-in**：5-6 小时工程，消除 IIFE 命名空间
- **更多 JSDoc**：当前仅 utils/vendor/state/orchestrator 加了，剩 16 modules 缺
- **Unit tests**（带 mock）：当前 58 都是 smoke 级
- **CI/CD**：GitHub Actions + 自动跑 smoke + ESLint + Prettier

---

## 附录

- 完整更新日志：[CHANGELOG.md](./CHANGELOG.md)
- 设计档案：v4.5（原始规格，可索取）
- GitHub：（待开源后填）
- 问题反馈：（待开源后填）

---

文档版本：**F+13** · 最后更新：2026-06-01
