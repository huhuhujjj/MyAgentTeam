# MyAgentTeam 设计档案 v5.0（成品反推版）

> 本档案根据已落地的成品（F+24 · 26 模块 · 30+ 次迭代）**反向重建**，作为系统的权威设计说明。
> 它记录的是"实际是怎么做的 + 为什么这么做"，而非"原计划"。每个关键数字都可追溯到具体 F+ 迭代。
>
> 配套文档：[CHANGELOG.md](./CHANGELOG.md)（F+1~F+24 逐条变更）· [BLOG.md](./BLOG.md)（6 幕工程心路叙事）· [TECHNICAL_MANUAL.md](./TECHNICAL_MANUAL.md)（实现细节）· [README.md](./README.md)（快速上手 + 定位）

---

## 0. 文档约定

| 标记 | 含义 |
|------|------|
| `F+N` | 第 N 次生产后修复/迭代编号（不是版本号，是"与生产对话的记号"）|
| 🎯 | 设计目标 | ⚠️ | 已知限制 / 取舍 | 📐 | 关键数字（带来源）|

---

## 1. 项目定位与设计哲学

### 1.1 一句话定义
**用一句话指挥一支由你设计的 AI 团队完成任务** —— 多 Agent 协作 · 跨厂商混合 · 长程会话记忆 · 浏览器优先架构。

### 1.2 定位（先读这一句）
这是一个**个人作品 / 工程能力展示项目，不是商业产品**。
- 核心价值在于 **30+ 个 F+ 迭代 + 真实工程心路**，而非功能堆砌。
- 架构采用 **浏览器优先、无自建业务后端**：用户数据保存在本地，多数供应商请求由浏览器直连；豆包 Ark 生产请求经过 Vercel Edge 透传代理。不以商业化为目标（无订阅 / 无锁定 / 无法变现）。
- 适合：求职作品集 / 学 multi-agent 编排 / 自带 Key 的中度用户。
- ⚠️ 不适合：要求生产级 SLA 的商业场景。

### 1.3 三条不可动摇的设计原则
1. **本地凭证存储 + 零业务逻辑代理**：用户 API Key 配置保存在浏览器本地，可选 AES-GCM 加密。多数模型请求直连厂商；Ark 请求由 Vercel Edge 透传 Authorization 和请求体。代理代码不持久化 Key、不实现编排逻辑，但请求会经过托管平台网络，因此不能承诺平台侧绝对不可见或绝不记录。
2. **失败必须可操作**：任何错误都翻译成"用户能做什么"，并显示服务器原话（F+14.3）。不让用户面对沉默或猜谜。
3. **机制 > 数据**：凡是会随时间过期的"预设数据"（如 hardcode model 列表），优先做成"用户可自填的机制"（F+17.11）。

---

## 2. 设计目标与非目标

### 2.1 🎯 目标
- **G1 编排自由**：3 个开箱即用内置场景 + 完全自定义团队（5 种协作拓扑 + 11 套预设）。
- **G2 厂商中立**：6 家 LLM 厂商浏览器直连，可在单个任务内跨厂商混合（不同 Agent 用不同厂商，降同源偏见）。
- **G3 事实可靠**：事实依赖高的场景（决策/起底/分析/写作）强制 web_search，避免"集体幻觉"。
- **G4 长程记忆**：5 路独立记忆源按需注入，每路可开关 + 设 token 预算。
- **G5 隐私优先**：无自建业务后端，Key 本地存储 + 可选加密；Ark 请求走托管 Edge 代理。
- **G6 韧性**：超时/限流/审核/CORS/网络各类错误都有专门处理 + 任务可暂停/恢复/延续。

### 2.2 ⚠️ 非目标
- **非目标 N1 商业化**：不做账户体系、订阅、用量计费、SaaS 托管。
- **非目标 N2 生产级 SLA**：单页应用，无服务端可观测性、无多人协作。
- **非目标 N3 移动优先**：桌面浏览器优先，移动端可用但非重点。
- **非目标 N4 模型托管**：不代理/转售模型，用户自带 Key。

---

## 3. 架构总览

### 3.1 部署拓扑

