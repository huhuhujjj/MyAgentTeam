/* ============================================================
   MyAgentTeam · V1（F+13 Sprint 1 模块化迁移中）
   单页前端 Demo —— 实现设计档案 v4.5 V1 范围

   F+13 Sprint 1 进度：
   ✅ src/lib/utils.js — 纯 leaf 工具函数已外移
   ⏳ src/lib/constants.js — 常量待外移
   ⏳ src/lib/vendor.js — vendor 推断逻辑待外移
   ⏳ src/state/ — state 中央化 API 待建
   ============================================================ */

// F+13 Sprint 1：从 ./src/lib/utils.js / vendor.js / constants.js 解构引入
// index.html 保证 3 个模块在本文件之前加载（顺序：utils → vendor → constants → app）
const {
  fmtUsd, fmtUsdShort, sleep,
  escapeHtml, tokensFromText,
  jaccardSim, detectFactConflict,
} = MAT_UTILS;
const {
  MODEL_PRICING,
  isExpensiveModel, inferVendor, getModelVendor, getModelContextWindow,
} = MAT_VENDOR;
const {
  VERSION,
  STORAGE_KEY, HISTORY_KEY, CUMULATIVE_KEY,
  TEAM_KEY, TEAM_LIBRARY_KEY, TPL_LIBRARY_KEY,
  SCENE_CFG_KEY, SCENE_PROMPT_KEY,
  MEMORY_KEY, ACTIVE_TASK_KEY,
  PROJECTS_KEY, MEMORY_BY_PROJECT_KEY,
  KB_KEY,
  HISTORY_LIMIT, MEMORY_MAX_PROFILE_FACTS, MEMORY_DEFAULT_BUDGET,
  MAX_INTERVENTIONS, MAX_USER_INPUT_LEN,
  MAX_TOKENS_PER_TURN, TOTAL_TOKEN_BUDGET, COST_CAP_USD,
  TIMEOUTS,
  TOOL_LOOP_MAX, TOOL_TIMEOUT_MS,
  MEMORY_FACT_EXPIRE_DAYS, MEMORY_DEDUP_JACCARD_THRESHOLD,
} = MAT_CONSTANTS;
const {
  saveConfig, saveCumulative, saveHistory,
  saveCustomTeam, saveTeamLibrary, saveTplLibrary,
  saveSceneConfigs, saveScenePrompts,
  saveMemory, saveProjects, saveProjectMemory,
  saveKnowledgeBase,
  saveModelFailures, loadModelFailures,
  saveCustomModels, loadCustomModels,
  saveHiddenModels, loadHiddenModels,
  savePurgedModels, loadPurgedModels,
} = MAT_STORAGE;
const {
  readOpenAIStream, readDeepSeekR1Stream, readAnthropicStream,
  convertOpenAIMessagesToAnthropic,
} = MAT_STREAM;
const {
  ApiError,
  callLLM,
  callOpenAI, callAnthropic, callQwen, callDeepSeek, callDoubao, callGemini,
} = MAT_LLM;
const {
  PROJECT_COLORS,
  getActiveProjectId,
  getProjectMemory, getProjectHistory,
  ensureDefaultProject, ensureProjectColors, migrateMemoryToProjects,
  createProject, switchProject, deleteProject, renameProject,
  pickProjectColor,
} = MAT_STORE;
const {
  TOOLS,
  sanitizeSearchDescription,
  getToolsForAgent,
  executeToolCall,
} = MAT_TOOLS;
const { AGENTS } = MAT_AGENTS_DICT;
const { SIM_TEMPLATES, callSimulated, extractTopic } = MAT_SIMULATED;
const {
  setTaskStatus, updateProgress,
  renderAgentMsg, renderUserMsg, renderSystemMsg,
  renderToolCallMsg, finalizeToolCallMsg,
  renderPhaseDivider,
} = MAT_UI;
const {
  detectLoop,
  runAgent,
  runTeamPipeline, runTeamReflection,
  renderPhaseList,
  runDecisionScene, runDossierScene,
  checkDossierFormat, checkEvidenceFormat,
  launchTask,
} = MAT_ORCHESTRATOR;
// F+13 Sprint 1.5 / Phase D wave 1
const {
  ENC_FLAG_KEY, ENC_SALT_KEY, ENC_SESSION_KEY, ENC_PBKDF2_ITERATIONS, ENC_SENSITIVE_KEYS,
  encryptionSetup, encryptionUnlock, encryptionIsLocked, encryptionEnabled,
  encryptionRekey, encryptionDisable,
  readEncryptedJSON, writeEncryptedJSON,
  _restoreSessionKey,  // F+13 bugfix
} = MAT_ENCRYPTION;
const {
  IDB_NAME, IDB_VERSION, IDB_STORE_KB, IDB_STORE_HISTORY,
  openIDB, idbPut, idbGetAll, idbDelete, idbClear,
  migrateBigDataToIDB, loadKBDocChunks,
} = MAT_IDB;
const {
  KB_MAX_FILE_BYTES, KB_CHUNK_SIZE, KB_RECALL_TOP_K,
  chunkText, addKnowledgeBaseFile, deleteKbDocument, recallKnowledgeBase,
} = MAT_KB;
const {
  SCENE_AGENT_LIST,
  buildBuiltinTeamForScene, resolveAgentModel, sceneIsCustomized,
} = MAT_SCENE_CONFIG;

/* ====================== 1. 常量与配置 ====================== */
// F+13 Sprint 1: 全部常量已迁移到 ./src/lib/constants.js（解构于 app.js 顶部）
// 包括：VERSION, 11 storage keys, HISTORY_LIMIT, MEMORY_* 配置,
//      MAX_TOKENS_PER_TURN, TOTAL_TOKEN_BUDGET, COST_CAP_USD, TIMEOUTS,
//      MAX_INTERVENTIONS, MAX_USER_INPUT_LEN, TOOL_LOOP_MAX, TOOL_TIMEOUT_MS,
//      MEMORY_FACT_EXPIRE_DAYS, MEMORY_DEDUP_JACCARD_THRESHOLD

/* ====================== 2. 场景路由器（设计档案 15） ====================== */

// F+11 产品聚焦：删除分析/学习/创意 + F+12 删除写作 → 只保留规划/决策/起底 3 个核心场景
// 注：SCENE_FLOWS / Agent definitions / 调度函数 保留，自定义团队仍可引用相关 Agent（包括写作 Pipeline）
const SCENE_RULES = [
  {
    id: 'planning', name: '规划', icon: '📋',
    keywords: ['规划', '计划', '方案', '排期', '里程碑', '路线图', '上线'],
    negative: [],
    priority: 2,
  },
  {
    id: 'decision', name: '决策', icon: '⚖️',
    keywords: ['选择', '决定', '该选', '还是', '值得', '要不要', '该不该', '买不买', '接受', '选哪个'],
    negative: [],
    priority: 3,
  },
  {
    id: 'dossier', name: '起底', icon: '🔍',
    keywords: ['起底', '调查', '查查', '查证', '底细', '背调', '深扒', '扒一扒', '真相', '什么来头', '什么背景', '到底是', '了解一下', '是谁', '是个什么', '档案'],
    negative: [],
    priority: 4,
  },
];

/**
 * 路由算法（设计档案 15.2）
 * @returns {{state, matches, primary}}
 *   state: 'unique' | 'conflict' | 'unmatched' | 'low'
 */
function routeScene(text) {
  const t = text.toLowerCase().trim();
  if (!t) return { state: 'unmatched', matches: [], primary: null };

  // 特殊规则：含"还是"等二选一结构 → 决策场景优先（设计档案 15.4）
  if (/[一-龥]还是[一-龥]/.test(text) || /该选.*还是/.test(text)) {
    const decision = SCENE_RULES.find(s => s.id === 'decision');
    return {
      state: 'unique', primary: { ...decision, confidence: 0.95, hits: ['还是'] }, matches: [decision]
    };
  }

  const matches = [];
  for (const rule of SCENE_RULES) {
    // 否定词：命中则排除
    if (rule.negative.some(n => t.includes(n))) continue;

    const hits = rule.keywords.filter(k => t.includes(k));
    if (hits.length === 0) continue;

    // 置信度：N 个命中按 0.4/个累加，封顶 1.0。
    // 1 命中=0.4(low) / 2 命中=0.8(unique) / 3+ 命中=1.0(unique)
    // 避免长关键词列表稀释置信度（原 hits/total 公式对大词表不友好）
    const confidence = Math.min(1, hits.length * 0.4);
    matches.push({ ...rule, hits, confidence });
  }

  if (matches.length === 0) {
    return { state: 'unmatched', matches: [], primary: null };
  }
  // 按 confidence 降序
  matches.sort((a, b) => b.confidence - a.confidence || a.priority - b.priority);

  const top = matches[0];
  if (matches.length === 1 && top.confidence >= 0.4) {
    return { state: top.confidence >= 0.7 ? 'unique' : 'low', primary: top, matches };
  }
  if (matches.length >= 2) {
    const second = matches[1];
    // 如果第一名 confidence 显著高于第二名 → unique；否则 conflict
    if (top.confidence >= 0.7 && top.confidence - second.confidence >= 0.2) {
      return { state: 'unique', primary: top, matches };
    }
    return { state: 'conflict', primary: top, matches: matches.slice(0, 3) };
  }
  return { state: 'low', primary: top, matches };
}

/* ====================== 3. 6 场景 Agent 定义 ====================== */

// F+13 Sprint 1: AGENTS 字典（670 行）→ ./src/scenes/agents.js（解构于 app.js 顶部）

// F+ forceTools 标志：决策 / 分析 / 写作场景对事实必须严格 → 决策场景全程强制工具
//                     写作 / 分析 → Agent 们都强制工具（前提是 Tavily Key 已配）
const SCENE_FLOWS = {
  // 写作：Pipeline 4 工序（F+ 全套：4 道工序都强制工具）
  writing:  { mode: 'pipeline', agents: ['writing_planner', 'writing_drafter', 'writing_polisher', 'writing_proofreader'], budget: 'default', forceTools: true },
  // 分析：Sequential 4 轮（F+ 全套：analyst + industry 都强制工具）
  analysis: { mode: 'sequential', agents: ['analyst', 'industry', 'analyst', 'industry'], rounds: 4, budget: 'default', forceTools: true },
  // 规划：Reflection（不强制，走全局开关）
  planning: { mode: 'reflection', creator: 'pm', critic: 'advisor', rounds: 3, budget: 'default' },
  // 学习：Sequential（不强制，走全局开关）
  learning: { mode: 'sequential', agents: ['teacher', 'student', 'teacher', 'student'], rounds: 4, budget: 'default' },
  // 创意：Reflection（不启用工具，避免拖累发散思维）
  creative: { mode: 'reflection', creator: 'creative', critic: 'reviewer', rounds: 3, budget: 'default' },
  // 决策：Multi-phase（沿用 runDecisionScene，已 F+）
  decision: { mode: 'multi-phase', phases: 3, budget: 'decision', forceTools: true },
  // 起底：Multi-phase（F+12 客观事实档案场景，沿用 runDossierScene）
  dossier:  { mode: 'multi-phase', phases: 3, budget: 'dossier',  forceTools: true },
};

/** Tavily Search Key 是否已配置 */
function hasTavilyKey() { return !!state.config.tavilyKey?.trim(); }

const SCENE_PRESETS = {
  writing:  { rounds: 4, baseIn: 1500, perOut: 800, agents: 2 },
  analysis: { rounds: 4, baseIn: 1800, perOut: 600, agents: 2 },
  planning: { rounds: 4, baseIn: 1600, perOut: 700, agents: 2 },
  learning: { rounds: 4, baseIn: 1200, perOut: 600, agents: 2 },
  creative: { rounds: 4, baseIn: 1500, perOut: 700, agents: 2 },
  decision: { rounds: 6, baseIn: 3000, perOut: 500, agents: 4 },
  dossier:  { rounds: 6, baseIn: 3000, perOut: 600, agents: 4 },  // 起底场景：4 Agent，archivist 9 段输出预算略高
  custom:   { rounds: 4, baseIn: 1500, perOut: 700, agents: 2 },  // 默认值，实际取自团队配置
};

// F+13 Sprint 1.5/B: DEFAULT_CUSTOM_TEAM → ./src/state/state.js（与 state 一起，避免加载顺序问题）
// 仍通过 window.DEFAULT_CUSTOM_TEAM 全局可见

// Agent 颜色 palette —— 自定义 Agent 可选用
const AGENT_COLOR_PALETTE = [
  { cls: 'agent-researcher',  color: '#4ade80', label: '绿' },
  { cls: 'agent-editor',      color: '#6c8cff', label: '蓝' },
  { cls: 'agent-analyst',     color: '#c084fc', label: '紫' },
  { cls: 'agent-industry',    color: '#fb923c', label: '橙' },
  { cls: 'agent-pm',          color: '#06b6d4', label: '青' },
  { cls: 'agent-advisor',     color: '#ec4899', label: '粉' },
  { cls: 'agent-teacher',     color: '#facc15', label: '黄' },
  { cls: 'agent-creative',    color: '#f87171', label: '红' },
];

