/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase B
   src/state/state.js — 全局 state 单一定义源

   职责：state object 的初始定义（之前散落在 app.js L549）

   设计原则：
   - state 是 mutable plain object，所有 modules 共享同一引用
   - 当前阶段（IIFE）：通过 window.state 全局访问
   - 未来 Phase A（ES modules）：modules import { state } from 本文件
   - 双暴露策略：window.state + ES export，平滑过渡

   依赖：MAT_CONSTANTS.MEMORY_DEFAULT_BUDGET · DEFAULT_CUSTOM_TEAM（app.js）
   ============================================================ */

/**
 * @file 全局 state 单一定义源
 * @see {@link State} 完整类型见 src/types/types.js
 */
window.MAT_STATE = (function() {
  "use strict";
  const { MEMORY_DEFAULT_BUDGET } = MAT_CONSTANTS;

  // 自定义团队默认模板（之前在 app.js L230，F+13 Phase B 一起迁过来避免加载顺序问题）
  const DEFAULT_CUSTOM_TEAM = {
    mode: 'sequential',
    rounds: 4,
    agents: [
      {
        key: 'c1', name: '我的 Agent 1', icon: '①', cls: 'agent-researcher',
        model: 'gpt-4o-mini', phase: 1,
        system: '你是一个研究型 Agent，擅长搜集事实、列出关键数据。\n要求：\n- 用条目化列出关键事实\n- 单次发言不超过 1500 token'
      },
      {
        key: 'c2', name: '我的 Agent 2', icon: '②', cls: 'agent-editor',
        model: 'gpt-4o-mini', phase: 1,
        system: '你是一个写作型 Agent，擅长结构化表达和润色。\n要求：\n- 基于研究 Agent 的素材撰写\n- 结构清晰、语言流畅'
      },
    ],
  };
  window.DEFAULT_CUSTOM_TEAM = DEFAULT_CUSTOM_TEAM;  // 双暴露：app.js 内 SCENE_PRESETS 等仍引用全局

  /**
   * 全局 state 对象 —— 所有 modules 共享同一引用
   * 通过 window.state（双暴露）+ MAT_STATE.state（ES modules 友好）访问
   * @type {State}
   */
  const state = {
    config: {
      openaiKey: '',
      anthropicKey: '',
      qwenKey: '',
      deepseekKey: '',
      doubaoKey: '',
      geminiKey: '',
      model: 'gpt-4o-mini',
      remember: true,
      agentIcons: {},  // 内置场景 Agent 头像 { agentKey: base64 }（仅本地）
      tavilyKey: '',   // Tavily Search API Key（工具调用 web_search）
      toolsEnabledGlobal: false,  // 全局开关：内置场景是否允许工具调用
    },
    customTeam: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_TEAM)),
    teamLibrary: [],   // [{id, name, createdAt, team:{rounds, agents:[...]}}]
    tplLibrary: [],    // [{id, name, system, createdAt}]
    // 内置 6 场景的 per-Agent 模型覆盖；空对象 = 用全局默认模型
    // 结构：{ writing: { researcher: 'qwen-turbo', editor: 'gpt-4o' }, ... }
    sceneConfigs: {},   // 模型覆盖：{ writing: { researcher: 'qwen-turbo' } }
    scenePrompts: {},   // system prompt 覆盖：{ writing: { researcher: '...' } }
    cumulative: { totalCostUsd: 0, taskCount: 0, totalTokens: 0 },
    history: [],  // [{id, ts, sceneId, sceneName, mode, userText, agents, tokens, costUsd, durationMs, history, result, projectId, doNotRemember}]
    // ===== 记忆系统 =====
    memory: {
      projectContext: '',                 // #2 用户长期上下文（≤500 字）
      userProfile: { learnedFacts: [] },  // #4 自动学习的事实 [{text, ts, source}]
      agentMemories: {},                  // #7 { agentKey: 'summary' }
      settings: {
        enableProjectContext: true,
        enableUserProfile: true,
        enableAgentMemory: false,         // 默认关，避免烧钱
        enableAutoRelate: false,          // #6 用户要求的开关
        enableKnowledgeBase: true,        // #8 知识库
        autoSummarizeAfterTask: true,
        budgetTokens: MEMORY_DEFAULT_BUDGET,
        // P3-A 每源软上限（0 = 不限，但仍受总 budgetTokens 约束）
        budgetPerSource: {
          projectContext: 800,
          userProfile:    400,
          includedTask:   600,
          knowledgeBase:  800,
          agentMemory:    300,
        },
      },
    },
    projects: [],                          // #5 [{id, name, createdAt}]
    knowledgeBase: { documents: [] },      // #8 [{id, name, ts, chunks:[{text}]}]
    activeProjectId: null,                 // 当前选中的项目，启动任务时默认带上
    task: null,           // 当前任务
    paused: false,
    aborted: false,
    // F+17：每个失败的 model ID 记一笔（让 UI 下拉给它加 ⚠ 标 + tooltip）
    // 结构：{ 'doubao-seed-2-0-lite-260428': { ts, status, msg, vendor }, ... }
    // 自动 record：handleApiError 写入
    // 自动 clear：runAgent 成功调用 → 删该 model 条目（用户更新 Key / 重新启用了模型）
    // 30 天过期：buildModelOptgroups 渲染前自动清理
    modelFailures: {},
    // F+17.1：用户填过的自定义 model ID（解决"hardcode 列表跟不上厂商发布节奏"）
    // 结构：[{ id: 'doubao-seed-1-6-pro-250615', vendor: 'doubao'|null, addedAt }]
    customModels: [],
    // F+17.3：用户主动隐藏的 hardcode model（如已下线的 doubao-seed-2-0-lite-260428）
    // 结构：{ [modelId]: true } —— Map 而非 array 因为查询频繁
    // 不删 MODEL_PRICING 的 hardcode 列表，只是 buildModelOptgroups 渲染时跳过
    hiddenModels: {},
    // F+17.5：永久移除的 model（不出现在下拉 + 不出现在"已删除"区，UI 不可撤销）
    // 只能通过 manage 弹窗底部"🔄 重置所有 model 偏好"全清后门恢复
    purgedModels: {},
  };

  // 双暴露：window.state 兼容 IIFE modules，未来 ES modules 时 export
  window.state = state;
  return { state };
})();
