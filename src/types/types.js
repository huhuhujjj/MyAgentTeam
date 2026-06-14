// @ts-check
/* ============================================================
   MyAgentTeam · F+13 Sprint 3：全局类型定义
   src/types/types.js — JSDoc @typedef 集中地

   用法：
   - 其他 module 顶部加 // @ts-check
   - 在 JSDoc 里用 {State} / {Config} / {Agent} 等引用
   - VSCode 自动读 .js 里的 @typedef，提供 IntelliSense + 实时检查

   不需要：
   - tsconfig.json（vanilla js，无 build step）
   - typescript 依赖（VSCode 内置）
   - .d.ts 文件（@typedef 已够）

   设计：
   - 所有类型都用 JSDoc 表达，不引入 .ts 文件
   - 目标是 90% 关键 API 有类型，不追求 100% strict
   ============================================================ */

/**
 * 6 厂商之一
 * @typedef {'openai'|'anthropic'|'qwen'|'deepseek'|'doubao'|'gemini'} Vendor
 */

/**
 * 模型价目条目（MODEL_PRICING value）
 * @typedef {Object} ModelPricing
 * @property {number} in   - USD per 1M input tokens
 * @property {number} out  - USD per 1M output tokens
 * @property {number} ctx  - Context window 大小（tokens）
 * @property {Vendor} vendor
 */

/**
 * 5 路记忆设置
 * @typedef {Object} MemorySettings
 * @property {boolean} enableProjectContext
 * @property {boolean} enableUserProfile
 * @property {boolean} enableAgentMemory
 * @property {boolean} enableAutoRelate
 * @property {boolean} enableKnowledgeBase
 * @property {boolean} autoSummarizeAfterTask
 * @property {number} budgetTokens
 * @property {{projectContext: number, userProfile: number, includedTask: number, knowledgeBase: number, agentMemory: number}} budgetPerSource
 */

/**
 * 用户画像 fact（自动学习）
 * @typedef {Object} LearnedFact
 * @property {string} text
 * @property {number} ts       - 时间戳
 * @property {string} [source] - 来源任务 id 或 userText 前 20 字
 */

/**
 * Memory 完整对象
 * @typedef {Object} Memory
 * @property {string} projectContext               - 用户长期上下文（≤500 字）
 * @property {{learnedFacts: LearnedFact[]}} userProfile
 * @property {Object<string, string>} agentMemories - { agentKey: 'summary' }
 * @property {MemorySettings} settings
 */

/**
 * 项目空间（F+11 Level 3）
 * @typedef {Object} Project
 * @property {string} id          - 'default' 或 'proj_XXX'
 * @property {string} name
 * @property {string} color       - HEX 颜色（PROJECT_COLORS 之一或 default 灰）
 * @property {number} createdAt
 */

/**
 * 项目隔离的 memory 子集
 * @typedef {Object} ProjectMemory
 * @property {string} projectContext
 * @property {{learnedFacts: LearnedFact[]}} userProfile
 * @property {Object<string, string>} agentMemories
 */

/**
 * 配置（6 vendor key + 设置）
 * @typedef {Object} Config
 * @property {string} openaiKey
 * @property {string} anthropicKey
 * @property {string} qwenKey
 * @property {string} deepseekKey
 * @property {string} doubaoKey
 * @property {string} geminiKey
 * @property {string} model       - 全局默认模型
 * @property {boolean} remember
 * @property {Object<string, string>} agentIcons
 * @property {string} tavilyKey
 * @property {boolean} toolsEnabledGlobal
 */

/**
 * 自定义 Agent 定义
 * @typedef {Object} CustomAgent
 * @property {string} key
 * @property {string} name
 * @property {string} icon
 * @property {string} cls         - CSS class 决定颜色
 * @property {string} model       - 该 Agent 用的模型
 * @property {number} phase       - 1/2/3 用于 multi-phase
 * @property {string} system      - system prompt
 * @property {boolean} [toolsEnabled]
 * @property {string} [role]      - 'creator'/'critic'/'hub'/'spoke' 用于 reflection/hub-spoke
 */