```
┌─────────────────────────────────────────────┐
│  浏览器（唯一运行时）                          │
│  ┌────────────┐   ┌──────────────────────┐   │
│  │ index.html │ → │ app.js + 26 IIFE 模块 │   │
│  └────────────┘   └──────────────────────┘   │
│         ↓ localStorage（含可选 AES-GCM 加密）  │
│         ↓ fetch（流式 SSE）                    │
└─────────┼─────────────────────────────────────┘
          │
   ┌──────┴───────────────────────────────┐
   │                                       │
   ↓ 直连（5 厂商 CORS 友好）               ↓ 豆包 ARK（不返 CORS）
┌──────────────────────┐      ┌───────────────────────────────┐
│ OpenAI / Anthropic / │      │ localhost → 直连 ARK            │
│ Qwen / DeepSeek /    │      │ 生产 → /api/proxy/ark           │
│ Gemini               │      │   （Vercel Edge · pass-through）│
└──────────────────────┘      └───────────────────────────────┘
                                          ↑ F+14.1 hybrid 代理
                                            Key 不持久化在应用存储
```

### 3.2 唯一的"后端"：Vercel Edge Function
- 文件：[api/proxy/ark.js](./api/proxy/ark.js)（95 行）
- 职责：**纯 pass-through**。接收浏览器 POST → 转发 ARK → 回传 SSE 流 + 补 CORS header。
- 不解析或持久化 Key 与请求 body，只负责转发并补充 CORS 响应头。
- 设计意义：应用没有自建业务后端，但 Ark 请求经过 Vercel Edge。托管平台可能处理请求元数据；部署和隐私说明不得承诺平台侧绝对不可见或绝不记录。

### 3.3 模块化策略：IIFE + 双暴露
- 每个模块是 `window.MAT_XXX = (function(){ 'use strict'; ... return {...}; })()`。
- **双暴露**：模块内函数同时挂到 `window.fnName`（向后兼容大量直接调用点）和 `MAT_XXX.fnName`（命名空间）。
- ⚠️ **为何不用 ES Modules**：F+13 Sprint 1.5 Phase A 做过 pilot —— `<script type="module">` 是 deferred 加载，会破坏后续 plain `<script>` 的依赖链（const 解构拿到 undefined → 级联失败）。结论：**ES Modules 迁移是 all-or-nothing**，渐进迁移不可行。回滚并文档化。
- 加载顺序由 index.html `<script>` 标签顺序保证：constants → utils/vendor → state → 持久化 → llm/stream → tools/agents → orchestrator → i18n → ui → app.js。

---

## 4. 模块清单（26 模块 · 14050 行）

| 层 | 模块 | 行数 | 职责 |
|----|------|:----:|------|
| **入口** | `app.js` | 3519 | 路由 / 事件绑定 / init / 场景定义 / 设置 / 成本预估 / 团队构建器 |
| **入口** | `index.html` | 1352 | DOM 骨架 + 介绍页 + script 加载顺序 |
| **入口** | `styles.css` | 2019 | 全部样式（深色主题 · CSS 变量）|
| **基础** | `lib/constants.js` | 103 | 全部常量 / 阈值 / 预算 / 超时（带 F+ 来源注释）|
| **基础** | `lib/utils.js` | 101 | 纯函数 helper（fmtUsd / escapeHtml / sleep ...）|
| **基础** | `lib/vendor.js` | 144 | MODEL_PRICING 表 + getModelVendor + getModelContextWindow + inferVendor |
| **状态** | `state/state.js` | 121 | 全局 state 单一定义源 + DEFAULT_CUSTOM_TEAM |
| **状态** | `state/store.js` | 179 | F+11 项目空间 CRUD（隔离 memory/history）|
| **状态** | `state/kb.js` | 93 | 知识库 RAG（分块 + 关键词召回）|
| **持久化** | `persist/storage.js` | 162 | localStorage 读写（含 F+17 model 偏好 4 键）|
| **持久化** | `persist/encryption.js` | 170 | PBKDF2 + AES-GCM 透明加解密 |
| **持久化** | `persist/indexeddb.js` | 119 | IndexedDB 基础设施（大对象预留）|
| **LLM** | `llm/llm.js` | 221 | callLLM 路由 + 6 vendor caller + ApiError |
| **LLM** | `llm/stream.js` | 245 | 3 种 SSE 流解析 + OpenAI↔Anthropic 消息转换 |
| **LLM** | `llm/simulated.js` | 277 | 无 Key 模拟模式（预脚本 Agent 回复）|
| **场景** | `scenes/agents.js` | 686 | AGENTS 字典（22+ Agent system prompt）|
| **场景** | `scenes/orchestrator.js` | 1220 | runAgent + 5 编排实现 + runScene 通用多阶段调度 |
| **场景** | `scenes/scene_config.js` | 95 | 场景→Agent 映射 + 模型覆盖解析 |
| **工具** | `tools/tools.js` | 240 | 3 工具（web_search/web_fetch/date_now）+ 执行 + 沙箱 |
| **记忆** | `memory/learning.js` | 235 | 5 源记忆注入 + 后台自学画像 + Agent 记忆 |
| **UI** | `ui/render.js` | 161 | Agent 气泡 / 系统消息 / 工具卡片渲染 |
| **UI** | `ui/model_picker.js` | 269 | 模型下拉（F+17 hot zone · 16 次迭代）|
| **UI** | `ui/history.js` | 588 | 历史任务弹窗（筛选/批量/收藏/重跑/导出）|
| **i18n** | `i18n/i18n.js` | 157 | 基础设施（setLocale / t / walkAndTranslate）|
| **i18n** | `i18n/zh.js` + `en.js` | 366×2 | 298 keys 双语字典 |
| **类型** | `types/types.js` | 230 | 17 个 JSDoc @typedef |
| **测试** | `test/runner.js` + `smoke.js` | 140+310 | 浏览器内 test runner + 68 smoke 测试 |