// ========== 多模型讨论范式预设（8 套）==========
// 每套都是经过设计的"模型选择 + 角色搭配"，不是随手挑的：
//   - 不同 Agent 用不同厂商，降低同源偏见
//   - 推理强的留给关键节点（裁判 / 综合 / 反驳）
//   - 便宜的留给搜集事实 / 草稿等可大量重复的环节
const PRESET_TEAMS = [
  {
    id: 'preset_debate',
    name: '⚖️ 三方对抗辩论（顺序）',
    tagline: '正方 + 反方 + 中立裁判，让结论从碰撞中浮现',
    useCase: '决策类问题：选 A 还是 B、要不要做某事、值不值得',
    mode: 'sequential', rounds: 4,
    agents: [
      { key: 'p1', name: '正方辩手', icon: '⊕', cls: 'agent-info-a', model: 'claude-3-5-sonnet-latest', phase: 1,
        system: '你是正方辩手。任务：为给定方案搜集最强支持证据，论证为何"可行/值得"。\n要求：\n- 每个论点必须含数据/案例/权威来源\n- 不强词夺理；遇到 Agent 反驳要正面回应\n- 不模拟用户、不下最终结论' },
      { key: 'p2', name: '反方辩手', icon: '⊖', cls: 'agent-info-b', model: 'gpt-4o', phase: 1,
        system: '你是反方辩手。任务：搜集最强反对证据，论证为何"不可行/不值得"。\n要求：\n- 论据必须基于风险、失败案例、量化劣势\n- 必须引用正方的具体论点予以驳斥\n- 不模拟用户、不下最终结论' },
      { key: 'p3', name: '中立裁判', icon: '⚖', cls: 'agent-coordinator', model: 'deepseek-reasoner', phase: 1,
        system: `你是中立裁判 —— 基于正反双方全部论据给出最终结论。
**核心原则：先论证 → 后结论。结论只能在最后给出。**

按以下 7 段结构输出（每段必须写完才进下一段，结论不能提前）：

## 1. 问题回顾
重述用户原始问题 + 决策框架（二选一/是否/排序）+ ≥ 3 个评判维度

## 2. 证据评估（分质量层）
### ✅ 高质量证据（采纳）：[证据]（来源）— 采信理由
### ⚠ 中等证据（条件采纳）
### ❌ 低质量证据（排除）：[证据] — 排除理由（来源不可靠 / 推理断 / 与 X 矛盾）

## 3. 关键分歧点
逐条："分歧核心 → 正方观点+依据 → 反方观点+依据 → 我的判断+为什么"

## 4. 推理过程（最关键）
展示完整逻辑链：由证据 X+Y → 推出 A；由证据 Z → 推出 B；A+B 结合 → 指向某方向；受 [某约束] 影响 → 折中

## 5. 关键假设与边界
- 核心假设：[结论依赖什么前提]
- 假设不成立时：结论会变成什么
- 适用边界：什么条件下成立 / 失效

## 6. 置信度评估
[高 / 中 / 低] + 理由

## 7. 最终结论（**只能在此处给出**）
- 决定：[明确选择]
- 一句话总结
- 如果置信度 < 高，列 2-3 个"为推高置信度需验证的事项"

绝对禁止：在 1-6 段剧透结论；引用证据不写来源；用"显然"等无证据修饰词。` },
    ],
  },

  {
    id: 'preset_debate_phase',
    name: '🏛 三方辩论（多阶段：并行取证 → 质证 → 裁决）',
    tagline: '决策场景同款架构：Phase1 三方独立取证（互相隔离）→ Phase2 交叉质证 → Phase3 独立裁决',
    useCase: '高质量决策：选 A 还是 B、要不要立项、是否接 offer —— 强制证据碰撞，避免单源偏见',
    mode: 'multi-phase', rounds: 0,
    agents: [
      { key: 'p1', name: '信息-正面', icon: 'A', cls: 'agent-info-a', model: 'claude-3-5-sonnet-latest', phase: 1, toolsEnabled: true,
        system: `你是「信息-正面」立场（F+ 强制工具版）。
**第一步必须 web_search**（≥ 2 次），围绕用户问题搜真实正面证据 / 成功案例 / 优势数据。
仅在搜索后陈述证据。每条含 [证据] [来源真实 URL] [置信度: 高/中/低] [推理链] 四要素。
≥ 3 条（≤ 5 条）+ 1-2 条"搜到但没采用的反证"作元认知。
绝对禁止：编造数据/URL；跳过 web_search 凭训练数据下结论；扮演用户/下最终结论。` },
      { key: 'p2', name: '信息-反面', icon: 'B', cls: 'agent-info-b', model: 'gpt-4o', phase: 1, toolsEnabled: true,
        system: `你是「信息-反面」立场（F+ 强制工具版）。
**第一步必须 web_search**（≥ 2 次），搜真实失败案例 / 风险因素 / 量化劣势 / 隐性成本。
每条证据含 [证据] [来源真实 URL] [置信度] [推理链] 四要素，≥ 3 条。
+ 1-2 条"我承认但弱化的正面事实"避免偏激。
绝对禁止：编造案例/URL；跳过 web_search；扮演用户/下最终结论。` },
      { key: 'p3', name: '信息-独立视角', icon: 'C', cls: 'agent-info-c', model: 'qwen-plus', phase: 1, toolsEnabled: true,
        system: `你是「信息-独立视角」—— 做 A 和 B 都不会做的事。
**3 段输出（必须）**：
## 1. 客观基准（≥ 3 条）—— 第三方调研 / 行业基准，含 [来源真实 URL] [时间戳]
## 2. 隐藏假设（≥ 2 条，最关键）—— "双方很可能默认 X，但如果 X 变了呢？"
## 3. 重构警示（可选）—— "用户问 A vs B，但可能根本不是二选一"
绝对禁止：站边/给判决；编造 URL；与 A B 的事实陈述大量重叠。` },
      { key: 'p4', name: '质证-A', icon: 'A?', cls: 'agent-info-a', model: 'claude-3-5-sonnet-latest', phase: 2,
        system: '你是 Phase 2 质证者（持正面立场）。任务：阅读 Phase 1 三方证据后，指出反面与中立的具体漏洞或偏见。\n必须引用对方原话或论点（标注 [回应 信息-反面/中立]）。' },
      { key: 'p5', name: '质证-B', icon: 'B?', cls: 'agent-info-b', model: 'gpt-4o', phase: 2,
        system: '你是 Phase 2 质证者（持反面立场）。任务：指出正面与中立的具体漏洞或偏见。\n必须引用对方原话或论点（标注 [回应 信息-正面/中立]）。' },
      { key: 'p6', name: '裁决官', icon: '⚖', cls: 'agent-coordinator', model: 'deepseek-reasoner', phase: 3, toolsEnabled: true,
        system: `你是 Phase 3 裁决官 —— 基于 Phase 1 全部证据 + Phase 2 质证记录，按证据质量裁决。

**🔧 F+ 强制预核查**：8 段论述前先列 3-5 条裁决依赖的关键事实 → 用 web_search 二次核查 → 把核查结果作为内部 ground truth 影响论述。

**核心原则：先论证 → 后结论。结论只能出现在第 7 段，不能提前。**
**铁律**：不调工具、不补新证据；按证据质量裁决（不按数量投票）；推理每步可追溯到具体证据。

强制 8 段结构（按顺序写完）：

## 1. 问题回顾
- 原始问题 + 决策框架 + 评判维度（≥ 3）

## 2. 证据评估
### ✅ 高质量证据：[证据]（来源：信息-X / 质证-X）— 采信因为
### ⚠ 中等证据（条件采纳）
### ❌ 低质量证据（排除）：[证据] — 排除因为（被 Phase 2 质证驳倒 / 来源不可靠 / 推理断 / 与中立基准矛盾）

## 3. 关键分歧点
对 Phase 2 暴露的每个核心分歧："分歧核心 → 正方依据 → 反方依据 → 中立基准 → 我的判断 + 为什么"

## 4. 推理过程（最关键）
完整逻辑链：由证据 X+Y → 阶段结论 A；由证据 Z + 中立基准 → 阶段结论 B；A+B 整合 → 指向某方向；受 [约束] → 折中或限定

## 5. 关键假设与边界
- 核心假设
- 假设不成立时结论变化
- 适用 / 失效边界

## 6. 置信度评估
[高 / 中 / 低] + 理由（证据数量 + 质量 + 关键不确定性）

## 7. 最终结论（**只能在此处给出**）
- 决定：[明确选择 / 行动]
- 一句话总结
- 关键依赖："此结论建立在 [核心证据] 成立的前提下"

## 8. 建议下一步
- 置信度 < 高 → 必须列 2-3 个"为推高置信度需要验证的事项"
- 如有可执行行动 → 列"第一步该做什么"

绝对禁止：1-6 段任何位置剧透结论；引用证据不写来源；用"显然"等无证据修饰词；跳过任何段。` },
    ],
  },

  {
    id: 'preset_multiview_analysis',
    name: '📊 多视角分析',
    tagline: '数据 + 行业 + 反向思考 + 综合，4 路并进减盲点',
    useCase: '竞品分析、市场分析、产品复盘',
    rounds: 4,
    agents: [
      { key: 'p1', name: '数据分析师', icon: 'D', cls: 'agent-analyst', model: 'gpt-4o',
        system: '你专长：数据解读、量化分析、趋势判断。\n要求：先关键指标，再趋势判断，标注数据来源与置信度。' },
      { key: 'p2', name: '行业研究员', icon: 'I', cls: 'agent-industry', model: 'claude-3-5-sonnet-latest',
        system: '你专长：行业格局、竞争关系、定性分析。补充数据分析师未覆盖的格局视角。' },
      { key: 'p3', name: '反向思考者', icon: '↺', cls: 'agent-info-b', model: 'deepseek-reasoner',
        system: '你的任务：扮演反方，对前两位的分析挑刺 — 数据有没有隐性偏差？行业格局判断会不会过时？必须给出具体证据。' },
      { key: 'p4', name: '综合者', icon: 'Σ', cls: 'agent-coordinator', model: 'qwen-plus',
        system: '你不引入新信息，只综合前三位的输出，给出最终判断与下一步建议。结构化输出：核心结论 / 关键证据 / 关键分歧 / 置信度 / 下一步。' },
    ],
  },

  {
    id: 'preset_writing_pipeline',
    name: '✍️ 写作流水线（Pipeline）',
    tagline: '选题 → 撰稿 → 润色 → 校对，4 道工序线性流水（每道工序 1 次，不循环）',
    useCase: '长文、深度报告、技术周报、产品文档',
    mode: 'pipeline', rounds: 0,
    agents: [
      { key: 'p1', name: '选题策划', icon: '☆', cls: 'agent-creative', model: 'claude-3-5-sonnet-latest',
        system: '你是流水线第 1 道工序：选题策划。任务：基于用户需求给出文章选题、目标读者、核心论点、3 级大纲。要求结构清晰、有差异化角度。' },
      { key: 'p2', name: '撰稿', icon: '✎', cls: 'agent-editor', model: 'gpt-4o',
        system: '你是流水线第 2 道工序：撰稿。任务：基于上一位的选题与大纲撰写完整正文。要求语言流畅、论证扎实、长度适中。' },
      { key: 'p3', name: '润色', icon: '✦', cls: 'agent-pm', model: 'qwen-plus',
        system: '你是流水线第 3 道工序：润色。任务：对正文做语言润色，重点是中文表达自然度、段落节奏、关键词突出。不改动论点。' },
      { key: 'p4', name: '校对', icon: '☑', cls: 'agent-reviewer', model: 'gpt-4o-mini',
        system: '你是流水线第 4 道工序：校对。任务：交付最终稿件 — 检查事实错误、术语一致性、逻辑断层后修复并输出干净的最终版。' },
    ],
  },

  {
    id: 'preset_reflection',
    name: '🪞 反思打磨（Reflection）',
    tagline: '创作者写 + 评论者批 + 创作者改，N 轮迭代到最佳',
    useCase: '单一产出的反复打磨：文案、代码、方案、邮件',
    mode: 'reflection', rounds: 3,
    agents: [
      { key: 'p1', name: '创作者', icon: '✎', cls: 'agent-editor', model: 'claude-3-5-sonnet-latest', role: 'creator',
        system: '你是创作者。任务：基于用户需求产出完整内容。后续根据评论者反馈持续修订，每轮都给出全新完整版（不要只改部分）。' },
      { key: 'p2', name: '评论者', icon: '⚡', cls: 'agent-reviewer', model: 'deepseek-reasoner', role: 'critic',
        system: '你是严格的评论者。任务：阅读创作者本轮产出，指出 3-5 个具体问题：哪里弱、为什么、怎么改。不要重写，只点评。最后用 [评分 X/10] 收尾。' },
    ],
  },

  {
    id: 'preset_hubspoke',
    name: '🎙 多专家问诊（Hub-Spoke）',
    tagline: '中心拆问题 → 多专家分别答 → 中心综合',
    useCase: '复杂模糊问题需要多视角专家共同破局',
    mode: 'hub-spoke', rounds: 1,
    agents: [
      { key: 'p1', name: '中心协调者', icon: '◎', cls: 'agent-coordinator', model: 'claude-3-5-sonnet-latest', role: 'hub',
        system: '你是中心协调者。先把用户问题拆成 N 个清晰子问题，每个给一位专家。最终综合所有专家答案给出结构化结论。' },
      { key: 'p2', name: '技术专家', icon: 'T', cls: 'agent-analyst', model: 'gpt-4o', role: 'spoke',
        system: '你是技术专家。从技术可行性、架构、性能角度回答中心交给你的问题。' },
      { key: 'p3', name: '业务专家', icon: 'B', cls: 'agent-industry', model: 'qwen-plus', role: 'spoke',
        system: '你是业务专家。从市场、用户、商业模式角度回答中心交给你的问题。' },
      { key: 'p4', name: '风险专家', icon: 'R', cls: 'agent-info-b', model: 'deepseek-reasoner', role: 'spoke',
        system: '你是风险专家。识别中心交给你的问题中的潜在风险、失败模式、需关注的边界。' },
    ],
  },

  {
    id: 'preset_socratic',
    name: '🎓 苏格拉底学习',
    tagline: '老师讲解 + 学生持续追问，逼出概念的边界',
    useCase: '深度理解一个概念、新领域入门、知识体系搭建',
    rounds: 6,
    agents: [
      { key: 'p1', name: '老师', icon: 'T', cls: 'agent-teacher', model: 'claude-3-5-sonnet-latest',
        system: '你是老师。任务：用最简单的类比讲解给定概念，避免堆砌术语。每轮基于学生的追问深化讲解。' },
      { key: 'p2', name: '追问的学生', icon: 'S', cls: 'agent-student', model: 'deepseek-reasoner',
        system: '你是好奇的学生。任务：在每轮老师讲解后，提出 1-2 个直击概念边界的问题，暴露老师讲解中的潜在简化或盲点。\n要求：问题必须具体、不重复、能推动讲解深入。' },
    ],
  },

  {
    id: 'preset_4vendor',
    name: '🔬 四厂商对照',
    tagline: 'OpenAI / Anthropic / 通义千问 / DeepSeek 各发一言，直观看差异',
    useCase: '想观察同一问题不同模型的回答风格、推理路径、知识边界',
    rounds: 2,
    agents: [
      { key: 'p1', name: 'GPT 视角', icon: 'G', cls: 'agent-editor', model: 'gpt-4o',
        system: '你是 GPT 系列模型。基于自身知识与推理给出对该问题的回答。保持自己的风格特征。' },
      { key: 'p2', name: 'Claude 视角', icon: 'C', cls: 'agent-analyst', model: 'claude-3-5-sonnet-latest',
        system: '你是 Claude 系列模型。基于自身知识与推理给出对该问题的回答。保持自己的风格特征。' },
      { key: 'p3', name: '通义千问视角', icon: 'Q', cls: 'agent-industry', model: 'qwen-plus',
        system: '你是通义千问。基于自身知识（特别是中文语境）给出回答。' },
      { key: 'p4', name: 'DeepSeek 视角', icon: 'D', cls: 'agent-pm', model: 'deepseek-chat',
        system: '你是 DeepSeek。基于自身推理能力给出回答。' },
    ],
  },

  {
    id: 'preset_creative_trio',
    name: '🎨 创意三人组',
    tagline: '发散 + 评审 + 用户视角，避免空中楼阁',
    useCase: '产品命名、slogan、活动创意、营销点子',
    rounds: 4,
    agents: [
      { key: 'p1', name: '创意发散者', icon: '✨', cls: 'agent-creative', model: 'qwen-plus',
        system: '你的任务：基于需求一次性给出 5-8 个差异化方向，每个 1 句话核心创意。不评判，先发散。' },
      { key: 'p2', name: '逻辑评审', icon: '✓', cls: 'agent-reviewer', model: 'claude-3-5-sonnet-latest',
        system: '你的任务：对发散方向打分（1-5），从可行性 / 差异化 / 传达力三维度评判，筛出 Top 2-3 并给出强化建议。' },
      { key: 'p3', name: '用户视角', icon: '◔', cls: 'agent-student', model: 'gpt-4o-mini',
        system: '你扮演真实目标用户。任务：从用户角度对评审推荐的 Top 创意提出第一反应、疑虑、记忆点是否清晰。' },
    ],
  },

  {
    id: 'preset_economy',
    name: '💰 经济型团队',
    tagline: '全用便宜模型，日常轻任务首选',
    useCase: '日常写邮件、简单总结、不挑剔的辅助任务',
    rounds: 4,
    agents: [
      { key: 'p1', name: '研究员', icon: 'R', cls: 'agent-researcher', model: 'qwen-turbo',
        system: '你是研究员，搜集事实和要点。简洁、信息密度高。' },
      { key: 'p2', name: '编辑', icon: 'E', cls: 'agent-editor', model: 'qwen-turbo',
        system: '你是编辑，基于研究员素材撰写结构化文本。' },
    ],
  },

  {
    id: 'preset_deep_reasoning',
    name: '🧠 深度推理团队',
    tagline: '信息收集用便宜模型，推理用 R1',
    useCase: '技术选型、复杂决策、需要系统思考的难题',
    rounds: 4,
    agents: [
      { key: 'p1', name: '信息收集', icon: '📚', cls: 'agent-researcher', model: 'gpt-4o-mini',
        system: '你的任务：列出该问题相关的所有事实、约束、已知方案、典型案例。不下结论，只提供材料。' },
      { key: 'p2', name: '深度推理', icon: '🧠', cls: 'agent-coordinator', model: 'deepseek-reasoner',
        system: '你的任务：基于上一位提供的材料，进行多步推理给出结论。展示推理链：假设 → 推导 → 验证 → 反例 → 结论。' },
    ],
  },
];

// Agent 身份模板（一键填入 system prompt）
const AGENT_IDENTITY_TEMPLATES = [
  { name: '研究员',  system: '你是一个研究员，擅长搜集资料、列出关键事实和数据。\n要求：\n- 用条目化输出\n- 标注信息可信度' },
  { name: '编辑',    system: '你是一个编辑，擅长结构化写作、润色语言、确保逻辑连贯。\n要求：\n- 基于上轮素材撰写\n- 关注表达准确' },
  { name: '数据分析师', system: '你是数据分析师，擅长数据解读、趋势判断、量化分析。\n要求：先给关键数据，再做趋势判断' },
  { name: '行业研究员', system: '你是行业研究员，擅长行业背景、竞争格局、定性分析。补充分析师未覆盖的格局视角。' },
  { name: '批评家',  system: '你是一个批评家，专门挑前一轮发言的逻辑漏洞和论据问题。\n要求：每条批评必须引用具体论点，并给出修复建议' },
  { name: '辩护者',  system: '你是一个辩护者，对前一轮发言做最强有力的辩护，找出对方批评中不成立的部分。' },
  { name: '老师',    system: '你是老师，擅长概念解释、类比教学、循序渐进。从最简单的类比入手。' },
  { name: '学生',    system: '你是学生，模拟学习者提问、暴露理解盲点。以初学者口吻提出 1-2 个具体问题。' },
  { name: '创意总监', system: '你是创意总监，擅长发散思维、概念生成。给出 3-5 个差异化方向，每个附核心创意说明。' },
  { name: '产品经理', system: '你是产品经理，擅长需求拆解、优先级判断、跨职能协调。聚焦"做什么 + 为什么 + 给谁"。' },
];

/* ====================== 4. 状态 ====================== */

// F+13 Sprint 1.5/B: state 定义 → ./src/state/state.js
// state 通过 MAT_STATE.state 暴露 + window.state 双轨（兼容现有 IIFE modules）
const { state } = MAT_STATE;  // 保留 const state 引用，app.js 内代码不变

/* ====================== 5. 工具函数 ====================== */

const $ = id => document.getElementById(id);

// F+13 Sprint 1: escapeHtml → MAT_UTILS（解构于 app.js 顶部）
function sanitizeMarkdown(md) {
  const html = marked.parse(md || '', { breaks: true, gfm: true });
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc'],
  });
}
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return 'sk-…';
  return k.slice(0, 3) + '…' + k.slice(-4);
}
// F+13 Sprint 1: tokensFromText → MAT_UTILS（解构于 app.js 顶部）
function calcCost(inputTokens, outputTokens, model) {
  const p = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini'];
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

// 判定某厂商是否已配置 Key（决定真实 API / 模拟模式）
function vendorHasKey(vendor) {
  return {
    openai:    !!state.config.openaiKey,
    anthropic: !!state.config.anthropicKey,
    qwen:      !!state.config.qwenKey,
    deepseek:  !!state.config.deepseekKey,
    doubao:    !!state.config.doubaoKey,
    gemini:    !!state.config.geminiKey,
  }[vendor] || false;
}
function modelHasKey(model) {
  return vendorHasKey((MODEL_PRICING[model] || {}).vendor);
}
function anyKeyConfigured() {
  return ['openai','anthropic','qwen','deepseek','doubao','gemini'].some(vendorHasKey);
}
// F+13 Sprint 1: fmtUsd / fmtUsdShort / sleep → MAT_UTILS（解构于 app.js 顶部）
// F+9 暂停等待 helper：循环 sleep 直到用户继续；期间响应 abort 避免死循环（abort 不会自动清 paused）
// （暂保留在 app.js：依赖 state.paused / state.aborted，需 Sprint 1 state 中央化后再外移）
async function waitWhilePaused() { while (state.paused && !state.aborted) await sleep(200); }

/* ====================== 6. 持久化（localStorage） ====================== */

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 向后兼容：旧字段 braveSearchKey → tavilyKey（一次性迁移）
      if (parsed.braveSearchKey && !parsed.tavilyKey) parsed.tavilyKey = '';
      delete parsed.braveSearchKey;
      Object.assign(state.config, parsed);
    }
  } catch {}
  try {
    const c = localStorage.getItem(CUMULATIVE_KEY);
    if (c) Object.assign(state.cumulative, JSON.parse(c));
  } catch {}
  try {
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) state.history = JSON.parse(h);
  } catch {}
  try {
    const t = localStorage.getItem(TEAM_KEY);
    if (t) state.customTeam = JSON.parse(t);
  } catch {}
  try {
    const lib = localStorage.getItem(TEAM_LIBRARY_KEY);
    if (lib) state.teamLibrary = JSON.parse(lib);
  } catch {}
  try {
    const tlib = localStorage.getItem(TPL_LIBRARY_KEY);
    if (tlib) state.tplLibrary = JSON.parse(tlib);
  } catch {}
  try {
    const sc = localStorage.getItem(SCENE_CFG_KEY);
    if (sc) state.sceneConfigs = JSON.parse(sc);
  } catch {}
  try {
    const sp = localStorage.getItem(SCENE_PROMPT_KEY);
    if (sp) state.scenePrompts = JSON.parse(sp);
  } catch {}
  try {
    const m = localStorage.getItem(MEMORY_KEY);
    if (m) {
      const parsed = JSON.parse(m);
      // 深合并，保留默认 settings 项以便后续新增字段不丢
      state.memory = {
        ...state.memory, ...parsed,
        settings: { ...state.memory.settings, ...(parsed.settings || {}) },
        userProfile: { ...state.memory.userProfile, ...(parsed.userProfile || {}) },
      };
    }
  } catch {}
  try {
    const p = localStorage.getItem(PROJECTS_KEY);
    if (p) state.projects = JSON.parse(p);
  } catch {}
  // F+11 Level 3：加载项目隔离的 memory + activeProjectId
  try {
    const mbp = localStorage.getItem(MEMORY_BY_PROJECT_KEY);
    if (mbp) state.memoryByProject = JSON.parse(mbp);
  } catch {}
  try {
    const apid = localStorage.getItem('myAgentTeam.activeProjectId');
    if (apid) state.activeProjectId = apid;
  } catch {}
  // 旧数据迁移到 default 项目（幂等，仅首次加载时生效）
  try { migrateMemoryToProjects(); } catch (e) { console.warn('migrateMemoryToProjects failed', e); }
  try {
    const kb = localStorage.getItem(KB_KEY);
    if (kb) state.knowledgeBase = JSON.parse(kb);
  } catch {}
}
// F+13 Sprint 1: saveConfig / saveCumulative / saveHistory → ./src/persist/storage.js

/** 把刚完成的任务追加到历史 */
function pushHistory(task, final) {
  const sceneMeta = task.sceneId === 'custom'
    ? { icon: '🛠️', name: '自定义团队' }
    : SCENE_RULES.find(s => s.id === task.sceneId) || { icon: '·', name: task.sceneId };
  const mode = task.sceneId === 'custom'
    ? (state.customTeam.mode || 'sequential')
    : (SCENE_FLOWS[task.sceneId]?.mode || 'sequential');
  // 紧凑 history（保留 role + content 即可，移除瞬态字段）
  const compactHistory = (final.history || []).map(h => ({ role: h.role, content: h.content }));
  if (task.doNotRemember) return;  // 隐私 opt-out（阶段 4 配套）
  const entry = {
    id: 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    ts: Date.now(),
    sceneId: task.sceneId,
    sceneIcon: sceneMeta.icon,
    sceneName: sceneMeta.name,
    mode,
    userText: task.userText,
    projectId: task.projectId || state.activeProjectId || null,
    agents: Object.entries(final.tracker.byAgent || {}).map(([k, v]) => ({
      key: k, name: v._name || AGENTS[k]?.name || k, tokens: v.in + v.out
    })),
    tokens: final.tracker.totalTokens(),
    costUsd: final.tracker.cost(),
    durationMs: Date.now() - task.startAt,
    interventions: task.interventions || 0,
    history: compactHistory,
    result: buildFinalResult(task.sceneId, final),
  };
  state.history.push(entry);
  saveHistory();
}
// F+13 Sprint 1: 9 个 save 函数 → ./src/persist/storage.js (解构于 app.js 顶部)
// saveCustomTeam / saveTeamLibrary / saveTplLibrary / saveSceneConfigs / saveScenePrompts
// saveMemory / saveProjects / saveKnowledgeBase

/* 注：autoSummarizeUserProfile 的逻辑由下方现存的 autoLearnUserProfile 提供，
   两者意图重复，保留后者以避免破坏既有调用 */
async function _deprecated_autoSummarizeUserProfile(task, final) {
  const settings = state.memory.settings;
  if (!settings.autoSummarizeAfterTask) return;
  if (!anyKeyConfigured()) return;
  if (!final?.history?.length) return;

  // 找一个有 Key 的最便宜模型做摘要（默认 gpt-4o-mini / qwen-turbo / deepseek-chat / claude-haiku）
  const cheapPick = [
    'gpt-4o-mini', 'qwen-turbo', 'deepseek-chat', 'claude-3-5-haiku-latest',
    'gemini-2.0-flash-lite', 'doubao-seed-2-0-lite-260428',
  ].find(modelHasKey);
  if (!cheapPick) return;

  const lastTurns = final.history.slice(-6).map(h => `[${h.role}] ${(h.content || '').slice(0, 300)}`).join('\n');
  const sysPrompt = `你是一个观察助手。读以下用户任务过程，提炼 0-3 条"关于该用户的新事实"（例如偏好、领域、习惯、目标）。
规则：
- 每条 ≤ 30 字，独立成行
- 必须是这次任务真正展现的，而非编造
- 不重复已知事实
- 没有可学的就只输出 NONE
- 不要序号、不要解释、不要标点开头

已知事实：${(state.memory.userProfile.learnedFacts || []).map(f => f.text).join(' / ') || '（暂无）'}`;
  const userMsg = `用户原始请求：${task.userText}\n\n讨论摘录：\n${lastTurns}\n\n请提炼 0-3 条新事实，或输出 NONE。`;

  try {
    const tempModel = state.config.model;
    state.config.model = cheapPick;
    const res = await callLLM({ system: sysPrompt, userMsg, history: [], signal: null });
    state.config.model = tempModel;
    if (!res?.text) return;
    const newFacts = res.text.split('\n')
      .map(s => s.replace(/^[\s\-•\d.,)：:]+/, '').trim())
      .filter(s => s && s !== 'NONE' && s.length <= 80);
    if (newFacts.length === 0) return;
    const profile = state.memory.userProfile;
    profile.learnedFacts = profile.learnedFacts || [];
    for (const f of newFacts) {
      // 简单去重：跳过已存在的（Jaccard 含粗略）
      const lower = f.toLowerCase();
      if (profile.learnedFacts.some(existing => existing.text.toLowerCase().includes(lower) || lower.includes(existing.text.toLowerCase()))) continue;
      profile.learnedFacts.push({ text: f, ts: Date.now(), source: task.sceneId });
    }
    // FIFO cap
    if (profile.learnedFacts.length > MEMORY_MAX_PROFILE_FACTS) {
      profile.learnedFacts = profile.learnedFacts.slice(-MEMORY_MAX_PROFILE_FACTS);
    }
    saveMemory();
    if (newFacts.length) toast(`已学到 ${newFacts.length} 条关于你的新事实（设置面板可查看）`, 'info', 4000);
  } catch (e) { console.warn('autoSummarizeUserProfile failed', e); }
}

/* ====================== 加密层 · P3-D（Web Crypto + AES-GCM）====================== */

// F+13 Sprint 1.5/D: 加密层 → ./src/persist/encryption.js
/* ====================== IndexedDB 轻量封装 · P3-B ====================== */

// F+13 Sprint 1.5/D: IndexedDB 模块 → ./src/persist/indexeddb.js

/* ====================== 记忆 Hygiene · P3-C ====================== */

// F+13 Sprint 1: MEMORY_FACT_EXPIRE_DAYS / MEMORY_DEDUP_JACCARD_THRESHOLD → constants.js

// F+13 Sprint 1: jaccardSim / detectFactConflict → MAT_UTILS（解构于 app.js 顶部）

