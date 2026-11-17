/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/lib/constants.js — 全部全局常量与配置

   职责：
   - 11 个 localStorage key
   - 全部容量 / 阈值 / 预算 / 超时常量
   - F+ 各次迭代调优的关键数字（来源注释完整保留）

   设计原则：
   - 本文件**只放原始数据**，不放函数（函数→ utils.js / vendor.js）
   - 数字带来源注释（"F+X 调到 ..."），便于追溯
   ============================================================ */

window.MAT_CONSTANTS = (function() {
  'use strict';

  const VERSION = 'V1.0.0';

  // ===== 11 个 localStorage key =====
  const STORAGE_KEY              = 'myAgentTeam.config';
  const HISTORY_KEY              = 'myAgentTeam.history';
  const CUMULATIVE_KEY           = 'myAgentTeam.cumulative';
  const TEAM_KEY                 = 'myAgentTeam.customTeam';          // 当前正在编辑/使用的团队
  const TEAM_LIBRARY_KEY         = 'myAgentTeam.teamLibrary';         // 已保存的所有团队
  const TPL_LIBRARY_KEY          = 'myAgentTeam.tplLibrary';          // 用户自建的身份模板
  const SCENE_CFG_KEY            = 'myAgentTeam.sceneConfigs';        // 内置场景的 per-Agent 模型覆盖
  const SCENE_PROMPT_KEY         = 'myAgentTeam.scenePrompts';        // 内置场景的 per-Agent system prompt 覆盖
  const MEMORY_KEY               = 'myAgentTeam.memory';              // 记忆系统总入口
  const ACTIVE_TASK_KEY          = 'myAgentTeam.activeTask';          // 任务延续：未结束任务快照
  const PROJECTS_KEY             = 'myAgentTeam.projects';            // 项目分组列表
  const MEMORY_BY_PROJECT_KEY    = 'myAgentTeam.memoryByProject';     // F+11 Level 3 项目隔离的 memory
  const KB_KEY                   = 'myAgentTeam.knowledgeBase';       // 知识库（RAG）
  const MODEL_FAILURES_KEY       = 'myAgentTeam.modelFailures';       // F+17 上次失败的 model ID 记录（30 天自动清理）
  const CUSTOM_MODELS_KEY        = 'myAgentTeam.customModels';        // F+17.1 用户填过的自定义 model ID 列表
  const HIDDEN_MODELS_KEY        = 'myAgentTeam.hiddenModels';        // F+17.3 用户从下拉里隐藏的 hardcode model（过期/不想看）
  const PURGED_MODELS_KEY        = 'myAgentTeam.purgedModels';        // F+17.5 永久移除（不出现在下拉 + 不出现在"已删除"区）
  const MODEL_CATALOG_KEY        = 'myAgentTeam.modelCatalog';        // F+23 厂商 /v1/models 动态发现结果（TTL 24h）

  // ===== 容量限制 =====
  const HISTORY_LIMIT            = 50;     // 历史任务最多保留条数
  const MEMORY_MAX_PROFILE_FACTS = 20;     // 用户画像 facts 上限
  const MEMORY_DEFAULT_BUDGET    = 1500;   // 默认记忆 token 预算上限
  const MAX_INTERVENTIONS        = 3;      // 用户介入上限
  const MAX_USER_INPUT_LEN       = 2000;   // 输入长度限制（设计档案 17.3）

  // ===== Token 预算（设计档案 8.0）=====
  // F+3/F+4 调高到 8000：决策场景 coordinator 8 段裁决
  // 实跑数据反推 8 段高密度证据场景约需 6570 tokens，留 20% 余量定到 8000
  // Phase 1/2 Agent 实际输出由 prompt 决定，上限提升不会让短输出被动变长
  const MAX_TOKENS_PER_TURN      = 8000;
  const TOTAL_TOKEN_BUDGET       = { default: 30000, decision: 80000, dossier: 80000 };

  // ===== 单任务成本熔断线（设计档案 14.7）=====
  // 起底与决策同档：4 Agent + Phase 1 强制工具 + Phase 3 长档案
  const COST_CAP_USD             = { default: 2.00, decision: 5.00, dossier: 5.00 };

  // ===== 超时分层（设计档案 10.1）=====
  // F+2 翻倍：豆包 Seed 2.0 pro 在中国 ARK 区域实测 ~41 tokens/sec，简单 prompt 52s+
  // 决策场景 Phase 2 群聊一旦带 tool call 结果 + 多轮历史，常突破 60s
  // F+8 新增 coordinatorAgent: 5min 覆盖 8 段裁决 6000-8000 tokens 在国内慢模型需要的 195s+
  const TIMEOUTS = {
    connect: 10_000,
    singleAgent: 120_000,           // F+2: 60 → 120（覆盖国内豆包/通义慢响应）
    decisionPhase1Agent: 150_000,   // F+2: 90 → 150（Phase 1 强制工具，初始调用更慢）
    coordinatorAgent: 300_000,      // F+8 新增：8 段裁决 6000-8000 tokens 国内慢模型 195s+
    taskDefault: 360_000,           // F+2: 180 → 360（避免 task 总超时反成瓶颈）
    taskDecision: 900_000,          // F+8: 600 → 900（Phase 1 并行 + 5 轮 Phase 2 串行 + coordinator 5min，实测可达 12 min）
  };

  // ===== 工具调用循环（F+5 配置）=====
  // F+5 恢复 5（从 F+4 的 3）：用户偏好"充分调研路线"
  // 4 个 Phase 1 Agent prompt 把"至少 2 次"改成"至少 4 次"以鼓励用满
  // 已知 trade-off：Agent-B 类多关键词搜索 Agent 可能回到 ~50K tokens；F+6 自适应折叠让短 ctx 模型仍可用
  const TOOL_LOOP_MAX            = 5;        // 单 Agent 工具调用最多循环 5 次
  const TOOL_TIMEOUT_MS          = 30000;    // 单工具执行超时

  // ===== 记忆 hygiene =====
  const MEMORY_FACT_EXPIRE_DAYS  = 30;       // 默认 30 天过期
  const MEMORY_DEDUP_JACCARD_THRESHOLD = 0.7; // 相似度高于此 → 视为重复

  return {
    VERSION,
    // storage keys
    STORAGE_KEY, HISTORY_KEY, CUMULATIVE_KEY,
    TEAM_KEY, TEAM_LIBRARY_KEY, TPL_LIBRARY_KEY,
    SCENE_CFG_KEY, SCENE_PROMPT_KEY,
    MEMORY_KEY, ACTIVE_TASK_KEY,
    PROJECTS_KEY, MEMORY_BY_PROJECT_KEY,
    KB_KEY,
    MODEL_FAILURES_KEY, CUSTOM_MODELS_KEY, HIDDEN_MODELS_KEY, PURGED_MODELS_KEY, MODEL_CATALOG_KEY,
    // capacity
    HISTORY_LIMIT, MEMORY_MAX_PROFILE_FACTS, MEMORY_DEFAULT_BUDGET,
    MAX_INTERVENTIONS, MAX_USER_INPUT_LEN,
    // token budget
    MAX_TOKENS_PER_TURN, TOTAL_TOKEN_BUDGET, COST_CAP_USD,
    // timeouts
    TIMEOUTS,
    // tool loop
    TOOL_LOOP_MAX, TOOL_TIMEOUT_MS,
    // memory hygiene
    MEMORY_FACT_EXPIRE_DAYS, MEMORY_DEDUP_JACCARD_THRESHOLD,
  };
})();
