/* ============================================================
   MyAgentTeam · 动态模型列表同源代理
   api/models.js — Vercel Edge Function

   职责：
   - 接收前端 GET /api/models?vendor=xxx
   - 从 X-MAT-API-Key 头读取用户 Key（不存、不 log）
   - 转发到厂商 /v1/models，透传响应与分页参数
   - 解决 OpenAI / 国内厂商在浏览器端的 CORS 限制

   安全边界：
   - vendor 走白名单，禁止任意 URL 转发（不是通用代理）
   - 仅 GET，响应 no-store
   - 不记录 Authorization / X-MAT-API-Key
   ============================================================ */

export const config = {
  runtime: 'edge',
};

const ENDPOINTS = Object.freeze({
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
  deepseek: 'https://api.deepseek.com/v1/models',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
});

const ALLOWED_HEADERS = 'Content-Type, Accept, X-MAT-Vendor, X-MAT-API-Key';

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
    },
  });
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }

  const url = new URL(req.url);
  const vendor = url.searchParams.get('vendor') || '';
  const key = req.headers.get('x-mat-api-key') || '';

  if (!Object.prototype.hasOwnProperty.call(ENDPOINTS, vendor)) {
    return json({ error: 'Unsupported vendor: ' + (vendor || '(empty)') }, 400, origin);
  }
  if (!key) {
    return json({ error: 'X-MAT-API-Key header required' }, 401, origin);
  }

  const upstreamUrl = new URL(ENDPOINTS[vendor]);
  const afterId = url.searchParams.get('after_id');
  if (afterId) upstreamUrl.searchParams.set('after_id', afterId);
  const beforeId = url.searchParams.get('before_id');
  if (beforeId) upstreamUrl.searchParams.set('before_id', beforeId);

  const headers = { 'Accept': 'application/json' };
  if (vendor === 'anthropic') {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = 'Bearer ' + key;
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl.toString(), { method: 'GET', headers });
  } catch (e) {
    return json({ error: 'Upstream fetch failed: ' + (e && e.message ? e.message : 'unknown') }, 502, origin);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
    },
  });
}