/** 主清理函数：过期 + 去重 + 冲突标记。返回报告 */
function runMemoryHygiene(opts = {}) {
  const m = state.memory;
  const pm = getProjectMemory();  // F+11 hygiene 只清理当前 active project 的 memory
  const settings = m.settings || {};
  const expireDays = settings.factExpireDays || MEMORY_FACT_EXPIRE_DAYS;
  const expireMs = expireDays * 24 * 3600_000;
  const now = Date.now();
  const report = { expired: 0, deduped: 0, conflicts: [], agentReSummarized: 0 };

  // 1) userProfile 过期清理（当前项目）
  const facts = pm.userProfile?.learnedFacts || [];
  const stillValid = [];
  for (const f of facts) {
    if (!f.ts || now - f.ts > expireMs) report.expired++;
    else stillValid.push(f);
  }
  // 2) 去重 + 冲突检测
  const final = [];
  for (const f of stillValid) {
    let dup = false;
    for (const kept of final) {
      const sim = jaccardSim(f.text, kept.text);
      if (sim >= MEMORY_DEDUP_JACCARD_THRESHOLD) { dup = true; report.deduped++; break; }
      if (detectFactConflict(f.text, kept.text)) {
        report.conflicts.push({ a: kept.text, b: f.text });
      }
    }
    if (!dup) final.push(f);
  }
  pm.userProfile.learnedFacts = final;

  // 3) Agent 记忆"老化"提示（每 10 任务后建议重新摘要）
  const am = pm.agentMemories || {};
  Object.keys(am).forEach(k => {
    if (typeof am[k] === 'object' && am[k].lastTaskCount != null) {
      if (state.cumulative.taskCount - am[k].lastTaskCount >= 10) report.agentReSummarized++;
    }
  });

  saveMemory();
  saveProjectMemory();
  if (opts.silent !== true) {
    const msg = `🧹 清理完成：过期 ${report.expired} / 去重 ${report.deduped} / 检出冲突 ${report.conflicts.length}`;
    toast(msg, report.conflicts.length ? 'warn' : 'ok', 4000);
  }
  return report;
}

function saveActiveTask() {
  if (state.task && !state.aborted) {
    const snap = {
      sceneId: state.task.sceneId,
      userText: state.task.userText,
      startAt: state.task.startAt,
      ts: Date.now(),
    };
    localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(snap));
  } else {
    localStorage.removeItem(ACTIVE_TASK_KEY);
  }
}
function resolveAgentSystemPrompt(sceneId, agentKey) {
  // 场景级 prompt 覆盖（用户在设置面板自定义过）优先级最高，且不参与 locale fallback
  // 因为用户写啥就用啥——可能用户写中文用户写英文都尊重
  const sp = state.scenePrompts[sceneId];
  if (sp && sp[agentKey]?.trim()) return sp[agentKey];
  // F+14 Phase 3：内置 prompt 走 locale fallback（systemEn 优先 if locale=en，否则 system）
  if (typeof MAT_I18N === 'object') return MAT_I18N.resolveSystemByLocale(AGENTS[agentKey]);
  return AGENTS[agentKey]?.system;
}

/**
 * #6 跨任务自动关联：根据用户输入关键词找出最近 N 条相关历史任务。
 * 关闭则空列表。基于本地关键词重叠度 + 同 project 加权。
 */
function findRelatedHistory(userText, projectId = null, limit = 3) {
  if (!state.memory.settings.enableAutoRelate) return [];
  if (!state.history.length) return [];
  const tokensOfText = (s) => new Set(
    (s || '').toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2)
  );
  const qTokens = tokensOfText(userText);
  if (qTokens.size === 0) return [];
  const scored = state.history.map(h => {
    const hTokens = tokensOfText(h.userText + ' ' + (h.result || '').slice(0, 500));
    let overlap = 0;
    for (const t of qTokens) if (hTokens.has(t)) overlap++;
    let score = overlap / qTokens.size;
    if (projectId && h.projectId === projectId) score += 0.3;  // 同项目加权
    return { entry: h, score };
  });
  return scored
    .filter(x => x.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.entry);
}

/* ====================== 知识库 RAG（#8 简化版）====================== */

// F+13 Sprint 1.5/D: KB 模块 → ./src/state/kb.js

function getProject(id) { return state.projects.find(p => p.id === id); }

/* ====================== 记忆注入 ====================== */

/**
 * 构造记忆注入文本块。返回 { text, breakdown:[{name,tokens}], totalTokens }
 * opts: { agentKey, includedTask, kbChunks }
 * 优先级（被裁剪时从低到高保留）：项目上下文 > 用户画像 > 引用任务 > KB > Agent 记忆
 */
// F+13 Sprint 1: F+11 项目空间 helper 全部 → ./src/state/store.js
// 包含：getActiveProjectId / getProjectMemory / getProjectHistory
//      ensureDefaultProject / ensureProjectColors / migrateMemoryToProjects
//      createProject / switchProject / deleteProject / renameProject
//      pickProjectColor / PROJECT_COLORS
//
// 设计：state 中央化第一阶段——把 F+11 加的 mutation 入口集中。
// 411 处直接 state.X 访问保持不变（避免 big-bang 重构），后续 Sprint 渐进迁移。


// F+13 Sprint 1.5/D wave 2: scene_config → ./src/scenes/scene_config.js