---

## 5. 数据模型

### 5.1 全局 state（单一定义源 · `state/state.js`）

```
state = {
  config: {                    // → localStorage 'myAgentTeam.config'（可加密）
    openaiKey, anthropicKey, qwenKey, deepseekKey, doubaoKey, geminiKey,  // 6 厂商 Key
    tavilyKey,                 // 联网搜索 Key
    model,                     // 全局默认模型
    remember,                  // 是否持久化
    agentIcons: {},            // 内置 Agent 头像 base64
    toolsEnabledGlobal,        // 内置场景全局工具开关
  },
  customTeam: { mode, rounds, agents:[...] },   // 当前编辑中的团队
  teamLibrary: [],             // 已保存团队
  tplLibrary: [],              // 身份模板库
  sceneConfigs: {},            // 内置场景 per-Agent 模型覆盖
  scenePrompts: {},            // 内置场景 per-Agent prompt 覆盖
  cumulative: { totalCostUsd, taskCount, totalTokens },
  history: [],                 // 历史任务（FIFO 50 条）
  memory: {                    // 5 源记忆（详见 §10）
    projectContext, userProfile, agentMemories, settings:{...}
  },
  projects: [],                // F+11 项目空间
  knowledgeBase: { documents:[] },
  activeProjectId,
  task: null,                  // 当前运行任务（含 abortControllers）
  paused, aborted,
  modelFailures: {},           // F+17 失败 model 记录
  customModels: [],            // F+17.1 用户自填 model ID
  hiddenModels: {},            // F+17.3 隐藏（保留兼容）
  purgedModels: {},            // F+17.5 永久移除（保留兼容）
}
```

### 5.2 localStorage 键（17 个）
`config` · `history` · `cumulative` · `customTeam` · `teamLibrary` · `tplLibrary` · `sceneConfigs` · `scenePrompts` · `memory` · `activeTask` · `projects` · `memoryByProject` · `knowledgeBase` · `modelFailures` · `customModels` · `hiddenModels` · `purgedModels`

⚠️ **加密边界**：敏感键（含 Key 的 config / memory）走 `encryption.js` 透明加解密；其余明文。

---

## 6. 场景系统

### 6.1 三个内置场景（生产稳定）

| 场景 | 图标 | 编排模式 | 流程 | 强制工具 |
|------|:----:|---------|------|:----:|
| **规划** | 📋 | Reflection | PM 拟方案 ⇄ 顾问评审 × 3 轮 | 走全局开关 |
| **决策** | ⚖️ | Multi-phase | 3 信息 Agent 并行取证 → 交叉质证 → 协调裁决 | ✅ |
| **起底** | 🔍 | Multi-phase | 3 搜证 Agent 并行 → 交叉核验找矛盾 → 9 段事实档案（不下结论）| ✅ |

⚠️ **历史背景**：原有 6 场景（含写作/分析/学习/创意），F+11 产品聚焦砍到 3，F+12 起底替换写作。被砍场景的 orchestration 代码保留在 SCENE_FLOWS，通过"自定义团队"仍可访问（写作 4 工序 = Pipeline 预设）。

