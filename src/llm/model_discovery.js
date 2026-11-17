/* ============================================================
   MyAgentTeam · 动态模型发现（F+23）
   src/llm/model_discovery.js

   职责：
   - 根据已配置的 API Key 拉取厂商 /v1/models
   - 归一化 / 过滤非对话模型 / 过滤退役模型
   - 结果缓存到 localStorage（TTL 24h），失败时保留缓存兜底
   - 用户自定义模型（state.customModels）优先级最高，不被远程结果覆盖

   依赖：
   - window.state / MAT_CONSTANTS / MAT_VENDOR
   - 同源代理 /api/models（Vercel Edge），本地静态服务器下自动降级为直连
   ============================================================ */
window.MAT_MODEL_DISCOVERY = (function() {
  'use strict';

  const C = window.MAT_CONSTANTS || {};
  const V = window.MAT_VENDOR || {};
  const KEY = C.MODEL_CATALOG_KEY || 'myAgentTeam.modelCatalog';
  const TTL_MS = 24 * 60 * 60 * 1000;

  const REMOTE_VENDORS = ['openai', 'anthropic', 'qwen', 'deepseek', 'gemini'];

  const ENDPOINTS = {
    openai: 'https://api.openai.com/v1/models',
    anthropic: 'https://api.anthropic.com/v1/models',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    deepseek: 'https://api.deepseek.com/v1/models',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
  };

  // 非对话类模型：不进入 Agent 下拉
  const NON_CHAT_RE = /embedding|rerank|moderation|audio|speech|transcribe|whisper|tts|image|imagen|veo|dall[-_]?e|ft:|babbage|davinci|aqa|translation/i;

  function blankCatalog() {
    return { models: [], fetchedAt: 0, errors: {} };
  }

  function ensureCatalog() {
    if (!state.modelCatalog || typeof state.modelCatalog !== 'object') state.modelCatalog = blankCatalog();
    if (!Array.isArray(state.modelCatalog.models)) state.modelCatalog.models = [];
    if (!state.modelCatalog.errors || typeof state.modelCatalog.errors !== 'object') state.modelCatalog.errors = {};
    return state.modelCatalog;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.models)) {
          state.modelCatalog = {
            models: parsed.models,
            fetchedAt: Number(parsed.fetchedAt) || 0,
            errors: parsed.errors || {},
          };
        }
      }
    } catch (e) {
      console.warn('model catalog load failed', e);
    }
    return ensureCatalog();
  }

  function saveToStorage() {
    try {
      localStorage.setItem(KEY, JSON.stringify(ensureCatalog()));
    } catch (e) {
      console.warn('model catalog save failed', e);
    }
  }

  function authHeaders(vendor, key) {
    if (vendor === 'anthropic') {
      return {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Accept': 'application/json',
      };
    }
    return { 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' };
  }

  function proxyHeaders(vendor, key) {
    return {
      'X-MAT-Vendor': vendor,
      'X-MAT-API-Key': key,
      'Accept': 'application/json',
    };
  }

  async function readError(resp) {
    let msg = '';
    try {
      const data = await resp.json();
      msg = (data && data.error && (data.error.message || data.error)) || '';
    } catch (_) {
      try { msg = await resp.text(); } catch (_) { msg = ''; }
    }
    return String(msg || '').slice(0, 160);
  }

  async function fetchVendorRaw(vendor, key, signal) {
    const proxyUrl = '/api/models?vendor=' + encodeURIComponent(vendor);
    let usedProxy = true;
    let resp = null;
    let directUrl = ENDPOINTS[vendor];

    try {
      resp = await fetch(proxyUrl, { method: 'GET', headers: proxyHeaders(vendor, key), signal });
      if (resp.status === 404) throw new Error('proxy not deployed');
    } catch (e) {
      usedProxy = false;
      if (!directUrl) throw new Error('同源代理不可用，且该厂商不支持浏览器直连');
      resp = await fetch(directUrl, { method: 'GET', headers: authHeaders(vendor, key), signal });
    }

    if (!resp.ok) {
      const msg = await readError(resp);
      throw new Error('HTTP ' + resp.status + (msg ? ': ' + msg : ''));
    }

    let data;
    try { data = await resp.json(); } catch (e) { throw new Error('厂商返回的不是合法 JSON'); }

    let items = Array.isArray(data) ? data : (data.data || data.models || []);
    if (!Array.isArray(items)) items = [];

    // Anthropic 使用游标分页；最多再取 2 页，避免无限拉取
    let guard = 0;
    let page = data;
    while (page && page.has_more && page.last_id && guard++ < 2) {
      let nextUrl;
      let nextHeaders;
      if (usedProxy) {
        nextUrl = proxyUrl + '&after_id=' + encodeURIComponent(page.last_id);
        nextHeaders = proxyHeaders(vendor, key);
      } else {
        const u = new URL(directUrl);
        u.searchParams.set('after_id', page.last_id);
        nextUrl = u.toString();
        nextHeaders = authHeaders(vendor, key);
      }
      const r = await fetch(nextUrl, { method: 'GET', headers: nextHeaders, signal });
      if (!r.ok) break;
      page = await r.json();
      items = items.concat(page.data || []);
    }

    return items;
  }

  function normalize(vendor, item) {
    const id = String((item && (item.id || item.name)) || '').trim();
    if (!id || NON_CHAT_RE.test(id)) return null;

    let created = 0;
    if (item.created) created = Number(item.created) * 1000;
    else if (item.created_at) created = Date.parse(item.created_at) || 0;

    let lifecycle = item.lifecycle || 'active';
    const shutdown = item.shutdown_date || item.retired_at || null;
    if (shutdown) {
      const t = Date.parse(shutdown);
      if (t && t <= Date.now()) lifecycle = 'retired';
      else lifecycle = 'deprecated';
    }
    if (lifecycle === 'retired') return null;

    const pricing = (V.MODEL_PRICING && V.MODEL_PRICING[id]) || null;
    const ctx = Number(item.max_input_tokens || item.context_window || (pricing && pricing.ctx) || 0) || 0;

    return {
      id,
      vendor,
      created,
      lifecycle,
      ctx,
      capabilities: item.capabilities || null,
      shutdown,
      pricing,
      source: 'remote',
    };
  }

  async function discover(options) {
    const opts = options || {};
    const vendors = Array.isArray(opts.vendors) ? opts.vendors : REMOTE_VENDORS;
    const cat = ensureCatalog();
    const errors = {};
    const successful = [];

    for (const vendor of vendors) {
      const key = state.config[vendor + 'Key'];
      if (!key) {
        errors[vendor] = '未配置 Key';
        continue;
      }
      if (vendor === 'doubao') {
        errors[vendor] = '豆包模型需在火山控制台开通，继续使用内置列表与自定义 ID';
        continue;
      }
      try {
        const raw = await fetchVendorRaw(vendor, key, opts.signal);
        const normalized = raw.map(function(item) { return normalize(vendor, item); }).filter(Boolean);
        cat.models = cat.models.filter(function(m) { return m.vendor !== vendor; });
        cat.models = cat.models.concat(normalized);
        errors[vendor] = null;
        successful.push(vendor);
      } catch (e) {
        errors[vendor] = String((e && e.message) || e).slice(0, 160);
      }
    }

    cat.errors = errors;
    cat.fetchedAt = Date.now();
    saveToStorage();
    return { models: getModels(), errors: errors, successful: successful };
  }

  function getModels(vendor) {
    const cat = ensureCatalog();
    let list = cat.models.filter(function(m) { return m && m.id && m.lifecycle !== 'retired'; });
    if (vendor) list = list.filter(function(m) { return m.vendor === vendor; });
    const seen = Object.create(null);
    return list.filter(function(m) {
      if (seen[m.id]) return false;
      seen[m.id] = true;
      return true;
    }).sort(function(a, b) {
      return (b.created || 0) - (a.created || 0) || String(a.id).localeCompare(String(b.id));
    });
  }

  function getModelIds(vendor) {
    return getModels(vendor).map(function(m) { return m.id; });
  }

  function getModelMeta(id) {
    return getModels().find(function(m) { return m.id === id; }) || null;
  }

  function isFresh() {
    const cat = ensureCatalog();
    return !!cat.fetchedAt && (Date.now() - cat.fetchedAt < TTL_MS);
  }

  function configuredVendors() {
    return REMOTE_VENDORS.filter(function(v) { return !!state.config[v + 'Key']; });
  }

  function statusText() {
    const cat = ensureCatalog();
    const configured = configuredVendors();
    if (!configured.length) return '未配置厂商 Key，当前使用内置模型列表。保存 Key 后可自动拉取最新模型。';
    if (!cat.fetchedAt) return '已配置 Key，点击「刷新模型列表」拉取厂商最新模型。';
    const failed = configured.filter(function(v) { return cat.errors && cat.errors[v]; });
    let text = '已同步 ' + getModels().length + ' 个模型 · ' + new Date(cat.fetchedAt).toLocaleString();
    if (failed.length) text += ' · ' + failed.length + ' 个厂商拉取失败，已保留缓存';
    return text;
  }

  function clear() {
    state.modelCatalog = blankCatalog();
    saveToStorage();
  }

  function init(options) {
    const opts = options || {};
    loadFromStorage();
    const configured = configuredVendors();
    if (opts.autoRefresh !== false && configured.length && !isFresh()) {
      return discover({ signal: opts.signal }).catch(function() { return null; });
    }
    return Promise.resolve(null);
  }

  loadFromStorage();

  return {
    REMOTE_VENDORS, ENDPOINTS, TTL_MS,
    loadFromStorage, saveToStorage, discover, getModels, getModelIds,
    getModelMeta, isFresh, configuredVendors, statusText, clear, init,
  };
})();