function genId() { return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 模式 → 中文短名 + 描述（用于卡片/下拉/弹层显示）
const MODE_LABEL = {
  'sequential':  { short: '顺序',     full: '顺序 · 轮流循环' },
  'pipeline':    { short: 'Pipeline', full: 'Pipeline · 线性流水线' },
  'reflection':  { short: 'Reflection', full: 'Reflection · 反思迭代' },
  'hub-spoke':   { short: 'Hub-Spoke',  full: 'Hub-Spoke · 中心辐射' },
  'multi-phase': { short: '多阶段',   full: '多阶段 · 并行→质证→裁决' },
};
function modeLabel(mode, kind = 'short') { return MODE_LABEL[mode || 'sequential']?.[kind] || mode || 'sequential'; }

// 描述某模式下"实际发言次数"的语义文案（团队库 / 预设展示用）
function turnsLabel(team) {
  const mode = team.mode || 'sequential';
  const N = team.agents?.length || 0;
  if (mode === 'pipeline')    return `${N} 工序`;
  if (mode === 'reflection')  return `${team.rounds || 3} 轮迭代`;
  if (mode === 'hub-spoke')   return `${team.rounds || 1} 循环`;
  if (mode === 'multi-phase') return `Phase 1/2/3`;
  return `${team.rounds || 4} 轮`;
}

function saveTeamAs(name) {
  const n = (name || '').trim();
  if (!n) { toast('请填写团队名称', 'warn'); return false; }
  const exists = state.teamLibrary.find(t => t.name === n);
  if (exists) {
    // 覆盖：保留 id 与 createdAt
    exists.team = JSON.parse(JSON.stringify(state.customTeam));
    exists.updatedAt = Date.now();
  } else {
    state.teamLibrary.push({
      id: genId(),
      name: n,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      team: JSON.parse(JSON.stringify(state.customTeam)),
    });
  }
  saveTeamLibrary();
  return true;
}

function loadTeam(id) {
  const t = state.teamLibrary.find(x => x.id === id);
  if (!t) { toast('团队不存在', 'warn'); return; }
  state.customTeam = JSON.parse(JSON.stringify(t.team));
  state.currentTeamId = id;
  saveCustomTeam();
  renderTeamAgentList();
  renderTeamLibraryDropdown();
  $('teamRounds').value = state.customTeam.rounds;
  $('teamNameInput').value = t.name;
  toast(`已切换到「${t.name}」`, 'ok');
}

function deleteTeam(id) {
  state.teamLibrary = state.teamLibrary.filter(t => t.id !== id);
  saveTeamLibrary();
  if (state.currentTeamId === id) state.currentTeamId = null;
  renderTeamLibraryDropdown();
}

/* ====================== 模板库 CRUD ====================== */

function saveTpl(name, system) {
  const n = (name || '').trim();
  const s = (system || '').trim();
  if (!n) { toast('请填写模板名称', 'warn'); return false; }
  if (!s) { toast('身份描述不能为空', 'warn'); return false; }
  const exists = state.tplLibrary.find(t => t.name === n);
  if (exists) {
    exists.system = s; exists.updatedAt = Date.now();
  } else {
    state.tplLibrary.push({
      id: genId(), name: n, system: s,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  }
  saveTplLibrary();
  return true;
}

function deleteTpl(id) {
  state.tplLibrary = state.tplLibrary.filter(t => t.id !== id);
  saveTplLibrary();
}

/* ====================== 7. UI 工具：Toast / Modal ====================== */

// F+19.1：toast 静态文案中→英映射（核心体验 100% i18n）
// 41 个 toast 多含模板插值，逐个改 et() 易错。改在 toast() 内统一翻译：
//   ① 纯静态字符串 → TOAST_EN 精确查表
//   ② 高频插值文案 → TOAST_PATTERNS 正则替换（保留变量）
const TOAST_EN = {
  '配置已保存': 'Settings saved',
  '请输入任务描述': 'Please enter a task description',
  '超出长度限制': 'Exceeds length limit',
  '已注入下一位 Agent 的上下文': 'Injected into next Agent context',
  '头像已设置': 'Avatar set',
  '头像已清除': 'Avatar cleared',
  'Markdown 已开始下载': 'Markdown download started',
  '已恢复默认': 'Restored to default',
  '请选择图片文件': 'Please select an image file',
  '读取失败': 'Read failed',
  '没有可导出的任务': 'No task to export',
  '请填写团队名称': 'Please enter a team name',
  '请先填写团队名称（左上输入框）': 'Please enter a team name first (top-left input)',
  '团队不存在': 'Team not found',
  '请填写模板名称': 'Please enter a template name',
  '身份描述不能为空': 'Identity description cannot be empty',
  '已删除模板': 'Template deleted',
  '最多 4 个 Agent': 'Max 4 Agents',
  '至少需要 1 个 Agent': 'At least 1 Agent required',
  '每个 Agent 都需要填写身份描述': 'Each Agent needs an identity description',
  'Phase 1 至少需要 1 个 Agent': 'Phase 1 needs at least 1 Agent',
  'Pipeline 模式至少需要 2 个 Agent': 'Pipeline mode needs at least 2 Agents',
  'Reflection 模式需要恰好 2 个 Agent：1 个 creator + 1 个 critic': 'Reflection mode needs exactly 2 Agents: 1 creator + 1 critic',
  'Hub-Spoke 模式需要恰好 1 个 hub + 至少 1 个 spoke': 'Hub-Spoke mode needs exactly 1 hub + at least 1 spoke',
  '改名成功': 'Renamed',
  '已删除': 'Deleted',
  '已切换': 'Switched',
  '任务运行中，不能切换项目': 'Task running, cannot switch project',
  '任务运行中，部分 UI 在任务结束后才会刷新': 'Task running, some UI refreshes after the task ends',
  '请先在输入框中描述任务': 'Describe the task in the input box first',
  '任务已停止': 'Task stopped',
  '已继续': 'Resumed',
  '结果已复制': 'Result copied',
  '请先在「设置」配置至少一个 API Key': 'Configure at least one API Key in "Settings" first',
};
// 高频插值文案：正则提取变量 + 英文模板
const TOAST_PATTERNS = [
  [/^已切换到「(.+)」$/, (m) => `Switched to "${m[1]}"`],
  [/^已载入预设：(.+)$/, (m) => `Loaded preset: ${m[1]}`],
  [/^已套用模板：(.+)$/, (m) => `Applied template: ${m[1]}`],
  [/^已保存模板：(.+)$/, (m) => `Saved template: ${m[1]}`],
  [/^团队「(.+)」已保存$/, (m) => `Team "${m[1]}" saved`],
  [/^「(.+)」场景配置已保存$/, (m) => `"${m[1]}" scene config saved`],
  [/^已重置「(.+)」场景的模型配置$/, (m) => `Reset model config for "${m[1]}" scene`],
  [/^已建项目「(.+)」$/, (m) => `Created project "${m[1]}"`],
  [/^已创建并切换到「(.+)」$/, (m) => `Created and switched to "${m[1]}"`],
  [/^已删除：(.+)$/, (m) => `Deleted: ${m[1]}`],
  [/^已学到 (\d+) 条关于你的新事实（设置面板可查看）$/, (m) => `Learned ${m[1]} new fact(s) about you (view in Settings)`],
  [/^已达介入上限（(\d+) 次）$/, (m) => `Intervention limit reached (${m[1]})`],
];

/** F+19.1：按当前 locale 翻译 toast 文案（en 时查表+正则，zh 时原样） */
function translateToast(msg) {
  if (typeof MAT_I18N !== 'object' || MAT_I18N.getLocale() !== 'en') return msg;
  if (TOAST_EN[msg]) return TOAST_EN[msg];
  for (const [re, fn] of TOAST_PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg;  // 未覆盖的保持原文（不阻塞功能）
}

function toast(msg, level = 'info', timeoutMs = 3000) {
  const t = document.createElement('div');
  t.className = 'toast ' + (level === 'error' ? 'err' : level === 'warn' ? 'warn' : level === 'ok' ? 'ok' : '');
  t.textContent = translateToast(msg);  // F+19.1
  $('toastContainer').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, timeoutMs);
}

function showModal({ title, bodyHtml, buttons }) {
  return new Promise(resolve => {
    $('modalHeader').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    $('modalFooter').innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = b.primary ? 'primary-btn' : 'ghost-btn';
      btn.textContent = b.label;
      btn.onclick = () => {
        const val = typeof b.value === 'function' ? b.value() : b.value;
        $('modalMask').classList.add('hidden');
        resolve(val);
      };
      $('modalFooter').appendChild(btn);
    });
    $('modalMask').classList.remove('hidden');
  });
}
function closeModal() { $('modalMask').classList.add('hidden'); }

/* ====================== 8. 设置抽屉 ====================== */

function openDrawer() {
  $('openaiKey').value = state.config.openaiKey;
  $('anthropicKey').value = state.config.anthropicKey;
  $('qwenKey').value = state.config.qwenKey;
  $('deepseekKey').value = state.config.deepseekKey;
  if ($('tavilyKey')) {
    $('tavilyKey').value = state.config.tavilyKey || '';
    $('toolsEnabledGlobal').checked = !!state.config.toolsEnabledGlobal;
  }
  $('doubaoKey').value = state.config.doubaoKey;
  $('geminiKey').value = state.config.geminiKey;
  // F+17.13：动态渲染 default model 下拉（用 buildModelOptgroups，跟 Agent 卡片下拉一致体验）
  refreshDefaultModelSelect();
  $('rememberConfig').checked = state.config.remember;
  validateKey('openai');
  validateKey('anthropic');
  validateKey('qwen');
  validateKey('deepseek');
  validateKey('doubao');
  validateKey('gemini');
  updateDefaultModelHint();
  $('drawerMask').classList.remove('hidden');
  $('drawer').classList.remove('hidden');
}
function closeDrawer() {
  $('drawerMask').classList.add('hidden');
  $('drawer').classList.add('hidden');
}
/**
 * F+17.13：重新渲染 #defaultModel 下拉为 buildModelOptgroups 内容
 * 让设置面板下拉跟 Agent 卡片下拉一致体验（自定义/管理/智能感知）
 */

/**
 * 在内置场景默认模型下拉下方显示"将使用哪把 Key"的实时提示，
 * 让模型↔Key 的对应关系一目了然。
 */
function updateDefaultModelHint() {
  const hint = $('defaultModelHint');
  if (!hint) return;
  const model = $('defaultModel').value;
  const vendor = (MODEL_PRICING[model] || {}).vendor;
  const vendorMeta = {
    openai:    { name: 'OpenAI',     key: $('openaiKey').value.trim() },
    anthropic: { name: 'Anthropic',  key: $('anthropicKey').value.trim() },
    qwen:      { name: '通义千问',    key: $('qwenKey').value.trim() },
    deepseek:  { name: 'DeepSeek',   key: $('deepseekKey').value.trim() },
    doubao:    { name: '豆包',        key: $('doubaoKey').value.trim() },
    gemini:    { name: 'Gemini',     key: $('geminiKey').value.trim() },
  }[vendor];
  if (!vendorMeta) { hint.textContent = ''; return; }
  if (vendorMeta.key) {
    hint.innerHTML = `<span style="color:var(--success)">✓</span> 将使用 <strong>${vendorMeta.name} Key</strong>（${maskKey(vendorMeta.key)}）`;
  } else {
    hint.innerHTML = `<span style="color:var(--warn)">⚠</span> 未配置 <strong>${vendorMeta.name} Key</strong> → 内置场景将走模拟模式`;
  }
}

function validateKey(vendor) {
  const inputId = { openai: 'openaiKey', anthropic: 'anthropicKey', qwen: 'qwenKey', deepseek: 'deepseekKey', doubao: 'doubaoKey', gemini: 'geminiKey' }[vendor];
  const badgeId = { openai: 'openaiBadge', anthropic: 'anthropicBadge', qwen: 'qwenBadge', deepseek: 'deepseekBadge', doubao: 'doubaoBadge', gemini: 'geminiBadge' }[vendor];
  // Qwen / DeepSeek / OpenAI 都以 sk- 开头；Anthropic 是 sk-ant-；Gemini 是 AIza；豆包无固定前缀（长度校验即可）
  const prefix = { openai: /^sk-/, anthropic: /^sk-ant-/, qwen: /^sk-/, deepseek: /^sk-/, doubao: /.{20,}/, gemini: /^AIza/ }[vendor];
  const v = $(inputId).value.trim();
  const badge = $(badgeId);
  if (!v) { badge.textContent = ''; badge.className = 'input-badge'; return false; }
  if (prefix.test(v) && v.length >= 20) {
    badge.textContent = '格式 OK'; badge.className = 'input-badge ok'; return true;
  }
  badge.textContent = '格式异常'; badge.className = 'input-badge bad'; return false;
}

/* ====================== 9. LLM 适配层 ====================== */
// F+13 Sprint 1: callLLM + 6 vendor caller + ApiError → ./src/llm/llm.js
// 仍在 app.js：callSimulated（依赖 AGENTS / SIM_TEMPLATES，下次拆）

/* ====================== 10. 模拟模式：预脚本 Agent 回复 ====================== */

// F+13 Sprint 1: SIM_TEMPLATES + callSimulated + extractTopic → ./src/llm/simulated.js

/* ====================== 11. Token 追踪 ====================== */

class TokenTracker {
  constructor(scene) {
    this.totalInput = 0; this.totalOutput = 0;
    this.byAgent = {};
    this.scene = scene;
    this.cap = COST_CAP_USD[scene] ?? COST_CAP_USD.default;
    this.budget = TOTAL_TOKEN_BUDGET[scene] ?? TOTAL_TOKEN_BUDGET.default;
  }
  record(agentKey, inputTokens, outputTokens, toolCalls = 0) {
    this.totalInput += inputTokens;
    this.totalOutput += outputTokens;
    if (!this.byAgent[agentKey]) this.byAgent[agentKey] = { in: 0, out: 0, toolCalls: 0 };
    this.byAgent[agentKey].in += inputTokens;
    this.byAgent[agentKey].out += outputTokens;
    this.byAgent[agentKey].toolCalls += toolCalls;
  }
  cost() { return calcCost(this.totalInput, this.totalOutput, state.config.model); }
  totalTokens() { return this.totalInput + this.totalOutput; }
  costRatio() { return this.cost() / this.cap; }
  hitCap() { return this.cost() >= this.cap; }
  hitBudget() { return this.totalTokens() >= this.budget; }
}

function updateCostPanel(tracker) {
  $('costInputTokens').textContent = tracker.totalInput.toLocaleString();
  $('costOutputTokens').textContent = tracker.totalOutput.toLocaleString();
  $('costUsd').textContent = fmtUsd(tracker.cost());
  const pct = Math.min(100, tracker.costRatio() * 100);
  $('costBar').style.width = pct + '%';
  $('costCap').textContent = `熔断线 ${fmtUsdShort(tracker.cap)} · 已用 ${pct.toFixed(0)}%`;

  const bd = $('agentBreakdown');
  bd.innerHTML = '';
  Object.entries(tracker.byAgent).forEach(([k, v]) => {
    // 自定义 Agent：从 tracker 上保存的 _name 取（自定义场景写入）；
    // 内置 Agent：从 AGENTS 字典取
    const name = v._name || AGENTS[k]?.name;
    if (!name) return;
    const row = document.createElement('div');
    row.className = 'agent-breakdown-row';
    const toolBadge = v.toolCalls > 0 ? ` · 🔧×${v.toolCalls}` : '';
    row.innerHTML = `<span class="a-name">${escapeHtml(name)}</span><span>${(v.in + v.out).toLocaleString()} tk${toolBadge}</span>`;
    bd.appendChild(row);
  });
}

/* ====================== 12. 任务前预估对话框（设计档案 14.2） ====================== */

function estimateCost(sceneId) {
  if (sceneId === 'custom') {
    // 自定义团队：每 Agent 用各自模型估算累加（更精确）
    const team = state.customTeam;
    const mode = team.mode || 'sequential';
    let inputTotal = 0, outputTotal = 0, cost = 0;
    const baseIn = 1200, perOut = 700;

    // 各模式的"实际发言总次数"不同
    let turns;
    if (mode === 'pipeline') {
      // 每 Agent 只发言 1 次，链条不循环
      turns = team.agents.map((a, i) => ({ agent: a, prevSize: i === 0 ? 0 : perOut }));
      turns.forEach(t => {
        const ai = baseIn + t.prevSize;
        const ao = perOut;
        inputTotal += ai; outputTotal += ao;
        cost += calcCost(ai, ao, t.agent.model);
      });
      return { input: Math.round(inputTotal), output: Math.round(outputTotal), cost,
        rounds: 1, agents: team.agents.length };
    }
    if (mode === 'reflection') {
      // 创作 → 评 → 创作 → 评 → … 共 rounds 轮，最后一轮不评
      const creator = team.agents.find(a => a.role === 'creator') || team.agents[0];
      const critic = team.agents.find(a => a.role === 'critic') || team.agents[1];
      for (let r = 0; r < team.rounds; r++) {
        // 创作
        const ai = baseIn + (r === 0 ? 0 : perOut * 2);
        inputTotal += ai; outputTotal += perOut;
        cost += calcCost(ai, perOut, creator.model);
        if (r < team.rounds - 1 && critic) {
          // 评价
          const cai = baseIn + perOut;
          inputTotal += cai; outputTotal += perOut;
          cost += calcCost(cai, perOut, critic.model);
        }
      }
      return { input: Math.round(inputTotal), output: Math.round(outputTotal), cost,
        rounds: team.rounds, agents: team.agents.length };
    }
    if (mode === 'hub-spoke') {
      // 中心提问 + N 专家答 + 中心整合，可能 rounds 个循环
      const hub = team.agents.find(a => a.role === 'hub') || team.agents[0];
      const spokes = team.agents.filter(a => a !== hub);
      const totalRounds = team.rounds || 1;
      for (let r = 0; r < totalRounds; r++) {
        // hub 提问
        const ai = baseIn;
        inputTotal += ai; outputTotal += perOut;
        cost += calcCost(ai, perOut, hub.model);
        // 每个 spoke 答
        spokes.forEach(s => {
          const sai = baseIn + perOut;
          inputTotal += sai; outputTotal += perOut;
          cost += calcCost(sai, perOut, s.model);
        });
      }
      // 最后 hub 整合
      const finalAi = baseIn + spokes.length * perOut;
      inputTotal += finalAi; outputTotal += perOut;
      cost += calcCost(finalAi, perOut, hub.model);
      return { input: Math.round(inputTotal), output: Math.round(outputTotal), cost,
        rounds: totalRounds, agents: team.agents.length };
    }
    // sequential / multi-phase：原 N 轮循环算法
    for (let r = 0; r < team.rounds; r++) {
      for (const a of team.agents) {
        const ai = baseIn + r * baseIn * 0.4;
        const ao = perOut;
        inputTotal += ai;
        outputTotal += ao;
        cost += calcCost(ai, ao, a.model);
      }
    }
    return {
      input: Math.round(inputTotal), output: Math.round(outputTotal),
      cost, rounds: team.rounds, agents: team.agents.length,
    };
  }
  const p = SCENE_PRESETS[sceneId];
  // 按场景的发言顺序逐 Agent 估算，每个用其解析后的模型 → 支持 per-Agent 模型混合
  const flow = SCENE_FLOWS[sceneId];
  let inputTotal = 0, outputTotal = 0, cost = 0;
  if (flow?.mode === 'pipeline') {
    // 每位 1 次，前一位输出作为输入
    const keys = [...new Set(flow.agents)];
    keys.forEach((ak, i) => {
      const m = resolveAgentModel(sceneId, ak) || state.config.model;
      const ti = p.baseIn + (i === 0 ? 0 : p.perOut);
      inputTotal += ti; outputTotal += p.perOut;
      cost += calcCost(ti, p.perOut, m);
    });
  } else if (flow?.mode === 'reflection') {
    // creator → critic → creator → critic ... 共 rounds 轮，末轮不评
    const cM = resolveAgentModel(sceneId, flow.creator) || state.config.model;
    const xM = resolveAgentModel(sceneId, flow.critic)  || state.config.model;
    for (let r = 0; r < (flow.rounds || 3); r++) {
      const ti = p.baseIn + (r === 0 ? 0 : p.perOut * 2);
      inputTotal += ti; outputTotal += p.perOut;
      cost += calcCost(ti, p.perOut, cM);
      if (r < (flow.rounds - 1)) {
        const cti = p.baseIn + p.perOut;
        inputTotal += cti; outputTotal += p.perOut;
        cost += calcCost(cti, p.perOut, xM);
      }
    }
  } else if (flow?.agents) {
    // sequential
    for (let i = 0; i < flow.agents.length; i++) {
      const ak = flow.agents[i];
      const m = resolveAgentModel(sceneId, ak) || state.config.model;
      const ti = p.baseIn + i * p.baseIn * 0.4;
      inputTotal += ti; outputTotal += p.perOut;
      cost += calcCost(ti, p.perOut, m);
    }
  } else {
    // 决策场景：用全局默认模型粗估
    inputTotal = p.baseIn + p.rounds * p.baseIn * 0.4;
    outputTotal = p.rounds * p.perOut;
    cost = calcCost(inputTotal, outputTotal, state.config.model);
  }
  return {
    input: Math.round(inputTotal),
    output: Math.round(outputTotal),
    cost,
    rounds: p.rounds,
    agents: p.agents,
  };
}

/**
 * 成本预估弹层里的"记忆消耗"块：项目上下文 / 用户画像 / 引用任务等
 * 同时提供"引用过往任务"下拉。
 */
function buildMemoryPreviewBlock(userText) {
  const baseMem = buildMemoryInjection({ agentKey: null });
  const rows = baseMem.breakdown.map(b => `<div class="mem-row"><span>${escapeHtml(b.name)}</span><span class="v">+${b.tokens} tk</span></div>`).join('');

  // #6 自动关联推荐
  const related = findRelatedHistory(userText, state.activeProjectId, 3);
  const relatedHtml = related.length ? `
    <div class="cost-summary" style="margin-top:8px;background:rgba(74,222,128,0.06);border-color:rgba(74,222,128,0.3)">
      <div style="font-size:12px;color:var(--success);margin-bottom:6px;font-weight:600">✨ 自动找到 ${related.length} 条相关任务</div>
      ${related.map(h => `<label class="mem-related-row"><input type="checkbox" data-related-id="${h.id}"/> <span>${escapeHtml(h.sceneIcon + ' ' + h.userText.slice(0, 40))}</span><span style="color:var(--text-dim);font-size:11px">${fmtRelativeTime(h.ts)}</span></label>`).join('')}
      <div style="font-size:11px;color:var(--text-dim);margin-top:4px">勾选则将其结果摘要注入。可在设置里关闭自动关联。</div>
    </div>
  ` : '';

  // 引用过往任务下拉（手动选）
  const recent = [...state.history].sort((a, b) => b.ts - a.ts).slice(0, 10);
  const recentOpts = recent.map(h =>
    `<option value="${h.id}">${escapeHtml(h.sceneIcon + ' ' + h.userText.slice(0, 30))} · ${fmtRelativeTime(h.ts)}</option>`
  ).join('');

  // 项目选择器（#5）
  const projectOpts = state.projects.map(p =>
    `<option value="${p.id}" ${p.id === state.activeProjectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

  return `
    <div class="cost-summary memory-summary">
      <div class="mem-title">💭 记忆消耗（按每位 Agent 注入）</div>
      ${rows || '<div class="mem-row" style="color:var(--text-dim)">无（未配置项目上下文 / 用户画像 / 知识库等）</div>'}
      ${baseMem.totalTokens ? `<div class="mem-row mem-total"><span>合计</span><span class="v">+${baseMem.totalTokens} tk</span></div>` : ''}
    </div>
    ${relatedHtml}
    <div class="cost-summary" style="margin-top:8px">
      <label style="font-size:12.5px;color:var(--text-muted);display:block;margin-bottom:6px">🔗 可选：手动引用过往任务</label>
      <select id="includeTaskSelect" style="width:100%">
        <option value="">— 不引用过往任务 —</option>
        ${recentOpts}
      </select>
      <label style="font-size:12.5px;color:var(--text-muted);display:block;margin:8px 0 6px">📁 归入项目</label>
      <select id="includeProjectSelect" style="width:100%">
        <option value="">— 无项目 —</option>
        ${projectOpts}
      </select>
      <div style="margin-top:8px;display:flex;gap:6px">
        <input type="text" id="newProjectInput" placeholder="新建项目名" style="flex:1" maxlength="20"/>
        <button class="ghost-btn" id="newProjectBtn" style="padding:6px 10px">+ 建</button>
      </div>
      <label class="field-check" style="margin-top:10px"><input type="checkbox" id="doNotRememberChk"/><span style="font-size:12.5px;color:var(--text-muted)">⚠ 不记忆此任务（不进历史 / 不学画像）</span></label>
    </div>
  `;
}

async function showCostPreview(sceneId, userText) {
  const est = estimateCost(sceneId);
  let scene, agentList, model, modelHas;

  if (sceneId === 'custom') {
    scene = { icon: '🛠️', name: '自定义团队' };
    agentList = state.customTeam.agents.map(a => `${a.name}（${a.model}）`).join(' + ');
    // 多模型混用时，"是否真实模式" 看至少一个 Agent 的模型有对应 Key
    modelHas = state.customTeam.agents.some(a => modelHasKey(a.model));
    model = '混合（每 Agent 独立）';
  } else {
    scene = SCENE_RULES.find(s => s.id === sceneId);
    const customized = sceneIsCustomized(sceneId);
    if (customized) {
      const cfg = state.sceneConfigs[sceneId];
      const uniqueAgents = [...new Set(SCENE_AGENT_LIST[sceneId])];
      agentList = uniqueAgents.map(k => {
        const m = cfg[k] || state.config.model;
        return `${AGENTS[k].name.replace(' Agent', '')}（${m}）`;
      }).join(' + ');
      model = '混合（场景级覆盖）';
    } else {
      const fl = SCENE_FLOWS[sceneId];
      if (sceneId === 'decision') agentList = '3 信息 Agent + 协调 Agent';
      else if (sceneId === 'dossier') agentList = '3 搜证 Agent + 档案整理员';
      else if (fl.mode === 'pipeline') agentList = [...new Set(fl.agents)].map(k => AGENTS[k].name.replace(' Agent', '')).join(' → ');
      else if (fl.mode === 'reflection') agentList = `${AGENTS[fl.creator].name.replace(' Agent', '')}（创作）⇄ ${AGENTS[fl.critic].name.replace(' Agent', '')}（评）`;
      else agentList = fl.agents.slice(0, 2).map(k => AGENTS[k].name.replace(' Agent', '')).join(' + ');
      model = state.config.model;
    }
    // modelHas：customized 时，只要任一被使用模型有 Key 即视为真实模式
    if (customized) {
      const cfg = state.sceneConfigs[sceneId];
      const usedModels = SCENE_AGENT_LIST[sceneId].map(k => cfg[k] || state.config.model);
      modelHas = usedModels.some(m => modelHasKey(m));
    } else {
      const m = state.config.model;
      modelHas = modelHasKey(m);
    }
  }

  const html = `
    <p>场景：<strong>${scene.icon} ${scene.name}</strong> · Agent：${agentList}</p>
    <p>预估轮次：<strong>${est.rounds}</strong> 轮</p>
    <div class="cost-summary">
      <div class="row"><span>预估输入 Token</span><span class="v">${est.input.toLocaleString()}</span></div>
      <div class="row"><span>预估输出 Token</span><span class="v">${est.output.toLocaleString()}</span></div>
      <div class="row"><span>预估费用（${model}）</span><span class="v">${fmtUsd(est.cost)}</span></div>
      <div class="row"><span>单任务熔断线</span><span class="v">${fmtUsdShort(COST_CAP_USD[sceneId] ?? COST_CAP_USD.default)}</span></div>
    </div>
    <p style="font-size:12px;color:var(--text-muted)">⚡ 实际费用可能因对话长度浮动 ±30%</p>
    ${modelHas ? '' : '<p style="font-size:12px;color:var(--warn)">⚠️ 当前未配置该模型的 API Key，将进入<strong>模拟模式</strong>（无真实 API 调用、无真实费用）</p>'}
    ${(() => {
      // 收集本次任务会用到的所有模型，检查是否有"贵"档
      const usedModels = sceneId === 'custom'
        ? state.customTeam.agents.map(a => a.model)
        : (SCENE_AGENT_LIST[sceneId]?.length
            ? SCENE_AGENT_LIST[sceneId].map(k => resolveAgentModel(sceneId, k) || state.config.model)
            : [state.config.model]);
      const expensive = [...new Set(usedModels.filter(isExpensiveModel))];
      if (!expensive.length) return '';
      return `<p style="font-size:12px;color:var(--warn);background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);padding:8px 10px;border-radius:6px;margin-top:8px">
        ★ <strong>贵模型警告</strong>：本次任务将使用 ${expensive.map(m => '<code>' + escapeHtml(m) + '</code>').join(' / ')}（≥ $10/M output token）。
        单任务费用可能 $0.5+。建议先用便宜模型（gpt-4o-mini / qwen3-turbo / gemini-2.5-flash-lite）试跑，调通后再换旗舰。
      </p>`;
    })()}
    ${buildMemoryPreviewBlock(userText)}
  `;
  // 在弹层渲染后挂事件代理：处理"+ 新建项目"
  setTimeout(() => {
    const btn = document.getElementById('newProjectBtn');
    if (btn) btn.onclick = () => {
      const nm = document.getElementById('newProjectInput').value.trim();
      if (!nm) return;
      const p = createProject(nm);
      if (p) {
        const sel = document.getElementById('includeProjectSelect');
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name; opt.selected = true;
        sel.appendChild(opt);
        document.getElementById('newProjectInput').value = '';
        toast(`已建项目「${p.name}」`, 'ok');
      }
    };
  }, 50);

  return showModal({
    title: '确认启动任务',
    bodyHtml: html,
    buttons: [
      { label: '取消', value: null },
      { label: '换个场景', value: 'change' },
      { label: '启动', primary: true, value: () => {
        // 手动单选引用任务
        const sel = document.getElementById('includeTaskSelect');
        state._pendingIncludedTaskId = sel && sel.value ? sel.value : null;
        // 自动关联推荐 checkbox（可能有多条，目前只用第一条避免 token 爆炸）
        const checkedRelated = [...document.querySelectorAll('[data-related-id]:checked')].map(c => c.dataset.relatedId);
        if (checkedRelated.length && !state._pendingIncludedTaskId) {
          state._pendingIncludedTaskId = checkedRelated[0];
        }
        // 项目
        const proj = document.getElementById('includeProjectSelect');
        state._pendingProjectId = proj && proj.value ? proj.value : null;
        // 不记忆 opt-out
        const dnr = document.getElementById('doNotRememberChk');
        state._pendingDoNotRemember = !!(dnr && dnr.checked);
        return 'go';
      } },
    ]
  });
}

/* ====================== 13. 场景路由确认 UI（设计档案 15.3） ====================== */

async function confirmRoute(routeResult) {
  if (routeResult.state === 'unique') return routeResult.primary.id;
  if (routeResult.state === 'conflict') {
    const opts = routeResult.matches.map((m, i) => `
      <label class="opt">
        <input type="radio" name="scene" value="${m.id}" ${i === 0 ? 'checked' : ''} />
        <div>
          <div class="opt-title">${m.icon} ${m.name}模式</div>
          <div class="opt-sub">命中关键词：${m.hits.join('、')} · 置信度 ${(m.confidence*100).toFixed(0)}%</div>
        </div>
      </label>
    `).join('');
    const result = await showModal({
      title: '🔀 选择协作模式',
      bodyHtml: `<p>你的需求同时匹配多个场景，请选择：</p><div class="opts">${opts}</div>`,
      buttons: [
        { label: '重新描述需求', value: null },
        { label: '确认', primary: true,
          value: () => document.querySelector('input[name="scene"]:checked')?.value }
      ]
    });
    return result;
  }
  if (routeResult.state === 'low') {
    const m = routeResult.primary;
    const yes = await showModal({
      title: '确认场景',
      bodyHtml: `<p>你的需求看起来像是：</p>
        <p><strong>${m.icon} ${m.name}场景</strong>（匹配度 ${(m.confidence*100).toFixed(0)}%）</p>
        <p style="color:var(--text-muted);font-size:12.5px">命中关键词：${m.hits.join('、')}</p>
        <p>是这个吗？</p>`,
      buttons: [
        { label: '不对，让我选', value: null },
        { label: '对，开始', primary: true, value: m.id },
      ]
    });
    return yes;
  }
  // unmatched
  const opts = SCENE_RULES.map(s => `
    <label class="opt">
      <input type="radio" name="scene" value="${s.id}" />
      <div>
        <div class="opt-title">${s.icon} ${s.name}</div>
        <div class="opt-sub">${s.keywords.slice(0, 4).join('、')}…</div>
      </div>
    </label>
  `).join('');
  const result = await showModal({
    title: '🤔 场景未匹配',
    bodyHtml: `<p>没有找到完全匹配的场景，你可以手动选择：</p><div class="opts">${opts}</div>`,
    buttons: [
      { label: '重新输入', value: null },
      { label: '确认', primary: true,
        value: () => document.querySelector('input[name="scene"]:checked')?.value },
    ]
  });
  return result;
}

/* ====================== 14. 任务运行 ====================== */

function showTaskView(sceneId) {
  $('welcome').classList.add('hidden');
  $('teamBuilder')?.classList.add('hidden');
  $('result').classList.add('hidden');
  $('task').classList.remove('hidden');
  $('intervention').classList.remove('hidden'); // viewDiscussionBtn 可能隐藏过它
  $('pauseBtn').textContent = '⏸ 暂停';
  const sceneMeta = sceneId === 'custom'
    ? { icon: '🛠️', name: '自定义团队' }
    : SCENE_RULES.find(s => s.id === sceneId);
  $('taskSceneIcon').textContent = sceneMeta.icon;
  $('taskSceneName').textContent = sceneMeta.name + (sceneId === 'custom' ? '' : '场景');
  $('discussion').innerHTML = '';
  $('progressText').textContent = '准备中…';
  $('interventionCount').textContent = '0';
  $('interventionText').value = '';
  $('phaseCard').style.display = (sceneId === 'decision' || sceneId === 'dossier') ? '' : 'none';
  setTaskStatus('运行中', '');
}
function showResultView(task) {
  $('task').classList.add('hidden');
  $('welcome').classList.add('hidden');
  $('result').classList.remove('hidden');
}
function showWelcomeView() {
  $('welcome').classList.remove('hidden');
  $('intro')?.classList.add('hidden');
  $('task').classList.add('hidden');
  $('result').classList.add('hidden');
  $('teamBuilder')?.classList.add('hidden');
  // 清空所有 chip 高亮，避免视觉残留误导
  setSelectedChip(null);
}

function showIntroView() {
  $('welcome').classList.add('hidden');
  $('intro').classList.remove('hidden');
  $('task').classList.add('hidden');
  $('result').classList.add('hidden');
  $('teamBuilder')?.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // 记下用户已看过介绍，下次不再自动弹
  try { localStorage.setItem('myAgentTeam.introSeen', '1'); } catch {}
}

/* ====================== 内置场景 per-Agent 模型配置 ====================== */

/** 在首页给已自定义过模型的场景 chip 加 ✨ 标记 */
function refreshSceneCustomizedBadges() {
  document.querySelectorAll('.scene-chip[data-scene]').forEach(el => {
    const id = el.dataset.scene;
    if (id === 'custom') return;
    el.classList.toggle('is-customized', sceneIsCustomized(id));
  });
}

/**
 * 给场景 chip 加视觉反馈。
 * @param {string|null} sceneId — null 清空所有高亮
 * @param {'firm'|'hint'} mode  — 'firm' = 用户直接点击；'hint' = 输入路由推测出来的
 */
function setSelectedChip(sceneId, mode = 'firm') {
  document.querySelectorAll('.scene-chip[data-scene]').forEach(el => {
    el.classList.remove('selected', 'selected-hint');
  });
  if (!sceneId) return;
  const el = document.querySelector(`.scene-chip[data-scene="${sceneId}"]`);
  if (el) el.classList.add(mode === 'hint' ? 'selected-hint' : 'selected');
}

/** 构造模型下拉的内嵌 HTML（场景配置面板复用）
 *  F+17 智能感知（升级 F+17.1 支持自定义/历史 model）：
 *   - 没配 Key 的厂商 optgroup 加 🔑 标 + disabled 灰掉（保留发现性，引导去配 Key）
 *   - 上次调用失败的 model 加 ⚠ 标 + title tooltip 显示失败时间和原因
 *   - 30 天前的失败记录自动清理（说不定 model 已恢复 / 配额已重置）
 *   - F+17.1：每个 vendor optgroup 末尾加 "✏️ 自定义..." 触发 prompt 填任意 model ID
 *   - F+17.1：用户填过的自定义 model ID + 当前 selectedModel 若不在 hardcode 列表 → 顶部加 "📝 自定义 / 历史" optgroup
 *
 * 配套：onchange handler 应检测 value 是否以 `__add_custom__:` 开头，
 *       是则调用 handleAddCustomModel(selectEl, vendor) 弹 prompt。
 */

/* ====================== Agent 头像上传（团队成员图像） ====================== */

const AVATAR_MAX_BYTES = 350 * 1024;   // F+17.7: 单文件上限 350KB（之前 100KB 太紧，普通微信表情包/手机拍照都过不了）

/**
 * 触发 Agent 头像上传。dest 描述存到哪里：
 *   - { kind: 'custom', idx }    → state.customTeam.agents[idx].iconImage
 *   - { kind: 'builtin', key }   → state.config.agentIcons[key]
 */
function triggerAgentAvatarUpload(dest, onDone) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/*';
  picker.style.display = 'none';
  document.body.appendChild(picker);
  picker.onchange = (e) => {
    const file = e.target.files?.[0];
    document.body.removeChild(picker);
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast(`文件过大（${(file.size / 1024).toFixed(0)} KB > ${AVATAR_MAX_BYTES / 1024} KB 上限）`, 'warn');
      return;
    }
    if (!/^image\//.test(file.type)) { toast('请选择图片文件', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      if (dest.kind === 'custom') {
        state.customTeam.agents[dest.idx].iconImage = base64;
        saveCustomTeam();
      } else if (dest.kind === 'builtin') {
        state.config.agentIcons[dest.key] = base64;
        saveConfig();
      }
      toast('头像已设置', 'ok');
      onDone?.();
    };
    reader.onerror = () => toast('读取失败', 'error');
    reader.readAsDataURL(file);
  };
  picker.click();
}

function clearAgentAvatar(dest, onDone) {
  if (dest.kind === 'custom') {
    delete state.customTeam.agents[dest.idx].iconImage;
    saveCustomTeam();
  } else if (dest.kind === 'builtin') {
    delete state.config.agentIcons[dest.key];
    saveConfig();
  }
  toast('头像已清除', 'ok');
  onDone?.();
}

/**
 * 解析 Agent 头像（图片优先，回退到文字 icon）
 * 自定义 Agent：用 agent.iconImage（保存在团队配置里）
 * 内置 Agent：用 state.config.agentIcons[agentKey]（全局，随设置走）
 */
function resolveAgentAvatar(agent, agentKey) {
  const img = agent?.iconImage || (agentKey && state.config.agentIcons?.[agentKey]);
  if (img) return { type: 'img', src: img };
  return { type: 'text', char: agent?.icon || '?' };
}
function renderAvatarInner(agent, agentKey) {
  const av = resolveAgentAvatar(agent, agentKey);
  return av.type === 'img'
    ? `<img class="avatar-img" src="${av.src}" alt="" draggable="false"/>`
    : escapeHtml(av.char);
}

/* ====================== 导出 Markdown ====================== */

function exportTaskAsMarkdown() {
  const task = state.task;
  if (!task) { toast('没有可导出的任务', 'warn'); return; }
  const tracker = task.tracker;
  const sceneMeta = task.sceneId === 'custom'
    ? { icon: '🛠️', name: '自定义团队' }
    : SCENE_RULES.find(s => s.id === task.sceneId) || { icon: '·', name: task.sceneId };
  const mode = task.sceneId === 'custom'
    ? (state.customTeam.mode || 'sequential')
    : (SCENE_FLOWS[task.sceneId]?.mode || 'sequential');
  const dur = ((Date.now() - task.startAt) / 1000).toFixed(1);
  const dt = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // 拼装 Markdown
  let md = `# ${sceneMeta.icon} ${sceneMeta.name} — 任务记录\n\n`;
  md += `**生成时间**：${new Date().toLocaleString()}\n`;
  md += `**编排模式**：${modeLabel(mode, 'short')}\n`;
  md += `**耗时**：${dur} 秒\n`;
  if (tracker) {
    md += `**Token 消耗**：${tracker.totalTokens().toLocaleString()}（输入 ${tracker.totalInput.toLocaleString()} · 输出 ${tracker.totalOutput.toLocaleString()}）\n`;
    md += `**费用**：${fmtUsd(tracker.cost())}\n`;
  }
  md += `\n---\n\n## 📝 用户原始任务\n\n> ${task.userText}\n\n`;

  // Agent 拆解
  if (tracker?.byAgent) {
    md += `## 👥 Agent 拆解\n\n`;
    Object.entries(tracker.byAgent).forEach(([k, v]) => {
      const name = v._name || AGENTS[k]?.name || k;
      md += `- **${name}**：${(v.in + v.out).toLocaleString()} tk（输入 ${v.in.toLocaleString()} · 输出 ${v.out.toLocaleString()}）\n`;
    });
    md += `\n`;
  }

  // 讨论过程
  if (task.history && task.history.length) {
    md += `---\n\n## 💬 讨论过程\n\n`;
    task.history.forEach(m => {
      const role = m.role === 'user' ? '🧑 你（介入）' : '🤖';
      md += `### ${role}\n\n${m.content}\n\n`;
    });
  } else if (task.decisionResult) {
    const r = task.decisionResult;
    md += `---\n\n## 💬 讨论过程\n\n`;
    md += `### 阶段一 · 独立取证\n\n`;
    (r.phase1Results || []).forEach(p => {
      md += `**${AGENTS[p.agentKey]?.name || p.agentKey}**：\n\n${p.text}\n\n`;
    });
    if (r.phase2Result?.length) {
      md += `### 阶段二 · 交叉质证\n\n`;
      r.phase2Result.slice(1).forEach(m => { md += `${m.content}\n\n`; });
    }
  }

  // 最终结果
  const resultMd = $('resultContent').innerText || '（无结果）';
  md += `---\n\n## ✅ 最终结果\n\n${resultMd}\n`;

  // 触发下载
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MyAgentTeam_${sceneMeta.name}_${dt}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Markdown 已开始下载', 'ok');
}

/**
 * F+18：导出历史任务为 Markdown（结构跟 exportTaskAsMarkdown 一致，但从 history 记录构造）
 * @param {object} h - state.history 里的一条记录
 */

function openSceneConfig(sceneId) {
  const scene = SCENE_RULES.find(s => s.id === sceneId);
  const flow = SCENE_FLOWS[sceneId];
  const agentKeys = SCENE_AGENT_LIST[sceneId] || [];
  const cfg = state.sceneConfigs[sceneId] || {};

  // 该场景的"实际发言节奏"描述
  let cadence;
  if (flow.mode === 'pipeline')    cadence = `${agentKeys.length} 工序线性 1 遍`;
  else if (flow.mode === 'reflection') cadence = `${flow.rounds || 3} 轮迭代（创作 ⇄ 评）`;
  else if (flow.mode === 'multi-phase') cadence = `Phase 1/2/3 多阶段`;
  else cadence = `${flow.rounds || 4} 轮顺序`;

  const renderBody = () => {
    const rows = agentKeys.map(k => {
      const agent = AGENTS[k];
      const current = cfg[k] || '';
      const promptOverride = state.scenePrompts[sceneId]?.[k] || '';
      const promptCustomized = !!promptOverride;
      const colorMeta = AGENT_COLOR_PALETTE.find(p => p.cls === agent.cls) || AGENT_COLOR_PALETTE[0];
      return `
        <div class="scene-cfg-row">
          <div class="agent-info">
            <div class="agent-avatar avatar-clickable" style="background:${colorMeta.color}" title="点击上传头像" data-builtin-agent-key="${k}">
              ${renderAvatarInner(agent, k)}
              <span class="avatar-upload-hint">📷</span>
            </div>
            <div class="agent-meta">
              <div class="agent-name">${escapeHtml(agent.name)}${promptCustomized ? ' <span class="prompt-badge">✏️ 身份已改</span>' : ''}</div>
              <div class="agent-desc">${escapeHtml(agent.system.split('\n')[0].slice(0, 60))}…</div>
            </div>
          </div>
          <select data-agent="${k}">
            <option value="">默认（${state.config.model}）</option>
            ${buildModelOptgroups(current)}
          </select>
        </div>
        <details class="scene-cfg-prompt" ${promptCustomized ? 'open' : ''}>
          <summary>✏️ 修改 Agent 身份描述（System Prompt）</summary>
          <textarea data-prompt-agent="${k}" placeholder="留空 = 用默认身份；填入则覆盖。&#10;&#10;默认身份：&#10;${escapeHtml(agent.system)}">${escapeHtml(promptOverride)}</textarea>
          <div class="scene-cfg-prompt-meta">
            <span class="prompt-char-counter" data-prompt-counter="${k}">${promptOverride.length} 字</span>
            ${promptCustomized ? `<button class="ghost-btn small reset-prompt-btn" data-reset-prompt="${k}">恢复默认</button>` : ''}
          </div>
        </details>
      `;
    }).join('');
    return `
      <div class="scene-cfg-summary">
        <span class="preset-mode-pill">${escapeHtml(modeLabel(flow.mode, 'short'))}</span>
        <span class="scene-cfg-meta">${escapeHtml(cadence)} · ${agentKeys.length} 个 Agent</span>
      </div>
      <p style="margin:10px 0 8px">为「<strong>${scene.icon} ${scene.name}场景</strong>」的每个 Agent 独立选择模型。<br/>
        留「默认」= 用全局默认模型；选具体模型 = 覆盖（跨厂商混合）</p>
      <div class="scene-cfg-list">${rows}</div>
    `;
  };

  showModal({
    title: `配置「${scene.icon} ${scene.name}」场景 · ${modeLabel(flow.mode, 'short')}`,
    bodyHtml: renderBody(),
    buttons: [
      { label: '重置该场景', value: 'reset' },
      { label: '取消（丢弃改动）', value: null },
      { label: '✅ 保存', primary: true, value: () => 'save' },
    ]
  }).then(result => {
    if (result === 'reset') {
      delete state.sceneConfigs[sceneId];
      saveSceneConfigs();
      refreshSceneCustomizedBadges();
      toast(`已重置「${scene.name}」场景的模型配置`, 'ok');
    } else if (result === 'save') {
      // 保存模型覆盖
      const newCfg = {};
      document.querySelectorAll('#modalBody select[data-agent]').forEach(sel => {
        if (sel.value) newCfg[sel.dataset.agent] = sel.value;
      });
      if (Object.keys(newCfg).length === 0) delete state.sceneConfigs[sceneId];
      else state.sceneConfigs[sceneId] = newCfg;
      saveSceneConfigs();
      // 保存 system prompt 覆盖
      const newPrompts = {};
      document.querySelectorAll('#modalBody textarea[data-prompt-agent]').forEach(ta => {
        const v = ta.value.trim();
        if (v) newPrompts[ta.dataset.promptAgent] = v;
      });
      if (Object.keys(newPrompts).length === 0) delete state.scenePrompts[sceneId];
      else state.scenePrompts[sceneId] = newPrompts;
      saveScenePrompts();
      refreshSceneCustomizedBadges();
      toast(`「${scene.name}」场景配置已保存`, 'ok');
    }
  });
  // F+17.1 / F+17.2：modal body 内每个 model select 绑 onchange，处理 2 个特殊 option
  setTimeout(() => {
    document.querySelectorAll('#modalBody select[data-agent]').forEach(sel => {
      sel.dataset.prevValue = sel.value || '';
      sel.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val.startsWith('__add_custom__:')) {
          const vendor = val.split(':')[1];
          handleAddCustomModel(e.target, vendor);
          return;
        }
        // F+17.3：统一管理 model 下拉
        if (val === '__manage_all_models__') {
          e.target.value = e.target.dataset.prevValue || '';
          openManageAllModelsModal(() => {
            const currentVal = e.target.value;
            e.target.innerHTML = `<option value="">默认（${state.config.model}）</option>` + buildModelOptgroups(currentVal);
            const stillExists = Array.from(e.target.options).some(o => o.value === currentVal);
            if (!stillExists && currentVal) {
              e.target.value = '';
              toast(`场景某 Agent 模型被删，已 fallback 到全局默认`, 'warn', 3500);
            }
            e.target.dataset.prevValue = e.target.value;
          });
          return;
        }
        e.target.dataset.prevValue = val;
      });
    });
  }, 0);

  // 头像点击 = 上传 / 右键 = 清除（事件代理在 modalBody 上）
  $('modalBody').onclick = (e) => {
    const reset = e.target.closest('.reset-prompt-btn');
    if (reset) {
      const k = reset.dataset.resetPrompt;
      const ta = document.querySelector(`textarea[data-prompt-agent="${k}"]`);
      if (ta) { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    const av = e.target.closest('.agent-avatar.avatar-clickable');
    if (!av) return;
    const key = av.dataset.builtinAgentKey;
    triggerAgentAvatarUpload({ kind: 'builtin', key }, () => {
      $('modalBody').innerHTML = renderBody();
    });
  };
  // 字符计数实时
  $('modalBody').oninput = (e) => {
    const ta = e.target.closest('textarea[data-prompt-agent]');
    if (!ta) return;
    const counter = document.querySelector(`[data-prompt-counter="${ta.dataset.promptAgent}"]`);
    if (counter) {
      const n = ta.value.length;
      counter.textContent = n + ' 字';
      counter.style.color = n > 1000 ? 'var(--warn)' : 'var(--text-dim)';
    }
  };
  $('modalBody').oncontextmenu = (e) => {
    const av = e.target.closest('.agent-avatar.avatar-clickable');
    if (!av) return;
    e.preventDefault();
    const key = av.dataset.builtinAgentKey;
    if (!state.config.agentIcons?.[key]) return;
    clearAgentAvatar({ kind: 'builtin', key }, () => {
      $('modalBody').innerHTML = renderBody();
    });
  };
}

/* ====================== 自定义团队构建器 UI ====================== */

function showTeamBuilder() {
  $('welcome').classList.add('hidden');
  $('task').classList.add('hidden');
  $('result').classList.add('hidden');
  $('teamBuilder').classList.remove('hidden');
  $('teamMode').value = state.customTeam.mode || 'sequential';
  $('teamRounds').value = state.customTeam.rounds;
  refreshTeamModeUI();
  renderTeamAgentList();
  renderTeamLibraryDropdown();
  // 如果有当前关联的团队，回填名字
  const cur = state.currentTeamId ? state.teamLibrary.find(t => t.id === state.currentTeamId) : null;
  $('teamNameInput').value = cur ? cur.name : '';
}

/**
 * 切换编排模式后，更新轮次/阶段提示的显示与禁用状态。
 * 多阶段模式下：rounds 不再可调（固定为 1 + 2 + 1 = 4 等阶段决定），但保留字段值以备切换回顺序模式时复用。
 */
function refreshTeamModeUI() {
  const mode = state.customTeam.mode || 'sequential';
  const hint = $('teamPhaseHint');
  hint.style.display = '';

  if (mode === 'sequential') {
    $('teamRoundsRow').style.display = '';
    hint.innerHTML = `<strong>顺序模式：</strong>N 个 Agent 按列表顺序循环发言，共 ${state.customTeam.rounds} 轮。每个 Agent 看到完整对话历史。`;
  }
  else if (mode === 'pipeline') {
    $('teamRoundsRow').style.display = 'none';
    const ok = state.customTeam.agents.length >= 2;
    hint.innerHTML = `<strong>Pipeline 流水线：</strong>${state.customTeam.agents.length} 个 Agent 按列表顺序<strong>各发言 1 次</strong>，每个 Agent 看到「原始任务 + 上一位的输出」。不循环。
      ${ok ? '<div style="color:var(--success);margin-top:4px">✓ 配置有效</div>' : '<div style="color:var(--warn);margin-top:4px">⚠ 至少需要 2 个 Agent</div>'}`;
  }
  else if (mode === 'reflection') {
    $('teamRoundsRow').style.display = '';
    const creator = state.customTeam.agents.filter(a => a.role === 'creator').length;
    const critic = state.customTeam.agents.filter(a => a.role === 'critic').length;
    const ok = state.customTeam.agents.length === 2 && creator === 1 && critic === 1;
    hint.innerHTML = `<strong>Reflection 反思：</strong>2 个 Agent — 创作者（${creator}）+ 评论者（${critic}）。共 ${state.customTeam.rounds} 轮：创作 → 评价 → 创作 → 评价 → ... 最终结果 = 最后一次创作产出。
      ${ok ? '<div style="color:var(--success);margin-top:4px">✓ 配置有效</div>' : '<div style="color:var(--warn);margin-top:4px">⚠ 需要恰好 2 个 Agent：1 个 creator + 1 个 critic</div>'}`;
  }
  else if (mode === 'hub-spoke') {
    $('teamRoundsRow').style.display = '';
    const hubs = state.customTeam.agents.filter(a => a.role === 'hub').length;
    const spokes = state.customTeam.agents.filter(a => a.role === 'spoke' || (!a.role && a !== state.customTeam.agents.find(x => x.role === 'hub'))).length;
    const ok = hubs === 1 && spokes >= 1;
    hint.innerHTML = `<strong>Hub-Spoke 中心辐射：</strong>1 个中心（${hubs}）+ ${spokes} 个专家。${state.customTeam.rounds} 个咨询循环：中心提问 → 各专家依次回答 → 中心整合。
      ${ok ? '<div style="color:var(--success);margin-top:4px">✓ 配置有效</div>' : '<div style="color:var(--warn);margin-top:4px">⚠ 需要 1 个 hub + 至少 1 个 spoke</div>'}`;
  }
  else if (mode === 'multi-phase') {
    $('teamRoundsRow').style.display = 'none';
    const counts = { 1: 0, 2: 0, 3: 0 };
    state.customTeam.agents.forEach(a => { counts[a.phase || 1]++; });
    let warn = '';
    if (counts[1] < 1) warn += ' ⚠ Phase 1 需要至少 1 个 Agent。';
    if (counts[3] !== 1) warn += ` ⚠ Phase 3 必须恰好 1 个 Agent（当前 ${counts[3]}）。`;
    hint.innerHTML = `<strong>多阶段规则：</strong>
      Phase 1（独立取证，并行）= <strong>${counts[1]}</strong> ·
      Phase 2（交叉质证，2 轮群聊）= <strong>${counts[2]}</strong> ·
      Phase 3（独立裁决）= <strong>${counts[3]}</strong>
      ${warn ? `<div style="color:var(--warn);margin-top:4px">${warn}</div>` : '<div style="color:var(--success);margin-top:4px">✓ 配置有效</div>'}`;
  }
}

function renderTeamLibraryDropdown() {
  const sel = $('teamLibrarySelect');
  if (!sel) return;
  if (state.teamLibrary.length === 0) {
    sel.innerHTML = '<option value="">— 还没保存团队，先取个名字点"💾 保存"，或试试 📚 预设 —</option>';
    return;
  }
  sel.innerHTML = '<option value="">— 未保存 / 新建中 —</option>';
  state.teamLibrary
    .slice()
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      // 完整元信息：「名字｜模式 · 轮次/工序 · Agent 数」
      const tm = t.team || {};
      opt.textContent = `${t.name}｜${modeLabel(tm.mode, 'short')} · ${turnsLabel(tm)} · ${tm.agents?.length || 0} Agent`;
      if (t.id === state.currentTeamId) opt.selected = true;
      sel.appendChild(opt);
    });
}

