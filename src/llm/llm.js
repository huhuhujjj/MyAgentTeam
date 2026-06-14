/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/llm/llm.js — LLM 调用层（路由 + 6 vendor caller + ApiError）

   职责：
   - callLLM 路由器（按 vendor 分发，含无 Key 模拟兜底）
   - 6 个 vendor caller：OpenAI / Anthropic / Qwen / DeepSeek / Doubao / Gemini
   - ApiError 类（让 instanceof 检查跨模块工作）

   保留在 app.js（依赖过重，未在本次拆分）：
   - callSimulated（依赖 AGENTS / SIM_TEMPLATES 大字典）
   - runAgent（含 tool 循环 + 自适应折叠 + state.task.abortControllers 副作用）

   依赖：
   - window.state（API Keys、abortController）
   - window.MAT_CONSTANTS.MAX_TOKENS_PER_TURN
   - window.MAT_VENDOR（getModelVendor）
   - window.MAT_STREAM（3 stream parser + convertOpenAIMessagesToAnthropic）
   - window.callSimulated（仍在 app.js）
   ============================================================ */

window.MAT_LLM = (function() {
  'use strict';
  const { MAX_TOKENS_PER_TURN } = MAT_CONSTANTS;
  const { getModelVendor } = MAT_VENDOR;
  const {
    readOpenAIStream, readDeepSeekR1Stream, readAnthropicStream,
    convertOpenAIMessagesToAnthropic,
  } = MAT_STREAM;

  // ====== ApiError ======
  // 必须在本模块导出，否则 app.js 内部 `instanceof ApiError` 检查会失效
  class ApiError extends Error {
    constructor(status, body) {
      super('API ' + status + ': ' + body.slice(0, 200));
      this.status = status;
      this.body = body;
    }
  }

  // ====== callLLM 路由器 ======
  /**
   * 流式调用 LLM 并通过 onDelta 回调输出 token 片段
   * @returns {Promise<{text, inputTokens, outputTokens, tool_calls?}>}
   *
   * 路由策略：
   * 1. 用 modelOverride 或 state.config.model 决定模型
   * 2. 用 getModelVendor 查 vendor（兜底 inferVendor，支持 ep-xxxxx）
   * 3. 检查 state.config.{vendor}Key 是否配置
   * 4. 配了 → 对应 caller；没配 → callSimulated 模拟模式
   */
  async function callLLM({ system, userMsg, history, onDelta, signal, modelOverride, tools, messagesOverride }) {
    const model = modelOverride || state.config.model;
    const vendor = getModelVendor(model);
    const args = { system, userMsg, history, onDelta, signal, model, tools, messagesOverride };

    if (vendor === 'openai' && state.config.openaiKey) return callOpenAI(args);
    if (vendor === 'anthropic' && state.config.anthropicKey) return callAnthropic(args);
    if (vendor === 'qwen' && state.config.qwenKey) return callQwen(args);
    if (vendor === 'deepseek' && state.config.deepseekKey) return callDeepSeek(args);
    if (vendor === 'doubao' && state.config.doubaoKey) return callDoubao(args);
    if (vendor === 'gemini' && state.config.geminiKey) return callGemini(args);
    // 无 Key → 模拟模式（callSimulated 仍在 app.js 全局）
    return callSimulated({ system, userMsg, history, onDelta, signal });
  }

  // ====== OpenAI 主力 caller ======
  // 协议：OpenAI Chat Completions API
  // 兼容性：Qwen / DeepSeek / Doubao / Gemini 都通过 endpoint 复用本函数
  async function callOpenAI({ system, userMsg, history, onDelta, signal, model, tools, messagesOverride, endpoint, apiKey }) {
    const messages = messagesOverride || [
      { role: 'system', content: system },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMsg },
    ];
    const body = {
      model, messages, stream: true,
      max_tokens: MAX_TOKENS_PER_TURN,
      temperature: 0.7,
      stream_options: { include_usage: true },
    };
    if (tools && tools.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    const url = endpoint || 'https://api.openai.com/v1/chat/completions';
    const key = apiKey || state.config.openaiKey;
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      // F+14: fetch() 层失败（CORS / 网络 / DNS / 浏览器扩展拦截）
      // 不是 ApiError 是 TypeError("Failed to fetch")，包成 ApiError(0) 让 handleApiError 识别
      if (e.name === 'AbortError') throw e;  // abort signal 不算错误
      throw new ApiError(0, `fetch failed: ${e.message || 'unknown'} · endpoint=${url}`);
    }
    if (!resp.ok) throw new ApiError(resp.status, await resp.text());
    return readOpenAIStream(resp, onDelta);
  }

  // ====== Anthropic 独立 caller ======
  // 与 OpenAI 协议差异：x-api-key 头 + content_block_delta 流 + tool_use 协议
  async function callAnthropic({ system, userMsg, history, onDelta, signal, model, tools, messagesOverride }) {
    const messages = messagesOverride
      ? convertOpenAIMessagesToAnthropic(messagesOverride)
      : [
          ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
          { role: 'user', content: userMsg },
        ];
    const body = { model, system, messages, stream: true, max_tokens: MAX_TOKENS_PER_TURN };
    // Anthropic 原生 tools 协议：[{ name, description, input_schema }]
    if (tools && tools.length) {
      body.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.config.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!resp.ok) throw new ApiError(resp.status, await resp.text());
    return readAnthropicStream(resp, onDelta);
  }

  // ====== Qwen (DashScope OpenAI 兼容) ======
  async function callQwen(opts) {
    return callOpenAI({
      ...opts,
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiKey: state.config.qwenKey,
    });
  }

  // ====== DeepSeek (OpenAI 兼容 + R1 reasoner 特殊处理) ======
  async function callDeepSeek(opts) {
    // R1 reasoner 用专用 reasoning_content 流式解析；其他用 OpenAI 标准
    if (opts.model === 'deepseek-reasoner') {
      // F+7 BUG FIX：补全 tools / messagesOverride 传递（之前只解构 6 个字段导致 R1 永远收不到 tools）
      // 警告：DeepSeek R1 (deepseek-reasoner) 官方对 function calling 支持有限/不稳定
      // 如果你需要强制工具的决策场景（Phase 1 必须 web_search），建议改用 deepseek-chat (V3 支持 tools 稳定)
      const { system, userMsg, history, onDelta, signal, model, tools, messagesOverride } = opts;
      const messages = messagesOverride || [
        { role: 'system', content: system },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: userMsg },
      ];
      const body = {
        model, messages, stream: true,
        max_tokens: MAX_TOKENS_PER_TURN,
        temperature: 0.7,
        stream_options: { include_usage: true },
      };
      if (tools && tools.length) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.config.deepseekKey },
        body: JSON.stringify(body),
        signal,
      });
      if (!resp.ok) throw new ApiError(resp.status, await resp.text());
      return readDeepSeekR1Stream(resp, onDelta);
    }
    return callOpenAI({
      ...opts,
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: state.config.deepseekKey,
    });
  }

  // ====== Doubao (Volcengine ARK，OpenAI 兼容协议) ======
  // F+1: model ID 必须带日期后缀（如 doubao-seed-2-0-pro-260215）或 ep-xxxxxxxx
  // API Key 须在 ARK 控制台勾选模型权限（自定义权限策略 → Model ID tab）
  // F+14.1: ARK 不返回 CORS header → hybrid 代理策略
  //   localhost   → 直连 ARK（开发环境无 CORS 检查）
  //   生产域名    → 走 same-origin /api/proxy/ark Edge Function（pass-through，不存 Key）
  async function callDoubao(opts) {
    const isLocal = typeof location !== 'undefined' &&
      (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    const endpoint = isLocal
      ? 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
      : '/api/proxy/ark';
    return callOpenAI({
      ...opts,
      endpoint,
      apiKey: state.config.doubaoKey,
    });
  }

  // ====== Gemini (Google OpenAI 兼容端点) ======
  // 注：CORS 已配置，浏览器可直连
  async function callGemini(opts) {
    return callOpenAI({
      ...opts,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: state.config.geminiKey,
    });
  }

  return {
    ApiError,
    callLLM,
    callOpenAI, callAnthropic, callQwen, callDeepSeek, callDoubao, callGemini,
  };
})();