### 6.2 场景路由（`routeScene`）
- 关键词匹配 + 优先级（起底 priority 最高，决策次之，规划最低）。
- 用户输入 → 命中关键词 → 推荐场景 chip（非强制，用户可改）。
- SCENE_RULES 定义 keywords / negative / priority。

### 6.3 自定义团队
- 1-4 个 Agent：独立命名 + System Prompt + 模型 + 颜色 + 头像（≤350KB）。
- 5 种编排模式（§7）。
- 团队库（多套预案命名保存）+ 模板库（身份描述复用）。
- 11 套精选预设（三方辩论 / 多视角分析 / 写作流水线 / 苏格拉底学习 / 四厂商对照 ...）。
- 实时校验：每种模式的角色规则在 UI 实时检查，违规无法启动。

---

## 7. 编排引擎（`scenes/orchestrator.js`）

### 7.1 五种编排模式

| 模式 | 拓扑 | 适用 |
|------|------|------|
| **Sequential** 顺序 | A→B→A→B... 循环 N 轮 | 协作讨论 / 辩论 / 迭代 |
| **Pipeline** 流水线 | A→B→C→D 线性 1 遍 | 工序明确（写作 4 工序 / 翻译校对）|
| **Reflection** 反思 | 创作→评→改→评... N 轮 | 单产出反复打磨 |
| **Hub-Spoke** 中心辐射 | 中心提问→N 专家答→中心整合 | 模糊问题多视角破局 |
| **Multi-phase** 多阶段 | 并行隔离→群聊质证→独立裁决 | 高质量决策（决策/起底同款）|

### 7.2 核心原语 `runAgent(agentKey, userMsg, history, opts)`
单个 Agent 的完整调度，包含：
- 模型解析优先级：自定义 Agent.model → 场景级覆盖（sceneConfigs）→ 全局默认。
- System prompt 解析：自定义 → scenePrompts 覆盖 → 内置（按 locale 选 system/systemEn）+ 记忆注入 + **输出语言指令注入**（i18n Phase 3）。
- **工具调用循环**（最多 `TOOL_LOOP_MAX=5` 轮）：LLM 返回 tool_calls → 执行 → 结果回灌 → 再调，直到无 tool_calls。
- **F+6 自适应折叠**：累积 tokens 超过 `ctx×0.6` 阈值时，折叠最早的 tool result（保留最新 1 个完整），让短 ctx 模型（豆包 lite 32K）也能跑满循环。
- **暂停/中止响应**（F+15）：循环每轮顶部 + 每个 tool call 前都 `await waitWhilePaused()` + 检查 aborted。
- **F+17 成功反馈**：首轮 callLLM 成功 → 清除该 model 的 failure 记录。
- **超时**：per-Agent AbortController + setTimeout，超时归类为 TimeoutError 降级跳过。
- **错误上下文附加**：ApiError 挂 agentName/failedModel/sceneId/isCustomAgent。

### 7.3 通用多阶段调度 `runScene(userText, cfg)`（F+13 Sprint 2）
决策 + 起底共享 85% 逻辑 → 抽出通用调度器：
```
Pre-flight（Tavily 检查）
 → Phase 1：N Agent 并行（Promise.all · 结构性隔离）
 → L1 格式校验（来源/置信度/时间/类型，兼容纯文本+emoji 表格双格式 F+14.2）
 → Phase 2：N 轮交叉群聊（注入 Phase 1 摘要）
 → L2 校验（是否引用对方）
 → Phase 3：单 Agent 长输出（裁决/档案）
```
加新 multi-phase 场景 = 写 ~30 行 SCENE_CONFIGS（不复制 180 行函数）。

📐 **关键 bug 教训（F+16）**：Phase 2 把 assistant 消息 `content` 写成空数组 `[]`，OpenAI/Claude 宽容当空串掩盖，**豆包严格校验直接 400 暴露** → multi-vendor 架构是"自我免疫系统"。

---

## 8. LLM 适配层（`llm/llm.js` + `llm/stream.js`）

### 8.1 厂商支持（6 家 · MODEL_PRICING）

