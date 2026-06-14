/* ============================================================
   MyAgentTeam · F+14.1 ARK CORS 透明代理
   api/proxy/ark.js — Vercel Edge Function

   职责（纯 pass-through · 零业务逻辑）：
   - 接收浏览器 POST → 转发到 ARK
   - 透传 Authorization header（用户 Key 不被 vercel 存/log）
   - 返回 ARK 响应 + 加 CORS header（让浏览器接受）
   - 支持 SSE streaming（ARK 流式响应）

   为什么需要：
   - Volcengine ARK API 不返回 Access-Control-Allow-Origin header
   - 浏览器从 vercel.app 等生产域名直连 ARK 必被 CORS 阻拦
   - 此代理仅做 CORS 桥接，不动 Key、不动 body、不 log

   架构原则保留：
   - Key 仍在用户 localStorage（vercel 不存）
   - 流量经过 vercel 但 vercel 不读不存（Edge runtime 不 log body）
   - 与 vercel 静态 hosting 同源信任域

   等价于：在 ARK 前加一个 CORS 桥接器，不是真正的"中间服务器"
   ============================================================ */

export const config = {
  runtime: 'edge',  // Edge runtime 关键：支持 streaming pass-through
};

const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ALLOWED_METHODS = 'POST, OPTIONS';

export default async function handler(req) {
  const origin = req.headers.get('origin') || '*';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 只允许 POST（防滥用 / 防 GET 缓存 / 防 HEAD 浪费）
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin },
    });
  }

  // 验证 Authorization 头存在（避免代理空请求浪费 ARK quota）
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization header required (Bearer ARK_KEY)' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin },
    });
  }

  // Pass-through 到 ARK
  let arkResp;
  try {
    arkResp = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: req.body,
      // @ts-ignore Edge runtime supports duplex streaming
      duplex: 'half',
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `ARK upstream fetch failed: ${e.message}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin },
    });
  }

  // 透传 ARK 响应 + 加 CORS header
  // ARK 返回 SSE (text/event-stream)，Edge Runtime ReadableStream 直接 pipe
  return new Response(arkResp.body, {
    status: arkResp.status,
    headers: {
      'Content-Type': arkResp.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Expose-Headers': 'Content-Type',
    },
  });
}