function renderTeamAgentList() {
  const list = $('teamAgentList');
  list.innerHTML = '';
  state.customTeam.agents.forEach((agent, idx) => {
    list.appendChild(buildAgentCard(agent, idx));
  });
}

function buildAgentCard(agent, idx) {
  const card = document.createElement('div');
  card.className = 'team-agent-card';

  // 构造模型 optgroup HTML（与 #defaultModel 同步：6 厂商 16 模型，复用 buildModelOptgroups）
  const modelOptsHtml = buildModelOptgroups(agent.model);

  // 颜色 palette
  const colorDots = AGENT_COLOR_PALETTE.map(p =>
    `<div class="color-dot ${p.cls === agent.cls ? 'active' : ''}" style="background:${p.color}" data-cls="${p.cls}" title="${p.label}"></div>`
  ).join('');

  // 当前 Agent 的头像颜色
  const colorMeta = AGENT_COLOR_PALETTE.find(p => p.cls === agent.cls) || AGENT_COLOR_PALETTE[0];

  const mode = state.customTeam.mode || 'sequential';
  const inMultiPhase = mode === 'multi-phase';
  const inReflection = mode === 'reflection';
  const inHubSpoke = mode === 'hub-spoke';
  const inPipeline = mode === 'pipeline';

  let modeBadge = '';
  let modeSelectorHtml = '';

  if (inMultiPhase) {
    modeBadge = `<span class="phase-badge phase-${agent.phase || 1}">P${agent.phase || 1}</span>`;
    modeSelectorHtml = `
      <div class="field">
        <label>所属阶段</label>
        <select data-field="phase">
          <option value="1" ${agent.phase === 1 ? 'selected' : ''}>Phase 1 · 独立取证（并行）</option>
          <option value="2" ${agent.phase === 2 ? 'selected' : ''}>Phase 2 · 交叉质证（群聊）</option>
          <option value="3" ${agent.phase === 3 ? 'selected' : ''}>Phase 3 · 独立裁决</option>
        </select>
      </div>`;
  } else if (inReflection) {
    const role = agent.role || (idx === 0 ? 'creator' : 'critic');
    modeBadge = `<span class="phase-badge phase-${role === 'creator' ? '1' : '2'}">${role === 'creator' ? '创作' : '评论'}</span>`;
    modeSelectorHtml = `
      <div class="field">
        <label>角色</label>
        <select data-field="role">
          <option value="creator" ${role === 'creator' ? 'selected' : ''}>创作者（产出内容）</option>
          <option value="critic"  ${role === 'critic'  ? 'selected' : ''}>评论者（点评 + 反馈）</option>
        </select>
      </div>`;
  } else if (inHubSpoke) {
    const role = agent.role || (idx === 0 ? 'hub' : 'spoke');
    modeBadge = `<span class="phase-badge phase-${role === 'hub' ? '3' : '1'}">${role === 'hub' ? '中心' : '专家'}</span>`;
    modeSelectorHtml = `
      <div class="field">
        <label>角色</label>
        <select data-field="role">
          <option value="hub"   ${role === 'hub'   ? 'selected' : ''}>中心（提问 + 整合）</option>
          <option value="spoke" ${role === 'spoke' ? 'selected' : ''}>专家辐条（回答中心问题）</option>
        </select>
      </div>`;
  } else if (inPipeline) {
    modeBadge = `<span class="phase-badge phase-1">工序 ${idx + 1}</span>`;
  }

  card.innerHTML = `
    <div class="team-agent-card-head">
      <div class="team-agent-avatar avatar-clickable" style="background:${colorMeta.color}" title="点击上传头像" data-agent-idx="${idx}">
        ${renderAvatarInner(agent, null)}
        <span class="avatar-upload-hint">📷</span>
      </div>
      ${modeBadge}
      <input class="team-agent-name" type="text" value="${escapeHtml(agent.name)}" maxlength="20" data-field="name" />
      ${state.customTeam.agents.length > 1
        ? `<button class="team-agent-remove" data-action="remove">删除</button>`
        : ''}
    </div>

    <div class="team-agent-grid">
      <div class="field">
        <label>厂商 + 模型</label>
        <select data-field="model">${modelOptsHtml}</select>
      </div>
      <div class="field">
        <label>颜色标识</label>
        <div class="team-color-picker">${colorDots}</div>
      </div>
      ${modeSelectorHtml}
    </div>

    <div class="team-agent-system-row">
      <label>身份描述（System Prompt）</label>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
          <input type="checkbox" data-field="toolsEnabled" ${agent.toolsEnabled ? 'checked' : ''}/>
          🛠 启用工具
        </label>
        <button class="template-picker" data-action="template">📋 套用模板…</button>
      </div>
    </div>
    <textarea data-field="system" rows="4" placeholder="描述这个 Agent 的角色定位、专长、输出要求…">${escapeHtml(agent.system)}</textarea>
    <div class="agent-system-meta">
      <span class="agent-system-counter" data-counter-idx="${idx}">${(agent.system || '').length} 字</span>
      <span class="agent-system-hint">建议 ≤ 1000 字。过长会撑大每轮 Token 消耗</span>
    </div>
  `;

  // 事件绑定
  card.querySelector('[data-field="name"]').oninput = (e) => {
    agent.name = e.target.value;
  };
  // F+17.1 / F+17.2：处理"✏️ 自定义..." + "🗑 管理列表..."两个特殊 option
  const modelSel = card.querySelector('[data-field="model"]');
  modelSel.dataset.prevValue = agent.model || '';
  modelSel.onchange = (e) => {
    const val = e.target.value;
    if (val.startsWith('__add_custom__:')) {
      const vendor = val.split(':')[1];
      handleAddCustomModel(e.target, vendor, (newId) => { agent.model = newId; });
      return;
    }
    // F+17.3：统一管理 model 下拉（自定义删除 + hardcode 隐藏/恢复）
    if (val === '__manage_all_models__') {
      // 回滚 select 到上一个真实值（避免 select 停在 manage option）
      e.target.value = e.target.dataset.prevValue || agent.model || '';
      openManageAllModelsModal(() => {
        // 列表变化后重渲染 select（移除/恢复 optgroup）
        e.target.innerHTML = buildModelOptgroups(agent.model);
        // 如果 agent.model 刚好是被删的 → fallback 全局默认
        const stillExists = Array.from(e.target.options).some(o => o.value === agent.model);
        if (!stillExists) {
          agent.model = state.config.model;
          e.target.value = agent.model;
          toast(`该 Agent 模型被删，已 fallback 到默认：${state.config.model}`, 'warn', 4000);
        }
        e.target.dataset.prevValue = e.target.value;
      });
      return;
    }
    e.target.dataset.prevValue = val;
    agent.model = val;
  };
  card.querySelector('[data-field="phase"]')?.addEventListener('change', (e) => {
    agent.phase = Number(e.target.value);
    refreshTeamModeUI();
  });
  card.querySelector('[data-field="role"]')?.addEventListener('change', (e) => {
    agent.role = e.target.value;
    refreshTeamModeUI();
    renderTeamAgentList();  // 重渲染以更新 badge
  });
  const toolsCheckbox = card.querySelector('[data-field="toolsEnabled"]');
  if (toolsCheckbox) toolsCheckbox.onchange = (e) => { agent.toolsEnabled = e.target.checked; };
  card.querySelector('[data-field="system"]').oninput = (e) => {
    agent.system = e.target.value;
    const counter = card.querySelector(`[data-counter-idx="${idx}"]`);
    if (counter) {
      const n = e.target.value.length;
      counter.textContent = n + ' 字';
      counter.style.color = n > 1000 ? 'var(--warn)' : 'var(--text-dim)';
    }
  };
  card.querySelectorAll('.color-dot').forEach(dot => {
    dot.onclick = () => {
      agent.cls = dot.dataset.cls;
      const meta = AGENT_COLOR_PALETTE.find(p => p.cls === agent.cls);
      card.querySelector('.team-agent-avatar').style.background = meta.color;
      card.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    };
  });
  card.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
    state.customTeam.agents.splice(idx, 1);
    renderTeamAgentList();
  });
  card.querySelector('[data-action="template"]').onclick = () => showTemplatePicker(idx);

  // 头像点击 = 上传 / 右键 = 清除（有图时）
  const avatarEl = card.querySelector('.team-agent-avatar');
  avatarEl.onclick = () => triggerAgentAvatarUpload({ kind: 'custom', idx }, () => renderTeamAgentList());
  avatarEl.oncontextmenu = (e) => {
    e.preventDefault();
    if (!agent.iconImage) return;
    clearAgentAvatar({ kind: 'custom', idx }, () => renderTeamAgentList());
  };

  return card;
}