| 厂商 | 协议 | CORS | 代表模型 |
|------|------|:----:|---------|
| OpenAI | Chat Completions | ✅ 直连 | gpt-5 / gpt-4o / o3 |
| Anthropic | Messages（x-api-key + content_block_delta）| ✅ 直连 | claude-opus-4-5 / sonnet / haiku |
| Qwen（阿里）| OpenAI 兼容（DashScope）| ✅ 直连 | qwen3-max / qwen-long |
| DeepSeek | OpenAI 兼容（+R1 reasoner 特殊流）| ✅ 直连 | deepseek-chat / reasoner |
| 豆包（火山 ARK）| OpenAI 兼容 | ⚠️ 不返 CORS | doubao-seed-2.0-* / ep-xxxxx |
| Google Gemini | OpenAI 兼容端点 | ✅ 直连 | gemini-2.5-pro / flash |

### 8.2 路由策略 `callLLM`
1. 用 modelOverride 或全局默认决定模型。
2. `getModelVendor` 查 vendor（兜底 `inferVendor` 支持 ep-xxxxx）。
3. 检查对应 `{vendor}Key` 是否配置。
4. 配了 → 对应 caller；**没配 → callSimulated 模拟兜底**（无 Key 也能体验完整流程）。

### 8.3 流式解析（3 种）
- `readOpenAIStream`：标准 SSE `data:` 增量。
- `readDeepSeekR1Stream`：reasoning_content 思考流特殊处理。
- `readAnthropicStream`：content_block_delta + tool_use 协议。
- `convertOpenAIMessagesToAnthropic`：跨协议消息转换。

### 8.4 fetch 层错误包装（F+14）
fetch() 失败（CORS/网络/DNS/扩展拦截）抛的是 `TypeError("Failed to fetch")` 不是 ApiError → 包成 `ApiError(0, "fetch failed: ... endpoint=...")` 让 handleApiError 识别。

---

## 9. 工具调用系统（`tools/tools.js`）

### 9.1 三个工具

| 工具 | 能力 | 依赖 | 备注 |
|------|------|------|------|
| `web_search` | Tavily 联网搜索（真实 URL + 摘要 + 时间）| 用户 Tavily Key | 免费 1000/月 · 全球可用 |
| `web_fetch` | Jina Reader 读全文 markdown | 免 Key | 深读源文档 |
| `date_now` | 当前日期/时区 | 纯本地 | 让 Agent 写"截至 2026 年..."|

⚠️ 设计文档/介绍页有时称"4 工具"，含一个 Web Worker 沙箱 JS 执行（算数/排序/统计），实际工具定义以 tools.js 为准。

### 9.2 强制工具策略
- **F+ 设计原则**：事实依赖高的场景默认强制工具（决策/起底/分析/写作），事实无关的保持纯发散（创意）。
- 前提：Tavily Key 已配。未配 → 启动前警告"Agent 将凭训练数据下结论，存在集体幻觉风险"。
- 强制方式：`forceTools` 绕过全局开关，给 Phase 1 Agent 注入全部工具 schema。

### 9.3 多层防御
- 单工具超时 `TOOL_TIMEOUT_MS=30s` + 结果自动截断 8000 字符 + 沙箱执行 + `TOOL_LOOP_MAX=5` 硬上限。
- F+10：Tavily 偶返二进制乱码 → 字符密度过滤丢弃。

---

## 10. 长程记忆系统（`memory/learning.js`）

### 10.1 五个独立记忆源

| # | 源 | 来源 | 软上限 | 默认 |
|---|----|------|:----:|:----:|
| 1 | 项目上下文 | 用户手填 500 字背景 | 800 tok | 开 |
| 2 | 用户画像（自学）| 任务后 LLM 摘要新事实（FIFO 20 · 30 天过期）| 400 tok | 开 |
| 3 | 引用过往任务 | 启动时可选"基于之前那次继续"| 600 tok | 按需 |
| 4 | 知识库 RAG | 上传 .txt/.md → 分块 → 关键词召回 top-3 | 800 tok | 开 |
| 5 | Agent 个体记忆 | 每个内置 Agent 累积自己跑过的任务 | 300 tok | **关**（省钱）|

### 10.2 预算裁剪
- 总预算 `MEMORY_DEFAULT_BUDGET=1500` tok。
- 超预算时按**优先级从低到高裁剪**：项目上下文 > 用户画像 > 引用任务 > KB > Agent 记忆。
- 启动任务时弹层展示"记忆消耗"明细（每源 token + 总费用）。

