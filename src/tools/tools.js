/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/tools/tools.js — Agent 工具调用层

   职责：
   - sanitizeSearchDescription（F+10 中文乱码过滤）
   - TOOLS 字典（4 个内置工具：date_now / web_search / js_execute / web_fetch）
   - getToolsForAgent（按 agent / scene 决定是否启用工具）
   - executeToolCall（统一执行器 + 30s 超时 + 8K 截断防爆 token）

   依赖：
   - window.state.config.tavilyKey（web_search 用）
   - window.state.config.toolsEnabledGlobal（内置场景全局开关）
   - window.MAT_CONSTANTS.TOOL_TIMEOUT_MS
   ============================================================ */

window.MAT_TOOLS = (function() {
  'use strict';
  const { TOOL_TIMEOUT_MS } = MAT_CONSTANTS;

  // F+10 乱码过滤：Tavily 抓中文页面（如新浪财经 GB18030）有时 description 含乱码
  // → Agent 看到乱码后会自我降级"退回训练数据"，反而损害质量
  // → 检测 C1 controls (0x80-9F) + IPA Extended (0x250-2AF) + Spacing Modifier (0x2B0-2FF) 占比
  // → 占比 > 15% 视为乱码，整段替换为明确的"原页面编码异常"提示 + 保留 URL
  function sanitizeSearchDescription(desc, url) {
    if (!desc || desc.length < 50) return desc || '';
    const garbledChars = (desc.match(/[Ā-ɏɐ-˿Ͱ-ϿЀ-ӿ�]/g) || []).length;
    if (garbledChars / desc.length > 0.15) {
      return `[原页面编码异常（如 GB18030 被当 UTF-8 解析），无法提取摘要。如需该来源，请直接访问：${url}]`;
    }
    return desc;
  }

  // ====== TOOLS 字典 ======
  // 每条含 schema（OpenAI function calling 格式）+ execute 函数
  const TOOLS = {
    date_now: {
      schema: {
        type: 'function',
        function: {
          name: 'date_now',
          description: '获取当前日期、时间和时区（用于回答需要"今天"、"现在"、"最新"等时间敏感问题）',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      async execute() {
        const now = new Date();
        const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
        return {
          iso: now.toISOString(),
          local: now.toLocaleString('zh-CN'),
          weekday,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          unix: Math.floor(now.getTime() / 1000),
        };
      },
    },

    web_search: {
      schema: {
        type: 'function',
        function: {
          name: 'web_search',
          description: '联网搜索实时信息（用于查证事实、查最新动态、查公开数据）。返回 5-10 条 web 结果含 URL、标题、摘要',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词（中文或英文）' },
              count: { type: 'integer', description: '返回结果数 1-10，默认 5', default: 5 },
            },
            required: ['query'],
          },
        },
      },
      async execute(args) {
        const key = state.config.tavilyKey?.trim();
        if (!key) throw new Error('未配置 Tavily Search Key —— 请到设置面板填入（在 https://tavily.com 注册免费 1000 次/月）');
        const q = (args.query || '').trim();
        if (!q) throw new Error('query 不能为空');
        const count = Math.max(1, Math.min(10, args.count || 5));
        const resp = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({
            query: q,
            max_results: count,
            search_depth: 'basic',
            include_answer: false,
            include_raw_content: false,
          }),
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          throw new Error(`Tavily HTTP ${resp.status}：${errBody.slice(0, 200)}`);
        }
        const j = await resp.json();
        const results = (j.results || []).slice(0, count).map(r => ({
          title: r.title,
          url: r.url,
          description: sanitizeSearchDescription((r.content || '').slice(0, 300), r.url),
          score: r.score,
        }));
        return { query: q, count: results.length, results };
      },
    },

    js_execute: {
      schema: {
        type: 'function',
        function: {
          name: 'js_execute',
          description: '在沙箱里执行 JavaScript 代码（用于精确计算 / 排序 / 统计 / 数据处理 —— 模型纯文本算数易错）。代码必须以 return 语句返回结果。可用：Math / JSON / 基本字符串数组操作。无网络 / 无 DOM / 无 import',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'JavaScript 代码，必须 return 一个可序列化的结果。例：return Math.sqrt(2)' },
            },
            required: ['code'],
          },
        },
      },
      async execute(args) {
        const code = (args.code || '').trim();
        if (!code) throw new Error('code 不能为空');
        // 用 Blob URL + Worker 沙箱执行（无 DOM / 无 fetch / 无 localStorage）
        const wrappedCode = `
          self.onmessage = function(e) {
            try {
              const result = (function() { ${code} })();
              self.postMessage({ ok: true, result });
            } catch (err) {
              self.postMessage({ ok: false, error: String(err && err.message || err) });
            }
          };
        `;
        const blob = new Blob([wrappedCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        try {
          return await new Promise((resolve, reject) => {
            const worker = new Worker(workerUrl);
            const timeoutId = setTimeout(() => {
              worker.terminate();
              reject(new Error('JS 执行超时（5s 限制）'));
            }, 5000);
            worker.onmessage = (e) => {
              clearTimeout(timeoutId);
              worker.terminate();
              if (e.data.ok) {
                let safe;
                try { safe = JSON.parse(JSON.stringify(e.data.result)); }
                catch { safe = String(e.data.result); }
                resolve({ result: safe });
              } else {
                reject(new Error('运行时错误：' + e.data.error));
              }
            };
            worker.onerror = (e) => {
              clearTimeout(timeoutId);
              worker.terminate();
              reject(new Error('Worker 错误：' + (e.message || 'unknown')));
            };
            worker.postMessage('run');
          });
        } finally {
          URL.revokeObjectURL(workerUrl);
        }
      },
    },

    web_fetch: {
      schema: {
        type: 'function',
        function: {
          name: 'web_fetch',
          description: '抓取 URL 的完整内容（Markdown 化），用于深读 web_search 返回的链接。返回正文 markdown（前 8000 字符）',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '要抓取的 URL（必须 http/https）' },
            },
            required: ['url'],
          },
        },
      },
      async execute(args) {
        const u = (args.url || '').trim();
        if (!/^https?:\/\//.test(u)) throw new Error('URL 必须以 http:// 或 https:// 开头');
        // Jina Reader 免 Key，直接代理 https://r.jina.ai/{URL}
        const proxyUrl = 'https://r.jina.ai/' + u;
        const resp = await fetch(proxyUrl, {
          headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
        });
        if (!resp.ok) throw new Error(`抓取失败 HTTP ${resp.status}（部分网站封爬虫，可换 web_search 拿摘要）`);
        const text = await resp.text();
        const truncated = text.length > 8000;
        return {
          url: u,
          content: text.slice(0, 8000) + (truncated ? '\n\n…（已截断到 8000 字符）' : ''),
          length: text.length,
          truncated,
        };
      },
    },
  };

  /** 取一个 Agent 应使用的工具 schema 列表 */
  function getToolsForAgent(agent, sceneId) {
    // 自定义团队 Agent：agent.toolsEnabled 决定
    // 内置场景：state.config.toolsEnabledGlobal 决定
    const enabled = agent?.toolsEnabled || (sceneId && state.config.toolsEnabledGlobal);
    if (!enabled) return null;
    return Object.values(TOOLS).map(t => t.schema);
  }

  /** 执行一个 tool_call，返回 string（model 看到的 tool message content）*/
  async function executeToolCall(call) {
    const name = call.function?.name;
    const argStr = call.function?.arguments || '{}';
    let args;
    try { args = JSON.parse(argStr); } catch { args = {}; }
    const tool = TOOLS[name];
    if (!tool) return JSON.stringify({ error: `未知工具：${name}` });
    try {
      const result = await Promise.race([
        tool.execute(args),
        new Promise((_, rej) => setTimeout(() => rej(new Error('工具执行超时（30s）')), TOOL_TIMEOUT_MS)),
      ]);
      return JSON.stringify(result).slice(0, 8000);  // 防爆 token
    } catch (e) {
      return JSON.stringify({ error: e.message || String(e) });
    }
  }

  return {
    TOOLS,
    sanitizeSearchDescription,
    getToolsForAgent,
    executeToolCall,
  };
})();