function showTemplatePicker(agentIdx) {
  const currentAgent = state.customTeam.agents[agentIdx];

  const renderBody = () => {
    const builtin = AGENT_IDENTITY_TEMPLATES.map((t, i) => ({
      kind: 'builtin', idx: i, name: t.name, system: t.system,
    }));
    const custom = state.tplLibrary.map(t => ({
      kind: 'custom', id: t.id, name: t.name, system: t.system,
    }));
    const renderItem = (item) => {
      const previewLine = item.system.split('\n').find(l => l.trim()) || '';
      return `
        <div class="tpl-item" data-kind="${item.kind}" data-key="${item.kind === 'builtin' ? item.idx : item.id}">
          <span class="tpl-item-name">${escapeHtml(item.name)}</span>
          <span class="tpl-item-preview">${escapeHtml(previewLine)}</span>
          <span class="tpl-item-badge">${item.kind === 'builtin' ? '内置' : '我的'}</span>
          ${item.kind === 'custom' ? `<button class="tpl-item-delete" data-del-id="${item.id}">×</button>` : ''}
        </div>`;
    };
    return `
      <p style="margin-bottom:8px">点击下方任一模板套用到当前 Agent。</p>
      <input type="text" class="tpl-search" placeholder="搜索模板名…" />
      <div class="tpl-section">
        <div class="tpl-section-title">📦 内置模板（${builtin.length}）</div>
        <div class="tpl-list">${builtin.map(renderItem).join('')}</div>
      </div>
      <div class="tpl-section">
        <div class="tpl-section-title">⭐ 我的模板（${custom.length}）</div>
        <div class="tpl-list">${custom.length ? custom.map(renderItem).join('') : '<div style="color:var(--text-dim);font-size:12px;padding:8px">还没有自建模板。可以下方"保存当前为模板"加进来。</div>'}</div>
      </div>
      <div class="tpl-save-row">
        <input type="text" id="tplNewName" placeholder="把当前 Agent 的身份描述保存为新模板..." maxlength="20" />
        <button class="ghost-btn" id="tplSaveBtn">💾 保存为模板</button>
      </div>
    `;
  };

  showModal({
    title: '选择 / 管理身份模板',
    bodyHtml: renderBody(),
    buttons: [{ label: '关闭', value: null }]
  });

  // 直接通过事件代理把交互绑到 modalBody（modal 的 footer 只剩"关闭"）
  const body = $('modalBody');
  body.onclick = (e) => {
    const delBtn = e.target.closest('.tpl-item-delete');
    if (delBtn) {
      e.stopPropagation();
      deleteTpl(delBtn.dataset.delId);
      body.innerHTML = renderBody();
      toast('已删除模板', 'ok');
      return;
    }
    const item = e.target.closest('.tpl-item');
    if (item) {
      const kind = item.dataset.kind;
      const key = item.dataset.key;
      let tpl;
      if (kind === 'builtin') tpl = AGENT_IDENTITY_TEMPLATES[Number(key)];
      else tpl = state.tplLibrary.find(t => t.id === key);
      if (!tpl) return;
      state.customTeam.agents[agentIdx].name = tpl.name;
      state.customTeam.agents[agentIdx].system = tpl.system;
      renderTeamAgentList();
      closeModal();
      toast(`已套用模板：${tpl.name}`, 'ok');
      return;
    }
    if (e.target.id === 'tplSaveBtn') {
      const name = $('tplNewName').value.trim();
      if (saveTpl(name, currentAgent.system)) {
        body.innerHTML = renderBody();
        toast(`已保存模板：${name}`, 'ok');
      }
    }
  };
  // 模板搜索过滤
  body.oninput = (e) => {
    if (!e.target.classList.contains('tpl-search')) return;
    const q = e.target.value.trim().toLowerCase();
    body.querySelectorAll('.tpl-item').forEach(item => {
      const t = item.textContent.toLowerCase();
      item.style.display = !q || t.includes(q) ? '' : 'none';
    });
  };
}

function showPresetPicker() {
  const cards = PRESET_TEAMS.map(p => {
    const pills = p.agents.map(a => {
      const colorMeta = AGENT_COLOR_PALETTE.find(c => c.cls === a.cls) || AGENT_COLOR_PALETTE[0];
      return `<span class="preset-agent-pill">
        <span class="dot" style="background:${colorMeta.color}">${escapeHtml(a.icon)}</span>
        ${escapeHtml(a.name)}<span class="pill-model">· ${escapeHtml(a.model)}</span>
      </span>`;
    }).join('');
    return `
      <div class="preset-card" data-preset-id="${p.id}">
        <div class="preset-card-head">
          <div class="preset-name">${escapeHtml(p.name)}</div>
          <span class="preset-mode-pill">${escapeHtml(modeLabel(p.mode, 'short'))}</span>
          <span class="preset-rounds">${escapeHtml(turnsLabel(p))} · ${p.agents.length} Agent</span>
        </div>
        <div class="preset-tagline">${escapeHtml(p.tagline)}</div>
        <div class="preset-usecase">适合：${escapeHtml(p.useCase)}</div>
        <div class="preset-agents">${pills}</div>
      </div>
    `;
  }).join('');
  showModal({
    title: '📚 多模型讨论范式预设',
    bodyHtml: `<p style="margin-bottom:10px;color:var(--text-muted);font-size:12.5px">
      点击任意一套载入到当前团队配置（会覆盖当前未保存的修改，请先保存）。载入后仍可继续调整 + 保存到团队库。</p>
      <div class="preset-list">${cards}</div>`,
    buttons: [{ label: '关闭', value: null }]
  });
  // 事件代理
  $('modalBody').onclick = (e) => {
    const card = e.target.closest('.preset-card');
    if (!card) return;
    const preset = PRESET_TEAMS.find(p => p.id === card.dataset.presetId);
    if (!preset) return;
    // 深拷贝避免后续编辑污染原预设
    state.customTeam = {
      mode: preset.mode || 'sequential',
      rounds: preset.rounds,
      agents: preset.agents.map(a => ({ ...a })),
    };
    $('teamMode').value = state.customTeam.mode;
    refreshTeamModeUI();
    state.currentTeamId = null;
    saveCustomTeam();
    renderTeamAgentList();
    renderTeamLibraryDropdown();
    $('teamRounds').value = state.customTeam.rounds;
    $('teamNameInput').value = preset.name;
    closeModal();
    toast(`已载入预设：${preset.name}`, 'ok');
  };
}

function addCustomAgent() {
  if (state.customTeam.agents.length >= 4) {
    toast('最多 4 个 Agent', 'warn'); return;
  }
  const idx = state.customTeam.agents.length;
  const colorMeta = AGENT_COLOR_PALETTE[idx % AGENT_COLOR_PALETTE.length];
  const icons = ['①', '②', '③', '④'];
  state.customTeam.agents.push({
    key: 'c' + (idx + 1) + '_' + Date.now().toString(36).slice(-3),  // 避免删后重建 key 冲突
    name: '我的 Agent ' + (idx + 1),
    icon: icons[idx] || '?',
    cls: colorMeta.cls,
    model: state.config.model || 'gpt-4o-mini',
    phase: 1,  // 多阶段模式下默认 Phase 1，顺序模式忽略
    system: '你是一个 ' + (idx + 1) + ' 号 Agent，请描述你的角色和任务…',
  });
  renderTeamAgentList();
  refreshTeamModeUI();
}

async function launchCustomTeam() {
  // 校验
  const team = state.customTeam;
  if (team.agents.length === 0) { toast('至少需要 1 个 Agent', 'warn'); return; }
  if (team.agents.some(a => !a.system.trim())) {
    toast('每个 Agent 都需要填写身份描述', 'warn'); return;
  }
  // 各模式校验
  const mode = team.mode || 'sequential';
  if (mode === 'multi-phase') {
    const counts = { 1: 0, 2: 0, 3: 0 };
    team.agents.forEach(a => { counts[a.phase || 1]++; });
    if (counts[1] < 1) { toast('Phase 1 至少需要 1 个 Agent', 'warn'); return; }
    if (counts[3] !== 1) { toast(`Phase 3 必须恰好 1 个 Agent（当前 ${counts[3]}）`, 'warn'); return; }
  } else if (mode === 'pipeline') {
    if (team.agents.length < 2) { toast('Pipeline 模式至少需要 2 个 Agent', 'warn'); return; }
  } else if (mode === 'reflection') {
    const creator = team.agents.filter(a => a.role === 'creator').length;
    const critic = team.agents.filter(a => a.role === 'critic').length;
    if (team.agents.length !== 2 || creator !== 1 || critic !== 1) {
      toast('Reflection 模式需要恰好 2 个 Agent：1 个 creator + 1 个 critic', 'warn'); return;
    }
    team.rounds = Math.max(1, Math.min(6, Number($('teamRounds').value) || 3));
  } else if (mode === 'hub-spoke') {
    const hubs = team.agents.filter(a => a.role === 'hub').length;
    const spokes = team.agents.filter(a => a.role === 'spoke').length;
    if (hubs !== 1 || spokes < 1) {
      toast('Hub-Spoke 模式需要恰好 1 个 hub + 至少 1 个 spoke', 'warn'); return;
    }
    team.rounds = Math.max(1, Math.min(3, Number($('teamRounds').value) || 1));
  } else {
    team.rounds = Math.max(1, Math.min(10, Number($('teamRounds').value) || 4));
  }

  // 弹出"输入任务"对话框
  $('customPromptText').value = '';
  $('customPromptMask').classList.remove('hidden');
  $('customPromptText').focus();
}

function closeCustomPrompt() { $('customPromptMask').classList.add('hidden'); }

function confirmCustomPrompt() {
  const text = $('customPromptText').value.trim();
  if (!text) { toast('请输入任务描述', 'warn'); return; }
  if (text.length > MAX_USER_INPUT_LEN) { toast('超出长度限制', 'warn'); return; }
  closeCustomPrompt();
  saveCustomTeam();
  launchTask('custom', text);
}
// F+13 Sprint 1: UI render 函数 → ./src/ui/render.js（解构于 app.js 顶部）

/* ====================== 15. 任务调度核心 ====================== */
// F+13 Sprint 1: orchestrator 11 个函数（runAgent + 4 scene + launchTask + helper）→ ./src/scenes/orchestrator.js

function setInterventionVisibility(sceneId, phase) {
  // 决策 / 起底场景：Phase1/Phase3 禁止介入（独立取证 + 独立汇总不能被干扰）
  const root = $('intervention');
  const hint = $('interventionHint');
  if ((sceneId === 'decision' || sceneId === 'dossier') && (phase === 'phase1' || phase === 'phase3')) {
    root.querySelector('.intervention-input').classList.add('disabled');
    hint.textContent = sceneId === 'dossier'
      ? '⛔ 起底场景该阶段不支持介入（保持档案客观性）'
      : '⛔ 决策场景该阶段不支持介入';
    hint.className = 'intervention-hint warn';
  } else {
    root.querySelector('.intervention-input').classList.remove('disabled');
    hint.textContent = '';
    hint.className = 'intervention-hint';
  }
}

function handleApiError(e) {
  // F+14 Phase 3：et(key, fallback) —— 优先用 i18n 字典；字典缺失或 i18n 未加载时 fallback 到原中文
  // 保持完全向后兼容（i18n 不在时行为不变）
  const et = (k, f) => (typeof MAT_I18N === 'object') ? MAT_I18N.t(k, f) : f;
  // 友好翻译表：根据 HTTP 状态 + 关键字推断"用户能做什么"
  const bodyLower = (e.body || '').toLowerCase();
  let msg = '';
  let action = '';
  if (e.status === 401) {
    msg = et('error.401.title', '❌ API Key 无效或已过期');
    action = et('error.401.action', '到右上角"设置"更新对应厂商的 Key。');
  } else if (e.status === 403) {
    msg = et('error.403.title', '❌ Key 权限不足，可能没开通对应模型');
    action = et('error.403.action', '检查厂商控制台里该模型是否已订阅 / 开通。');
  } else if (e.status === 404) {
    msg = et('error.404.title', '❌ 模型不存在（404）');
    if (e.failedModel && /^(doubao|Doubao|ep-)/.test(e.failedModel)) {
      action = et('error.404.action.doubao', '豆包模型 404 通常因为你账号没开通该模型 → 到 Volcengine ARK 控制台「在线推理 → 创建推理接入点」拿 ep-xxxxxxxx，然后在自定义团队 model 字段直接填该 endpoint ID（系统已自动支持 ep- 前缀识别）。');
    } else {
      action = et('error.404.action.generic', '可能是模型 ID 已下线 / 已重命名，换一个稳定模型（推荐 gpt-4o-mini）。');
    }
  } else if (e.status === 429) {
    if (/quota|credit|balance/i.test(bodyLower)) {
      msg = et('error.429.title.quota', '❌ 账户余额或配额耗尽');
      action = et('error.429.action.quota', '到该厂商充值后重试。');
    } else {
      msg = et('error.429.title.busy', '⚠️ 服务繁忙或限流（429）');
      action = et('error.429.action.busy', '稍等几秒重试，或换一个不忙的模型。');
    }
  } else if (e.status === 413) {
    msg = et('error.413.title', '❌ 请求过大，超出模型上下文窗口');
    action = et('error.413.action', '减少介入次数 / 缩短任务描述 / 用长上下文模型（如 qwen-long）。');
  } else if (e.status === 503) {
    msg = et('error.503.title', '⚠️ 模型暂时过载（503）');
    action = et('error.503.action', '换一个模型，或稍等几分钟。');
  } else if (e.status === 502) {
    // F+17.8：502 实测含义≈model 下线，不是"临时不可用"
    msg = '⚠️ 模型路由失败（502）';
    const vendor502 = (e.failedModel && typeof getModelVendor === 'function') ? getModelVendor(e.failedModel) : null;
    if (vendor502 === 'doubao') {
      action = `豆包 ARK 经常下线旧版本 model（如 ${e.failedModel} 可能 2026-02 后已退役）。建议：① 任意 model 下拉里点末尾「✏️ 填自定义 豆包 model ID...」输入新版 ID（如 doubao-seed-1-6-pro-250615 或自建 ep-xxxxxxxx）② 该自定义 ID 会持久化进"📝 自定义 / 历史"区，下次直接选`;
    } else {
      action = '该 model 可能已被厂商下线 / 网关路由失败。换其他模型或厂商。';
    }
  } else if (e.status >= 500) {
    msg = et('error.5xx.title', '⚠️ LLM 服务暂时不可用') + '（' + e.status + '）';
    action = et('error.5xx.action', '稍后重试，或换一家厂商。');
  } else if (e.status === 400) {
    if (/cors|origin/i.test(bodyLower)) {
      msg = et('error.400.cors', '❌ 浏览器跨域被拒绝（CORS）');
      action = et('error.400.cors.action', '该厂商可能未开放浏览器直连，换其他厂商。');
    } else if (/inappropriate|datainspection|content.*(sensitive|filter|moderation|policy)|violation|审核|敏感|不当|违规/i.test(bodyLower)) {
      const vendor = (e.failedModel && (typeof getModelVendor === 'function')) ? getModelVendor(e.failedModel) : null;
      msg = et('error.400.moderation', '❌ 内容审核拦截（400）');
      if (vendor === 'qwen') {
        action = et('error.400.moderation.qwen', '阿里 DashScope 风控拦截 —— 决策/讨论"年轻人建议/社会议题/政策"等话题时常触发。Phase 2 累积上下文后更容易撞。**建议把该 Agent 模型换成**：`claude-haiku-4-5` / `gpt-4o-mini` / `deepseek-chat`（非国内审核厂商）。');
      } else if (vendor === 'doubao') {
        action = et('error.400.moderation.doubao', '火山方舟内容审核拦截。改用 Claude / GPT / Gemini 等非国产模型。');
      } else {
        action = et('error.400.moderation.generic', '该厂商的内容审核策略拦截。换非该厂商的模型重试。');
      }
    } else if (/context.*length|too.*long|max.*tokens|prompt.*too|exceeded.*context/i.test(bodyLower)) {
      msg = et('error.400.ctx', '❌ 上下文超长（400）');
      action = et('error.400.ctx.action', '该模型 ctx 不足。换长 ctx 模型（如 claude-sonnet-4-5 200K / gemini-2.5-pro 2M / qwen-long 10M），或减少 Phase 2 轮次。');
    } else {
      msg = et('error.400.generic', '❌ 请求被拒绝（400）');
      action = et('error.400.action.generic', '检查任务描述是否包含敏感内容；或换一个模型。');
    }
  } else if (!e.status) {
    const vendor = (e.failedModel && typeof getModelVendor === 'function') ? getModelVendor(e.failedModel) : null;
    if (vendor === 'doubao') {
      msg = et('error.doubao.proxy.title', '❌ 豆包代理请求失败');
      action = et('error.doubao.proxy.action', '可能原因：① 部署版本太旧（未含 F+14.1 /api/proxy/ark Edge Function，重新 deploy 即可）；② Vercel Edge Function 临时不可用；③ 你的 ARK Key 失效。F12 看 Network 看 /api/proxy/ark 响应码定位。');
    } else if (/cors|access.control|origin/i.test(e.body || e.message || '')) {
      msg = et('error.net.cors.title', '❌ 跨域被阻（CORS）');
      action = et('error.net.cors.action', '该厂商 API 不支持浏览器直连。换其他厂商，或自建后端代理。');
    } else {
      msg = et('error.net.title', '❌ 网络错误');
      action = et('error.net.action', '检查网络连接；翻墙环境下可能需要换节点；或浏览器扩展（广告屏蔽）可能拦截了请求。');
    }
  } else {
    msg = et('error.api.generic.prefix', '❌ API 错误：') + (e.message || e.body || et('error.unknown.value', '未知'));
    action = '';
  }

  // F+14.3: 通用 vendor error message 提取
  // OpenAI / ARK / DeepSeek / Qwen / Gemini 都用 {error: {message}} 或 {message} 结构
  // 之前 400/404 等模糊错误用户只能看 "请求被拒绝"，看不到真相 → F12 才能定位
  // 现在把服务器原话直接显示出来，例如：
  //   "Model doubao-xxx-260428 does not exist"   → 立刻知道是 model ID 问题
  //   "Content moderation failed: ..."           → 立刻知道是审核拦截
  //   "Tools parameter not supported by ..."     → 立刻知道是协议不兼容
  let serverMsg = '';
  try {
    const parsed = JSON.parse(e.body || '');
    serverMsg = (parsed?.error?.message || parsed?.error?.msg || parsed?.message || parsed?.msg || '').slice(0, 300);
  } catch { /* body 不是 JSON，跳过 */ }
  const serverTail = serverMsg
    ? `\n\n**${et('error.server.tag', '📋 服务器原话')}**："${serverMsg}"`
    : '';

  // F+ 上下文：附上失败的 Agent 名 + 模型，让用户立即定位
  let contextLine = '';
  let fixHint = '';
  if (e.agentName && e.failedModel) {
    contextLine = et('error.context.prefix', '\n\n📍 **失败位置**：Agent「')
                + e.agentName
                + et('error.context.middle', '」尝试调用模型 `')
                + e.failedModel
                + et('error.context.suffix', '`');
    if (e.isCustomAgent) {
      fixHint = et('error.fix.custom', '\n\n🔧 **立即修改**：返回首页 → 「🛠️ 自定义团队」chip → 找到该 Agent 卡片 → 改其模型');
    } else if (e.sceneId && e.sceneId !== 'custom') {
      const scene = SCENE_RULES.find(s => s.id === e.sceneId);
      const sceneLabel = scene ? `${scene.icon} ${scene.name}` : e.sceneId;
      fixHint = et('error.fix.scene.line1', '\n\n🔧 **立即修改 2 选 1**：')
              + et('error.fix.scene.option1.prefix', '\n  ① 返回首页 → 「')
              + sceneLabel
              + et('error.fix.scene.option1.suffix', '」chip 上的 ⚙ → 把 Agent「')
              + e.agentName
              + et('error.fix.scene.option1.suffix2', '」的模型换掉')
              + et('error.fix.scene.option2', '\n  ② 或顶栏 ⚙ 设置 → 「内置场景默认模型」整体换一个');
    } else {
      fixHint = et('error.fix.default', '\n\n🔧 **立即修改**：顶栏 ⚙ 设置 → 改默认模型');
    }
  }

  const fullMsg = msg + serverTail + contextLine + (action ? '\n\n👉 ' + action : '') + fixHint;
  renderSystemMsg(fullMsg);
  setTaskStatus('已停止', 'err');
  // F+18：任务出错 → 隐藏 runningBadge（任务实际已停）
  try { $('runningBadge').classList.add('hidden'); } catch {}

  // F+17 + 17.8：自动记录失败 model（让下拉给该 model 加 ⚠ 标 + tooltip）
  // 记录条件（F+17.8 扩展到 502）：
  //   - 400/401/403/404/0：明确指向 model 本身
  //   - 502：ARK 实测会返回 502（gateway 拒绝路由到已下线 model，如 doubao-seed-2-0-pro-260215）
  //   - 503：模型过载，有时反映长期容量不足而非临时
  // 仍不记录：429（限流，跟 model 无关）/ 5xx 其他（服务端波动）
  if (e.failedModel && [400, 401, 403, 404, 502, 503, 0].includes(e.status || 0)) {
    if (!state.modelFailures) state.modelFailures = {};
    state.modelFailures[e.failedModel] = {
      ts: Date.now(),
      status: e.status || 0,
      msg: (serverMsg || msg || '').slice(0, 200),
      vendor: (typeof getModelVendor === 'function') ? getModelVendor(e.failedModel) : null,
    };
    try { saveModelFailures(); } catch {}
  }

  // toast 简短版：含 Agent 名
  const toastMsg = e.agentName
    ? `${msg} · Agent「${e.agentName}」/ ${e.failedModel}`
    : msg;
  toast(toastMsg, 'error', 8000);
}

