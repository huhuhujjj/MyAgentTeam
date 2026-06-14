/* ============================================================
   MyAgentTeam · F+14 i18n Phase 1
   src/i18n/i18n.js — 国际化基础设施

   职责：
   - setLocale / getLocale / detectLocale
   - t(key, fallback) 查字典
   - register(locale, dict) 让各 i18n/*.js 注册自己的条目
   - walkAndTranslate(root) 一次性翻译 DOM 内 [data-i18n] 元素
   - 监听 mat:localechange 自动重渲染所有标记元素

   用法（HTML）：
     <span data-i18n="header.intro">介绍</span>
     <input data-i18n-placeholder="welcome.input.placeholder" placeholder="..."/>
     <button data-i18n-title="header.settings.tip" title="设置">⚙</button>
     <div data-i18n-html="settings.doubao.hint">含 <a href=...>链接</a> 或 <code>...</code></div>

   用法（JS）：
     toast(MAT_I18N.t('error.network'), 'warn')

   依赖：无（pure logic）
   持久化：localStorage 'myAgentTeam.locale'
   ============================================================ */

window.MAT_I18N = (function() {
  'use strict';
  const LS_KEY = 'myAgentTeam.locale';
  const SUPPORTED = ['zh', 'en'];

  /** @returns {'zh'|'en'} */
  function detectLocale() {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (SUPPORTED.includes(saved)) return /** @type {'zh'|'en'} */(saved);
    } catch {}
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  let currentLocale = detectLocale();
  /** @type {Record<'zh'|'en', Record<string, string>>} */
  const dicts = { zh: {}, en: {} };

  /**
   * 注册某语言的条目（各 i18n/*.js 在加载时调用）
   * @param {'zh'|'en'} locale
   * @param {Record<string, string>} dict
   */
  function register(locale, dict) {
    if (!SUPPORTED.includes(locale)) return;
    Object.assign(dicts[locale], dict);
  }

  /**
   * 查字典
   * 找不到时 fallback 到 zh → fallback 参数 → key 本身
   * @param {string} key
   * @param {string} [fallback]
   * @returns {string}
   */
  function t(key, fallback) {
    const v = dicts[currentLocale]?.[key];
    if (v !== undefined) return v;
    const zh = dicts.zh?.[key];
    if (zh !== undefined) return zh;
    return fallback !== undefined ? fallback : key;
  }

  /** @returns {'zh'|'en'} */
  function getLocale() { return currentLocale; }

  /**
   * 切换语言 + 持久化 + 触发 DOM 重新渲染
   * @param {'zh'|'en'} locale
   */
  function setLocale(locale) {
    if (!SUPPORTED.includes(locale)) return;
    if (locale === currentLocale) return;
    currentLocale = locale;
    try { localStorage.setItem(LS_KEY, locale); } catch {}
    document.documentElement.lang = locale;
    walkAndTranslate(document.body);
    // 触发自定义事件给业务代码（如 dropdown 项目名）做响应
    document.dispatchEvent(new CustomEvent('mat:localechange', { detail: { locale } }));
  }

  /**
   * 遍历 root 内 [data-i18n] / [data-i18n-placeholder] / [data-i18n-title]
   * 用当前 locale 字典替换 textContent / placeholder / title
   * @param {ParentNode} root
   */
  function walkAndTranslate(root) {
    if (!root || !root.querySelectorAll) return;
    // textContent
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key, el.textContent);
    });
    // placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    // title (tooltip)
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
    // F+14 Phase 2d: innerHTML（用于含 <a>/<code>/<br/> 等的复杂 hint）
    // 注意：字典值必须可信（不是用户输入），否则 XSS 风险
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key, el.innerHTML);
    });
  }

  // 初始化 html lang
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLocale;
  }

  /**
   * Phase 3：runAgent 系统 prompt 末尾注入"输出语言"指令
   * 中文 locale → 空（prompt 本身就是中文）
   * 英文 locale → 追加 "Respond in English." 强指令
   *
   * 为什么不翻译 22 个 system prompt？
   *   ① 翻译质量难保证 → 可能损失 prompt 的精度（多年迭代的 prompt 工程）
   *   ② 现代旗舰 LLM（GPT-4+/Claude 3+/DeepSeek V3+/Qwen3）能完美处理"中文 prompt + 英文输出"
   *   ③ 0 工作量覆盖所有 Agent + 未来新增 Agent
   *   ④ 未来想彻底翻译某 Agent 时，给 AGENTS[key] 加 `systemEn` 字段即可（fallback 机制内置）
   *
   * @returns {string} 拼接到 system prompt 末尾的语言指令
   */
  function outputLanguageHint() {
    if (currentLocale === 'en') {
      return '\n\n[IMPORTANT — Output language]\nRespond **entirely in English**. All your reasoning, evidence citations, structured sections, headers, and tool query terms must be in English. Translate any Chinese terminology in the user input to English in your output.';
    }
    return '';  // zh：原 prompt 即中文，无需注入
  }

  /**
   * Phase 3：按 locale 解析 Agent 系统 prompt
   * 优先 agentLike.systemEn（如果定义且 locale=en），否则 fallback 到 agentLike.system
   * @param {{system?: string, systemEn?: string} | null | undefined} agentLike
   * @returns {string}
   */
  function resolveSystemByLocale(agentLike) {
    if (!agentLike) return '';
    if (currentLocale === 'en' && agentLike.systemEn) return agentLike.systemEn;
    return agentLike.system || '';
  }

  return {
    t, setLocale, getLocale, register, detectLocale, walkAndTranslate, SUPPORTED,
    outputLanguageHint, resolveSystemByLocale,
  };
})();
