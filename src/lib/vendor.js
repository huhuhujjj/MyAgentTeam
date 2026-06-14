/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/lib/vendor.js — 模型价目 + vendor 推断

   职责：
   - MODEL_PRICING 数据表（30 模型，6 厂商）
   - 4 个 vendor 推断函数（无 state 依赖）

   下游引用：
   - calcCost / vendorHasKey / modelHasKey 在 app.js 仍能引用 MODEL_PRICING（解构）
   - 自适应折叠 (runAgent) 用 getModelContextWindow
   - 自定义团队的 model 字段填 ep-xxxxx 时 inferVendor 兜底识别
   ============================================================ */

window.MAT_VENDOR = (function() {
  'use strict';

  /**
   * 模型计价（USD per 1M tokens）—— 来源：各厂官方价目（截止 2026-06）
   * 标 ⚡flagship = 旗舰，标 ★expensive = 单任务可能撞熔断线
   *
   * 字段：
   *   in:  输入价（USD per 1M input tokens）
   *   out: 输出价（USD per 1M output tokens）
   *   ctx: 上下文窗口（tokens）
   *   vendor: 6 厂商之一（openai / anthropic / qwen / deepseek / doubao / gemini）
   */
  const MODEL_PRICING = {
    // ===== OpenAI =====
    'gpt-5':                    { in: 1.25, out: 10.00, ctx: 256000, vendor: 'openai' },   // ⚡ flagship
    'gpt-5-mini':               { in: 0.25, out: 2.00,  ctx: 256000, vendor: 'openai' },   // 旗舰廉价版
    'gpt-4o':                   { in: 2.50, out: 10.00, ctx: 128000, vendor: 'openai' },   // 上一代旗舰
    'gpt-4o-mini':              { in: 0.15, out: 0.60,  ctx: 128000, vendor: 'openai' },   // 入门
    'o3':                       { in: 2.00, out: 8.00,  ctx: 200000, vendor: 'openai' },   // ⚡ 推理专用
    'o3-mini':                  { in: 1.10, out: 4.40,  ctx: 200000, vendor: 'openai' },   // 推理廉价版
    // ===== Anthropic =====
    'claude-opus-4-5':          { in: 15.00, out: 75.00, ctx: 200000, vendor: 'anthropic' }, // ⚡★ flagship 极贵
    'claude-sonnet-4-5':        { in: 3.00,  out: 15.00, ctx: 200000, vendor: 'anthropic' }, // ⚡ flagship 平衡
    'claude-haiku-4-5':         { in: 1.00,  out: 5.00,  ctx: 200000, vendor: 'anthropic' }, // ⚡ flagship 入门
    'claude-3-5-sonnet-latest': { in: 3.00,  out: 15.00, ctx: 200000, vendor: 'anthropic' }, // 上一代（仍稳定）
    'claude-3-5-haiku-latest':  { in: 0.80,  out: 4.00,  ctx: 200000, vendor: 'anthropic' }, // 上一代
    // ===== 通义千问（DashScope OpenAI 兼容）=====
    'qwen3-max':                { in: 1.600, out: 6.400, ctx: 256000, vendor: 'qwen' },     // ⚡ flagship
    'qwen3-plus':               { in: 0.400, out: 1.600, ctx: 128000, vendor: 'qwen' },     // 旗舰平衡
    'qwen3-turbo':              { in: 0.050, out: 0.200, ctx: 128000, vendor: 'qwen' },     // 旗舰廉价
    'qwen-turbo':               { in: 0.042, out: 0.084, ctx: 8000,    vendor: 'qwen' },    // 上一代
    'qwen-plus':                { in: 0.112, out: 0.280, ctx: 128000,  vendor: 'qwen' },
    'qwen-max':                 { in: 0.336, out: 1.344, ctx: 32000,   vendor: 'qwen' },
    'qwen-long':                { in: 0.070, out: 0.280, ctx: 10000000, vendor: 'qwen' },   // 长上下文专用
    // ===== DeepSeek（OpenAI 兼容，cache-miss 价格）=====
    'deepseek-chat':            { in: 0.27, out: 1.10, ctx: 64000, vendor: 'deepseek' },    // ⚡ V3 当前旗舰
    'deepseek-reasoner':        { in: 0.55, out: 2.19, ctx: 64000, vendor: 'deepseek' },    // ⚡ R1 推理旗舰
    // ===== 豆包 Seed 2.0（火山引擎 ARK · 2026 旗舰系列）=====
    // 注意：ARK 要求 model ID 带日期后缀。价格按 1.5 同档估算，实际以 ARK 控制台为准
    'doubao-seed-2-0-lite-260428': { in: 0.042, out: 0.084, ctx: 32000,  vendor: 'doubao' },  // ⚡ 性价比
    'doubao-seed-2-0-pro-260215':  { in: 0.112, out: 0.280, ctx: 32000,  vendor: 'doubao' },  // ⚡ 旗舰主力
    // 注：API Key 须在 ARK 控制台勾选对应模型权限（自定义权限策略 → Model ID tab）
    //     如需 endpoint ID（ep-xxxxx）也可直接在 model 字段填，已通过 inferVendor 兜底
    // ===== Google Gemini（OpenAI 兼容端点）=====
    'gemini-2.5-pro':           { in: 1.25, out: 10.00, ctx: 2000000, vendor: 'gemini' },   // ⚡ flagship
    'gemini-2.5-flash':         { in: 0.30, out: 2.50,  ctx: 1000000, vendor: 'gemini' },   // ⚡ 旗舰快版
    'gemini-2.5-flash-lite':    { in: 0.10, out: 0.40,  ctx: 1000000, vendor: 'gemini' },   // ⚡ 旗舰入门
    'gemini-2.0-flash':         { in: 0.10, out: 0.40,  ctx: 1000000, vendor: 'gemini' },   // 上一代
    'gemini-2.0-flash-lite':    { in: 0.075, out: 0.30, ctx: 1000000, vendor: 'gemini' },   // 上一代
    // 注：gemini-1.5-pro 已被 Google 下线（2025 Q2），已移除
  };

  /**
   * 该模型是否属于"贵到容易撞熔断"的档位（≥ $10/M output）
   * @param {string} model
   * @returns {boolean}
   */
  function isExpensiveModel(model) {
    const p = MODEL_PRICING[model];
    return p ? (p.out >= 10) : false;
  }

  /**
   * 从模型名推断厂商（兜底用于不在 MODEL_PRICING 里的自定义模型 ID）
   * 主要用例：用户在自定义团队填 ep-xxxxxxxx（Volcengine Endpoint ID）等
   * @param {string} modelName
   * @returns {Vendor|null}
   */
  function inferVendor(modelName) {
    if (!modelName) return null;
    const m = String(modelName).toLowerCase();
    if (m.startsWith('ep-')) return 'doubao';          // Volcengine ARK Endpoint
    if (m.startsWith('doubao')) return 'doubao';
    if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
    if (m.startsWith('claude')) return 'anthropic';
    if (m.startsWith('qwen')) return 'qwen';
    if (m.startsWith('deepseek')) return 'deepseek';
    if (m.startsWith('gemini')) return 'gemini';
    return null;
  }

  /**
   * 解析模型 vendor：先查 MODEL_PRICING，没有则用 inferVendor 兜底
   * @param {string} model
   * @returns {Vendor|null}
   */
  function getModelVendor(model) {
    return (MODEL_PRICING[model] || {}).vendor || inferVendor(model);
  }

  /**
   * F+6 推断模型 context window 上限（用于 runAgent 自适应折叠避免短 ctx 模型爆炸）
   * @param {string} model
   * @returns {number} ctx 大小（tokens），未知模型 fallback 32000
   */
  function getModelContextWindow(model) {
    if (!model) return 32000;
    if (MODEL_PRICING[model]?.contextWindow) return MODEL_PRICING[model].contextWindow;
    const m = String(model).toLowerCase();
    // OpenAI 系列
    if (m.includes('gpt-5')) return 256000;
    if (m.includes('gpt-4o') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 128000;
    // Anthropic 系列：Claude 全系 200K
    if (m.includes('claude')) return 200000;
    // Qwen 系列
    if (m.includes('qwen3-max') || m.includes('qwen3-plus') || m.includes('qwen3-turbo')) return 131072;
    if (m.includes('qwen-long')) return 10000000;
    if (m.includes('qwen-turbo')) return 1000000;
    if (m.includes('qwen-plus')) return 131072;
    if (m.includes('qwen-max')) return 32768;
    if (m.includes('qwen')) return 32768;
    // DeepSeek 系列
    if (m.includes('deepseek')) return 65536;
    // 豆包系列：Seed 2.0 pro 256K，lite 32K，自定义 endpoint 保守按 32K
    if (m.includes('doubao-seed-2-0-pro')) return 256000;
    if (m.includes('doubao-seed-2-0-lite') || m.includes('doubao-1-5-lite')) return 32768;
    if (m.includes('doubao-1-5-pro')) return 32768;
    if (m.includes('doubao') || m.startsWith('ep-')) return 32768;
    // Gemini 系列：2.5-pro 2M，其他 1M
    if (m.includes('gemini-2.5-pro')) return 2000000;
    if (m.includes('gemini')) return 1000000;
    return 32000;  // 未知模型保守按 32K
  }

  return {
    MODEL_PRICING,
    isExpensiveModel, inferVendor, getModelVendor, getModelContextWindow,
  };
})();