### 10.3 自动 Hygiene
- 启动时跑：30 天过期清理 / Jaccard ≥ 0.7 去重 / 一正一反冲突检测。
- 设置面板可手动"🧹 立即清理"。

---

## 11. 项目空间（F+11 · `state/store.js`）

- 多主题完全隔离：每个项目独立的 项目上下文 / 用户画像 / Agent 记忆 / 历史过滤。
- 每项目独立颜色标识。
- 典型用法：技术决策 + 个人事务 + 工作项目 A/B/C 分开管理，AI 团队的"用户认知"在每个项目里独立成长。
- ⚠️ 任务运行中不能切换项目（防状态污染）。

---

## 12. 模型管理（F+17 系列 · 16 步演化 · `ui/model_picker.js`）

> 这是全项目迭代最密集的子系统 —— 16 个子版本，13 次用户反馈推着改。

### 12.1 终态设计：100% 用户驱动
- **不再有 hardcode model 列表**（F+17.11 全部移除）。
- 主下拉 = `⭐ 用户自填 model`（按 vendor 分组）+ 每 vendor 末尾"✏️ 填自定义..."触发器 + "🛠 管理"入口。
- 用户从厂商控制台拿最新 model ID 自填 → 持久化（`customModels`）→ 跨 Agent/场景/刷新复用。

### 12.2 智能感知
- 🔑 没配 Key 的厂商 optgroup 灰掉（保留发现性）。
- ⚠️ 上次调用失败的 model 加标 + tooltip（失败时间/HTTP/服务器原话）。
- ✅ 成功调用自动清除 failure；30 天自动过期清理。
- 502 也记录（F+17.8 实测豆包把"model 下线"返 502 而非 404）。

### 12.3 核心设计教训
> **"hardcode 27 model = 数据 → 1 年过期。✏️ 填自定义入口 = 机制 → 永远活。真正'开箱即用'的应该是机制不是数据。"**

---

## 13. 历史任务系统（F+18 · `ui/history.js`）

- 列表：场景图标 / 标题 / 时间 / 项目 pill / token / 成本。
- 筛选：搜索（输入/结果/讨论范围切换）+ 场景 chip + 时间 chip + 项目过滤。
- 操作：🔄 直接重跑 / ✏️ 编辑后重跑 / 📋 复制输入 / 📥 导出 .md / 👁 加载到主区 / ⭐ 收藏置顶 / ☑ 批量删/加项目。
- FIFO 上限 `HISTORY_LIMIT=50`。
- ⚠️ **重跑陷阱（F+24）**：直接重跑用**当前**配置，history 未存 per-Agent 模型无法还原 → 加 confirm 明示（诚实优于假装）。

---

## 14. 国际化（F+14 i18n · `i18n/`）

- 298 keys 双语字典（zh.js / en.js 平衡）。
- 4 种属性：`data-i18n`（textContent）/ `data-i18n-html`（innerHTML 含链接）/ `data-i18n-placeholder` / `data-i18n-title`。
- `walkAndTranslate(root)` 一次性切换全 DOM。
- **Agent 输出语言运行时注入**（Phase 3）：不翻译 22 个中文 prompt，而在 system 末尾追加 `[Output language] Respond in English.`。现代旗舰 LLM 完美处理"中文 prompt + 英文输出"，0 翻译工作量。留 `systemEn` 字段做未来扩展接口。
- **toast 出口统一翻译**（F+19.1）：改 1 处 `toast()` 而非 41 个调用点，静态查表 + 正则模式（保留插值变量）。
- 持久化 locale，下次按 navigator.language 检测。

---

## 15. 安全与隐私

### 15.1 浏览器优先与 Ark 透传代理
- 模型厂商请求通常由浏览器直连；豆包生产请求走 same-origin Edge Function，以解决浏览器 CORS 限制。
- Edge Function 只转发请求与 SSE 响应，不实现 Agent 编排，也不将 Key 写入应用数据存储。请求仍会经过 Vercel 托管网络，平台侧处理和日志行为受其服务配置约束。

### 15.2 可选 AES-GCM 加密（`persist/encryption.js`）
- 设主密码 → PBKDF2 派生 → AES-GCM 256 位加密 API Keys + 记忆库。
- 会话级密钥缓存 sessionStorage（关浏览器即清）。
- ⚠️ 默认**关闭**（绝大多数用户不会主动开），明文存 localStorage。这是已知安全短板。