function finalizeTask(final) {
  setTaskStatus('已完成', 'done');
  // F+18：任务完成 → 隐藏 runningBadge
  try { $('runningBadge').classList.add('hidden'); } catch {}
  state.cumulative.totalCostUsd += final.tracker.cost();
  state.cumulative.totalTokens += final.tracker.totalTokens();
  state.cumulative.taskCount += 1;
  saveCumulative();

  // 追加到历史
  try { pushHistory(state.task, final); } catch (e) { console.warn('pushHistory failed', e); }
  // 清除"未完成任务"标记
  localStorage.removeItem(ACTIVE_TASK_KEY);
  // 后台学习用户画像（不阻塞 UI）
  autoLearnUserProfile(state.task, final).catch(() => {});
  // 后台更新 Per-Agent 记忆
  if (state.memory.settings.enableAgentMemory) {
    autoUpdateAgentMemories(state.task, final).catch(() => {});
  }

  // 渲染结果
  const html = buildFinalResult(state.task.sceneId, final);
  $('resultContent').innerHTML = sanitizeMarkdown(html);
  $('resultMeta').innerHTML = buildResultMeta(final);
  showResultView(state.task);
}

function buildFinalResult(sceneId, final) {
  // 决策 / 起底 + 多阶段自定义：用 verdict（起底的 verdict 即 archivist 9 段档案）
  if (sceneId === 'decision' || sceneId === 'dossier' || (sceneId === 'custom' && state.customTeam.mode === 'multi-phase')) {
    if (final.verdict) return final.verdict;
    const fallback = sceneId === 'dossier'
      ? '## 任务结果\n\n起底任务未完成档案汇总阶段，请查看讨论过程获取已收集的客观事实。'
      : '## 任务结果\n\n任务未完成裁决阶段，请查看讨论过程获取已收集的证据。';
    return fallback;
  }
  // Reflection / Hub-Spoke：有 finalOutput 时直接用
  if (sceneId === 'custom' && final.finalOutput) {
    return final.finalOutput;
  }
  // 其余：取最后一条 Agent 发言
  const last = [...(final.history || [])].reverse().find(h => h.role === 'assistant');
  if (!last) return '## 任务结果\n\n（未生成有效结果）';
  return last.content.replace(/^\[[^\]]+\]\s*/, '');
}

function buildResultMeta(final) {
  const t = final.tracker;
  const sceneMeta = state.task.sceneId === 'custom'
    ? { icon: '🛠️', name: '自定义团队' }
    : SCENE_RULES.find(s => s.id === state.task.sceneId);
  const dur = ((Date.now() - state.task.startAt) / 1000).toFixed(1);
  const modelLabel = state.task.sceneId === 'custom' ? '混合（每 Agent 独立）' : state.config.model;
  return `
    <h4>💰 本次消耗</h4>
    <div>总 Token：<strong>${t.totalTokens().toLocaleString()}</strong></div>
    <div>输入：${t.totalInput.toLocaleString()} · 输出：${t.totalOutput.toLocaleString()}</div>
    <div>费用：<strong>${fmtUsd(t.cost())}</strong>（${escapeHtml(modelLabel)}）</div>
    <hr/>
    <h4>👥 Agent 拆解</h4>
    ${Object.entries(t.byAgent).map(([k, v]) => {
      const name = v._name || AGENTS[k]?.name || k;
      return `<div>${escapeHtml(name)}：${(v.in + v.out).toLocaleString()} tk</div>`;
    }).join('')}
    <hr/>
    <h4>📊 累计（本浏览器）</h4>
    <div>总费用：<strong>${fmtUsd(state.cumulative.totalCostUsd)}</strong></div>
    <div>任务数：${state.cumulative.taskCount}</div>
    <hr/>
    <h4>⏱ 任务信息</h4>
    <div>场景：${sceneMeta.icon} ${sceneMeta.name}</div>
    <div>耗时：${dur}s</div>
    <div>模式：${anyKeyConfigured() ? '真实 API' : '模拟模式'}</div>
  `;
}

/* ====================== 20. 用户介入与暂停 ====================== */

function tryIntervention() {
  const text = $('interventionText').value.trim();
  if (!text) return;
  if (state.task.interventions >= MAX_INTERVENTIONS) {
    toast(`已达介入上限（${MAX_INTERVENTIONS} 次）`, 'warn'); return;
  }
  state.task.interventions += 1;
  $('interventionCount').textContent = String(state.task.interventions);
  renderUserMsg(text);
  // 将用户消息插入后续 Agent 的 history（运行时由 currentHistory 自动包含）
  if (state.task.history) {
    state.task.history.push({ role: 'user', content: `[用户介入] ${text}` });
  }
  $('interventionText').value = '';
  toast('已注入下一位 Agent 的上下文', 'ok', 2000);
}

function togglePause() {
  // F+14 Phase 3：i18n 接入 —— et(key, fallback) 保持向后兼容
  const et = (k, f) => (typeof MAT_I18N === 'object') ? MAT_I18N.t(k, f) : f;
  state.paused = !state.paused;
  $('pauseBtn').textContent = state.paused
    ? et('task.resume', '▶ 继续')
    : et('task.pause', '⏸ 暂停');
  setTaskStatus(
    state.paused ? et('status.paused', '已暂停') : et('status.running', '运行中'),
    state.paused ? 'warn' : ''
  );
  // F+15: 暂停是协作式的，不能中断进行中的 LLM streaming / tool call
  // 给用户期望管理：避免"按了暂停但还看到 Agent 在写"的困惑
  if (state.paused) {
    toast(et('toast.task.paused', '暂停将在当前 Agent 当前 token / 工具调用结束后生效（最多 5-30 秒）'), 'warn', 4500);
  } else {
    toast(et('toast.task.resumed', '已继续'), 'ok', 2000);
  }
}

/* ====================== 20.5 项目空间 UI（F+11 Level 3） ====================== */

function renderProjectSwitcher() {
  const nameSpan = $('projectSwitcherName');
  const menu = $('projectSwitcherMenu');
  if (!nameSpan || !menu) return;
  ensureDefaultProject();
  const activeId = getActiveProjectId();
  const active = state.projects.find(p => p.id === activeId);
  // F+11.1 顶栏按钮显示当前项目色块 + 名字
  nameSpan.innerHTML = `<span class="project-color-dot" style="background:${active?.color || '#6B7280'}"></span>${escapeHtml(active?.name || '默认')}`;
  menu.innerHTML = state.projects.map(p => `
    <div class="project-menu-item ${p.id === activeId ? 'active' : ''}" data-pid="${escapeHtml(p.id)}">
      <span class="project-color-dot" style="background:${p.color || '#6B7280'}"></span>${p.id === activeId ? '✓ ' : ''}${escapeHtml(p.name)}
    </div>
  `).join('') + `
    <div class="project-menu-divider"></div>
    <div class="project-menu-item" data-action="new">+ 新建项目</div>
    <div class="project-menu-item" data-action="manage">⚙ 管理项目</div>
  `;
}

function renderProjectManagement() {
  const c = $('projectListContainer');
  if (!c) return;
  ensureDefaultProject();
  const activeId = getActiveProjectId();
  c.innerHTML = state.projects.map(p => {
    const isActive = p.id === activeId;
    const isDefault = p.id === 'default';
    const memCount = state.memoryByProject?.[p.id]?.userProfile?.learnedFacts?.length || 0;
    const taskCount = (state.history || []).filter(h => (h.projectId || 'default') === p.id).length;
    return `
      <div class="project-list-row ${isActive ? 'active' : ''}" style="border-left:4px solid ${p.color || '#6B7280'}">
        <span class="name"><span class="project-color-dot" style="background:${p.color || '#6B7280'}"></span>${escapeHtml(p.name)}${isActive ? ' <span style="color:var(--accent);font-size:11px">(当前)</span>' : ''}</span>
        <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${taskCount} 任务 · ${memCount} 画像</span>
        <div class="actions">
          ${!isActive ? `<button data-action="switch" data-pid="${escapeHtml(p.id)}">切换</button>` : ''}
          ${!isDefault ? `<button data-action="rename" data-pid="${escapeHtml(p.id)}">改名</button>` : ''}
          ${!isDefault ? `<button data-action="delete" data-pid="${escapeHtml(p.id)}" style="color:var(--danger)">删除</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function reloadUIAfterProjectSwitch() {
  // 重新渲染依赖 active project 的 UI
  const pcInput = $('projectContextInput');
  if (pcInput) {
    pcInput.value = getProjectMemory().projectContext || '';
    const pcCounter = $('projectContextCounter');
    if (pcCounter) pcCounter.textContent = pcInput.value.length + ' / 500';
  }
  // 历史 / 画像列表等 —— 用 reload 兜底保证彻底刷新
  // 注：如果有进行中的任务则不 reload
  if (!state.task) {
    // 延迟 reload 让 toast 能显示
    setTimeout(() => location.reload(), 600);
  } else {
    toast('任务运行中，部分 UI 在任务结束后才会刷新', 'warn', 3000);
  }
}

function bindProjectUI() {
  const btn = $('projectSwitcherBtn');
  const menu = $('projectSwitcherMenu');
  if (btn && menu) {
    btn.onclick = (e) => {
      e.stopPropagation();
      const wasHidden = menu.classList.contains('hidden');
      menu.classList.toggle('hidden');
      if (wasHidden) renderProjectSwitcher();
    };
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
    });
    menu.onclick = (e) => {
      const item = e.target.closest('.project-menu-item');
      if (!item) return;
      const pid = item.dataset.pid;
      const action = item.dataset.action;
      if (action === 'new') {
        const name = prompt('新项目名称（如：技术决策 / 个人事务 / 工作）：');
        if (name?.trim()) {
          createProject(name.trim());
          renderProjectSwitcher();
          renderProjectManagement();
          toast(`已切换到「${name.trim()}」`, 'ok', 2000);
          reloadUIAfterProjectSwitch();
        }
      } else if (action === 'manage') {
        if (typeof openDrawer === 'function') openDrawer();
        setTimeout(() => $('projectSpaceField')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
      } else if (pid) {
        if (state.task) { toast('任务运行中，不能切换项目', 'warn', 2500); return; }
        switchProject(pid);
        renderProjectSwitcher();
        toast(`已切换到「${state.projects.find(p => p.id === pid)?.name}」`, 'ok', 1500);
        reloadUIAfterProjectSwitch();
      }
      menu.classList.add('hidden');
    };
  }
  const newBtn = $('newProjectBtn');
  if (newBtn) {
    newBtn.onclick = () => {
      const name = prompt('新项目名称：');
      if (name?.trim()) {
        createProject(name.trim());
        renderProjectSwitcher();
        renderProjectManagement();
        toast(`已创建并切换到「${name.trim()}」`, 'ok', 2000);
        reloadUIAfterProjectSwitch();
      }
    };
  }
  const listC = $('projectListContainer');
  if (listC) {
    listC.onclick = (e) => {
      const b = e.target.closest('button[data-action]');
      if (!b) return;
      const action = b.dataset.action;
      const pid = b.dataset.pid;
      if (action === 'switch') {
        if (state.task) { toast('任务运行中，不能切换项目', 'warn', 2500); return; }
        switchProject(pid);
        renderProjectSwitcher();
        renderProjectManagement();
        toast(`已切换`, 'ok', 1200);
        reloadUIAfterProjectSwitch();
      } else if (action === 'rename') {
        const p = state.projects.find(p => p.id === pid);
        const name = prompt('新名称：', p?.name);
        if (name?.trim()) {
          renameProject(pid, name.trim());
          renderProjectSwitcher();
          renderProjectManagement();
          toast('改名成功', 'ok', 1200);
        }
      } else if (action === 'delete') {
        const p = state.projects.find(p => p.id === pid);
        const taskCount = (state.history || []).filter(h => (h.projectId || 'default') === pid).length;
        const memCount = state.memoryByProject?.[pid]?.userProfile?.learnedFacts?.length || 0;
        if (confirm(`确认删除项目「${p?.name}」？\n· 该项目的项目上下文 / ${memCount} 条用户画像 / Agent 记忆会被清空\n· ${taskCount} 个历史任务保留但会显示在"默认"项目下`)) {
          (state.history || []).forEach(h => { if (h.projectId === pid) h.projectId = 'default'; });
          saveHistory();
          deleteProject(pid);
          renderProjectSwitcher();
          renderProjectManagement();
          toast(`已删除`, 'ok', 1200);
          reloadUIAfterProjectSwitch();
        }
      }
    };
  }
}

/* ====================== 21. 事件绑定 ====================== */

function bindEvents() {
  // 顶栏
  $('settingsBtn').onclick = openDrawer;
  $('drawerCloseBtn').onclick = closeDrawer;
  $('drawerMask').onclick = closeDrawer;
  $('historyBtn').onclick = openHistoryModal;
  $('introBtn').onclick = showIntroView;
  $('runningBadge').onclick = () => {
    // 任务还在跑 → 回到 task 视图
    if (!state.task) return;
    $('welcome').classList.add('hidden');
    $('intro')?.classList.add('hidden');
    $('result').classList.add('hidden');
    $('teamBuilder')?.classList.add('hidden');
    $('task').classList.remove('hidden');
  };
  $('introStartBtn').onclick = showWelcomeView;
  $('introStartBtn2').onclick = showWelcomeView;

  // 设置抽屉
  $('openaiKey').oninput = () => { validateKey('openai'); updateDefaultModelHint(); };
  $('anthropicKey').oninput = () => { validateKey('anthropic'); updateDefaultModelHint(); };
  $('qwenKey').oninput = () => { validateKey('qwen'); updateDefaultModelHint(); };
  $('deepseekKey').oninput = () => { validateKey('deepseek'); updateDefaultModelHint(); };
  $('doubaoKey').oninput = () => { validateKey('doubao'); updateDefaultModelHint(); };
  $('geminiKey').oninput = () => { validateKey('gemini'); updateDefaultModelHint(); };
  // F+17.13：处理 __add_custom__ / __manage_all_models__ 特殊触发器（跟 Agent 卡片下拉同逻辑）
  $('defaultModel').onchange = (e) => {
    const val = e.target.value;
    if (val.startsWith('__add_custom__:')) {
      const vendor = val.split(':')[1];
      handleAddCustomModel(e.target, vendor, (newId) => {
        // newId 已被 handleAddCustomModel 设到 select.value，更新 state + hint
        state.config.model = newId;
      });
      return;
    }
    if (val === '__manage_all_models__') {
      // 回滚到 prev value（model 不变）
      e.target.value = e.target.dataset.prevValue || state.config.model;
      openManageAllModelsModal(() => {
        // manage 弹窗里有改动 → 重渲染下拉
        refreshDefaultModelSelect();
        // 如果 state.config.model 不在新列表里 → fallback 不强制改（用户在 manage 里删了自己正在用的需要警示）
      });
      return;
    }
    e.target.dataset.prevValue = val;
    updateDefaultModelHint();
  };

  // 项目上下文（记忆 #2）· F+11 走 getProjectMemory() 按项目隔离
  const pcInput = $('projectContextInput');
  if (pcInput) {
    pcInput.value = getProjectMemory().projectContext || '';
    const pcCounter = $('projectContextCounter');
    const updatePcCounter = () => { if (pcCounter) pcCounter.textContent = pcInput.value.length + ' / 500'; };
    updatePcCounter();
    pcInput.oninput = () => {
      getProjectMemory().projectContext = pcInput.value;
      updatePcCounter();
    };
    pcInput.onblur = () => saveProjectMemory();
  }

  // 记忆开关（#4 #6 #7 #8）
  const toggleIds = {
    memEnableProjectContext: 'enableProjectContext',
    memEnableUserProfile: 'enableUserProfile',
    memEnableAutoRelate: 'enableAutoRelate',
    memEnableKnowledgeBase: 'enableKnowledgeBase',
    memEnableAgentMemory: 'enableAgentMemory',
  };
  Object.entries(toggleIds).forEach(([elId, k]) => {
    const el = $(elId);
    if (!el) return;
    el.checked = !!state.memory.settings[k];
    el.onchange = () => {
      state.memory.settings[k] = el.checked;
      saveMemory();
    };
  });

  // 用户画像列表 + 单条删除
  refreshUserProfileList();
  refreshAgentMemoryList();
  refreshKbList();

  // KB 上传
  const kbBtn = $('kbUploadBtn');
  const kbPicker = $('kbFilePicker');
  if (kbBtn && kbPicker) {
    kbBtn.onclick = () => kbPicker.click();
    kbPicker.onchange = (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      addKnowledgeBaseFile(f, refreshKbList);
      kbPicker.value = '';
    };
  }

  // 预算 slider
  const budgetSlider = $('memBudgetSlider');
  const budgetVal = $('memBudgetValue');
  if (budgetSlider && budgetVal) {
    budgetSlider.value = state.memory.settings.budgetTokens || MEMORY_DEFAULT_BUDGET;
    budgetVal.textContent = budgetSlider.value + ' tk';
    budgetSlider.oninput = () => {
      state.memory.settings.budgetTokens = Number(budgetSlider.value);
      budgetVal.textContent = budgetSlider.value + ' tk';
    };
    budgetSlider.onchange = () => saveMemory();
  }

  // 隐私：导出 / 导入 / 清空
  $('exportMemoryBtn')?.addEventListener('click', exportMemoryJson);
  $('importMemoryBtn')?.addEventListener('click', () => $('importMemoryPicker').click());
  $('importMemoryPicker')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    importMemoryJson(f); e.target.value = '';
  });
  $('clearAllMemoryBtn')?.addEventListener('click', async () => {
    const yes = await showModal({
      title: '⚠️ 清空全部记忆',
      bodyHtml: '<p>将清除：项目上下文 / 用户画像 / Agent 记忆 / 知识库 / 项目列表 / 历史任务。<br/><strong style="color:var(--danger)">此操作不可撤销。</strong></p>',
      buttons: [{ label: '取消', value: null }, { label: '确认清空', primary: true, value: true }]
    });
    if (yes) clearAllMemory();
  });
  $('saveConfigBtn').onclick = () => {
    state.config.openaiKey = $('openaiKey').value.trim();
    state.config.anthropicKey = $('anthropicKey').value.trim();
    state.config.qwenKey = $('qwenKey').value.trim();
    state.config.deepseekKey = $('deepseekKey').value.trim();
    state.config.doubaoKey = $('doubaoKey').value.trim();
    state.config.geminiKey = $('geminiKey').value.trim();
    state.config.tavilyKey = $('tavilyKey')?.value.trim() || '';
    state.config.toolsEnabledGlobal = !!$('toolsEnabledGlobal')?.checked;
    state.config.model = $('defaultModel').value;
    state.config.remember = $('rememberConfig').checked;
    saveConfig();
    closeDrawer();
    toast('配置已保存', 'ok');
  };

  // 输入框
  const ti = $('userInput');
  ti.oninput = () => {
    const len = ti.value.length;
    $('charCount').textContent = `${len} / ${MAX_USER_INPUT_LEN}`;
    if (len > 0) {
      const r = routeScene(ti.value);
      const hint = $('routeHint');
      if (r.state === 'unique') {
        hint.textContent = `→ ${r.primary.icon} 推测为「${r.primary.name}」场景`;
        hint.className = 'route-hint';
        setSelectedChip(r.primary.id, 'hint');     // 强候选 → 实线高亮
      } else if (r.state === 'conflict') {
        hint.textContent = `↔ 命中多个场景，确认时选择`;
        hint.className = 'route-hint warn';
        setSelectedChip(r.primary.id, 'hint');     // 多个候选时，仍 hint 最优那个
      } else if (r.state === 'low') {
        hint.textContent = `~ 可能是「${r.primary.name}」（待确认）`;
        hint.className = 'route-hint warn';
        setSelectedChip(r.primary.id, 'hint');
      } else {
        hint.textContent = '场景未匹配，手动选择';
        hint.className = 'route-hint warn';
        setSelectedChip(null);                     // 未匹配 → 清空
      }
    } else {
      $('routeHint').textContent = '';
      setSelectedChip(null);                       // 输入清空 → 清高亮
    }
  };

  $('sendBtn').onclick = async () => {
    const text = ti.value.trim();
    if (!text) { toast('请输入任务描述', 'warn'); return; }
    if (text.length > MAX_USER_INPUT_LEN) { toast('超出长度限制', 'warn'); return; }
    const r = routeScene(text);
    const sceneId = await confirmRoute(r);
    if (!sceneId) return;
    launchTask(sceneId, text);
  };

  // 场景 chip 直选 + 齿轮按钮（事件代理：齿轮 vs 主体）
  document.querySelectorAll('.scene-chip').forEach(el => {
    el.onclick = (e) => {
      // 点齿轮：打开 per-Agent 模型配置面板
      const cog = e.target.closest('.scene-config-trigger');
      if (cog) {
        e.stopPropagation();
        openSceneConfig(cog.dataset.configScene);
        return;
      }
      const sceneId = el.dataset.scene;
      // 视觉反馈：被点击的 chip 立刻 firm 高亮（覆盖路由的 hint 高亮）
      setSelectedChip(sceneId, 'firm');
      // 自定义场景：先进入团队构建器，无需先输入任务
      if (sceneId === 'custom') {
        showTeamBuilder();
        return;
      }
      const text = ti.value.trim();
      if (!text) {
        toast('请先在输入框中描述任务', 'warn');
        ti.focus();
        // 没输入文字，撤销高亮（避免误导）
        setTimeout(() => setSelectedChip(null), 400);
        return;
      }
      launchTask(sceneId, text);
    };
  });
  refreshSceneCustomizedBadges();

  // 团队构建器
  $('teamBackBtn').onclick = showWelcomeView;
  $('teamResetBtn').onclick = async () => {
    const yes = await showModal({
      title: '恢复默认团队？',
      bodyHtml: '<p>会清空当前的团队配置，恢复为默认 2 个 Agent。</p>',
      buttons: [{ label: '取消', value: null }, { label: '确认恢复', primary: true, value: true }]
    });
    if (yes) {
      state.customTeam = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_TEAM));
      saveCustomTeam();
      renderTeamAgentList();
      $('teamRounds').value = state.customTeam.rounds;
      toast('已恢复默认', 'ok');
    }
  };
  $('teamSaveBtn').onclick = () => {
    state.customTeam.rounds = Math.max(1, Math.min(10, Number($('teamRounds').value) || 4));
    saveCustomTeam();
    // 同时把命名后的团队保存到团队库
    const name = $('teamNameInput').value.trim();
    if (!name) {
      toast('请先填写团队名称（左上输入框）', 'warn');
      $('teamNameInput').focus(); return;
    }
    if (saveTeamAs(name)) {
      // 命中名字 → 把 currentTeamId 关联起来
      const t = state.teamLibrary.find(x => x.name === name);
      if (t) state.currentTeamId = t.id;
      renderTeamLibraryDropdown();
      toast(`团队「${name}」已保存`, 'ok');
    }
  };
  $('teamLoadBtn').onclick = () => {
    const id = $('teamLibrarySelect').value;
    if (!id) { toast('请先在下拉里选一个团队', 'warn'); return; }
    loadTeam(id);
  };
  $('teamDeleteBtn').onclick = async () => {
    const id = $('teamLibrarySelect').value;
    if (!id) { toast('请先在下拉里选一个团队', 'warn'); return; }
    const t = state.teamLibrary.find(x => x.id === id);
    const yes = await showModal({
      title: '删除团队',
      bodyHtml: `<p>确定要删除「<strong>${escapeHtml(t.name)}</strong>」吗？此操作不可撤销。</p>`,
      buttons: [
        { label: '取消', value: null },
        { label: '确认删除', primary: true, value: true },
      ]
    });
    if (yes) {
      deleteTeam(id);
      toast(`已删除「${t.name}」`, 'ok');
    }
  };
  $('teamAddBtn').onclick = addCustomAgent;
  $('teamPresetBtn').onclick = showPresetPicker;
  $('teamLaunchBtn').onclick = launchCustomTeam;
  $('teamRounds').oninput = () => {
    state.customTeam.rounds = Math.max(1, Math.min(10, Number($('teamRounds').value) || 4));
  };
  $('teamMode').onchange = () => {
    state.customTeam.mode = $('teamMode').value;
    const mode = state.customTeam.mode;
    // 给所有 Agent 填该模式下的默认角色，让校验立即变绿
    if (mode === 'multi-phase') {
      state.customTeam.agents.forEach(a => { if (!a.phase) a.phase = 1; });
    } else if (mode === 'reflection') {
      // 默认第 1 个 creator，第 2 个 critic（多余的不设）
      state.customTeam.agents.forEach((a, i) => {
        a.role = i === 0 ? 'creator' : i === 1 ? 'critic' : (a.role || 'critic');
      });
    } else if (mode === 'hub-spoke') {
      // 第 1 个 hub，其余 spoke
      state.customTeam.agents.forEach((a, i) => {
        a.role = i === 0 ? 'hub' : 'spoke';
      });
    }
    refreshTeamModeUI();
    renderTeamAgentList();
  };

  // 自定义任务输入弹层
  $('customPromptCancelBtn').onclick = closeCustomPrompt;
  $('customPromptOkBtn').onclick = confirmCustomPrompt;
  $('customPromptText').onkeydown = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirmCustomPrompt();
    if (e.key === 'Escape') closeCustomPrompt();
  };

  // 任务区
  $('backBtn').onclick = () => {
    // F+18：明确语义 —— 这是"停止 + 返回"。abort 所有 controller + 隐藏 runningBadge
    state.aborted = true;
    state.task?.abortControllers.forEach(ac => ac.abort('user-back'));
    try { $('runningBadge').classList.add('hidden'); } catch {}
    showWelcomeView();
    toast('任务已停止', 'warn', 2000);
  };
  $('pauseBtn').onclick = togglePause;
  $('interventionSendBtn').onclick = tryIntervention;
  $('interventionText').onkeydown = e => { if (e.key === 'Enter') tryIntervention(); };

  // 结果区
  $('resultBackBtn').onclick = showWelcomeView;
  $('regenerateBtn').onclick = () => {
    if (!state.task) return;
    launchTask(state.task.sceneId, state.task.userText);
  };
  $('viewDiscussionBtn').onclick = () => {
    if (!state.task) return;
    $('result').classList.add('hidden');
    $('task').classList.remove('hidden');
    setTaskStatus('查看完成的讨论', 'done');
    $('intervention').classList.add('hidden');
  };
  $('copyResultBtn').onclick = () => {
    const t = $('resultContent').innerText;
    navigator.clipboard?.writeText(t).then(() => toast('结果已复制', 'ok'));
  };
  $('exportMdBtn').onclick = () => exportTaskAsMarkdown();

  // 全局快捷键
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('drawerMask').classList.contains('hidden')) closeDrawer();
      if (!$('modalMask').classList.contains('hidden')) closeModal();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (!$('welcome').classList.contains('hidden')) $('sendBtn').click();
    }
  });
}

