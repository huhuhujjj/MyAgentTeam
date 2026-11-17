/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase D
   src/persist/encryption.js — Web Crypto 加密层

   职责：PBKDF2 派生 + AES-GCM 加密 + sessionStorage key 缓存
   依赖：window.MAT_CONSTANTS (STORAGE_KEY, MEMORY_KEY, MEMORY_BY_PROJECT_KEY)
   ============================================================ */

window.MAT_ENCRYPTION = (function() {
  "use strict";
  const { STORAGE_KEY, MEMORY_KEY, MEMORY_BY_PROJECT_KEY } = MAT_CONSTANTS;

  const ENC_FLAG_KEY = 'myAgentTeam.encryptionEnabled';
  const ENC_SALT_KEY = 'myAgentTeam.encryptionSalt';
  const ENC_SESSION_KEY = 'myAgentTeam.sessionDerivedKey';  // base64 in sessionStorage
  const ENC_ONBOARDING_KEY = 'myAgentTeam.encOnboarded';    // 首次引导已处理（设密码或跳过）
  const ENC_PBKDF2_ITERATIONS = 100_000;
  const ENC_SENSITIVE_KEYS = [STORAGE_KEY, MEMORY_KEY, MEMORY_BY_PROJECT_KEY];  // F+11 项目隔离 memory 也加密
  
  let _sessionKey = null;  // CryptoKey 缓存
  
  function _bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function _b64ToBuf(b64) {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }
  
  async function _deriveKeyFromPassword(password, saltB64) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const salt = _b64ToBuf(saltB64);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ENC_PBKDF2_ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  async function encryptionSetup(password) {
    // 生成新盐 → 派生 → 测试 → 保存
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = _bufToB64(salt.buffer);
    localStorage.setItem(ENC_SALT_KEY, saltB64);
    _sessionKey = await _deriveKeyFromPassword(password, saltB64);
    // 把当前 plain config 立刻加密
    await encryptionRekey();
    localStorage.setItem(ENC_FLAG_KEY, '1');
    // 缓存到 sessionStorage（base64 raw key）
    const raw = await crypto.subtle.exportKey('raw', _sessionKey);
    sessionStorage.setItem(ENC_SESSION_KEY, _bufToB64(raw));
  }
  
  async function encryptionUnlock(password) {
    const saltB64 = localStorage.getItem(ENC_SALT_KEY);
    if (!saltB64) throw new Error('no_salt');
    const key = await _deriveKeyFromPassword(password, saltB64);
    // 验证：尝试解密一个 sensitive key
    for (const k of ENC_SENSITIVE_KEYS) {
      const raw = localStorage.getItem(k);
      if (!raw || !raw.startsWith('ENC1:')) continue;
      try { await _decryptStr(raw, key); _sessionKey = key; } catch { throw new Error('wrong_password'); }
      break;
    }
    _sessionKey = key;
    const rawKey = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(ENC_SESSION_KEY, _bufToB64(rawKey));
  }
  
  function encryptionIsLocked() {
    return localStorage.getItem(ENC_FLAG_KEY) === '1' && !_sessionKey;
  }
  function encryptionEnabled() {
    return localStorage.getItem(ENC_FLAG_KEY) === '1';
  }
  
  async function _restoreSessionKey() {
    if (_sessionKey) return _sessionKey;
    if (!encryptionEnabled()) return null;
    const cached = sessionStorage.getItem(ENC_SESSION_KEY);
    if (!cached) return null;
    try {
      _sessionKey = await crypto.subtle.importKey(
        'raw', _b64ToBuf(cached), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
      );
      return _sessionKey;
    } catch { return null; }
  }
  
  async function _encryptStr(plain) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(plain);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _sessionKey, enc);
    return 'ENC1:' + _bufToB64(iv.buffer) + ':' + _bufToB64(ct);
  }
  async function _decryptStr(blob, key = _sessionKey) {
    if (!blob.startsWith('ENC1:')) return blob;  // 兼容未加密
    const [, ivB64, ctB64] = blob.split(':');
    const iv = new Uint8Array(_b64ToBuf(ivB64));
    const ct = _b64ToBuf(ctB64);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plain);
  }
  
  /** 重新加密所有敏感数据（启用 / 改密码后调用）*/
  async function encryptionRekey() {
    for (const k of ENC_SENSITIVE_KEYS) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      // 如果已加密但是用不同密钥的，跳过（应先解锁旧的）
      if (raw.startsWith('ENC1:')) continue;
      const cipher = await _encryptStr(raw);
      localStorage.setItem(k, cipher);
    }
  }
  
  /** 关闭加密：解密所有敏感数据 + 清除标志 */
  async function encryptionDisable() {
    for (const k of ENC_SENSITIVE_KEYS) {
      const raw = localStorage.getItem(k);
      if (raw && raw.startsWith('ENC1:')) {
        const plain = await _decryptStr(raw);
        localStorage.setItem(k, plain);
      }
    }
    localStorage.removeItem(ENC_FLAG_KEY);
    localStorage.removeItem(ENC_SALT_KEY);
    sessionStorage.removeItem(ENC_SESSION_KEY);
    _sessionKey = null;
  }
  
  /** 透明加解密包装：用在 loadConfig / saveConfig 等持久化层 */
  async function readEncryptedJSON(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (!raw.startsWith('ENC1:')) return JSON.parse(raw);
    await _restoreSessionKey();
    if (!_sessionKey) throw new Error('locked');
    const plain = await _decryptStr(raw);
    return JSON.parse(plain);
  }
  async function writeEncryptedJSON(key, value) {
    const txt = JSON.stringify(value);
    if (encryptionEnabled() && _sessionKey) {
      localStorage.setItem(key, await _encryptStr(txt));
    } else {
      localStorage.setItem(key, txt);
    }
  }
  
  /* ====================== Agent 工具调用 · Tier 1 ====================== */
  
  // F+13 Sprint 1: TOOL_LOOP_MAX / TOOL_TIMEOUT_MS → constants.js（详细注释见 constants.js）
  
  // F+13 Sprint 1: sanitizeSearchDescription + TOOLS + getToolsForAgent + executeToolCall → ./src/tools/tools.js
  

  return {
    ENC_FLAG_KEY, ENC_SALT_KEY, ENC_SESSION_KEY, ENC_ONBOARDING_KEY, ENC_PBKDF2_ITERATIONS, ENC_SENSITIVE_KEYS,
    encryptionSetup, encryptionUnlock, encryptionIsLocked, encryptionEnabled,
    encryptionRekey, encryptionDisable,
    readEncryptedJSON, writeEncryptedJSON,
    _restoreSessionKey,  // F+13 bugfix: init() 在 app.js 调用 _restoreSessionKey()，需 export
  };
})();