### 15.3 Prompt 注入防护
- 用户输入用 `<user_input>` 标签包裹，prompt 明确要求 Agent 忽略其中指令性内容。
- 输入长度上限 `MAX_USER_INPUT_LEN=2000`。

### 15.4 XSS 防护
- 所有渲染走 escapeHtml / DOMPurify（sanitizeMarkdown）。
- `data-i18n-html` 仅用于可信字典值（非用户输入）。

---

## 16. 成本与超时治理（`lib/constants.js`）

### 16.1 📐 关键数字（全部带来源）

| 常量 | 值 | 来源 |
|------|----|------|
| `MAX_TOKENS_PER_TURN` | 8000 | F+3：8 段裁决实测 6570 tok + 20% 余量 |
| `TOTAL_TOKEN_BUDGET` | default 30K / decision·dossier 80K | 设计档案 8.0 |
| `COST_CAP_USD`（熔断）| default $2 / decision·dossier $5 | 设计档案 14.7 |
| `TIMEOUTS.singleAgent` | 120s | F+2：豆包 ARK 实测 ~41 tok/s |
| `TIMEOUTS.coordinatorAgent` | 300s | F+8：8 段裁决国内慢模型需 195s+ |
| `TIMEOUTS.taskDecision` | 900s | F+8：Phase 1 并行+5 轮 Phase 2+coordinator 实测可达 12min |
| `TOOL_LOOP_MAX` | 5 | F+5：从 F+4 的 3 恢复（用户偏好充分调研）|
| `TOOL_TIMEOUT_MS` | 30s | 单工具执行超时 |
| `HISTORY_LIMIT` | 50 | FIFO |
| `MEMORY_MAX_PROFILE_FACTS` | 20 | 用户画像 FIFO |
| `MEMORY_FACT_EXPIRE_DAYS` | 30 | 过期清理 |
| `MEMORY_DEDUP_JACCARD_THRESHOLD` | 0.7 | 去重相似度 |
| `AVATAR_MAX_BYTES` | 350KB | F+17.7（从 100KB 放宽）|

### 16.2 数字演进哲学
> **所有阈值必须从实测反推，不从习惯照搬**。TIMEOUTS / MAX_TOKENS / TOOL_LOOP_MAX 这三个数字在 F+2~F+8 各被生产数据纠正过 ≥2 次。

---

## 17. 错误处理体系（`handleApiError`）

### 17.1 状态码翻译表
401/403/404/413/429/502/503/5xx/400/0(网络) 各有专门 msg + action。

### 17.2 三个关键设计
1. **显示服务器原话（F+14.3）**：通用提取 `error.message`（4 个 fallback 字段路径），不让本地推断掩盖真相。"请求被拒绝(400)" → "Tools parameter not supported by ..."。
2. **vendor-aware action**：豆包 502 → "去填自定义新版 model ID"；Qwen 400 审核 → "换非国内厂商模型"。
3. **定位上下文**：附失败 Agent 名 + 模型 + 修改路径（场景 chip ⚙ / 设置面板）。

### 17.3 i18n 全字典化
22 个分支全走 `et(key, fallback)`，缺失时 fallback 原中文（零 regression）。

---

## 18. 工程化体系

### 18.1 模块化历程
- 起点：单文件 7140 行。
- F+13 Sprint 1：拆 20+ 模块（-49%）。
- F+22 Sprint 4：按 git blame 频率再拆 3 块 hot zone（model_picker / history / learning）→ app.js 3519 行。
- ⚠️ **不强拆**：runMemoryHygiene / findRelatedHistory / openSceneConfig 因与核心调度耦合，故意保留。"完美模块化是工程师 ego，够用是产品判断"。

### 18.2 测试
- 浏览器内 test runner（`?test=1` URL 触发，0 生产影响）。
- 68 个 smoke 测试（58 模块加载校验 + 10 lifecycle integration）。
- 另有 vitest 单测 + playwright e2e 脚手架（tests/）。
- ⚠️ **已知短板**：业务逻辑（runScene/runAgent/handleApiError）单测覆盖 <20%，主要靠 smoke + 生产实战。

### 18.3 类型
- 17 个 JSDoc @typedef（types.js）+ jsconfig.json（allowJs/checkJs:false）→ VSCode IntelliSense。

---

## 19. 关键设计决策与权衡（决策日志）