/* ====================== 22. 启动 ====================== */

/**
 * F+21：给所有 type=password 输入框自动加 👁 显示/隐藏切换
 * 安全默认：密码隐藏；点击 toggle 显示原文（用户核对输入）
 * 通用 JS 实现，0 处改 HTML
 */
function setupPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggleApplied) return;  // 防重复绑
    input.dataset.toggleApplied = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key-toggle';
    btn.textContent = '👁';
    btn.title = '显示 / 隐藏（默认隐藏保护 Key 安全）';
    btn.style.cssText = 'margin-left:6px;background:none;border:1px solid var(--border);color:var(--text-muted);padding:0 10px;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;align-self:stretch;display:flex;align-items:center';
    btn.onclick = () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.textContent = isPwd ? '🙈' : '👁';
      btn.title = isPwd ? '隐藏 Key' : '显示 Key';
    };
    // 插到 input 之后（input-row 是 flex container）
    input.parentElement.insertBefore(btn, input.nextSibling);
  });
}

function init() {
  loadConfig();
  // F+17：恢复上次失败的 model 记录（让下拉立刻显示 ⚠ 标）
  try { loadModelFailures(); } catch {}
  // F+17.1：恢复用户填过的自定义 model ID
  try { loadCustomModels(); } catch {}
  // F+17.3：恢复用户隐藏的 hardcode model 列表
  try { loadHiddenModels(); } catch {}
  // F+17.5：恢复用户永久移除的 model 列表
  try { loadPurgedModels(); } catch {}
  bindEvents();
  // F+21：给 API Key 输入框加 👁 切换（init 阶段 input 已在 DOM 里只是 hidden）
  try { setupPasswordToggles(); } catch {}
  // 模型默认值
  if (!MODEL_PRICING[state.config.model]) state.config.model = 'gpt-4o-mini';
  // F+17.13：动态渲染 default model 下拉（首次 init 时也需要）
  refreshDefaultModelSelect();

  // 首次访问自动展示介绍页（已看过则跳过）
  let introSeen = false;
  try { introSeen = localStorage.getItem('myAgentTeam.introSeen') === '1'; } catch {}
  if (!introSeen) showIntroView();

  // 检测未结束任务（任务延续 #1）
  showResumeBannerIfNeeded();

  // P3-C 启动时静默清理一次记忆
  try { runMemoryHygiene({ silent: true }); } catch {}
  // P3-B 启动时静默迁移大数据到 IDB（仅当 localStorage 接近上限）
  migrateBigDataToIDB().catch(() => {});
  // P3-D 如果开启加密但 sessionKey 缺失 → 弹密码框
  _restoreSessionKey().then(k => {
    if (encryptionEnabled() && !k) promptUnlock();
  });
  // F+11 Level 3：项目空间 UI 初始化
  try {
    bindProjectUI();
    renderProjectSwitcher();
    renderProjectManagement();
  } catch (e) { console.warn('project UI init failed', e); }
  // F+14 i18n Phase 1：初次扫描 DOM + 绑定语言切换器
  try {
    if (typeof MAT_I18N === 'object') {
      MAT_I18N.walkAndTranslate(document.body);
      const btn = document.getElementById('langToggleBtn');
      if (btn) {
        btn.onclick = () => {
          const next = MAT_I18N.getLocale() === 'zh' ? 'en' : 'zh';
          MAT_I18N.setLocale(next);
        };
      }
    }
  } catch (e) { console.warn('i18n init failed', e); }
}

async function promptUnlock(retry = false) {
  const html = `
    <p>${retry ? '<span style="color:var(--danger)">密码错误，请重试。</span>' : '本地数据已加密，输入主密码解锁：'}</p>
    <input type="password" id="unlockPwd" placeholder="主密码" style="width:100%;font-size:14px;padding:8px" />
    <p style="font-size:11.5px;color:var(--text-dim);margin-top:8px">忘记密码 = 数据无法恢复。如需重置（清空敏感数据），点"清空敏感"。</p>
  `;
  const result = await showModal({
    title: '🔒 解锁本地数据',
    bodyHtml: html,
    buttons: [
      { label: '清空敏感', value: 'wipe' },
      { label: '解锁', primary: true, value: () => $('unlockPwd').value },
    ]
  });
  if (result === 'wipe') {
    // 清掉加密相关 + 敏感 keys，让用户重新走未加密模式
    for (const k of ENC_SENSITIVE_KEYS) localStorage.removeItem(k);
    localStorage.removeItem(ENC_FLAG_KEY);
    localStorage.removeItem(ENC_SALT_KEY);
    sessionStorage.removeItem(ENC_SESSION_KEY);
    location.reload();
    return;
  }
  if (!result) return promptUnlock();
  try {
    await encryptionUnlock(result);
    // 重新加载敏感数据
    const cfg = await readEncryptedJSON(STORAGE_KEY);
    if (cfg) Object.assign(state.config, cfg);
    const mem = await readEncryptedJSON(MEMORY_KEY);
    if (mem) state.memory = { ...state.memory, ...mem, settings: { ...state.memory.settings, ...(mem.settings || {}) } };
    toast('已解锁', 'ok');
  } catch {
    promptUnlock(true);
  }
}

/* ====================== 隐私 / 备份 ====================== */

function exportMemoryJson() {
  const data = {
    version: 1, exportedAt: new Date().toISOString(),
    memory: state.memory,
    projects: state.projects,
    knowledgeBase: state.knowledgeBase,
    history: state.history,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MyAgentTeam_Memory_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出记忆备份', 'ok');
}

async function importMemoryJson(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed.memory) { toast('文件格式不正确', 'error'); return; }
    const yes = await showModal({
      title: '导入记忆',
      bodyHtml: `<p>将<strong>覆盖</strong>当前的记忆 / 项目 / 知识库 / 历史。<br/>导出时间：${escapeHtml(parsed.exportedAt || '未知')}</p>`,
      buttons: [{ label: '取消', value: null }, { label: '确认导入', primary: true, value: true }]
    });
    if (!yes) return;
    state.memory = parsed.memory;
    if (parsed.projects) state.projects = parsed.projects;
    if (parsed.knowledgeBase) state.knowledgeBase = parsed.knowledgeBase;
    if (parsed.history) state.history = parsed.history;
    saveMemory(); saveProjects(); saveKnowledgeBase(); saveHistory();
    toast('已导入。请刷新页面以全部生效。', 'ok', 4000);
  } catch (e) {
    toast('导入失败：' + e.message, 'error');
  }
}

function clearAllMemory() {
  state.memory = {
    projectContext: '',
    userProfile: { learnedFacts: [] },
    agentMemories: {},
    settings: { ...state.memory.settings },  // 保留开关偏好
  };
  state.projects = [];
  state.knowledgeBase = { documents: [] };
  state.history = [];
  state.cumulative = { totalCostUsd: 0, taskCount: 0, totalTokens: 0 };
  state.activeProjectId = null;
  saveMemory(); saveProjects(); saveKnowledgeBase(); saveHistory(); saveCumulative();
  refreshUserProfileList(); refreshAgentMemoryList(); refreshKbList();
  const pcInput = $('projectContextInput'); if (pcInput) pcInput.value = '';
  toast('已清空全部记忆', 'ok');
}

function refreshAgentMemoryList() {
  const el = $('agentMemoryList');
  if (!el) return;
  const mem = state.memory.agentMemories || {};
  const keys = Object.keys(mem);
  if (keys.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px">还没有 Agent 记忆。开启「🧠 Per-Agent 记忆」开关后，每个发言过的 Agent 会自己积累。</div>';
    return;
  }
  el.innerHTML = keys.map(k => `
    <div class="profile-fact-row" style="flex-direction:column;align-items:stretch;gap:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:12.5px">${escapeHtml(AGENTS[k]?.name || k)}</strong>
        <button class="ghost-btn small" data-clear-agent-mem="${k}">清空</button>
      </div>
      <div style="font-size:11.5px;color:var(--text-muted);line-height:1.5">${escapeHtml(mem[k].slice(0, 200))}${mem[k].length > 200 ? '…' : ''}</div>
    </div>
  `).join('');
  el.onclick = (e) => {
    const btn = e.target.closest('[data-clear-agent-mem]');
    if (!btn) return;
    delete state.memory.agentMemories[btn.dataset.clearAgentMem];
    saveMemory(); refreshAgentMemoryList();
  };
}

function refreshKbList() {
  const el = $('kbDocList');
  if (!el) return;
  const docs = state.knowledgeBase.documents || [];
  if (docs.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px">知识库为空。上传 .txt / .md 文件作为 Agent 的"外脑"，启动任务时按关键词召回相关片段。</div>';
    return;
  }
  el.innerHTML = docs.map(d => `
    <div class="profile-fact-row">
      <span class="profile-fact-text">📄 ${escapeHtml(d.name)} <span style="color:var(--text-dim);font-size:11px">· ${d.chunks.length} 块 · ${(d.size / 1024).toFixed(0)} KB</span></span>
      <button class="ghost-btn small" data-kb-del="${d.id}">×</button>
    </div>
  `).join('');
  el.onclick = (e) => {
    const btn = e.target.closest('[data-kb-del]');
    if (!btn) return;
    deleteKbDocument(btn.dataset.kbDel);
    refreshKbList();
  };
}

function refreshUserProfileList() {
  const el = $('userProfileList');
  if (!el) return;
  const facts = state.memory.userProfile.learnedFacts || [];
  if (facts.length === 0) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px">还没有学到任何关于你的事实。完成 1-2 个任务后会自动开始学习。</div>';
    return;
  }
  el.innerHTML = facts.map((f, i) => `
    <div class="profile-fact-row">
      <span class="profile-fact-text">${escapeHtml(f.text)}</span>
      <button class="ghost-btn small" data-fact-idx="${i}">×</button>
    </div>
  `).join('');
  el.onclick = (e) => {
    const btn = e.target.closest('[data-fact-idx]');
    if (!btn) return;
    const idx = Number(btn.dataset.factIdx);
    state.memory.userProfile.learnedFacts.splice(idx, 1);
    saveMemory();
    refreshUserProfileList();
  };
}

function showResumeBannerIfNeeded() {
  try {
    const raw = localStorage.getItem(ACTIVE_TASK_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    // 太老的就清掉（>1 天）
    if (Date.now() - snap.ts > 24 * 3600_000) {
      localStorage.removeItem(ACTIVE_TASK_KEY); return;
    }
    const sceneMeta = snap.sceneId === 'custom'
      ? { icon: '🛠️', name: '自定义团队' }
      : SCENE_RULES.find(s => s.id === snap.sceneId) || { icon: '·', name: snap.sceneId };
    const banner = document.createElement('div');
    banner.className = 'resume-banner';
    banner.innerHTML = `
      <div>
        ⏯ 你有一个未完成的任务：<strong>${sceneMeta.icon} ${escapeHtml(snap.userText.slice(0, 40))}${snap.userText.length > 40 ? '…' : ''}</strong>
        <span class="resume-banner-ts">${fmtRelativeTime(snap.ts)}</span>
      </div>
      <div class="resume-banner-actions">
        <button class="ghost-btn small" data-action="dismiss">忽略</button>
        <button class="primary-btn small" data-action="resume">▶ 继续</button>
      </div>
    `;
    document.querySelector('#welcome').prepend(banner);
    banner.onclick = (e) => {
      const a = e.target.dataset.action;
      if (a === 'dismiss') {
        localStorage.removeItem(ACTIVE_TASK_KEY);
        banner.remove();
      } else if (a === 'resume') {
        localStorage.removeItem(ACTIVE_TASK_KEY);
        banner.remove();
        launchTask(snap.sceneId, snap.userText);
      }
    };
  } catch (e) { console.warn('resume banner failed', e); }
}

// F+13 bugfix：DOMContentLoaded 智能注册
// 如果 DOM 已就绪（readyState 不是 'loading'）→ 立即调 init
// 否则注册 listener 等 DOMContentLoaded
// 之前的 bug：app.js 在 HTML 末尾加载，DOM 早已 'complete'，DOMContentLoaded 永不触发 → init 不跑
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ====================== 测试导出（不影响浏览器运行） ====================== */
// 把顶层 const 显式赋给 globalThis，让 Node vm 沙盒（测试用）能拿到。
// 浏览器中 globalThis === window，这些已经隐式存在，赋值是 no-op。
try {
  const __exports = {
    state, MODEL_PRICING, SCENE_RULES, SCENE_FLOWS, SCENE_AGENT_LIST,
    SCENE_PRESETS, AGENTS, PRESET_TEAMS, AGENT_IDENTITY_TEMPLATES,
    AGENT_COLOR_PALETTE, MODE_LABEL, STORAGE_KEY, MEMORY_KEY, ACTIVE_TASK_KEY,
    PROJECTS_KEY, KB_KEY, CUMULATIVE_KEY, HISTORY_KEY, SCENE_CFG_KEY,
    SCENE_PROMPT_KEY, MAX_TOKENS_PER_TURN, TOTAL_TOKEN_BUDGET, COST_CAP_USD,
    TIMEOUTS, MAX_INTERVENTIONS, MAX_USER_INPUT_LEN,
    modeLabel, turnsLabel, buildBuiltinTeamForScene,
  };
  for (const [k, v] of Object.entries(__exports)) globalThis[k] = v;
} catch {}