/**
 * 自定义团队
 * @typedef {Object} CustomTeam
 * @property {'sequential'|'pipeline'|'reflection'|'hub-spoke'|'multi-phase'} mode
 * @property {number} rounds
 * @property {CustomAgent[]} agents
 */

/**
 * 历史任务条目
 * @typedef {Object} HistoryEntry
 * @property {string} id
 * @property {number} ts
 * @property {string} sceneId
 * @property {string} sceneIcon
 * @property {string} sceneName
 * @property {string} mode
 * @property {string} userText
 * @property {string|null} projectId
 * @property {Array<{key: string, name: string, tokens: number}>} agents
 * @property {number} tokens
 * @property {number} costUsd
 * @property {number} durationMs
 * @property {number} interventions
 * @property {Array<{role: string, content: string}>} history
 * @property {string} result
 */

/**
 * 全局 state 对象
 * @typedef {Object} State
 * @property {Config} config
 * @property {CustomTeam} customTeam
 * @property {Array<Object>} teamLibrary
 * @property {Array<Object>} tplLibrary
 * @property {Object<string, Object<string, string>>} sceneConfigs
 * @property {Object<string, Object<string, string>>} scenePrompts
 * @property {{totalCostUsd: number, taskCount: number, totalTokens: number}} cumulative
 * @property {HistoryEntry[]} history
 * @property {Memory} memory
 * @property {Project[]} projects
 * @property {{documents: Array<Object>}} knowledgeBase
 * @property {string|null} activeProjectId
 * @property {Object<string, ProjectMemory>} [memoryByProject]
 * @property {Object|null} task
 * @property {boolean} paused
 * @property {boolean} aborted
 */

/**
 * 工具 schema（OpenAI function calling 格式）
 * @typedef {Object} ToolSchema
 * @property {'function'} type
 * @property {{name: string, description: string, parameters: Object}} function
 */

/**
 * 工具完整定义
 * @typedef {Object} Tool
 * @property {ToolSchema} schema
 * @property {(args: Object) => Promise<*>} execute
 */

/**
 * LLM 调用参数
 * @typedef {Object} CallLLMOpts
 * @property {string} system
 * @property {string} userMsg
 * @property {Array<{role: string, content: string}>} history
 * @property {(d: string) => void} [onDelta]
 * @property {AbortSignal} [signal]
 * @property {string} [modelOverride]
 * @property {Array<ToolSchema>} [tools]
 * @property {Array<Object>} [messagesOverride]
 */

/**
 * LLM 调用返回
 * @typedef {Object} CallLLMResult
 * @property {string} text
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {Array<{id: string, type: string, function: {name: string, arguments: string}}>} [tool_calls]
 */

/**
 * Phase 配置（Sprint 2 runScene 用）
 * @typedef {Object} PhaseConfig
 * @property {string} divider
 * @property {string} progress
 * @property {string[]} [agents]
 * @property {number} [rounds]
 * @property {string} [centerAgent]
 * @property {string} [tag]
 * @property {string} [agent]
 * @property {function(string): string[]} [l1Validate]
 * @property {function(string): boolean} [l2Check]
 */

/**
 * SCENE_CONFIGS value
 * @typedef {Object} SceneConfig
 * @property {string} sceneId
 * @property {string} chipName
 * @property {string} noTavilyWarning
 * @property {string} hasTavilyInfo
 * @property {PhaseConfig} p1
 * @property {PhaseConfig} p2
 * @property {PhaseConfig} p3
 */

// 让本文件被识别为 module（无 import/export 时 VSCode 仍读取 @typedef）
// 一个空 export 让 file 成为 module（type 才会被 export）
// 但为兼容 IIFE 项目，不真的 export，仅放标记
/** @type {true} */
const _TYPES_LOADED = true;
if (typeof window !== 'undefined') {
  window.MAT_TYPES_LOADED = _TYPES_LOADED;
}
