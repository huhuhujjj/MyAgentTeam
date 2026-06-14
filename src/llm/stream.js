/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/llm/stream.js — LLM 流式响应解析（3 vendor 协议 + 1 转换器）

   职责：
   - readOpenAIStream      — OpenAI / Qwen / DeepSeek-chat / Doubao / Gemini 共用
   - readDeepSeekR1Stream  — DeepSeek-Reasoner R1 特殊处理（reasoning_content）
   - readAnthropicStream   — Anthropic content_block_delta 协议
   - convertOpenAIMessagesToAnthropic — OpenAI messages → Anthropic content blocks

   设计原则：
   - 4 个函数全是纯函数（接受 resp / messages → 返回 token + text + tool_calls）
   - 统一返回 { text, inputTokens, outputTokens, tool_calls }（OpenAI 标准）
   - tool_calls 统一成 OpenAI 格式，让 runAgent 的工具循环不用区分 vendor

   依赖：window.MAT_UTILS.tokensFromText
   ============================================================ */

window.MAT_STREAM = (function() {
  'use strict';
  const { tokensFromText } = MAT_UTILS;

  /** OpenAI / Qwen / DeepSeek-chat / Doubao / Gemini 共用流解析 */
  async function readOpenAIStream(resp, onDelta) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; let text = '';
    let inputTokens = 0, outputTokens = 0;
    // 累积 tool_calls：模型可能流式吐出多个工具调用，arguments 拼成 JSON 字符串
    const toolCallsBuf = []; // [{ id, name, argsBuf }]
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const data = l.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta;
          if (delta?.content) { text += delta.content; onDelta?.(delta.content); }
          // 累积 tool_calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsBuf[idx]) toolCallsBuf[idx] = { id: '', name: '', argsBuf: '' };
              if (tc.id) toolCallsBuf[idx].id = tc.id;
              if (tc.function?.name) toolCallsBuf[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallsBuf[idx].argsBuf += tc.function.arguments;
            }
          }
          if (j.usage) {
            inputTokens = j.usage.prompt_tokens || inputTokens;
            outputTokens = j.usage.completion_tokens || outputTokens;
          }
        } catch {}
      }
    }
    if (!outputTokens) outputTokens = tokensFromText(text);
    // 整理 tool_calls 成 OpenAI 标准格式
    const tool_calls = toolCallsBuf.filter(t => t && t.id).map(t => ({
      id: t.id,
      type: 'function',
      function: { name: t.name, arguments: t.argsBuf || '{}' },
    }));
    return { text, inputTokens, outputTokens, tool_calls };
  }

  /**
   * DeepSeek R1 (deepseek-reasoner) 专用流解析
   * 与 OpenAI 流的区别：包含 reasoning_content 字段（思考过程）
   * 处理：把 reasoning_content 包成 > 引用块流出，再接正文
   */
  async function readDeepSeekR1Stream(resp, onDelta) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', text = '';
    let inputTokens = 0, outputTokens = 0;
    let reasoningOpened = false, reasoningClosed = false;
    // F+7 BUG FIX：R1 也支持 tool_calls，必须累积才能让工具循环工作
    const toolCallsBuf = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const data = l.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            if (!reasoningOpened) {
              const head = '> 🧠 **R1 思考过程**\n> \n> ';
              text += head; onDelta?.(head);
              reasoningOpened = true;
            }
            const r = delta.reasoning_content.replace(/\n/g, '\n> ');
            text += r; onDelta?.(r);
          }
          if (delta?.content) {
            if (reasoningOpened && !reasoningClosed) {
              const sep = '\n\n---\n\n';
              text += sep; onDelta?.(sep);
              reasoningClosed = true;
            }
            text += delta.content; onDelta?.(delta.content);
          }
          // 累积 tool_calls（与 readOpenAIStream 同样的逻辑）
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsBuf[idx]) toolCallsBuf[idx] = { id: '', name: '', argsBuf: '' };
              if (tc.id) toolCallsBuf[idx].id = tc.id;
              if (tc.function?.name) toolCallsBuf[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallsBuf[idx].argsBuf += tc.function.arguments;
            }
          }
          if (j.usage) {
            inputTokens = j.usage.prompt_tokens || inputTokens;
            outputTokens = j.usage.completion_tokens || outputTokens;
          }
        } catch {}
      }
    }
    if (!outputTokens) outputTokens = tokensFromText(text);
    const tool_calls = toolCallsBuf.filter(t => t && t.id).map(t => ({
      id: t.id, type: 'function',
      function: { name: t.name, arguments: t.argsBuf || '{}' },
    }));
    return { text, inputTokens, outputTokens, tool_calls };
  }

  /**
   * Anthropic 流解析（content_block_delta 协议）
   * 与 OpenAI 流的区别：通过 content_block_start/delta/stop 标记块类型
   * tool_use 块的 input 通过 input_json_delta 增量流出，需累积
   */
  async function readAnthropicStream(resp, onDelta) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', text = '';
    let inputTokens = 0, outputTokens = 0;
    // Anthropic tool_use 块累积：{ idx: { id, name, inputBuf } }
    const toolBlocks = {};
    let currentBlock = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const data = l.slice(5).trim();
        try {
          const j = JSON.parse(data);
          // content_block_start: 标记块类型（text 或 tool_use）
          if (j.type === 'content_block_start') {
            const idx = j.index;
            const cb = j.content_block;
            if (cb?.type === 'tool_use') {
              toolBlocks[idx] = { id: cb.id, name: cb.name, inputBuf: '' };
              currentBlock = { kind: 'tool', idx };
            } else {
              currentBlock = { kind: 'text', idx };
            }
          }
          // content_block_delta: 增量内容
          if (j.type === 'content_block_delta') {
            if (j.delta?.text) {
              text += j.delta.text;
              onDelta?.(j.delta.text);
            } else if (j.delta?.type === 'input_json_delta' && j.delta?.partial_json && currentBlock?.kind === 'tool') {
              const blk = toolBlocks[currentBlock.idx];
              if (blk) blk.inputBuf += j.delta.partial_json;
            }
          }
          if (j.type === 'message_delta' && j.usage) {
            outputTokens = j.usage.output_tokens || outputTokens;
          }
          if (j.type === 'message_start' && j.message?.usage) {
            inputTokens = j.message.usage.input_tokens || inputTokens;
          }
        } catch {}
      }
    }
    if (!outputTokens) outputTokens = tokensFromText(text);
    // 整理 tool_calls 成 OpenAI 标准格式（runAgent loop 统一处理）
    const tool_calls = Object.values(toolBlocks).filter(t => t.id).map(t => ({
      id: t.id,
      type: 'function',
      function: { name: t.name, arguments: t.inputBuf || '{}' },
    }));
    return { text, inputTokens, outputTokens, tool_calls };
  }

  /**
   * OpenAI 风格 messages（含 tool_calls / role:tool）→ Anthropic content blocks 格式
   * 跳过 system（在 Anthropic 走顶层 system 参数）
   */
  function convertOpenAIMessagesToAnthropic(messages) {
    const out = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'user') {
        out.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        const blocks = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        if (m.tool_calls?.length) {
          for (const tc of m.tool_calls) {
            let input;
            try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = {}; }
            blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
          }
        }
        out.push({ role: 'assistant', content: blocks });
      } else if (m.role === 'tool') {
        // tool 结果在 Anthropic 里以 user 消息的 tool_result content block 形式提交
        out.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
        });
      }
    }
    return out;
  }

  return {
    readOpenAIStream,
    readDeepSeekR1Stream,
    readAnthropicStream,
    convertOpenAIMessagesToAnthropic,
  };
})();
