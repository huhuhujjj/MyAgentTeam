/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/lib/utils.js — 纯 leaf 工具函数（无任何外部依赖）

   使用方式：
     index.html 中先于 app.js 加载本文件 → window.MAT_UTILS 可用
     app.js 顶部：const { fmtUsd, sleep, ... } = MAT_UTILS;

   F+13 重构原则：
   - 本文件**只放纯函数**（无 state 访问、无 DOM 访问、无 API 调用）
   - 函数签名保持与原 app.js 完全一致，确保 1:1 替换
   - 使用 IIFE namespace 而非 ES modules，避免 type="module" 严格模式的破坏性
   ============================================================ */

window.MAT_UTILS = (function() {
  'use strict';

  /**
   * USD 格式化（4 位小数）
   * @param {number} n - 美元数额
   * @returns {string} 形如 '$1.2346'
   */
  function fmtUsd(n) { return '$' + n.toFixed(4); }

  /**
   * USD 简化格式化（2 位小数，用于熔断显示）
   * @param {number} n
   * @returns {string} 形如 '$1.23'
   */
  function fmtUsdShort(n) { return '$' + n.toFixed(2); }

  /**
   * Promise 化的 setTimeout
   * @param {number} ms - 等待毫秒数
   * @returns {Promise<void>}
   */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /**
   * HTML 转义防 XSS（用于把用户输入插入 DOM 前的清洗）
   * @param {*} s - 任意值，会先 String()
   * @returns {string} 转义后的安全字符串
   */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * 粗略 token 估算：中文 1 字 ≈ 1.5 token，英文 4 字符 ≈ 1 token
   * @param {string} s - 输入字符串
   * @returns {number} 估算的 token 数
   */
  function tokensFromText(s) {
    const cn = (s.match(/[一-龥]/g) || []).length;
    const en = s.length - cn;
    return Math.ceil(cn * 1.5 + en / 4);
  }

  /**
   * Jaccard 相似度（中文按字 + 英文按词 ≥ 2 字符）
   * @param {string} a
   * @param {string} b
   * @returns {number} 0-1 之间的相似度
   */
  function jaccardSim(a, b) {
    const tok = (s) => new Set((s || '').toLowerCase().match(/[一-龥]|[a-z]{2,}/g) || []);
    const A = tok(a), B = tok(b);
    if (!A.size || !B.size) return 0;
    let inter = 0; for (const t of A) if (B.has(t)) inter++;
    return inter / (A.size + B.size - inter);
  }

  /**
   * 检测两条事实是否语义相反（粗略规则）
   * 触发条件：核心词重叠 ≥ 0.5，但其中一条含否定词、另一条不含
   * 用于 runMemoryHygiene 标记冲突 fact
   * @param {string} a
   * @param {string} b
   * @returns {boolean} true 表示语义冲突
   */
  function detectFactConflict(a, b) {
    const sim = jaccardSim(a, b);
    if (sim < 0.5) return false;
    const negA = /不|没|无|拒|避免|讨厌/.test(a);
    const negB = /不|没|无|拒|避免|讨厌/.test(b);
    return negA !== negB;
  }

  return {
    fmtUsd, fmtUsdShort, sleep,
    escapeHtml, tokensFromText,
    jaccardSim, detectFactConflict,
  };
})();

// F+13 Sprint 1.5 / Phase A 已回滚双轨方案：
// ES export 仅在 <script type="module"> 加载时合法。
// type="module" 是 deferred 加载，导致后续 plain script 的 MAT_UTILS 依赖失败。
// 结论：ES modules 迁移必须 all-in（全部 modules 同时切 type="module" + app.js 改 import），不能渐进。