| # | 决策 | 取舍 | 出处 |
|---|------|------|------|
| D1 | 浏览器优先、无自建业务后端 | 本地数据控制 ✅ / Ark 仍经 Edge 代理 | 核心原则 |
| D2 | IIFE 而非 ES Modules | 渐进迁移 ✅ / 现代语法 ❌ | F+13 Phase A pilot 失败 |
| D3 | 豆包 hybrid 代理（撤回"honest 接受"）| 生产可用 ✅ / 纯静态 ❌ | F+14→F+14.1 撤回 |
| D4 | 砍 hardcode model 列表 | 永不过期 ✅ / 开箱即用 ❌ | F+17.11 |
| D5 | 不翻译 Agent prompt，运行时注入语言 | 0 工作量 ✅ / prompt 不够"地道" | i18n Phase 3 |
| D6 | 强制工具仅事实场景 | 可靠 ✅ / 成本+延迟 ↑ | F+ 设计原则 |
| D7 | 协作式暂停（非强制中断）| 不丢 token ✅ / 响应 5-30s | F+15 |
| D8 | 6 场景砍到 3 | 聚焦 ✅ / 功能广度 ❌ | F+11/F+12 |
| D9 | 撤回"重置偏好后门" | "永久"语义诚实 / 无 UI 撤销 | F+17.5→F+17.6 撤回 |
| D10 | 模块化"知道何时停" | 可维护 ✅ / 非完美拆分 | F+22 |

⭐ **三次撤回（D3/D9 + F+4→F+5）是本项目最有价值的工程资产** —— "计划好可以撤回，反而能更激进"。

---

## 20. 已知限制与未来方向

### 20.1 ⚠️ 当前真实短板
1. 业务逻辑测试覆盖 <20%（想长期维护必补）。
2. 22 个 Agent prompt 写死，改 prompt 需改代码（应跟 F+17 model 自定义对齐）。
3. AES 加密默认关，多数用户明文存 Key。
4. 商业不可行（架构性，也非目标）。
5. TECHNICAL_MANUAL / 深层介绍段落未全双语（read-once，低 ROI）。

### 20.2 可能的演进
- Agent prompt 也支持用户自定义（对齐 model 体系）。
- 业务逻辑补 10-15 个单测。
- BLOG.md 英文版（国际作品集）。
- 头像迁 IndexedDB（已有基础设施），放宽体积。

---

## 附录 A · F+ 迭代地图（30+ 编号）

```
F+1~F+10    豆包之日（24h 十次修）：model ID / 超时 / token / 工具 / R1 / 折叠 / Tavily
F+11~F+12.3 产品聚焦：6→3 场景 · 起底替换写作 · 项目空间 · dropdown 修复
F+13        Sprint 1-3 模块化（首轮 · -49%）+ @typedef + smoke test
F+14~F+14.3 ARK CORS hybrid 代理 · L1 兼容 emoji · server.message 显示
F+15        暂停在 tool loop 生效（F+9 复发）
F+16        multi-phase content=[] critical bug（豆包暴露 OpenAI 掩盖）
F+17~F+17.16 模型下拉 16 步用户驱动演化（本项目迭代最密子系统）
F+18~F+18.1 历史任务全面升级（12 项）
F+19~F+19.1 介绍页完善 + 核心体验 i18n 100%
F+20        运行中任务可查看 + 明确停止入口
F+21        API Key 👁 可视切换
F+22.1-3    Sprint 4 模块化（-22% · model_picker/history/learning）
F+23        文档同步（BLOG 6 幕 + 介绍页 + README）
F+24        重跑陷阱修复 + README 定位声明 + git 基线
```

---

## 附录 B · 快速开始（3 步）

1. **5 秒** 顶栏 ⚙ 设置 → 填任意一家 API Key（推荐 DeepSeek 最便宜 / OpenAI 最熟）。
2. **10 秒** 主页输入框写一句话任务（≥20 字效果好）。
3. **30 秒** 点 🚀 启动 或挑场景 chip。系统自动识别场景。

📐 成本预估：决策 $0.05-$0.30 · 起底 $0.15-$0.50 · 规划 $0.02-$0.10（任务前弹层精确预估）。

---

*MyAgentTeam 设计档案 v5.0 · 反推自 F+24 成品 · 2026-06-06*
*"设计档案不是计划书，是对成品的诚实说明。它记录的每个数字都流过生产。"*
